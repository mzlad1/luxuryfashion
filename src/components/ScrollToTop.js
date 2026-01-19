import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top with multiple fallback methods
    try {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant",
      });
    } catch (error) {
      window.scrollTo(0, 0);
    }

    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // Update page title based on current route
    const titles = {
      "/": "Luxury Fashion",
      "/about": "Luxury Fashion - About Us",
      "/contact": "Luxury Fashion - Contact Us",
      "/products": "Luxury Fashion - Products",
      "/cart": "Luxury Fashion - Shopping Cart",
      "/admin": "Luxury Fashion - Admin Login",
      "/admin/dashboard": "Luxury Fashion - Admin Dashboard",
      "/admin/products": "Luxury Fashion - Manage Products",
      "/admin/brands": "Luxury Fashion - Manage Brands",
      "/admin/categories": "Luxury Fashion - Manage Categories",
      "/admin/orders": "Luxury Fashion - Orders",
      "/admin/feedbacks": "Luxury Fashion - Manage Feedbacks",
      "/admin/discounts": "Luxury Fashion - Manage Discounts",
      "/admin/statistics": "Luxury Fashion - Statistics",
      "/admin/hero-slides": "Luxury Fashion - Manage Hero Slides",
    };

    // Check if it's a product detail page
    if (pathname.startsWith("/products/")) {
      document.title = "Luxury Fashion - Product Details";
    } else {
      document.title = titles[pathname] || "Luxury Fashion";
    }
  }, [pathname]);

  return null;
}

export default ScrollToTop;
