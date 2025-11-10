# Socket.io Message Bus Server

A clean, modern, stateless Socket.io-based Message Bus Server designed for routing real-time messages between Extractors, Transformers, and Consumers. This server is intentionally "dumb" and contains no game logic - it only handles routing and pub/sub functionality.

## Architecture Overview

```
┌─────────────┐
│  Extractor  │───┐
└─────────────┘   │
                  │    ┌──────────────────────┐
┌─────────────┐   ├───▶│  Message Bus Server  │
│  Extractor  │───┤    │   (Socket.io Hub)    │
└─────────────┘   │    └──────────────────────┘
                  │              │
┌─────────────┐   │              │
│  Extractor  │───┘              │
└─────────────┘                  │
                                 ▼
                  ┌──────────────────────────┐
                  │   Dynamic Buckets        │
                  │   (Game Sessions)        │
                  └──────────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                ▼                ▼                ▼
         ┌─────────────┐  ┌─────────────┐  ┌──────────┐
         │ Transformer │  │ Transformer │  │ Consumer │
         └─────────────┘  └─────────────┘  └──────────┘
```

## Key Features

- **Stateless Design**: No persistent state, scales horizontally
- **Dynamic Buckets**: Creates routing channels based on game metadata
- **Pub/Sub Pattern**: Publishers and subscribers for each bucket
- **Real-time Routing**: Routes messages between ecosystem actors
- **Redis Adapter**: Optional Redis support for multi-instance deployments
- **TypeScript**: Fully typed for safety and developer experience
- **Docker Ready**: Containerized with Docker Compose orchestration

## Core Components

### 1. BucketManager
Manages dynamic buckets (logical groupings for game sessions):
- Creates buckets based on Extractor metadata
- Manages subscriptions per bucket
- Broadcasts bucket availability to subscribers
- Cleans up buckets when Extractors disconnect

### 2. MessageRouter
Routes messages between actors:
- Validates message structure
- Routes based on bucket subscriptions
- Tracks message throughput
- Emits routing events for monitoring

### 3. ConnectionManager
Manages client connections:
- Tracks connected clients by type (Extractor, Transformer, Consumer)
- Maintains client metadata and subscriptions
- Handles registration and disconnection
- Provides connection statistics

## Client Types

### Extractor
- Creates buckets with game metadata
- Publishes game data to buckets
- Auto-cleanup on disconnect

### Transformer
- Subscribes to buckets of interest
- Receives game data from Extractors
- Publishes transformed data back to buckets

### Consumer
- Subscribes to buckets
- Receives both raw and transformed data
- Read-only participants

## Installation

### Using npm

```bash
npm install
npm run build
npm start
```

### Using Docker

```bash
# Single instance
docker build -t message-bus .
docker run -p 3000:3000 message-bus

# Horizontal scaling with Redis
docker-compose up
```

## Configuration

Create a `.env` file (see `.env.example`):

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Redis Configuration (for horizontal scaling)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS Configuration
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info
```

## API / Event Protocol

### Connection Flow

1. **Connect** to server
2. **Register** as a client type:
```typescript
socket.emit('register', {
  clientType: 'extractor' | 'transformer' | 'consumer',
  metadata: { /* optional */ }
})

socket.on('registered', (clientInfo) => {
  console.log('Registered:', clientInfo)
})
```

### Extractor Events

**Create Bucket**
```typescript
socket.emit('create_bucket', {
  bucketId: 'game-session-123',
  gameType: 'poker',
  gameVersion: '2.0',
  region: 'us-west',
  additionalMetadata: {}
})

socket.on('bucket_created', ({ bucketId, success }) => {
  console.log('Bucket created:', bucketId)
})
```

**Send Message**
```typescript
socket.emit('message', {
  messageId: 'msg-123',
  messageType: 'game_data',
  bucketId: 'game-session-123',
  sourceClientId: socket.id,
  sourceClientType: 'extractor',
  timestamp: Date.now(),
  payload: { /* game data */ }
})
```

### Transformer/Consumer Events

**Subscribe to Bucket**
```typescript
socket.emit('subscribe_bucket', {
  bucketId: 'game-session-123'
})

