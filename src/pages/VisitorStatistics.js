import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import "../css/VisitorStatistics.css";

const VisitorStatistics = () => {
  const [stats, setStats] = useState({
    totalVisitors: 0,
    currentVisitors: 0,
    rangeVisitors: 0,
    peakVisitorsToday: 0,
    totalOrders: 0,
    rangeOrders: 0,
  });

  const [dateRange, setDateRange] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  // الحصول على بداية ونهاية اليوم بتوقيت فلسطين
  const getPalestineTimeRange = (daysBack = 0) => {
    const now = new Date();

    // تحويل إلى توقيت فلسطين
    const palestineTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Gaza" }),
    );

    const start = new Date(palestineTime);
    start.setDate(start.getDate() - daysBack);
    start.setHours(0, 0, 0, 0);

    const end = new Date(palestineTime);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  };

  // الحصول على نطاق التاريخ بناءً على الاختيار
  const getDateRange = () => {
    switch (dateRange) {
      case "today":
        return getPalestineTimeRange(0);
      case "week":
        return getPalestineTimeRange(7);
      case "month":
        return getPalestineTimeRange(30);
      case "custom":
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return getPalestineTimeRange(0);
      default:
        return getPalestineTimeRange(0);
    }
  };

  // جلب إجمالي الزوار
  const fetchTotalVisitors = async () => {
    try {
      const visitorsRef = collection(db, "visitors");
      const snapshot = await getDocs(visitorsRef);
      return snapshot.size;
    } catch (error) {
      console.error("Error fetching total visitors:", error);
      return 0;
    }
  };

  // جلب زوار النطاق المحدد
  const fetchVisitorsInRange = async () => {
    try {
      const { start, end } = getDateRange();
      const visitorsRef = collection(db, "visitors");
      const q = query(
        visitorsRef,
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<=", Timestamp.fromDate(end)),
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error("Error fetching visitors in range:", error);
      return 0;
    }
  };

  // جلب أعلى عدد زوار متزامنين
  const fetchPeakVisitors = async () => {
    try {
      const { start, end } = getDateRange();
      const peakRef = collection(db, "peakVisitors");
      const q = query(
        peakRef,
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<=", Timestamp.fromDate(end)),
        orderBy("count", "desc"),
        limit(1),
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].data().count;
      }
      return 0;
    } catch (error) {
      console.error("Error fetching peak visitors:", error);
      return 0;
    }
  };

  // جلب عدد الطلبات
  const fetchOrders = async () => {
    try {
      const ordersRef = collection(db, "orders");

      // إجمالي الطلبات
      const totalSnapshot = await getDocs(ordersRef);
      const totalOrders = totalSnapshot.size;

      // طلبات النطاق المحدد
      const { start, end } = getDateRange();
      const q = query(
        ordersRef,
        where("createdAt", ">=", Timestamp.fromDate(start)),
        where("createdAt", "<=", Timestamp.fromDate(end)),
      );
      const rangeSnapshot = await getDocs(q);
      const rangeOrders = rangeSnapshot.size;

      return { totalOrders, rangeOrders };
    } catch (error) {
      console.error("Error fetching orders:", error);
      return { totalOrders: 0, rangeOrders: 0 };
    }
  };

  // تحديث الإحصائيات
  const updateStatistics = async () => {
    setLoading(true);
    try {
      const [totalVisitors, rangeVisitors, peakVisitors, orders] =
        await Promise.all([
          fetchTotalVisitors(),
          fetchVisitorsInRange(),
          fetchPeakVisitors(),
          fetchOrders(),
        ]);

      setStats((prev) => ({
        ...prev,
        totalVisitors,
        rangeVisitors,
        peakVisitorsToday: peakVisitors,
        totalOrders: orders.totalOrders,
        rangeOrders: orders.rangeOrders,
      }));
    } catch (error) {
      console.error("Error updating statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  // مراقبة الزوار الحاليين في الوقت الفعلي
  useEffect(() => {
    const currentVisitorsRef = collection(db, "activeVisitors");

    const unsubscribe = onSnapshot(currentVisitorsRef, (snapshot) => {
      const count = snapshot.size;
      setStats((prev) => ({
        ...prev,
        currentVisitors: count,
      }));
    });

    return () => unsubscribe();
  }, []);

  // تحديث الإحصائيات عند تغيير النطاق
  useEffect(() => {
    updateStatistics();
  }, [dateRange, customStartDate, customEndDate]);

  const getRangeLabel = () => {
    switch (dateRange) {
      case "today":
        return "اليوم";
      case "week":
        return "آخر 7 أيام";
      case "month":
        return "آخر 30 يوم";
      case "custom":
        return "فترة مخصصة";
      default:
        return "اليوم";
    }
  };

  return (
    <>
      <Navbar />
      <div className="visitor-statistics-container">
        <div className="visitor-statistics-header">
          <h1>
            <i className="fas fa-chart-bar"></i> إحصائيات الزوار
          </h1>

          <div className="date-range-selector">
            <label>اختر النطاق الزمني:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="range-select"
            >
              <option value="today">اليوم</option>
              <option value="week">آخر 7 أيام</option>
              <option value="month">آخر 30 يوم</option>
              <option value="custom">فترة مخصصة</option>
            </select>

            {dateRange === "custom" && (
              <div className="custom-date-range">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="date-input"
                />
                <span>إلى</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="date-input"
                />
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading">جاري تحميل الإحصائيات...</div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card total">
              <div className="stat-icon">
                <i className="fas fa-users"></i>
              </div>
              <div className="stat-content">
                <h3>عدد الزوار الكلي</h3>
                <p className="stat-number">
                  {stats.totalVisitors.toLocaleString()}
                </p>
                <span className="stat-label">منذ إنشاء الموقع</span>
              </div>
            </div>

            <div className="stat-card current">
              <div className="stat-icon live">
                <i className="fas fa-circle"></i>
              </div>
              <div className="stat-content">
                <h3>الزوار الحاليين</h3>
                <p className="stat-number">
                  {stats.currentVisitors.toLocaleString()}
                </p>
                <span className="stat-label">متصلين الآن</span>
              </div>
            </div>

            <div className="stat-card range">
              <div className="stat-icon">
                <i className="fas fa-calendar-day"></i>
              </div>
              <div className="stat-content">
                <h3>زوار {getRangeLabel()}</h3>
                <p className="stat-number">
                  {stats.rangeVisitors.toLocaleString()}
                </p>
                <span className="stat-label">بتوقيت فلسطين</span>
              </div>
            </div>

            <div className="stat-card peak">
              <div className="stat-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <div className="stat-content">
                <h3>أعلى عدد متزامنين</h3>
                <p className="stat-number">
                  {stats.peakVisitorsToday.toLocaleString()}
                </p>
                <span className="stat-label">{getRangeLabel()}</span>
              </div>
            </div>

            <div className="stat-card orders-total">
              <div className="stat-icon">
                <i className="fas fa-shopping-cart"></i>
              </div>
              <div className="stat-content">
                <h3>إجمالي الطلبات</h3>
                <p className="stat-number">
                  {stats.totalOrders.toLocaleString()}
                </p>
                <span className="stat-label">جميع الأوقات</span>
              </div>
            </div>

            <div className="stat-card orders-range">
              <div className="stat-icon">
                <i className="fas fa-box"></i>
              </div>
              <div className="stat-content">
                <h3>طلبات {getRangeLabel()}</h3>
                <p className="stat-number">
                  {stats.rangeOrders.toLocaleString()}
                </p>
                <span className="stat-label">خلال الفترة المحددة</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={updateStatistics}
          className="refresh-btn"
          disabled={loading}
        >
          <i className="fas fa-sync-alt"></i> تحديث الإحصائيات
        </button>
      </div>
    </>
  );
};

export default VisitorStatistics;
