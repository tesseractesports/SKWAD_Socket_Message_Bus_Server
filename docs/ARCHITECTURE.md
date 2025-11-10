# Architecture Documentation

## System Overview

The Socket.io Message Bus Server is a stateless, horizontally-scalable real-time communication hub designed to route messages between three types of actors: Extractors, Transformers, and Consumers.

## Design Philosophy

### "Dumb" Server Principle
The server intentionally contains **zero business logic**. It is purely a routing and pub/sub infrastructure. This design decision provides:
- **Simplicity**: Easy to understand, maintain, and scale
- **Flexibility**: Business logic lives in clients, not the server
- **Reliability**: Fewer moving parts = fewer failure points
- **Scalability**: Stateless design enables horizontal scaling

### Stateless Architecture
All state is ephemeral and held in memory:
- No database required
- No persistent storage
- Connections and buckets exist only while active
- Perfect for containerized deployments

## Core Components

### 1. BucketManager

**Purpose**: Manage dynamic routing channels (buckets)

**Responsibilities**:
- Create buckets based on Extractor metadata
- Track bucket subscriptions
- Emit bucket availability/unavailability events
- Clean up buckets on Extractor disconnect

**Key Methods**:
```typescript
createBucket(metadata: BucketMetadata): boolean
removeBucket(bucketId: string): boolean
subscribeToBucket(bucketId: string, clientId: string): boolean
getSubscribers(bucketId: string): string[]
```

**Events**:
- `bucket:available` - New bucket created
- `bucket:unavailable` - Bucket removed

### 2. MessageRouter

**Purpose**: Route messages between clients based on bucket subscriptions

**Responsibilities**:
- Validate message structure
- Determine routing targets based on subscriptions
- Track message throughput metrics
- Filter messages by client type if needed

**Routing Logic**:
```
Message → Validate → Find Subscribers → Filter Source → Route to Targets
```

**Key Methods**:
```typescript
routeMessage(message: Message): RouteTarget[]
routeMessageToType(message: Message, targetType: ClientType): RouteTarget[]
validateMessage(message: Message): boolean
```

**Events**:
- `message:routed` - Message successfully routed
- `route:error` - Routing failure

### 3. ConnectionManager

**Purpose**: Track all connected clients and their metadata

**Responsibilities**:
- Register/unregister clients
- Track client types (Extractor, Transformer, Consumer)
- Maintain bucket subscription lists per client
- Provide connection statistics

**Key Methods**:
```typescript
registerClient(socket: Socket, clientType: ClientType): ClientInfo
unregisterClient(clientId: string): ClientInfo | undefined
getClientsByType(clientType: ClientType): ClientInfo[]
getConnectionCounts(): Record<ClientType, number>
```

**Events**:
- `client:connected` - New client registered
- `client:disconnected` - Client disconnected

### 4. MessageBusServer

**Purpose**: Orchestrate all components and handle Socket.io events

**Responsibilities**:
- Initialize core components
- Setup Socket.io server with Redis adapter
- Wire up event handlers between components
- Provide graceful shutdown

## Data Flow

### Bucket Creation Flow
```
┌────────────┐
│ Extractor  │
└──────┬─────┘
       │ 1. create_bucket (metadata)
       ▼
┌─────────────────┐
│ BucketManager   │
└────────┬────────┘
         │ 2. emit bucket:available
         ▼
┌─────────────────────┐
│ MessageBusServer    │
└──────┬──────────────┘
       │ 3. broadcast bucket_available
       ▼
┌──────────────────────────┐
│ All Transformers/        │
│ Consumers                │
└──────────────────────────┘
```

### Message Routing Flow
```
┌────────────┐
│ Extractor  │ (or Transformer)
└──────┬─────┘
       │ 1. message (to bucket)
       ▼
┌─────────────────┐
│ MessageRouter   │
└────────┬────────┘
         │ 2. routeMessage()
         │    - Find subscribers
         │    - Filter source
         ▼
┌─────────────────────┐
│ ConnectionManager   │
└──────┬──────────────┘
       │ 3. getSocket(targetId)
       ▼
┌──────────────────────────┐
│ Target Clients           │
│ (Transformers/Consumers) │
└──────────────────────────┘
```

### Subscription Flow
```
┌──────────────┐
│ Transformer/ │
│ Consumer     │
└──────┬───────┘
       │ 1. subscribe_bucket
       ▼
┌─────────────────┐
│ BucketManager   │
│ - Add to bucket │
│   subscribers   │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ ConnectionManager   │
│ - Update client     │
│   subscriptions     │
└─────────────────────┘
```

## Actor Roles

### Extractor
**Primary Role**: Data Producer

**Capabilities**:
- Create buckets with game metadata
- Publish raw game data to buckets
- Can receive messages (e.g., control commands)

**Lifecycle**:
1. Connect → Register as Extractor
2. Create bucket(s)
3. Publish game data continuously
4. Disconnect → Buckets auto-removed

**Example Use Cases**:
- Game server extracting live game state
- Log file tailer streaming events
- Sensor data collector

### Transformer
**Primary Role**: Data Processor

**Capabilities**:
- Subscribe to any bucket
- Receive raw game data
- Process/transform data
- Publish transformed data back to bucket

**Lifecycle**:
1. Connect → Register as Transformer
2. Listen for bucket availability
3. Subscribe to buckets of interest
4. Receive → Process → Publish cycle

