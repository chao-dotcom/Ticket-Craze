import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

const purchaseSchema = Joi.object({
  userId: Joi.string().required().pattern(/^[0-9]+$/),
  skuId: Joi.string().required().pattern(/^[0-9]+$/),
  quantity: Joi.number().integer().min(1).max(10).required(),
  idempotencyKey: Joi.string().max(128).optional()
});

function validatePurchase(req: Request, res: Response, next: NextFunction) {
  const { error, value } = purchaseSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: error.details.map((d: any) => d.message)
    });
  }

  // Attach validated payload; keep typing loose to avoid global augmentation here
  (req as any).validatedBody = value;
  next();
}

export { validatePurchase };
