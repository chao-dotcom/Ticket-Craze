// File: src/utils/snowflake.js
/**
 * Snowflake ID Generator
 * Format: 64-bit ID
 * - 41 bits: timestamp (milliseconds since epoch)
 * - 10 bits: node/worker ID
 * - 12 bits: sequence number
 */
class SnowflakeGenerator {
  constructor(nodeId = 1, epoch = 1609459200000) {  // Jan 1, 2021
    this.nodeId = BigInt(nodeId & 0x3FF);  // 10 bits (0-1023)
    this.epoch = BigInt(epoch);
    this.sequence = 0n;
    this.lastTimestamp = -1n;
  }

  nextId() {
    let timestamp = BigInt(Date.now());

    // Handle clock moving backwards
    if (timestamp < this.lastTimestamp) {
      throw new Error(
        `Clock moved backwards. Refusing to generate ID for ${
          this.lastTimestamp - timestamp
        }ms`
      );
    }

    // Same millisecond - increment sequence
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & 0xFFFn;  // 12 bits
      
      // Sequence overflow - wait for next millisecond
      if (this.sequence === 0n) {
        while (BigInt(Date.now()) <= timestamp) {
          // Busy wait
        }
        timestamp = BigInt(Date.now());
      }
    } else {
      // New millisecond - reset sequence
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    // Construct ID: timestamp | nodeId | sequence
    const id = 
      ((timestamp - this.epoch) << 22n) |  // 41 bits timestamp
      (this.nodeId << 12n) |                // 10 bits node ID
      this.sequence;                        // 12 bits sequence

    return id.toString();
  }

  // Parse snowflake ID back to components
  parse(id) {
    const bigId = BigInt(id);
    return {
      timestamp: Number((bigId >> 22n) + this.epoch),
      nodeId: Number((bigId >> 12n) & 0x3FFn),
      sequence: Number(bigId & 0xFFFn)
    };
  }
}

// Singleton instance
const nodeId = parseInt(process.env.NODE_ID || '1', 10);
const snowflake = new SnowflakeGenerator(nodeId);

module.exports = snowflake;

