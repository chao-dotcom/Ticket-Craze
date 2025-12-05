import app from './app';

import { initializeFlashSale } from './routes/flash';

const PORT: number = process.env.PORT ? Number(process.env.PORT) : 3000;

async function start() {
  try {
    // Initialize flash sale module
    if (typeof initializeFlashSale === 'function') {
      await initializeFlashSale();
    }

    // Start server
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Flash sale API server listening on port ${PORT}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
