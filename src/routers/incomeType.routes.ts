import { Router } from 'express';
import { authenticateToken } from '../libs/middleware/auth.middleware';
import {
    getIncomeTypes,
    createIncomeType,
    updateIncomeType,
    deleteIncomeType
} from '../controllers/incomeType.controller';

const router = Router();

router.use(authenticateToken);

router.get('/:associationId', getIncomeTypes);
router.post('/:associationId', createIncomeType);
router.put('/:associationId/:incomeTypeId', updateIncomeType);
router.delete('/:associationId/:incomeTypeId', deleteIncomeType);

export default router;