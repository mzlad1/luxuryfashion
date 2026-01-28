import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useCart } from "../contexts/CartContext";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProductFeedback from "../components/ProductFeedback";
import ProductCard from "../components/ProductCard";
import "../css/ProductDetail.css";

// Countdown Timer Component
const CountdownTimer = ({ expiryDate }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!expiryDate) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(expiryDate.seconds * 1000);
      const difference = expiry - now;

      if (difference <= 0) {
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiryDate]);

  if (!timeLeft) return null;

  return (
    <div className="pd-timer-display">
      {timeLeft.days > 0 && (
        <span className="pd-timer-unit">
          <span className="pd-timer-value">{timeLeft.days}</span>
          <span className="pd-timer-label-small">يوم</span>
        </span>
      )}
      <span className="pd-timer-unit">
        <span className="pd-timer-value">
          {timeLeft.hours.toString().padStart(2, "0")}
        </span>
        <span className="pd-timer-label-small">ساعة</span>
      </span>
      <span className="pd-timer-unit">
        <span className="pd-timer-value">
          {timeLeft.minutes.toString().padStart(2, "0")}
        </span>
        <span className="pd-timer-label-small">دقيقة</span>
      </span>
      <span className="pd-timer-unit">
        <span className="pd-timer-value">
          {timeLeft.seconds.toString().padStart(2, "0")}
        </span>
        <span className="pd-timer-label-small">ثانية</span>
      </span>
    </div>
  );
};

