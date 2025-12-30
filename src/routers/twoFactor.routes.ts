import { Router } from 'express';
import { authenticateToken } from '../libs/middleware/auth.middleware';
import {
    generate2FASetup,
    enable2FA,
    disable2FA,
    verify2FA,
    get2FAStatus,
    regenerateBackupCodes
} from '../controllers/twoFactor.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Generate 2FA setup (QR code and secret)
router.get('/setup', generate2FASetup);

// Enable 2FA
router.post('/enable', enable2FA);

// Disable 2FA
router.post('/disable', disable2FA);

// Verify 2FA token
router.post('/verify', verify2FA);

// Get 2FA status
router.get('/status', get2FAStatus);

// Regenerate backup codes
router.post('/backup-codes', regenerateBackupCodes);

export default router;