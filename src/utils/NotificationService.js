import { getToken, onMessage } from "firebase/messaging";
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db, initializeMessaging, getMessagingInstance } from "../firebase";

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;

// Debug logger
const DEBUG = true;
const log = (...args) => DEBUG && console.log("[NotificationService]", ...args);
const logError = (...args) =>
  DEBUG && console.error("[NotificationService ERROR]", ...args);

class NotificationService {
  constructor() {
    this.messaging = null;
    this.currentToken = null;
    this.isInitialized = false;
  }

  // Check if notifications are supported
  isSupported() {
    const hasNotification = "Notification" in window;
    const hasSW = "serviceWorker" in navigator;
    const hasPush = "PushManager" in window;
    log("isSupported check:", { hasNotification, hasSW, hasPush });
    return hasNotification && hasSW && hasPush;
  }

  // Check if running as PWA (for iOS)
  isPWA() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  // Check if iOS
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  // Get current permission status
  getPermissionStatus() {
    if (!this.isSupported()) return "unsupported";
    return Notification.permission; // 'granted', 'denied', 'default'
  }

  // Initialize messaging
  async initialize() {
    log("initialize() called, isInitialized:", this.isInitialized);
    if (this.isInitialized) return true;

    try {
      // Initialize Firebase Messaging
      log("Calling initializeMessaging()...");
      this.messaging = await initializeMessaging();
      log("initializeMessaging result:", this.messaging ? "SUCCESS" : "FAILED");

      if (!this.messaging) {
        logError("Messaging initialization returned null");
        return false;
      }

      // Register service worker
      log("Registering service worker...");
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
      );
      log("Service worker registered:", registration.scope);
      log(
        "SW state:",
        registration.active
          ? "active"
          : registration.waiting
            ? "waiting"
            : registration.installing
              ? "installing"
              : "none",
      );

      // Send Firebase config to service worker
      if (registration.active) {
        log("Sending config to active SW");
        registration.active.postMessage({
          type: "FIREBASE_CONFIG",
          config: {
            apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
            authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
            storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
            messagingSenderId:
              process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.REACT_APP_FIREBASE_APP_ID,
          },
        });
      }

      // Also send when SW becomes active
      navigator.serviceWorker.ready.then((reg) => {
        log("SW ready, sending config");
        reg.active?.postMessage({
          type: "FIREBASE_CONFIG",
          config: {
            apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
            authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
            storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
            messagingSenderId:
              process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.REACT_APP_FIREBASE_APP_ID,
          },
        });
      });

      this.isInitialized = true;
      log("Initialization complete!");
      return true;
    } catch (error) {
      logError("Initialize error:", error.message, error);
      return false;
    }
  }

  // Request notification permission and get token
  async requestPermissionAndGetToken() {
    log("requestPermissionAndGetToken() called");
    log("VAPID_KEY exists:", !!VAPID_KEY, "length:", VAPID_KEY?.length);
    try {
      // Initialize first
      const initialized = await this.initialize();
      log("Initialize result:", initialized);
      if (!initialized) {
        throw new Error("Could not initialize messaging");
      }

      // Request permission
      log("Requesting notification permission...");
      const permission = await Notification.requestPermission();
      log("Permission result:", permission);

      if (permission !== "granted") {
        return { success: false, error: "permission_denied" };
      }

      // Get FCM token
      log("Getting messaging instance...");
      const messaging = getMessagingInstance();
      log("Messaging instance:", messaging ? "EXISTS" : "NULL");
      if (!messaging) {
        throw new Error("Messaging not initialized");
      }

      log("Waiting for SW ready...");
      const registration = await navigator.serviceWorker.ready;
      log("SW ready, getting FCM token...");
      log("Using VAPID key (first 20 chars):", VAPID_KEY?.substring(0, 20));

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      log(
        "Token received:",
        token ? `YES (${token.substring(0, 20)}...)` : "NO",
      );

      if (token) {
        this.currentToken = token;
        log("Token saved to instance");
        return { success: true, token };
      } else {
        throw new Error("No token received");
      }
    } catch (error) {
      logError("requestPermissionAndGetToken error:", error.message, error);
      return { success: false, error: error.message };
    }
  }

  // Save token to Firestore for admin devices
  async saveTokenToFirestore(deviceInfo = {}) {
    log("saveTokenToFirestore() called");
    log("currentToken exists:", !!this.currentToken);
    if (!this.currentToken) {
      logError("No token to save");
      return false;
    }

    try {
      const tokenId = this.generateTokenId(this.currentToken);
      log("Generated tokenId:", tokenId);

      const docData = {
        token: this.currentToken,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          isIOS: this.isIOS(),
          isPWA: this.isPWA(),
          ...deviceInfo,
        },
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      };

      log("Saving to Firestore collection: adminDevices");
      await setDoc(doc(db, "adminDevices", tokenId), docData);
      log("Token saved to Firestore successfully!");

      return true;
    } catch (error) {
      logError("saveTokenToFirestore error:", error.message, error);
      return false;
    }
  }

  // Remove token from Firestore
  async removeTokenFromFirestore() {
    if (!this.currentToken) return false;

    try {
      const tokenId = this.generateTokenId(this.currentToken);
      await deleteDoc(doc(db, "adminDevices", tokenId));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Generate a consistent ID from token
  generateTokenId(token) {
    // Use first 20 chars of token as ID (tokens are unique)
    return token.substring(0, 40);
  }

  // Listen for foreground messages
  onForegroundMessage(callback) {
    const messaging = getMessagingInstance();
    if (!messaging) {
      return () => {};
    }

    return onMessage(messaging, (payload) => {
      log("Foreground message received:", payload);
      // Don't show notification here - FCM webpush already handles it
      // This prevents duplicate notifications
      // Just call the callback for any UI updates
      if (callback) {
        callback(payload);
      }
    });
  }

  // Get all registered admin devices
  async getRegisteredDevices() {
    try {
      const snapshot = await getDocs(collection(db, "adminDevices"));
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      return [];
    }
  }

  // Update last active timestamp
  async updateLastActive() {
    if (!this.currentToken) return;

    try {
      const tokenId = this.generateTokenId(this.currentToken);
      await setDoc(
        doc(db, "adminDevices", tokenId),
        { lastActiveAt: serverTimestamp() },
        { merge: true },
      );
    } catch (error) {
      // Silent fail
    }
  }

  // Test notification
  async sendTestNotification() {
    if (Notification.permission === "granted") {
      try {
        const notification = new Notification("اختبار الإشعارات", {
          body: "الإشعارات تعمل بشكل صحيح! ✅",
          icon: "/images/logo.ico",
          badge: "/images/logo.ico",
          tag: "test-notification",
        });

        notification.onclick = () => {
          window.focus();
        };

        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
