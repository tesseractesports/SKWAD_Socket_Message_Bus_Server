/**
 * Simple client example
 * Shows how to connect, join rooms, and send messages
 */

import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

// Create client
const client: Socket = io(SERVER_URL);

client.on('connect', () => {
  console.log(`✅ Connected to server with ID: ${client.id}`);

  // Join a room
  client.emit('join-room', 'game-room-1');

  // You can join multiple rooms
  client.emit('join-room', 'chat-room-1');
});

// Listen for room join confirmation
client.on('joined-room', (data) => {
  console.log(`📥 Joined room: ${data.room}`);

  // Send a message to the room
  client.emit('message', {
    room: data.room,
    message: { text: 'Hello from client!', type: 'greeting' }
  });
});

// Listen for messages from the room
client.on('message', (data) => {
  console.log(`📨 Message received:`, data);
  console.log(`   From: ${data.from}`);
  console.log(`   Room: ${data.room}`);
  console.log(`   Message:`, data.message);
  console.log(`   Time: ${new Date(data.timestamp).toISOString()}`);
});

// Listen for room leave confirmation
client.on('left-room', (data) => {
  console.log(`📤 Left room: ${data.room}`);
});

client.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

// Example: Leave a room after 5 seconds
setTimeout(() => {
  console.log('Leaving game-room-1...');
  client.emit('leave-room', 'game-room-1');
}, 5000);

// Keep the process running
process.on('SIGINT', () => {
  console.log('\nClosing connection...');
  client.close();
  process.exit(0);
});
