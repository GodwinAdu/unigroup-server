import { Router } from 'express';
import { sendOTP, signIn, signUp, getMe, complete2FALogin, updateProfile } from '../controllers/auth.controller';
import { deleteAccount } from '../controllers/accountDeletion.controller';
import { authenticateToken } from '../libs/middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/send-otp', sendOTP);
router.post('/sign-in', signIn);
router.post('/sign-up', signUp);
router.post('/2fa-login', complete2FALogin);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.delete('/delete-account', authenticateToken, deleteAccount);

export default router;