import { Router } from 'express';
import { authenticateToken } from '../libs/middleware/auth.middleware';
import { getSubscription, upgradePlan, confirmUpgrade } from '../controllers/subscription.controller';

const router = Router();

router.use(authenticateToken);

router.get('/:associationId', getSubscription);
router.post('/:associationId/upgrade', upgradePlan);
router.post('/confirm-upgrade', confirmUpgrade);

export default router;