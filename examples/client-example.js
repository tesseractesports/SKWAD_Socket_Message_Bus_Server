/**
 * Simple Socket.io Client Example (JavaScript)
 *
 * This example shows how to:
 * - Connect to the server
 * - Join multiple rooms
 * - Send messages to rooms
 * - Receive messages from rooms
 * - Leave rooms
 *
 * Run: node examples/client-example.js
 */

const { io } = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Create a client instance
const client = io(SERVER_URL);

console.log('= Connecting to server...');

// Event: Connected to server
client.on('connect', () => {
  console.log(`\n Connected! My ID: ${client.id}\n`);

  // Join some rooms
  console.log('=å Joining rooms...');
  client.emit('join-room', 'game-room-1');
  client.emit('join-room', 'chat-room');
  client.emit('join-room', 'notifications');
});

// Event: Successfully joined a room
client.on('joined-room', (data) => {
  console.log(` Joined room: "${data.room}"`);

  // Send a message when we join
  setTimeout(() => {
    console.log(`\n=ä Sending message to ${data.room}...`);
    client.emit('message', {
      room: data.room,
      message: {
        text: `Hello from ${client.id}!`,
        timestamp: new Date().toISOString()
      }
    });
  }, 1000);
});

// Event: Successfully left a room
client.on('left-room', (data) => {
  console.log(` Left room: "${data.room}"`);
});

// Event: Received a message from a room
client.on('message', (data) => {
  console.log('\n=è Message received:');
  console.log(`   From:    ${data.from}`);
  console.log(`   Room:    ${data.room}`);
  console.log(`   Message:`, data.message);
  console.log(`   Time:    ${new Date(data.timestamp).toLocaleString()}`);
});

// Event: Disconnected from server
client.on('disconnect', (reason) => {
  console.log(`\nL Disconnected: ${reason}`);
});

// Event: Connection error
client.on('connect_error', (error) => {
  console.error('L Connection error:', error.message);
});

// Example: Leave a room after 10 seconds
setTimeout(() => {
  console.log('\n=ä Leaving game-room-1...');
  client.emit('leave-room', 'game-room-1');
}, 10000);

// Example: Send periodic messages
let messageCount = 0;
const messagingInterval = setInterval(() => {
  messageCount++;

  if (messageCount > 3) {
    clearInterval(messagingInterval);
    return;
  }

  client.emit('message', {
    room: 'chat-room',
    message: {
      type: 'chat',
      text: `Periodic message #${messageCount}`,
      data: { count: messageCount }
    }
  });
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n=K Shutting down...');
  client.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n=K Shutting down...');
  client.close();
  process.exit(0);
});

console.log('\n=¡ Press Ctrl+C to exit\n');
