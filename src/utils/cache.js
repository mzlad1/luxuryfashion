// Cache utility for reducing Firebase reads
const CACHE_KEYS = {
  ORDERS: "beauty_app_orders",
  PRODUCTS: "beauty_app_products",
  CATEGORIES: "beauty_app_categories",
  BRANDS: "beauty_app_brands",
};

// Different TTL for different data types
const DEFAULT_TTL = {
  ORDERS: 30 * 1000, // 30 seconds - very dynamic data
  PRODUCTS: 5 * 60 * 1000, // 5 minutes - moderately dynamic
  CATEGORIES: 10 * 60 * 1000, // 10 minutes - rarely changes
  BRANDS: 10 * 60 * 1000, // 10 minutes - rarely changes
};

class CacheManager {
  // Set data with TTL
  static set(key, data, ttl) {
    try {
      // Use default TTL if not provided
      const finalTTL = ttl || this.getDefaultTTL(key);

      const item = {
        data,
        timestamp: Date.now(),
        ttl: finalTTL,
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {}
  }

  // Get default TTL based on cache key
  static getDefaultTTL(key) {
    switch (key) {
      case CACHE_KEYS.ORDERS:
        return DEFAULT_TTL.ORDERS;
      case CACHE_KEYS.PRODUCTS:
        return DEFAULT_TTL.PRODUCTS;
      case CACHE_KEYS.CATEGORIES:
        return DEFAULT_TTL.CATEGORIES;
      case CACHE_KEYS.BRANDS:
        return DEFAULT_TTL.BRANDS;
      default:
        return 5 * 60 * 1000; // 5 minutes default
    }
  }

  // Get data if not expired
  static get(key) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      const now = Date.now();
      const age = now - parsed.timestamp;

      // Check if expired
      if (age > parsed.ttl) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      return null;
    }
  }

  // Check if cache is stale (>50% of TTL age)
  static isStale(key) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return true;

      const parsed = JSON.parse(item);
      const age = Date.now() - parsed.timestamp;
      return age > parsed.ttl * 0.5; // Stale if older than 50% of TTL
    } catch (error) {
      return true;
    }
  }

  // Remove specific cache
  static remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {}
  }

  // Clear all app caches
  static clearAll() {
    Object.values(CACHE_KEYS).forEach((key) => {
      this.remove(key);
    });
  }

  // Check if cache exists and is valid
  static isValid(key) {
    return this.get(key) !== null;
  }

  // Get cache info for debugging
  static getInfo(key) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      const now = Date.now();
      const age = now - parsed.timestamp;

      return {
        key,
        age,
        ttl: parsed.ttl,
        expired: age > parsed.ttl,
        stale: age > parsed.ttl * 0.5,
        createdAt: new Date(parsed.timestamp),
      };
    } catch (error) {
      return null;
    }
  }
}

export { CacheManager, CACHE_KEYS };
