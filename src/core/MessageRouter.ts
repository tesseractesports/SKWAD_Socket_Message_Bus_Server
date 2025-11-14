/**
 * MessageRouter
 *
 * Routes messages between Extractors, Transformers, and Consumers.
 * Handles the pub/sub pattern for each bucket.
 *
 * Routing Rules:
 * - Extractor → Transformer: Game data flows to subscribed transformers
 * - Transformer → Consumer: Transformed data flows to subscribed consumers
 * - Any → Bucket: Messages are routed based on bucket subscriptions
 */

import { Message, ClientType } from '../types/index.js';
import { EventEmitter } from 'events';
import { BucketManager } from './BucketManager.js';

export interface RouteTarget {
  clientId: string;
  clientType: ClientType;
}

export class MessageRouter extends EventEmitter {
  private bucketManager: BucketManager;
  private messageCount: number;

  constructor(bucketManager: BucketManager) {
    super();
    this.bucketManager = bucketManager;
    this.messageCount = 0;
  }

  /**
   * Route a message to appropriate targets based on bucket subscriptions
   */
  routeMessage(message: Message): RouteTarget[] {

   // console.log('Routing message:', JSON.stringify(message, null, 2) );
    // Validate bucket exists
    if (!this.bucketManager.bucketExists(message.bucketId)) {
      this.emit('route:error', {
        message,
        error: 'Bucket does not exist'
      });
      return [];
    }
     
    // Get all subscribers for this bucket
    const subscriberIds = this.bucketManager.getSubscribers(message.bucketId);

    // Filter out the source client (don't send message back to sender)
    const targets = subscriberIds
      .filter(id => id !== message.sourceClientId)
      .map(clientId => ({
        clientId,
        clientType: this.inferClientType(clientId) // In real implementation, this would be tracked
      }));

    // Increment message counter
    this.messageCount++;

    // Emit routing event
    this.emit('message:routed', {
      message,
      targetCount: targets.length
    });

    return targets;
  }

  /**
   * Route message to specific client type within a bucket
   * (e.g., only to Transformers or only to Consumers)
   */
  routeMessageToType(message: Message, targetType: ClientType): RouteTarget[] {
    const allTargets = this.routeMessage(message);
    return allTargets.filter(target => target.clientType === targetType);
  }

  /**
   * Broadcast to all subscribers of a bucket
   */
  broadcastToBucket(bucketId: string, _message: Message): RouteTarget[] {
    if (!this.bucketManager.bucketExists(bucketId)) {
      return [];
    }

    const subscriberIds = this.bucketManager.getSubscribers(bucketId);
    return subscriberIds.map(clientId => ({
      clientId,
      clientType: this.inferClientType(clientId)
    }));
  }

  /**
   * Get total messages routed
   */
  getMessageCount(): number {
    return this.messageCount;
  }

  /**
   * Reset message counter
   */
  resetMessageCount(): void {
    this.messageCount = 0;
  }

  /**
   * Helper to infer client type from ID
   * In a real implementation, this would be tracked in ConnectionManager
   */
  private inferClientType(clientId: string): ClientType {
    // This is a simplified implementation
    // In production, ConnectionManager would track this
    if (clientId.startsWith('ext_')) return ClientType.EXTRACTOR;
    if (clientId.startsWith('trans_')) return ClientType.TRANSFORMER;
    return ClientType.CONSUMER;
  }

  /**
   * Validate message structure
   */
  validateMessage(message: Message): boolean {
    return !!(
      message.messageId &&
      message.bucketId &&
      message.sourceClientId &&
      message.sourceClientType &&
      message.timestamp &&
      message.messageType
    );
  }
}
