// File: src/naive-no-kafka-server.js
// NAIVE IMPLEMENTATION - Redis but NO Kafka
// FOR COMPARISON ONLY - DO NOT USE IN PRODUCTION

const express = require('express');
const flashNaiveNoKafkaRouter = require('./routes/flash-naive-no-kafka');

const app = express();

app.use(express.json());

// Naive flash sale endpoint (Redis but no Kafka)
app.use('/api/v1/flash', flashNaiveNoKafkaRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    implementation: 'naive-redis-no-kafka',
    warning: '⚠️ This implementation uses Redis for atomic inventory but synchronous MySQL writes',
    note: 'Uses Redis (atomic ops) but NO Kafka - demonstrates performance impact of synchronous DB writes'
  });
});

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`⚠️  Naive Redis-only (no Kafka) server running on port ${PORT}`);
  console.log('⚠️  WARNING: This implementation uses Redis but synchronous MySQL writes!');
  console.log('⚠️  Uses: Redis (atomic) + MySQL (synchronous) - NO Kafka');
  console.log('⚠️  Use only for comparison with the optimized implementation.');
  console.log('');
  console.log('📊 Endpoints:');
  console.log(`   POST http://localhost:${PORT}/api/v1/flash/purchase`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log('');
  console.log('💡 This shows:');
  console.log('   ✅ Redis prevents race conditions (no overselling)');
  console.log('   ❌ But synchronous MySQL writes create bottleneck (200-500ms per request)');
});

