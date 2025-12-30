import { Router } from 'express';
import { getSettlements, createSettlement } from '../controllers/settlement.controller';
import { authenticateToken } from '../libs/middleware/auth.middleware';

const router = Router();

router.get('/:associationId', authenticateToken, getSettlements);
router.post('/:associationId', authenticateToken, createSettlement);

export default router;