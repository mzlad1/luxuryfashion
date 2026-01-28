/**
 * Firebase Cloud Functions for Luxury Fashion
 * Handles push notifications for new orders
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize Firebase Admin
initializeApp();

const db = getFirestore();
const messaging = getMessaging();

/**
 * Triggered when a new order is created in Firestore
 * Sends push notification to all registered admin devices
 */
exports.onNewOrder = onDocumentCreated("orders/{orderId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("No data associated with the event");
    return null;
  }

  const orderData = snapshot.data();
  const orderId = event.params.orderId;

  console.log(`New order created: ${orderId}`);
  console.log("Order data:", JSON.stringify(orderData));

  try {
    // Get all admin device tokens
    const devicesSnapshot = await db.collection("adminDevices").get();

    if (devicesSnapshot.empty) {
      console.log("No admin devices registered for notifications");
      return null;
    }

    const tokens = [];
    const invalidTokenDocs = [];

    devicesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    if (tokens.length === 0) {
      console.log("No valid tokens found");
      return null;
    }

    console.log(`Sending notification to ${tokens.length} devices`);

    // Prepare notification message
    const customerName = orderData.name || "عميل";
    const orderTotal = orderData.total ? `${orderData.total} شيكل` : "";
    const itemsCount = orderData.products?.length || 0;

    const message = {
      notification: {
        title: "🛒 طلبية جديدة!",
        body: `طلبية جديدة من ${customerName}${orderTotal ? ` - ${orderTotal}` : ""}${itemsCount ? ` (${itemsCount} منتج)` : ""}`,
      },
      data: {
        type: "new_order",
        orderId: orderId,
        customerName: customerName,
        total: String(orderData.total || 0),
        url: "/admin/orders",
        timestamp: String(Date.now()),
      },
      // Android specific
      android: {
        priority: "high",
        notification: {
          icon: "ic_notification",
          color: "#c2a26c",
          sound: "default",
          channelId: "new_orders",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      // Web push specific
      webpush: {
        notification: {
          icon: "/images/logo.ico",
          badge: "/images/logo.ico",
          vibrate: [200, 100, 200],
          requireInteraction: true,
          actions: [
            {
              action: "view",
              title: "عرض الطلبية",
            },
            {
              action: "dismiss",
              title: "إغلاق",
            },
          ],
        },
        fcmOptions: {
          link: "/admin/orders",
        },
      },
      // APNs (iOS) specific
      apns: {
        payload: {
          aps: {
            alert: {
              title: "🛒 طلبية جديدة!",
              body: `طلبية جديدة من ${customerName}${orderTotal ? ` - ${orderTotal}` : ""}`,
            },
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
      },
    };

    // Send to all devices
    const response = await messaging.sendEachForMulticast({
      tokens: tokens,
      ...message,
    });

    console.log(
      `Notifications sent. Success: ${response.successCount}, Failure: ${response.failureCount}`,
    );

    // Handle failed tokens (remove invalid ones)
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          console.log(`Failed to send to token ${idx}: ${errorCode}`);

          // Remove invalid tokens
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            const tokenToRemove = tokens[idx];
            // Find and delete the document with this token
            devicesSnapshot.forEach((doc) => {
              if (doc.data().token === tokenToRemove) {
                invalidTokenDocs.push(doc.ref);
              }
            });
          }
        }
      });

      // Delete invalid token documents
      if (invalidTokenDocs.length > 0) {
        console.log(`Removing ${invalidTokenDocs.length} invalid token(s)`);
        const batch = db.batch();
        invalidTokenDocs.forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
    }

    return { success: true, sent: response.successCount };
  } catch (error) {
    console.error("Error sending notifications:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Optional: Clean up old/inactive tokens periodically
 * Tokens that haven't been active for 30 days
 */
exports.cleanupInactiveTokens =
  require("firebase-functions/v2/scheduler").onSchedule(
    "every 7 days",
    async (event) => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const inactiveDevices = await db
          .collection("adminDevices")
          .where("lastActiveAt", "<", thirtyDaysAgo)
          .get();

        if (inactiveDevices.empty) {
          console.log("No inactive tokens to clean up");
          return null;
        }

        const batch = db.batch();
        inactiveDevices.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Cleaned up ${inactiveDevices.size} inactive token(s)`);

        return { cleaned: inactiveDevices.size };
      } catch (error) {
        console.error("Error cleaning up tokens:", error);
        return { error: error.message };
      }
    },
  );
