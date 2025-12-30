import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import User from '../models/user.models';
import { smsConfig } from '../sms/config';
import { sendOTPEmail } from '../libs/email.service';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate OTP
const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate JWT token
const generateToken = (userId: string): string => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Helper function to check if number is Ghana number
function isGhanaNumber(phoneNumber: string): boolean {
    const cleanNum = phoneNumber.replace(/\D/g, "");
    return cleanNum.startsWith("233") || cleanNum.startsWith("0");
}

// Send OTP
export const sendOTP = async (req: Request, res: Response) => {
    try {
        const { identifier, channel, isSignUp } = req.body;

        if (!identifier || !channel) {
            return res.status(400).json({ message: 'Identifier and channel are required' });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Find user by email or phone
        const query = channel === 'email' ? { email: identifier } : { phoneNumber: identifier };
        let user = await User.findOne(query);

        if (!user) {
            if (isSignUp) {
                // For signup, create new user
                user = new User({
                    ...query,
                    name: 'User', // Temporary name, will be updated during signup
                    status: 'pending',
                    otp,
                    otpExpires
                });
            } else {
                // For signin, user must exist
                return res.status(404).json({ message: 'User not found' });
            }
        } else {
            // If user exists, update OTP
            user.otp = otp;
            user.otpExpires = otpExpires;
        }

        await user.save();

        // Determine channel based on phone number for temporary users
        let actualChannel = channel;
        if (channel === 'phone' && !isGhanaNumber(identifier)) {
            actualChannel = 'email'; // Send via email for non-Ghana numbers
        }

        // Send OTP via SMS or Email
        if (actualChannel === 'phone') {
            await smsConfig({
                text: `Your Alumzi verification code is: ${otp}. Valid for 10 minutes.`,
                destinations: [identifier]
            });
        } else {
            await sendOTPEmail(identifier, otp);
        }

        res.status(200).json({ 
            message: 'OTP sent successfully',
            channel: actualChannel,
            // In development, return OTP for testing
            ...(process.env.NODE_ENV === 'development' && { otp })
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
};

// Sign In
export const signIn = async (req: Request, res: Response) => {
    try {
        const { identifier, otp } = req.body;

        if (!identifier || !otp) {
            return res.status(400).json({ message: 'Identifier and OTP are required' });
        }

        // Find user by email or phone
        const user = await User.findOne({
            $or: [{ email: identifier }, { phoneNumber: identifier }],
            otp,
            otpExpires: { $gt: new Date() }
        }).select('+otp +otpExpires');

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Register device (WhatsApp-style)
        const deviceId = req.headers['x-device-id'] as string || 'web-' + Date.now();
        const deviceName = req.headers['x-device-name'] as string || 'Web Browser';
        
        // Add or update device
        const existingDevice = user.devices.find((d: any) => d.deviceId === deviceId);
        if (existingDevice) {
            existingDevice.lastActive = new Date();
            existingDevice.isActive = true;
        } else {
            user.devices.push({
                deviceId,
                deviceName,
                lastActive: new Date(),
                isActive: true
            });
        }

        // Clear OTP and mark as verified
        user.otp = undefined;
        user.otpExpires = undefined;
        user.isVerified = true;
        user.status = 'active'; // Activate temporary users
        await user.save();

        // Check if 2FA is enabled
        if (user.twoFactor.enabled) {
            // Generate temporary token for 2FA verification
            const tempToken = jwt.sign(
                { userId: user._id.toString(), deviceId, temp2FA: true },
                JWT_SECRET,
                { expiresIn: '10m' }
            );

            return res.status(200).json({
                message: '2FA verification required',
                requires2FA: true,
                tempToken
            });
        }

        // Generate token with device info
        const token = jwt.sign(
            { userId: user._id.toString(), deviceId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: 'Sign in successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Sign in error:', error);
        res.status(500).json({ message: 'Sign in failed' });
    }
};

// Sign Up
export const signUp = async (req: Request, res: Response) => {
    try {
        const { name, email, phoneNumber, otp } = req.body;

        if (!name || !email || !phoneNumber || !otp) {
            return res.status(400).json({ message: 'Name, email, phone number, and OTP are required' });
        }

        // Find user by email or phone with valid OTP
        const user = await User.findOne({
            $or: [
                ...(email ? [{ email }] : []),
                ...(phoneNumber ? [{ phoneNumber }] : [])
            ],
            otp,
            otpExpires: { $gt: new Date() }
        }).select('+otp +otpExpires');

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Register device
        const deviceId = req.headers['x-device-id'] as string || 'web-' + Date.now();
        const deviceName = req.headers['x-device-name'] as string || 'Web Browser';
        
        user.devices.push({
            deviceId,
            deviceName,
            lastActive: new Date(),
            isActive: true
        });

        // Update user details and activate account
        user.name = name;
        if (email) user.email = email;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        user.otp = undefined;
        user.otpExpires = undefined;
        user.isVerified = true;
        user.status = 'active'; // Activate temporary users
        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id.toString(), deviceId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Sign up error:', error);
        res.status(500).json({ message: 'Sign up failed' });
    }
};

// Complete 2FA login
export const complete2FALogin = async (req: Request, res: Response) => {
    try {
        const { tempToken, token: twoFAToken } = req.body;

        if (!tempToken || !twoFAToken) {
            return res.status(400).json({ message: 'Temporary token and 2FA token are required' });
        }

        // Verify temporary token
        const decoded = jwt.verify(tempToken, JWT_SECRET) as any;
        if (!decoded.temp2FA) {
            return res.status(400).json({ message: 'Invalid temporary token' });
        }

        const user = await User.findById(decoded.userId).select('+twoFactor.secret +twoFactor.backupCodes');
        if (!user || !user.twoFactor.enabled) {
            return res.status(400).json({ message: '2FA is not enabled' });
        }

        let verified = false;
        let usedBackupCode = false;

        // Check if it's a backup code
        if (user.twoFactor.backupCodes?.includes(twoFAToken.toUpperCase())) {
            verified = true;
            usedBackupCode = true;
            // Remove used backup code
            const updatedCodes = user.twoFactor.backupCodes.filter((code: string) => code !== twoFAToken.toUpperCase());
            await User.findByIdAndUpdate(decoded.userId, {
                'twoFactor.backupCodes': updatedCodes
            });
        } else {
            // Verify TOTP token
            verified = speakeasy.totp.verify({
                secret: user.twoFactor.secret!,
                encoding: 'base32',
                token: twoFAToken,
                window: 2
            });
        }

        if (!verified) {
            return res.status(400).json({ message: 'Invalid 2FA token' });
        }

        // Generate final token
        const finalToken = jwt.sign(
            { userId: decoded.userId, deviceId: decoded.deviceId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: '2FA verification successful',
            token: finalToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                createdAt: user.createdAt
            },
            ...(usedBackupCode && { 
                warning: 'Backup code used',
                remainingBackupCodes: user.twoFactor.backupCodes?.length || 0
            })
        });

    } catch (error) {
        console.error('Complete 2FA login error:', error);
        res.status(500).json({ message: 'Failed to complete 2FA login' });
    }
};

// Get current user
export const getMe = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.user?.userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                createdAt: user.createdAt,
                twoFactorEnabled: user.twoFactor.enabled
            }
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ message: 'Failed to get user' });
    }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
    try {
        const { name, email, country } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update fields if provided
        if (name) user.name = name;
        if (email) user.email = email;
        if (country) user.country = country;

        await user.save();

        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                country: user.country,
                createdAt: user.createdAt,
                twoFactorEnabled: user.twoFactor.enabled
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
};