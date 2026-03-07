import { Router } from 'express';
import * as controller from './emergencylightreport.js';
import { authenticateJWT, requireRole } from '../middleware/jwtMiddleware.js';

const router = Router();
router.use(authenticateJWT);

router.get('/', controller.getEmergencyLightReports);
router.get('/:id', controller.getEmergencyLightReportById);
router.post('/', requireRole(['admin', 'manager', 'technician']), controller.createEmergencyLightReport);
router.put('/:id', requireRole(['admin', 'manager', 'technician']), controller.updateEmergencyLightReport);
router.delete('/:id', requireRole(['admin']), controller.deleteEmergencyLightReport);

export default router;