// File: scripts/setup-kafka-topics.js
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'topic-setup',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const admin = kafka.admin();

async function setupTopics() {
  try {
    await admin.connect();
    console.log('Connected to Kafka');

    const topics = [
      {
        topic: 'reservations',
        numPartitions: 32,
        replicationFactor: 1,  // Use 1 for local dev, 3 for production
        configEntries: [
          { name: 'retention.ms', value: '86400000' },  // 24 hours
          { name: 'compression.type', value: 'snappy' },
          { name: 'min.insync.replicas', value: '1' }
        ]
      },
      {
        topic: 'orders',
        numPartitions: 32,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '604800000' },  // 7 days
          { name: 'cleanup.policy', value: 'compact' },
          { name: 'min.insync.replicas', value: '1' }
        ]
      },
      {
        topic: 'payments',
        numPartitions: 16,
        replicationFactor: 1
      },
      {
        topic: 'order-dead-letter',
        numPartitions: 8,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '2592000000' }  // 30 days
        ]
      }
    ];

    await admin.createTopics({
      topics: topics,
      waitForLeaders: true
    });

    console.log('Topics created successfully');
    
    const topicList = await admin.listTopics();
    console.log('Available topics:', topicList);
  } catch (error) {
    if (error.message && error.message.includes('TopicExistsException')) {
      console.log('Topics already exist, skipping creation');
    } else {
      console.error('Error setting up topics:', error);
      throw error;
    }
  } finally {
    await admin.disconnect();
  }
}

if (require.main === module) {
  setupTopics().catch(console.error);
}

module.exports = { setupTopics };

