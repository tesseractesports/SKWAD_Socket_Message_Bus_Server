/**
 * MessageBusServer
 *
 * Main server class that orchestrates all components.
 * Sets up Socket.io with Redis adapter for horizontal scaling.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { BucketManager } from './core/BucketManager.js';
import { MessageRouter } from './core/MessageRouter.js';
import { ConnectionManager } from './core/ConnectionManager.js';
import {
  SocketEvents,
  RegisterPayload,
  BucketMetadata,
  SubscriptionPayload,
  Message,
  ServerStats,
  ClientType,
  ErrorResponse
} from './types/index.js';

export interface ServerConfig {
  port: number;
  corsOrigin: string;
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  enableRedis?: boolean;
}

export class MessageBusServer {
  private io: SocketIOServer;
  private bucketManager: BucketManager;
  private messageRouter: MessageRouter;
  private connectionManager: ConnectionManager;
  private config: ServerConfig;
  private startTime: number;

  constructor(config: ServerConfig) {
    this.config = config;
    this.startTime = Date.now();

    // Initialize core components
    this.bucketManager = new BucketManager();
    this.messageRouter = new MessageRouter(this.bucketManager);
    this.connectionManager = new ConnectionManager();

    // Initialize Socket.io server
    this.io = new SocketIOServer({
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST']
      }
    });

    this.setupEventHandlers();
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Setup Redis adapter if enabled
    if (this.config.enableRedis && this.config.redisHost) {
      await this.setupRedisAdapter();
    }

    // Start listening
    this.io.listen(this.config.port);

    console.log(`🚀 Socket.io Message Bus Server started on port ${this.config.port}`);
    console.log(`📡 Redis adapter: ${this.config.enableRedis ? 'enabled' : 'disabled'}`);
    console.log(`🌍 CORS origin: ${this.config.corsOrigin}`);
  }

  /**
   * Setup Redis adapter for horizontal scaling
   */
  private async setupRedisAdapter(): Promise<void> {
    const pubClient = createClient({
      socket: {
        host: this.config.redisHost,
        port: this.config.redisPort
      },
      password: this.config.redisPassword
    });

    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.io.adapter(createAdapter(pubClient, subClient));

    console.log('✅ Redis adapter configured');
  }

  /**
   * Setup event handlers for core components
   */
  private setupEventHandlers(): void {
    // Bucket availability events
    this.bucketManager.on('bucket:available', (availability) => {
      // Broadcast to all Transformers and Consumers
      this.io.emit(SocketEvents.BUCKET_AVAILABLE, availability);
    });

    this.bucketManager.on('bucket:unavailable', (availability) => {
      this.io.emit(SocketEvents.BUCKET_UNAVAILABLE, availability);
    });

    // Connection events
    this.connectionManager.on('client:connected', (clientInfo) => {
      console.log(`✅ Client connected: ${clientInfo.clientId} (${clientInfo.clientType})`);
    });

    this.connectionManager.on('client:disconnected', (clientInfo) => {
      console.log(`❌ Client disconnected: ${clientInfo.clientId} (${clientInfo.clientType})`);

      // Clean up bucket subscriptions
      this.bucketManager.unsubscribeFromAll(clientInfo.clientId);

      // If it was an extractor, remove their buckets
      if (clientInfo.clientType === ClientType.EXTRACTOR) {
        for (const bucketId of clientInfo.subscribedBuckets) {
          this.bucketManager.removeBucket(bucketId);
        }
      }
    });

    // Message routing events
    
    this.messageRouter.on('message:routed', ({ message, targetCount }) => {
      //console.log(`📨 Message routed: ${message.messageId} -> ${targetCount} targets`);
      console.log(`📨 Message routed: ${message.bucketId} -> ${message.messageType} -> ${targetCount} targets`);
    });

    this.messageRouter.on('route:error', ({ message, error }) => {
      console.error(`❌ Routing error for ${message.messageId}: ${error}`);
    });

    // Setup Socket.io connection handler
    this.io.on(SocketEvents.CONNECTION, (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: Socket): void {
    console.log(`🔌 New connection: ${socket.id}`);

    // Register event
    socket.on(SocketEvents.REGISTER, (payload: RegisterPayload) => {
      this.handleRegister(socket, payload);
    });

    // Disconnect event
    socket.on(SocketEvents.DISCONNECT, () => {
      this.handleDisconnect(socket);
    });

    // Heartbeat event
    socket.on(SocketEvents.HEARTBEAT, () => {
      socket.emit(SocketEvents.HEARTBEAT, { timestamp: Date.now() });
    });

    // Stats request
    socket.on(SocketEvents.STATS, () => {
      socket.emit(SocketEvents.STATS, this.getStats());
    });
  }

  /**
   * Handle client registration
   */
  private handleRegister(socket: Socket, payload: RegisterPayload): void {
    try {
      // Register client
      const clientInfo = this.connectionManager.registerClient(
        socket,
        payload.clientType,
        payload.metadata
      );

      // Send confirmation
      socket.emit(SocketEvents.REGISTERED, clientInfo);

      // Setup type-specific handlers
      this.setupClientHandlers(socket, payload.clientType);

      // If transformer or consumer, send current bucket list
      if (
        payload.clientType === ClientType.TRANSFORMER ||
        payload.clientType === ClientType.CONSUMER
      ) {
        const buckets = this.bucketManager.getAllBuckets();
        socket.emit(SocketEvents.BUCKET_AVAILABLE,
          buckets.map(metadata => ({
            bucketId: metadata.bucketId,
            metadata,
            isAvailable: true,
            timestamp: Date.now()
          }))
        );
      }
    } catch (error) {
      const errorResponse: ErrorResponse = {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to register client',
        details: error
      };
      socket.emit(SocketEvents.ERROR, errorResponse);
    }
  }

  /**
   * Setup client-type specific event handlers
   */
  private setupClientHandlers(socket: Socket, clientType: ClientType): void {
    switch (clientType) {
      case ClientType.EXTRACTOR:
        this.setupExtractorHandlers(socket);
        break;
      case ClientType.TRANSFORMER:
      case ClientType.CONSUMER:
        this.setupSubscriberHandlers(socket);
        break;
    }

    // All clients can send messages
    socket.on(SocketEvents.MESSAGE, (message: Message) => {
      this.handleMessage(socket, message);
    });
  }

  /**
   * Setup handlers for Extractor clients
   */
  private setupExtractorHandlers(socket: Socket): void {
    socket.on(SocketEvents.CREATE_BUCKET, (metadata: BucketMetadata) => {
      try {
        const created = this.bucketManager.createBucket(metadata);

        if (created) {
          // Subscribe the extractor to their own bucket
          this.bucketManager.subscribeToBucket(metadata.bucketId, socket.id);
          this.connectionManager.addBucketSubscription(socket.id, metadata.bucketId);

          socket.emit(SocketEvents.BUCKET_CREATED, {
            bucketId: metadata.bucketId,
            success: true
          });
        } else {
          socket.emit(SocketEvents.ERROR, {
            code: 'BUCKET_EXISTS',
            message: 'Bucket already exists'
          });
        }
      } catch (error) {
        socket.emit(SocketEvents.ERROR, {
          code: 'BUCKET_CREATION_FAILED',
          message: 'Failed to create bucket',
          details: error
        });
      }
    });
  }

  /**
   * Setup handlers for Transformer and Consumer clients
   */
  private setupSubscriberHandlers(socket: Socket): void {
    socket.on(SocketEvents.SUBSCRIBE_BUCKET, (payload: SubscriptionPayload) => {
      try {
        const subscribed = this.bucketManager.subscribeToBucket(
          payload.bucketId,
          socket.id
        );

        if (subscribed) {
          this.connectionManager.addBucketSubscription(socket.id, payload.bucketId);

          // Join Socket.io room for this bucket
          socket.join(`bucket:${payload.bucketId}`);

          socket.emit(SocketEvents.MESSAGE_ACK, {
            action: 'subscribe',
            bucketId: payload.bucketId,
            success: true
          });
        } else {
          socket.emit(SocketEvents.ERROR, {
            code: 'BUCKET_NOT_FOUND',
            message: 'Bucket does not exist'
          });
        }
      } catch (error) {
        socket.emit(SocketEvents.ERROR, {
          code: 'SUBSCRIPTION_FAILED',
          message: 'Failed to subscribe to bucket',
          details: error
        });
      }
    });

    socket.on(SocketEvents.UNSUBSCRIBE_BUCKET, (payload: SubscriptionPayload) => {
      this.bucketManager.unsubscribeFromBucket(payload.bucketId, socket.id);
      this.connectionManager.removeBucketSubscription(socket.id, payload.bucketId);
      socket.leave(`bucket:${payload.bucketId}`);
    });
  }

  /**
   * Handle message routing
   */
  private handleMessage(socket: Socket, message: Message): void {
    try {
      // Validate message
      if (!this.messageRouter.validateMessage(message)) {
        socket.emit(SocketEvents.ERROR, {
          code: 'INVALID_MESSAGE',
          message: 'Message validation failed'
        });
        return;
      }

      // Route message to targets
      const targets = this.messageRouter.routeMessage(message);

      // Send to each target
      for (const target of targets) {
        const targetSocket = this.connectionManager.getSocket(target.clientId);
        if (targetSocket) {
          targetSocket.emit(SocketEvents.MESSAGE, message);
        }
      }

      // Also broadcast to bucket room for any room-based subscribers
      this.io.to(`bucket:${message.bucketId}`).emit(SocketEvents.MESSAGE, message);

      // Send acknowledgment
      socket.emit(SocketEvents.MESSAGE_ACK, {
        messageId: message.messageId,
        delivered: targets.length
      });
    } catch (error) {
      socket.emit(SocketEvents.ERROR, {
        code: 'MESSAGE_ROUTING_FAILED',
        message: 'Failed to route message',
        details: error
      });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(socket: Socket): void {
    this.connectionManager.unregisterClient(socket.id);
  }

  /**
   * Get server statistics
   */
  private getStats(): ServerStats {
    return {
      connectedClients: this.connectionManager.getConnectionCounts(),
      activeBuckets: this.bucketManager.getActiveBucketCount(),
      totalMessagesRouted: this.messageRouter.getMessageCount(),
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down server...');

    // Close all connections
    this.io.close();

    // Clear state
    this.bucketManager.clear();
    this.connectionManager.clear();

    console.log('✅ Server shut down gracefully');
  }
}
