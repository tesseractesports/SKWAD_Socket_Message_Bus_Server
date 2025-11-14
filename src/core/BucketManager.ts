/**
 * BucketManager
 *
 * Manages dynamic buckets created by Extractors.
 * Each bucket represents a logical grouping of game data (e.g., a specific game session).
 * Buckets are stateless and exist only as routing constructs.
 */

import { BucketMetadata, BucketAvailability } from '../types/index.js';
import { EventEmitter } from 'events';

export class BucketManager extends EventEmitter {
  private buckets: Map<string, BucketMetadata>;
  private bucketSubscribers: Map<string, Set<string>>; // bucketId -> Set of clientIds

  constructor() {
    super();
    this.buckets = new Map();
    this.bucketSubscribers = new Map();
  }

  /**
   * Create a new bucket
   */
  createBucket(metadata: BucketMetadata): boolean {
    if (this.buckets.has(metadata.bucketId)) {
      return false; // Bucket already exists
    }

    this.buckets.set(metadata.bucketId, {
      ...metadata,
      createdAt: Date.now()
    });

    this.bucketSubscribers.set(metadata.bucketId, new Set());

    // Emit bucket availability
    const availability: BucketAvailability = {
      bucketId: metadata.bucketId,
      metadata: metadata,
      isAvailable: true,
      timestamp: Date.now()
    };

    this.emit('bucket:available', availability);

    return true;
  }

  /**
   * Remove a bucket (when Extractor disconnects or closes bucket)
   */
  removeBucket(bucketId: string): boolean {
    const metadata = this.buckets.get(bucketId);
    if (!metadata) {
      return false;
    }

    this.buckets.delete(bucketId);

    // Notify subscribers
    const availability: BucketAvailability = {
      bucketId,
      metadata,
      isAvailable: false,
      timestamp: Date.now()
    };

    this.emit('bucket:unavailable', availability);

    // Clean up subscribers
    this.bucketSubscribers.delete(bucketId);

    return true;
  }

  /**
   * Subscribe a client to a bucket
   */
  subscribeToBucket(bucketId: string, clientId: string): boolean {
    if (!this.buckets.has(bucketId)) {
      return false; // Bucket doesn't exist
    }

    let subscribers = this.bucketSubscribers.get(bucketId);
    if (!subscribers) {
      subscribers = new Set();
      this.bucketSubscribers.set(bucketId, subscribers);
    }

    subscribers.add(clientId);
    return true;
  }

  /**
   * Unsubscribe a client from a bucket
   */
  unsubscribeFromBucket(bucketId: string, clientId: string): boolean {
    const subscribers = this.bucketSubscribers.get(bucketId);
    if (!subscribers) {
      return false;
    }

    return subscribers.delete(clientId);
  }

  /**
   * Unsubscribe a client from all buckets
   */
  unsubscribeFromAll(clientId: string): void {
    for (const [_bucketId, subscribers] of this.bucketSubscribers.entries()) {
      subscribers.delete(clientId);
    }
  }

  /**
   * Get all subscribers for a bucket
   */
  getSubscribers(bucketId: string): string[] {
    const subscribers = this.bucketSubscribers.get(bucketId);
    return subscribers ? Array.from(subscribers) : [];
  }

  /**
   * Get bucket metadata
   */
  getBucket(bucketId: string): BucketMetadata | undefined {
    return this.buckets.get(bucketId);
  }

  /**
   * Get all active buckets
   */
  getAllBuckets(): BucketMetadata[] {
    return Array.from(this.buckets.values());
  }

  /**
   * Get buckets a client is subscribed to
   */
  getClientSubscriptions(clientId: string): string[] {
    const subscriptions: string[] = [];
    for (const [bucketId, subscribers] of this.bucketSubscribers.entries()) {
      if (subscribers.has(clientId)) {
        subscriptions.push(bucketId);
      }
    }
    return subscriptions;
  }

  /**
   * Check if a bucket exists
   */
  bucketExists(bucketId: string): boolean {
    return this.buckets.has(bucketId);
  }

  /**
   * Get total number of active buckets
   */
  getActiveBucketCount(): number {
    return this.buckets.size;
  }

  /**
   * Clear all buckets (for cleanup)
   */
  clear(): void {
    this.buckets.clear();
    this.bucketSubscribers.clear();
  }
}
