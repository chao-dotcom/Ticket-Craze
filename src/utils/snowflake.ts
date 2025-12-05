/**
 * Snowflake ID Generator (TypeScript)
 */
class SnowflakeGenerator {
  nodeId: bigint;
  epoch: bigint;
  sequence: bigint;
  lastTimestamp: bigint;

  constructor(nodeId = 1, epoch = 1609459200000) {
    this.nodeId = BigInt(nodeId & 0x3FF);
    this.epoch = BigInt(epoch);
    this.sequence = 0n;
    this.lastTimestamp = -1n;
  }

  nextId(): string {
    let timestamp = BigInt(Date.now());

    if (timestamp < this.lastTimestamp) {
      throw new Error(`Clock moved backwards. Refusing to generate ID for ${this.lastTimestamp - timestamp}ms`);
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & 0xFFFn;
      if (this.sequence === 0n) {
        while (BigInt(Date.now()) <= timestamp) {
          // busy wait
        }
        timestamp = BigInt(Date.now());
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const id = ((timestamp - this.epoch) << 22n) | (this.nodeId << 12n) | this.sequence;
    return id.toString();
  }

  parse(id: string) {
    const bigId = BigInt(id);
    return {
      timestamp: Number((bigId >> 22n) + this.epoch),
      nodeId: Number((bigId >> 12n) & 0x3FFn),
      sequence: Number(bigId & 0xFFFn)
    };
  }
}

const nodeId = parseInt(process.env.NODE_ID || '1', 10);
const snowflake = new SnowflakeGenerator(nodeId);

// Provide both ES and CommonJS exports for compatibility
export default snowflake;
(module as any).exports = snowflake;
