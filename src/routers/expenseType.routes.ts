import { Router } from 'express';
import { authenticateToken } from '../libs/middleware/auth.middleware';
import {
    getExpenseTypes,
    createExpenseType,
    updateExpenseType,
    deleteExpenseType
} from '../controllers/expenseType.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/:associationId', getExpenseTypes);
router.post('/:associationId', createExpenseType);
router.put('/:associationId/:expenseTypeId', updateExpenseType);
router.delete('/:associationId/:expenseTypeId', deleteExpenseType);

export default router;