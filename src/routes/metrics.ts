import express, { Request, Response } from 'express';

// Keep requiring the JS utils module to simplify incremental migration
const { register } = require('../utils/metrics');

const router = express.Router();

router.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Keep CommonJS export to remain compatible with existing require() calls
module.exports = router;
export default router;
