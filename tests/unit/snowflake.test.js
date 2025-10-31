// File: tests/unit/snowflake.test.js
const Snowflake = require('../../src/utils/snowflake');

describe('Snowflake ID Generator', () => {
  test('generates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 10000; i++) {
      const id = Snowflake.nextId();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });

  test('IDs are time-ordered', () => {
    const id1 = Snowflake.nextId();
    const id2 = Snowflake.nextId();
    expect(BigInt(id2) > BigInt(id1)).toBe(true);
  });

  test('parses ID correctly', () => {
    const id = Snowflake.nextId();
    const parsed = Snowflake.parse(id);
    expect(parsed.nodeId).toBe(1);
    expect(parsed.timestamp).toBeGreaterThan(Date.now() - 1000);
  });
});

