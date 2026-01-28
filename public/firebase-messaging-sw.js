/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// Firebase Messaging Service Worker
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js",
);

// Firebase config is fetched from the main app via message
let firebaseConfig = null;
let isInitialized = false;

console.log('[SW] Service Worker loaded');

// Listen for config from main app
self.addEventListener("message", (event) => {
  console.log('[SW] Message received:', event.data?.type);
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    console.log('[SW] Firebase config received, projectId:', event.data.config?.projectId);
    firebaseConfig = event.data.config;
    initializeFirebase();
  }
});

function initializeFirebase() {
  console.log('[SW] initializeFirebase called, hasConfig:', !!firebaseConfig, 'isInitialized:', isInitialized);
  if (!firebaseConfig || isInitialized) return;

  try {
    console.log('[SW] Initializing Firebase app...');
    firebase.initializeApp(firebaseConfig);
    console.log('[SW] Firebase app initialized');
    const messaging = firebase.messaging();
    console.log('[SW] Messaging instance created');
    isInitialized = true;

    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] Background message received:', payload);
      const notificationTitle = payload.notification?.title || "طلبية جديدة!";
      const notificationOptions = {
        body: payload.notification?.body || "لديك طلبية جديدة في المتجر",
        icon: "/images/logo.ico",
        badge: "/images/logo.ico",
        tag: "new-order",
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          url: payload.data?.url || "/admin/orders",
          orderId: payload.data?.orderId,
        },
        actions: [
          { action: "view", title: "عرض الطلبية" },
          { action: "dismiss", title: "إغلاق" },
        ],
      };
      console.log('[SW] Showing notification:', notificationTitle);
      return self.registration.showNotification(
        notificationTitle,
        notificationOptions,
      );
    });
    console.log('[SW] Background message handler registered');
  } catch (e) {
    console.error('[SW] Error initializing:', e.message);
  }
}

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();
  if (event.action === "dismiss") return;

  const urlToOpen = event.notification.data?.url || "/admin/orders";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/admin") && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      }),
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));
