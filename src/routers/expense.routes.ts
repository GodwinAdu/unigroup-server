import { Router } from 'express';
import { authenticateToken } from '../libs/middleware/auth.middleware';
import {
    createExpense,
    getExpenses,
    updateExpense,
    approveExpense,
    deleteExpense
} from '../controllers/expense.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', createExpense);
router.get('/:associationId', getExpenses);
router.put('/:expenseId', updateExpense);
router.patch('/:expenseId/approve', approveExpense);
router.delete('/:expenseId', deleteExpense);

export default router;