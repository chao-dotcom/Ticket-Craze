// File: src/index.js
const app = require('./app');
const { initializeFlashSale } = require('./routes/flash');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Initialize flash sale module
    await initializeFlashSale();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Flash sale API server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

