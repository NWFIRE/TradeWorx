import { Router } from 'express';
import * as deficiencyController from './deficiencies.js';
import { authenticateJWT, requireRole } from '../middleware/jwtMiddleware.js';

const router = Router();

router.use(authenticateJWT);

router.get('/', deficiencyController.getDeficiencies);
router.get('/:id', deficiencyController.getDeficiencyById);

router.post('/', requireRole(['admin', 'manager', 'technician']), deficiencyController.createDeficiency);
router.put('/:id', requireRole(['admin', 'manager', 'technician']), deficiencyController.updateDeficiency);
router.delete('/:id', requireRole(['admin']), deficiencyController.deleteDeficiency);

export default router;
