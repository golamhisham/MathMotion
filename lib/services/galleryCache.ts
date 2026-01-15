import { Job } from '@/types';

interface CachedGalleryJob {
  exampleId: string;
  prompt: string;
  stylePreset: string;
  jobId: string;
  job: Job;
  cachedAt: number;
}

const CACHE_KEY = 'mathmotion_gallery_cache';
const CACHE_VERSION = '1.0';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export class GalleryCache {
  /**
   * Get cached job for a gallery example
   * Returns the cached job if:
   * 1. Cache exists
   * 2. Cache has not expired
   * 3. Example ID matches
   */
  getCachedJob(exampleId: string): Job | null {
    try {
      if (typeof window === 'undefined') {
        return null; // Not in browser
      }

      const cacheData = localStorage.getItem(CACHE_KEY);
      if (!cacheData) {
        return null;
      }

      const cache = JSON.parse(cacheData) as {
        version: string;
        jobs: CachedGalleryJob[];
      };

      // Check version compatibility
      if (cache.version !== CACHE_VERSION) {
        this.clearCache();
        return null;
      }

      // Find cached job for this example
      const cached = cache.jobs.find((c) => c.exampleId === exampleId);
      if (!cached) {
        return null;
      }

      // Check if cache has expired
      const now = Date.now();
      if (now - cached.cachedAt > CACHE_DURATION_MS) {
        // Remove expired entry
        cache.jobs = cache.jobs.filter((c) => c.exampleId !== exampleId);
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        return null;
      }

      return cached.job;
    } catch (error) {
      console.error('Error reading gallery cache:', error);
      return null;
    }
  }

  /**
   * Cache a gallery job result
   */
  setCachedJob(exampleId: string, prompt: string, stylePreset: string, job: Job): void {
    try {
      if (typeof window === 'undefined') {
        return; // Not in browser
      }

      let cache = {
        version: CACHE_VERSION,
        jobs: [] as CachedGalleryJob[],
      };

      // Load existing cache
      const cacheData = localStorage.getItem(CACHE_KEY);
      if (cacheData) {
        try {
          const parsed = JSON.parse(cacheData);
          if (parsed.version === CACHE_VERSION) {
            cache = parsed;
          }
        } catch (e) {
          // Invalid cache, start fresh
        }
      }

      // Remove old entry if exists
      cache.jobs = cache.jobs.filter((c) => c.exampleId !== exampleId);

      // Add new entry
      cache.jobs.push({
        exampleId,
        prompt,
        stylePreset,
        jobId: job.id,
        job,
        cachedAt: Date.now(),
      });

      // Keep cache size reasonable (max 50 entries)
      if (cache.jobs.length > 50) {
        cache.jobs = cache.jobs.slice(-50);
      }

      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error writing to gallery cache:', error);
      // Fail silently - cache is optional
    }
  }

  /**
   * Check if an example is currently cached
   */
  isCached(exampleId: string): boolean {
    return this.getCachedJob(exampleId) !== null;
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('Error clearing gallery cache:', error);
    }
  }

  /**
   * Clear cache for a specific example
   */
  clearCacheForExample(exampleId: string): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      const cacheData = localStorage.getItem(CACHE_KEY);
      if (!cacheData) {
        return;
      }

      const cache = JSON.parse(cacheData);
      if (cache.version !== CACHE_VERSION) {
        return;
      }

      cache.jobs = cache.jobs.filter((c: CachedGalleryJob) => c.exampleId !== exampleId);
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error clearing gallery cache for example:', error);
    }
  }

  /**
   * Get cache stats for debugging
   */
  getCacheStats(): { size: number; examples: string[] } {
    try {
      if (typeof window === 'undefined') {
        return { size: 0, examples: [] };
      }

      const cacheData = localStorage.getItem(CACHE_KEY);
      if (!cacheData) {
        return { size: 0, examples: [] };
      }

      const cache = JSON.parse(cacheData);
      return {
        size: cache.jobs?.length ?? 0,
        examples: cache.jobs?.map((c: CachedGalleryJob) => c.exampleId) ?? [],
      };
    } catch (error) {
      return { size: 0, examples: [] };
    }
  }
}

export const galleryCache = new GalleryCache();
