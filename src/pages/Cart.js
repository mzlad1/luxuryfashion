import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../css/Cart.css";
import { useCart } from "../contexts/CartContext";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  Timestamp,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  runTransaction,
} from "firebase/firestore";
import Footer from "../components/Footer";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import emailjs from "@emailjs/browser";
import { EMAILJS_CONFIG } from "../config/emailjs";
import { Link } from "react-router-dom";

// صفحة سلة المشتريات والدفع
function Cart() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [stockIssues, setStockIssues] = useState([]);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailValid, setEmailValid] = useState(true);

  // Delivery options
  const [selectedDelivery, setSelectedDelivery] = useState("");
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const deliveryOptions = [
    { id: "westbank", name: "الضفة الغربية", price: 20 },
    { id: "jerusalem", name: "القدس", price: 30 },
    { id: "inside", name: "الداخل المحتل", price: 70 },
    { id: "abughosh", name: "أبو غوش/القسطل/عين ناقوبة/أبو رافة", price: 45 },
  ];

  // Validate email format
  const validateEmail = (emailValue) => {
    if (!emailValue || emailValue.trim() === "") {
      setEmailValid(true); // Empty email is valid (optional)
      return true;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(emailValue.trim());
    setEmailValid(isValid);
    return isValid;
  };

  // Apply coupon
  const applyCoupon = async () => {
    if (!couponCode || couponCode.trim() === "") {
      setCouponError("يرجى إدخال رمز الكوبون");
      return;
    }

    setCouponLoading(true);
    setCouponError("");

    try {
      const couponsSnapshot = await getDocs(collection(db, "coupons"));
      let foundCoupon = null;

      couponsSnapshot.forEach((doc) => {
        const couponData = doc.data();
        if (couponData.code === couponCode.toUpperCase().trim()) {
          foundCoupon = { id: doc.id, ...couponData };
        }
      });

      if (!foundCoupon) {
        setCouponError("رمز الكوبون غير صحيح");
        setCouponLoading(false);
        return;
      }

      // Check if coupon is active
      if (!foundCoupon.isActive) {
        setCouponError("هذا الكوبون غير نشط");
        setCouponLoading(false);
        return;
      }

      // Check if coupon is expired
      if (foundCoupon.expiresAt) {
        const expiryDate = new Date(foundCoupon.expiresAt.seconds * 1000);
        if (expiryDate < new Date()) {
          setCouponError("هذا الكوبون منتهي الصلاحية");
          setCouponLoading(false);
          return;
        }
      }

      // Check usage limit
      if (foundCoupon.usageLimit) {
        const usedCount = foundCoupon.usedCount || 0;
        if (usedCount >= foundCoupon.usageLimit) {
          setCouponError("تم استنفاد هذا الكوبون");
          setCouponLoading(false);
          return;
        }
      }

      // Check minimum purchase
      if (foundCoupon.minPurchase && subtotal < foundCoupon.minPurchase) {
        setCouponError(
          `الحد الأدنى للشراء هو ${foundCoupon.minPurchase} شيكل`
        );
        setCouponLoading(false);
        return;
      }

      // Check if coupon can be applied to discounted products
      if (!foundCoupon.allowOnDiscounted) {
        const hasDiscountedItems = cartItems.some((item) => item.hasDiscount);
        if (hasDiscountedItems) {
          setCouponError("لا يمكن تطبيق هذا الكوبون على منتجات مخفضة");
          setCouponLoading(false);
          return;
        }
      }

      // Apply coupon
      setAppliedCoupon(foundCoupon);
      setCouponError("");
    } catch (error) {
      setCouponError("حدث خطأ في تطبيق الكوبون");
    } finally {
      setCouponLoading(false);
    }
  };

  // Remove coupon
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  // Send order confirmation email
  const sendOrderConfirmationEmail = async (orderData) => {
    // If no email provided, don't send email
    if (!orderData.customerEmail || orderData.customerEmail.trim() === "") {
      return true; // Return true to indicate "success" (no email needed)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(orderData.customerEmail.trim())) {
      return true; // Return true to indicate "success" (no email needed)
    }

    setEmailLoading(true);
    setEmailError("");

    try {
      // Check if EmailJS is properly configured
      if (
        !EMAILJS_CONFIG.publicKey ||
        EMAILJS_CONFIG.publicKey === "YOUR_PUBLIC_KEY_HERE"
      ) {
        throw new Error("EmailJS not configured. Please add your public key.");
      }

      // Prepare email template variables
      const templateParams = {
        order_id: orderData.id || "N/A", // Changed to match template
        orderDate: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        customerName: orderData.customerName || "N/A",
        email: orderData.customerEmail || "N/A",
        customerPhone: orderData.customerPhone || "N/A",
        customerAddress: orderData.customerAddress || "N/A",
        // Create simple order items for the template
        orders: orderData.items.map((item) => {
          const itemPrice =
            item.selectedVariant && item.selectedVariant.price
              ? parseFloat(item.selectedVariant.price)
              : item.price;
          const totalPrice = (itemPrice * item.quantity).toFixed(2);

          return {
            units: item.quantity, // Changed to match template
            price: itemPrice.toFixed(2),
            total: totalPrice, // Add calculated total for each item
            // Add variant info to name if exists
            name: item.selectedVariant
              ? `${item.name} (${item.selectedVariant.size} - ${item.selectedVariant.color})`
              : item.name,
          };
        }),
        deliveryOption: orderData.deliveryOption || "N/A",
        deliveryFee: orderData.deliveryFee || 0,
        subtotal: orderData.subtotal || 0,
        couponCode: orderData.coupon ? orderData.coupon.code : "لا يوجد",
        couponDiscount: orderData.coupon ? orderData.coupon.couponDiscount : 0,
        finalTotal: orderData.total || 0,
        // Add cost object for template
        cost: {
          shipping: orderData.deliveryFee || 0,
          tax: 0, // We don't have tax
          total: orderData.total || 0,
        },
      };

      // Debug: Log the template parameters

      // Send email using EmailJS
      const response = await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        templateParams,
        EMAILJS_CONFIG.publicKey,
      );

      setEmailSent(true);
      return true;
    } catch (error) {
      setEmailError(error.message || "فشل في إرسال تأكيد الطلب");
      return false;
    } finally {
      setEmailLoading(false);
    }
  };

  const deliveryFee = selectedDelivery
    ? deliveryOptions.find((option) => option.id === selectedDelivery)?.price ||
      0
    : 0;

  const totalPrice = cartItems.reduce((total, item) => {
    let itemPrice = item.price;

    // If item has a selected variant, use variant price
    if (item.selectedVariant && item.selectedVariant.price) {
      itemPrice = parseFloat(item.selectedVariant.price) || 0;
    }

    return total + itemPrice * item.quantity;
  }, 0);

  const subtotal = totalPrice;
  
  // Calculate coupon discount
  let couponDiscount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discountType === "percentage") {
      couponDiscount = (subtotal * appliedCoupon.discountValue) / 100;
      // Apply max discount limit if set
      if (appliedCoupon.maxDiscount && couponDiscount > appliedCoupon.maxDiscount) {
        couponDiscount = appliedCoupon.maxDiscount;
      }
    } else {
      // Fixed discount
      couponDiscount = appliedCoupon.discountValue;
    }
    // Ensure discount doesn't exceed subtotal
    couponDiscount = Math.min(couponDiscount, subtotal);
  }
  
  const finalTotal = subtotal - couponDiscount + deliveryFee;

  // Check stock availability before checkout
  const checkStockAvailability = async () => {
    const issues = [];

    try {
      for (const item of cartItems) {
        const productRef = doc(db, "products", item.id);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          issues.push({
            ...item,
            issue: "المنتج غير متوفر",
            availableStock: 0,
          });
        } else {
          const productData = productSnap.data();
          let currentStock = 0;

          if (productData.hasVariants && item.selectedVariant) {
            // For variant products, check the specific variant stock
            const variant = productData.variants?.find(
              (v) =>
                v.size === item.selectedVariant.size &&
                v.color === item.selectedVariant.color,
            );
            currentStock = variant ? parseInt(variant.stock) || 0 : 0;
          } else {
            // For regular products, check product stock
            currentStock = productData.stock || 0;
          }

          if (currentStock < item.quantity) {
            issues.push({
              ...item,
              issue: "الكمية المطلوبة أكبر من المتوفر",
              availableStock: currentStock,
            });
          }
        }
      }
    } catch (error) {}

    return issues;
  };

  // Handle checkout button click - check stock first
  const handleCheckoutClick = async () => {
    const issues = await checkStockAvailability();

    if (issues.length > 0) {
      setStockIssues(issues);
      setShowStockModal(true);
    } else {
      // Show invoice preview instead of going directly to checkout
      setShowInvoicePreview(true);
    }
  };

  // Adjust quantities to available stock
  const adjustQuantities = () => {
    stockIssues.forEach((issue) => {
      if (issue.availableStock > 0) {
        updateQuantity(issue.cartItemId || issue.id, issue.availableStock);
      } else {
        removeFromCart(issue.cartItemId || issue.id);
      }
    });
    setShowStockModal(false);
    setStockIssues([]);
  };

  // Contact support (you can modify this to open WhatsApp, email, etc.)
  const contactSupport = () => {
    // Example: Open WhatsApp or email
    const message = `مرحبا، أحتاج مساعدة بخصوص المنتجات التالية:\n\n${stockIssues
      .map(
        (issue) =>
          `- ${issue.name}: طلبت ${issue.quantity} والمتوفر ${issue.availableStock}`,
      )
      .join("\n")}\n\nهل يمكنكم اقتراح بدائل مشابهة؟`;

    const whatsappUrl = `https://wa.me/972592806088?text=${encodeURIComponent(
      message,
    )}`;
    window.open(whatsappUrl, "_blank");

    setShowStockModal(false);
    setStockIssues([]);
  };

  // Proceed to checkout after invoice preview
  const proceedToCheckout = () => {
    if (!selectedDelivery) {
      setError("يرجى اختيار خيار التوصيل");
      return;
    }
    setShowInvoicePreview(false);
    setShowCheckout(true);
    setError("");
  };

  // Reset delivery selection when closing invoice preview
  const handleCloseInvoicePreview = () => {
    setShowInvoicePreview(false);
    setSelectedDelivery(""); // Reset delivery selection
    setError("");
  };

  // Reset delivery selection when completing order
  const handleOrderComplete = () => {
    setSelectedDelivery(""); // Reset delivery selection
    setShowCheckout(false);
    setShowInvoicePreview(false);
  };

  // Reset delivery selection when going back from checkout to invoice preview
  const handleBackToInvoicePreview = () => {
    setShowCheckout(false);
    // Keep the delivery selection when going back to invoice preview
    setError("");
  };

  // Reset delivery selection when going back to cart from checkout
  const handleBackToCartFromCheckout = () => {
    setShowCheckout(false);
    setSelectedDelivery(""); // Reset delivery selection
    setError("");
  };

  // التعامل مع إرسال الطلب وتحديث المخزون
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    // Validate email format if provided
    if (email && email.trim() !== "") {
      if (!validateEmail(email)) {
        setError("يرجى إدخال بريد إلكتروني صحيح أو ترك الحقل فارغاً");
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError("");
    try {
      // Use Firestore transaction to ensure data consistency
      const result = await runTransaction(db, async (transaction) => {
        // First, check stock availability for all items
        const stockChecks = [];
        for (const item of cartItems) {
          const productRef = doc(db, "products", item.id);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(`المنتج ${item.name} غير موجود`);
          }

          const productData = productSnap.data();
          let currentStock = 0;
          let stockUpdateData = {};

          if (productData.hasVariants && item.selectedVariant) {
            // For variant products, check and update specific variant stock
            const variant = productData.variants?.find(
              (v) =>
                v.size === item.selectedVariant.size &&
                v.color === item.selectedVariant.color,
            );

            if (!variant) {
              throw new Error(
                `المتغير ${item.selectedVariant.size} - ${item.selectedVariant.color} غير متوفر للمنتج ${item.name}`,
              );
            }

            currentStock = parseInt(variant.stock) || 0;
            if (currentStock < item.quantity) {
              throw new Error(
                `المخزون المتاح للمنتج ${item.name} (${item.selectedVariant.size} - ${item.selectedVariant.color}) هو ${currentStock} فقط، ولكن طلبت ${item.quantity}`,
              );
            }

            // Update the specific variant stock
            const updatedVariants = productData.variants.map((v) => {
              if (
                v.size === item.selectedVariant.size &&
                v.color === item.selectedVariant.color
              ) {
                return {
                  ...v,
                  stock: Math.max(0, parseInt(v.stock) - item.quantity),
                };
              }
              return v;
            });

            stockUpdateData = { variants: updatedVariants };
          } else {
            // For regular products, check and update product stock
            currentStock = productData.stock || 0;
            if (currentStock < item.quantity) {
              throw new Error(
                `المخزون المتاح للمنتج ${item.name} هو ${currentStock} فقط، ولكن طلبت ${item.quantity}`,
              );
            }
            stockUpdateData = {
              stock: Math.max(0, currentStock - item.quantity),
            };
          }

          stockChecks.push({
            ref: productRef,
            updateData: stockUpdateData,
          });
        }

        // If all stock checks pass, create the order
        const orderData = {
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          customerAddress: address,
          items: cartItems,
          subtotal: subtotal,
          deliveryFee: deliveryFee,
          deliveryOption:
            deliveryOptions.find((option) => option.id === selectedDelivery)
              ?.name || "",
          coupon: appliedCoupon
            ? {
                code: appliedCoupon.code,
                discountType: appliedCoupon.discountType,
                discountValue: appliedCoupon.discountValue,
                couponDiscount: couponDiscount,
              }
            : null,
          total: finalTotal,
          status: "قيد الانتظار",
          createdAt: Timestamp.now(),
        };

        const orderRef = doc(collection(db, "orders"));
        transaction.set(orderRef, orderData);

        // Update stock for all products
        stockChecks.forEach(({ ref, updateData }) => {
          transaction.update(ref, updateData);
        });

        // Update coupon usage count
        if (appliedCoupon) {
          const couponRef = doc(db, "coupons", appliedCoupon.id);
          const currentUsedCount = appliedCoupon.usedCount || 0;
          transaction.update(couponRef, {
            usedCount: currentUsedCount + 1,
          });
        }

        return { id: orderRef.id, ...orderData };
      });

      // Transaction successful
      setOrderId(result.id);
      setShowCheckout(false);
      setSelectedDelivery(""); // Reset delivery selection

      // Send order confirmation email
      const emailResult = await sendOrderConfirmationEmail(result);
      if (emailResult) {
        if (result.customerEmail && result.customerEmail.trim() !== "") {
          setEmailSent(true);
        } else {
          setEmailSent(false);
        }
      } else {
        setEmailSent(false);
      }

      clearCart();
      setName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setAppliedCoupon(null);
      setCouponCode("");
      setCouponError("");
    } catch (error) {
      setError(error.message || "حدث خطأ أثناء معالجة الطلب");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  // Check if user is admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Redirect admin users away from cart
    if (isAdmin) {
      setTimeout(() => {
        navigate("/admin/dashboard");
      }, 3000);
    }
  }, [isAdmin, navigate]);

  // Show admin access denied message
  if (isAdmin) {
    return (
      <>
        <Navbar />
        <div className="cart-page">
          <div className="ct-container">
            <div className="ct-error">
              <span>
                <i className="fas fa-lock"></i>
              </span>
              <span>
                المديرون لا يمكنهم الوصول لصفحة السلة. سيتم توجيهك للوحة
                التحكم...
              </span>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="cart-page">
        <h1>سلة المشتريات</h1>

        {error && (
          <div className="ct-error">
            <span>
              <i className="fas fa-exclamation-triangle"></i>
            </span>
            <span>{error}</span>
          </div>
        )}

        {cartItems.length === 0 ? (
          <p className="ct-empty">عربة التسوق فارغة.</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="ct-table-container">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th>الصورة</th>
                    <th>المنتج</th>
                    <th>السعر</th>
                    <th>الكمية</th>
                    <th>المجموع</th>
                    <th>إزالة</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((item) => (
                    <tr key={item.cartItemId || item.id}>
                      <td data-label="الصورة">
                        <div className="ct-product-image">
                          {item.images && item.images.length > 0 ? (
                            <>
                              <img
                                src={item.images[0]}
                                alt={item.name}
                                className="ct-product-thumbnail"
                                loading="lazy"
                                onClick={() => {
                                  setSelectedImage(item.images[0]);
                                  setShowImageModal(true);
                                }}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  if (e.target.nextSibling) {
                                    e.target.nextSibling.style.display = "flex";
                                  }
                                }}
                              />
                              <div
                                className="ct-no-image"
                                style={{ display: "none" }}
                              >
                                <span className="ct-no-image-icon">
                                  <i className="fas fa-camera"></i>
                                </span>
                                <span className="ct-no-image-text">
                                  لا توجد صورة
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="ct-no-image">
                              <span className="ct-no-image-icon">
                                <i className="fas fa-camera"></i>
                              </span>
                              <span className="ct-no-image-text">
                                لا توجد صورة
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td data-label="المنتج">
                        <Link
                          to={`/products/${item.id}`}
                          className="ct-product-name-link"
                        >
                          {item.name}
                        </Link>
                      </td>
                      <td data-label="السعر">
                        {item.selectedVariant && item.selectedVariant.price
                          ? `${parseFloat(item.selectedVariant.price)} شيكل`
                          : `${item.price} شيكل`}
                        {item.selectedVariant && (
                          <div className="ct-variant-info">
                            <small>
                              {item.selectedVariant.size} -{" "}
                              {item.selectedVariant.color}
                            </small>
                          </div>
                        )}
                      </td>
                      <td data-label="الكمية">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          className="ct-qty-input"
                          onChange={(e) =>
                            updateQuantity(
                              item.cartItemId || item.id,
                              parseInt(e.target.value),
                            )
                          }
                        />
                      </td>
                      <td data-label="المجموع">
                        {(() => {
                          const itemPrice =
                            item.selectedVariant && item.selectedVariant.price
                              ? parseFloat(item.selectedVariant.price)
                              : item.price;
                          return `${itemPrice * item.quantity} شيكل`;
                        })()}
                      </td>
                      <td data-label="إزالة">
                        <button
                          className="ct-remove-btn"
                          onClick={() =>
                            removeFromCart(item.cartItemId || item.id)
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="ct-mobile-cards">
              {cartItems.map((item) => (
                <div
                  key={item.cartItemId || item.id}
                  className="ct-mobile-card"
                >
                  <div className="ct-mobile-card-header">
                    <div className="ct-mobile-product-image">
                      {item.images && item.images.length > 0 ? (
                        <>
                          <img
                            src={item.images[0]}
                            alt={item.name}
                            className="ct-mobile-thumbnail"
                            loading="lazy"
                            onClick={() => {
                              setSelectedImage(item.images[0]);
                              setShowImageModal(true);
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = "flex";
                              }
                            }}
                          />
                          <div
                            className="ct-mobile-no-image"
                            style={{ display: "none" }}
                          >
                            <span className="ct-mobile-no-image-icon">
                              <i className="fas fa-camera"></i>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="ct-mobile-no-image">
                          <span className="ct-mobile-no-image-icon">
                            <i className="fas fa-camera"></i>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ct-mobile-product-info">
                      <h4 className="ct-mobile-product-name">
                        <Link
                          to={`/products/${item.id}`}
                          className="ct-product-name-link"
                        >
                          {item.name}
                        </Link>
                      </h4>
                      <div className="ct-mobile-price">
                        {item.selectedVariant && item.selectedVariant.price
                          ? `${parseFloat(item.selectedVariant.price)} شيكل`
                          : `${item.price} شيكل`}
                      </div>
                      {item.selectedVariant && (
                        <div className="ct-mobile-variant">
                          <span className="ct-mobile-variant-size">
                            {item.selectedVariant.size}
                          </span>
                          <span className="ct-mobile-variant-color">
                            {item.selectedVariant.color}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      className="ct-mobile-remove-btn"
                      onClick={() => removeFromCart(item.cartItemId || item.id)}
                      aria-label="إزالة المنتج"
                    >
                      ×
                    </button>
                  </div>

                  <div className="ct-mobile-card-actions">
                    <div className="ct-mobile-quantity">
                      <label>الكمية:</label>
                      <div className="ct-mobile-qty-controls">
                        <button
                          className="ct-mobile-qty-btn"
                          onClick={() => {
                            const newQty = Math.max(1, item.quantity - 1);
                            updateQuantity(item.cartItemId || item.id, newQty);
                          }}
                          disabled={item.quantity <= 1}
                        >
                          -
                        </button>
                        <span className="ct-mobile-qty-value">
                          {item.quantity}
                        </span>
                        <button
                          className="ct-mobile-qty-btn"
                          onClick={() => {
                            updateQuantity(
                              item.cartItemId || item.id,
                              item.quantity + 1,
                            );
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="ct-mobile-total">
                      <span>المجموع:</span>
                      <strong>
                        {(() => {
                          const itemPrice =
                            item.selectedVariant && item.selectedVariant.price
                              ? parseFloat(item.selectedVariant.price)
                              : item.price;
                          return `${itemPrice * item.quantity} شيكل`;
                        })()}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="ct-summary">
          <p>
            <strong>الإجمالي:</strong> {finalTotal} شيكل
          </p>
          <button
            className="ct-open-checkout-btn"
            onClick={handleCheckoutClick}
            disabled={cartItems.length === 0}
          >
            إتمام الشراء
          </button>
        </div>

        {/* Success message */}
        {orderId && (
          <div className="ct-success">
            <p>
              تم إرسال طلبك بنجاح! رقم الطلب:
              <span className="ct-order-code">#{orderId}</span>
              <button
                type="button"
                className="ct-copy-btn"
                onClick={handleCopyOrderId}
                aria-label="نسخ رقم الطلب"
              >
                {copied ? "تم النسخ" : "نسخ"}
              </button>
            </p>
            {emailLoading && (
              <p className="ct-email-loading">
                <i className="fas fa-envelope"></i> جاري إرسال تأكيد الطلب...
              </p>
            )}
            {emailSent && email && email.trim() !== "" && (
              <p className="ct-email-sent">
                <i className="fas fa-check-circle"></i> تم إرسال تأكيد الطلب إلى
                بريدك الإلكتروني
              </p>
            )}
            {!emailSent && email && email.trim() !== "" && (
              <p className="ct-email-not-sent">
                <i className="fas fa-info-circle"></i> لم يتم إرسال تأكيد الطلب
                عبر البريد الإلكتروني
              </p>
            )}
            {!emailSent && (!email || email.trim() === "") && (
              <p className="ct-email-not-provided">
                <i className="fas fa-info-circle"></i> لم يتم إرسال تأكيد الطلب
                عبر البريد الإلكتروني (لم يتم توفير بريد إلكتروني)
              </p>
            )}
            {emailError && (
              <p className="ct-email-error">
                <i className="fas fa-exclamation-triangle"></i> {emailError}
              </p>
            )}
          </div>
        )}

        {/* Stock Issues Modal */}
        {showStockModal && (
          <div
            className="ct-modal-overlay"
            onClick={(e) => {
              if (e.target.classList.contains("ct-modal-overlay")) {
                setShowStockModal(false);
              }
            }}
          >
            <div className="ct-modal" role="dialog" aria-modal="true">
              <button
                className="ct-modal-close"
                onClick={() => setShowStockModal(false)}
                aria-label="إغلاق"
              >
                ×
              </button>
              <h2>مشكلة في المخزون</h2>

              <div className="ct-stock-issues">
                <p className="ct-stock-warning">
                  <i className="fas fa-exclamation-triangle"></i> بعض المنتجات
                  في سلتك غير متوفرة بالكمية المطلوبة:
                </p>

                {stockIssues.map((issue) => (
                  <div key={issue.id} className="ct-stock-issue-item">
                    <div className="ct-issue-info">
                      <h4>{issue.name}</h4>
                      <p>
                        الكمية المطلوبة:{" "}
                        <span className="ct-requested">{issue.quantity}</span>
                      </p>
                      <p>
                        المتوفر في المخزون:{" "}
                        <span className="ct-available">
                          {issue.availableStock}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}

                <div className="ct-stock-options">
                  <p>يمكنك اختيار إحدى الخيارات التالية:</p>

                  <div className="ct-stock-buttons">
                    <button
                      className="ct-adjust-btn"
                      onClick={adjustQuantities}
                    >
                      تعديل الكميات حسب المتوفر
                    </button>

                    <button className="ct-contact-btn" onClick={contactSupport}>
                      تواصلي معنا لاقتراح بدائل
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Preview Modal */}
        {showInvoicePreview && (
          <div
            className="ct-modal-overlay"
            onClick={(e) => {
              if (e.target.classList.contains("ct-modal-overlay")) {
                handleCloseInvoicePreview();
              }
            }}
          >
            <div
              className="ct-modal ct-invoice-modal"
              role="dialog"
              aria-modal="true"
            >
              <button
                className="ct-modal-close"
                onClick={handleCloseInvoicePreview}
                aria-label="إغلاق"
              >
                ×
              </button>
              <h2>مراجعة الفاتورة</h2>

              {error && (
                <div className="ct-error">
                  <span>
                    <i className="fas fa-exclamation-triangle"></i>
                  </span>
                  <span>{error}</span>
                </div>
              )}

              <div className="ct-invoice-content">
                {/* Order Items */}
                <div className="ct-invoice-items">
                  <h3>المنتجات المطلوبة</h3>
                  <div className="ct-invoice-items-list">
                    {cartItems.map((item) => (
                      <div
                        key={item.cartItemId || item.id}
                        className="ct-invoice-item"
                      >
                        <div className="ct-invoice-item-info">
                          <h4>{item.name}</h4>
                          {item.selectedVariant && (
                            <p className="ct-invoice-variant">
                              {item.selectedVariant.size} -{" "}
                              {item.selectedVariant.color}
                            </p>
                          )}
                          <p className="ct-invoice-quantity">
                            الكمية: {item.quantity}
                          </p>
                        </div>
                        <div className="ct-invoice-item-price">
                          {(() => {
                            const itemPrice =
                              item.selectedVariant && item.selectedVariant.price
                                ? parseFloat(item.selectedVariant.price)
                                : item.price;
                            return `${itemPrice * item.quantity} شيكل`;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coupon Section */}
                <div className="ct-coupon-section">
                  <h3>كوبون الخصم</h3>
                  {!appliedCoupon ? (
                    <div className="ct-coupon-input-group">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="أدخل رمز الكوبون"
                        className="ct-coupon-input"
                        disabled={couponLoading}
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        className="ct-apply-coupon-btn"
                        disabled={couponLoading || !couponCode.trim()}
                      >
                        {couponLoading ? "جاري التحقق..." : "تطبيق"}
                      </button>
                    </div>
                  ) : (
                    <div className="ct-applied-coupon">
                      <div className="ct-applied-coupon-info">
                        <span className="ct-applied-coupon-code">
                          {appliedCoupon.code}
                        </span>
                        <span className="ct-applied-coupon-discount">
                          خصم: {couponDiscount.toFixed(2)} شيكل
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="ct-remove-coupon-btn"
                      >
                        إزالة
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="ct-coupon-error">
                      <i className="fas fa-exclamation-triangle"></i> {couponError}
                    </p>
                  )}
                </div>

                {/* Delivery Options */}
                <div className="ct-delivery-section">
                  <h3>خيارات التوصيل</h3>
                  <p className="ct-delivery-note">* يجب اختيار خيار التوصيل</p>

                  <div className="ct-delivery-options">
                    {deliveryOptions.map((option) => (
                      <label key={option.id} className="ct-delivery-option">
                        <input
                          type="radio"
                          name="delivery"
                          value={option.id}
                          checked={selectedDelivery === option.id}
                          onChange={(e) => setSelectedDelivery(e.target.value)}
                        />
                        <span className="ct-delivery-option-content">
                          <span className="ct-delivery-name">
                            {option.name}
                          </span>
                          <span className="ct-delivery-price">
                            {option.price} شيكل
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Invoice Summary */}
                <div className="ct-invoice-summary">
                  <h3>ملخص الفاتورة</h3>
                  <div className="ct-invoice-summary-row">
                    <span>المجموع الفرعي:</span>
                    <span>{subtotal.toFixed(2)} شيكل</span>
                  </div>
                  {appliedCoupon && (
                    <div className="ct-invoice-summary-row ct-invoice-discount">
                      <span>خصم الكوبون ({appliedCoupon.code}):</span>
                      <span>-{couponDiscount.toFixed(2)} شيكل</span>
                    </div>
                  )}
                  <div className="ct-invoice-summary-row">
                    <span>رسوم التوصيل:</span>
                    <span>{deliveryFee} شيكل</span>
                  </div>
                  <div className="ct-invoice-summary-row ct-invoice-total">
                    <span>الإجمالي النهائي:</span>
                    <span>{finalTotal.toFixed(2)} شيكل</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="ct-invoice-actions">
                  <button
                    className="ct-back-to-cart-btn"
                    onClick={handleCloseInvoicePreview}
                  >
                    العودة للسلة
                  </button>
                  <button
                    className="ct-proceed-checkout-btn"
                    onClick={proceedToCheckout}
                    disabled={!selectedDelivery}
                  >
                    متابعة الدفع
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal checkout */}
        {showCheckout && (
          <div
            className="ct-modal-overlay"
            onClick={(e) => {
              if (e.target.classList.contains("ct-modal-overlay")) {
                handleOrderComplete();
              }
            }}
          >
            <div
              className="ct-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkoutTitle"
            >
              <button
                className="ct-modal-close"
                onClick={handleOrderComplete}
                aria-label="إغلاق"
              >
                ×
              </button>
              <h2 id="checkoutTitle">معلومات الدفع</h2>

              {error && (
                <div className="ct-error">
                  <span>
                    <i className="fas fa-exclamation-triangle"></i>
                  </span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="ct-form-group">
                  <label>الاسم الكامل:</label>
                  <input
                    type="text"
                    value={name}
                    required
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="ct-form-group">
                  <label>
                    البريد الإلكتروني:{" "}
                    <span className="ct-optional">(اختياري)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    placeholder="إذا كنت لا تريد إرسال تفاصيل الطلب عبر البريد الإلكتروني، اترك هذا الحقل فارغاً"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      validateEmail(e.target.value);
                    }}
                    className={
                      email && email.trim() !== "" && !emailValid
                        ? "ct-input-invalid"
                        : ""
                    }
                  />
                  <small className="ct-email-note">
                    إذا لم تملأ هذا الحقل، لن نرسل لك تأكيد الطلب عبر البريد
                    الإلكتروني
                  </small>
                  {email && email.trim() !== "" && !emailValid && (
                    <small className="ct-email-error-note">
                      <i className="fas fa-exclamation-triangle"></i> يرجى إدخال
                      بريد إلكتروني صحيح
                    </small>
                  )}
                </div>
                <div className="ct-form-group">
                  <label>رقم الهاتف:</label>
                  <input
                    type="tel"
                    value={phone}
                    required
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="ct-form-group">
                  <label>العنوان:</label>
                  <textarea
                    value={address}
                    required
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="ct-checkout-btn"
                  disabled={
                    loading ||
                    cartItems.length === 0 ||
                    (email && email.trim() !== "" && !emailValid)
                  }
                >
                  {loading ? "... جاري الإرسال" : "إرسال الطلب"}
                </button>

                <button
                  type="button"
                  className="ct-back-btn"
                  onClick={handleBackToInvoicePreview}
                  disabled={loading}
                >
                  العودة لمراجعة الفاتورة
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Image Modal */}
        {showImageModal && selectedImage && (
          <div
            className="ct-image-modal-overlay"
            onClick={() => setShowImageModal(false)}
          >
            <div
              className="ct-image-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ct-image-modal-header">
                <h3>معاينة الصورة</h3>
                <button
                  className="ct-image-modal-close"
                  onClick={() => setShowImageModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="ct-image-modal-content">
                <img
                  src={selectedImage}
                  alt="معاينة المنتج"
                  className="ct-image-modal-image"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}

export default Cart;
