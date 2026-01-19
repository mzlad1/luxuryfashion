import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

// مكون حماية المسارات الإدارية
function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // عرض شاشة تحميل أثناء التحقق من حالة المصادقة
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          fontSize: "1.2rem",
          color: "#6E6259",
        }}
      >
        جاري التحقق من صلاحيات الدخول...
      </div>
    );
  }

  // إعادة توجيه إلى صفحة تسجيل الدخول إذا لم يكن مسجل دخول
  if (!user) {
    return <Navigate to="/admin" replace />;
  }

  // عرض المحتوى المحمي
  return children;
}

export default ProtectedRoute;
