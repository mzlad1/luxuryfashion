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

// VAPID Key - You need to generate this from Firebase Console
// Go to: Project Settings > Cloud Messaging > Web configuration > Generate key pair
const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;

class NotificationService {
  constructor() {
    this.messaging = null;
    this.currentToken = null;
    this.isInitialized = false;
  }

  // Check if notifications are supported
  isSupported() {
    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
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
    if (this.isInitialized) return true;

    try {
      // Initialize Firebase Messaging
      this.messaging = await initializeMessaging();

      if (!this.messaging) {
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
      );

      // Send Firebase config to service worker
      if (registration.active) {
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
      return true;
    } catch (error) {
      return false;
    }
  }

  // Request notification permission and get token
  async requestPermissionAndGetToken() {
    try {
      // Initialize first
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Could not initialize messaging");
      }

      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        return { success: false, error: "permission_denied" };
      }

      // Get FCM token
      const messaging = getMessagingInstance();
      if (!messaging) {
        throw new Error("Messaging not initialized");
      }

      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        this.currentToken = token;
        return { success: true, token };
      } else {
        throw new Error("No token received");
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Save token to Firestore for admin devices
  async saveTokenToFirestore(deviceInfo = {}) {
    if (!this.currentToken) {
      return false;
    }

    try {
      const tokenId = this.generateTokenId(this.currentToken);

      await setDoc(doc(db, "adminDevices", tokenId), {
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
      });

      return true;
    } catch (error) {
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
      // Show notification manually for foreground
      if (Notification.permission === "granted") {
        const { title, body } = payload.notification || {};
        new Notification(title || "طلبية جديدة!", {
          body: body || "لديك طلبية جديدة في المتجر",
          icon: "/images/logo.ico",
          badge: "/images/logo.ico",
          tag: "new-order",
          renotify: true,
          requireInteraction: true,
        });
      }

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