socket.on('message_ack', (ack) => {
  console.log('Subscribed:', ack)
})
```

**Receive Messages**
```typescript
socket.on('message', (message) => {
  console.log('Received:', message)
  // Process message
})
```

**Listen for Bucket Availability**
```typescript
socket.on('bucket_available', (availability) => {
  console.log('New bucket:', availability.bucketId)
  // Optionally auto-subscribe
})

socket.on('bucket_unavailable', (availability) => {
  console.log('Bucket closed:', availability.bucketId)
})
```

### System Events

**Heartbeat**
```typescript
socket.emit('heartbeat')
socket.on('heartbeat', ({ timestamp }) => {
  console.log('Pong:', timestamp)
})
```

**Stats**
```typescript
socket.emit('stats')
socket.on('stats', (stats) => {
  console.log('Server stats:', stats)
})
```

## Message Flow Examples

### Example 1: Extractor → Transformer → Consumer

```typescript
// Extractor creates bucket
extractor.emit('create_bucket', {
  bucketId: 'poker-table-42',
  gameType: 'poker'
})

// Transformer subscribes
transformer.emit('subscribe_bucket', { bucketId: 'poker-table-42' })

// Consumer subscribes
consumer.emit('subscribe_bucket', { bucketId: 'poker-table-42' })

// Extractor sends game data
extractor.emit('message', {
  messageId: 'msg-1',
  messageType: 'game_data',
  bucketId: 'poker-table-42',
  sourceClientId: extractor.id,
  sourceClientType: 'extractor',
  timestamp: Date.now(),
  payload: { hand: [...], pot: 100 }
})

// Transformer receives, processes, and sends back
transformer.on('message', (msg) => {
  const transformed = processData(msg.payload)

  transformer.emit('message', {
    messageId: 'msg-2',
    messageType: 'transformed_data',
    bucketId: 'poker-table-42',
    sourceClientId: transformer.id,
    sourceClientType: 'transformer',
    timestamp: Date.now(),
    payload: transformed
  })
})

// Consumer receives both messages
consumer.on('message', (msg) => {
  console.log('Received:', msg)
})
```

## Horizontal Scaling

The server is designed to be stateless and scales horizontally using Redis as a message adapter:

```bash
# Start multiple instances
docker-compose up --scale message-bus=3
```

All instances share the same Redis backend, ensuring messages are routed across all server instances.

## Monitoring

The server emits events for monitoring:

```typescript
bucketManager.on('bucket:available', (availability) => {
  // Monitor bucket creation
})

messageRouter.on('message:routed', ({ message, targetCount }) => {
  // Monitor message throughput
})

connectionManager.on('client:connected', (clientInfo) => {
  // Monitor connections
})
```

## Project Structure

```
.
├── src/
│   ├── core/
│   │   ├── BucketManager.ts       # Bucket lifecycle management
│   │   ├── ConnectionManager.ts   # Client connection tracking
│   │   └── MessageRouter.ts       # Message routing logic
│   ├── types/
│   │   └── index.ts               # TypeScript definitions
│   ├── MessageBusServer.ts        # Main server orchestration
│   ├── config.ts                  # Configuration loader
│   └── index.ts                   # Entry point
├── Dockerfile                     # Container definition
├── docker-compose.yml             # Multi-container orchestration
├── package.json
└── tsconfig.json
```

## Design Principles

1. **Stateless**: No persistent state, all routing is ephemeral
2. **Dumb Server**: No game logic, only routing
3. **Horizontally Scalable**: Add more instances with Redis adapter
4. **Type Safe**: Full TypeScript coverage
5. **Event-Driven**: Everything is event-based for flexibility
6. **Clean Separation**: Core components are independent and testable

## Development

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Type check
npm run typecheck

# Clean build artifacts
npm run clean
```

## Production Deployment

### Single Instance
```bash
npm run build
NODE_ENV=production PORT=3000 npm start
```

### Kubernetes (example)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: message-bus
spec:
  replicas: 3
  selector:
    matchLabels:
      app: message-bus
  template:
    metadata:
      labels:
        app: message-bus
    spec:
      containers:
      - name: message-bus
        image: message-bus:latest
        env:
        - name: REDIS_HOST
          value: redis-service
        - name: PORT
          value: "3000"
```

## License

MIT

## Contributing

This is a reference architecture. Feel free to extend and customize for your specific use case.
