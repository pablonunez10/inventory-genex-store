import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getStats,
} from '../controllers/products.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminOnly } from '../middlewares/role.middleware';

const router = Router();

router.get('/', authMiddleware, getProducts);
router.get('/stats', authMiddleware, getStats);
router.get('/:id', authMiddleware, getProductById);
router.post('/', authMiddleware, adminOnly, createProduct);
router.put('/:id', authMiddleware, adminOnly, updateProduct);
router.delete('/:id', authMiddleware, adminOnly, deleteProduct);
router.post('/:id/adjust-stock', authMiddleware, adminOnly, adjustStock);

export default router;
