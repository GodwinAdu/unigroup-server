import { Router } from 'express';
import { authenticateToken } from '../libs/middleware/auth.middleware';
import { getPaymentAccount, createPaymentAccount, updatePaymentAccount, getBanks, verifyAccountNumber } from '../controllers/paymentAccount.controller';

const router = Router();

router.use(authenticateToken);

// Static routes first
router.get('/banks', getBanks);
router.post('/verify-account', verifyAccountNumber);

// Parameterized routes after
router.get('/:associationId', getPaymentAccount);
router.post('/:associationId', createPaymentAccount);
router.put('/:associationId/:accountId', updatePaymentAccount);

export default router;