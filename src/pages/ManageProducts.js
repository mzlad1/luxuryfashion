import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import "../css/ManageProducts.css";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { CacheManager, CACHE_KEYS } from "../utils/cache";
import toast from "react-hot-toast";

// صفحة إدارة المنتجات
function ManageProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    price: "",
    description: "",
    howToUse: "",
    images: [],
    categories: [],
    subcategories: [],
    brand: "",
    stock: "",
    isNew: false,
    onDemand: false,
    hasVariants: false,
    variants: [],
    sizes: [],
    colors: [],
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // Add search functionality
  const [currentPage, setCurrentPage] = useState(1); // Add pagination
  const [itemsPerPage] = useState(10); // 10 products per page
  const [stockFilter, setStockFilter] = useState(""); // Add stock filter

  // Image management state
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState(new Set());

  // Form visibility state
  const [formJustOpened, setFormJustOpened] = useState(false);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // New filter states
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [selectedBadges, setSelectedBadges] = useState([]);
  const [sortOrder, setSortOrder] = useState("newest");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Available badges for filtering
  const availableBadges = [
    { key: "new", label: "جديد", icon: <i className="fas fa-certificate"></i> },
    { key: "onDemand", label: "ع الطلب", icon: <i className="fas fa-box"></i> },
    {
      key: "hasVariants",
      label: "متعدد الأحجام",
      icon: <i className="fas fa-ruler"></i>,
    },
    {
      key: "lowStock",
      label: "مخزون قليل",
      icon: <i className="fas fa-exclamation-triangle"></i>,
    },
    {
      key: "outOfStock",
      label: "نفذ المخزون",
      icon: <i className="fas fa-times-circle"></i>,
    },
  ];

  // Stock filter options
  const stockFilterOptions = [
    { value: "", label: "كل المنتجات" },
    { value: "in-stock", label: "متوفر (أكثر من 5)" },
    { value: "low-stock", label: "مخزون قليل (1-5)" },
    { value: "out-of-stock", label: "نفدت الكمية (0)" },
  ];

  // Availability filter options
  const availabilityFilterOptions = [
    { value: "all", label: "جميع المنتجات" },
    { value: "available", label: "متوفر فوراً" },
    { value: "onDemand", label: "ع الطلب" },
  ];

  // Sort options
  const sortOptions = [
    { value: "newest", label: "الأحدث أولاً (افتراضي)" },
    { value: "", label: "بدون ترتيب" },
    { value: "name", label: "الاسم (أ-ي)" },
    { value: "brand", label: "العلامة التجارية (أ-ي)" },
    { value: "priceAsc", label: "السعر (الأقل أولاً)" },
    { value: "priceDesc", label: "السعر (الأعلى أولاً)" },
    { value: "stockAsc", label: "المخزون (الأقل أولاً)" },
    { value: "stockDesc", label: "المخزون (الأكثر أولاً)" },
  ];

  // جلب المنتجات والفئات والعلامات التجارية من قاعدة البيانات
  const fetchData = async () => {
    try {
      // Always fetch fresh data from Firebase (no caching)
      const fetchPromises = [
        getDocs(collection(db, "products")).then((snapshot) => {
          const data = [];
          snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
          setProducts(data);
          return data;
        }),
        getDocs(collection(db, "categories")).then((snapshot) => {
          const data = [];
          snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
          setCategories(data);
          return data;
        }),
        getDocs(collection(db, "brands")).then((snapshot) => {
          const data = [];
          snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
          setBrands(data);
          return data;
        }),
      ];

      await Promise.all(fetchPromises);
    } catch (error) {
      // بيانات تجريبية في حال عدم جلب البيانات
      setProducts([
        {
          id: "1",
          name: "شامبو للشعر الجاف",
          price: 50,
          description: "شامبو مخصص للشعر الجاف والمتضرر بتركيبة مرطبة عميقة.",
          images: ["/images/sample1.jpg"],
          categories: ["الشعر"],
          brand: "لوريال",
          stock: 15,
          isNew: true,
          onDemand: false,
          hasVariants: false,
          createdAt: new Date("2024-01-15"),
        },
        {
          id: "2",
          name: "ماسك مغذي للشعر",
          price: 75,
          description: "ماسك للشعر بالزيوت الطبيعية للتغذية العميقة.",
          images: ["/images/sample2.jpg"],
          categories: ["العناية بالشعر"],
          brand: "بانتين",
          stock: 0,
          isNew: false,
          onDemand: false,
          hasVariants: false,
          createdAt: new Date("2023-12-01"),
        },
        {
          id: "3",
          name: "كريم تصفيف الشعر",
          price: 60,
          description: "كريم طبيعي لتصفيف وتثبيت الشعر بدون كيماويات ضارة.",
          images: ["/images/sample3.jpg"],
          categories: ["تصفيف"],
          brand: "لوريال",
          stock: 25,
          isNew: false,
          onDemand: true,
          hasVariants: false,
          createdAt: new Date("2023-11-20"),
        },
        {
          id: "4",
          name: "زيت الأرغان للشعر",
          price: 85,
          description: "زيت طبيعي 100% لتقوية الشعر وإضافة اللمعان الطبيعي.",
          images: ["/images/sample1.jpg"],
          categories: ["العناية بالشعر"],
          brand: "The Ordinary",
          stock: 3,
          isNew: true,
          onDemand: false,
          hasVariants: true,
          variants: [
            { size: "30ml", price: 85, stock: 3 },
            { size: "60ml", price: 150, stock: 0 },
          ],
          createdAt: new Date("2024-01-10"),
        },
        {
          id: "5",
          name: "سيروم فيتامين سي",
          price: 95,
          description:
            "سيروم مضاد للأكسدة لإشراق البشرة ومحاربة علامات التقدم.",
          images: ["/images/sample2.jpg"],
          categories: ["العناية بالبشرة"],
          brand: "The Ordinary",
          stock: 8,
          isNew: false,
          onDemand: false,
          hasVariants: false,
          createdAt: new Date("2023-10-15"),
        },
        {
          id: "6",
          name: "كريم مرطب للوجه",
          price: 45,
          description:
            "كريم يرطب البشرة ويمنحها نعومة فائقة مع الحماية اليومية.",
          images: ["/images/sample3.jpg"],
          categories: ["العناية بالبشرة"],
          brand: "Nivea",
          stock: 2,
          isNew: false,
          onDemand: true,
          hasVariants: false,
          createdAt: new Date("2023-09-30"),
        },
      ]);
      setCategories([
        { id: "cat1", name: "شامبو" },
        { id: "cat2", name: "بلسم" },
        { id: "cat3", name: "ماسك الشعر" },
        { id: "cat4", name: "كريمات التصفيف" },
      ]);
      setBrands([
        { id: "brand1", name: "لوريال" },
        { id: "brand2", name: "بانتين" },
        { id: "brand3", name: "هيد آند شولدرز" },
      ]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-hide form opened indicator after 5 seconds
  useEffect(() => {
    if (formJustOpened) {
      const timer = setTimeout(() => {
        setFormJustOpened(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [formJustOpened]);

  // Auto-resize textareas when form data changes
  useEffect(() => {
    const textareas = document.querySelectorAll(".mp-form textarea");
    textareas.forEach((textarea) => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    });
  }, [formData.description, formData.howToUse, showForm]);

  // التعامل مع تغيير مدخلات النموذج
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-grow textarea as user types
    if (e.target.tagName === "TEXTAREA") {
      e.target.style.height = "auto";
      e.target.style.height = e.target.scrollHeight + "px";
    }
  };

  // Handle variant management
  const handleVariantToggle = () => {
    setFormData((prev) => ({
      ...prev,
      hasVariants: !prev.hasVariants,
      variants: !prev.hasVariants ? [] : prev.variants,
      price: !prev.hasVariants ? prev.price : "",
      stock: !prev.hasVariants ? prev.stock : "",
    }));
  };

  const addSize = () => {
    const newSize = prompt("أدخل اسم الحجم الجديد:");
    if (newSize && newSize.trim()) {
      setFormData((prev) => ({
        ...prev,
        sizes: [...prev.sizes, newSize.trim()],
      }));
    }
  };

  const removeSize = (sizeToRemove) => {
    setFormData((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((size) => size !== sizeToRemove),
      variants: prev.variants.filter(
        (variant) => variant.size !== sizeToRemove,
      ),
    }));
  };

  const addColor = () => {
    const newColor = prompt("أدخل اسم اللون الجديد:");
    if (newColor && newColor.trim()) {
      setFormData((prev) => ({
        ...prev,
        colors: [...prev.colors, newColor.trim()],
      }));
    }
  };

  const removeColor = (colorToRemove) => {
    setFormData((prev) => ({
      ...prev,
      colors: prev.colors.filter((color) => color !== colorToRemove),
      variants: prev.variants.filter(
        (variant) => variant.color !== colorToRemove,
      ),
    }));
  };

  const updateVariant = (size, color, field, value) => {
    setFormData((prev) => {
      const newVariants = [...prev.variants];
      // Handle cases where either size or color might be null
      const existingIndex = newVariants.findIndex((v) => {
        if (size && color) {
          // Both size and color
          return v.size === size && v.color === color;
        } else if (size && !color) {
          // Only size
          return v.size === size && !v.color;
        } else if (!size && color) {
          // Only color
          return !v.size && v.color === color;
        }
        return false;
      });

      if (existingIndex >= 0) {
        newVariants[existingIndex] = {
          ...newVariants[existingIndex],
          [field]: field === "stock" ? parseInt(value) || 0 : value,
        };
      } else {
        newVariants.push({
          size: size || null,
          color: color || null,
          price: "",
          stock: 0,
        });
      }

      return { ...prev, variants: newVariants };
    });
  };

  const removeVariant = (size, color) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => {
        if (size && color) {
          // Both size and color
          return !(v.size === size && v.color === color);
        } else if (size && !color) {
          // Only size
          return !(v.size === size && !v.color);
        } else if (!size && color) {
          // Only color
          return !(!v.size && v.color === color);
        }
        return true;
      }),
    }));
  };

  // التعامل مع تحديد الفئات (متعدد)
  const handleCategoryToggle = (catName) => {
    setFormData((prev) => {
      // Handle "None" option
      if (catName === "بدون فئة") {
        if (prev.categories.includes("بدون فئة")) {
          // Remove "None" option
          return {
            ...prev,
            categories: prev.categories.filter((c) => c !== "بدون فئة"),
            subcategories: prev.subcategories,
          };
        } else {
          // Select only "None" option (clear other selections)
          return { ...prev, categories: ["بدون فئة"], subcategories: [] };
        }
      }

      // Handle regular categories
      const isSelected = prev.categories.includes(catName);
      let newCategories;
      let newSubcategories = [...prev.subcategories];

      if (isSelected) {
        newCategories = prev.categories.filter((c) => c !== catName);
        // Remove subcategories of this category
        const category = categories.find((c) => c.name === catName);
        if (category && category.subcategories) {
          newSubcategories = newSubcategories.filter(
            (sub) => !category.subcategories.includes(sub)
          );
        }
      } else {
        // Remove "None" option when selecting a regular category
        newCategories = prev.categories.filter((c) => c !== "بدون فئة");
        newCategories = [...newCategories, catName];
      }

      return { ...prev, categories: newCategories, subcategories: newSubcategories };
    });
  };

  const handleSubcategoryToggle = (subcategoryName) => {
    setFormData((prev) => {
      const isSelected = prev.subcategories.includes(subcategoryName);
      let newSubcategories;

      if (isSelected) {
        newSubcategories = prev.subcategories.filter((s) => s !== subcategoryName);
      } else {
        newSubcategories = [...prev.subcategories, subcategoryName];
      }

      return { ...prev, subcategories: newSubcategories };
    });
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);

    // Calculate total images that would result
    const currentKeptImages = formData.id
      ? existingImages.length - imagesToDelete.size
      : 0;
    const totalImages = currentKeptImages + files.length;

    if (totalImages > 9) {
      toast.error(
        `لا يمكن أن يتجاوز إجمالي الصور 9 صور. الصور الحالية: ${currentKeptImages}, الصور الجديدة: ${files.length}, الإجمالي: ${totalImages}`,
      );
      return;
    }

    if (files.length > 9) {
      toast.error("يمكنك اختيار حد أقصى 9 صور");
      return;
    }

    // Validate file types
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const invalidFiles = files.filter(
      (file) => !validTypes.includes(file.type),
    );

    if (invalidFiles.length > 0) {
      toast.error("يُسمح فقط بملفات الصور (JPG, PNG, WEBP)");
      return;
    }

    // Validate file sizes (max 5MB per file)
    const oversizedFiles = files.filter((file) => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    setSelectedFiles(files);
  };

  // Upload images to Firebase Storage
  const uploadImages = async (files, productId) => {
    if (!files || files.length === 0) return [];

    setUploading(true);
    const uploadPromises = files.map(async (file, index) => {
      const fileName = `products/${productId}/${Date.now()}_${index}_${
        file.name
      }`;
      const storageRef = ref(storage, fileName);

      setUploadProgress((prev) => ({ ...prev, [index]: 0 }));

      try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        setUploadProgress((prev) => ({ ...prev, [index]: 100 }));
        return downloadURL;
      } catch (error) {
        setUploadProgress((prev) => ({ ...prev, [index]: -1 }));
        throw error;
      }
    });

    try {
      const urls = await Promise.all(uploadPromises);
      setUploading(false);
      setUploadProgress({});
      return urls;
    } catch (error) {
      setUploading(false);
      setUploadProgress({});
      throw error;
    }
  };

  // Delete old images from storage
  const deleteOldImages = async (imageUrls) => {
    if (!imageUrls || imageUrls.length === 0) return;

    const deletePromises = imageUrls.map(async (url) => {
      try {
        const storageRef = ref(storage, url);
        await deleteObject(storageRef);
      } catch (error) {}
    });

    await Promise.all(deletePromises);
  };

  // إضافة أو تحديث منتج
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalImageUrls = [];

      if (formData.id) {
        // Editing existing product - handle image management
        const imagesToDeleteUrls = [];
        const imagesToKeep = [];

        // Separate images to keep vs delete
        existingImages.forEach((imageUrl, index) => {
          if (imagesToDelete.has(index)) {
            imagesToDeleteUrls.push(imageUrl);
          } else {
            imagesToKeep.push(imageUrl);
          }
        });

        // Upload new images if any
        let newImageUrls = [];
        if (selectedFiles.length > 0) {
          const productId = formData.id;
          newImageUrls = await uploadImages(selectedFiles, productId);
        }

        // Combine kept existing images with new images
        finalImageUrls = [...imagesToKeep, ...newImageUrls];

        // Validate total image count
        if (finalImageUrls.length > 9) {
          toast.error(
            "لا يمكن أن يتجاوز إجمالي الصور 9 صور. يرجى حذف بعض الصور أو تقليل عدد الصور الجديدة.",
          );
          setLoading(false);
          return;
        }

        // Delete marked images from Firebase Storage
        if (imagesToDeleteUrls.length > 0) {
          await deleteOldImages(imagesToDeleteUrls);
        }
      } else {
        // Adding new product - just upload new images
        if (selectedFiles.length > 0) {
          const productId = `temp_${Date.now()}`;
          finalImageUrls = await uploadImages(selectedFiles, productId);
        }

        // Validate total image count for new products
        if (finalImageUrls.length > 9) {
          toast.error(
            "لا يمكن أن يتجاوز إجمالي الصور 9 صور. يرجى تقليل عدد الصور المختارة.",
          );
          setLoading(false);
          return;
        }
      }

      const data = {
        name: formData.name,
        description: formData.description,
        howToUse: formData.howToUse || "",
        images: finalImageUrls,
        categories: formData.categories,
        subcategories: formData.subcategories || [],
        brand: formData.brand,
        isNew: formData.isNew || false,
        onDemand: formData.onDemand || false,
      };

      // Only add createdAt for new products
      if (!formData.id) {
        data.createdAt = new Date();
      }

      if (formData.hasVariants) {
        data.hasVariants = true;
        data.sizes = formData.sizes;
        data.colors = formData.colors;
        // Ensure variants have proper data types
        data.variants = formData.variants.map((variant) => ({
          ...variant,
          price: parseFloat(variant.price) || 0,
          stock: parseInt(variant.stock) || 0,
        }));
        data.price = null;
        data.stock = null;
      } else {
        data.hasVariants = false;
        const newPrice = parseFloat(formData.price);
        data.price = newPrice;
        data.stock = parseInt(formData.stock) || 0;
        data.variants = [];
        data.sizes = [];
        data.colors = [];

        // Handle discount preservation when updating price
        if (formData.id) {
          const existingProduct = products.find((p) => p.id === formData.id);
          if (existingProduct && existingProduct.hasDiscount) {
            // Product has a discount, update the original price and recalculate discounted price
            data.originalPrice = newPrice;
            data.hasDiscount = true;
            data.discountType = existingProduct.discountType;
            data.discountValue = existingProduct.discountValue;
            data.discountName = existingProduct.discountName;
            data.discountAppliedAt = existingProduct.discountAppliedAt;
            data.discountExpiresAt = existingProduct.discountExpiresAt;

            // Recalculate discounted price based on the new original price
            if (existingProduct.discountType === "percentage") {
              data.price =
                Math.round(
                  newPrice * (1 - existingProduct.discountValue / 100) * 100,
                ) / 100;
            } else {
              data.price = Math.max(
                0,
                newPrice - existingProduct.discountValue,
              );
            }
          }
        }
      }

      let updatedProducts;
      if (formData.id) {
        // تحديث
        const docRef = doc(db, "products", formData.id);
        await updateDoc(docRef, data);
        updatedProducts = products.map((p) =>
          p.id === formData.id ? { ...p, ...data } : p,
        );
      } else {
        // إضافة
        const docRef = await addDoc(collection(db, "products"), data);
        updatedProducts = [...products, { id: docRef.id, ...data }];
      }

      setProducts(updatedProducts);

      // Update cache
      CacheManager.set(CACHE_KEYS.PRODUCTS, updatedProducts, 5 * 60 * 1000);

      // Clear products cache to ensure fresh data on other pages
      clearProductsCache();

      // إعادة تعيين النموذج
      setFormData({
        id: null,
        name: "",
        price: "",
        description: "",
        howToUse: "",
        images: [],
        categories: [],
        subcategories: [],
        brand: "",
        stock: "",
        isNew: false,
        onDemand: false,
        hasVariants: false,
        variants: [],
        sizes: [],
        colors: [],
      });
      setSelectedFiles([]);
      setShowForm(false);
    } catch (error) {
      toast.error("حدث خطأ في حفظ المنتج. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  // تعديل منتج
  const handleEdit = (product) => {
    setFormData({
      id: product.id,
      name: product.name,
      price: product.hasVariants
        ? ""
        : product.hasDiscount && product.originalPrice
          ? product.originalPrice // Show original price for products with discounts
          : product.price, // Show current price for products without discounts
      description: product.description,
      howToUse: product.howToUse || "",
      images: [], // Empty array since we manage existing images separately
      categories: product.categories || [],
      subcategories: product.subcategories || [],
      brand: product.brand || "",
      stock: product.hasVariants ? "" : product.stock || 0,
      isNew: product.isNew || false,
      onDemand: product.onDemand || false,
      hasVariants: product.hasVariants || false,
      variants: product.variants || [],
      sizes: product.sizes || [],
      colors: product.colors || [],
    });
    setSelectedFiles([]);
    setExistingImages(product.images || []);
    setImagesToDelete(new Set());
    setShowForm(true);
    setFormJustOpened(true);

    // Scroll to the form with smooth animation
    // Using a slight delay to ensure form is rendered
    setTimeout(() => {
      const formElement = document.querySelector(".mp-form");
      if (formElement) {
        // Calculate offset to account for fixed navbar (70px) + some padding
        const navbarHeight = 80; // navbar height + extra padding
        const elementPosition = formElement.getBoundingClientRect().top;
        const offsetPosition =
          elementPosition + window.pageYOffset - navbarHeight;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  // حذف منتج
  const handleDelete = async (id) => {
    if (!window.confirm("هل تريد حذف هذا المنتج؟")) return;
    try {
      const product = products.find((p) => p.id === id);

      // Delete images from storage
      if (product?.images?.length > 0) {
        await deleteOldImages(product.images);
      }

      await deleteDoc(doc(db, "products", id));
      const updatedProducts = products.filter((p) => p.id !== id);
      setProducts(updatedProducts);

      // Update cache
      CacheManager.set(CACHE_KEYS.PRODUCTS, updatedProducts, 5 * 60 * 1000);

      // Clear products cache to ensure fresh data on other pages
      clearProductsCache();
    } catch (error) {
      toast.error("حدث خطأ في حذف المنتج. يرجى المحاولة مرة أخرى.");
    }
  };

  const handleCancel = () => {
    setFormData({
      id: null,
      name: "",
      price: "",
      description: "",
      howToUse: "",
      images: [],
      categories: [],
      subcategories: [],
      brand: "",
      stock: "",
      isNew: false,
      onDemand: false,
      hasVariants: false,
      variants: [],
      sizes: [],
      colors: [],
    });
    setSelectedFiles([]);
    setExistingImages([]);
    setImagesToDelete(new Set());
    setShowForm(false);
    setFormJustOpened(false); // Reset the indicator

    // Clear products cache to ensure fresh data on other pages
    clearProductsCache();
  };

  // Image management functions
  const handleDeleteExistingImage = (imageIndex) => {
    setImagesToDelete((prev) => {
      const newSet = new Set(prev);
      newSet.add(imageIndex);
      return newSet;
    });
  };

  const handleRestoreExistingImage = (imageIndex) => {
    setImagesToDelete((prev) => {
      const newSet = new Set(prev);
      newSet.delete(imageIndex);
      return newSet;
    });
  };

  const removeSelectedFile = (fileIndex) => {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== fileIndex));
  };

  const getFinalImages = () => {
    // Combine existing images (excluding deleted ones) with new images
    const keptExistingImages = existingImages.filter(
      (_, index) => !imagesToDelete.has(index),
    );
    return [...keptExistingImages, ...formData.images];
  };

  // Helper functions for badge management
  const toggleBadge = (badgeKey) => {
    setSelectedBadges((prev) =>
      prev.includes(badgeKey)
        ? prev.filter((b) => b !== badgeKey)
        : [...prev, badgeKey],
    );
  };

  const isBadgeSelected = (badgeKey) => selectedBadges.includes(badgeKey);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (stockFilter) count++;
    if (selectedCategory) count++;
    if (selectedBrand) count++;
    if (priceRange.min || priceRange.max) count++;
    if (selectedBadges.length > 0) count++;
    if (sortOrder && sortOrder !== "newest") count++; // Don't count "newest" as it's default
    if (availabilityFilter !== "all") count++;
    return count;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSelectedBrand("");
    setPriceRange({ min: "", max: "" });
    setSelectedBadges([]);
    setSortOrder("newest");
    setAvailabilityFilter("all");
    setStockFilter("");
  };

  // Enhanced filtering function for products
  const getFilteredProducts = () => {
    let filtered = products;

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name?.toLowerCase().includes(searchLower) ||
          product.brand?.toLowerCase().includes(searchLower) ||
          product.categories?.some((cat) =>
            cat.toLowerCase().includes(searchLower),
          ),
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((product) =>
        product.categories?.includes(selectedCategory),
      );
    }

    // Filter by brand
    if (selectedBrand) {
      filtered = filtered.filter((product) => product.brand === selectedBrand);
    }

    // Filter by price range
    if (priceRange.min !== "" || priceRange.max !== "") {
      filtered = filtered.filter((product) => {
        const price = parseFloat(product.price) || 0;
        const min = priceRange.min !== "" ? parseFloat(priceRange.min) : 0;
        const max =
          priceRange.max !== "" ? parseFloat(priceRange.max) : Infinity;
        return price >= min && price <= max;
      });
    }

    // Filter by badges
    if (selectedBadges.length > 0) {
      filtered = filtered.filter((product) => {
        return selectedBadges.some((badge) => {
          switch (badge) {
            case "new":
              return product.isNew === true;
            case "onDemand":
              return product.onDemand === true;
            case "hasVariants":
              return product.hasVariants === true;
            case "lowStock":
              // For variant products, check if any variant has low stock (1-5)
              if (product.hasVariants && product.variants) {
                return product.variants.some(
                  (v) => (v.stock || 0) > 0 && (v.stock || 0) <= 5,
                );
              }
              const stock = product.stock || 0;
              return stock > 0 && stock <= 5;
            case "outOfStock":
              // For variant products, check if ALL variants are out of stock
              if (product.hasVariants && product.variants) {
                return product.variants.every((v) => (v.stock || 0) === 0);
              }
              return (product.stock || 0) === 0;
            default:
              return false;
          }
        });
      });
    }

    // Filter by stock status
    if (stockFilter) {
      filtered = filtered.filter((product) => {
        // For variant products, calculate total stock from all variants
        let stock;
        if (product.hasVariants && product.variants) {
          stock = product.variants.reduce(
            (sum, v) => sum + (parseInt(v.stock) || 0),
            0,
          );
        } else {
          stock = product.stock || 0;
        }

        switch (stockFilter) {
          case "in-stock":
            return stock > 5;
          case "low-stock":
            return stock > 0 && stock <= 5;
          case "out-of-stock":
            return stock === 0;
          default:
            return true;
        }
      });
    }

    // Filter by availability
    if (availabilityFilter !== "all") {
      filtered = filtered.filter((product) => {
        switch (availabilityFilter) {
          case "available":
            return !product.onDemand;
          case "onDemand":
            return product.onDemand === true;
          default:
            return true;
        }
      });
    }

    // Sorting
    if (sortOrder) {
      filtered.sort((a, b) => {
        switch (sortOrder) {
          case "name":
            return (a.name || "").localeCompare(b.name || "");
          case "brand":
            return (a.brand || "").localeCompare(b.brand || "");
          case "priceAsc":
            return (a.price || 0) - (b.price || 0);
          case "priceDesc":
            return (b.price || 0) - (a.price || 0);
          case "stockAsc":
            return (a.stock || 0) - (b.stock || 0);
          case "stockDesc":
            return (b.stock || 0) - (a.stock || 0);
          case "newest":
            // Handle products with and without creation dates
            const aDate = a.createdAt
              ? new Date(
                  a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt,
                )
              : new Date(0);
            const bDate = b.createdAt
              ? new Date(
                  b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt,
                )
              : new Date(0);
            return bDate - aDate;
          default:
            return 0;
        }
      });
    }

    return filtered;
  };

  const filteredProducts = getFilteredProducts();

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    stockFilter,
    selectedCategory,
    selectedBrand,
    priceRange,
    selectedBadges,
    sortOrder,
    availabilityFilter,
  ]);

  // Ensure default sorting is always "newest" when no sorting is selected
  useEffect(() => {
    if (!sortOrder) {
      setSortOrder("newest");
    }
  }, [sortOrder]);

  // Refresh data function
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
      // Clear products cache to ensure fresh data on other pages
      clearProductsCache();
    } catch (error) {
    } finally {
      setRefreshing(false);
    }
  };

  // Clear products cache to ensure fresh data on other pages
  // This ensures that the home page and products page will fetch fresh data
  // instead of using stale cached data when products are modified
  const clearProductsCache = () => {
    CacheManager.remove(CACHE_KEYS.PRODUCTS);
  };

  const handleDateFilterChange = (field, value) => {
    setDateFilter((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Navbar />
      <div className="manage-products-page">
        <div className="mp-header">
          <h1>إدارة المنتجات</h1>
        </div>

        {/* Add Product Button */}
        {!showForm && (
          <div className="mp-add-section">
            <button className="mp-add-button" onClick={() => setShowForm(true)}>
              + إضافة منتج جديد
            </button>
          </div>
        )}

        {/* Search and Filter Section */}
        {!showForm && (
          <div className="mp-controls">
            <div className="mp-filters-header">
              <span className="mp-filters-icon">
                <i className="fas fa-search"></i>
              </span>
              <h3 className="mp-filters-title">البحث والتصفية</h3>
              {getActiveFiltersCount() > 0 && (
                <span className="mp-filters-count">
                  ({getActiveFiltersCount()})
                </span>
              )}
            </div>

            {/* Basic Filters Row */}
            <div className="mp-basic-filters">
              <div className="mp-search">
                <input
                  type="text"
                  placeholder="ابحث عن منتج بالاسم، العلامة التجارية، أو الفئة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mp-search-input"
                />
              </div>

              <div className="mp-filter-group">
                <label>الفئة:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mp-filter-select"
                >
                  <option value="">كل الفئات</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mp-filter-group">
                <label>العلامة التجارية:</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="mp-filter-select"
                >
                  <option value="">كل العلامات التجارية</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.name}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mp-filter-group">
                <label>الترتيب:</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="mp-filter-select"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Advanced Filters Row */}
            <div className="mp-advanced-filters">
              <div className="mp-filter-group">
                <label>المخزون:</label>
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  className="mp-filter-select"
                >
                  {stockFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mp-filter-group">
                <label>التوفر:</label>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="mp-filter-select"
                >
                  {availabilityFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mp-price-range">
                <label>نطاق السعر:</label>
                <div className="mp-price-inputs">
                  <input
                    type="number"
                    placeholder="من"
                    value={priceRange.min}
                    onChange={(e) =>
                      setPriceRange((prev) => ({
                        ...prev,
                        min: e.target.value,
                      }))
                    }
                    className="mp-price-input"
                    min="0"
                  />
                  <span className="mp-price-separator">-</span>
                  <input
                    type="number"
                    placeholder="إلى"
                    value={priceRange.max}
                    onChange={(e) =>
                      setPriceRange((prev) => ({
                        ...prev,
                        max: e.target.value,
                      }))
                    }
                    className="mp-price-input"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Badge Filters */}
            <div className="mp-badge-filters">
              <label>الخصائص:</label>
              <div className="mp-badges-grid">
                {availableBadges.map((badge) => (
                  <button
                    key={badge.key}
                    className={`mp-badge-filter ${
                      isBadgeSelected(badge.key) ? "active" : ""
                    }`}
                    onClick={() => toggleBadge(badge.key)}
                    type="button"
                  >
                    <span className="mp-badge-icon">{badge.icon}</span>
                    <span className="mp-badge-text">{badge.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Filters Display */}
            {getActiveFiltersCount() > 0 && (
              <div className="mp-active-filters">
                <button className="mp-clear-filters" onClick={clearFilters}>
                  مسح جميع الفلاتر
                </button>
              </div>
            )}

            <div className="mp-products-count">
              عرض {indexOfFirstItem + 1}-
              {Math.min(indexOfLastItem, filteredProducts.length)} من{" "}
              {filteredProducts.length} منتج
            </div>
          </div>
        )}

        {/* Product Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mp-form">
            {formJustOpened && (
              <div className="mp-form-opened-indicator">
                <div className="mp-indicator-content">
                  <span className="mp-indicator-icon">
                    <i className="fas fa-check-circle"></i>
                  </span>
                  <span className="mp-indicator-text">
                    تم فتح نموذج التعديل! يمكنك الآن تعديل بيانات المنتج
                  </span>
                </div>
              </div>
            )}

            <h2>{formData.id ? "تعديل المنتج" : "إضافة منتج جديد"}</h2>

            {/* Show creation date when editing */}
            {formData.id && (
              <div className="mp-creation-date-display">
                <span className="mp-creation-date-label">
                  <i className="fas fa-calendar-alt"></i> تاريخ الإنشاء:
                </span>
                <span className="mp-creation-date-value">
                  {(() => {
                    const product = products.find((p) => p.id === formData.id);
                    if (product?.createdAt) {
                      const date = new Date(
                        product.createdAt.toDate
                          ? product.createdAt.toDate()
                          : product.createdAt,
                      );
                      return (
                        date.toLocaleDateString("en-US") +
                        " " +
                        date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      );
                    }
                    return "غير محدد";
                  })()}
                </span>
              </div>
            )}

            {formData.id &&
              products.find((p) => p.id === formData.id)?.hasDiscount && (
                <div className="mp-edit-discount-header">
                  <div className="mp-edit-discount-summary">
                    <span className="mp-edit-discount-icon">
                      <i className="fas fa-tag"></i>
                    </span>
                    <span className="mp-edit-discount-text">
                      هذا المنتج يحتوي على خصم. أنت تقوم بتعديل{" "}
                      <strong>السعر الأصلي</strong> (قبل الخصم).
                    </span>
                  </div>
                </div>
              )}

            <div className="mp-form-group">
              <label>اسم المنتج:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                required
                onChange={handleChange}
                placeholder="مثال: شامبو للشعر الجاف"
              />
            </div>

            <div className="mp-form-group">
              <label>العلامة التجارية:</label>
              <select
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="mp-brand-select"
              >
                <option value="">بدون علامة تجارية</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.name}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mp-form-group">
              <label>نوع المنتج:</label>
              <div className="mp-variant-toggle">
                <label className="mp-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.hasVariants}
                    onChange={handleVariantToggle}
                  />
                  <span>منتج بأحجام وألوان متعددة</span>
                </label>
              </div>
            </div>

            {!formData.hasVariants ? (
              <div className="mp-form-group">
                <label>السعر (شيكل):</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  required
                  min="0"
                  step="0.01"
                  onChange={handleChange}
                />
                {formData.id && (
                  <small className="mp-discount-note">
                    <i className="fas fa-lightbulb"></i> ملاحظة: إذا كان المنتج
                    يحتوي على خصم، سيتم عرض السعر الأصلي (قبل الخصم) في هذا
                    الحقل. عند الحفظ، سيتم تطبيق الخصم تلقائياً على السعر الجديد
                  </small>
                )}
                {formData.id &&
                  products.find((p) => p.id === formData.id)?.hasDiscount && (
                    <div className="mp-current-discount-info">
                      <span className="mp-discount-label">خصم حالي:</span>
                      <span className="mp-discount-name">
                        {
                          products.find((p) => p.id === formData.id)
                            ?.discountName
                        }
                      </span>
                      <span className="mp-discount-value">
                        {
                          products.find((p) => p.id === formData.id)
                            ?.discountValue
                        }
                        {products.find((p) => p.id === formData.id)
                          ?.discountType === "percentage"
                          ? "%"
                          : " شيكل"}
                      </span>
                      <span className="mp-current-discounted-price">
                        السعر الحالي بعد الخصم:{" "}
                        {products.find((p) => p.id === formData.id)?.price} شيكل
                      </span>
                    </div>
                  )}
              </div>
            ) : (
              <div className="mp-variants-section">
                <h4>إدارة الأحجام والألوان</h4>

                {/* Sizes Management */}
                <div className="mp-sizes-section">
                  <div className="mp-section-header">
                    <h5>الأحجام المتاحة</h5>
                    <button
                      type="button"
                      onClick={addSize}
                      className="mp-add-btn-small"
                    >
                      + إضافة حجم
                    </button>
                  </div>
                  <div className="mp-sizes-list">
                    {formData.sizes.map((size, index) => (
                      <div key={index} className="mp-size-item">
                        <span>{size}</span>
                        <button
                          type="button"
                          onClick={() => removeSize(size)}
                          className="mp-remove-btn-small"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Colors Management */}
                <div className="mp-colors-section">
                  <div className="mp-section-header">
                    <h5>الألوان المتاحة</h5>
                    <button
                      type="button"
                      onClick={addColor}
                      className="mp-add-btn-small"
                    >
                      + إضافة لون
                    </button>
                  </div>
                  <div className="mp-colors-list">
                    {formData.colors.map((color, index) => (
                      <div key={index} className="mp-color-item">
                        <span>{color}</span>
                        <button
                          type="button"
                          onClick={() => removeColor(color)}
                          className="mp-remove-btn-small"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Variants Table */}
                {(formData.sizes.length > 0 || formData.colors.length > 0) && (
                  <div className="mp-variants-table">
                    <h5>جدول الأسعار والمخزون</h5>
                    {formData.sizes.length > 0 && formData.colors.length > 0 ? (
                      // Both sizes and colors
                      <table className="mp-variants-grid">
                        <thead>
                          <tr>
                            <th>الحجم / اللون</th>
                            {formData.colors.map((color) => (
                              <th key={color}>{color}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {formData.sizes.map((size) => (
                            <tr key={size}>
                              <td className="mp-size-label">{size}</td>
                              {formData.colors.map((color) => {
                                const variant = formData.variants.find(
                                  (v) => v.size === size && v.color === color,
                                );
                                return (
                                  <td key={color} className="mp-variant-cell">
                                    <div className="mp-variant-inputs">
                                      <input
                                        type="number"
                                        placeholder="السعر"
                                        value={variant?.price || ""}
                                        onChange={(e) =>
                                          updateVariant(
                                            size,
                                            color,
                                            "price",
                                            e.target.value,
                                          )
                                        }
                                        min="0"
                                        step="0.01"
                                        className="mp-variant-price"
                                      />
                                      <input
                                        type="number"
                                        placeholder="المخزون"
                                        value={variant?.stock || ""}
                                        onChange={(e) =>
                                          updateVariant(
                                            size,
                                            color,
                                            "stock",
                                            e.target.value,
                                          )
                                        }
                                        min="0"
                                        className="mp-variant-stock"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeVariant(size, color)
                                        }
                                        className="mp-remove-variant-btn"
                                        title="إزالة هذا المتغير"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : formData.sizes.length > 0 ? (
                      // Only sizes
                      <div className="mp-sizes-only-variants">
                        <h6>متغيرات الأحجام فقط</h6>
                        <div className="mp-size-variants-list">
                          {formData.sizes.map((size) => {
                            const variant = formData.variants.find(
                              (v) => v.size === size && !v.color,
                            );
                            return (
                              <div key={size} className="mp-size-variant-item">
                                <span className="mp-size-variant-label">
                                  {size}
                                </span>
                                <div className="mp-size-variant-inputs">
                                  <input
                                    type="number"
                                    placeholder="السعر"
                                    value={variant?.price || ""}
                                    onChange={(e) =>
                                      updateVariant(
                                        size,
                                        null,
                                        "price",
                                        e.target.value,
                                      )
                                    }
                                    min="0"
                                    step="0.01"
                                    className="mp-variant-price"
                                  />
                                  <input
                                    type="number"
                                    placeholder="المخزون"
                                    value={variant?.stock || ""}
                                    onChange={(e) =>
                                      updateVariant(
                                        size,
                                        null,
                                        "stock",
                                        e.target.value,
                                      )
                                    }
                                    min="0"
                                    className="mp-variant-stock"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeVariant(size, null)}
                                    className="mp-remove-variant-btn"
                                    title="إزالة هذا المتغير"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      // Only colors
                      <div className="mp-colors-only-variants">
                        <h6>متغيرات الألوان فقط</h6>
                        <div className="mp-color-variants-list">
                          {formData.colors.map((color) => {
                            const variant = formData.variants.find(
                              (v) => !v.size && v.color === color,
                            );
                            return (
                              <div
                                key={color}
                                className="mp-color-variant-item"
                              >
                                <span className="mp-color-variant-label">
                                  {color}
                                </span>
                                <div className="mp-color-variant-inputs">
                                  <input
                                    type="number"
                                    placeholder="السعر"
                                    value={variant?.price || ""}
                                    onChange={(e) =>
                                      updateVariant(
                                        null,
                                        color,
                                        "price",
                                        e.target.value,
                                      )
                                    }
                                    min="0"
                                    step="0.01"
                                    className="mp-variant-price"
                                  />
                                  <input
                                    type="number"
                                    placeholder="المخزون"
                                    value={variant?.stock || ""}
                                    onChange={(e) =>
                                      updateVariant(
                                        null,
                                        color,
                                        "stock",
                                        e.target.value,
                                      )
                                    }
                                    min="0"
                                    className="mp-variant-stock"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeVariant(null, color)}
                                    className="mp-remove-variant-btn"
                                    title="إزالة هذا المتغير"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!formData.hasVariants && (
              <div className="mp-form-group">
                <label>الكمية المتوفرة:</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  required
                  min="0"
                  onChange={handleChange}
                  placeholder="عدد القطع المتوفرة"
                />
              </div>
            )}

            {/* Badge Controls */}
            <div className="mp-form-group">
              <label>العلامات والشارات:</label>
              <div className="mp-badge-controls">
                <div className="mp-checkbox-group">
                  <label className="mp-checkbox-label">
                    <input
                      type="checkbox"
                      name="isNew"
                      checked={formData.isNew}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          isNew: e.target.checked,
                        }))
                      }
                    />
                    <span className="mp-checkbox-text">
                      <span className="mp-badge-preview mp-badge-preview--new">
                        جديد
                      </span>
                      منتج جديد
                    </span>
                  </label>
                </div>
                <div className="mp-checkbox-group">
                  <label className="mp-checkbox-label">
                    <input
                      type="checkbox"
                      name="onDemand"
                      checked={formData.onDemand}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          onDemand: e.target.checked,
                        }))
                      }
                    />
                    <span className="mp-checkbox-text">
                      <span className="mp-badge-preview mp-badge-preview--on-demand">
                        على الطلب
                      </span>
                      متوفر عند الطلب
                    </span>
                  </label>
                </div>
                <div className="mp-info-note">
                  <small>
                    <i className="fas fa-lightbulb"></i> ملاحظة: شارة "بيعت
                    كلها" تظهر تلقائياً عند انتهاء الكمية المتوفرة
                  </small>
                </div>
              </div>
            </div>

            <div className="mp-form-group">
              <label>الوصف:</label>
              <textarea
                name="description"
                value={formData.description}
                required
                onChange={handleChange}
                placeholder="وصف تفصيلي للمنتج وفوائده"
              />
            </div>

            <div className="mp-form-group">
              <label>طريقة الاستخدام:</label>
              <textarea
                name="howToUse"
                value={formData.howToUse}
                onChange={handleChange}
                placeholder="اشرح كيفية استخدام المنتج بالتفصيل (اختياري)"
                rows="4"
              />
              <small>
                <i className="fas fa-lightbulb"></i> ملاحظة: هذا الحقل اختياري
                ولكن يساعد العملاء على استخدام المنتج بشكل صحيح
              </small>
            </div>

            <div className="mp-form-group">
              <label>صور المنتج (حد أقصى 9 صور):</label>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="mp-file-input"
              />
              <div className="mp-file-info">
                <small>
                  يُسمح بملفات JPG, PNG, WEBP فقط. حد أقصى 5 ميجابايت لكل صورة.
                  {formData.id && existingImages.length > 0 && (
                    <span className="mp-additive-note">
                      الصور الجديدة ستضاف إلى الصور المحتفظ بها. الصور المحتفظ
                      بها: {existingImages.length - imagesToDelete.size} | الصور
                      الجديدة: {selectedFiles.length} | الإجمالي النهائي:{" "}
                      {existingImages.length -
                        imagesToDelete.size +
                        selectedFiles.length}
                    </span>
                  )}
                </small>
              </div>

              {/* Show selected files */}
              {selectedFiles.length > 0 && (
                <div className="mp-selected-files">
                  <h4>الصور المختارة:</h4>
                  <div className="mp-file-list">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="mp-file-item">
                        <span>{file.name}</span>
                        <span className="mp-file-size">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                        {uploadProgress[index] !== undefined && (
                          <div className="mp-upload-progress">
                            {uploadProgress[index] === -1 ? (
                              <span className="mp-error">فشل الرفع</span>
                            ) : (
                              <span>{uploadProgress[index]}%</span>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(index)}
                          className="mp-remove-selected-file-btn"
                          title="إزالة هذه الصورة"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show existing images when editing */}
              {formData.id && existingImages.length > 0 && (
                <div className="mp-existing-images">
                  <h4>الصور الحالية:</h4>
                  <div className="mp-image-grid">
                    {existingImages.map((imageUrl, index) => {
                      const isMarkedForDeletion = imagesToDelete.has(index);
                      return (
                        <div
                          key={index}
                          className={`mp-image-item ${
                            isMarkedForDeletion ? "marked-for-deletion" : ""
                          }`}
                        >
                          <img
                            src={imageUrl}
                            alt={`Product ${index + 1}`}
                            className="mp-image-preview"
                          />
                          {isMarkedForDeletion ? (
                            <button
                              type="button"
                              onClick={() => handleRestoreExistingImage(index)}
                              className="mp-restore-existing-image-btn"
                              title="استعادة هذه الصورة"
                            >
                              ↺
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteExistingImage(index)}
                              className="mp-delete-existing-image-btn"
                              title="حذف هذه الصورة"
                            >
                              ×
                            </button>
                          )}
                          {isMarkedForDeletion && (
                            <div className="mp-deletion-overlay">
                              <span className="mp-deletion-text">
                                سيتم حذفها
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mp-image-management-info">
                    <small>
                      <i className="fas fa-lightbulb"></i> يمكنك حذف صور محددة
                      بالنقر على × أو إضافة صور جديدة أدناه. الصور المحذوفة
                      ستظهر مع علامة "سيتم حذفها".
                    </small>
                    {formData.id && (
                      <div className="mp-image-summary">
                        <span className="mp-summary-item">
                          <i className="fas fa-camera"></i> الصور المحتفظ بها:{" "}
                          {existingImages.length - imagesToDelete.size}
                        </span>
                        {imagesToDelete.size > 0 && (
                          <span className="mp-summary-item mp-summary-deleted">
                            <i className="fas fa-trash-alt"></i> الصور المحذوفة:{" "}
                            {imagesToDelete.size}
                          </span>
                        )}
                        {selectedFiles.length > 0 && (
                          <span className="mp-summary-item mp-summary-added">
                            <i className="fas fa-plus"></i> الصور الجديدة:{" "}
                            {selectedFiles.length}
                          </span>
                        )}
                        <span className="mp-summary-item mp-summary-total">
                          <i className="fas fa-chart-bar"></i> إجمالي الصور
                          النهائي:{" "}
                          {existingImages.length -
                            imagesToDelete.size +
                            selectedFiles.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mp-form-group">
              <label>الفئات:</label>
              <div className="mp-categories">
                <label className="mp-category">
                  <input
                    type="checkbox"
                    checked={formData.categories.includes("بدون فئة")}
                    onChange={() => handleCategoryToggle("بدون فئة")}
                  />
                  بدون فئة
                </label>
                {categories.map((cat) => (
                  <div key={cat.id} className="mp-category-group">
                    <label className="mp-category">
                      <input
                        type="checkbox"
                        checked={formData.categories.includes(cat.name)}
                        onChange={() => handleCategoryToggle(cat.name)}
                        disabled={formData.categories.includes("بدون فئة")}
                      />
                      {cat.name}
                    </label>
                    {/* Show subcategories if category is selected */}
                    {formData.categories.includes(cat.name) &&
                      cat.subcategories &&
                      cat.subcategories.length > 0 && (
                        <div className="mp-subcategories">
                          <span className="mp-subcategory-label">
                            الفئات الفرعية:
                          </span>
                          {cat.subcategories.map((sub, index) => (
                            <label key={index} className="mp-subcategory">
                              <input
                                type="checkbox"
                                checked={formData.subcategories.includes(sub)}
                                onChange={() => handleSubcategoryToggle(sub)}
                              />
                              {sub}
                            </label>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
              </div>
              <small className="mp-category-note">
                اختر "بدون فئة" أو اختر فئة أو أكثر من الفئات المتاحة. يمكنك أيضاً اختيار الفئات الفرعية
              </small>
            </div>

            <button
              type="submit"
              className="mp-save-btn"
              disabled={loading || uploading}
            >
              {uploading
                ? "جاري رفع الصور..."
                : loading
                  ? "جاري الحفظ..."
                  : formData.id
                    ? "تحديث"
                    : "إضافة"}
            </button>
            <button
              type="button"
              className="mp-cancel-btn"
              onClick={handleCancel}
              disabled={loading || uploading}
            >
              إلغاء
            </button>
          </form>
        )}

        {/* Products Table */}
        <table className="mp-table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>الاسم</th>
              <th>العلامة التجارية</th>
              <th>السعر</th>
              <th>المخزون</th>
              <th>الفئات</th>
              <th>تاريخ الإنشاء</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {currentProducts.map((product) => (
              <tr key={product.id}>
                <td data-label="الصورة">
                  <div className="mp-product-image">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="mp-product-thumbnail"
                        loading="lazy"
                        onClick={() => {
                          setSelectedImage(product.images[0]);
                          setShowImageModal(true);
                        }}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "block";
                        }}
                      />
                    ) : null}
                    {(!product.images || product.images.length === 0) && (
                      <div className="mp-no-image">
                        <span className="mp-no-image-icon">
                          <i className="fas fa-camera"></i>
                        </span>
                        <span className="mp-no-image-text">لا توجد صورة</span>
                      </div>
                    )}
                  </div>
                </td>
                <td data-label="الاسم">
                  <Link
                    to={`/products/${product.id}`}
                    target="_blank"
                    className="mp-product-link"
                    title={`عرض تفاصيل ${product.name}`}
                  >
                    {product.name}
                    <span className="mp-link-icon">
                      <i className="fas fa-external-link-alt"></i>
                    </span>
                  </Link>
                </td>
                <td data-label="العلامة التجارية">
                  <span className="mp-brand-tag">
                    {product.brand || "بدون علامة تجارية"}
                  </span>
                </td>
                <td data-label="السعر">
                  {product.hasVariants ? (
                    <div className="mp-variants-summary">
                      <span className="mp-variants-indicator">
                        {product.sizes?.length > 0 && product.colors?.length > 0
                          ? "متغيرات متعددة"
                          : product.sizes?.length > 0
                            ? "متغيرات أحجام"
                            : "متغيرات ألوان"}
                      </span>
                      <div className="mp-variants-details">
                        {product.sizes?.length > 0 && (
                          <small>الأحجام: {product.sizes.join(", ")}</small>
                        )}
                        {product.colors?.length > 0 && (
                          <small>الألوان: {product.colors.join(", ")}</small>
                        )}
                        {(!product.sizes || product.sizes.length === 0) &&
                          (!product.colors || product.colors.length === 0) && (
                            <small>لا توجد متغيرات محددة</small>
                          )}
                      </div>
                    </div>
                  ) : product.hasDiscount && product.originalPrice ? (
                    <div className="mp-price-display">
                      <span className="mp-original-price">
                        {product.originalPrice} شيكل
                      </span>
                      <span className="mp-discount-info">
                        (خصم: {product.price} شيكل)
                      </span>
                    </div>
                  ) : (
                    `${product.price} شيكل`
                  )}
                </td>
                <td data-label="المخزون">
                  {product.hasVariants ? (
                    <div className="mp-variants-stock">
                      <span className="mp-variants-stock-indicator">
                        {product.sizes?.length > 0 && product.colors?.length > 0
                          ? "مخزون متغير"
                          : product.sizes?.length > 0
                            ? "مخزون أحجام"
                            : "مخزون ألوان"}
                      </span>
                      <div className="mp-variants-stock-summary">
                        <small>
                          إجمالي المتغيرات: {product.variants?.length || 0}
                        </small>
                        <small>
                          إجمالي المخزون:{" "}
                          {product.variants?.reduce(
                            (sum, v) => sum + (parseInt(v.stock) || 0),
                            0,
                          ) || 0}
                        </small>
                        {product.sizes?.length > 0 && (
                          <small>الأحجام: {product.sizes.join(", ")}</small>
                        )}
                        {product.colors?.length > 0 && (
                          <small>الألوان: {product.colors.join(", ")}</small>
                        )}
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const stock = product.stock || 0;
                      const badgeClass =
                        stock <= 0
                          ? "mp-out-of-stock"
                          : stock <= 5
                            ? "mp-low-stock"
                            : "mp-in-stock";
                      return (
                        <span className={`mp-stock-badge ${badgeClass}`}>
                          {stock} قطعة
                        </span>
                      );
                    })()
                  )}
                </td>
                <td data-label="الفئات">
                  {product.categories && product.categories.length > 0
                    ? product.categories.join(", ")
                    : "بدون فئة"}
                </td>
                <td data-label="تاريخ الإنشاء">
                  {product.createdAt ? (
                    <div className="mp-creation-date">
                      <span className="mp-date">
                        {new Date(
                          product.createdAt.toDate
                            ? product.createdAt.toDate()
                            : product.createdAt,
                        ).toLocaleDateString("en-US")}
                      </span>
                      <small className="mp-time">
                        {new Date(
                          product.createdAt.toDate
                            ? product.createdAt.toDate()
                            : product.createdAt,
                        ).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                  ) : (
                    <span className="mp-no-date">غير محدد</span>
                  )}
                </td>
                <td data-label="إجراءات">
                  <button
                    className="mp-edit-btn"
                    onClick={() => handleEdit(product)}
                  >
                    تعديل
                  </button>
                  <button
                    className="mp-delete-btn"
                    onClick={() => handleDelete(product.id)}
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mp-pagination">
            <button
              className="mp-pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              السابق
            </button>

            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  className={`mp-pagination-btn ${
                    currentPage === pageNumber ? "active" : ""
                  }`}
                  onClick={() => handlePageChange(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              className="mp-pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              التالي
            </button>
          </div>
        )}

        {filteredProducts.length === 0 && !showForm && (
          <div className="mp-no-results">
            <p>
              لا توجد منتجات{" "}
              {searchTerm || stockFilter ? "تطابق معايير البحث" : ""}
            </p>
          </div>
        )}

        {/* Image Modal */}
        {showImageModal && selectedImage && (
          <div
            className="mp-image-modal-overlay"
            onClick={() => setShowImageModal(false)}
          >
            <div
              className="mp-image-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mp-image-modal-header">
                <h3>معاينة الصورة</h3>
                <button
                  className="mp-image-modal-close"
                  onClick={() => setShowImageModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="mp-image-modal-content">
                <img
                  src={selectedImage}
                  alt="معاينة المنتج"
                  className="mp-image-modal-image"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ManageProducts;
