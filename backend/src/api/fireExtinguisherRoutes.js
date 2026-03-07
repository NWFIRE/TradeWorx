import { Router } from 'express';
import * as extinguisherController from './fire-extinguishers.js';
import { authenticateJWT, requireRole } from '../middleware/jwtMiddleware.js';

const router = Router();

router.use(authenticateJWT);

router.get('/', extinguisherController.getFireExtinguishers);
router.get('/:id', extinguisherController.getFireExtinguisherById);

router.post('/', requireRole(['admin', 'manager', 'technician']), extinguisherController.createFireExtinguisher);
router.put('/:id', requireRole(['admin', 'manager', 'technician']), extinguisherController.updateFireExtinguisher);
router.delete('/:id', requireRole(['admin']), extinguisherController.deleteFireExtinguisher);

export default router;
