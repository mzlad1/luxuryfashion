import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import "../css/ProductCard.css";

// مكون لعرض بطاقة المنتج في صفحة المنتجات
function ProductCard({ product }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { addToCart } = useCart();

  // Check if user is admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
    });
    return () => unsubscribe();
  }, []);

  // Countdown timer for discounts
  useEffect(() => {
    if (!product.hasDiscount || !product.discountExpiresAt) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expiryDate = new Date(product.discountExpiresAt.seconds * 1000);
      const difference = expiryDate - now;

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
  }, [product.discountExpiresAt, product.hasDiscount]);

  // Determine which badges to show
  const getBadges = () => {
    const badges = [];

    // Check if sold out (stock is 0 or null)
    let isSoldOut = false;

    if (product.hasVariants) {
      // For variant products, check total stock from all variants
      const totalStock =
        product.variants?.reduce(
          (sum, v) => sum + (parseInt(v.stock) || 0),
          0,
        ) || 0;
      isSoldOut = totalStock === 0;
    } else {
      // For regular products, check product stock
      isSoldOut = !product.stock || product.stock === 0;
    }

    if (isSoldOut) {
      badges.push({ text: "بيعت كلها", type: "sold-out" });
    }

    if (product.onDemand) {
      badges.push({
        text: "على الطلب (توصيل خلال 2-3 أسابيع)",
        type: "on-demand",
      });
    }

    if (product.isNew) {
      badges.push({ text: "جديد", type: "new" });
    }

    // Add discount badge if product has discount
    if (product.hasDiscount && product.discountName) {
      badges.push({ text: product.discountName, type: "discount" });
    }

    return badges;
  };

  const badges = getBadges();

  // Handle adding product to cart
  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (addingToCart || isAdmin) return;

    setAddingToCart(true);
    try {
      // For variant products, we'll add the first available variant
      // For regular products, add directly
      if (
        product.hasVariants &&
        product.variants &&
        product.variants.length > 0
      ) {
        // Find first variant with stock
        const availableVariant = product.variants.find(
          (v) => (parseInt(v.stock) || 0) > 0,
        );
        if (availableVariant) {
          await addToCart({
            ...product,
            selectedVariant: availableVariant,
            quantity: 1,
          });
          // Show success toast
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        } else {
          // All variants out of stock
          alert("جميع الأحجام نفذت من المخزون");
          return;
        }
      } else {
        // Regular product
        if (product.stock > 0 || product.onDemand) {
          await addToCart({
            ...product,
            quantity: 1,
          });
          // Show success toast
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        } else {
          alert("المنتج نفذ من المخزون");
          return;
        }
      }
    } catch (error) {
      alert("حدث خطأ أثناء إضافة المنتج للسلة");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <Link to={`/products/${product.id}`} className="pc-card pc-card--clickable">
      {/* Success Toast Notification */}
      {showToast && (
        <div className="pc-toast-overlay">
          <div className="pc-toast">
            <span className="pc-toast-icon">
              <i className="fas fa-check-circle"></i>
            </span>
            <span className="pc-toast-text">تم إضافة المنتج للسلة!</span>
          </div>
        </div>
      )}

      <div className="pc-image-container">
        {/* Countdown Timer - Overlay on Image */}
        {product.hasDiscount && timeLeft && (
          <div className="pc-countdown-overlay">
            <div className="pc-countdown-timer-overlay">
              <div className="pc-timer-display-overlay">
                {timeLeft.days > 0 && (
                  <span className="pc-timer-unit-overlay">
                    <span className="pc-timer-value-overlay">
                      {timeLeft.days}
                    </span>
                    <span className="pc-timer-label-small-overlay">يوم</span>
                  </span>
                )}
                <span className="pc-timer-unit-overlay">
                  <span className="pc-timer-value-overlay">
                    {timeLeft.hours.toString().padStart(2, "0")}
                  </span>
                  <span className="pc-timer-label-small-overlay">ساعة</span>
                </span>
                <span className="pc-timer-unit-overlay">
                  <span className="pc-timer-value-overlay">
                    {timeLeft.minutes.toString().padStart(2, "0")}
                  </span>
                  <span className="pc-timer-label-small-overlay">دقيقة</span>
                </span>
                <span className="pc-timer-unit-overlay">
                  <span className="pc-timer-value-overlay">
                    {timeLeft.seconds.toString().padStart(2, "0")}
                  </span>
                  <span className="pc-timer-label-small-overlay">ثانية</span>
                </span>
              </div>
            </div>
          </div>
        )}

        <img
          src={
            product.images && product.images.length > 0 ? product.images[0] : ""
          }
          alt={product.name}
          className="pc-image"
          loading="lazy"
        />
        {badges.length > 0 && (
          <div className="pc-badges-container">
            {badges.map((badge, index) => (
              <div
                key={badge.type}
                className={`pc-badge pc-badge--${badge.type}`}
                style={{ top: `${8 + index * 32}px` }}
              >
                {badge.text}
              </div>
            ))}
          </div>
        )}
      </div>
      <h3 className="pc-name">{product.name}</h3>

      <div className="pc-price-container">
        {product.hasVariants ? (
          <>
            {product.hasDiscount ? (
              <div className="pc-price-wrapper">
                <span className="pc-price pc-price--discounted">
                  {(() => {
                    const prices = product.variants?.map(
                      (v) => parseFloat(v.price) || 0,
                    ) || [0];
                    const minPrice = Math.min(...prices);
                    return `${minPrice} شيكل`;
                  })()}
                </span>
                <span className="pc-price pc-price--original">
                  {(() => {
                    const originalPrices = product.variants?.map(
                      (v) => parseFloat(v.originalPrice || v.price) || 0,
                    ) || [0];
                    const minOriginalPrice = Math.min(...originalPrices);
                    return `${minOriginalPrice} شيكل`;
                  })()}
                </span>
              </div>
            ) : (
              <div className="pc-price pc-price--variants">
                {(() => {
                  const prices = product.variants?.map(
                    (v) => parseFloat(v.price) || 0,
                  ) || [0];
                  const minPrice = Math.min(...prices);
                  return `${minPrice} شيكل`;
                })()}
              </div>
            )}
          </>
        ) : product.hasDiscount && product.originalPrice ? (
          <div className="pc-price-wrapper">
            <span className="pc-price pc-price--discounted">
              {product.price} شيكل
            </span>
            <span className="pc-price pc-price--original">
              {product.originalPrice} شيكل
            </span>
          </div>
        ) : (
          <p className="pc-price">{product.price} شيكل</p>
        )}
      </div>
      {/* Add to Cart Button */}
      <button
        className="pc-add-to-cart-btn"
        onClick={handleAddToCart}
        disabled={
          addingToCart ||
          badges.some((badge) => badge.type === "sold-out") ||
          isAdmin
        }
        title={
          isAdmin
            ? "المديرون لا يمكنهم التسوق"
            : addingToCart
              ? "جاري الإضافة..."
              : "أضف للسلة"
        }
      >
        {isAdmin ? (
          <>
            <i className="fas fa-lock"></i>
            <span>محظور للمديرين</span>
          </>
        ) : addingToCart ? (
          <>
            <i className="fas fa-hourglass-half"></i>
            <span>جاري الإضافة...</span>
          </>
        ) : (
          <>
            <i className="fas fa-shopping-cart"></i>
            <span>أضف للسلة</span>
          </>
        )}
      </button>
    </Link>
  );
}

export default ProductCard;
