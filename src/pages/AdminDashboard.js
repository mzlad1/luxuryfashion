import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import "../css/AdminDashboard.css";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { CacheManager, CACHE_KEYS } from "../utils/cache";
import { useNavigate, Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import useNotifications from "../hooks/useNotifications";

function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null); // Add error state

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  // Notifications hook
  const {
    isSupported: notificationsSupported,
    isEnabled: notificationsEnabled,
    isLoading: notificationsLoading,
    error: notificationsError,
    needsPWAForIOS,
    isIOS,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
  } = useNotifications();

  const statuses = useMemo(
    () => ["قيد الانتظار", "قيد التنفيذ", "قيد التوصيل", "منجز", "مرفوض"],
    [],
  );

  const paths = useMemo(
    () => ({
      orders: "/admin/orders",
      products: "/admin/products",
      brands: "/admin/brands",
      categories: "/admin/categories",
    }),
    [],
  );

  const fetchAll = async (force = false) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const getOrFetch = async (key, colName, ttlMs) => {
        if (!force) {
          const cached = CacheManager.get(key);
          if (cached && Array.isArray(cached)) {
            return cached;
          }
        }

        const snap = await getDocs(collection(db, colName));
        const data = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() }));

        // Validate data structure
        if (!Array.isArray(data)) {
          throw new Error(`Invalid data structure for ${colName}`);
        }

        CacheManager.set(key, data, ttlMs);
        return data;
      };

      // Fetch all data with error handling for each collection
      const fetchPromises = [
        getOrFetch(CACHE_KEYS.ORDERS, "orders", 30 * 1000).catch((err) => {
          return [];
        }),
        getOrFetch(CACHE_KEYS.PRODUCTS, "products", 5 * 60 * 1000).catch(
          (err) => {
            return [];
          },
        ),
        getOrFetch(CACHE_KEYS.BRANDS, "brands", 10 * 60 * 1000).catch((err) => {
          return [];
        }),
        getOrFetch(CACHE_KEYS.CATEGORIES, "categories", 10 * 60 * 1000).catch(
          (err) => {
            return [];
          },
        ),
      ];

      const [o, p, b, c] = await Promise.all(fetchPromises);

      // Validate and set data
      const ordersData = Array.isArray(o) ? o : [];
      const productsData = Array.isArray(p) ? p : [];
      const brandsData = Array.isArray(b) ? b : [];
      const categoriesData = Array.isArray(c) ? c : [];

      // Sort orders by date desc
      ordersData.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );

      // Set state only after all data is ready
      setOrders(ordersData);
      setProducts(productsData);
      setBrands(brandsData);
      setCategories(categoriesData);
      setLastUpdate(new Date());
    } catch (e) {
      setError("حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.");

      // Set empty arrays as fallback
      setOrders([]);
      setProducts([]);
      setBrands([]);
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchAll(false);

    // Set up interval for auto-refresh
    const interval = setInterval(
      () => {
        if (document.visibilityState === "visible") {
          fetchAll(true);
        }
      },
      2 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, []);

  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const completed = orders.filter((o) => o.status === "منجز");
    const revenue = completed.reduce((s, o) => s + (o.total || 0), 0);

    const lowStock = products.filter(
      (p) => (p.stock || 0) > 0 && (p.stock || 0) <= 5,
    ).length;
    const outOfStock = products.filter((p) => (p.stock || 0) === 0).length;

    const byStatus = statuses.reduce((acc, st) => {
      acc[st] = orders.filter((o) => o.status === st).length;
      return acc;
    }, {});

    return {
      totalOrders,
      completedCount: completed.length,
      revenue,
      productsCount: products.length,
      lowStock,
      outOfStock,
      brandsCount: brands.length,
      categoriesCount: categories.length,
      byStatus,
    };
  }, [orders, products, brands, categories, statuses]);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return "-";
    const d = new Date(timestamp.seconds * 1000);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      CacheManager.clearAll();
      navigate("/admin");
    } catch (error) {
      navigate("/admin");
    }
  };

  // Show loading skeleton while initial loading
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="admin-dashboard">
          <div className="admin-dash-loading-container">
            <div className="admin-dash-loading-spinner"></div>
            <p>جاري تحميل البيانات...</p>
          </div>
        </div>
      </>
    );
  }

  // Show error state if there's an error
  if (error && !refreshing) {
    return (
      <>
        <Navbar />
        <div className="admin-dashboard">
          <div className="admin-dash-error-container">
            <div className="admin-dash-error-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h2>خطأ في تحميل البيانات</h2>
            <p>{error}</p>
            <button
              className="admin-dash-btn primary"
              onClick={() => fetchAll(true)}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="admin-dashboard">
        <header className="admin-dash-header">
          <h1>لوحة التحكم</h1>
          <div className="admin-dash-actions">
            <button
              className="admin-dash-btn primary"
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              title="تحديث البيانات"
            >
              {refreshing ? (
                "جاري التحديث..."
              ) : (
                <>
                  <i className="fas fa-sync-alt"></i> تحديث
                </>
              )}
            </button>
            <button
              className="admin-dash-btn ghost"
              onClick={handleSignOut}
              title="تسجيل الخروج"
            >
              <i className="fas fa-sign-out-alt"></i> تسجيل الخروج
            </button>
            {lastUpdate && (
              <span className="admin-dash-last-update">
                آخر تحديث: {lastUpdate.toLocaleTimeString("en-US")}
              </span>
            )}
          </div>
        </header>

        <div
          className={`admin-dash-status ${refreshing ? "updating" : "live"}`}
        >
          <span className="admin-dash-status-dot" />
          {refreshing ? "جاري التحديث..." : "البيانات محدثة"}
        </div>

        {/* Notifications Panel */}
        <section
          className="admin-dash-notifications-panel"
          aria-label="إعدادات الإشعارات"
        >
          <div className="notifications-panel-header">
            <div className="notifications-panel-icon">
              <i className="fas fa-bell"></i>
            </div>
            <div className="notifications-panel-info">
              <h3>إشعارات الطلبيات</h3>
              <p>استلم إشعارات فورية عند وصول طلبية جديدة</p>
            </div>
          </div>

          {!notificationsSupported ? (
            <div className="notifications-panel-status unsupported">
              <i className="fas fa-exclamation-circle"></i>
              <span>المتصفح لا يدعم الإشعارات</span>
            </div>
          ) : needsPWAForIOS ? (
            <div className="notifications-panel-ios-guide">
              <div className="ios-guide-icon">
                <i className="fas fa-mobile-alt"></i>
              </div>
              <div className="ios-guide-content">
                <h4>لتفعيل الإشعارات على iPhone</h4>
                <ol>
                  <li>
                    اضغط على <i className="fas fa-share-square"></i> (مشاركة)
                    أسفل الشاشة
                  </li>
                  <li>
                    اختر "إضافة إلى الشاشة الرئيسية"{" "}
                    <i className="fas fa-plus-square"></i>
                  </li>
                  <li>افتح التطبيق من الشاشة الرئيسية</li>
                  <li>ثم فعّل الإشعارات من هنا</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="notifications-panel-controls">
              {notificationsEnabled ? (
                <>
                  <div className="notifications-panel-status enabled">
                    <i className="fas fa-check-circle"></i>
                    <span>الإشعارات مفعّلة على هذا الجهاز</span>
                  </div>
                  <div className="notifications-panel-buttons">
                    <button
                      className="notifications-btn test"
                      onClick={sendTestNotification}
                      disabled={notificationsLoading}
                    >
                      <i className="fas fa-paper-plane"></i>
                      اختبار الإشعارات
                    </button>
                    <button
                      className="notifications-btn disable"
                      onClick={disableNotifications}
                      disabled={notificationsLoading}
                    >
                      <i className="fas fa-bell-slash"></i>
                      إلغاء التفعيل
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {notificationsError && (
                    <div className="notifications-panel-error">
                      <i className="fas fa-exclamation-triangle"></i>
                      <span>{notificationsError}</span>
                    </div>
                  )}
                  <button
                    className="notifications-btn enable"
                    onClick={enableNotifications}
                    disabled={notificationsLoading}
                  >
                    {notificationsLoading ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        جاري التفعيل...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-bell"></i>
                        تفعيل الإشعارات
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        <section className="admin-dash-stats-grid" aria-label="الإحصائيات">
          <div className="admin-dash-card stat">
            <div className="dash-stat-label">إجمالي الطلبات</div>
            <div className="dash-stat-value">{kpis.totalOrders}</div>
          </div>

          <div className="admin-dash-card stat">
            <div className="dash-stat-label">المنتجات</div>
            <div className="dash-stat-value">{kpis.productsCount}</div>
          </div>
          <div className="admin-dash-card stat warn">
            <div className="dash-stat-label">مخزون قليل</div>
            <div className="dash-stat-value">{kpis.lowStock}</div>
          </div>
          <div className="admin-dash-card stat danger">
            <div className="dash-stat-label">نفدت الكمية</div>
            <div className="dash-stat-value">{kpis.outOfStock}</div>
          </div>
          <div className="admin-dash-card stat">
            <div className="dash-stat-label">العلامات التجارية</div>
            <div className="dash-stat-value">{kpis.brandsCount}</div>
          </div>
          <div className="admin-dash-card stat">
            <div className="dash-stat-label">الفئات</div>
            <div className="dash-stat-value">{kpis.categoriesCount}</div>
          </div>
        </section>

        <div className="admin-dash-panel">
          <div className="admin-dash-panel-header">
            <h2>صفحات الأدمن</h2>
          </div>
          <div className="admin-dash-quick-grid">
            <Link to={paths.orders} className="admin-dash-tile">
              <span className="tile-title">الطلبات</span>
              <span className="tile-sub">عرض وإدارة الطلبات</span>
            </Link>
            <Link to={paths.products} className="admin-dash-tile">
              <span className="tile-title">المنتجات</span>
              <span className="tile-sub">إدارة منتجات العناية بالشعر</span>
            </Link>
            <Link to={paths.brands} className="admin-dash-tile">
              <span className="tile-title">العلامات التجارية</span>
              <span className="tile-sub">إدارة العلامات</span>
            </Link>
            <Link to={paths.categories} className="admin-dash-tile">
              <span className="tile-title">الفئات</span>
              <span className="tile-sub">إدارة الفئات</span>
            </Link>
            <Link to="/admin/feedbacks" className="admin-dash-tile">
              <span className="tile-title">تقييمات العملاء</span>
              <span className="tile-sub">مراجعة والموافقة على التقييمات</span>
            </Link>
            <Link to="/admin/discounts" className="admin-dash-tile">
              <span className="tile-title">الخصومات</span>
              <span className="tile-sub">
                تطبيق خصومات على المنتجات والفئات
              </span>
            </Link>
            <Link to="/admin/coupons" className="admin-dash-tile">
              <span className="tile-title">الكوبونات</span>
              <span className="tile-sub">إنشاء وإدارة كوبونات الخصم</span>
            </Link>
            <Link to="/admin/statistics" className="admin-dash-tile">
              <span className="tile-title">إحصائيات الموقع</span>
              <span className="tile-sub">عرض إحصائيات شاملة عن الموقع</span>
            </Link>
            <Link to="/admin/visitor-statistics" className="admin-dash-tile">
              <span className="tile-title">إحصائيات الزوار</span>
              <span className="tile-sub">
                تتبع عدد الزوار والإحصائيات اللحظية
              </span>
            </Link>
            <Link to="/admin/hero-slides" className="admin-dash-tile">
              <span className="tile-title">شرائح الصفحة الرئيسية</span>
              <span className="tile-sub">
                إدارة الشرائح المتحركة في الصفحة الرئيسية
              </span>
            </Link>
            <Link to="/admin/promotional-banner" className="admin-dash-tile">
              <span className="tile-title">البانر الترويجي</span>
              <span className="tile-sub">
                إدارة البانر الترويجي في الصفحة الرئيسية
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminDashboard;
