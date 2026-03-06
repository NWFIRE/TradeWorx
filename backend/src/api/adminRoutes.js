import { Router } from 'express';
import * as adminController from '../api/admin.js';

const router = Router();

// Routes equivalent to Base44 functions
router.post('/adminReassignInspectionClient', adminController.adminReassignInspectionClient);
router.post('/deleteUser', adminController.deleteUser);
router.post('/updateUserRole', adminController.updateUserRole);
router.post('/syncDeficiencies', adminController.syncDeficiencies);

export default router;
