// File: src/middleware/validation.js
const Joi = require('joi');

const purchaseSchema = Joi.object({
  userId: Joi.string().required().pattern(/^[0-9]+$/),
  skuId: Joi.string().required().pattern(/^[0-9]+$/),
  quantity: Joi.number().integer().min(1).max(10).required(),
  idempotencyKey: Joi.string().max(128).optional()
});

function validatePurchase(req, res, next) {
  const { error, value } = purchaseSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: error.details.map(d => d.message)
    });
  }
  
  req.validatedBody = value;
  next();
}

module.exports = { validatePurchase };

