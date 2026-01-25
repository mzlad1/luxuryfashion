import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  increment,
} from "firebase/firestore";

// إنشاء معرف فريد للجلسة
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// الحصول على معرف الجلسة من localStorage أو إنشاء واحد جديد
// استخدام localStorage بدلاً من sessionStorage لمنع التكرار عبر التبويبات
const getOrCreateSessionId = () => {
  let sessionId = localStorage.getItem("visitorSessionId");
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem("visitorSessionId", sessionId);
  }
  return sessionId;
};

// تسجيل زيارة جديدة
export const trackVisitor = async () => {
  try {
    const sessionId = getOrCreateSessionId();
    const visitorsRef = collection(db, "visitors");

    // التحقق مما إذا كانت الزيارة مسجلة بالفعل لهذه الجلسة
    // استخدام localStorage لمنع التكرار عبر التبويبات المتعددة
    const existingVisit = localStorage.getItem("visitTracked");

    if (!existingVisit) {
      // تسجيل الزيارة
      await addDoc(visitorsRef, {
        sessionId,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        referrer: document.referrer || "direct",
      });

      localStorage.setItem("visitTracked", "true");
      console.log("تم تسجيل الزيارة");
    }

    // إضافة الزائر إلى قائمة الزوار النشطين
    await trackActiveVisitor(sessionId);
  } catch (error) {
    console.error("خطأ في تسجيل الزيارة:", error);
  }
};

// تتبع الزوار النشطين (المتصلين حالياً)
let activityInterval = null; // تخزين مرجع interval لمنع التكرار

export const trackActiveVisitor = async (sessionId) => {
  try {
    const activeVisitorRef = doc(db, "activeVisitors", sessionId);

    // إضافة أو تحديث الزائر النشط
    await setDoc(
      activeVisitorRef,
      {
        sessionId,
        lastActivity: serverTimestamp(),
        isActive: true,
      },
      { merge: true },
    );

    // تتبع عدد التبويبات المفتوحة
    let tabCount = parseInt(localStorage.getItem("activeTabCount") || "0");
    tabCount++;
    localStorage.setItem("activeTabCount", tabCount.toString());

    // تحديث آخر نشاط كل 30 ثانية (فقط مرة واحدة)
    if (!activityInterval) {
      activityInterval = setInterval(async () => {
        try {
          await updateDoc(activeVisitorRef, {
            lastActivity: serverTimestamp(),
          });
        } catch (error) {
          console.error("خطأ في تحديث النشاط:", error);
          clearInterval(activityInterval);
          activityInterval = null;
        }
      }, 30000); // كل 30 ثانية
    }

    // إزالة الزائر عند مغادرة الصفحة (فقط إذا كانت آخر تبويبة)
    const handleBeforeUnload = async () => {
      let currentTabCount = parseInt(
        localStorage.getItem("activeTabCount") || "0",
      );
      currentTabCount--;

      if (currentTabCount <= 0) {
        // آخر تبويبة - إزالة الزائر من قائمة النشطين
        localStorage.setItem("activeTabCount", "0");
        if (activityInterval) {
          clearInterval(activityInterval);
          activityInterval = null;
        }
        await removeActiveVisitor(sessionId);
      } else {
        localStorage.setItem("activeTabCount", currentTabCount.toString());
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // تتبع أعلى عدد زوار متزامنين
    await trackPeakVisitors();
  } catch (error) {
    console.error("خطأ في تتبع الزائر النشط:", error);
  }
};

// إزالة زائر من القائمة النشطة
export const removeActiveVisitor = async (sessionId) => {
  try {
    const activeVisitorRef = doc(db, "activeVisitors", sessionId);
    await deleteDoc(activeVisitorRef);
  } catch (error) {
    console.error("خطأ في إزالة الزائر النشط:", error);
  }
};

// تتبع أعلى عدد زوار متزامنين
export const trackPeakVisitors = async () => {
  try {
    const activeVisitorsRef = collection(db, "activeVisitors");
    const snapshot = await getDocs(activeVisitorsRef);
    const currentCount = snapshot.size;

    // الحصول على تاريخ اليوم بتوقيت فلسطين
    const now = new Date();
    const palestineTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Gaza" }),
    );
    const today = new Date(
      palestineTime.getFullYear(),
      palestineTime.getMonth(),
      palestineTime.getDate(),
    );

    // التحقق من السجل الحالي لليوم
    const peakRef = collection(db, "peakVisitors");
    const q = query(peakRef, where("date", ">=", Timestamp.fromDate(today)));

    const peakSnapshot = await getDocs(q);

    if (peakSnapshot.empty) {
      // إنشاء سجل جديد لليوم
      await addDoc(peakRef, {
        count: currentCount,
        timestamp: serverTimestamp(),
        date: Timestamp.fromDate(today),
      });
    } else {
      // تحديث السجل إذا كان العدد الحالي أكبر
      const peakDoc = peakSnapshot.docs[0];
      const peakData = peakDoc.data();

      if (currentCount > peakData.count) {
        await updateDoc(doc(db, "peakVisitors", peakDoc.id), {
          count: currentCount,
          timestamp: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.error("خطأ في تتبع أعلى عدد زوار:", error);
  }
};

// تنظيف الزوار غير النشطين (الذين لم يتم تحديث نشاطهم منذ أكثر من دقيقتين)
export const cleanupInactiveVisitors = async () => {
  try {
    const activeVisitorsRef = collection(db, "activeVisitors");
    const snapshot = await getDocs(activeVisitorsRef);

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    snapshot.forEach(async (docSnapshot) => {
      const data = docSnapshot.data();
      const lastActivity = data.lastActivity?.toDate();

      if (lastActivity && lastActivity < twoMinutesAgo) {
        await deleteDoc(doc(db, "activeVisitors", docSnapshot.id));
      }
    });
  } catch (error) {
    console.error("خطأ في تنظيف الزوار غير النشطين:", error);
  }
};

// مراقبة عدد الزوار الحاليين في الوقت الفعلي
export const subscribeToCurrentVisitors = (callback) => {
  const activeVisitorsRef = collection(db, "activeVisitors");

  return onSnapshot(activeVisitorsRef, (snapshot) => {
    const count = snapshot.size;
    callback(count);
  });
};

// الحصول على إحصائيات الزوار
export const getVisitorStatistics = async (startDate, endDate) => {
  try {
    const visitorsRef = collection(db, "visitors");
    const q = query(
      visitorsRef,
      where("timestamp", ">=", Timestamp.fromDate(startDate)),
      where("timestamp", "<=", Timestamp.fromDate(endDate)),
    );

    const snapshot = await getDocs(q);

    return {
      totalVisitors: snapshot.size,
      visitors: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };
  } catch (error) {
    console.error("خطأ في الحصول على إحصائيات الزوار:", error);
    return { totalVisitors: 0, visitors: [] };
  }
};

export default {
  trackVisitor,
  trackActiveVisitor,
  removeActiveVisitor,
  trackPeakVisitors,
  cleanupInactiveVisitors,
  subscribeToCurrentVisitors,
  getVisitorStatistics,
};
