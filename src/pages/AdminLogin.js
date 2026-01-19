import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "../css/AdminLogin.css";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

// صفحة تسجيل دخول المشرف
function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in, redirect to dashboard
        navigate("/admin/dashboard");
      } else {
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/admin/dashboard"); // Redirect to dashboard after login
    } catch (error) {
      setError("خطأ في البريد الإلكتروني أو كلمة المرور");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking authentication status
  if (checkingAuth) {
    return (
      <>
        <Navbar />
        <div className="admin-login-page">
          <div className="al-form">
            <div className="al-checking">
              <div className="al-spinner"></div>
              <p>جاري التحقق من حالة تسجيل الدخول...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="admin-login-page">
        <h1>تسجيل دخول المسؤول</h1>

        <form onSubmit={handleLogin} className="al-form">
          {error && <p className="al-error">{error}</p>}

          <div className="al-form-group">
            <label>البريد الإلكتروني:</label>
            <input
              type="email"
              value={email}
              required
              placeholder="أدخل البريد الإلكتروني"
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="al-form-group">
            <label>كلمة المرور:</label>
            <input
              type="password"
              value={password}
              required
              placeholder="أدخل كلمة المرور"
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="al-login-btn" disabled={loading}>
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <div className="al-footer">
          <p>© 2026 Luxury Fashion</p>
        </div>
      </div>
    </>
  );
}

export default AdminLogin;
