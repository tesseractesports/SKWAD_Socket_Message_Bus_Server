/**
 * Socket.io Message Bus Server
 * Main entry point
 */

import { MessageBusServer } from './MessageBusServer.js';
import { config } from './config.js';

async function main() {
  console.log('🚀 Starting Socket.io Message Bus Server...');
  console.log(`📊 Environment: ${config.nodeEnv}`);

  const server = new MessageBusServer({
    port: config.port,
    corsOrigin: config.corsOrigin,
    redisHost: config.redisHost,
    redisPort: config.redisPort,
    redisPassword: config.redisPassword,
    enableRedis: config.enableRedis
  });

  try {
    await server.start();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n📡 Received ${signal}, starting graceful shutdown...`);
    await server.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
