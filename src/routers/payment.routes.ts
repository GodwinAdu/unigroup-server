import { Router } from 'express';
import { authenticateToken } from '../libs/middleware/auth.middleware';
import { 
    initiatePayment, 
    verifyPayment, 
    getPaymentHistory, 
    getSettlementBalance 
} from '../controllers/payment.controller';
import { initiateFundraiserPayment, verifyFundraiserPayment } from '../controllers/fundraiserPayment.controller';

const router = Router();

router.use(authenticateToken);

// General payment routes
router.post('/initiate', initiatePayment);
router.get('/verify/:reference', verifyPayment);
router.get('/history/:associationId', getPaymentHistory);
router.get('/settlement/:associationId', getSettlementBalance);

// Fundraiser payment routes
router.post('/fundraiser/initiate', initiateFundraiserPayment);
router.get('/fundraiser/verify/:reference', verifyFundraiserPayment);

export default router;