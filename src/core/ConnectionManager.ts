/**
 * ConnectionManager
 *
 * Manages client connections and their metadata.
 * Tracks which clients are connected and their types (Extractor, Transformer, Consumer).
 * This is stateless - connection state is only held in memory.
 */

import { ClientInfo, ClientType } from '../types/index.js';
import { EventEmitter } from 'events';
import { Socket } from 'socket.io';

export class ConnectionManager extends EventEmitter {
  private clients: Map<string, ClientInfo>;
  private socketMap: Map<string, Socket>; // clientId -> Socket

  constructor() {
    super();
    this.clients = new Map();
    this.socketMap = new Map();
  }

  /**
   * Register a new client connection
   */
  registerClient(
    socket: Socket,
    clientType: ClientType,
    metadata?: Record<string, unknown>
  ): ClientInfo {
    const clientInfo: ClientInfo = {
      clientId: socket.id,
      clientType,
      connectedAt: Date.now(),
      subscribedBuckets: [],
      metadata
    };

    this.clients.set(socket.id, clientInfo);
    this.socketMap.set(socket.id, socket);

    this.emit('client:connected', clientInfo);

    return clientInfo;
  }

  /**
   * Unregister a client (on disconnect)
   */
  unregisterClient(clientId: string): ClientInfo | undefined {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) {
      return undefined;
    }

    this.clients.delete(clientId);
    this.socketMap.delete(clientId);

    this.emit('client:disconnected', clientInfo);

    return clientInfo;
  }

  /**
   * Get client info by ID
   */
  getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get socket by client ID
   */
  getSocket(clientId: string): Socket | undefined {
    return this.socketMap.get(clientId);
  }

  /**
   * Get all clients of a specific type
   */
  getClientsByType(clientType: ClientType): ClientInfo[] {
    return Array.from(this.clients.values()).filter(
      client => client.clientType === clientType
    );
  }

  /**
   * Get all connected clients
   */
  getAllClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Update client's subscribed buckets
   */
  updateClientSubscriptions(clientId: string, bucketIds: string[]): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.subscribedBuckets = bucketIds;
    return true;
  }

  /**
   * Add a bucket subscription to client
   */
  addBucketSubscription(clientId: string, bucketId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    if (!client.subscribedBuckets.includes(bucketId)) {
      client.subscribedBuckets.push(bucketId);
    }

    return true;
  }

  /**
   * Remove a bucket subscription from client
   */
  removeBucketSubscription(clientId: string, bucketId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.subscribedBuckets = client.subscribedBuckets.filter(
      id => id !== bucketId
    );

    return true;
  }

  /**
   * Check if a client is connected
   */
  isConnected(clientId: string): boolean {
    return this.clients.has(clientId);
  }

  /**
   * Get connection count by type
   */
  getConnectionCounts(): Record<ClientType, number> {
    const counts = {
      [ClientType.EXTRACTOR]: 0,
      [ClientType.TRANSFORMER]: 0,
      [ClientType.CONSUMER]: 0
    };

    for (const client of this.clients.values()) {
      counts[client.clientType]++;
    }

    return counts;
  }

  /**
   * Get total connection count
   */
  getTotalConnections(): number {
    return this.clients.size;
  }

  /**
   * Clear all connections (for cleanup)
   */
  clear(): void {
    this.clients.clear();
    this.socketMap.clear();
  }
}
