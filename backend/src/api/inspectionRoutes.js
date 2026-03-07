import { Router } from 'express';
import * as inspectionController from './inspections.js';
import { authenticateJWT, requireRole } from '../middleware/jwtMiddleware.js';

const router = Router();

router.use(authenticateJWT);

router.get('/', inspectionController.getInspections);
router.get('/:id', inspectionController.getInspectionById);

router.post('/', requireRole(['admin', 'manager', 'technician']), inspectionController.createInspection);
router.put('/:id', requireRole(['admin', 'manager', 'technician']), inspectionController.updateInspection);
router.delete('/:id', requireRole(['admin']), inspectionController.deleteInspection);

export default router;
