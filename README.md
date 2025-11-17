# Simple Socket.io Message Bus Server

A super simple Socket.io server that lets clients connect, join rooms, and exchange messages. No complex features, no client types, no buckets - just pure room-based messaging.

## What It Does

- Clients connect to the server
- Clients join rooms by sending room names
- Clients can join multiple rooms
- Clients send messages to rooms
- Server relays messages to all clients in the room

That's it!

## Installation

```bash
npm install
npm run build
npm start
```

## Configuration

Create a `.env` file:

```env
PORT=3000
CORS_ORIGIN=*
```

## API / Events

### Connect
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```

### Join a Room
```typescript
socket.emit('join-room', 'game-room-1');

socket.on('joined-room', (data) => {
  console.log('Joined:', data.room);
});
```

### Join Multiple Rooms
```typescript
socket.emit('join-room', 'game-room-1');
socket.emit('join-room', 'chat-room-1');
socket.emit('join-room', 'lobby-room');
```

### Leave a Room
```typescript
socket.emit('leave-room', 'game-room-1');

socket.on('left-room', (data) => {
  console.log('Left:', data.room);
});
```

### Send a Message to a Room
```typescript
socket.emit('message', {
  room: 'game-room-1',
  message: { text: 'Hello!', data: { foo: 'bar' } }
});
```

### Receive Messages from a Room
```typescript
socket.on('message', (data) => {
  console.log('From:', data.from);        // Socket ID of sender
  console.log('Room:', data.room);        // Room name
  console.log('Message:', data.message);  // Your message data
  console.log('Time:', data.timestamp);   // Timestamp
});
```

## Example Client

See `examples/client-example.ts` for a complete example:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('join-room', 'my-room');
});

socket.on('joined-room', (data) => {
  socket.emit('message', {
    room: 'my-room',
    message: { text: 'Hello everyone!' }
  });
});

socket.on('message', (data) => {
  console.log('Received:', data.message);
});
```

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
```

## Project Structure

```
.
├── src/
│   ├── MessageBusServer.ts    # Main server
│   ├── config.ts              # Configuration
│   └── index.ts               # Entry point
├── examples/
│   └── client-example.ts      # Client example
├── package.json
└── tsconfig.json
```

## License

MIT
