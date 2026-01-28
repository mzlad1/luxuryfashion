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

// Listen for config from main app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    firebaseConfig = event.data.config;
    initializeFirebase();
  }
});

function initializeFirebase() {
  if (!firebaseConfig || isInitialized) return;

  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    isInitialized = true;

    messaging.onBackgroundMessage((payload) => {
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
      return self.registration.showNotification(
        notificationTitle,
        notificationOptions,
      );
    });
  } catch (e) {
    // Already initialized
  }
}

// Handle notification click
self.addEventListener("notificationclick", (event) => {
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
