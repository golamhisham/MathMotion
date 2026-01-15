import { Job } from '@/types';
import crypto from 'crypto';

interface CachedPromptResult {
  hash: string;
  prompt: string;
  stylePreset: string;
  jobId: string;
  job: Job;
  cachedAt: number;
  hitCount: number;
}

/**
 * Prompt Cache Service
 *
 * Caches job results by prompt+stylePreset hash
 * Returns cached results for identical inputs without re-rendering
 * Prevents redundant computation for duplicate requests
 */
export class PromptCache {
  private cache = new Map<string, CachedPromptResult>();
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  /**
   * Generate hash for prompt+stylePreset combination
   */
  private generateHash(prompt: string, stylePreset: string): string {
    const combined = `${prompt.trim()}|${stylePreset}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Get cached job result if exists and valid
   * Returns null if not cached or cache expired
   */
  getCachedJob(prompt: string, stylePreset: string): Job | null {
    const hash = this.generateHash(prompt, stylePreset);
    const cached = this.cache.get(hash);

    if (!cached) {
      return null;
    }

    // Check if cache has expired
    const now = Date.now();
    if (now - cached.cachedAt > this.CACHE_DURATION_MS) {
      this.cache.delete(hash);
      return null;
    }

    // Increment hit count
    cached.hitCount++;

    return cached.job;
  }

  /**
   * Cache a completed job result
   */
  setCachedJob(prompt: string, stylePreset: string, job: Job): void {
    // Only cache successful jobs
    if (job.status !== 'done' || !job.output) {
      return;
    }

    const hash = this.generateHash(prompt, stylePreset);

    // Check if already cached (avoid duplicate entries)
    if (this.cache.has(hash)) {
      return;
    }

    // Enforce cache size limit (LRU-style cleanup)
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (least recently cached)
      let oldestKey: string | null = null;
      let oldestTime = Date.now();

      for (const [key, value] of this.cache.entries()) {
        if (value.cachedAt < oldestTime) {
          oldestTime = value.cachedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(hash, {
      hash,
      prompt: prompt.trim(),
      stylePreset,
      jobId: job.id,
      job,
      cachedAt: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Check if a prompt is cached
   */
  isCached(prompt: string, stylePreset: string): boolean {
    const hash = this.generateHash(prompt, stylePreset);
    const cached = this.cache.get(hash);

    if (!cached) {
      return false;
    }

    // Check expiration
    const now = Date.now();
    if (now - cached.cachedAt > this.CACHE_DURATION_MS) {
      this.cache.delete(hash);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear specific prompt from cache
   */
  clearPrompt(prompt: string, stylePreset: string): void {
    const hash = this.generateHash(prompt, stylePreset);
    this.cache.delete(hash);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    totalHits: number;
    cacheEntries: Array<{
      prompt: string;
      stylePreset: string;
      cachedAt: number;
      hitCount: number;
    }>;
  } {
    let totalHits = 0;
    const cacheEntries: Array<{
      prompt: string;
      stylePreset: string;
      cachedAt: number;
      hitCount: number;
    }> = [];

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      cacheEntries.push({
        prompt: entry.prompt,
        stylePreset: entry.stylePreset,
        cachedAt: entry.cachedAt,
        hitCount: entry.hitCount,
      });
    }

    return {
      size: this.cache.size,
      totalHits,
      cacheEntries,
    };
  }
}

// Singleton instance
export const promptCache = new PromptCache();
