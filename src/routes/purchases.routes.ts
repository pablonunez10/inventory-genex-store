import { Router } from 'express';
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
} from '../controllers/purchases.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminOnly } from '../middlewares/role.middleware';

const router = Router();

router.post('/', authMiddleware, adminOnly, createPurchase);
router.get('/', authMiddleware, adminOnly, getPurchases);
router.get('/:id', authMiddleware, adminOnly, getPurchaseById);

export default router;
