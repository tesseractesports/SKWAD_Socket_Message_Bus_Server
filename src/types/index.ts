/**
 * Type definitions for Socket.io Message Bus Server
 */

/**
 * Client types in the ecosystem
 */
export enum ClientType {
  EXTRACTOR = 'extractor',
  TRANSFORMER = 'transformer',
  CONSUMER = 'consumer'
}

/**
 * Message types that can be routed through the system
 */
export enum MessageType {
  GAME_DATA = 'game_data',
  TRANSFORMED_DATA = 'transformed_data',
  CONTROL = 'control',
  HEARTBEAT = 'heartbeat'
}

/**
 * Bucket metadata provided by Extractor
 */
export interface BucketMetadata {
  bucketId: string;
  gameType: string;
  gameVersion?: string;
  region?: string;
  additionalMetadata?: Record<string, unknown>;
  createdAt: number;
}

/**
 * Information about a connected client
 */
export interface ClientInfo {
  clientId: string;
  clientType: ClientType;
  connectedAt: number;
  subscribedBuckets: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Message envelope for routing
 */
export interface Message {
  messageId: string;
  messageType: MessageType;
  bucketId: string;
  sourceClientId: string;
  sourceClientType: ClientType;
  timestamp: number;
  payload: unknown;
}

/**
 * Bucket availability announcement
 */
export interface BucketAvailability {
  bucketId: string;
  metadata: BucketMetadata;
  isAvailable: boolean;
  timestamp: number;
}

/**
 * Statistics about server state
 */
export interface ServerStats {
  connectedClients: {
    [ClientType.EXTRACTOR]: number;
    [ClientType.TRANSFORMER]: number;
    [ClientType.CONSUMER]: number;
  };
  activeBuckets: number;
  totalMessagesRouted: number;
  uptime: number;
}

/**
 * Event names for Socket.io
 */
export const SocketEvents = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  REGISTER: 'register',
  REGISTERED: 'registered',

  // Bucket events
  CREATE_BUCKET: 'create_bucket',
  BUCKET_CREATED: 'bucket_created',
  BUCKET_AVAILABLE: 'bucket_available',
  BUCKET_UNAVAILABLE: 'bucket_unavailable',
  SUBSCRIBE_BUCKET: 'subscribe_bucket',
  UNSUBSCRIBE_BUCKET: 'unsubscribe_bucket',

  // Message routing events
  MESSAGE: 'message',
  MESSAGE_ACK: 'message_ack',

  // System events
  HEARTBEAT: 'heartbeat',
  STATS: 'stats',
  ERROR: 'error'
} as const;

/**
 * Registration payload from clients
 */
export interface RegisterPayload {
  clientType: ClientType;
  metadata?: Record<string, unknown>;
}

/**
 * Bucket subscription payload
 */
export interface SubscriptionPayload {
  bucketId: string;
}

/**
 * Error response
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}