**Example Use Cases**:
- Real-time analytics engine
- Data enrichment service
- ML inference service

### Consumer
**Primary Role**: Data Sink

**Capabilities**:
- Subscribe to any bucket
- Receive all messages (raw + transformed)
- Read-only access

**Lifecycle**:
1. Connect → Register as Consumer
2. Listen for bucket availability
3. Subscribe to buckets
4. Consume all messages

**Example Use Cases**:
- Database persistence layer
- Live dashboard UI
- Monitoring/logging service

## Scalability

### Horizontal Scaling with Redis

The server uses Socket.io's Redis adapter to enable horizontal scaling:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Instance 1 │────▶│    Redis    │◀────│  Instance 2 │
│  (port 3000)│     │   Adapter   │     │  (port 3001)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                                         │
       ▼                                         ▼
   Clients A                                 Clients B
```

**Benefits**:
- Messages broadcast across all instances
- Clients can connect to any instance
- Load balancer distributes connections
- Stateless instances can be added/removed dynamically

**Setup**:
```yaml
# docker-compose.yml
services:
  message-bus:
    build: .
    environment:
      - REDIS_HOST=redis
    scale: 3  # Run 3 instances

  redis:
    image: redis:7-alpine
```

### Load Balancing Strategy

Use any standard load balancer (nginx, HAProxy, AWS ALB):
- **Sticky sessions**: Not required (stateless)
- **Health checks**: Check `/health` endpoint
- **Distribution**: Round-robin or least connections

Example nginx config:
```nginx
upstream message_bus {
    server message-bus-1:3000;
    server message-bus-2:3000;
    server message-bus-3:3000;
}

server {
    location / {
        proxy_pass http://message_bus;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Event Protocol

### Connection Phase
```
Client → connect → Server
Client → register → Server
Server → registered → Client
```

### Operational Phase

**Extractor**:
```
Extractor → create_bucket → Server
Server → bucket_created → Extractor
Extractor → message → Server → Subscribers
```

**Transformer/Consumer**:
```
Server → bucket_available → Subscriber
Subscriber → subscribe_bucket → Server
Server → message_ack → Subscriber
Extractor/Transformer → message → Server → Subscriber
```

## Type Safety

The system is fully typed using TypeScript:

### Core Types
- `ClientType`: Enum of actor types
- `MessageType`: Enum of message categories
- `BucketMetadata`: Bucket creation payload
- `Message`: Message envelope for routing
- `ClientInfo`: Connected client information

### Benefits
- Compile-time error detection
- IntelliSense support for developers
- Self-documenting API
- Easier refactoring

## Error Handling

### Connection Errors
- Invalid registration → `error` event with code
- Registration timeout → Auto-disconnect

### Routing Errors
- Non-existent bucket → `error` event
- Invalid message structure → `error` event
- Client not subscribed → Silent drop

### System Errors
- Redis connection failure → Fallback to single instance
- Component errors → Logged + error event emitted

## Monitoring & Observability

### Built-in Metrics
```typescript
socket.emit('stats')
socket.on('stats', (stats) => {
  // {
  //   connectedClients: { extractor: 5, transformer: 10, consumer: 20 },
  //   activeBuckets: 15,
  //   totalMessagesRouted: 50000,
  //   uptime: 86400000
  // }
})
```

### Event Monitoring
All components emit events that can be hooked for monitoring:
- `bucket:available` / `bucket:unavailable`
- `client:connected` / `client:disconnected`
- `message:routed`
- `route:error`

### Recommended Monitoring Stack
- **Metrics**: Prometheus + Grafana
- **Logging**: Structured logs → ELK stack
- **Tracing**: OpenTelemetry
- **Alerts**: Based on connection drops, error rates

## Security Considerations

### Current Implementation
- CORS configuration via environment
- No authentication/authorization (intentional for simplicity)
- No message encryption (use TLS at load balancer)

### Production Hardening
Consider adding:
- JWT-based authentication
- Rate limiting per client
- Message size limits
- Client IP whitelisting
- TLS/SSL encryption

## Deployment Patterns

### Pattern 1: Single Instance (Development)
```bash
npm start
```
- No Redis required
- Simple deployment
- Limited scalability

### Pattern 2: Docker Compose (Small-Medium)
```bash
docker-compose up --scale message-bus=3
```
- Redis adapter enabled
- 3+ instances
- Single machine deployment

### Pattern 3: Kubernetes (Large Scale)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: message-bus
spec:
  replicas: 10
  # ... Redis StatefulSet, Service, etc.
```
- Full orchestration
- Auto-scaling
- Multi-node deployment

## Future Enhancements

Potential additions (not included to maintain simplicity):
- Authentication/authorization layer
- Message persistence (optional)
- Message replay capability
- Dead letter queue for failed routing
- Admin dashboard
- Message TTL and expiration
- Client quotas and rate limiting
- Metrics export (Prometheus format)

## Testing Strategy

### Unit Tests
- Test each component in isolation
- Mock Socket.io connections
- Test event emissions

### Integration Tests
- Test component interactions
- Test full message flow
- Test Redis adapter behavior

### Load Tests
- Simulate thousands of connections
- Measure message throughput
- Test horizontal scaling

## Conclusion

This architecture provides a clean, scalable foundation for real-time message routing. Its stateless design and separation of concerns make it easy to understand, deploy, and scale. The "dumb server" principle ensures that business logic remains in clients, making the entire ecosystem flexible and maintainable.
