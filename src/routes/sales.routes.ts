import { Router } from 'express';
import {
  createSale,
  getSales,
  getMySales,
  getSaleById,
  getSalesReport,
} from '../controllers/sales.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminOnly } from '../middlewares/role.middleware';

const router = Router();

router.post('/', authMiddleware, createSale);
router.get('/my-sales', authMiddleware, getMySales);
router.get('/report', authMiddleware, adminOnly, getSalesReport);
router.get('/', authMiddleware, adminOnly, getSales);
router.get('/:id', authMiddleware, getSaleById);

export default router;
