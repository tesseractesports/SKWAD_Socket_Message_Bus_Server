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

## Message Types

The server doesn't enforce any message structure - you can send ANY data you want! However, here are recommended message type patterns for common use cases:

### Chat Messages
```javascript
socket.emit('message', {
  room: 'chat-room',
  message: {
    type: 'chat',
    text: 'Hello everyone!',
    sender: 'Alice',
    timestamp: Date.now()
  }
});
```

### Game Events
```javascript
socket.emit('message', {
  room: 'game-room',
  message: {
    type: 'game_event',
    event: 'player_action',
    action: 'bet',
    amount: 100,
    playerId: socket.id,
    timestamp: Date.now()
  }
});
```

### Game State Updates
```javascript
socket.emit('message', {
  room: 'game-room',
  message: {
    type: 'game_state',
    gameId: 'match-123',
    state: {
      round: 2,
      pot: 500,
      activePlayers: 4,
      currentPlayer: 'player-id-123'
    },
    timestamp: Date.now()
  }
});
```

### Notifications
```javascript
socket.emit('message', {
  room: 'notifications',
  message: {
    type: 'notification',
    level: 'info',        // info, success, warning, error
    title: 'New Achievement',
    body: 'You won 10 games!',
    timestamp: Date.now()
  }
});
```

### System Messages
```javascript
socket.emit('message', {
  room: 'game-room',
  message: {
    type: 'system',
    action: 'round_complete',
    data: {
      winner: 'Alice',
      winAmount: 500
    },
    timestamp: Date.now()
  }
});
```

### Custom Message Types
Create your own message types for any use case:
```javascript
socket.emit('message', {
  room: 'analytics',
  message: {
    type: 'player_stats',
    playerId: socket.id,
    stats: {
      handsPlayed: 50,
      winRate: 0.64,
      totalWinnings: 5000
    },
    timestamp: Date.now()
  }
});
```

**Key Points:**
- The server is **"dumb"** - it doesn't validate or process message content
- You can use **any message structure** you want
- The `type` field is just a convention to help clients handle messages
- All examples above are just patterns - not requirements!

## Running Examples

The project includes example clients demonstrating **different message types**:

### Single Client Example

Run a single client that demonstrates various message types:

```bash
# JavaScript version
npm run example

# TypeScript version
npm run example:ts
```

This example shows:
- Connecting to the server
- Joining multiple rooms (game, chat, notifications)
- Sending **6 different message types**: chat, game_event, game_state, notification, system, custom_analytics
- Receiving and handling different message types
- Leaving rooms

**Message types demonstrated:**
- `chat` - Text messages
- `game_event` - Game actions (player_joined, player_action)
- `game_state` - Game state updates
- `notification` - User notifications (info, success)
- `system` - System messages
- `custom_analytics` - Custom data structures

### Multi-Client Demo

Run a demo with 3 clients exchanging different message types:

```bash
npm run example:multi
```

This demonstrates:
- Multiple clients in the same rooms (poker-table-1, lobby-chat)
- **10 different messages** showcasing all message types
- Real-time message broadcasting between clients
- Type-specific message formatting with emojis
- Colored console output for each client

**Watch the demo cycle through:**
1. Chat messages between players
2. Game events (player joined, actions)
3. Game state updates (round progression)
4. Notifications (info, success levels)
5. System messages (round complete)
6. Custom message types (player stats)

## Quick Start

**Terminal 1 - Start the server:**
```bash
npm run dev
```

**Terminal 2 - Run a client example:**
```bash
npm run example
```

Or create your own client:

```javascript
const { io } = require('socket.io-client');

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
│   ├── MessageBusServer.ts          # Main server (88 lines)
│   ├── config.ts                    # Configuration
│   └── index.ts                     # Entry point
├── examples/
│   ├── client-example.js            # Single client example (JavaScript)
│   ├── client-example.ts            # Single client example (TypeScript)
│   └── multi-client-example.js      # Multiple clients demo
├── package.json
└── tsconfig.json
```

## License

MIT
