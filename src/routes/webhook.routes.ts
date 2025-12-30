import { Router } from 'express';
import { paystackWebhook } from '../controllers/webhook.controller';

const router = Router();

router.post('/paystack', paystackWebhook);

export default router;