import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import "../css/Orders.css";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import { CacheManager, CACHE_KEYS } from "../utils/cache";
import { useNavigate, Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import toast from "react-hot-toast";

// صفحة عرض الطلبات وإدارتها
function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // Add search term
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" }); // Add date filter
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [stats, setStats] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5); // 5 orders per page
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const statuses = [
    "قيد الانتظار",
    "قيد التنفيذ",
    "قيد التوصيل",
    "منجز",
    "مرفوض",
  ];

  // Force refresh function
  const forceRefresh = async () => {
    setRefreshing(true);
    // Clear cache
    CacheManager.remove(CACHE_KEYS.ORDERS);
    await fetchOrders(true);
    setRefreshing(false);
  };

  // Modified fetch function with force parameter
  const fetchOrders = async (forceRefresh = false) => {
    try {
      // For orders, use very short cache (30 seconds) or force refresh
      const cacheTime = 30 * 1000; // 30 seconds
      const cachedOrders = !forceRefresh
        ? CacheManager.get(CACHE_KEYS.ORDERS)
        : null;

      if (cachedOrders && !forceRefresh) {
        setOrders(cachedOrders);
        calculateStats(cachedOrders);
        setLastFetch(
          new Date(
            JSON.parse(localStorage.getItem(CACHE_KEYS.ORDERS))?.timestamp,
          ),
        );
        return;
      }

      const snapshot = await getDocs(collection(db, "orders"));
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));

      // ترتيب الطلبات حسب التاريخ (الأحدث أولاً)
      data.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );

      setOrders(data);
      setLastFetch(new Date());

      // Cache for only 30 seconds for orders
      CacheManager.set(CACHE_KEYS.ORDERS, data, cacheTime);

      calculateStats(data);
    } catch (error) {
      // بيانات تجريبية
      setOrders([
        {
          id: "order1",
          customerName: "أحمد",
          customerEmail: "ahmed@example.com",
          customerPhone: "0590xxxxxx",
          customerAddress: "شارع xx، نابلس",
          items: [{ id: "1", name: "كريم مرطب", price: 50, quantity: 2 }],
          total: 100,
          status: "قيد الانتظار",
          createdAt: { seconds: Date.now() / 1000 },
        },
      ]);
    }
  };

  function calculateStats(ordersData) {
    // حساب الإحصائيات
    const orderStats = statuses.reduce((acc, status) => {
      acc[status] = ordersData.filter(
        (order) => order.status === status,
      ).length;
      return acc;
    }, {});
    orderStats.total = ordersData.length;
    orderStats.totalRevenue = ordersData
      .filter((order) => order.status === "منجز")
      .reduce((sum, order) => sum + (order.total || 0), 0);
    setStats(orderStats);
  }

  // Auto-refresh every 2 minutes when component is visible
  useEffect(() => {
    let interval;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Refresh when user comes back to tab
        forceRefresh();
      }
    };

    // Initial fetch
    fetchOrders();

    // Set up auto-refresh every 2 minutes
    interval = setInterval(
      () => {
        if (document.visibilityState === "visible") {
          fetchOrders(true); // Force refresh every 2 minutes
        }
      },
      2 * 60 * 1000,
    ); // 2 minutes

    // Listen for tab visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const currentOrder = orders.find((order) => order.id === orderId);

      if (!currentOrder) {
        return;
      }

      const oldStatus = currentOrder.status;

      // Skip if status hasn't actually changed
      if (oldStatus === newStatus) {
        return;
      }

      // Use Firestore transaction to ensure data consistency for stock changes
      const result = await runTransaction(db, async (transaction) => {
        const stockUpdates = [];

        // Handle stock changes based on status transitions
        // Process each item individually to handle multiple variants of the same product
        for (const item of currentOrder.items || []) {
          const productRef = doc(db, "products", item.id);
          const productSnap = await transaction.get(productRef);

          if (productSnap.exists()) {
            const productData = productSnap.data();
            let stockUpdateData = {};
            let shouldUpdateStock = false;

            if (productData.hasVariants && item.selectedVariant) {
              // For variant products
              const updatedVariants = productData.variants.map((v) => {
                if (
                  v.size === item.selectedVariant.size &&
                  v.color === item.selectedVariant.color
                ) {
                  let newStock = parseInt(v.stock || 0);

                  // Stock restoration logic
                  if (newStatus === "مرفوض" && oldStatus !== "مرفوض") {
                    // Changing TO rejected: restore stock
                    newStock += item.quantity;
                    shouldUpdateStock = true;
                  } else if (oldStatus === "مرفوض" && newStatus !== "مرفوض") {
                    // Changing FROM rejected: deduct stock
                    newStock -= item.quantity;
                    shouldUpdateStock = true;

                    // Check if we have enough stock
                    if (newStock < 0) {
                      throw new Error(
                        `المخزون غير كافي للمنتج ${item.name} (${item.selectedVariant.size} - ${item.selectedVariant.color}). المتوفر: ${v.stock}، المطلوب: ${item.quantity}`,
                      );
                    }
                  }

                  return {
                    ...v,
                    stock: Math.max(0, newStock),
                  };
                }
                return v;
              });

              stockUpdateData = { variants: updatedVariants };
            } else {
              // For regular products
              let newStock = parseInt(productData.stock || 0);

              // Stock restoration logic
              if (newStatus === "مرفوض" && oldStatus !== "مرفوض") {
                // Changing TO rejected: restore stock
                newStock += item.quantity;
                shouldUpdateStock = true;
              } else if (oldStatus === "مرفوض" && newStatus !== "مرفوض") {
                // Changing FROM rejected: deduct stock
                newStock -= item.quantity;
                shouldUpdateStock = true;

                // Check if we have enough stock
                if (newStock < 0) {
                  throw new Error(
                    `المخزون غير كافي للمنتج ${item.name}. المتوفر: ${productData.stock}، المطلوب: ${item.quantity}`,
                  );
                }
              }

              stockUpdateData = {
                stock: Math.max(0, newStock),
              };
            }

            if (shouldUpdateStock) {
              // Create a unique key for each item to handle multiple variants of the same product
              const itemKey = item.selectedVariant
                ? `${item.id}-${item.selectedVariant.size}-${item.selectedVariant.color}`
                : item.id;

              stockUpdates.push({
                ref: productRef,
                updateData: stockUpdateData,
                itemKey: itemKey, // Add unique identifier
                item: item, // Store the item for reference
              });
            }
          }
        }

        // Apply all stock updates, handling multiple variants of the same product
        const productUpdates = new Map(); // Use Map to group updates by product

        // Group updates by product ID
        stockUpdates.forEach(({ ref, updateData, itemKey, item }) => {
          const productId = ref.id;

          if (!productUpdates.has(productId)) {
            productUpdates.set(productId, {
              ref: ref,
              updates: [],
              productData: null,
            });
          }

          productUpdates.get(productId).updates.push({
            updateData,
            itemKey,
            item,
          });
        });

        // Apply updates for each product, merging variant updates
        for (const [productId, productUpdate] of productUpdates) {
          const { ref, updates } = productUpdate;

          if (updates.length === 1) {
            // Single update, apply directly
            transaction.update(ref, updates[0].updateData);
          } else {
            // Multiple updates for the same product (different variants)
            // Need to merge the updates properly
            const productSnap = await transaction.get(ref);
            if (productSnap.exists()) {
              const currentProductData = productSnap.data();

              if (currentProductData.hasVariants) {
                // For variant products, merge all variant updates
                const updatedVariants = [...currentProductData.variants];

                updates.forEach(({ updateData, item }) => {
                  if (item.selectedVariant) {
                    const variantIndex = updatedVariants.findIndex(
                      (v) =>
                        v.size === item.selectedVariant.size &&
                        v.color === item.selectedVariant.color,
                    );

                    if (variantIndex !== -1) {
                      updatedVariants[variantIndex] = updateData.variants.find(
                        (v) =>
                          v.size === item.selectedVariant.size &&
                          v.color === item.selectedVariant.color,
                      );
                    }
                  }
                });

                transaction.update(ref, { variants: updatedVariants });
              } else {
                // For regular products, this shouldn't happen but handle it

                transaction.update(ref, updates[updates.length - 1].updateData);
              }
            }
          }
        }

        // Update order status
        transaction.update(orderRef, { status: newStatus });

        return "success";
      });

      // Transaction successful - update local state
      const updatedOrders = orders.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order,
      );
      setOrders(updatedOrders);

      // Update cache with short TTL and refresh stats
      CacheManager.set(CACHE_KEYS.ORDERS, updatedOrders, 30 * 1000);
      calculateStats(updatedOrders);

      // Show success message for stock changes
      if (oldStatus === "مرفوض" && newStatus !== "مرفوض") {
      } else if (newStatus === "مرفوض" && oldStatus !== "مرفوض") {
      }

      toast.success("تم تحديث حالة الطلب بنجاح");

      // Optionally fetch fresh data after status change
      setTimeout(() => fetchOrders(true), 1000);
    } catch (error) {
      toast.error(`حدث خطأ أثناء تحديث حالة الطلب: ${error.message}`);
    }
  };

  const toggleOrderExpansion = (orderId) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleDeleteOrder = async (orderId) => {
    const confirmDelete = await new Promise((resolve) => {
      const toastId = toast(
        (t) => (
          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: "15px", fontWeight: "bold" }}>
              هل تريد حذف هذا الطلب؟
            </p>
            <div
              style={{ display: "flex", gap: "10px", justifyContent: "center" }}
            >
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(true);
                }}
                style={{
                  padding: "8px 20px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                حذف
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(false);
                }}
                style={{
                  padding: "8px 20px",
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        ),
        { duration: Infinity },
      );
    });
    if (!confirmDelete) return;

    try {
      // Find the order to get its items before deletion
      const orderToDelete = orders.find((order) => order.id === orderId);
      if (!orderToDelete) {
        return;
      }

      // Use Firestore transaction to ensure data consistency
      const result = await runTransaction(db, async (transaction) => {
        // First, restore stock for all items in the order
        const stockRestorations = [];

        for (const item of orderToDelete.items || []) {
          const productRef = doc(db, "products", item.id);
          const productSnap = await transaction.get(productRef);

          if (productSnap.exists()) {
            const productData = productSnap.data();
            let stockUpdateData = {};

            if (productData.hasVariants && item.selectedVariant) {
              // For variant products, restore specific variant stock
              const updatedVariants = productData.variants.map((v) => {
                if (
                  v.size === item.selectedVariant.size &&
                  v.color === item.selectedVariant.color
                ) {
                  return {
                    ...v,
                    stock: parseInt(v.stock || 0) + item.quantity,
                  };
                }
                return v;
              });

              stockUpdateData = { variants: updatedVariants };
            } else {
              // For regular products, restore product stock
              stockUpdateData = {
                stock: parseInt(productData.stock || 0) + item.quantity,
              };
            }

            stockRestorations.push({
              ref: productRef,
              updateData: stockUpdateData,
            });
          }
        }

        // Restore stock for all products
        stockRestorations.forEach(({ ref, updateData }) => {
          transaction.update(ref, updateData);
        });

        // Delete the order
        const orderRef = doc(db, "orders", orderId);
        transaction.delete(orderRef);

        return "success";
      });

      // Transaction successful
      const updatedOrders = orders.filter((order) => order.id !== orderId);
      setOrders(updatedOrders);

      // Update cache and stats
      CacheManager.set(CACHE_KEYS.ORDERS, updatedOrders, 30 * 1000);
      calculateStats(updatedOrders);

      toast.success("تم حذف الطلب بنجاح");

      // Fetch fresh data after deletion
      setTimeout(() => fetchOrders(true), 1000);
    } catch (error) {
      toast.error("حدث خطأ أثناء حذف الطلب. يرجى المحاولة مرة أخرى.");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      "قيد الانتظار": "#C2A26C",
      "قيد التنفيذ": "#8B857E",
      "قيد التوصيل": "#8B857E",
      منجز: "#7A8F6A",
      مرفوض: "#A14A3B",
    };
    return colors[status] || "#95a5a6";
  };

  // Enhanced filtering function
  const getFilteredOrders = () => {
    let filtered = orders;

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Filter by search term (customer name, email, phone, or order ID)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.customerName?.toLowerCase().includes(searchLower) ||
          order.customerEmail?.toLowerCase().includes(searchLower) ||
          order.customerPhone?.toLowerCase().includes(searchLower) ||
          order.id?.toLowerCase().includes(searchLower),
      );
    }

    // Filter by date range
    if (dateFilter.start || dateFilter.end) {
      filtered = filtered.filter((order) => {
        if (!order.createdAt?.seconds) return false;
        const orderDate = new Date(order.createdAt.seconds * 1000);
        const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
        const endDate = dateFilter.end
          ? new Date(dateFilter.end + "T23:59:59")
          : null;

        if (startDate && orderDate < startDate) return false;
        if (endDate && orderDate > endDate) return false;
        return true;
      });
    }

    return filtered;
  };

  const filteredOrders = getFilteredOrders();

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, dateFilter]);

  const handleDateFilterChange = (field, value) => {
    setDateFilter((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setStatusFilter("");
    setSearchTerm("");
    setDateFilter({ start: "", end: "" });
  };

  // تنسيق التاريخ من الطابع الزمني
  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "numeric", // Changed from "long" to "numeric"
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Navbar />
      <div className="orders-page">
        <div className="orders-header">
          <h1>إدارة الطلبات</h1>
          <div className="orders-actions">
            <button
              className="refresh-btn"
              onClick={forceRefresh}
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
            {lastFetch && (
              <span className="last-update">
                آخر تحديث: {lastFetch.toLocaleTimeString("en-US")}
              </span>
            )}
          </div>
        </div>

        {/* Stock Management Note */}
        <div className="orders-stock-note">
          <div className="stock-note-content">
            <span className="stock-note-icon">
              <i className="fas fa-box"></i>
            </span>
            <span className="stock-note-text">
              <strong>ملاحظة:</strong> يتم إدارة المخزون تلقائياً. عند حذف الطلب
              أو رفضه، يتم إرجاع الكميات إلى المخزون.
            </span>
          </div>
        </div>

        {/* Real-time indicator */}
        <div className="realtime-status">
          <div
            className={`status-indicator ${refreshing ? "updating" : "live"}`}
          >
            <span className="status-dot"></span>
            {refreshing ? "جاري التحديث..." : "البيانات محدثة"}
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="orders-stats">
          <div className="ord-stat-card">
            <h3>إجمالي الطلبات</h3>
            <p className="ord-stat-number">{stats.total || 0}</p>
          </div>
          <div className="ord-stat-card ord-pending">
            <h3>قيد الانتظار</h3>
            <p className="ord-stat-number">{stats["قيد الانتظار"] || 0}</p>
          </div>
          <div className="ord-stat-card ord-completed">
            <h3>منجز</h3>
            <p className="ord-stat-number">{stats["منجز"] || 0}</p>
          </div>
          <div className="ord-stat-card ord-revenue">
            <h3>إجمالي المبيعات</h3>
            <p className="ord-stat-number">{stats.totalRevenue || 0} شيكل</p>
          </div>
        </div>

        <div className="orders-controls">
          <div className="search-section">
            <label>البحث في الطلبات:</label>
            <input
              type="text"
              placeholder="ابحث بالاسم، الإيميل، الهاتف، أو رقم الطلب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ord-search-input"
            />
          </div>

          <div className="date-filter-section">
            <label>تصفية حسب التاريخ:</label>
            <div className="ord-date-inputs">
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) =>
                  handleDateFilterChange("start", e.target.value)
                }
                className="ord-date-input"
                placeholder="من تاريخ"
              />
              <span>إلى</span>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => handleDateFilterChange("end", e.target.value)}
                className="ord-date-input"
                placeholder="إلى تاريخ"
              />
            </div>
          </div>

          <div className="filter-section">
            <label>تصفية الحالة:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">كل الحالات</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status} ({stats[status] || 0})
                </option>
              ))}
            </select>
          </div>

          <button className="ord-clear-filters-btn" onClick={clearFilters}>
            مسح الفلاتر
          </button>

          <div className="orders-count">
            عرض {indexOfFirstItem + 1}-
            {Math.min(indexOfLastItem, filteredOrders.length)} من{" "}
            {filteredOrders.length} طلب
          </div>
        </div>

        <div className="orders-container">
          {currentOrders.map((order) => (
            <div key={order.id} className="ord-card">
              <div
                className="ord-header"
                onClick={() => toggleOrderExpansion(order.id)}
              >
                <div className="ord-basic-info">
                  <div className="ord-id">#{order.id}</div>
                  <div className="ord-customer-name">{order.customerName}</div>
                  <div className="ord-date">{formatDate(order.createdAt)}</div>
                  <div className="ord-total">{order.total} شيكل</div>
                  <div
                    className="ord-status"
                    style={{ backgroundColor: getStatusColor(order.status) }}
                  >
                    {order.status}
                  </div>
                  <button className="ord-expand-btn">
                    {expandedOrders.has(order.id) ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {expandedOrders.has(order.id) && (
                <div className="ord-details">
                  <div className="ord-customer-details">
                    <h4>معلومات العميل:</h4>
                    <p>
                      <strong>
                        <i className="fas fa-user"></i> الاسم:
                      </strong>{" "}
                      {order.customerName}
                    </p>
                    <p>
                      <strong>
                        <i className="fas fa-whatsapp"></i> الواتساب:
                      </strong>{" "}
                      {order.customerPhone}
                    </p>
                    <p>
                      <strong>
                        <i className="fas fa-map-marker-alt"></i> العنوان:
                      </strong>{" "}
                      {order.customerAddress}
                    </p>
                  </div>

                  {/* Order Summary with Variant Info */}

                  {/* Delivery Information */}
                  {(order.deliveryFee || order.deliveryOption) && (
                    <div className="ord-delivery-info">
                      <h4>معلومات التوصيل:</h4>
                      <div className="ord-delivery-details">
                        {order.deliveryOption && (
                          <div className="ord-delivery-item">
                            <span className="ord-delivery-label">
                              منطقة التوصيل:
                            </span>
                            <span className="ord-delivery-value">
                              {order.deliveryOption}
                            </span>
                          </div>
                        )}
                        {order.deliveryFee && (
                          <div className="ord-delivery-item">
                            <span className="ord-delivery-label">
                              رسوم التوصيل:
                            </span>
                            <span className="ord-delivery-value">
                              {order.deliveryFee} شيكل
                            </span>
                          </div>
                        )}
                        {order.subtotal && (
                          <div className="ord-delivery-item">
                            <span className="ord-delivery-label">
                              المجموع الفرعي:
                            </span>
                            <span className="ord-delivery-value">
                              {order.subtotal} شيكل
                            </span>
                          </div>
                        )}
                        {order.coupon && (
                          <div className="ord-delivery-item ord-coupon-item">
                            <span className="ord-delivery-label">
                              كوبون الخصم ({order.coupon.code}):
                            </span>
                            <span className="ord-delivery-value ord-coupon-discount">
                              -{order.coupon.couponDiscount.toFixed(2)} شيكل
                            </span>
                          </div>
                        )}
                        <div className="ord-delivery-item ord-delivery-total">
                          <span className="ord-delivery-label">
                            الإجمالي النهائي:
                          </span>
                          <span className="ord-delivery-value">
                            {order.total} شيكل
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="ord-items">
                    <h4>تفاصيل الطلب:</h4>
                    <table className="ord-items-table">
                      <thead>
                        <tr>
                          <th>المنتج</th>
                          <th>السعر</th>
                          <th>الكمية</th>
                          <th>المجموع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items?.map((item, index) => (
                          <tr key={index}>
                            <td>
                              <div className="ord-item-details">
                                {item.id ? (
                                  <Link
                                    to={`/products/${item.id}`}
                                    target="_blank"
                                    className="ord-product-link"
                                    onClick={(e) => e.stopPropagation()}
                                    title={`عرض تفاصيل ${item.name}`}
                                  >
                                    {item.name}
                                    <span className="ord-link-icon">
                                      <i className="fas fa-external-link-alt"></i>
                                    </span>
                                  </Link>
                                ) : (
                                  <span className="ord-product-name">
                                    {item.name}
                                    <span
                                      className="ord-no-link-note"
                                      title="معرف المنتج غير متوفر"
                                    >
                                      <i className="fas fa-box"></i>
                                    </span>
                                  </span>
                                )}

                                {/* Show variant information if available */}
                                {item.selectedVariant && (
                                  <div className="ord-variant-info">
                                    <span className="ord-variant-badge">
                                      متغير: {item.selectedVariant.size} -{" "}
                                      {item.selectedVariant.color}
                                    </span>
                                    <span className="ord-variant-price">
                                      سعر المتغير:{" "}
                                      {parseFloat(item.selectedVariant.price) ||
                                        item.price}{" "}
                                      شيكل
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              {item.selectedVariant &&
                              item.selectedVariant.price
                                ? `${parseFloat(
                                    item.selectedVariant.price,
                                  )} شيكل`
                                : `${item.price} شيكل`}
                            </td>
                            <td>{item.quantity}</td>
                            <td>
                              {(() => {
                                const itemPrice =
                                  item.selectedVariant &&
                                  item.selectedVariant.price
                                    ? parseFloat(item.selectedVariant.price)
                                    : item.price;
                                return `${itemPrice * item.quantity} شيكل`;
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="ord-actions">
                    <div className="status-update">
                      <label>تحديث الحالة:</label>
                      <select
                        value={order.status}
                        onChange={(e) =>
                          handleStatusChange(order.id, e.target.value)
                        }
                        className="ord-status-select"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="ord-action-buttons">
                      <button
                        className="ord-action-btn ord-whatsapp-btn"
                        onClick={() => {
                          const message =
                            `مرحباً ${order.customerName}،\n\n` +
                            `تأكيد الطلب #${order.id}\n` +
                            `━━━━━━━━━━━━━━━\n\n` +
                            `المنتجات:\n` +
                            order.items
                              .map(
                                (item, index) =>
                                  `${index + 1}. ${item.name}${item.selectedVariant ? ` (${item.selectedVariant.size} - ${item.selectedVariant.color})` : ""}\n` +
                                  `   الكمية: ${item.quantity}\n` +
                                  `   السعر: ${item.selectedVariant?.price || item.price} شيكل\n`,
                              )
                              .join("\n") +
                            `\n━━━━━━━━━━━━━━━\n` +
                            `المجموع الفرعي: ${order.subtotal} شيكل\n` +
                            `رسوم التوصيل: ${order.deliveryFee} شيكل\n` +
                            (order.coupon
                              ? `خصم الكوبون (${order.coupon.code}): -${order.coupon.couponDiscount.toFixed(2)} شيكل\n`
                              : "") +
                            `الإجمالي: ${order.total} شيكل\n\n` +
                            `التوصيل: ${order.deliveryOption}\n` +
                            `العنوان: ${order.customerAddress}\n\n` +
                            `الحالة: ${order.status}\n\n` +
                            `شكراً لك! 💚`;

                          const whatsappUrl = `https://wa.me/${order.customerPhone.replace(/\+/g, "")}?text=${encodeURIComponent(message)}`;
                          window.open(whatsappUrl, "_blank");
                        }}
                      >
                        <i className="fab fa-whatsapp"></i> تأكيد عبر واتساب
                      </button>
                      <button
                        className="ord-action-btn ord-delete-btn"
                        onClick={() => handleDeleteOrder(order.id)}
                      >
                        <i className="fas fa-trash-alt"></i> حذف
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="ord-pagination">
            <button
              className="ord-pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              السابق
            </button>

            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  className={`ord-pagination-btn ${
                    currentPage === pageNumber ? "active" : ""
                  }`}
                  onClick={() => handlePageChange(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              className="ord-pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              التالي
            </button>
          </div>
        )}

        {filteredOrders.length === 0 && (
          <div className="ord-no-orders">
            <p>لا توجد طلبات {statusFilter ? `بحالة "${statusFilter}"` : ""}</p>
          </div>
        )}
      </div>
    </>
  );
}

export default Orders;
