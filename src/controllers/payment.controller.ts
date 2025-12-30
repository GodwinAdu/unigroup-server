import { Request, Response } from 'express';
import { Payment, PaymentAccount, Member } from '../models';
import { Fundraiser } from '../models/fundraiser.models';
import { PaystackService } from '../services/paystack.service';
import crypto from 'crypto';

const PLATFORM_FEE_RATE = 0.025; // 2.5% platform fee

export const initiatePayment = async (req: Request, res: Response) => {
    try {
        const { associationId, amount, purpose, description, fundraiserId } = req.body;
        const userId = req.user?.userId;

        if (!associationId || !amount || !purpose || !description) {
            return res.status(400).json({ message: 'Required fields missing' });
        }

        // Check if association has payment account
        const paymentAccount = await PaymentAccount.findOne({ associationId, isActive: true });
        if (!paymentAccount) {
            return res.status(400).json({ message: 'Association has not set up payment account' });
        }

        const platformFee = Math.round(amount * PLATFORM_FEE_RATE);
        const associationAmount = amount - platformFee;

        // Generate Paystack reference
        const paystackReference: string = `ALZ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Get user email for payment
        const user = await Member.findOne({ userId, associationId }).populate('userId', 'email');
        const userEmail = user?.userId?.email;

        // Initialize payment with Paystack
        const paystackData = await PaystackService.initializePayment(
            userEmail,
            amount * 100, // Convert to pesewas
            paystackReference,
            'GHS',
            {
                associationId,
                purpose,
                description,
                userId,
                ...(fundraiserId && { fundraiserId })
            }
        );

        const payment = new Payment({
            associationId,
            payerId: userId,
            amount,
            purpose,
            description,
            paystackReference,
            platformFee,
            associationAmount
        });

        await payment.save();

        res.status(200).json({
            authorization_url: paystackData.authorization_url,
            access_code: paystackData.access_code,
            reference: paystackData.reference,
            amount,
            platformFee,
            associationAmount
        });
    } catch (error) {
        console.error('Initiate payment error:', error);
        res.status(500).json({ message: 'Failed to initiate payment' });
    }
};

export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { reference } = req.params;

        // Verify with Paystack
        const verification = await PaystackService.verifyPayment(reference);
        
        if (!verification.status || verification.data.status !== 'success') {
            return res.status(400).json({ 
                message: 'Payment verification failed',
                status: verification.data.status 
            });
        }

        const payment = await Payment.findOne({ paystackReference: reference });
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Update payment status
        payment.status = 'successful';
        payment.paystackTransactionId = verification.data.id.toString();
        payment.paidAt = new Date(verification.data.paid_at);
        await payment.save();

        // Update association pending balance
        await PaymentAccount.findOneAndUpdate(
            { associationId: payment.associationId },
            { $inc: { pendingBalance: payment.associationAmount } }
        );

        // If this is a fundraiser contribution, update the fundraiser
        const fundraiserId = verification.data.metadata?.fundraiserId;
        if (fundraiserId) {
            const fundraiser = await Fundraiser.findById(fundraiserId);
            
            if (fundraiser) {
                // Get contributor details
                const contributor = await Member.findOne({ 
                    userId: payment.payerId, 
                    associationId: payment.associationId 
                }).populate('userId', 'name');
                
                if (contributor) {
                    // Add contribution manually
                    fundraiser.contributors.push({
                        userId: payment.payerId.toString(),
                        name: contributor.userId.name,
                        amount: payment.amount,
                        date: new Date()
                    });
                    fundraiser.currentAmount += payment.amount;
                    
                    // Check if goal is reached for goal type fundraisers
                    if (fundraiser.type === 'goal' && fundraiser.targetAmount && fundraiser.currentAmount >= fundraiser.targetAmount) {
                        fundraiser.status = 'completed';
                    }
                    
                    await fundraiser.save();
                    console.log(`✅ Added contribution of ${payment.amount} to fundraiser "${fundraiser.title}"`);
                }
            }
        }

        res.status(200).json({ 
            message: 'Payment verified successfully',
            status: 'successful',
            amount: verification.data.amount / 100 // Convert from kobo
        });
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ message: 'Failed to verify payment' });
    }
};

export const getPaymentHistory = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        const member = await Member.findOne({ userId, associationId });
        if (!member) {
            return res.status(403).json({ message: 'Not a member of this association' });
        }

        const payments = await Payment.find({ associationId })
            .populate('payerId', 'name')
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json({
            payments: payments.map(payment => ({
                id: payment._id,
                amount: payment.amount,
                purpose: payment.purpose,
                description: payment.description,
                payer: payment.payerId.name,
                status: payment.status,
                platformFee: payment.platformFee,
                associationAmount: payment.associationAmount,
                date: payment.createdAt
            }))
        });
    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({ message: 'Failed to get payment history' });
    }
};

export const getSettlementBalance = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: { $in: ['admin', 'moderator'] } 
        });
        if (!member) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const paymentAccount = await PaymentAccount.findOne({ associationId, isActive: true });
        if (!paymentAccount) {
            return res.status(404).json({ message: 'Payment account not found' });
        }

        res.status(200).json({
            pendingBalance: paymentAccount.pendingBalance,
            settlementSchedule: paymentAccount.settlementSchedule,
            minimumSettlement: paymentAccount.minimumSettlement
        });
    } catch (error) {
        console.error('Get settlement balance error:', error);
        res.status(500).json({ message: 'Failed to get settlement balance' });
    }
};