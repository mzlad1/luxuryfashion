import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Cart from "./pages/Cart";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ManageProducts from "./pages/ManageProducts";
import ManageCategories from "./pages/ManageCategories";
import ManageBrands from "./pages/ManageBrands";
import ManageHeroSlides from "./pages/ManageHeroSlides";
import ManagePromotionalBanner from "./pages/ManagePromotionalBanner";
import Orders from "./pages/Orders";
import FeedbackManager from "./pages/FeedbackManager";
import DiscountManager from "./pages/DiscountManager";
import CouponManager from "./pages/CouponManager";
import Statistics from "./pages/Statistics";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import "./css/App.css";

// ملف App.js يحدد مسارات التطبيق
function App() {
  return (
    <div className="App">
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#363636",
            color: "#fff",
            fontFamily: "Cairo, sans-serif",
            fontSize: "14px",
            padding: "16px",
            borderRadius: "8px",
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: "#4ade80",
              secondary: "#fff",
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />
      <ScrollToTop />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          {/* Admin Login (public) */}
          <Route path="/admin" element={<AdminLogin />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <ProtectedRoute>
                <ManageProducts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/brands"
            element={
              <ProtectedRoute>
                <ManageBrands />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <ProtectedRoute>
                <ManageCategories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/feedbacks"
            element={
              <ProtectedRoute>
                <FeedbackManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/discounts"
            element={
              <ProtectedRoute>
                <DiscountManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/coupons"
            element={
              <ProtectedRoute>
                <CouponManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/statistics"
            element={
              <ProtectedRoute>
                <Statistics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/hero-slides"
            element={
              <ProtectedRoute>
                <ManageHeroSlides />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/promotional-banner"
            element={
              <ProtectedRoute>
                <ManagePromotionalBanner />
              </ProtectedRoute>
            }
          />
          {/* إعادة توجيه لأي مسار غير معروف */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
