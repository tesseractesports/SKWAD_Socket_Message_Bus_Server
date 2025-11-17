/**
 * Simple Socket.io Client Example (JavaScript)
 *
 * This example shows how to:
 * - Connect to the server
 * - Join multiple rooms
 * - Send DIFFERENT MESSAGE TYPES to rooms
 * - Receive and handle different message types
 * - Leave rooms
 *
 * Run: node examples/client-example.js
 */

const { io } = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Create a client instance
const client = io(SERVER_URL);

console.log('🔌 Connecting to server...');

// Event: Connected to server
client.on('connect', () => {
  console.log(`\n✅ Connected! My ID: ${client.id}\n`);

  // Join some rooms
  console.log('📥 Joining rooms...');
  client.emit('join-room', 'game-room-1');
  client.emit('join-room', 'chat-room');
  client.emit('join-room', 'notifications');
});

// Event: Successfully joined a room
client.on('joined-room', (data) => {
  console.log(`✓ Joined room: "${data.room}"`);

  // Send different message types when joining different rooms
  setTimeout(() => {
    sendMessagesByRoomType(data.room);
  }, 1000);
});

// Function to send different message types based on room
function sendMessagesByRoomType(room) {
  console.log(`\n📤 Sending messages to ${room}...`);

  if (room === 'game-room-1') {
    // Send GAME EVENT messages
    client.emit('message', {
      room: room,
      message: {
        type: 'game_event',
        event: 'player_joined',
        playerId: client.id,
        playerName: 'Player_' + client.id.substring(0, 4),
        timestamp: Date.now()
      }
    });

    // Send game state update
    setTimeout(() => {
      client.emit('message', {
        room: room,
        message: {
          type: 'game_state',
          gameId: 'match-123',
          state: {
            players: 4,
            round: 2,
            currentPlayer: client.id,
            pot: 1500
          },
          timestamp: Date.now()
        }
      });
    }, 2000);

  } else if (room === 'chat-room') {
    // Send CHAT messages
    client.emit('message', {
      room: room,
      message: {
        type: 'chat',
        text: `Hello everyone! I'm ${client.id}`,
        sender: client.id,
        timestamp: Date.now()
      }
    });

  } else if (room === 'notifications') {
    // Send NOTIFICATION messages
    client.emit('message', {
      room: room,
      message: {
        type: 'notification',
        level: 'info',
        title: 'New Player Online',
        body: `${client.id} has joined the game`,
        timestamp: Date.now()
      }
    });
  }
}

// Event: Successfully left a room
client.on('left-room', (data) => {
  console.log(`✓ Left room: "${data.room}"`);
});

// Event: Received a message from a room
client.on('message', (data) => {
  console.log('\n📨 Message received:');
  console.log(`   From:    ${data.from}`);
  console.log(`   Room:    ${data.room}`);

  // Handle different message types
  const msg = data.message;

  if (msg.type === 'chat') {
    console.log(`   [CHAT] ${msg.sender}: ${msg.text}`);
  } else if (msg.type === 'game_event') {
    console.log(`   [GAME EVENT] ${msg.event}:`, msg);
  } else if (msg.type === 'game_state') {
    console.log(`   [GAME STATE] Game ${msg.gameId}:`, msg.state);
  } else if (msg.type === 'notification') {
    console.log(`   [${msg.level.toUpperCase()}] ${msg.title}: ${msg.body}`);
  } else if (msg.type === 'system') {
    console.log(`   [SYSTEM] ${msg.action}:`, msg.data);
  } else {
    console.log(`   [UNKNOWN TYPE] Message:`, msg);
  }

  console.log(`   Time:    ${new Date(data.timestamp).toLocaleString()}`);
});

// Event: Disconnected from server
client.on('disconnect', (reason) => {
  console.log(`\n❌ Disconnected: ${reason}`);
});

// Event: Connection error
client.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

// Example: Send various message types periodically
let messageCount = 0;
const messagingInterval = setInterval(() => {
  messageCount++;

  if (messageCount > 5) {
    clearInterval(messagingInterval);
    return;
  }

  // Rotate through different message types
  if (messageCount === 1) {
    // Send a chat message
    client.emit('message', {
      room: 'chat-room',
      message: {
        type: 'chat',
        text: 'How is everyone doing?',
        sender: client.id,
        timestamp: Date.now()
      }
    });
  } else if (messageCount === 2) {
    // Send a game action
    client.emit('message', {
      room: 'game-room-1',
      message: {
        type: 'game_event',
        event: 'player_action',
        action: 'bet',
        amount: 100,
        playerId: client.id,
        timestamp: Date.now()
      }
    });
  } else if (messageCount === 3) {
    // Send a system message
    client.emit('message', {
      room: 'game-room-1',
      message: {
        type: 'system',
        action: 'round_end',
        data: {
          winner: client.id,
          winAmount: 500
        },
        timestamp: Date.now()
      }
    });
  } else if (messageCount === 4) {
    // Send a notification
    client.emit('message', {
      room: 'notifications',
      message: {
        type: 'notification',
        level: 'success',
        title: 'Achievement Unlocked',
        body: 'You won your first game!',
        timestamp: Date.now()
      }
    });
  } else if (messageCount === 5) {
    // Send custom data structure
    client.emit('message', {
      room: 'game-room-1',
      message: {
        type: 'custom_analytics',
        metrics: {
          gamesPlayed: 10,
          winRate: 0.67,
          averagePot: 1200,
          bestHand: 'Royal Flush'
        },
        timestamp: Date.now()
      }
    });
  }

  console.log(`\n📤 Sent message type #${messageCount}`);

}, 3000);

// Example: Leave a room after 20 seconds
setTimeout(() => {
  console.log('\n📤 Leaving game-room-1...');
  client.emit('leave-room', 'game-room-1');
}, 20000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  client.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down...');
  client.close();
  process.exit(0);
});

console.log('\n💡 Press Ctrl+C to exit\n');
console.log('📝 Watch for different message types:');
console.log('   - chat: Chat messages');
console.log('   - game_event: Game actions and events');
console.log('   - game_state: Game state updates');
console.log('   - notification: User notifications');
console.log('   - system: System messages');
console.log('   - custom_analytics: Custom data structures\n');
