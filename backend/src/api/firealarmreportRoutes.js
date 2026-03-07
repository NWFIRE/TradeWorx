import { Router } from 'express';
import * as controller from './firealarmreport.js';
import { authenticateJWT, requireRole } from '../middleware/jwtMiddleware.js';

const router = Router();
router.use(authenticateJWT);

router.get('/', controller.getFireAlarmReports);
router.get('/:id', controller.getFireAlarmReportById);
router.post('/', requireRole(['admin', 'manager', 'technician']), controller.createFireAlarmReport);
router.put('/:id', requireRole(['admin', 'manager', 'technician']), controller.updateFireAlarmReport);
router.delete('/:id', requireRole(['admin']), controller.deleteFireAlarmReport);

export default router;