// File: tests/integration/purchase.test.js
const request = require('supertest');
const redis = require('redis');
const app = require('../../src/app');

describe('Purchase API Integration', () => {
  let redisClient;

  beforeAll(async () => {
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
  });

  afterAll(async () => {
    if (redisClient) {
      await redisClient.quit();
    }
  });

  beforeEach(async () => {
    // Setup test inventory
    await redisClient.set('inv:sku:1', '100');
  });

  afterEach(async () => {
    // Cleanup test data
    await redisClient.del('inv:sku:1');
    const keys = await redisClient.keys('idem:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  });

  test('successful purchase decrements inventory', async () => {
    const response = await request(app)
      .post('/api/v1/flash/purchase')
      .send({
        userId: '123',
        skuId: '1',
        quantity: 1,
        idempotencyKey: 'test-key-1'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body).toHaveProperty('reservationId');
    expect(response.body).toHaveProperty('orderId');

    const remaining = await redisClient.get('inv:sku:1');
    expect(parseInt(remaining)).toBe(99);
  });

  test('prevents overselling', async () => {
    await redisClient.set('inv:sku:2', '1');

    const responses = await Promise.all([
      request(app).post('/api/v1/flash/purchase').send({
        userId: '123', skuId: '2', quantity: 1, idempotencyKey: 'key-1'
      }),
      request(app).post('/api/v1/flash/purchase').send({
        userId: '124', skuId: '2', quantity: 1, idempotencyKey: 'key-2'
      })
    ]);

    const successes = responses.filter(r => r.status === 200);
    const failures = responses.filter(r => r.status === 410);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });

  test('enforces idempotency', async () => {
    const payload = {
      userId: '123',
      skuId: '1',
      quantity: 1,
      idempotencyKey: 'duplicate-key'
    };

    const response1 = await request(app)
      .post('/api/v1/flash/purchase')
      .send(payload);

    const response2 = await request(app)
      .post('/api/v1/flash/purchase')
      .send(payload);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(409);
    expect(response2.body.error).toBe('DUPLICATE_REQUEST');
  });

  test('rate limiting works', async () => {
    const requests = [];
    for (let i = 0; i < 25; i++) {
      requests.push(
        request(app)
          .post('/api/v1/flash/purchase')
          .send({
            userId: '123',
            skuId: '1',
            quantity: 1,
            idempotencyKey: `key-${i}`
          })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

