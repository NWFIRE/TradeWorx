import { Router } from 'express';
import * as authController from './auth.js';
import { authenticateJWT } from '../middleware/jwtMiddleware.js';

const router = Router();

// Public Routes
router.post('/login', authController.login);
router.post('/register', authController.register);

// Protected Routes
router.get('/me', authenticateJWT, authController.me);

export default router;
