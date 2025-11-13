// File: src/naive-server.js
// MOST NAIVE IMPLEMENTATION - MySQL + Node.js only (NO Redis, NO Kafka)
// FOR COMPARISON ONLY - DO NOT USE IN PRODUCTION

const express = require('express');
const flashNaiveRouter = require('./routes/flash-naive');

const app = express();

app.use(express.json());

// Naive flash sale endpoint
app.use('/api/v1/flash', flashNaiveRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    implementation: 'naive-mysql-only',
    warning: '⚠️ This is a naive MySQL-only implementation for comparison only - will oversell!',
    note: 'Uses only MySQL and Node.js - no Redis, no Kafka, no atomic operations'
  });
});

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`⚠️  Naive MySQL-only implementation server running on port ${PORT}`);
  console.log('⚠️  WARNING: This implementation has race conditions and will oversell!');
  console.log('⚠️  Uses: MySQL + Node.js only (NO Redis, NO Kafka)');
  console.log('⚠️  Use only for comparison with the optimized implementation.');
  console.log('');
  console.log('📊 Endpoints:');
  console.log(`   POST http://localhost:${PORT}/api/v1/flash/purchase`);
  console.log(`   GET  http://localhost:${PORT}/api/v1/flash/inventory`);
  console.log(`   GET  http://localhost:${PORT}/health`);
});

