import { Router } from 'express';
import { login, getProfile, register } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminOnly } from '../middlewares/role.middleware';

const router = Router();

router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);
router.post('/register', authMiddleware, adminOnly, register);

export default router;
