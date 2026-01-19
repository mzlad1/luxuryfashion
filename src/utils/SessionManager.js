// Session management utility for automatic session extension

class SessionManager {
  static SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  static ACTIVITY_DEBOUNCE = 60 * 1000; // 1 minute debounce
  static lastActivityTime = 0;

  // Initialize session monitoring
  static init(onSessionExpired) {
    this.setupActivityListeners();
    this.startSessionMonitoring(onSessionExpired);
  }

  // Set up activity listeners for automatic session extension
  static setupActivityListeners() {
    const activities = [
      "click",
      "keydown",
      "scroll",
      "mousemove",
      "touchstart",
    ];

    const handleUserActivity = () => {
      const now = Date.now();

      // Only extend session if enough time has passed since last extension
      if (now - this.lastActivityTime > this.ACTIVITY_DEBOUNCE) {
        this.extendSession();
        this.lastActivityTime = now;
      }
    };

    // Add event listeners with passive option for better performance
    activities.forEach((activity) => {
      document.addEventListener(activity, handleUserActivity, {
        passive: true,
        capture: true,
      });
    });

    // Store reference to remove listeners later
    this.activityHandler = handleUserActivity;
    this.activities = activities;
  }

  // Extend session by updating login time
  static extendSession() {
    localStorage.setItem("adminLoginTime", new Date().getTime().toString());
  }

  // Start monitoring session expiration
  static startSessionMonitoring(onSessionExpired) {
    const checkSession = () => {
      const loginTime = localStorage.getItem("adminLoginTime");

      if (!loginTime) {
        onSessionExpired?.();
        return;
      }

      const currentTime = new Date().getTime();
      const timeElapsed = currentTime - parseInt(loginTime);

      if (timeElapsed > this.SESSION_TIMEOUT) {
        this.cleanup();
        onSessionExpired?.();
      }
    };

    // Check every 2 minutes
    this.sessionInterval = setInterval(checkSession, 2 * 60 * 1000);
  }

  // Clean up listeners and intervals
  static cleanup() {
    if (this.activities && this.activityHandler) {
      this.activities.forEach((activity) => {
        document.removeEventListener(activity, this.activityHandler, true);
      });
    }

    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
    }

    localStorage.removeItem("adminLoginTime");
  }

  // Check if session is valid
  static isSessionValid() {
    const loginTime = localStorage.getItem("adminLoginTime");

    if (!loginTime) return false;

    const currentTime = new Date().getTime();
    const timeElapsed = currentTime - parseInt(loginTime);

    return timeElapsed <= this.SESSION_TIMEOUT;
  }
}

export default SessionManager;
