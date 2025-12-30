import { Request, Response } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { User } from '../models';

// Generate 2FA setup
export const generate2FASetup = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `Alumzi (${user.name})`,
            issuer: 'Alumzi',
            length: 32
        });

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

        res.status(200).json({
            secret: secret.base32,
            qrCode: qrCodeUrl,
            manualEntryKey: secret.base32
        });
    } catch (error) {
        console.error('Generate 2FA setup error:', error);
        res.status(500).json({ message: 'Failed to generate 2FA setup' });
    }
};

// Enable 2FA
export const enable2FA = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { secret, token } = req.body;

        if (!secret || !token) {
            return res.status(400).json({ message: 'Secret and token are required' });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // Generate backup codes
        const backupCodes = Array.from({ length: 8 }, () => 
            crypto.randomBytes(4).toString('hex').toUpperCase()
        );

        // Update user
        await User.findByIdAndUpdate(userId, {
            'twoFactor.enabled': true,
            'twoFactor.secret': secret,
            'twoFactor.backupCodes': backupCodes,
            'twoFactor.enabledAt': new Date()
        });

        res.status(200).json({
            message: '2FA enabled successfully',
            backupCodes
        });
    } catch (error) {
        console.error('Enable 2FA error:', error);
        res.status(500).json({ message: 'Failed to enable 2FA' });
    }
};

// Disable 2FA
export const disable2FA = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { token } = req.body;

        const user = await User.findById(userId).select('+twoFactor.secret');
        if (!user || !user.twoFactor.enabled) {
            return res.status(400).json({ message: '2FA is not enabled' });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: user.twoFactor.secret!,
            encoding: 'base32',
            token,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // Disable 2FA
        await User.findByIdAndUpdate(userId, {
            'twoFactor.enabled': false,
            'twoFactor.secret': undefined,
            'twoFactor.backupCodes': undefined,
            'twoFactor.enabledAt': undefined
        });

        res.status(200).json({ message: '2FA disabled successfully' });
    } catch (error) {
        console.error('Disable 2FA error:', error);
        res.status(500).json({ message: 'Failed to disable 2FA' });
    }
};

// Verify 2FA token
export const verify2FA = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { token } = req.body;

        const user = await User.findById(userId).select('+twoFactor.secret +twoFactor.backupCodes');
        if (!user || !user.twoFactor.enabled) {
            return res.status(400).json({ message: '2FA is not enabled' });
        }

        // Check if it's a backup code
        if (user.twoFactor.backupCodes?.includes(token.toUpperCase())) {
            // Remove used backup code
            const updatedCodes = user.twoFactor.backupCodes.filter((code:string)=> code !== token.toUpperCase());
            await User.findByIdAndUpdate(userId, {
                'twoFactor.backupCodes': updatedCodes
            });
            
            return res.status(200).json({ 
                verified: true, 
                message: 'Backup code verified',
                remainingBackupCodes: updatedCodes.length
            });
        }

        // Verify TOTP token
        const verified = speakeasy.totp.verify({
            secret: user.twoFactor.secret!,
            encoding: 'base32',
            token,
            window: 2
        });

        res.status(200).json({ verified });
    } catch (error) {
        console.error('Verify 2FA error:', error);
        res.status(500).json({ message: 'Failed to verify 2FA' });
    }
};

// Get 2FA status
export const get2FAStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        
        const user = await User.findById(userId).select('+twoFactor.backupCodes');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            enabled: user.twoFactor.enabled,
            enabledAt: user.twoFactor.enabledAt,
            backupCodesCount: user.twoFactor.backupCodes?.length || 0
        });
    } catch (error) {
        console.error('Get 2FA status error:', error);
        res.status(500).json({ message: 'Failed to get 2FA status' });
    }
};

// Regenerate backup codes
export const regenerateBackupCodes = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { token } = req.body;

        const user = await User.findById(userId).select('+twoFactor.secret');
        if (!user || !user.twoFactor.enabled) {
            return res.status(400).json({ message: '2FA is not enabled' });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: user.twoFactor.secret!,
            encoding: 'base32',
            token,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // Generate new backup codes
        const backupCodes = Array.from({ length: 8 }, () => 
            crypto.randomBytes(4).toString('hex').toUpperCase()
        );

        await User.findByIdAndUpdate(userId, {
            'twoFactor.backupCodes': backupCodes
        });

        res.status(200).json({ backupCodes });
    } catch (error) {
        console.error('Regenerate backup codes error:', error);
        res.status(500).json({ message: 'Failed to regenerate backup codes' });
    }
};