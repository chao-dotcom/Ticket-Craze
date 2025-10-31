// File: src/routes/metrics.js
const express = require('express');
const { register } = require('../utils/metrics');

const router = express.Router();

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = router;

