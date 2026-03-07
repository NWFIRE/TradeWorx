import { Router } from 'express';
import * as clientController from './clients.js';
import { authenticateJWT, requireRole } from '../middleware/jwtMiddleware.js';

const router = Router();

// Require login for all client routes
router.use(authenticateJWT);

router.get('/', clientController.getClients);
router.get('/:id', clientController.getClientById);

// Only admins and managers can create/update/delete clients
router.post('/', requireRole(['admin', 'manager']), clientController.createClient);
router.put('/:id', requireRole(['admin', 'manager']), clientController.updateClient);
router.delete('/:id', requireRole(['admin']), clientController.deleteClient);

export default router;
