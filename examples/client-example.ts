/**
 * Example client implementations for the Message Bus Server
 *
 * This file demonstrates how to create Extractor, Transformer, and Consumer clients
 */

import { io, Socket } from 'socket.io-client';

// Server URL
const SERVER_URL = 'http://localhost:3000';

/**
 * Example Extractor Client
 */
class ExtractorClient {
  private socket: Socket;
  private bucketId: string;

  constructor(bucketId: string) {
    this.bucketId = bucketId;
    this.socket = io(SERVER_URL);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.socket.on('connect', () => {
      console.log('[Extractor] Connected:', this.socket.id);

      // Register as extractor
      this.socket.emit('register', {
        clientType: 'extractor',
        metadata: { name: 'Game Extractor 1' }
      });
    });

    this.socket.on('registered', (clientInfo) => {
      console.log('[Extractor] Registered:', clientInfo);

      // Create bucket
      this.socket.emit('create_bucket', {
        bucketId: this.bucketId,
        gameType: 'poker',
        gameVersion: '2.0',
        region: 'us-west',
        createdAt: Date.now()
      });
    });

    this.socket.on('bucket_created', ({ bucketId, success }) => {
      console.log('[Extractor] Bucket created:', bucketId, success);

      // Start sending game data
      this.sendGameData();
    });

    this.socket.on('message', (message) => {
      console.log('[Extractor] Received message:', message);
    });

    this.socket.on('error', (error) => {
      console.error('[Extractor] Error:', error);
    });
  }

  private sendGameData() {
    setInterval(() => {
      const message = {
        messageId: `msg-${Date.now()}`,
        messageType: 'game_data',
        bucketId: this.bucketId,
        sourceClientId: this.socket.id,
        sourceClientType: 'extractor',
        timestamp: Date.now(),
        payload: {
          hand: ['AS', 'KS', 'QS', 'JS', 'TS'],
          pot: Math.floor(Math.random() * 1000),
          players: 6,
          currentPlayer: Math.floor(Math.random() * 6)
        }
      };

      this.socket.emit('message', message);
      console.log('[Extractor] Sent game data');
    }, 5000); // Send data every 5 seconds
  }

  disconnect() {
    this.socket.disconnect();
  }
}

/**
 * Example Transformer Client
 */
class TransformerClient {
  private socket: Socket;

  constructor() {
    this.socket = io(SERVER_URL);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.socket.on('connect', () => {
      console.log('[Transformer] Connected:', this.socket.id);

      // Register as transformer
      this.socket.emit('register', {
        clientType: 'transformer',
        metadata: { name: 'Data Transformer 1' }
      });
    });

    this.socket.on('registered', (clientInfo) => {
      console.log('[Transformer] Registered:', clientInfo);
    });

    this.socket.on('bucket_available', (availability) => {
      console.log('[Transformer] New bucket available:', availability.bucketId);

      // Auto-subscribe to poker buckets
      if (availability.metadata.gameType === 'poker') {
        this.socket.emit('subscribe_bucket', {
          bucketId: availability.bucketId
        });
        console.log('[Transformer] Subscribed to bucket:', availability.bucketId);
      }
    });

    this.socket.on('message', (message) => {
      console.log('[Transformer] Received message:', message.messageId);

      // Transform the data
      if (message.messageType === 'game_data') {
        const transformed = this.transformData(message.payload);

        // Send transformed data back to bucket
        this.socket.emit('message', {
          messageId: `transformed-${Date.now()}`,
          messageType: 'transformed_data',
          bucketId: message.bucketId,
          sourceClientId: this.socket.id,
          sourceClientType: 'transformer',
          timestamp: Date.now(),
          payload: transformed
        });

        console.log('[Transformer] Sent transformed data');
      }
    });

    this.socket.on('error', (error) => {
      console.error('[Transformer] Error:', error);
    });
  }

  private transformData(data: any) {
    // Example transformation: calculate hand strength
    return {
      ...data,
      handStrength: Math.random(),
      potOdds: data.pot > 0 ? (data.pot / 100).toFixed(2) : 0,
      recommendation: data.pot > 500 ? 'fold' : 'call',
      transformedAt: Date.now()
    };
  }

  disconnect() {
    this.socket.disconnect();
  }
}

/**
 * Example Consumer Client
 */
class ConsumerClient {
  private socket: Socket;

  constructor() {
    this.socket = io(SERVER_URL);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.socket.on('connect', () => {
      console.log('[Consumer] Connected:', this.socket.id);

      // Register as consumer
      this.socket.emit('register', {
        clientType: 'consumer',
        metadata: { name: 'Data Consumer 1' }
      });
    });

    this.socket.on('registered', (clientInfo) => {
      console.log('[Consumer] Registered:', clientInfo);
    });

    this.socket.on('bucket_available', (availability) => {
      console.log('[Consumer] New bucket available:', availability.bucketId);

      // Auto-subscribe to all buckets
      this.socket.emit('subscribe_bucket', {
        bucketId: availability.bucketId
      });
      console.log('[Consumer] Subscribed to bucket:', availability.bucketId);
    });

    this.socket.on('message', (message) => {
      console.log('[Consumer] Received message:', {
        messageId: message.messageId,
        type: message.messageType,
        from: message.sourceClientType,
        payload: message.payload
      });

      // Consume the data (e.g., store in database, display in UI, etc.)
      this.consumeData(message);
    });

    this.socket.on('bucket_unavailable', (availability) => {
      console.log('[Consumer] Bucket closed:', availability.bucketId);
    });

    this.socket.on('error', (error) => {
      console.error('[Consumer] Error:', error);
    });
  }

  private consumeData(message: any) {
    // Example: Log different message types differently
    if (message.messageType === 'game_data') {
      console.log('[Consumer] 📊 Raw game data:', message.payload);
    } else if (message.messageType === 'transformed_data') {
      console.log('[Consumer] ✨ Transformed data:', message.payload);
    }
  }

  disconnect() {
    this.socket.disconnect();
  }
}

/**
 * Run example scenario
 */
async function runExample() {
  console.log('🚀 Starting Message Bus Client Example\n');

  // Create clients
  const extractor = new ExtractorClient('poker-table-1');

  // Wait a bit for extractor to create bucket
  await new Promise(resolve => setTimeout(resolve, 2000));

  const transformer = new TransformerClient();
  const consumer = new ConsumerClient();

  console.log('\n✅ All clients started. Watch the message flow!\n');

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down clients...');
    extractor.disconnect();
    transformer.disconnect();
    consumer.disconnect();
    process.exit(0);
  });
}

// Run if executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

export { ExtractorClient, TransformerClient, ConsumerClient };
