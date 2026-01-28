import { useState, useEffect, useCallback } from "react";
import notificationService from "../utils/NotificationService";

// Debug logger
const DEBUG = true;
const log = (...args) => DEBUG && console.log('[useNotifications]', ...args);
const logError = (...args) => DEBUG && console.error('[useNotifications ERROR]', ...args);

/**
 * Custom hook for managing push notifications
 * Handles permission requests, token management, and foreground messages
 */
export function useNotifications() {
  const [permissionStatus, setPermissionStatus] = useState("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  // Initialize on mount
  useEffect(() => {
    log('Hook mounted, checking support...');
    const supported = notificationService.isSupported();
    log('Supported:', supported);
    setIsSupported(supported);
    setIsIOS(notificationService.isIOS());
    setIsPWA(notificationService.isPWA());
    log('isIOS:', notificationService.isIOS(), 'isPWA:', notificationService.isPWA());

    if (supported) {
      const permission = notificationService.getPermissionStatus();
      log('Current permission:', permission);
      setPermissionStatus(permission);

      // Check if already enabled and initialize
      if (permission === "granted") {
        log('Permission granted, initializing...');
        // Initialize messaging first, then set enabled
        notificationService.initialize().then((success) => {
          log('Initialize result:', success);
          if (success) {
            setIsEnabled(true);
            log('Notifications enabled!');
          }
        });
      }
    }
  }, []);

  // Listen for foreground messages when enabled
  useEffect(() => {
    if (!isEnabled) return;

    const unsubscribe = notificationService.onForegroundMessage();

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [isEnabled]);

  // Update last active periodically
  useEffect(() => {
    if (!isEnabled) return;

    // Update on mount
    notificationService.updateLastActive();

    // Update every 5 minutes
    const interval = setInterval(
      () => {
        notificationService.updateLastActive();
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [isEnabled]);

  // Enable notifications
  const enableNotifications = useCallback(async () => {
    log('enableNotifications() called');
    setIsLoading(true);
    setError(null);

    try {
      // Request permission and get token
      log('Requesting permission and token...');
      const result = await notificationService.requestPermissionAndGetToken();
      log('requestPermissionAndGetToken result:', result);

      if (!result.success) {
        logError('Failed to get token:', result.error);
        if (result.error === "permission_denied") {
          setError("تم رفض إذن الإشعارات. يرجى تفعيلها من إعدادات المتصفح.");
        } else {
          setError(`خطأ: ${result.error}`);
        }
        setIsEnabled(false);
        return false;
      }

      // Save token to Firestore
      log('Saving token to Firestore...');
      const saved = await notificationService.saveTokenToFirestore();
      log('saveTokenToFirestore result:', saved);

      if (!saved) {
        logError('Failed to save token to Firestore');
        setError("تم تفعيل الإشعارات لكن فشل حفظ الجهاز. حاول مرة أخرى.");
        return false;
      }

      setIsEnabled(true);
      setPermissionStatus("granted");
      log('Notifications fully enabled!');
      return true;
    } catch (err) {
      console.error("Error enabling notifications:", err);
      setError("حدث خطأ أثناء تفعيل الإشعارات");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disable notifications (remove token)
  const disableNotifications = useCallback(async () => {
    setIsLoading(true);

    try {
      await notificationService.removeTokenFromFirestore();
      setIsEnabled(false);
      return true;
    } catch (err) {
      console.error("Error disabling notifications:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    return notificationService.sendTestNotification();
  }, []);

  // Check if needs PWA for iOS
  const needsPWAForIOS = isIOS && !isPWA;

  return {
    // State
    permissionStatus,
    isSupported,
    isLoading,
    isEnabled,
    error,
    isIOS,
    isPWA,
    needsPWAForIOS,

    // Actions
    enableNotifications,
    disableNotifications,
    sendTestNotification,
  };
}

export default useNotifications;