// صفحة تفاصيل المنتج
function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [mainImage, setMainImage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [error, setError] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [activeTab, setActiveTab] = useState("description");
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const { addToCart, cartItems, getProductTotalQuantity } = useCart();

  // Toast message function
  const showToastMessage = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);

    // Auto-hide toast after 4 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  // Check if user is admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
    });
    return () => unsubscribe();
  }, []);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const snapshot = await getDocs(collection(db, "categories"));
        const categoriesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCategories(categoriesData);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // Auto-select variant when both size and color are selected
  useEffect(() => {
    if (selectedSize && selectedColor) {
      const variant = getVariantInfo(selectedSize, selectedColor);
      if (variant) {
        setSelectedVariant(variant);
      }
    }
  }, [selectedSize, selectedColor]);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      setError("");
      try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setProduct(data);
          setMainImage(
            data.images && data.images.length > 0 ? data.images[0] : "",
          );

          // Auto-select first available size and color
          if (data.hasVariants) {
            if (data.sizes && data.sizes.length > 0) {
              // Find first available size that has stock
              for (const size of data.sizes) {
                let hasStock = false;

                if (data.colors && data.colors.length > 0) {
                  // Product has both sizes and colors
                  for (const color of data.colors) {
                    const variant = data.variants.find(
                      (v) =>
                        v.size === size &&
                        v.color === color &&
                        parseInt(v.stock) > 0,
                    );
                    if (variant) {
                      setSelectedSize(size);
                      setSelectedColor(color);
                      setSelectedVariant(variant);
                      hasStock = true;
                      break;
                    }
                  }
                } else {
                  // Product has only sizes
                  const variant = data.variants.find(
                    (v) => v.size === size && !v.color && parseInt(v.stock) > 0,
                  );
                  if (variant) {
                    setSelectedSize(size);
                    setSelectedVariant(variant);
                    hasStock = true;
                  }
                }

                if (hasStock) break;
              }
            } else if (data.colors && data.colors.length > 0) {
              // Product has only colors
              for (const color of data.colors) {
                const variant = data.variants.find(
                  (v) => v.color === color && !v.size && parseInt(v.stock) > 0,
                );
                if (variant) {
                  setSelectedColor(color);
                  setSelectedVariant(variant);
                  break;
                }
              }
            }
          }
        } else {
          setError("المنتج غير موجود");
        }
      } catch (error) {
        setError("حدث خطأ في تحميل المنتج");
        // بيانات تجريبية في حال عدم القدرة على جلب البيانات
        const fallback = {
          id: "0",
          name: "كريم مرطب للوجه الفاخر",
          price: 120,
          brand: "Zara Beauty",
          description:
            "كريم مرطب فاخر للوجه مُعزز بالفيتامينات والزيوت الطبيعية. يوفر ترطيباً عميقاً ونعومة فائقة للبشرة مع حماية من العوامل البيئية. مناسب لجميع أنواع البشرة.",
          images: [
            "/images/sample1.jpg",
            "/images/sample2.jpg",
            "/images/sample3.jpg",
          ],
          categories: ["الوجه", "العناية اليومية"],
          stock: 15,
          features: [
            "100% طبيعي",
            "مناسب لجميع أنواع البشرة",
            "خالي من البارابين",
          ],
          ingredients: [
            "زيت الأرغان",
            "فيتامين E",
            "حمض الهيالورونيك",
            "الصبار",
          ],
        };
        setProduct(fallback);
        setMainImage(fallback.images[0]);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  // Fetch similar products based on category and brand
  useEffect(() => {
    async function fetchSimilarProducts() {
      if (!product) return;

      setLoadingSimilar(true);
      try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        const allProducts = [];
        productsSnapshot.forEach((doc) => {
          if (doc.id !== product.id) {
            allProducts.push({ id: doc.id, ...doc.data() });
          }
        });

        // Score products based on similarity
        const scoredProducts = allProducts.map((p) => {
          let score = 0;

          // Same brand = +3 points
          if (p.brand && product.brand && p.brand === product.brand) {
            score += 3;
          }

          // Same category (new format - categoryIds) = +2 points per matching category
          if (
            product.categoryIds &&
            product.categoryIds.length > 0 &&
            p.categoryIds
          ) {
            const matchingCategories = product.categoryIds.filter((catId) =>
              p.categoryIds.includes(catId),
            );
            score += matchingCategories.length * 2;
          }

          // Same category (old format - categories) = +2 points per matching category
          if (
            product.categories &&
            product.categories.length > 0 &&
            p.categories
          ) {
            const matchingCategories = product.categories.filter((cat) =>
              p.categories.includes(cat),
            );
            score += matchingCategories.length * 2;
          }

          // Similar price range (+/- 30%) = +1 point
          const priceDiff = Math.abs(p.price - product.price) / product.price;
          if (priceDiff <= 0.3) {
            score += 1;
          }

          return { ...p, similarityScore: score };
        });

        // Filter products with at least some similarity and sort by score
        const similar = scoredProducts
          .filter((p) => p.similarityScore > 0)
          .sort((a, b) => b.similarityScore - a.similarityScore)
          .slice(0, 4); // Get top 4 similar products

        // If we don't have enough similar products, add some random ones
        if (similar.length < 4) {
          const remaining = allProducts
            .filter((p) => !similar.find((s) => s.id === p.id))
            .sort(() => Math.random() - 0.5)
            .slice(0, 4 - similar.length);
          similar.push(...remaining);
        }

        setSimilarProducts(similar);
      } catch (error) {
        console.error("Error fetching similar products:", error);
        setSimilarProducts([]);
      } finally {
        setLoadingSimilar(false);
      }
    }

    fetchSimilarProducts();
  }, [product]);

  const handleAddToCart = async () => {
    if (!product || isAdmin) return;

    // Check if variant is selected for variant products
    if (product.hasVariants && !selectedVariant) {
      showToastMessage("يرجى اختيار الحجم واللون أولاً", "error");
      return;
    }

    let availableStock;
    if (product.hasVariants) {
      availableStock = parseInt(selectedVariant.stock) || 0;
    } else {
      if (product.stock <= 0) return;
      const currentInCart = getProductTotalQuantity(product.id);
      availableStock = Math.max(0, (product.stock || 0) - currentInCart);
    }

    const qtyToAdd = Math.min(quantity, availableStock);

    if (qtyToAdd <= 0) {
      showToastMessage(
        "لا يمكن إضافة المزيد - تم الوصول للحد الأقصى المتاح",
        "error",
      );
      return;
    }

    setAddingToCart(true);
    try {
      // Add product to cart with selected quantity and variant info
      const productToAdd = {
        ...product,
        selectedVariant: product.hasVariants ? selectedVariant : null,
        variantId: product.hasVariants
          ? selectedVariant.size && selectedVariant.color
            ? `${selectedVariant.size}-${selectedVariant.color}`
            : selectedVariant.size
              ? selectedVariant.size
              : selectedVariant.color
          : null,
      };

      for (let i = 0; i < qtyToAdd; i++) {
        addToCart(productToAdd);
      }

      // Show success toast
      const variantInfo = product.hasVariants
        ? ` (${selectedVariant.size ? selectedVariant.size : ""}${
            selectedVariant.size && selectedVariant.color ? " - " : ""
          }${selectedVariant.color ? selectedVariant.color : ""})`
        : "";
      showToastMessage(
        `تم إضافة ${qtyToAdd} قطع${
          qtyToAdd > 1 ? "ات" : "ة"
        } إلى السلة${variantInfo}`,
        "success",
      );

      // Reset quantity to 1 after adding
      setQuantity(1);
    } catch (error) {
      showToastMessage("حدث خطأ أثناء إضافة المنتج إلى السلة", "error");
    } finally {
      setAddingToCart(false);
    }
  };

  // Helper to validate and parse stock
  const parseStock = (s) => {
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };

  // Helper to get available sizes for a selected color
  const getAvailableSizesForColor = (color) => {
    if (!product?.variants) return [];
    return product.variants
      .filter((v) => v.color === color && (parseInt(v.stock) || 0) > 0)
      .map((v) => v.size);
  };

  // Helper to get available colors for a selected size
  const getAvailableColorsForSize = (size) => {
    if (!product?.variants) return [];
    return product.variants
      .filter((v) => v.size === size && (parseInt(v.stock) || 0) > 0)
      .map((v) => v.color);
  };

  // Helper to get variant info for size/color combination
  const getVariantInfo = (size, color) => {
    if (!product?.variants) return null;

    // Handle different variant types
    if (size && color) {
      // Both size and color
      const variant = product.variants.find(
        (v) =>
          v.size === size && v.color === color && (parseInt(v.stock) || 0) > 0,
      );
      return variant || null;
    } else if (size && !color) {
      // Only size
      return product.variants.find(
        (v) => v.size === size && !v.color && (parseInt(v.stock) || 0) > 0,
      );
    } else if (!size && color) {
      // Only color
      return product.variants.find(
        (v) => !v.size && v.color === color && (parseInt(v.stock) || 0) > 0,
      );
    }

    return null;
  };

  // Helper to check if a variant is available
  const isVariantAvailable = (size, color) => {
    const variant = getVariantInfo(size, color);
    return variant && (parseInt(variant.stock) || 0) > 0;
  };

  // Handle size selection
  const handleSizeSelect = (size) => {
    // Don't do anything if clicking the same size
    if (size === selectedSize) {
      return;
    }

    setSelectedSize(size);
    setQuantity(1); // Reset quantity

    // Check if this is a size-only product
    if (product.colors && product.colors.length > 0) {
      // Product has colors, find first available color for this size
      const firstAvailableColor = product.colors.find((color) => {
        const variant = product.variants?.find(
          (v) =>
            v.size === size &&
            v.color === color &&
            (parseInt(v.stock) || 0) > 0,
        );
        return !!variant;
      });

      if (firstAvailableColor) {
        setSelectedColor(firstAvailableColor);
        const variant = getVariantInfo(size, firstAvailableColor);
        if (variant) {
          setSelectedVariant(variant);
          showToastMessage(
            `تم اختيار ${size} - ${firstAvailableColor}`,
            "success",
          );
        }
      } else {
        setSelectedColor(null);
        setSelectedVariant(null);
        showToastMessage(`تم اختيار الحجم: ${size}`, "success");
      }
    } else {
      // Product has only sizes
      const variant = getVariantInfo(size, null);
      if (variant) {
        setSelectedVariant(variant);
        showToastMessage(`تم اختيار الحجم: ${size}`, "success");
      }
    }
  };

  // Handle color selection
  const handleColorSelect = (color) => {
    // Don't do anything if clicking the same color
    if (color === selectedColor) {
      return;
    }

    // Check if this combination is valid (has stock)
    const variant = selectedSize
      ? product.variants.find(
          (v) =>
            v.size === selectedSize &&
            v.color === color &&
            (parseInt(v.stock) || 0) > 0,
        )
      : product.variants.find(
          (v) => !v.size && v.color === color && (parseInt(v.stock) || 0) > 0,
        );

    if (!variant) {
      // This combination is not available or has no stock
      return;
    }

    setSelectedColor(color);
    setSelectedVariant(variant);
    setQuantity(1); // Reset quantity

    // Show appropriate toast message
    if (product.sizes && product.sizes.length === 0) {
      // Product has only colors
      showToastMessage(`تم اختيار اللون: ${color}`, "success");
    } else if (selectedSize) {
      // Both size and color are selected
      showToastMessage(`تم اختيار ${selectedSize} - ${color}`, "success");
    } else {
      showToastMessage(`تم اختيار اللون: ${color}`, "success");
    }
  };

  const getStockStatus = () => {
    if (!product) return null;

    if (product.hasVariants) {
      // Handle variants stock
      const totalStock =
        product.variants?.reduce(
          (sum, v) => sum + (parseInt(v.stock) || 0),
          0,
        ) || 0;
      const currentInCart = getProductTotalQuantity(product.id);
      const availableStock = Math.max(0, totalStock - currentInCart);

      if (totalStock <= 0) {
        return {
          text: "غير متوفر",
          class: "pd-out-of-stock",
          icon: <i className="fas fa-times-circle"></i>,
        };
      } else if (availableStock <= 0) {
        return {
          text: "تم إضافة الكمية المتاحة للسلة",
          class: "pd-low-stock",
          icon: <i className="fas fa-shopping-cart"></i>,
        };
      } else if (totalStock <= 5) {
        return {
          text: `متبقي ${availableStock} قطع متاحة للإضافة`,
          class: "pd-low-stock",
          icon: <i className="fas fa-exclamation-triangle"></i>,
        };
      } else {
        return {
          text: `متوفر (${availableStock} متاح للإضافة)`,
          class: "pd-in-stock",
          icon: <i className="fas fa-check-circle"></i>,
        };
      }
    } else {
      // Handle regular product stock
      const stock = parseStock(product.stock);
      const currentInCart =
        cartItems.find((i) => i.id === product.id)?.quantity || 0;
      const availableStock = Math.max(0, stock - currentInCart);

      if (stock <= 0) {
        return {
          text: "غير متوفر",
          class: "pd-out-of-stock",
          icon: <i className="fas fa-times-circle"></i>,
        };
      } else if (availableStock <= 0) {
        return {
          text: "تم إضافة الكمية المتاحة للسلة",
          class: "pd-low-stock",
          icon: <i className="fas fa-shopping-cart"></i>,
        };
      } else if (stock <= 5) {
        return {
          text: `متبقي ${availableStock} قطع متاحة للإضافة`,
          class: "pd-low-stock",
          icon: <i className="fas fa-exclamation-triangle"></i>,
        };
      } else {
        return {
          text: `متوفر (${availableStock} متاح للإضافة)`,
          class: "pd-in-stock",
          icon: <i className="fas fa-check-circle"></i>,
        };
      }
    }
  };

  const handleQuantityChange = (newQuantity) => {
    if (!product) return;

    let maxAddable;
    if (product.hasVariants && selectedVariant) {
      // For variants, use the selected variant's stock
      maxAddable = parseInt(selectedVariant.stock) || 0;
    } else if (product.hasVariants) {
      // No variant selected
      maxAddable = 0;
    } else {
      // Regular product
      const stock = parseStock(product.stock);
      const currentInCart = getProductTotalQuantity(product.id);
      maxAddable = Math.max(0, stock - currentInCart);
    }

    if (maxAddable === 0) {
      setQuantity(0);
      return;
    }

    if (newQuantity < 1) {
      setQuantity(1);
      return;
    }

    setQuantity(Math.min(newQuantity, maxAddable));
  };

  const increaseQuantity = () => {
    let maxAddable;
    if (product.hasVariants && selectedVariant) {
      // For variants, use the selected variant's stock
      maxAddable = parseInt(selectedVariant.stock) || 0;
    } else if (product.hasVariants) {
      // No variant selected
      maxAddable = 0;
    } else {
      // Regular product
      const stock = parseStock(product.stock);
      const currentInCart = getProductTotalQuantity(product.id);
      maxAddable = Math.max(0, stock - currentInCart);
    }

    if (quantity < maxAddable) {
      setQuantity(quantity + 1);
    }
  };
  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleImageClick = (image) => {
    setMainImage(image);
  };

  const handleBackClick = () => {
    navigate("/products");
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="product-detail-page">
          <div className="pd-loading-container">
            <div className="pd-loading-spinner"></div>
            <p>جاري تحميل المنتج...</p>
          </div>
        </div>
      </>
    );
  }

  if (error && !product) {
    return (
      <>
        <Navbar />
        <div className="product-detail-page">
          <div className="error-container">
            <div className="error-icon">
              <i className="fas fa-frown"></i>
            </div>
            <h2>عذراً، حدث خطأ</h2>
            <p>{error}</p>
            <button onClick={handleBackClick} className="back-button">
              العودة للمنتجات
            </button>
          </div>
        </div>
      </>
    );
  }

  const stockStatus = getStockStatus();
  const currentInCart = getProductTotalQuantity(product?.id);

  let maxAddable;
  let stock;
  if (product?.hasVariants) {
    const totalStock =
      product.variants?.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0) ||
      0;
    maxAddable = Math.max(0, totalStock - currentInCart);
    stock = totalStock;
  } else {
    stock = parseStock(product?.stock);
    maxAddable = Math.max(0, stock - currentInCart);
  }

  return (
    <>
      <Navbar />
      <div className="product-detail-page">
        <div className="pd-container">
          {/* Breadcrumb Navigation */}
          <nav className="pd-breadcrumb">
            <button
              onClick={() => navigate("/")}
              className="pd-breadcrumb-link"
            >
              الرئيسية
            </button>
            <span className="pd-breadcrumb-sep">›</span>
            <button
              onClick={() => navigate("/products")}
              className="pd-breadcrumb-link"
            >
              المنتجات
            </button>
            <span className="pd-breadcrumb-sep">›</span>
            <span className="pd-breadcrumb-current">{product.name}</span>
          </nav>

          {error && (
            <div className="pd-error" role="alert">
              <span className="pd-error-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Toast Notification */}
          {showToast && (
            <div className={`pd-toast pd-toast--${toastType}`} role="alert">
              <div className="pd-toast-content">
                <span className={`pd-toast-icon pd-toast-icon--${toastType}`}>
                  {toastType === "success" ? (
                    <i className="fas fa-check-circle"></i>
                  ) : (
                    <i className="fas fa-exclamation-triangle"></i>
                  )}
                </span>
                <span className="pd-toast-message">{toastMessage}</span>
                <button
                  className="pd-toast-close"
                  onClick={() => setShowToast(false)}
                  aria-label="إغلاق الإشعار"
                >
                  ×
                </button>
              </div>
              <div className="pd-toast-progress"></div>
            </div>
          )}

          <div className="pd-content">
            {/* Product Images */}
            <div className="pd-images">
              <div className="pd-main-image-wrap">
                {mainImage && (
                  <>
                    <img
                      src={mainImage}
                      alt={product.name}
                      className="pd-main-image"
                      loading="lazy"
                      onClick={() => setShowImageModal(true)}
                    />
                    <button
                      className="pd-zoom-btn"
                      onClick={() => setShowImageModal(true)}
                      aria-label="تكبير الصورة"
                    >
                      <i className="fas fa-search-plus"></i>
                    </button>
                  </>
                )}
              </div>

              {product.images && product.images.length > 1 && (
                <div className="pd-thumbs">
                  {product.images.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`${product.name} ${index + 1}`}
                      className={`pd-thumb ${
                        mainImage === img ? "active" : ""
                      }`}
                      loading="lazy"
                      onClick={() => handleImageClick(img)}
                      onError={(e) => {
                        e.target.src = "/images/placeholder.jpg";
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Product Information */}
            <div className="pd-info">
              <div className="pd-header">
                <h1 className="pd-title">{product.name}</h1>
                {product.brand && (
                  <div className="pd-brand">
                    <span className="pd-brand-label">العلامة التجارية:</span>
                    <span className="pd-brand-name">{product.brand}</span>
                  </div>
                )}
                <div className="pd-price">
                  <span className="pd-price-label">السعر:</span>
                  {product.hasVariants ? (
                    <div className="pd-variants-pricing">
                      {selectedVariant ? (
                        <span className="pd-price-value pd-price-variants">
                          {selectedVariant.price} شيكل
                        </span>
                      ) : (
                        <span className="pd-price-value pd-price-variants">
                          <small>
                            {Math.min(
                              ...(product.variants?.map(
                                (v) => parseFloat(v.price) || 0,
                              ) || [0]),
                            )}{" "}
                            شيكل
                          </small>
                        </span>
                      )}
                      {/* Show selected size and color below price */}
                      {/* <div>
                        {selectedSize && (
                          <small className="pd-variant-note">
                            الحجم : {selectedSize}
                          </small>
                        )}
                        {selectedColor && (
                          <small className="pd-variant-note">
                            اللون : {selectedColor}
                          </small>
                        )}
                      </div> */}
                      <div className="pd-variants-overview"></div>
                    </div>
                  ) : product.hasDiscount && product.originalPrice ? (
                    <div className="pd-discount-price">
                      <span className="pd-price-value pd-price-discounted">
                        {product.price} شيكل
                      </span>
                      <span className="pd-original-price">
                        {product.originalPrice} شيكل
                      </span>

                      {product.discountExpiresAt && (
                        <div className="pd-countdown-timer">
                          <span className="pd-timer-label">
                            ينتهي الخصم في:
                          </span>
                          <CountdownTimer
                            expiryDate={product.discountExpiresAt}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="pd-price-value">{product.price} شيكل</span>
                  )}
                </div>
              </div>

              {/* Categories */}
              {((product.categoryIds && product.categoryIds.length > 0) ||
                (product.categories && product.categories.length > 0)) && (
                <div className="pd-categories">
                  <h4>الفئات:</h4>
                  <div className="pd-category-tags">
                    {product.categoryIds && product.categoryIds.length > 0
                      ? product.categoryIds.map((catId, index) => {
                          const category = categories.find(
                            (c) => c.id === catId,
                          );
                          return category ? (
                            <span key={index} className="pd-category-tag">
                              {category.name}
                            </span>
                          ) : null;
                        })
                      : product.categories.map((category, index) => (
                          <span key={index} className="pd-category-tag">
                            {category}
                          </span>
                        ))}
                  </div>
                </div>
              )}

              {/* Variants Selection */}
              {product.hasVariants && (
                <div className="pd-variants-selection">
                  <h4>
                    {product.sizes?.length > 1 && product.colors?.length > 1
                      ? "اختر الحجم واللون"
                      : product.sizes?.length > 1
                        ? "اختر الحجم"
                        : product.colors?.length > 1
                          ? "اختر اللون"
                          : null}
                  </h4>

                  <div className="pd-selection-options">
                    {/* Size Selection - Only show if product has sizes */}
                    {product.sizes && product.sizes.length > 0 && (
                      <div className="pd-size-selection">
                        {/* <h5>اختر الحجم:</h5> */}
                        <h5>الحجم :</h5>
                        <div className="pd-size-options">
                          {product.sizes.map((size) => {
                            let isAvailable = false;
                            let isSelected = selectedSize === size;

                            if (product.colors && product.colors.length > 0) {
                              // Product has both sizes and colors
                              // Check if this size has any color with stock > 0
                              const hasAnyColorWithStock =
                                product.variants?.some(
                                  (v) =>
                                    v.size === size &&
                                    v.color &&
                                    (parseInt(v.stock) || 0) > 0,
                                );
                              isAvailable = hasAnyColorWithStock;
                            } else {
                              // Product has only sizes
                              isAvailable = product.variants?.some(
                                (v) =>
                                  v.size === size &&
                                  !v.color &&
                                  (parseInt(v.stock) || 0) > 0,
                              );
                            }

                            return (
                              <button
                                key={size}
                                className={`pd-size-option ${
                                  isSelected ? "selected" : ""
                                } ${!isAvailable ? "unavailable" : ""}`}
                                onClick={() =>
                                  isAvailable && handleSizeSelect(size)
                                }
                                disabled={!isAvailable}
                              >
                                <span className="pd-size-name">{size}</span>
                                {isSelected && (
                                  <span className="pd-selected-icon">
                                    <i className="fas fa-check"></i>
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Color Selection - Only show if product has colors */}
                    {product.colors && product.colors.length > 0 && (
                      <div className="pd-color-selection">
                        <h5>اللون:</h5>
                        <div className="pd-color-options">
                          {(() => {
                            // Show all colors for both size+color and color-only products
                            const availableColors = product.colors;

                            return availableColors.map((color) => {
                              const isSelected = selectedColor === color;

                              const isAvailable = product.variants?.some(
                                (v) =>
                                  (!v.size ||
                                    (selectedSize &&
                                      v.size === selectedSize)) &&
                                  v.color === color &&
                                  (parseInt(v.stock) || 0) > 0,
                              );

                              // Get stock amount for this color
                              const colorStock =
                                product.variants?.find(
                                  (v) =>
                                    v.color === color &&
                                    (!v.size || v.size === selectedSize),
                                )?.stock || 0;

                              return (
                                <button
                                  key={color}
                                  className={`pd-color-option ${
                                    isSelected ? "selected" : ""
                                  } ${!isAvailable ? "unavailable" : ""}`}
                                  onClick={() =>
                                    isAvailable && handleColorSelect(color)
                                  }
                                  disabled={!isAvailable}
                                  title={
                                    !isAvailable
                                      ? "غير متوفر في المخزون"
                                      : undefined
                                  }
                                >
                                  <span className="pd-color-name">{color}</span>
                                  {isSelected && (
                                    <span className="pd-selected-icon">
                                      <i className="fas fa-check"></i>
                                    </span>
                                  )}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {/* <div className="pd-description">
                <h3>وصف المنتج</h3>
                <p>{product.description}</p>
              </div> */}

              {/* Features */}
              {product.features && (
                <div className="pd-features">
                  <h4>المميزات:</h4>
                  <ul className="pd-features-list">
                    {product.features.map((feature, index) => (
                      <li key={index} className="pd-feature-item">
                        <span className="pd-feature-icon">
                          <i className="fas fa-sparkles"></i>
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ingredients */}
              {product.ingredients && (
                <div className="pd-ingredients">
                  <h4>المكونات الرئيسية:</h4>
                  <div className="pd-ingredient-tags">
                    {product.ingredients.map((ingredient, index) => (
                      <span key={index} className="pd-ingredient-tag">
                        {ingredient}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Variant Display */}

              {/* Enhanced Quantity Selector - Only show for non-admin users */}
              {((product.hasVariants && selectedVariant) ||
                (!product.hasVariants && maxAddable > 0)) &&
                !isAdmin && (
                  <div className="pd-qty">
                    <label htmlFor="quantity" className="pd-qty-label">
                      الكمية المطلوبة:
                    </label>
                    <div className="pd-qty-controls">
                      <button
                        type="button"
                        onClick={decreaseQuantity}
                        className="pd-qty-btn decrease"
                        disabled={quantity <= 1}
                        aria-label="تقليل الكمية"
                      >
                        −
                      </button>
                      <input
                        id="quantity"
                        type="number"
                        min="1"
                        max={
                          product.hasVariants && selectedVariant
                            ? parseInt(selectedVariant.stock) || 0
                            : maxAddable
                        }
                        value={quantity}
                        onChange={(e) =>
                          handleQuantityChange(parseInt(e.target.value) || 1)
                        }
                        className="pd-qty-input"
                        aria-label="الكمية"
                      />
                      <button
                        type="button"
                        onClick={increaseQuantity}
                        className="pd-qty-btn increase"
                        disabled={quantity >= maxAddable}
                        aria-label="زيادة الكمية"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

              {/* Enhanced Add to Cart Button */}
              <div className="pd-actions">
                <button
                  className={`pd-add-btn ${
                    (product?.hasVariants && !selectedVariant) ||
                    (product?.hasVariants ? maxAddable <= 0 : stock <= 0) ||
                    maxAddable <= 0 ||
                    isAdmin
                      ? "disabled"
                      : ""
                  }`}
                  onClick={handleAddToCart}
                  disabled={
                    addingToCart ||
                    (product?.hasVariants && !selectedVariant) ||
                    (product?.hasVariants ? maxAddable <= 0 : stock <= 0) ||
                    maxAddable <= 0 ||
                    quantity <= 0 ||
                    isAdmin
                  }
                >
                  {isAdmin ? (
                    <>
                      <span>
                        <i className="fas fa-lock"></i>
                      </span>
                      أنت أدمن ولا يمكنك التسوق
                    </>
                  ) : addingToCart ? (
                    <>
                      <span className="pd-loading"></span>
                      جاري الإضافة...
                    </>
                  ) : (product?.hasVariants ? maxAddable <= 0 : stock <= 0) ? (
                    <>
                      <span>
                        <i className="fas fa-times-circle"></i>
                      </span>
                      نفدت الكمية
                    </>
                  ) : maxAddable <= 0 ? (
                    <>
                      <span>
                        <i className="fas fa-shopping-cart"></i>
                      </span>
                      تم إضافة الكمية المتاحة
                    </>
                  ) : product?.hasVariants && !selectedVariant ? (
                    <>
                      <span>
                        <i className="fas fa-exclamation-triangle"></i>
                      </span>
                      اختر الحجم واللون أولاً
                    </>
                  ) : (
                    <>
                      <span>
                        <i className="fas fa-shopping-bag"></i>
                      </span>
                      أضف {quantity > 1 ? `(${quantity})` : ""} إلى السلة
                      {product.hasVariants && selectedVariant && (
                        <span className="pd-variant-info">
                          {selectedVariant.size && `${selectedVariant.size}`}
                          {selectedVariant.size &&
                            selectedVariant.color &&
                            " - "}
                          {selectedVariant.color && `${selectedVariant.color}`}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>

              {/* Admin Notice */}
              {isAdmin && (
                <div className="pd-admin-notice">
                  <div className="pd-notice-content">
                    <span className="pd-notice-icon">
                      <i className="fas fa-info-circle"></i>
                    </span>
                    <div className="pd-notice-text">
                      <strong>ملاحظة للأدمن:</strong>
                      <p>
                        أنت مسجل دخول كأدمن. لا يمكن للأدمن إضافة منتجات إلى
                        السلة. يمكنك إدارة المنتجات من{" "}
                        <button
                          onClick={() => navigate("/admin/dashboard")}
                          className="pd-admin-link"
                        >
                          لوحة التحكم
                        </button>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tab Navigation Section */}
          <div className="pd-tabs-section">
            <div className="pd-tabs-header">
              <button
                className={`pd-tab-btn ${
                  activeTab === "description" ? "active" : ""
                }`}
                onClick={() => setActiveTab("description")}
              >
                <span className="pd-tab-icon">
                  <i className="fas fa-file-alt"></i>
                </span>
                <span className="pd-tab-label">الوصف</span>
              </button>
              {product.howToUse && (
                <button
                  className={`pd-tab-btn ${
                    activeTab === "howToUse" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("howToUse")}
                >
                  <span className="pd-tab-icon">
                    <i className="fas fa-lightbulb"></i>
                  </span>
                  <span className="pd-tab-label">طريقة الاستخدام</span>
                </button>
              )}
              <button
                className={`pd-tab-btn ${
                  activeTab === "ratings" ? "active" : ""
                }`}
                onClick={() => setActiveTab("ratings")}
              >
                <span className="pd-tab-icon">
                  <i className="fas fa-star"></i>
                </span>
                <span className="pd-tab-label">التقييمات</span>
              </button>
            </div>

            <div className="pd-tabs-content">
              {activeTab === "description" && (
                <div className="pd-tab-panel pd-tab-description">
                  <h3>وصف المنتج</h3>
                  <p>{product.description}</p>
                </div>
              )}

              {activeTab === "howToUse" && product.howToUse && (
                <div className="pd-tab-panel pd-tab-how-to-use">
                  <h3>طريقة الاستخدام</h3>
                  <div className="pd-how-to-use-content">
                    <p>{product.howToUse}</p>
                  </div>
                </div>
              )}

              {activeTab === "ratings" && (
                <div className="pd-tab-panel pd-tab-ratings">
                  <ProductFeedback productId={product.id} />
                </div>
              )}
            </div>
          </div>

          {/* Similar Products Section */}
          {similarProducts.length > 0 && (
            <section className="pd-similar-section">
              <div className="pd-similar-header">
                <h2 className="pd-similar-title">
                  <span className="pd-similar-icon">
                    <i className="fas fa-sparkles"></i>
                  </span>
                  منتجات مشابهة
                </h2>
                <p className="pd-similar-subtitle">قد يعجبك أيضاً</p>
              </div>

              <div className="pd-similar-grid">
                {similarProducts.map((similarProduct) => (
                  <div key={similarProduct.id} className="pd-similar-item">
                    <ProductCard product={similarProduct} />
                  </div>
                ))}
              </div>

              <div className="pd-similar-cta">
                <button
                  className="pd-view-all-btn"
                  onClick={() => navigate("/products")}
                >
                  <span>عرض جميع المنتجات</span>
                  <i className="fas fa-arrow-left"></i>
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Image Modal */}
        {showImageModal && (
          <div
            className="pd-image-modal"
            onClick={() => setShowImageModal(false)}
          >
            <div
              className="pd-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="pd-close-modal"
                onClick={() => setShowImageModal(false)}
                aria-label="إغلاق"
              >
                ×
              </button>
              <img
                src={mainImage}
                alt={product.name}
                className="pd-modal-image"
              />
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}

export default ProductDetail;
