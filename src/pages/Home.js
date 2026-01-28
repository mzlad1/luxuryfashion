import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../firebase";
import Marquee from "react-fast-marquee";
import PromotionalBanner from "../components/PromotionalBanner";
import ProductCard from "../components/ProductCard";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { CacheManager, CACHE_KEYS } from "../utils/cache";
import { useNavigate } from "react-router-dom";
import "../css/Home.css";

function Home() {
  const [mostOrderedProducts, setMostOrderedProducts] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [heroSlides, setHeroSlides] = useState([]);
  const [loadingSlides, setLoadingSlides] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [bannerData, setBannerData] = useState(null);
  const [loadingBanner, setLoadingBanner] = useState(true);
  const [featuredScrollPosition, setFeaturedScrollPosition] = useState(0);
  const [mostOrderedScrollPosition, setMostOrderedScrollPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const hasMovedRef = useRef(false);
  const featuredRef = useRef(null);
  const mostOrderedRef = useRef(null);
  const categoriesRef = useRef(null);

  const navigate = useNavigate();

  // Check and remove expired discounts
  const checkExpiredDiscounts = async () => {
    try {
      const cachedProducts = CacheManager.get(CACHE_KEYS.PRODUCTS);
      if (!cachedProducts) return;

      const now = new Date();
      const expiredProducts = cachedProducts.filter(
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
      }
    } catch (error) {}
  };

  // Fetch hero slides
  useEffect(() => {
    async function fetchHeroSlides() {
      setLoadingSlides(true);
      try {
        const slidesSnapshot = await getDocs(collection(db, "heroSlides"));
        const slidesData = [];
        slidesSnapshot.forEach((doc) => {
          slidesData.push({ id: doc.id, ...doc.data() });
        });

        const activeSlides = slidesData.filter((s) => s.isActive !== false);
        activeSlides.sort((a, b) => (a.order || 0) - (b.order || 0));

        setHeroSlides(activeSlides);
      } catch (error) {
        // Set default slides if error
        setHeroSlides([
          {
            id: "default-1",
            imageUrl: "/images/hero1.jpg",
            title: "Luxury Fashion",
            subtitle: "محتوى متخصص بالعناية بالشعر",
            buttonText: "اشتري الآن",
            buttonLink: "/products",
            order: 1,
          },
        ]);
      } finally {
        setLoadingSlides(false);
      }
    }
    fetchHeroSlides();
  }, []);

  // Auto-slide carousel
  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [heroSlides.length]);

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      setLoadingCategories(true);
      try {
        // Check cache first
        const cachedCategories = CacheManager.get(CACHE_KEYS.CATEGORIES);
        if (cachedCategories) {
          setCategories(cachedCategories);
          setLoadingCategories(false);
          return;
        }

        const categoriesSnapshot = await getDocs(collection(db, "categories"));
        const categoriesData = [];
        categoriesSnapshot.forEach((doc) => {
          categoriesData.push({ id: doc.id, ...doc.data() });
        });

        CacheManager.set(CACHE_KEYS.CATEGORIES, categoriesData, 10 * 60 * 1000);
        setCategories(categoriesData);
      } catch (error) {
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  // Fetch featured products
  useEffect(() => {
    async function fetchFeaturedProducts() {
      setLoadingFeatured(true);
      try {
        const cachedProducts = CacheManager.get(CACHE_KEYS.PRODUCTS);
        let products = cachedProducts;

        if (!products) {
          const productsSnapshot = await getDocs(collection(db, "products"));
          products = [];
          productsSnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
          });
          CacheManager.set(CACHE_KEYS.PRODUCTS, products, 5 * 60 * 1000);
        }

        // Filter featured products and limit to 6
        const featured = products
          .filter((product) => product.isFeatured === true)
          .slice(0, 6);

        setFeaturedProducts(featured);
      } catch (error) {
        setFeaturedProducts([]);
      } finally {
        setLoadingFeatured(false);
      }
    }
    fetchFeaturedProducts();
  }, []);

  // Fetch most ordered products based on order data
  useEffect(() => {
    async function fetchMostOrderedProducts() {
      setLoadingProducts(true);
      try {
        // Get cached data first
        const cachedOrders = CacheManager.get(CACHE_KEYS.ORDERS);
        const cachedProducts = CacheManager.get(CACHE_KEYS.PRODUCTS);

        let orders = cachedOrders;
        let products = cachedProducts;

        // Fetch from Firebase if not cached
        if (!orders) {
          const ordersSnapshot = await getDocs(collection(db, "orders"));
          orders = [];
          ordersSnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
          });
          CacheManager.set(CACHE_KEYS.ORDERS, orders, 30 * 1000);
        }

        if (!products) {
          const productsSnapshot = await getDocs(collection(db, "products"));
          products = [];
          productsSnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
          });
          CacheManager.set(CACHE_KEYS.PRODUCTS, products, 5 * 60 * 1000);
        }

        // Calculate product order frequency
        const productOrderCount = {};

        orders.forEach((order) => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item) => {
              if (item.id) {
                productOrderCount[item.id] =
                  (productOrderCount[item.id] || 0) + (item.quantity || 1);
              }
            });
          }
        });

        // Sort products by order count and get top 5
        const sortedProducts = products
          .map((product) => ({
            ...product,
            orderCount: productOrderCount[product.id] || 0,
          }))
          .filter((product) => product.orderCount > 0) // Only include products that have been ordered
          .sort((a, b) => b.orderCount - a.orderCount)
          .slice(0, 5); // Get top 5

        setMostOrderedProducts(sortedProducts);

        // Check for expired discounts after loading products
        await checkExpiredDiscounts();
      } catch (error) {
        // Fallback data with mock order counts
        setMostOrderedProducts([
          {
            id: "1",
            name: "كريم مرطب للوجه",
            price: 50,
            brand: "Nivea",
            description: "كريم يرطب البشرة ويمنحها نعومة فائقة",
            images: ["/images/sample1.jpg"],
            categories: ["الوجه"],
            stock: 15,
            orderCount: 45,
          },
          {
            id: "2",
            name: "زيت الأرغان للشعر",
            price: 70,
            brand: "The Ordinary",
            description: "زيت طبيعي 100% لتقوية الشعر",
            images: ["/images/sample2.jpg"],
            categories: ["الشعر"],
            stock: 8,
            orderCount: 38,
          },
          {
            id: "4",
            name: "سيروم فيتامين سي",
            price: 85,
            brand: "The Ordinary",
            description: "سيروم مضاد للأكسدة لإشراق البشرة",
            images: ["/images/sample4.jpg"],
            categories: ["الوجه"],
            stock: 3,
            orderCount: 32,
          },
          {
            id: "5",
            name: "شامبو للشعر الجاف",
            price: 45,
            brand: "L'Oréal",
            description: "شامبو مخصص للشعر الجاف والمتضرر",
            images: ["/images/sample5.jpg"],
            categories: ["الشعر"],
            stock: 12,
            orderCount: 28,
          },
          {
            id: "6",
            name: "كريم مقشر للجسم",
            price: 55,
            brand: "Zara Beauty",
            description: "مقشر لطيف لإزالة خلايا الجلد الميتة",
            images: ["/images/sample6.jpg"],
            categories: ["الجسم"],
            stock: 7,
            orderCount: 22,
          },
        ]);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchMostOrderedProducts();
  }, []);

  // Check for expired discounts every 5 minutes
  useEffect(() => {
    const interval = setInterval(checkExpiredDiscounts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch promotional banner
  useEffect(() => {
    async function fetchBanner() {
      setLoadingBanner(true);
      try {
        const bannerSnapshot = await getDocs(
          collection(db, "promotionalBanner"),
        );
        if (!bannerSnapshot.empty) {
          const banner = bannerSnapshot.docs[0].data();
          setBannerData(banner);
        } else {
          // Set default banner data
          setBannerData({
            backgroundImage:
              "https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            headline: "عروض حصرية على جميع القطع في المتجر",
            subheading: "وفري حتى 30% على قطع مختارة لفترة محدودة",
            primaryButtonText: "تسوقي الآن",
            secondaryButtonText: "اعرفي المزيد",
            primaryButtonAction: "/products",
            secondaryButtonAction: "/contact",
            isActive: true,
          });
        }
      } catch (error) {
        // Set default banner on error
        setBannerData({
          backgroundImage:
            "https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
          headline: "عروض حصرية على جميع القطع في المتجر",
          subheading: "وفري حتى 30% على قطع مختارة لفترة محدودة",
          primaryButtonText: "تسوقي الآن",
          secondaryButtonText: "اعرفي المزيد",
          primaryButtonAction: "/products",
          secondaryButtonAction: "/contact",
          isActive: true,
        });
      } finally {
        setLoadingBanner(false);
      }
    }
    fetchBanner();
  }, []);

  // Fetch brands
  useEffect(() => {
    async function fetchBrands() {
      setLoadingBrands(true);
      try {
        const querySnapshot = await getDocs(collection(db, "brands"));
        const brandsData = [];
        querySnapshot.forEach((doc) => {
          brandsData.push({ id: doc.id, ...doc.data() });
        });
        setBrands(brandsData);
      } catch (error) {
        setBrands([
          {
            id: "1",
            name: "Nivea",
            logo: "/images/brands/nivea.png",
            icon: <i className="fas fa-pump-soap"></i>,
          },
          {
            id: "2",
            name: "L'Oréal",
            logo: "/images/brands/loreal.png",
            icon: <i className="fas fa-box"></i>,
          },
          {
            id: "3",
            name: "Garnier",
            logo: "/images/brands/garnier.png",
            icon: <i className="fas fa-leaf"></i>,
          },
          {
            id: "4",
            name: "The Ordinary",
            logo: "/images/brands/the-ordinary.png",
            icon: <i className="fas fa-flask"></i>,
          },
          {
            id: "5",
            name: "Zara Beauty",
            logo: "/images/brands/zara-beauty.png",
            icon: <i className="fas fa-sparkles"></i>,
          },
          {
            id: "6",
            name: "CeraVe",
            logo: "/images/brands/cerave.png",
            icon: <i className="fas fa-pump-soap"></i>,
          },
        ]);
      } finally {
        setLoadingBrands(false);
      }
    }
    fetchBrands();
  }, []);

  // Handle next slide
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  };

  // Handle previous slide
  const prevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + heroSlides.length) % heroSlides.length,
    );
  };

  // Handle dot click
  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Handle touch start
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextSlide();
    }
    if (isRightSwipe) {
      prevSlide();
    }

    // Reset
    setTouchStart(0);
    setTouchEnd(0);
  };

  // Featured products carousel scroll (RTL)
  const scrollFeatured = (direction) => {
    if (featuredRef.current) {
      const scrollAmount = 320; // Card width + gap
      // RTL: scrollLeft is negative, next goes more negative (left), prev goes towards 0 (right)
      const newPosition =
        direction === "next"
          ? featuredScrollPosition - scrollAmount
          : featuredScrollPosition + scrollAmount;

      featuredRef.current.scrollTo({
        left: newPosition,
        behavior: "smooth",
      });
      setFeaturedScrollPosition(newPosition);
    }
  };

  // Most ordered products carousel scroll (RTL)
  const scrollMostOrdered = (direction) => {
    if (mostOrderedRef.current) {
      const scrollAmount = 320; // Card width + gap
      // RTL: scrollLeft is negative, next goes more negative (left), prev goes towards 0 (right)
      const newPosition =
        direction === "next"
          ? mostOrderedScrollPosition - scrollAmount
          : mostOrderedScrollPosition + scrollAmount;

      mostOrderedRef.current.scrollTo({
        left: newPosition,
        behavior: "smooth",
      });
      setMostOrderedScrollPosition(newPosition);
    }
  };

  // Categories carousel drag-to-scroll handlers
  const handleMouseDown = (e) => {
    if (!categoriesRef.current) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    setStartX(e.pageX - categoriesRef.current.offsetLeft);
    setScrollLeft(categoriesRef.current.scrollLeft);
    categoriesRef.current.style.cursor = "grabbing";
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (categoriesRef.current) {
      categoriesRef.current.style.cursor = "grab";
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    if (categoriesRef.current) {
      categoriesRef.current.style.cursor = "grab";
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !categoriesRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoriesRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier

    // Only set hasMoved if there's significant movement
    if (Math.abs(walk) > 5) {
      hasMovedRef.current = true;
    }

    categoriesRef.current.scrollLeft = scrollLeft - walk;
  };

  // Auto-scroll for Featured Products carousel (RTL) - disabled on mobile for performance
  useEffect(() => {
    if (!featuredRef.current || featuredProducts.length === 0) return;

    // Disable auto-scroll on mobile devices for better performance
    const isMobile = window.innerWidth <= 768;
    if (isMobile) return;

    const autoScroll = setInterval(() => {
      if (featuredRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = featuredRef.current;
        const minScroll = -(scrollWidth - clientWidth); // RTL: min is negative

        if (scrollLeft <= minScroll + 10) {
          // Reset to beginning (0 in RTL)
          featuredRef.current.scrollTo({ left: 0, behavior: "smooth" });
          setFeaturedScrollPosition(0);
        } else {
          // Scroll to next (more negative in RTL)
          const newPosition = scrollLeft - 320;
          featuredRef.current.scrollTo({
            left: newPosition,
            behavior: "smooth",
          });
          setFeaturedScrollPosition(newPosition);
        }
      }
    }, 4000); // Auto-scroll every 4 seconds

    return () => clearInterval(autoScroll);
  }, [featuredProducts.length]);

  // Auto-scroll for Most Ordered Products carousel (RTL) - disabled on mobile for performance
  useEffect(() => {
    if (!mostOrderedRef.current || mostOrderedProducts.length === 0) return;

    // Disable auto-scroll on mobile devices for better performance
    const isMobile = window.innerWidth <= 768;
    if (isMobile) return;

    const autoScroll = setInterval(() => {
      if (mostOrderedRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = mostOrderedRef.current;
        const minScroll = -(scrollWidth - clientWidth); // RTL: min is negative

        if (scrollLeft <= minScroll + 10) {
          // Reset to beginning (0 in RTL)
          mostOrderedRef.current.scrollTo({ left: 0, behavior: "smooth" });
          setMostOrderedScrollPosition(0);
        } else {
          // Scroll to next (more negative in RTL)
          const newPosition = scrollLeft - 320;
          mostOrderedRef.current.scrollTo({
            left: newPosition,
            behavior: "smooth",
          });
          setMostOrderedScrollPosition(newPosition);
        }
      }
    }, 5000); // Auto-scroll every 5 seconds (offset from featured)

    return () => clearInterval(autoScroll);
  }, [mostOrderedProducts.length]);

  // Handle category click
  const handleCategoryClick = (categoryName) => {
    navigate(`/products?category=${encodeURIComponent(categoryName)}`);
  };

  // Handle brand click
  const handleBrandClick = (brandName) => {
    navigate(`/products?brand=${encodeURIComponent(brandName)}`);
  };

  // Get product count for a category
  const getCategoryProductCount = (categoryName) => {
    // Get products from cache or return 0
    const cachedProducts = CacheManager.get(CACHE_KEYS.PRODUCTS);
    if (!cachedProducts) return 0;

    // Find the category ID from the name
    const category = categories.find((cat) => cat.name === categoryName);
    if (!category) return 0;

    return cachedProducts.filter((product) => {
      // Check new format (categoryIds)
      if (product.categoryIds && product.categoryIds.length > 0) {
        return product.categoryIds.includes(category.id);
      }
      // Fallback to old format (categories)
      return product.categories?.includes(categoryName);
    }).length;
  };

  return (
    <>
      <Navbar />
      <div className="home-page">
        {/* Hero Section - Carousel */}
        <section className="hero-section">
          {loadingSlides ? (
            <div className="hero-loading">
              <div className="spinner"></div>
              <p>جاري التحميل...</p>
            </div>
          ) : heroSlides.length > 0 ? (
            <div className="hero-carousel">
              {/* Slides */}
              <div
                className="hero-slides"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {heroSlides.map((slide, index) => (
                  <div
                    key={slide.id}
                    className={`hero-slide ${
                      index === currentSlide ? "active" : ""
                    }`}
                    style={{
                      backgroundImage: `url(${slide.imageUrl})`,
                    }}
                  >
                    <div className="hero-overlay"></div>
                    <div
                      className="hero-content"
                      style={{ color: slide.textColor || "white" }}
                    >
                      <h1 className="hero-title">{slide.title}</h1>
                      {slide.subtitle && (
                        <p className="hero-subtitle">{slide.subtitle}</p>
                      )}
                      {slide.buttonText && slide.buttonLink && (
                        <button
                          className="hero-button"
                          onClick={() => navigate(slide.buttonLink)}
                          style={{
                            backgroundColor: slide.buttonColor || "#BFA57A",
                          }}
                        >
                          {slide.buttonText}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation Arrows */}
              {heroSlides.length > 1 && (
                <>
                  <button
                    className="hero-nav-btn prev"
                    onClick={prevSlide}
                    aria-label="Previous slide"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                  <button
                    className="hero-nav-btn next"
                    onClick={nextSlide}
                    aria-label="Next slide"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>

                  {/* Dots Navigation */}
                  <div className="hero-dots">
                    {heroSlides.map((_, index) => (
                      <button
                        key={index}
                        className={`hero-dot ${
                          index === currentSlide ? "active" : ""
                        }`}
                        onClick={() => goToSlide(index)}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hero-empty">
              <p>لا توجد شرائح معروضة حالياً</p>
            </div>
          )}
        </section>

        {/* Brands Section */}
        <section className="brands-section">
          <div className="section-container">
            {/* <div className="section-header">
              <h2 className="section-title">العلامات التجارية</h2>
            </div> */}

            {loadingBrands ? (
              <div className="brands-loading">
                <div className="brands-loading-grid">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="brand-skeleton">
                      <div className="skeleton-brand-logo"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : brands.length > 0 ? (
              <Marquee
                gradient={true}
                gradientColor={[250, 248, 245]}
                gradientWidth={50}
                speed={40}
                pauseOnHover={true}
                direction="left"
                style={{ direction: "ltr" }}
                className="brands-marquee"
              >
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    className="brand-marquee-item"
                    onClick={() => handleBrandClick(brand.name)}
                  >
                    <div className="brand-marquee-card">
                      {brand.logo ? (
                        <img
                          src={brand.logo}
                          alt={brand.name}
                          className="brand-marquee-logo"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : (
                        <div className="brand-marquee-fallback">
                          <span className="brand-marquee-icon">
                            {brand.icon || <i className="fas fa-tag"></i>}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </Marquee>
            ) : (
              <div className="no-brands-message">
                <div className="no-brands-icon">
                  <i className="fas fa-tag"></i>
                </div>
                <h3>لا توجد علامات تجارية</h3>
              </div>
            )}
          </div>
        </section>

        {/* Categories Section */}
        <section className="categories-section">
          <div className="section-container">
            <div className="section-header">
              <div className="section-header-content">
                <h2 className="section-title">تسوقي حسب الفئة</h2>
              </div>
              <p className="section-subtitle">
                اكتشفي مجموعتنا المتنوعة من المنتجات
              </p>
            </div>

            {loadingCategories ? (
              <div className="categories-carousel-loading">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="category-card-skeleton">
                    <div className="skeleton-category-image"></div>
                    <div className="skeleton-category-overlay"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="categories-carousel-wrapper">
                <div
                  className={`categories-carousel ${isDragging ? "dragging" : ""}`}
                  ref={categoriesRef}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onMouseMove={handleMouseMove}
                >
                  {categories.map((category) => (
                    <div key={category.id} className="category-card-modern">
                      <div className="category-card-image">
                        {category.imageUrl ? (
                          <img
                            src={category.imageUrl}
                            alt={category.name}
                            draggable="false"
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className="category-card-fallback"
                          style={{
                            display: category.imageUrl ? "none" : "flex",
                          }}
                        >
                          <i
                            className={`fas ${
                              category.name === "الوجه"
                                ? "fa-face-smile"
                                : category.name === "الشعر"
                                  ? "fa-scissors"
                                  : category.name === "الجسم"
                                    ? "fa-pump-soap"
                                    : "fa-tag"
                            }`}
                          ></i>
                        </div>
                      </div>
                      <div className="category-card-overlay">
                        <span className="category-card-count">
                          {getCategoryProductCount(category.name)} منتج
                        </span>
                        <h3 className="category-card-name">{category.name}</h3>
                        <span
                          className="category-card-cta"
                          onClick={() => handleCategoryClick(category.name)}
                        >
                          تسوقي الآن <i className="fas fa-arrow-left"></i>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {categories.length === 0 && !loadingCategories && (
              <div className="no-categories-message">
                <div className="no-categories-icon">
                  <i className="fas fa-tag"></i>
                </div>
                <h3>لا توجد فئات</h3>
              </div>
            )}
          </div>
        </section>

        {/* Featured Products Section */}
        {(loadingFeatured || featuredProducts.length > 0) && (
          <section className="featured-products-section">
            <div className="section-container">
              <div className="section-header">
                <div className="section-header-content">
                  <h2 className="section-title">المنتجات المميزة</h2>
                </div>
                <p className="section-subtitle">
                  اختيارنا من أفضل المنتجات لكِ
                </p>
              </div>

              {loadingFeatured ? (
                <div className="products-carousel-loading">
                  <div className="carousel-loading-grid">
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="product-skeleton">
                        <div className="skeleton-image"></div>
                        <div className="skeleton-content">
                          <div className="skeleton-title"></div>
                          <div className="skeleton-price"></div>
                          <div className="skeleton-button"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="products-carousel-wrapper">
                  <button
                    className="carousel-nav-btn carousel-next"
                    onClick={() => scrollFeatured("prev")}
                    aria-label="السابق"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>

                  <div className="products-carousel" ref={featuredRef}>
                    {featuredProducts.map((product) => (
                      <div key={product.id} className="carousel-product-item">
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>

                  <button
                    className="carousel-nav-btn carousel-prev"
                    onClick={() => scrollFeatured("next")}
                    aria-label="التالي"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                </div>
              )}

              <div className="section-cta">
                <button
                  className="view-all-button"
                  onClick={() => navigate("/products")}
                >
                  <span className="cta-text">عرض جميع المنتجات</span>
                  <span className="cta-arrow">←</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Most Ordered Products Section */}
        <section className="popular-products-section">
          <div className="section-container">
            <div className="section-header">
              <div className="section-header-content">
                <h2 className="section-title">الأكثر طلباً</h2>
              </div>
              <p className="section-subtitle">
                المنتجات الأكثر شعبية بين عملائنا
              </p>
            </div>

            {loadingProducts ? (
              <div className="products-carousel-loading">
                <div className="carousel-loading-grid">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="product-skeleton">
                      <div className="skeleton-image"></div>
                      <div className="skeleton-content">
                        <div className="skeleton-title"></div>
                        <div className="skeleton-price"></div>
                        <div className="skeleton-button"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {mostOrderedProducts.length > 0 ? (
                  <div className="products-carousel-wrapper">
                    <button
                      className="carousel-nav-btn carousel-next"
                      onClick={() => scrollMostOrdered("prev")}
                      aria-label="السابق"
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>

                    <div className="products-carousel" ref={mostOrderedRef}>
                      {mostOrderedProducts.map((product) => (
                        <div key={product.id} className="carousel-product-item">
                          <ProductCard product={product} />
                        </div>
                      ))}
                    </div>

                    <button
                      className="carousel-nav-btn carousel-prev"
                      onClick={() => scrollMostOrdered("next")}
                      aria-label="التالي"
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                  </div>
                ) : (
                  <div className="no-orders-message">
                    <div className="no-orders-icon">
                      <i className="fas fa-box"></i>
                    </div>
                    <h3>غير متوفر حالياً</h3>
                  </div>
                )}

                <div className="section-cta">
                  <button
                    className="view-all-button"
                    onClick={() => navigate("/products")}
                  >
                    <span className="cta-text">عرض جميع المنتجات</span>
                    <span className="cta-arrow">←</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Promotional Banner */}
        {bannerData && bannerData.isActive && (
          <section className="promotional-banner-section">
            <div className="promo-container">
              <PromotionalBanner
                backgroundImage={bannerData.backgroundImage}
                headline={bannerData.headline}
                subheading={bannerData.subheading}
                primaryButtonText={bannerData.primaryButtonText}
                secondaryButtonText={bannerData.secondaryButtonText}
                primaryButtonAction={bannerData.primaryButtonAction}
                secondaryButtonAction={bannerData.secondaryButtonAction}
              />
            </div>
          </section>
        )}

        <Footer />
      </div>
    </>
  );
}

export default Home;
