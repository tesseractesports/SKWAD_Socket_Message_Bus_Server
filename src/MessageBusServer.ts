/**
 * Simple Socket Message Bus Server
 * Clients connect, join rooms, and exchange messages
 */

import { Server as SocketIOServer, Socket } from 'socket.io';

export interface ServerConfig {
  port: number;
  corsOrigin: string;
}

export class MessageBusServer {
  private io: SocketIOServer;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;

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
    this.io.listen(this.config.port);
    console.log(`🚀 Socket server started on port ${this.config.port}`);
    console.log(`🌍 CORS origin: ${this.config.corsOrigin}`);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`✅ Client connected: ${socket.id}`);

      // Client joins a room
      socket.on('join-room', (roomName: string) => {
        socket.join(roomName);
        console.log(`📥 Client ${socket.id} joined room: ${roomName}`);
        socket.emit('joined-room', { room: roomName });
      });

      // Client leaves a room
      socket.on('leave-room', (roomName: string) => {
        socket.leave(roomName);
        console.log(`📤 Client ${socket.id} left room: ${roomName}`);
        socket.emit('left-room', { room: roomName });
      });

      // Client sends a message to a room
      socket.on('message', (data: any) => {
        console.log(`📨 Message received from ${socket.id}`);
       // console.log(`   Data:`, JSON.stringify(data, null, 2));
        console.log(`   Room: ${data.room}`);
        console.log(`   Message type: ${data.messageType || 'none'}`);

        if (!data.room) {
          console.error(`❌ No room specified in message from ${socket.id}`);
          return;
        }

        // Send to all clients in the room (including sender)
        this.io.to(data.room).emit(data.messageType, {
          from: socket.id,
          room: data.room,
          message: data.message,
          messageType: data.messageType,
          timestamp: Date.now()
        });

        console.log(`✓ Message sent to room ${data.room} , messageType: ${data.messageType}`);
      });

      // Client disconnects
      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Shutdown server
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down server...');
    this.io.close();
    console.log('✅ Server shut down');
  }
}
