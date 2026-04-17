import { LRUCache } from 'lru-cache';

interface CacheConfig {
  ttl: number;
  maxSize: number;
}

const CACHE_CONFIGS: Record<string, CacheConfig> = {
  user_result: { ttl: 15 * 60 * 1000, maxSize: 1000 },    // 15 min
  media_info: { ttl: 24 * 60 * 60 * 1000, maxSize: 50000 }, // 24 hours
  user_list: { ttl: 15 * 60 * 1000, maxSize: 500 },         // 15 min
  franchise: { ttl: 60 * 60 * 1000, maxSize: 5000 },        // 1 hour
  user_profile: { ttl: 30 * 60 * 1000, maxSize: 2000 },     // 30 min
  status_check: { ttl: 6 * 60 * 60 * 1000, maxSize: 2000 }, // 6 hours
  mal_media_details: { ttl: 24 * 60 * 60 * 1000, maxSize: 10000 }, // 24 hours
};

class CacheManager {
  private caches: Map<string, LRUCache<string, unknown>> = new Map();

  private getCache(type: string): LRUCache<string, unknown> {
    if (!this.caches.has(type)) {
      const config = CACHE_CONFIGS[type] || { ttl: 15 * 60 * 1000, maxSize: 1000 };
      this.caches.set(type, new LRUCache<string, unknown>({
        max: config.maxSize,
        ttl: config.ttl,
      }));
    }
    return this.caches.get(type)!;
  }

  get<T>(type: string, key: string): T | undefined {
    const cache = this.getCache(type);
    return cache.get(key) as T | undefined;
  }

  set(type: string, key: string, value: unknown): void {
    const cache = this.getCache(type);
    cache.set(key, value);
  }

  has(type: string, key: string): boolean {
    const cache = this.getCache(type);
    return cache.has(key);
  }

  delete(type: string, key: string): boolean {
    const cache = this.getCache(type);
    return cache.delete(key);
  }

  clear(type?: string): void {
    if (type) {
      const cache = this.caches.get(type);
      if (cache) cache.clear();
    } else {
      for (const cache of this.caches.values()) {
        cache.clear();
      }
    }
  }

  size(type?: string): number {
    if (type) {
      return this.caches.get(type)?.size || 0;
    }
    let total = 0;
    for (const cache of this.caches.values()) {
      total += cache.size;
    }
    return total;
  }
}

export const cache = new CacheManager();
