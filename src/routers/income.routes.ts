import { Router } from 'express';
import { authenticateToken } from '../libs/middleware/auth.middleware';
import {
    createIncome,
    getIncomes,
    updateIncome,
    deleteIncome,
    approveIncome
} from '../controllers/income.controller';

const router = Router();

router.use(authenticateToken);

router.post('/', createIncome);
router.get('/:associationId', getIncomes);
router.put('/:incomeId', updateIncome);
router.patch('/:incomeId/approve', approveIncome);
router.delete('/:incomeId', deleteIncome);

export default router;