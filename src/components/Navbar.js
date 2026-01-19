import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
// Helper to get page name from path
const getPageName = (pathname) => {
  switch (pathname) {
    case "/":
      return "الرئيسية";
    case "/products":
      return "المنتجات";
    case "/about":
      return "من نحن";
    case "/contact":
      return "اتصل بنا";
    case "/cart":
      return "السلة";
    case "/admin/dashboard":
      return "لوحة التحكم";
    case "/admin/products":
      return "إدارة المنتجات";
    case "/admin/brands":
      return "إدارة العلامات التجارية";
    case "/admin/categories":
      return "إدارة الفئات";
    case "/admin/orders":
      return "الطلبات";
    case "/admin/feedbacks":
      return "إدارة التقييمات";
    case "/admin/discounts":
      return "إدارة الخصومات";
    case "/admin/statistics":
      return "الإحصائيات";
    default:
      return "";
  }
};
import { useCart } from "../contexts/CartContext";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import "../css/Navbar.css";

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(null); // null = loading, false = not admin, true = admin
  const { cartItems } = useCart();
  const location = useLocation();

  const cartItemsCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Check if user is admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
    });
    return () => unsubscribe();
  }, []);

  // Don't show navbar on admin pages for non-admin users
  if (location.pathname.startsWith("/admin") && !isAdmin) {
    return null;
  }

  // Don't render navbar until we know admin status to prevent cart button flash
  if (isAdmin === null) {
    return null;
  }

  return (
    <header className="navbar">
      <div className="nav-container">
        {/* Desktop Left Section */}
        <div className="nav-desktop-left">
          <a
            href="https://www.instagram.com/luxury_life_stayle/"
            className="nav-social-link"
            target="_blank"
            rel="noopener noreferrer"
            title="Instagram"
          >
            <i className="fab fa-instagram"></i>
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=100087035404500"
            className="nav-social-link"
            target="_blank"
            rel="noopener noreferrer"
            title="Facebook"
          >
            <i className="fab fa-facebook-f"></i>
          </a>
        </div>

        <Link
          to="/"
          className="nav-logo"
          onClick={closeMenu}
          aria-label="Luxury Fashion - Home"
        >
          <img
            src="/images/logo.png"
            alt="Luxury Fashion"
            className="nav-logo-img"
          />
          <span className="nav-logo-text">Luxury Fashion</span>
        </Link>

        <nav className={`nav-menu ${isMenuOpen ? "nav-menu-active" : ""}`}>
          <Link
            to="/"
            className={`nav-link ${isActive("/") ? "nav-link-active" : ""}`}
            onClick={closeMenu}
          >
            الرئيسية
          </Link>
          <Link
            to="/products"
            className={`nav-link ${
              isActive("/products") ? "nav-link-active" : ""
            }`}
            onClick={closeMenu}
          >
            المنتجات
          </Link>
          <Link
            to="/about"
            className={`nav-link ${
              isActive("/about") ? "nav-link-active" : ""
            }`}
            onClick={closeMenu}
          >
            من نحن
          </Link>
          <Link
            to="/contact"
            className={`nav-link ${
              isActive("/contact") ? "nav-link-active" : ""
            }`}
            onClick={closeMenu}
          >
            اتصل بنا
          </Link>

          {/* Only show cart for non-admin users */}
          {isAdmin === false && (
            <Link
              to="/cart"
              className={`nav-link cart-link nav-cart-desktop ${
                isActive("/cart") ? "nav-link-active" : ""
              }`}
              onClick={closeMenu}
            >
              <span className="cart-icon">
                <i className="fas fa-shopping-cart"></i>
              </span>
              {cartItemsCount > 0 && (
                <span className="cart-badge">{cartItemsCount}</span>
              )}
            </Link>
          )}

          {/* Show admin dashboard link for admin users */}
          {isAdmin === true && (
            <Link
              to="/admin/dashboard"
              className={`nav-link admin-link ${
                location.pathname.startsWith("/admin") ? "nav-link-active" : ""
              }`}
              onClick={closeMenu}
            >
              لوحة التحكم
            </Link>
          )}
        </nav>

        {/* Desktop Right Section */}
        <div className="nav-desktop-right">
          <a href="tel:+972592806088" className="nav-contact-link">
            <i className="fas fa-phone-alt"></i>
            <span>972592806088+</span>
          </a>
        </div>

        <div className="nav-right">
          {/* Show page name beside logo on <= 768px */}
          <h1 className="nav-current-page-name">
            {getPageName(location.pathname)}
          </h1>

          {/* Mobile Cart Button - Only show for non-admin users */}
          {isAdmin === false && (
            <Link
              to="/cart"
              className="nav-cart-mobile"
              onClick={closeMenu}
              aria-label="عربة التسوق"
            >
              <span className="nav-cart-icon">
                <i className="fas fa-shopping-cart"></i>
              </span>
              {cartItemsCount > 0 && (
                <span className="nav-cart-badge">{cartItemsCount}</span>
              )}
            </Link>
          )}

          <button
            className="nav-toggle"
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            <span
              className={`nav-toggle-line ${
                isMenuOpen ? "nav-toggle-line-1" : ""
              }`}
            ></span>
            <span
              className={`nav-toggle-line ${
                isMenuOpen ? "nav-toggle-line-2" : ""
              }`}
            ></span>
            <span
              className={`nav-toggle-line ${
                isMenuOpen ? "nav-toggle-line-3" : ""
              }`}
            ></span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
