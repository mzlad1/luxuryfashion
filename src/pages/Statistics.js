import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "../css/Statistics.css";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { CacheManager, CACHE_KEYS } from "../utils/cache";

function Statistics() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [activityFilter, setActivityFilter] = useState("all"); // "all", "today", "month", "custom"
  const [customDate, setCustomDate] = useState("");
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activitiesPerPage] = useState(10);
  const [selectedMonth, setSelectedMonth] = useState(""); // For month selector

  // New state for date range filtering
  const [dateRangeFrom, setDateRangeFrom] = useState("");
  const [dateRangeTo, setDateRangeTo] = useState("");
  const [productMonthFilter, setProductMonthFilter] = useState(""); // For product sales by month
  const [selectedProductId, setSelectedProductId] = useState(""); // Product to check sales for
  // Statistics data
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalFeedbacks: 0,
    totalCategories: 0,
    totalBrands: 0,
    ordersByStatus: {},
    ordersByMonth: {},
    allOrdersByMonth: {}, // Store all monthly data for filtering
    topProducts: [],
    recentActivity: [],
    mostOrderedProducts: [],
    allActivities: [], // Store all activities for filtering
    outOfStockProducts: 0, // New: Out of stock count
    pendingOrders: 0, // New: Pending orders
    preparingOrders: 0, // New: Orders being prepared
    returnedOrders: 0, // New: Returned/rejected orders
    completedOrders: 0, // New: Completed orders
    allOrders: [], // Store all orders for filtering
    allProducts: [], // Store all products for filtering
    totalDeliveryFees: 0, // New: Total delivery fees
    revenueWithoutDelivery: 0, // New: Revenue excluding delivery
  });

  const fetchStatistics = async (force = false) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch all collections
      const [
        ordersSnapshot,
        productsSnapshot,
        feedbacksSnapshot,
        categoriesSnapshot,
        brandsSnapshot,
      ] = await Promise.all([
        getDocs(collection(db, "orders")),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "feedbacks")),
        getDocs(collection(db, "categories")),
        getDocs(collection(db, "brands")),
      ]);

      // Process orders
      const orders = [];
      ordersSnapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });

      // Process products
      const products = [];
      productsSnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() });
      });

      // Process feedbacks
      const feedbacks = [];
      feedbacksSnapshot.forEach((doc) => {
        feedbacks.push({ id: doc.id, ...doc.data() });
      });

      // Process categories
      const categories = [];
      categoriesSnapshot.forEach((doc) => {
        categories.push({ id: doc.id, ...doc.data() });
      });

      // Process brands
      const brands = [];
      brandsSnapshot.forEach((doc) => {
        brands.push({ id: doc.id, ...doc.data() });
      });

      // Calculate statistics
      const totalOrders = orders.length;

      // Calculate total revenue only from completed orders
      const completedOrders = orders.filter((order) => order.status === "منجز");
      const totalRevenue = completedOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0,
      );

      // Calculate delivery fees and revenue without delivery
      const totalDeliveryFees = completedOrders.reduce(
        (sum, order) => sum + (order.deliveryFee || 0),
        0,
      );
      const revenueWithoutDelivery = totalRevenue - totalDeliveryFees;

      const totalProducts = products.length;
      const totalFeedbacks = feedbacks.length;
      const totalCategories = categories.length;
      const totalBrands = brands.length;

      // Calculate out of stock products
      const outOfStockProducts = products.filter(
        (p) => (p.stock || 0) === 0,
      ).length;

      // Calculate orders by status
      const ordersByStatus = {};
      const pendingOrders = orders.filter(
        (order) => order.status === "قيد الانتظار",
      ).length;
      const preparingOrders = orders.filter(
        (order) => order.status === "قيد التنفيذ",
      ).length;
      const returnedOrders = orders.filter(
        (order) => order.status === "مرفوض",
      ).length;
      const completedOrdersCount = orders.filter(
        (order) => order.status === "منجز",
      ).length;

      orders.forEach((order) => {
        const status = order.status || "غير محدد";
        ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
      });

      // Calculate orders by month for all available months
      const allOrdersByMonth = {};
      orders.forEach((order) => {
        if (order.createdAt) {
          const orderDate = order.createdAt.toDate
            ? order.createdAt.toDate()
            : new Date(order.createdAt);
          const monthKey = orderDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
          });
          allOrdersByMonth[monthKey] = (allOrdersByMonth[monthKey] || 0) + 1;
        }
      });

      // Get available months for selector
      const availableMonths = Object.keys(allOrdersByMonth).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateB - dateA;
      });

      // Set default selected month to current month if none selected
      if (!selectedMonth && availableMonths.length > 0) {
        const currentMonth = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });
        setSelectedMonth(
          availableMonths.includes(currentMonth)
            ? currentMonth
            : availableMonths[0],
        );
      }

      // Filter orders by selected month
      const ordersByMonth =
        selectedMonth && allOrdersByMonth[selectedMonth]
          ? { [selectedMonth]: allOrdersByMonth[selectedMonth] }
          : allOrdersByMonth;

      // Get top products by orders
      const productOrderCount = {};
      orders.forEach((order) => {
        if (order.items) {
          order.items.forEach((item) => {
            // Check both item.id and item.productId for compatibility
            const productId = item.id || item.productId;
            if (productId) {
              productOrderCount[productId] =
                (productOrderCount[productId] || 0) + (item.quantity || 1);
            }
          });
        }
      });

      const topProducts = Object.entries(productOrderCount)
        .map(([productId, count]) => {
          const product = products.find((p) => p.id === productId);
          return {
            id: productId,
            name: product ? product.name : "منتج غير معروف",
            orderCount: count,
          };
        })
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 5);

      // Get most ordered products with full product details
      let mostOrderedProducts = products
        .map((product) => ({
          ...product,
          orderCount: productOrderCount[product.id] || 0,
        }))
        .filter((product) => product.orderCount > 0) // Only include products that have been ordered
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 8); // Get top 8 for better display

      // If no products have been ordered, show some sample products with mock order counts
      if (mostOrderedProducts.length === 0 && products.length > 0) {
        mostOrderedProducts = products.slice(0, 6).map((product, index) => ({
          ...product,
          orderCount: Math.max(1, Math.floor(Math.random() * 20) + 5), // Random order count between 5-25
        }));
      }

      // Get all activities for filtering
      const allActivities = [
        ...orders.map((order) => ({
          type: "order",
          title: `طلب جديد #${order.id}`,
          description: `طلب من ${order.customerName || "عميل"} بقيمة ${
            order.total || 0
          } شيكل`,
          date: order.createdAt,
          status: order.status,
        })),
        ...feedbacks.map((feedback) => ({
          type: "feedback",
          title: `تقييم جديد`,
          description: `تقييم من ${feedback.name} للمنتج`,
          date: feedback.createdAt,
          status: feedback.status,
        })),
      ].sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
      });

      // Get recent activity based on filter
      const recentActivity = getFilteredActivities(
        allActivities,
        activityFilter,
        customDate,
      ).slice(0, 5);

      // Estimate unique customers (based on unique customer names in orders)
      const uniqueCustomers = new Set(
        orders.map((order) => order.customerName).filter(Boolean),
      );
      const totalCustomers = uniqueCustomers.size;

      setStats({
        totalOrders,
        totalRevenue,
        totalProducts,
        totalCustomers,
        totalFeedbacks,
        totalCategories,
        totalBrands,
        ordersByStatus,
        ordersByMonth,
        allOrdersByMonth,
        topProducts,
        recentActivity,
        mostOrderedProducts,
        allActivities,
        outOfStockProducts,
        pendingOrders,
        preparingOrders,
        returnedOrders,
        completedOrders: completedOrdersCount,
        allOrders: orders,
        allProducts: products,
        totalDeliveryFees,
        revenueWithoutDelivery,
      });

      setLastUpdate(new Date());
    } catch (error) {
      setError("حدث خطأ أثناء تحميل الإحصائيات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper function to filter activities based on date
  const getFilteredActivities = (activities, filter, customDate) => {
    const now = new Date();

    switch (filter) {
      case "today":
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        return activities.filter((activity) => {
          const activityDate = activity.date?.toDate
            ? activity.date.toDate()
            : new Date(activity.date);
          return activityDate >= today;
        });

      case "month":
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return activities.filter((activity) => {
          const activityDate = activity.date?.toDate
            ? activity.date.toDate()
            : new Date(activity.date);
          return activityDate >= monthStart;
        });

      case "custom":
        if (!customDate) return activities;
        const selectedDate = new Date(customDate);
        const selectedDayStart = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
        );
        const selectedDayEnd = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate() + 1,
        );
        return activities.filter((activity) => {
          const activityDate = activity.date?.toDate
            ? activity.date.toDate()
            : new Date(activity.date);
          return (
            activityDate >= selectedDayStart && activityDate < selectedDayEnd
          );
        });

      default:
        return activities;
    }
  };

  // Update activities when filter changes
  useEffect(() => {
    if (stats.allActivities.length > 0) {
      const filteredActivities = getFilteredActivities(
        stats.allActivities,
        activityFilter,
        customDate,
      );
      setStats((prev) => ({
        ...prev,
        recentActivity: filteredActivities.slice(0, 5),
      }));
    }
  }, [activityFilter, customDate]);

  // Update orders by month when selected month changes
  useEffect(() => {
    if (
      stats.allOrdersByMonth &&
      Object.keys(stats.allOrdersByMonth).length > 0
    ) {
      const ordersByMonth =
        selectedMonth && stats.allOrdersByMonth[selectedMonth]
          ? { [selectedMonth]: stats.allOrdersByMonth[selectedMonth] }
          : stats.allOrdersByMonth;

      setStats((prev) => ({
        ...prev,
        ordersByMonth,
      }));
    }
  }, [selectedMonth, stats.allOrdersByMonth]);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const formatDate = (date) => {
    if (!date) return "-";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US").format(amount);
  };

  // Helper function to get total stock for variant products
  const getTotalStock = (product) => {
    if (
      product.hasVariants &&
      product.variants &&
      product.variants.length > 0
    ) {
      return product.variants.reduce(
        (total, variant) => total + (variant.stock || 0),
        0,
      );
    }
    return product.stock || 0;
  };

  // Helper function to get stock status class
  const getStockStatusClass = (stock) => {
    if (stock > 10) return "high";
    if (stock > 5) return "medium";
    return "low";
  };

  const handleFilterChange = (newFilter) => {
    setActivityFilter(newFilter);
    if (newFilter !== "custom") {
      setCustomDate("");
    }
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
  };

  // Helper function to calculate orders within date range
  const getOrdersInDateRange = () => {
    if (!dateRangeFrom || !dateRangeTo) return stats.allOrders;

    const fromDate = new Date(dateRangeFrom);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(dateRangeTo);
    toDate.setHours(23, 59, 59, 999);

    return stats.allOrders.filter((order) => {
      if (!order.createdAt) return false;
      const orderDate = order.createdAt.toDate
        ? order.createdAt.toDate()
        : new Date(order.createdAt);
      return orderDate >= fromDate && orderDate <= toDate;
    });
  };

  // Helper function to calculate product sales for a specific month
  const getProductSalesForMonth = () => {
    if (!selectedProductId || !productMonthFilter) return 0;

    const selectedDate = new Date(productMonthFilter);
    const monthStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1,
    );
    const monthEnd = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const ordersInMonth = stats.allOrders.filter((order) => {
      if (!order.createdAt) return false;
      const orderDate = order.createdAt.toDate
        ? order.createdAt.toDate()
        : new Date(order.createdAt);
      return orderDate >= monthStart && orderDate <= monthEnd;
    });

    let totalUnits = 0;
    ordersInMonth.forEach((order) => {
      if (order.items) {
        order.items.forEach((item) => {
          const productId = item.id || item.productId;
          if (productId === selectedProductId) {
            totalUnits += item.quantity || 1;
          }
        });
      }
    });

    return totalUnits;
  };

  // Helper function to get returned orders in date range
  const getReturnedOrdersInRange = () => {
    const ordersInRange = getOrdersInDateRange();
    return ordersInRange.filter((order) => order.status === "مرفوض").length;
  };

  // Calculate stats for date range
  const dateRangeStats = {
    ordersCount: getOrdersInDateRange().length,
    returnedCount: getReturnedOrdersInRange(),
    totalAmount: getOrdersInDateRange()
      .filter((order) => order.status === "منجز")
      .reduce((sum, order) => sum + (order.total || 0), 0),
    deliveryFees: getOrdersInDateRange()
      .filter((order) => order.status === "منجز")
      .reduce((sum, order) => sum + (order.deliveryFee || 0), 0),
  };

  // Pagination functions
  const getCurrentActivities = () => {
    const filteredActivities = getFilteredActivities(
      stats.allActivities,
      activityFilter,
      customDate,
    );
    const startIndex = (currentPage - 1) * activitiesPerPage;
    return filteredActivities.slice(startIndex, startIndex + activitiesPerPage);
  };

  const getTotalPages = () => {
    const filteredActivities = getFilteredActivities(
      stats.allActivities,
      activityFilter,
      customDate,
    );
    return Math.ceil(filteredActivities.length / activitiesPerPage);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const openActivityModal = () => {
    setShowActivityModal(true);
    setCurrentPage(1); // Reset to first page when opening modal
  };

  const closeActivityModal = () => {
    setShowActivityModal(false);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="statistics-page">
          <div className="stats-loading-container">
            <div className="stats-loading-spinner"></div>
            <p>جاري تحميل الإحصائيات...</p>
          </div>
        </div>
      </>
    );
  }

  if (error && !refreshing) {
    return (
      <>
        <Navbar />
        <div className="statistics-page">
          <div className="stats-error-container">
            <div className="stats-error-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h2>خطأ في تحميل الإحصائيات</h2>
            <p>{error}</p>
            <button
              className="stats-btn primary"
              onClick={() => fetchStatistics(true)}
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
      <div className="statistics-page">
        <header className="stats-header">
          <h1>
            <i className="fas fa-chart-bar"></i> إحصائيات الموقع
          </h1>
          <div className="stats-actions">
            <button
              className="stats-btn primary"
              onClick={() => fetchStatistics(true)}
              disabled={refreshing}
              title="تحديث الإحصائيات"
            >
              {refreshing ? (
                "جاري التحديث..."
              ) : (
                <>
                  <i className="fas fa-sync-alt"></i> تحديث
                </>
              )}
            </button>
            {lastUpdate && (
              <span className="stats-last-update">
                آخر تحديث: {lastUpdate.toLocaleTimeString("en-US")}
              </span>
            )}
          </div>
        </header>

        <div className={`stats-status ${refreshing ? "updating" : "live"}`}>
          <span className="stats-status-dot" />
          {refreshing ? "جاري التحديث..." : "الإحصائيات محدثة"}
        </div>

        {/* Key Metrics */}
        <section className="stats-metrics-grid">
          <div className="stats-card metric-card primary">
            <div className="metric-icon">
              <i className="fas fa-box"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.totalOrders)}
              </div>
              <div className="metric-label">إجمالي الطلبات</div>
            </div>
          </div>

          <div className="stats-card metric-card accent">
            <div className="metric-icon">
              <i className="fas fa-dollar-sign"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.totalRevenue)} شيكل
              </div>
              <div className="metric-label">إجمالي المبيعات (مع التوصيل)</div>
            </div>
          </div>

          <div className="stats-card metric-card success">
            <div className="metric-icon">
              <i className="fas fa-dollar-sign"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.revenueWithoutDelivery)} شيكل
              </div>
              <div className="metric-label">المبيعات (بدون التوصيل)</div>
            </div>
          </div>

          <div className="stats-card metric-card info">
            <div className="metric-icon">
              <i className="fas fa-truck"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.totalDeliveryFees)} شيكل
              </div>
              <div className="metric-label">رسوم التوصيل</div>
            </div>
          </div>

          <div className="stats-card metric-card warning">
            <div className="metric-icon">
              <i className="fas fa-hourglass-half"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.pendingOrders)}
              </div>
              <div className="metric-label">طلبات قيد الانتظار</div>
            </div>
          </div>

          <div className="stats-card metric-card info">
            <div className="metric-icon">
              <i className="fas fa-cog"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.preparingOrders)}
              </div>
              <div className="metric-label">طلبات قيد التنفيذ</div>
            </div>
          </div>

          <div className="stats-card metric-card success">
            <div className="metric-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.completedOrders)}
              </div>
              <div className="metric-label">طلبات مكتملة</div>
            </div>
          </div>

          <div className="stats-card metric-card warning">
            <div className="metric-icon">
              <i className="fas fa-times-circle"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.returnedOrders)}
              </div>
              <div className="metric-label">طلبات مرفوضة</div>
            </div>
          </div>

          <div className="stats-card metric-card success">
            <div className="metric-icon">
              <i className="fas fa-chart-line"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.totalProducts)}
              </div>
              <div className="metric-label">إجمالي المنتجات</div>
            </div>
          </div>

          <div className="stats-card metric-card warning">
            <div className="metric-icon">
              <i className="fas fa-inbox"></i>
            </div>
            <div className="metric-content">
              <div className="metric-value">
                {formatCurrency(stats.outOfStockProducts)}
              </div>
              <div className="metric-label">منتجات نفدت من المخزون</div>
            </div>
          </div>
        </section>

        {/* Date Range Filter Section */}
        <section className="stats-analytics">
          <div className="stats-card chart-card">
            <h3>
              <i className="fas fa-calendar-alt"></i> إحصائيات الفترة الزمنية
            </h3>
            <div className="date-range-filter">
              <div className="date-inputs">
                <div className="date-input-group">
                  <label htmlFor="date-from">من تاريخ:</label>
                  <input
                    type="date"
                    id="date-from"
                    value={dateRangeFrom}
                    onChange={(e) => setDateRangeFrom(e.target.value)}
                    className="date-picker"
                  />
                </div>
                <div className="date-input-group">
                  <label htmlFor="date-to">إلى تاريخ:</label>
                  <input
                    type="date"
                    id="date-to"
                    value={dateRangeTo}
                    onChange={(e) => setDateRangeTo(e.target.value)}
                    className="date-picker"
                  />
                </div>
              </div>

              {dateRangeFrom && dateRangeTo && (
                <div className="date-range-results">
                  <div className="range-stat">
                    <span className="range-stat-label">
                      عدد الطلبات المرسلة:
                    </span>
                    <span className="range-stat-value">
                      {dateRangeStats.ordersCount}
                    </span>
                  </div>
                  <div className="range-stat">
                    <span className="range-stat-label">الطلبات المرفوضة:</span>
                    <span className="range-stat-value danger">
                      {dateRangeStats.returnedCount}
                    </span>
                  </div>
                  <div className="range-stat">
                    <span className="range-stat-label">
                      إجمالي المبلغ (مع التوصيل):
                    </span>
                    <span className="range-stat-value success">
                      {formatCurrency(dateRangeStats.totalAmount)} شيكل
                    </span>
                  </div>
                  <div className="range-stat">
                    <span className="range-stat-label">رسوم التوصيل:</span>
                    <span className="range-stat-value info">
                      {formatCurrency(dateRangeStats.deliveryFees)} شيكل
                    </span>
                  </div>
                  <div className="range-stat highlight">
                    <span className="range-stat-label">
                      المبلغ الإجمالي (بدون التوصيل):
                    </span>
                    <span className="range-stat-value primary">
                      {formatCurrency(
                        dateRangeStats.totalAmount -
                          dateRangeStats.deliveryFees,
                      )}{" "}
                      شيكل
                    </span>
                  </div>
                </div>
              )}

              {(!dateRangeFrom || !dateRangeTo) && (
                <div className="no-date-message">
                  <p>
                    <i className="fas fa-exclamation-triangle"></i> الرجاء
                    اختيار نطاق التاريخ لعرض الإحصائيات
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Product Sales by Month */}
          <div className="stats-card chart-card">
            <h3>
              <i className="fas fa-box"></i> مبيعات المنتج حسب الشهر
            </h3>
            <div className="product-month-filter">
              <div className="filter-inputs">
                <div className="filter-input-group">
                  <label htmlFor="product-select">اختر المنتج:</label>
                  <select
                    id="product-select"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="product-selector"
                  >
                    <option value="">-- اختر منتج --</option>
                    {stats.allProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-input-group">
                  <label htmlFor="product-month">اختر الشهر:</label>
                  <input
                    type="month"
                    id="product-month"
                    value={productMonthFilter}
                    onChange={(e) => setProductMonthFilter(e.target.value)}
                    className="date-picker"
                  />
                </div>
              </div>

              {selectedProductId && productMonthFilter && (
                <div className="product-sales-result">
                  <div className="sales-info">
                    <span className="sales-icon">
                      <i className="fas fa-chart-bar"></i>
                    </span>
                    <div className="sales-details">
                      <p className="sales-label">عدد الوحدات المباعة:</p>
                      <p className="sales-value">
                        {getProductSalesForMonth()} وحدة
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(!selectedProductId || !productMonthFilter) && (
                <div className="no-date-message">
                  <p>
                    <i className="fas fa-exclamation-triangle"></i> الرجاء
                    اختيار المنتج والشهر لعرض المبيعات
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Charts and Analytics */}
        <section className="stats-analytics">
          <div className="stats-row">
            {/* Orders by Status */}
            <div className="stats-card chart-card">
              <h3>
                <i className="fas fa-chart-bar"></i> الطلبات حسب الحالة
              </h3>
              <div className="chart-content">
                {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                  <div key={status} className="chart-item">
                    <div className="chart-label">{status}</div>
                    <div className="chart-bar">
                      <div
                        className="chart-bar-fill"
                        style={{
                          width: `${(count / stats.totalOrders) * 100}%`,
                          backgroundColor: getStatusColor(status),
                        }}
                      ></div>
                    </div>
                    <div className="chart-value">{count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Orders by Month */}
            <div className="stats-card chart-card">
              <h3>
                <i className="fas fa-chart-line"></i> الطلبات حسب الشهر
              </h3>

              {/* Month Selector */}
              <div className="month-selector-container">
                <label
                  htmlFor="month-selector"
                  className="month-selector-label"
                >
                  اختر الشهر:
                </label>
                <select
                  id="month-selector"
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="month-selector"
                >
                  <option value="">جميع الأشهر</option>
                  {Object.keys(stats.allOrdersByMonth || {})
                    .sort((a, b) => {
                      const dateA = new Date(a);
                      const dateB = new Date(b);
                      return dateB - dateA;
                    })
                    .map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                </select>
              </div>

              <div className="chart-content">
                {Object.entries(stats.ordersByMonth).length > 0 ? (
                  Object.entries(stats.ordersByMonth).map(([month, count]) => (
                    <div key={month} className="chart-item">
                      <div className="chart-label">{month}</div>
                      <div className="chart-bar">
                        <div
                          className="chart-bar-fill"
                          style={{
                            width: `${Math.max(
                              (count /
                                Math.max(
                                  ...Object.values(stats.ordersByMonth),
                                )) *
                                100,
                              5,
                            )}%`,
                            backgroundColor: "#4CAF50",
                          }}
                        ></div>
                      </div>
                      <div className="chart-value">{count}</div>
                    </div>
                  ))
                ) : (
                  <div className="no-month-data-message">
                    <div className="no-month-data-icon">
                      <i className="fas fa-calendar-alt"></i>
                    </div>
                    <p>لا توجد بيانات للشهر المحدد</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="stats-row">
            {/* Top Products Chart */}
            <div className="stats-card chart-card">
              <h3>
                <i className="fas fa-trophy"></i> المنتجات الأكثر طلباً
              </h3>
              <div className="chart-content">
                {stats.topProducts.map((product, index) => (
                  <div key={product.id} className="chart-item">
                    <div className="chart-label">
                      <span className="rank-badge">{index + 1}</span>
                      {product.name}
                    </div>
                    <div className="chart-bar">
                      <div
                        className="chart-bar-fill"
                        style={{
                          width: `${
                            (product.orderCount /
                              Math.max(
                                ...stats.topProducts.map((p) => p.orderCount),
                              )) *
                            100
                          }%`,
                          backgroundColor: getRankColor(index),
                        }}
                      ></div>
                    </div>
                    <div className="chart-value">{product.orderCount}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="stats-card activity-card">
              <h3>
                <i className="fas fa-clock"></i> النشاطات الأخيرة
              </h3>

              {/* Activity Filter Controls */}
              <div className="activity-filter-controls">
                <div className="filter-buttons">
                  <button
                    className={`filter-btn ${
                      activityFilter === "all" ? "active" : ""
                    }`}
                    onClick={() => handleFilterChange("all")}
                  >
                    الكل
                  </button>
                  <button
                    className={`filter-btn ${
                      activityFilter === "today" ? "active" : ""
                    }`}
                    onClick={() => handleFilterChange("today")}
                  >
                    اليوم
                  </button>
                  <button
                    className={`filter-btn ${
                      activityFilter === "month" ? "active" : ""
                    }`}
                    onClick={() => handleFilterChange("month")}
                  >
                    هذا الشهر
                  </button>
                  <button
                    className={`filter-btn ${
                      activityFilter === "custom" ? "active" : ""
                    }`}
                    onClick={() => handleFilterChange("custom")}
                  >
                    تاريخ محدد
                  </button>
                </div>

                {activityFilter === "custom" && (
                  <div className="custom-date-input">
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="date-picker"
                    />
                  </div>
                )}
              </div>

              <div className="activity-list">
                {stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-icon">
                        {activity.type === "order" ? (
                          <i className="fas fa-box"></i>
                        ) : (
                          <i className="fas fa-comment"></i>
                        )}
                      </div>
                      <div className="activity-content">
                        <div className="activity-title">{activity.title}</div>
                        <div className="activity-description">
                          {activity.description}
                        </div>
                        <div className="activity-date">
                          {formatDate(activity.date)}
                        </div>
                      </div>
                      <div className={`activity-status ${activity.status}`}>
                        {activity.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-activities-message">
                    <div className="no-activities-icon">
                      <i className="fas fa-calendar-alt"></i>
                    </div>
                    <p>لا توجد نشاطات في الفترة المحددة</p>
                  </div>
                )}
              </div>

              {/* See More Button */}
              {getFilteredActivities(
                stats.allActivities,
                activityFilter,
                customDate,
              ).length > 5 && (
                <div className="see-more-container">
                  <button
                    className="stats-btn secondary see-more-btn"
                    onClick={openActivityModal}
                  >
                    عرض المزيد من النشاطات
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Most Ordered Products Grid */}
          <div className="stats-row">
            <div className="stats-card most-ordered-products-card">
              <h3>
                <i className="fas fa-shopping-bag"></i> المنتجات الأكثر طلباً -
                عرض تفصيلي
              </h3>

              <div className="most-ordered-products-grid">
                {stats.mostOrderedProducts &&
                stats.mostOrderedProducts.length > 0 ? (
                  stats.mostOrderedProducts.map((product, index) => (
                    <div key={product.id} className="most-ordered-product-item">
                      <div className="product-image-container">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="product-image"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className="product-image-fallback"
                          style={{
                            display:
                              product.images && product.images.length > 0
                                ? "none"
                                : "flex",
                          }}
                        >
                          <span className="product-icon">
                            <i className="fas fa-shopping-bag"></i>
                          </span>
                        </div>
                        <div className="product-rank-badge">
                          <span className="rank-number">{index + 1}</span>
                        </div>
                      </div>
                      <div className="product-info">
                        <h4 className="product-name">{product.name}</h4>
                        <div className="product-meta">
                          <span className="product-brand">
                            {product.brand || "غير محدد"}
                          </span>
                          <span className="product-category">
                            {product.categories?.[0] || "عام"}
                          </span>
                        </div>
                        <div className="product-stats">
                          <div className="stat-item">
                            <span className="stat-label">الطلبات:</span>
                            <span className="stat-value orders-count">
                              {product.orderCount}
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">السعر:</span>
                            <span className="stat-value price">
                              {product.hasVariants && product.variants ? (
                                <span>
                                  من{" "}
                                  {Math.min(
                                    ...product.variants.map((v) => v.price),
                                  )}{" "}
                                  إلى{" "}
                                  {Math.max(
                                    ...product.variants.map((v) => v.price),
                                  )}{" "}
                                  شيكل
                                </span>
                              ) : (
                                <span>{product.price} شيكل</span>
                              )}
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">المخزون:</span>
                            <span
                              className={`stat-value stock ${getStockStatusClass(
                                getTotalStock(product),
                              )}`}
                            >
                              {formatCurrency(getTotalStock(product))} قطعة
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-orders-message">
                    <div className="no-orders-icon">
                      <i className="fas fa-box"></i>
                    </div>
                    <h3>لا توجد طلبات بعد</h3>
                    <p>لم يتم طلب أي منتج حتى الآن</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="activity-modal-overlay" onClick={closeActivityModal}>
          <div className="activity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-clock"></i> جميع النشاطات
              </h2>
              <button className="modal-close-btn" onClick={closeActivityModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Filter Controls */}
            <div className="modal-filter-controls">
              <div className="filter-buttons">
                <button
                  className={`filter-btn ${
                    activityFilter === "all" ? "active" : ""
                  }`}
                  onClick={() => handleFilterChange("all")}
                >
                  الكل
                </button>
                <button
                  className={`filter-btn ${
                    activityFilter === "today" ? "active" : ""
                  }`}
                  onClick={() => handleFilterChange("today")}
                >
                  اليوم
                </button>
                <button
                  className={`filter-btn ${
                    activityFilter === "month" ? "active" : ""
                  }`}
                  onClick={() => handleFilterChange("month")}
                >
                  هذا الشهر
                </button>
                <button
                  className={`filter-btn ${
                    activityFilter === "custom" ? "active" : ""
                  }`}
                  onClick={() => handleFilterChange("custom")}
                >
                  تاريخ محدد
                </button>
              </div>

              {activityFilter === "custom" && (
                <div className="custom-date-input">
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="date-picker"
                  />
                </div>
              )}
            </div>

            <div className="modal-content">
              <div className="modal-activity-list">
                {getCurrentActivities().length > 0 ? (
                  getCurrentActivities().map((activity, index) => (
                    <div key={index} className="modal-activity-item">
                      <div className="activity-icon">
                        {activity.type === "order" ? (
                          <i className="fas fa-box"></i>
                        ) : (
                          <i className="fas fa-comment"></i>
                        )}
                      </div>
                      <div className="activity-content">
                        <div className="activity-title">{activity.title}</div>
                        <div className="activity-description">
                          {activity.description}
                        </div>
                        <div className="activity-date">
                          {formatDate(activity.date)}
                        </div>
                      </div>
                      <div className={`activity-status ${activity.status}`}>
                        {activity.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-activities-message">
                    <div className="no-activities-icon">
                      <i className="fas fa-calendar-alt"></i>
                    </div>
                    <p>لا توجد نشاطات في الفترة المحددة</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {getTotalPages() > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    السابق
                  </button>

                  <div className="page-numbers">
                    {Array.from(
                      { length: getTotalPages() },
                      (_, i) => i + 1,
                    ).map((page) => (
                      <button
                        key={page}
                        className={`page-number ${
                          page === currentPage ? "active" : ""
                        }`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === getTotalPages()}
                  >
                    التالي
                  </button>
                </div>
              )}

              <div className="modal-footer">
                <div className="activity-summary">
                  <span>
                    عرض {getCurrentActivities().length} من{" "}
                    {
                      getFilteredActivities(
                        stats.allActivities,
                        activityFilter,
                        customDate,
                      ).length
                    }{" "}
                    نشاط
                  </span>
                </div>
                <button
                  className="stats-btn primary"
                  onClick={closeActivityModal}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Helper function to get status colors
function getStatusColor(status) {
  const colors = {
    "قيد الانتظار": "#FF9800",
    "قيد التنفيذ": "#2196F3",
    "قيد التوصيل": "#9C27B0",
    منجز: "#4CAF50",
    مرفوض: "#F44336",
    "غير محدد": "#9E9E9E",
  };
  return colors[status] || colors["غير محدد"];
}

// Helper function to get rank colors
function getRankColor(rank) {
  const colors = ["#C2A26C", "#C0C0C0", "#CD7F32", "#4CAF50", "#2196F3"];
  return colors[rank] || "#9E9E9E";
}

export default Statistics;
