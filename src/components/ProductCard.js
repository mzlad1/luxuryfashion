import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Link } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import "../css/ProductCard.css";
import toast from "react-hot-toast";

// مكون لعرض بطاقة المنتج في صفحة المنتجات
function ProductCard({ product }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
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

    // If product has variants, show selection modal
    if (
      product.hasVariants &&
      product.variants &&
      product.variants.length > 0
    ) {
      setShowVariantModal(true);
      return;
    }

    // For regular products, add directly
    setAddingToCart(true);
    try {
      if (product.stock > 0 || product.onDemand) {
        await addToCart({
          ...product,
          quantity: 1,
        });
        // Show success toast
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        toast.error("المنتج نفذ من المخزون");
        return;
      }
    } catch (error) {
      toast.error("حدث خطأ أثناء إضافة المنتج للسلة");
    } finally {
      setAddingToCart(false);
    }
  };

  // Get the currently selected variant
  const getSelectedVariant = () => {
    if (!selectedSize && !selectedColor) return null;

    return product.variants.find((v) => {
      if (product.sizes?.length > 0 && product.colors?.length > 0) {
        // Both size and color
        return v.size === selectedSize && v.color === selectedColor;
      } else if (product.sizes?.length > 0) {
        // Only size
        return v.size === selectedSize;
      } else if (product.colors?.length > 0) {
        // Only color
        return v.color === selectedColor;
      }
      return false;
    });
  };

  // Check if selected variant is in stock
  const isSelectedVariantInStock = () => {
    const variant = getSelectedVariant();
    return variant && (parseInt(variant.stock) || 0) > 0;
  };

  // Handle adding variant to cart
  const handleAddVariantToCart = async () => {
    if (!selectedSize && !selectedColor) {
      toast.error("يرجى اختيار الحجم أو اللون");
      return;
    }

    setAddingToCart(true);
    try {
      const selectedVariant = getSelectedVariant();

      if (!selectedVariant) {
        toast.error("الخيار المحدد غير متوفر");
        setAddingToCart(false);
        return;
      }

      if ((parseInt(selectedVariant.stock) || 0) === 0) {
        toast.error("هذا الخيار نفذ من المخزون");
        setAddingToCart(false);
        return;
      }

      await addToCart({
        ...product,
        selectedVariant: selectedVariant,
        quantity: 1,
      });

      // Show success toast
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Close modal and reset selections
      setShowVariantModal(false);
      setSelectedSize("");
      setSelectedColor("");
    } catch (error) {
      toast.error("حدث خطأ أثناء إضافة المنتج للسلة");
    } finally {
      setAddingToCart(false);
    }
  };

  // Close modal
  const closeVariantModal = () => {
    setShowVariantModal(false);
    setSelectedSize("");
    setSelectedColor("");
  };

  // Prevent body scroll when modal is open and handle Escape key
  useEffect(() => {
    if (showVariantModal) {
      document.body.style.overflow = "hidden";

      // Handle Escape key
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          closeVariantModal();
        }
      };

      document.addEventListener("keydown", handleEscape);

      return () => {
        document.body.style.overflow = "unset";
        document.removeEventListener("keydown", handleEscape);
      };
    } else {
      document.body.style.overflow = "unset";
    }
  }, [showVariantModal]);

  // Render variant modal using Portal to render at document body level
  const variantModal = showVariantModal ? (
    <div className="pc-variant-modal-overlay" onClick={closeVariantModal}>
      <div className="pc-variant-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pc-variant-modal-header">
          <h3>اختر المواصفات</h3>
          <button
            className="pc-variant-modal-close"
            onClick={closeVariantModal}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="pc-variant-modal-body">
          {/* Size Selection */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="pc-variant-selection-group">
              <label className="pc-variant-label">الحجم:</label>
              <div className="pc-variant-options">
                {product.sizes.map((size) => {
                  // Check if this size has stock
                  const hasStock = product.variants.some((v) => {
                    if (product.colors?.length > 0) {
                      // If colors exist, check any color with this size
                      return v.size === size && (parseInt(v.stock) || 0) > 0;
                    } else {
                      // No colors, just check size
                      return v.size === size && (parseInt(v.stock) || 0) > 0;
                    }
                  });

                  return (
                    <button
                      key={size}
                      className={`pc-variant-option ${
                        selectedSize === size ? "selected" : ""
                      } ${!hasStock ? "disabled" : ""}`}
                      onClick={() => (hasStock ? setSelectedSize(size) : null)}
                      disabled={!hasStock}
                    >
                      {size}
                      {!hasStock && (
                        <span className="pc-variant-out-of-stock">نفذت</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Color Selection */}
          {product.colors && product.colors.length > 0 && (
            <div className="pc-variant-selection-group">
              <label className="pc-variant-label">اللون:</label>
              <div className="pc-variant-options">
                {product.colors.map((color) => {
                  // Check if this color has stock
                  const hasStock = product.variants.some((v) => {
                    if (product.sizes?.length > 0) {
                      // If sizes exist, check with selected size or any size
                      if (selectedSize) {
                        return (
                          v.color === color &&
                          v.size === selectedSize &&
                          (parseInt(v.stock) || 0) > 0
                        );
                      } else {
                        return (
                          v.color === color && (parseInt(v.stock) || 0) > 0
                        );
                      }
                    } else {
                      // No sizes, just check color
                      return v.color === color && (parseInt(v.stock) || 0) > 0;
                    }
                  });

                  return (
                    <button
                      key={color}
                      className={`pc-variant-option ${
                        selectedColor === color ? "selected" : ""
                      } ${!hasStock ? "disabled" : ""}`}
                      onClick={() =>
                        hasStock ? setSelectedColor(color) : null
                      }
                      disabled={!hasStock}
                    >
                      {color}
                      {!hasStock && (
                        <span className="pc-variant-out-of-stock">نفذت</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected variant info */}
          {((selectedSize && product.sizes?.length > 0) ||
            (selectedColor && product.colors?.length > 0)) && (
            <div className="pc-variant-selected-info">
              {(() => {
                const variant = product.variants.find((v) => {
                  if (product.sizes?.length > 0 && product.colors?.length > 0) {
                    return v.size === selectedSize && v.color === selectedColor;
                  } else if (product.sizes?.length > 0) {
                    return v.size === selectedSize;
                  } else if (product.colors?.length > 0) {
                    return v.color === selectedColor;
                  }
                  return false;
                });

                if (variant) {
                  const inStock = (parseInt(variant.stock) || 0) > 0;
                  return (
                    <div className="pc-variant-info-content">
                      <div className="pc-variant-price-section">
                        <span className="pc-variant-info-label">السعر:</span>
                        <span className="pc-variant-info-value">
                          {variant.price} شيكل
                        </span>
                      </div>
                      <div
                        className={`pc-variant-stock-section ${inStock ? "in-stock" : "out-of-stock"}`}
                      >
                        <span className="pc-variant-info-label">الحالة:</span>
                        <span className="pc-variant-stock-badge">
                          {inStock ? (
                            <>
                              <i className="fas fa-check-circle"></i>
                              <span>متوفر</span>
                            </>
                          ) : (
                            <>
                              <i className="fas fa-times-circle"></i>
                              <span>غير متوفر</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>

        <div className="pc-variant-modal-footer">
          <button className="pc-variant-cancel-btn" onClick={closeVariantModal}>
            إلغاء
          </button>
          <button
            className="pc-variant-add-btn"
            onClick={handleAddVariantToCart}
            disabled={
              addingToCart ||
              (!selectedSize && product.sizes?.length > 0) ||
              (!selectedColor && product.colors?.length > 0) ||
              !isSelectedVariantInStock()
            }
          >
            {addingToCart ? (
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
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Render modal at document body level using Portal */}
      {variantModal && ReactDOM.createPortal(variantModal, document.body)}

      <Link
        to={`/products/${product.id}`}
        className="pc-card pc-card--clickable"
      >
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

          {/* Product Image */}
          <img
            src={
              product.images && product.images.length > 0
                ? product.images[0]
                : ""
            }
            alt={product.name}
            className="pc-image"
            loading="lazy"
          />

          {/* Image Overlay for hover effect */}
          <div className="pc-image-overlay"></div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="pc-badges-container">
              {badges.map((badge) => (
                <div
                  key={badge.type}
                  className={`pc-badge pc-badge--${badge.type}`}
                >
                  {badge.text}
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions (visible on hover) */}
          <div className="pc-quick-actions">
            <button
              className="pc-quick-action-btn"
              onClick={handleAddToCart}
              disabled={
                addingToCart ||
                badges.some((badge) => badge.type === "sold-out") ||
                isAdmin
              }
              title={
                isAdmin
                  ? "أنت أدمن"
                  : addingToCart
                    ? "جاري الإضافة..."
                    : "أضف للسلة"
              }
            >
              {addingToCart ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-shopping-bag"></i>
              )}
            </button>
            <button
              className="pc-quick-action-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/products/${product.id}`;
              }}
              title="عرض سريع"
            >
              <i className="fas fa-eye"></i>
            </button>
          </div>
        </div>

        {/* Card Content */}
        <div className="pc-content">
          {/* Product Name */}
          <h3 className="pc-name">{product.name}</h3>

          {/* Price Container */}
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
                    {(() => {
                      const prices = product.variants?.map(
                        (v) => parseFloat(v.price) || 0,
                      ) || [0];
                      const originalPrices = product.variants?.map(
                        (v) => parseFloat(v.originalPrice || v.price) || 0,
                      ) || [0];
                      const minPrice = Math.min(...prices);
                      const minOriginal = Math.min(...originalPrices);
                      const discount = Math.round(
                        ((minOriginal - minPrice) / minOriginal) * 100,
                      );
                      return discount > 0 ? (
                        <span className="pc-discount-percent">
                          -{discount}%
                        </span>
                      ) : null;
                    })()}
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
                {(() => {
                  const discount = Math.round(
                    ((product.originalPrice - product.price) /
                      product.originalPrice) *
                      100,
                  );
                  return discount > 0 ? (
                    <span className="pc-discount-percent">-{discount}%</span>
                  ) : null;
                })()}
              </div>
            ) : (
              <p className="pc-price">{product.price} شيكل</p>
            )}
          </div>
        </div>

        {/* Add to Cart Button */}
        {/* <button
          className="pc-add-to-cart-btn"
          onClick={handleAddToCart}
          disabled={
            addingToCart ||
            badges.some((badge) => badge.type === "sold-out") ||
            isAdmin
          }
          title={
            isAdmin
              ? "أنت أدمن ولا يمكنك التسوق"
              : addingToCart
                ? "جاري الإضافة..."
                : "أضف للسلة"
          }
        >
          {isAdmin ? (
            <>
              <i className="fas fa-lock"></i>
              <span>أنت أدمن</span>
            </>
          ) : addingToCart ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              <span>جاري الإضافة...</span>
            </>
          ) : badges.some((badge) => badge.type === "sold-out") ? (
            <>
              <i className="fas fa-times-circle"></i>
              <span>نفذت الكمية</span>
            </>
          ) : (
            <>
              <i className="fas fa-shopping-cart"></i>
              <span>أضف للسلة</span>
            </>
          )}
        </button> */}
      </Link>
    </>
  );
}

export default ProductCard;
