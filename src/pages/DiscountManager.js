import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  writeBatch,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { CacheManager, CACHE_KEYS } from "../utils/cache";
import Navbar from "../components/Navbar";
import "../css/DiscountManager.css";

function DiscountManager() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Discount form state
  const [discountType, setDiscountType] = useState("product"); // product, category, brand
  const [selectedItems, setSelectedItems] = useState([]);
  const [discountMethod, setDiscountMethod] = useState("percentage"); // percentage, fixed
  const [discountValue, setDiscountValue] = useState("");
  const [discountName, setDiscountName] = useState("");
  const [discountExpiry, setDiscountExpiry] = useState("");

  // Edit discount state
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [editDiscountValue, setEditDiscountValue] = useState("");
  const [editDiscountName, setEditDiscountName] = useState("");
  const [editDiscountExpiry, setEditDiscountExpiry] = useState("");

  // Search and pagination for products
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12); // Show 12 products per page

  // Pagination for current discounts
  const [discountsPage, setDiscountsPage] = useState(1);
  const [discountsPerPage] = useState(8); // Show 8 discounts per page

  useEffect(() => {
    fetchData();
    // Check for expired discounts every minute
    const interval = setInterval(checkExpiredDiscounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch products
      const productsQuery = query(collection(db, "products"), orderBy("name"));
      const productsSnapshot = await getDocs(productsQuery);
      const productsList = [];
      productsSnapshot.forEach((doc) => {
        productsList.push({ id: doc.id, ...doc.data() });
      });
      setProducts(productsList);

      // Fetch categories from the categories collection
      try {
        const categoriesSnapshot = await getDocs(collection(db, "categories"));
        const categoriesList = [];
        categoriesSnapshot.forEach((doc) => {
          categoriesList.push({ id: doc.id, ...doc.data() });
        });
        setCategories(categoriesList);
      } catch (error) {
        // Fallback to unique categories from products
        const uniqueCategories = [
          ...new Set(productsList.map((p) => p.category).filter(Boolean)),
        ];
        setCategories(uniqueCategories.map(cat => ({ name: cat })));
      }

      // Fetch brands from the brands collection
      try {
        const brandsSnapshot = await getDocs(collection(db, "brands"));
        const brandsList = [];
        brandsSnapshot.forEach((doc) => {
          brandsList.push({ id: doc.id, ...doc.data() });
        });
        setBrands(brandsList);
      } catch (error) {
        // Fallback to unique brands from products
        const uniqueBrands = [
          ...new Set(productsList.map((p) => p.brand).filter(Boolean)),
        ];
        setBrands(uniqueBrands.map(brand => ({ name: brand })));
      }
    } catch (error) {
      alert("حدث خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const calculateDiscountedPrice = (
    originalPrice,
    discountValue,
    discountMethod,
  ) => {
    if (discountMethod === "percentage") {
      return originalPrice - originalPrice * (discountValue / 100);
    } else {
      return Math.max(0, originalPrice - discountValue);
    }
  };

  const applyDiscount = async () => {
    if (!discountValue || !discountName || selectedItems.length === 0) {
      alert("يرجى ملء جميع الحقول واختيار العناصر");
      return;
    }

    if (
      discountValue <= 0 ||
      (discountMethod === "percentage" && discountValue >= 100)
    ) {
      alert("يرجى إدخال قيمة خصم صحيحة");
      return;
    }

    setUpdating(true);
    try {
      const batch = writeBatch(db);
      let affectedProducts = [];

      if (discountType === "product") {
        affectedProducts = products.filter((p) => selectedItems.includes(p.id));
      } else if (discountType === "category") {
        affectedProducts = products.filter((p) =>
          selectedItems.includes(p.category),
        );
      } else if (discountType === "brand") {
        affectedProducts = products.filter((p) =>
          selectedItems.includes(p.brand),
        );
      }

      affectedProducts.forEach((product) => {
        if (product.hasVariants) {
          // Handle variants with discounts
          const updatedVariants = product.variants.map((variant) => {
            const originalVariantPrice = variant.originalPrice || variant.price;
            const discountedVariantPrice = calculateDiscountedPrice(
              originalVariantPrice,
              parseFloat(discountValue),
              discountMethod,
            );

            return {
              ...variant,
              originalPrice: originalVariantPrice,
              price: Math.round(discountedVariantPrice * 100) / 100,
            };
          });

          const productRef = doc(db, "products", product.id);
          batch.update(productRef, {
            variants: updatedVariants,
            hasDiscount: true,
            discountType: discountMethod,
            discountValue: parseFloat(discountValue),
            discountName: discountName,
            discountAppliedAt: new Date(),
            discountExpiresAt: discountExpiry ? new Date(discountExpiry) : null,
          });
        } else {
          // Handle regular products
          const discountedPrice = calculateDiscountedPrice(
            product.originalPrice || product.price,
            parseFloat(discountValue),
            discountMethod,
          );

          const productRef = doc(db, "products", product.id);
          batch.update(productRef, {
            originalPrice: product.originalPrice || product.price, // Keep original if not set
            price: Math.round(discountedPrice * 100) / 100, // Round to 2 decimals
            hasDiscount: true,
            discountType: discountMethod,
            discountValue: parseFloat(discountValue),
            discountName: discountName,
            discountAppliedAt: new Date(),
            discountExpiresAt: discountExpiry ? new Date(discountExpiry) : null,
          });
        }
      });

      await batch.commit();

      // Invalidate products cache to ensure fresh data everywhere
      CacheManager.remove(CACHE_KEYS.PRODUCTS);

      // Reset form
      setSelectedItems([]);
      setDiscountValue("");
      setDiscountName("");
      setDiscountExpiry("");

      // Don't call fetchData() here to avoid potential loops
      // Update local state with the new discounts
      const updatedProducts = products.map((p) => {
        const isAffected = affectedProducts.find((ap) => ap.id === p.id);
        if (isAffected) {
          if (p.hasVariants) {
            // Update variants with new discounts
            const updatedVariants = p.variants.map((variant) => {
              const originalVariantPrice =
                variant.originalPrice || variant.price;
              const discountedVariantPrice = calculateDiscountedPrice(
                originalVariantPrice,
                parseFloat(discountValue),
                discountMethod,
              );
              return {
                ...variant,
                originalPrice: originalVariantPrice,
                price: Math.round(discountedVariantPrice * 100) / 100,
              };
            });
            return {
              ...p,
              variants: updatedVariants,
              hasDiscount: true,
              discountType: discountMethod,
              discountValue: parseFloat(discountValue),
              discountName: discountName,
              discountAppliedAt: new Date(),
              discountExpiresAt: discountExpiry
                ? new Date(discountExpiry)
                : null,
            };
          } else {
            // Update regular product with new discount
            const discountedPrice = calculateDiscountedPrice(
              p.originalPrice || p.price,
              parseFloat(discountValue),
              discountMethod,
            );
            return {
              ...p,
              originalPrice: p.originalPrice || p.price,
              price: Math.round(discountedPrice * 100) / 100,
              hasDiscount: true,
              discountType: discountMethod,
              discountValue: parseFloat(discountValue),
              discountName: discountName,
              discountAppliedAt: new Date(),
              discountExpiresAt: discountExpiry
                ? new Date(discountExpiry)
                : null,
            };
          }
        }
        return p;
      });
      setProducts(updatedProducts);

      alert(`تم تطبيق الخصم على ${affectedProducts.length} منتج`);
    } catch (error) {
      alert("حدث خطأ في تطبيق الخصم");
    } finally {
      setUpdating(false);
    }
  };

  const removeDiscount = async (productId) => {
    setUpdating(true);
    try {
      const product = products.find((p) => p.id === productId);
      if (!product.originalPrice) {
        alert("هذا المنتج لا يحتوي على خصم");
        return;
      }

      const productRef = doc(db, "products", productId);
      if (product.hasVariants) {
        // Restore original variant prices
        const restoredVariants = product.variants.map((variant) => ({
          ...variant,
          price: variant.originalPrice || variant.price,
          originalPrice: null,
        }));

        await updateDoc(productRef, {
          variants: restoredVariants,
          hasDiscount: false,
          discountType: null,
          discountValue: null,
          discountName: null,
          discountAppliedAt: null,
          discountExpiresAt: null,
        });
      } else {
        await updateDoc(productRef, {
          price: product.originalPrice,
          hasDiscount: false,
          discountType: null,
          discountValue: null,
          discountName: null,
          discountAppliedAt: null,
          discountExpiresAt: null,
          originalPrice: null,
        });
      }

      // Invalidate products cache to ensure fresh data everywhere
      CacheManager.remove(CACHE_KEYS.PRODUCTS);

      // Don't call fetchData() here to avoid potential loops
      // Update local state by removing the discount
      const updatedProducts = products.map((p) => {
        if (p.id === productId) {
          if (p.hasVariants) {
            // Restore original variant prices
            const restoredVariants = p.variants.map((variant) => ({
              ...variant,
              price: variant.originalPrice || variant.price,
              originalPrice: null,
            }));
            return {
              ...p,
              variants: restoredVariants,
              hasDiscount: false,
              discountType: null,
              discountValue: null,
              discountName: null,
              discountAppliedAt: null,
              discountExpiresAt: null,
            };
          } else {
            return {
              ...p,
              price: p.originalPrice,
              hasDiscount: false,
              discountType: null,
              discountValue: null,
              discountName: null,
              discountAppliedAt: null,
              discountExpiresAt: null,
              originalPrice: null,
            };
          }
        }
        return p;
      });
      setProducts(updatedProducts);

      alert("تم إزالة الخصم بنجاح");
    } catch (error) {
      alert("حدث خطأ في إزالة الخصم");
    } finally {
      setUpdating(false);
    }
  };

  const editDiscount = async (productId) => {
    if (!editDiscountValue || !editDiscountName) {
      alert("يرجى ملء جميع الحقول");
      return;
    }

    if (
      editDiscountValue <= 0 ||
      (editingDiscount.discountType === "percentage" &&
        editDiscountValue >= 100)
    ) {
      alert("يرجى إدخال قيمة خصم صحيحة");
      return;
    }

    setUpdating(true);
    try {
      const product = products.find((p) => p.id === productId);
      const productRef = doc(db, "products", productId);

      if (product.hasVariants) {
        // Handle variants with updated discounts
        const updatedVariants = product.variants.map((variant) => {
          const originalVariantPrice = variant.originalPrice || variant.price;
          const discountedVariantPrice = calculateDiscountedPrice(
            originalVariantPrice,
            parseFloat(editDiscountValue),
            editingDiscount.discountType,
          );

          return {
            ...variant,
            originalPrice: originalVariantPrice,
            price: Math.round(discountedVariantPrice * 100) / 100,
          };
        });

        await updateDoc(productRef, {
          variants: updatedVariants,
          discountValue: parseFloat(editDiscountValue),
          discountName: editDiscountName,
          discountExpiresAt: editDiscountExpiry
            ? new Date(editDiscountExpiry)
            : null,
        });
      } else {
        // Handle regular products with updated discounts
        const discountedPrice = calculateDiscountedPrice(
          product.originalPrice || product.price,
          parseFloat(editDiscountValue),
          editingDiscount.discountType,
        );

        await updateDoc(productRef, {
          price: Math.round(discountedPrice * 100) / 100,
          discountValue: parseFloat(editDiscountValue),
          discountName: editDiscountName,
          discountExpiresAt: editDiscountExpiry
            ? new Date(editDiscountExpiry)
            : null,
        });
      }

      // Invalidate products cache to ensure fresh data everywhere
      CacheManager.remove(CACHE_KEYS.PRODUCTS);

      // Reset edit form
      setEditingDiscount(null);
      setEditDiscountValue("");
      setEditDiscountName("");
      setEditDiscountExpiry("");

      // Don't call fetchData() here to avoid potential loops
      // Update local state with the edited discount
      const updatedProducts = products.map((p) => {
        if (p.id === productId) {
          if (p.hasVariants) {
            // Update variants with new discount values
            const updatedVariants = p.variants.map((variant) => {
              const originalVariantPrice =
                variant.originalPrice || variant.price;
              const discountedVariantPrice = calculateDiscountedPrice(
                originalVariantPrice,
                parseFloat(editDiscountValue),
                editingDiscount.discountType,
              );
              return {
                ...variant,
                price: Math.round(discountedVariantPrice * 100) / 100,
              };
            });
            return {
              ...p,
              variants: updatedVariants,
              discountValue: parseFloat(editDiscountValue),
              discountName: editDiscountName,
              discountExpiresAt: editDiscountExpiry
                ? new Date(editDiscountExpiry)
                : null,
            };
          } else {
            // Update regular product with new discount values
            const discountedPrice = calculateDiscountedPrice(
              p.originalPrice || p.price,
              parseFloat(editDiscountValue),
              editingDiscount.discountType,
            );
            return {
              ...p,
              price: Math.round(discountedPrice * 100) / 100,
              discountValue: parseFloat(editDiscountValue),
              discountName: editDiscountName,
              discountExpiresAt: editDiscountExpiry
                ? new Date(editDiscountExpiry)
                : null,
            };
          }
        }
        return p;
      });
      setProducts(updatedProducts);

      alert("تم تحديث الخصم بنجاح");
    } catch (error) {
      alert("حدث خطأ في تحديث الخصم");
    } finally {
      setUpdating(false);
    }
  };

  const startEditingDiscount = (product) => {
    setEditingDiscount(product);
    setEditDiscountValue(product.discountValue.toString());
    setEditDiscountName(product.discountName);
    setEditDiscountExpiry(
      product.discountExpiresAt
        ? new Date(product.discountExpiresAt.seconds * 1000)
            .toISOString()
            .slice(0, 16)
        : "",
    );
  };

  const cancelEditingDiscount = () => {
    setEditingDiscount(null);
    setEditDiscountValue("");
    setEditDiscountName("");
    setEditDiscountExpiry("");
  };

  // Helper function to recalculate discounts for products when their original prices change
  const recalculateProductDiscounts = async () => {
    try {
      const productsWithDiscounts = products.filter((p) => p.hasDiscount);
      if (productsWithDiscounts.length === 0) return;

      const batch = writeBatch(db);
      let updatedCount = 0;

      productsWithDiscounts.forEach((product) => {
        if (product.hasVariants) {
          // Recalculate variant discounts
          const updatedVariants = product.variants.map((variant) => {
            if (variant.originalPrice) {
              const discountedVariantPrice = calculateDiscountedPrice(
                variant.originalPrice,
                product.discountValue,
                product.discountType,
              );
              return {
                ...variant,
                price: Math.round(discountedVariantPrice * 100) / 100,
              };
            }
            return variant;
          });

          batch.update(doc(db, "products", product.id), {
            variants: updatedVariants,
          });
          updatedCount++;
        } else if (product.originalPrice) {
          // Recalculate regular product discount
          const discountedPrice = calculateDiscountedPrice(
            product.originalPrice,
            product.discountValue,
            product.discountType,
          );

          batch.update(doc(db, "products", product.id), {
            price: Math.round(discountedPrice * 100) / 100,
          });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
        CacheManager.remove(CACHE_KEYS.PRODUCTS);
        // Don't call fetchData() here to avoid infinite loops
        // Just update the local state with the new data
        const updatedProducts = products.map((product) => {
          if (product.hasDiscount) {
            if (product.hasVariants) {
              // Update variants with recalculated prices
              const updatedVariants = product.variants.map((variant) => {
                if (variant.originalPrice) {
                  const discountedPrice = calculateDiscountedPrice(
                    variant.originalPrice,
                    product.discountValue,
                    product.discountType,
                  );
                  return {
                    ...variant,
                    price: Math.round(discountedPrice * 100) / 100,
                  };
                }
                return variant;
              });
              return { ...product, variants: updatedVariants };
            } else if (product.originalPrice) {
              // Update regular product price
              const discountedPrice = calculateDiscountedPrice(
                product.originalPrice,
                product.discountValue,
                product.discountType,
              );
              return {
                ...product,
                price: Math.round(discountedPrice * 100) / 100,
              };
            }
          }
          return product;
        });
        setProducts(updatedProducts);
      }
    } catch (error) {}
  };

  const handleItemSelection = (item) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  };

  const getAvailableItems = () => {
    switch (discountType) {
      case "product":
        // Filter products by search term
        let filteredProducts = products.filter(
          (product) =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.category &&
              product.category
                .toLowerCase()
                .includes(searchTerm.toLowerCase())) ||
            (product.brand &&
              product.brand.toLowerCase().includes(searchTerm.toLowerCase())),
        );

        // Apply pagination for products only
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredProducts.slice(startIndex, endIndex);

      case "category":
        return categories.map((cat) => ({
          id: cat.name,
          name: cat.name,
          images: cat.imageUrl ? [cat.imageUrl] : [],
        }));
      case "brand":
        return brands.map((brand) => ({
          id: brand.name,
          name: brand.name,
          images: brand.logo ? [brand.logo] : [],
        }));
      default:
        return [];
    }
  };

  // Get total filtered products count for pagination
  const getFilteredProductsCount = () => {
    if (discountType !== "product") return 0;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.category &&
          product.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.brand &&
          product.brand.toLowerCase().includes(searchTerm.toLowerCase())),
    ).length;
  };

  const totalPages = Math.ceil(getFilteredProductsCount() / itemsPerPage);

  // Reset pagination when search term or discount type changes
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleDiscountTypeChange = (type) => {
    setDiscountType(type);
    setSearchTerm("");
    setCurrentPage(1);
    setSelectedItems([]);
  };

  // Select all items on current page
  const selectAllCurrentPage = () => {
    const currentItems = getAvailableItems();
    const currentItemIds = currentItems.map((item) => item.id);
    setSelectedItems((prev) => {
      const newSelection = [...prev];
      currentItemIds.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      return newSelection;
    });
  };

  // Clear selection for current page
  const clearCurrentPageSelection = () => {
    const currentItems = getAvailableItems();
    const currentItemIds = currentItems.map((item) => item.id);
    setSelectedItems((prev) =>
      prev.filter((id) => !currentItemIds.includes(id)),
    );
  };

  // Select all products (across all pages)
  const selectAllProducts = () => {
    if (discountType === "product") {
      const filteredProducts = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.category &&
            product.category
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          (product.brand &&
            product.brand.toLowerCase().includes(searchTerm.toLowerCase())),
      );
      const allProductIds = filteredProducts.map((product) => product.id);
      setSelectedItems((prev) => {
        const newSelection = [...prev];
        allProductIds.forEach((id) => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedItems([]);
  };

  // Get discounted products with pagination
  const getDiscountedProducts = () => {
    const discountedProducts = products.filter((p) => p.hasDiscount);
    const startIndex = (discountsPage - 1) * discountsPerPage;
    const endIndex = startIndex + discountsPerPage;
    return discountedProducts.slice(startIndex, endIndex);
  };

  const totalDiscountedProducts = products.filter((p) => p.hasDiscount).length;
  const totalDiscountPages = Math.ceil(
    totalDiscountedProducts / discountsPerPage,
  );

  // Remove all discounts
  // Check and remove expired discounts
  const checkExpiredDiscounts = async () => {
    try {
      const now = new Date();
      const expiredProducts = products.filter(
        (p) =>
          p.hasDiscount &&
          p.discountExpiresAt &&
          new Date(p.discountExpiresAt.seconds * 1000) < now,
      );

      if (expiredProducts.length > 0) {
        const batch = writeBatch(db);

        expiredProducts.forEach((product) => {
          const productRef = doc(db, "products", product.id);
          if (product.hasVariants) {
            // Restore original variant prices
            const restoredVariants = product.variants.map((variant) => ({
              ...variant,
              price: variant.originalPrice || variant.price,
              originalPrice: null,
            }));

            batch.update(productRef, {
              variants: restoredVariants,
              hasDiscount: false,
              discountType: null,
              discountValue: null,
              discountName: null,
              discountAppliedAt: null,
              discountExpiresAt: null,
            });
          } else {
            batch.update(productRef, {
              price: product.originalPrice,
              hasDiscount: false,
              discountType: null,
              discountValue: null,
              discountName: null,
              discountAppliedAt: null,
              discountExpiresAt: null,
              originalPrice: null,
            });
          }
        });

        await batch.commit();
        CacheManager.remove(CACHE_KEYS.PRODUCTS);
        // Don't call fetchData() here to avoid infinite loops
        // Update local state by removing expired discounts
        const updatedProducts = products.map((product) => {
          const isExpired = expiredProducts.find((p) => p.id === product.id);
          if (isExpired) {
            if (product.hasVariants) {
              // Restore original variant prices
              const restoredVariants = product.variants.map((variant) => ({
                ...variant,
                price: variant.originalPrice || variant.price,
                originalPrice: null,
              }));
              return {
                ...product,
                variants: restoredVariants,
                hasDiscount: false,
                discountType: null,
                discountValue: null,
                discountName: null,
                discountAppliedAt: null,
                discountExpiresAt: null,
              };
            } else {
              return {
                ...product,
                price: product.originalPrice,
                hasDiscount: false,
                discountType: null,
                discountValue: null,
                discountName: null,
                discountAppliedAt: null,
                discountExpiresAt: null,
                originalPrice: null,
              };
            }
          }
          return product;
        });
        setProducts(updatedProducts);

        if (expiredProducts.length === 1) {
        } else {
        }
      }
    } catch (error) {}
  };

  // Check expired discounts on component mount
  useEffect(() => {
    checkExpiredDiscounts();
  }, []);

  const removeAllDiscounts = async () => {
    if (
      !window.confirm(
        `هل أنت متأكد من إزالة جميع الخصومات؟ (${totalDiscountedProducts} منتج)`,
      )
    ) {
      return;
    }

    setUpdating(true);
    try {
      const batch = writeBatch(db);
      const discountedProducts = products.filter((p) => p.hasDiscount);

      discountedProducts.forEach((product) => {
        const productRef = doc(db, "products", product.id);
        if (product.hasVariants) {
          // Restore original variant prices
          const restoredVariants = product.variants.map((variant) => ({
            ...variant,
            price: variant.originalPrice || variant.price,
            originalPrice: null,
          }));

          batch.update(productRef, {
            variants: restoredVariants,
            hasDiscount: false,
            discountType: null,
            discountValue: null,
            discountName: null,
            discountAppliedAt: null,
            discountExpiresAt: null,
          });
        } else {
          batch.update(productRef, {
            price: product.originalPrice,
            hasDiscount: false,
            discountType: null,
            discountValue: null,
            discountName: null,
            discountAppliedAt: null,
            discountExpiresAt: null,
            originalPrice: null,
          });
        }
      });

      await batch.commit();

      // Invalidate products cache
      CacheManager.remove(CACHE_KEYS.PRODUCTS);

      // Don't call fetchData() here to avoid potential loops
      // Update local state by removing all discounts
      const updatedProducts = products.map((product) => {
        if (product.hasDiscount) {
          if (product.hasVariants) {
            // Restore original variant prices
            const restoredVariants = product.variants.map((variant) => ({
              ...variant,
              price: variant.originalPrice || variant.price,
              originalPrice: null,
            }));
            return {
              ...product,
              variants: restoredVariants,
              hasDiscount: false,
              discountType: null,
              discountValue: null,
              discountName: null,
              discountAppliedAt: null,
              discountExpiresAt: null,
            };
          } else {
            return {
              ...product,
              price: product.originalPrice,
              hasDiscount: false,
              discountType: null,
              discountValue: null,
              discountName: null,
              discountAppliedAt: null,
              discountExpiresAt: null,
              originalPrice: null,
            };
          }
        }
        return product;
      });
      setProducts(updatedProducts);
      setDiscountsPage(1);
      alert(`تم إزالة ${discountedProducts.length} خصم بنجاح`);
    } catch (error) {
      alert("حدث خطأ في إزالة الخصومات");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="dm-container">
          <div className="dm-loading">جاري تحميل البيانات...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="dm-container">
        <div className="dm-header">
          <h1 className="dm-title">إدارة الخصومات</h1>
        </div>

        {/* Discount Creation Form */}
        <div className="dm-form-section">
          <h2>إضافة خصم جديد</h2>

          <div className="dm-form-row">
            <div className="dm-form-group">
              <label>نوع الخصم:</label>
              <select
                value={discountType}
                onChange={(e) => handleDiscountTypeChange(e.target.value)}
              >
                <option value="product">منتجات محددة</option>
                <option value="category">فئة كاملة</option>
                <option value="brand">ماركة كاملة</option>
              </select>
            </div>

            <div className="dm-form-group">
              <label>طريقة الخصم:</label>
              <select
                value={discountMethod}
                onChange={(e) => setDiscountMethod(e.target.value)}
              >
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت (شيكل)</option>
              </select>
            </div>
          </div>

          <div className="dm-form-row">
            <div className="dm-form-group">
              <label>قيمة الخصم:</label>
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={
                  discountMethod === "percentage" ? "مثال: 25" : "مثال: 50"
                }
                min="0"
                max={discountMethod === "percentage" ? "99" : undefined}
              />
            </div>

            <div className="dm-form-group">
              <label>اسم الخصم:</label>
              <input
                type="text"
                value={discountName}
                onChange={(e) => setDiscountName(e.target.value)}
                placeholder="مثال: خصم الجمعة البيضاء"
                maxLength={50}
              />
            </div>

            <div className="dm-form-group">
              <label>تاريخ انتهاء الخصم:</label>
              <input
                type="datetime-local"
                value={discountExpiry}
                onChange={(e) => setDiscountExpiry(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                placeholder="اختر تاريخ انتهاء الخصم"
              />
              <small className="dm-expiry-note">
                اتركه فارغاً إذا كنت تريد خصماً دائماً
              </small>
            </div>
          </div>

          {/* Item Selection */}
          <div className="dm-selection-section">
            <label>اختر العناصر للخصم:</label>

            {/* Search and controls for products */}
            {discountType === "product" && (
              <div className="dm-search-controls">
                <div className="dm-search-group">
                  <input
                    type="text"
                    placeholder="البحث بالاسم، الفئة، أو الماركة..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="dm-search-input"
                  />
                  <span className="dm-results-count">
                    {getFilteredProductsCount()} منتج
                  </span>
                </div>

                {totalPages > 1 && (
                  <div className="dm-pagination">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className="dm-page-btn"
                    >
                      السابق
                    </button>
                    <span className="dm-page-info">
                      صفحة {currentPage} من {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="dm-page-btn"
                    >
                      التالي
                    </button>
                  </div>
                )}

                <div className="dm-selection-controls">
                  <button
                    type="button"
                    onClick={selectAllCurrentPage}
                    className="dm-select-btn dm-select-all"
                  >
                    اختيار الكل في هذه الصفحة
                  </button>
                  <button
                    type="button"
                    onClick={selectAllProducts}
                    className="dm-select-btn dm-select-all-global"
                  >
                    اختيار جميع المنتجات ({getFilteredProductsCount()})
                  </button>
                  <button
                    type="button"
                    onClick={clearCurrentPageSelection}
                    className="dm-select-btn dm-clear-selection"
                  >
                    إلغاء الاختيار من هذه الصفحة
                  </button>
                  <button
                    type="button"
                    onClick={clearAllSelections}
                    className="dm-select-btn dm-clear-all"
                  >
                    إلغاء جميع الاختيارات
                  </button>
                  {selectedItems.length > 0 && (
                    <span className="dm-selected-count">
                      تم اختيار {selectedItems.length} عنصر
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="dm-items-grid">
              {getAvailableItems().map((item) => (
                <div
                  key={item.id}
                  className={`dm-item-card ${
                    selectedItems.includes(item.id) ? "selected" : ""
                  }`}
                  onClick={() => handleItemSelection(item.id)}
                >
                  {/* Product Image */}
                  <div className="dm-item-image">
                    {item.images && item.images.length > 0 ? (
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="dm-product-thumbnail"
                        loading="lazy"
                      />
                    ) : (
                      <div className="dm-no-image">
                        <span className="dm-no-image-icon">
                          <i className="fas fa-camera"></i>
                        </span>
                        <span className="dm-no-image-text">لا توجد صورة</span>
                      </div>
                    )}
                  </div>

                  <div className="dm-item-info">
                    <h4>{item.name}</h4>
                    {discountType === "product" && (
                      <>
                        <p className="dm-price-display">
                          {item.hasVariants
                            ? (() => {
                                const prices = item.variants?.map(
                                  (v) => parseFloat(v.price) || 0,
                                ) || [0];
                                const minPrice = Math.min(...prices);
                                const maxPrice = Math.max(...prices);

                                // If all prices are the same, show single price
                                if (minPrice === maxPrice) {
                                  return `السعر: ${minPrice} شيكل`;
                                }

                                // If prices are different, show range
                                return `السعر: من ${minPrice} إلى ${maxPrice} شيكل`;
                              })()
                            : `السعر: ${item.price} شيكل`}
                        </p>
                        {item.hasDiscount && (
                          <span className="dm-current-discount">
                            خصم حالي: {item.discountName}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {selectedItems.includes(item.id) && (
                    <span className="dm-selected-check">
                      <i className="fas fa-check"></i>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            className="dm-apply-btn"
            onClick={applyDiscount}
            disabled={updating || selectedItems.length === 0}
          >
            {updating ? "جاري التطبيق..." : "تطبيق الخصم"}
          </button>
        </div>

        {/* Current Discounts */}
        <div className="dm-current-section">
          <div className="dm-section-header">
            <h2>الخصومات الحالية ({totalDiscountedProducts})</h2>
            <div className="dm-section-actions">
              {totalDiscountedProducts > 0 && (
                <>
                  <button
                    className="dm-refresh-discounts-btn"
                    onClick={recalculateProductDiscounts}
                    disabled={updating}
                    title="إعادة حساب الخصومات"
                  >
                    <i className="fas fa-sync-alt"></i> تحديث الخصومات
                  </button>
                  <button
                    className="dm-remove-all-btn"
                    onClick={removeAllDiscounts}
                    disabled={updating}
                  >
                    إزالة جميع الخصومات
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="dm-discounts-list">
            {getDiscountedProducts().map((product) => (
              <div key={product.id} className="dm-discount-item">
                {editingDiscount?.id === product.id ? (
                  // Edit Discount Form
                  <div className="dm-edit-discount-form">
                    <div className="dm-edit-form-header">
                      <h4>تعديل الخصم: {product.name}</h4>
                    </div>

                    <div className="dm-edit-form-row">
                      <div className="dm-edit-form-group">
                        <label>قيمة الخصم:</label>
                        <input
                          type="number"
                          value={editDiscountValue}
                          onChange={(e) => setEditDiscountValue(e.target.value)}
                          placeholder={
                            editingDiscount.discountType === "percentage"
                              ? "مثال: 25"
                              : "مثال: 50"
                          }
                          min="0"
                          max={
                            editingDiscount.discountType === "percentage"
                              ? "99"
                              : undefined
                          }
                        />
                      </div>

                      <div className="dm-edit-form-group">
                        <label>اسم الخصم:</label>
                        <input
                          type="text"
                          value={editDiscountName}
                          onChange={(e) => setEditDiscountName(e.target.value)}
                          placeholder="مثال: خصم الجمعة البيضاء"
                          maxLength={50}
                        />
                      </div>

                      <div className="dm-edit-form-group">
                        <label>تاريخ انتهاء الخصم:</label>
                        <input
                          type="datetime-local"
                          value={editDiscountExpiry}
                          onChange={(e) =>
                            setEditDiscountExpiry(e.target.value)
                          }
                          min={new Date().toISOString().slice(0, 16)}
                          placeholder="اختر تاريخ انتهاء الخصم"
                        />
                        <small className="dm-expiry-note">
                          اتركه فارغاً إذا كنت تريد خصماً دائماً
                        </small>
                      </div>
                    </div>

                    <div className="dm-edit-form-actions">
                      <button
                        className="dm-save-edit-btn"
                        onClick={() => editDiscount(product.id)}
                        disabled={updating}
                      >
                        {updating ? "جاري الحفظ..." : "حفظ التعديلات"}
                      </button>
                      <button
                        className="dm-cancel-edit-btn"
                        onClick={cancelEditingDiscount}
                        disabled={updating}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  // Normal Discount Display
                  <>
                    {/* Product Image */}
                    <div className="dm-discount-image">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="dm-discount-thumbnail"
                          loading="lazy"
                        />
                      ) : (
                        <div className="dm-discount-no-image">
                          <span className="dm-discount-no-image-icon">
                            <i className="fas fa-camera"></i>
                          </span>
                          <span className="dm-discount-no-image-text">
                            لا توجد صورة
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="dm-discount-info">
                      <h4>{product.name}</h4>
                      <p>
                        السعر الأصلي:{" "}
                        <span className="dm-original-price">
                          {product.hasVariants
                            ? (() => {
                                const prices = product.variants?.map(
                                  (v) =>
                                    parseFloat(v.originalPrice || v.price) || 0,
                                ) || [0];
                                const minPrice = Math.min(...prices);
                                const maxPrice = Math.max(...prices);

                                // If all prices are the same, show single price
                                if (minPrice === maxPrice) {
                                  return `${minPrice} شيكل`;
                                }

                                // If prices are different, show range
                                return `من ${minPrice} إلى ${maxPrice} شيكل`;
                              })()
                            : `${product.originalPrice} شيكل`}
                        </span>
                      </p>
                      <p>
                        السعر بعد الخصم:{" "}
                        <span className="dm-discounted-price">
                          {product.hasVariants
                            ? (() => {
                                const prices = product.variants?.map(
                                  (v) => parseFloat(v.price) || 0,
                                ) || [0];
                                const minPrice = Math.min(...prices);
                                const maxPrice = Math.max(...prices);

                                // If all prices are the same, show single price
                                if (minPrice === maxPrice) {
                                  return `${minPrice} شيكل`;
                                }

                                // If prices are different, show range
                                return `من ${minPrice} إلى ${maxPrice} شيكل`;
                              })()
                            : `${product.price} شيكل`}
                        </span>
                      </p>
                      <p>اسم الخصم: {product.discountName}</p>
                      <p>
                        قيمة الخصم: {product.discountValue}
                        {product.discountType === "percentage" ? "%" : " شيكل"}
                      </p>
                      {product.discountExpiresAt && (
                        <p>
                          ينتهي في:{" "}
                          <span className="dm-expiry-time">
                            {new Date(
                              product.discountExpiresAt.seconds * 1000,
                            ).toLocaleString("en-US")}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="dm-discount-actions">
                      <button
                        className="dm-edit-btn"
                        onClick={() => startEditingDiscount(product)}
                        disabled={updating}
                      >
                        تعديل
                      </button>
                      <button
                        className="dm-remove-btn"
                        onClick={() => removeDiscount(product.id)}
                        disabled={updating}
                      >
                        إزالة الخصم
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {totalDiscountedProducts === 0 && (
              <div className="dm-no-discounts">لا توجد خصومات حالية</div>
            )}
          </div>

          {/* Discounts Pagination */}
          {totalDiscountPages > 1 && (
            <div className="dm-pagination">
              <button
                onClick={() =>
                  setDiscountsPage((prev) => Math.max(1, prev - 1))
                }
                disabled={discountsPage === 1}
                className="dm-page-btn"
              >
                السابق
              </button>
              <span className="dm-page-info">
                صفحة {discountsPage} من {totalDiscountPages}
              </span>
              <button
                onClick={() =>
                  setDiscountsPage((prev) =>
                    Math.min(totalDiscountPages, prev + 1),
                  )
                }
                disabled={discountsPage === totalDiscountPages}
                className="dm-page-btn"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default DiscountManager;
