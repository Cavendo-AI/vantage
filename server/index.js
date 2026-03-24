import { createApp } from './app.js';

const { start, stop } = createApp();

start().catch(err => {
  console.error('Failed to start Vantage:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stop();
  process.exit(0);
});
