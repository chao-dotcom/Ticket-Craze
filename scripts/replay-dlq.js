// Script: scripts/replay-dlq.js
const { Kafka } = require('kafkajs');

const kafka = new Kafka({ brokers: process.env.KAFKA_BROKERS.split(',') });
const consumer = kafka.consumer({ groupId: 'dlq-replay' });
const producer = kafka.producer();

async function replay() {
  await consumer.connect();
  await producer.connect();
  
  await consumer.subscribe({ topic: 'order-dead-letter', fromBeginning: true });
  
  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log('Replaying message:', message.key.toString());
      
      // Remove error headers
      const { error, 'failed-at': failedAt, ...cleanHeaders } = message.headers;
      
      // Send back to original topic
      await producer.send({
        topic: 'reservations',
        messages: [{
          key: message.key,
          value: message.value,
          headers: cleanHeaders
        }]
      });
    }
  });
}

replay().catch(console.error);

