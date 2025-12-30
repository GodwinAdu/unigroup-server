import { Request, Response } from 'express';
import { Payment, PaymentAccount, Member } from '../models';
import { Fundraiser } from '../models/fundraiser.models';
import { PaystackService } from '../services/paystack.service';
import { createNotification, sendAssociationNotification } from './notification.controller';
import { broadcastFundraiserUpdate, broadcastPaymentUpdate, broadcastDashboardUpdate } from '../sockets';

const PLATFORM_FEE_RATE = 0.025; // 2.5% platform fee

export const initiateFundraiserPayment = async (req: Request, res: Response) => {
    try {
        const { fundraiserId, amount } = req.body;
        const userId = req.user?.userId;

        if (!fundraiserId || !amount) {
            return res.status(400).json({ message: 'Fundraiser ID and amount are required' });
        }

        // Get fundraiser details
        const fundraiser = await Fundraiser.findById(fundraiserId);
        if (!fundraiser) {
            return res.status(404).json({ message: 'Fundraiser not found' });
        }

        if (fundraiser.status !== 'active') {
            return res.status(400).json({ message: 'Fundraiser is not active' });
        }

        // Check if association has payment account
        const paymentAccount = await PaymentAccount.findOne({ 
            associationId: fundraiser.associationId, 
            isActive: true 
        });
        if (!paymentAccount) {
            return res.status(400).json({ message: 'Association has not set up payment account' });
        }

        const platformFee = Math.round(amount * PLATFORM_FEE_RATE);
        const associationAmount = amount - platformFee;

        // Generate Paystack reference
        const paystackReference = `FUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Get user email for payment
        const user = await Member.findOne({ 
            userId, 
            associationId: fundraiser.associationId 
        }).populate('userId', 'email name');
        
        if (!user) {
            return res.status(403).json({ message: 'Not a member of this association' });
        }

        const userEmail = user.userId?.email;

        // Initialize payment with Paystack
        const paystackData = await PaystackService.initializePayment(
            userEmail,
            amount * 100, // Convert to pesewas
            paystackReference,
            'GHS',
            {
                fundraiserId,
                associationId: fundraiser.associationId,
                userId,
                type: 'fundraiser_contribution',
                fundraiserTitle: fundraiser.title
            },
            `exp://192.168.1.170:8081/--/contribute?reference=${paystackReference}`
        );

        // Create payment record with fundraiser purpose
        const payment = new Payment({
            associationId: fundraiser.associationId,
            payerId: userId,
            amount,
            purpose: 'donation',
            description: `Contribution to "${fundraiser.title}"`,
            paystackReference,
            platformFee,
            associationAmount
        });

        await payment.save();
        
        // Broadcast payment initiation
        broadcastPaymentUpdate(fundraiser.associationId.toString(), 'initiated', {
            reference: paystackReference,
            amount: payment.amount,
            fundraiserTitle: fundraiser.title,
            payerName: user.userId?.name
        });

        res.status(200).json({
            authorization_url: paystackData.authorization_url,
            access_code: paystackData.access_code,
            reference: paystackData.reference,
            amount,
            platformFee,
            associationAmount,
            fundraiser: {
                id: fundraiser._id,
                title: fundraiser.title,
                currentAmount: fundraiser.currentAmount,
                targetAmount: fundraiser.targetAmount
            }
        });
    } catch (error) {
        console.error('Initiate fundraiser payment error:', error);
        res.status(500).json({ message: 'Failed to initiate fundraiser payment' });
    }
};

export const verifyFundraiserPayment = async (req: Request, res: Response) => {
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

        // Get fundraiser ID from Paystack metadata
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
                    
                    // Broadcast real-time fundraiser update
                    broadcastFundraiserUpdate(payment.associationId.toString(), 'contribution', {
                        fundraiserId: fundraiser._id,
                        contributorName: contributor.userId.name,
                        amount: payment.amount,
                        newTotal: fundraiser.currentAmount,
                        targetAmount: fundraiser.targetAmount,
                        fundraiserTitle: fundraiser.title
                    });
                    
                    // Broadcast payment completion
                    broadcastPaymentUpdate(payment.associationId.toString(), 'completed', {
                        reference: payment.paystackReference,
                        amount: payment.amount,
                        fundraiserTitle: fundraiser.title,
                        contributorName: contributor.userId.name
                    });
                    
                    // Broadcast dashboard update
                    broadcastDashboardUpdate(payment.associationId.toString(), {
                        type: 'fundraiser_contribution',
                        amount: payment.amount,
                        fundraiserTitle: fundraiser.title
                    });
                    // Send notification to fundraiser creator
                    await createNotification(
                        fundraiser.createdBy.toString(),
                        payment.associationId.toString(),
                        'fundraiser_contribution',
                        'New Contribution Received! 🎉',
                        `${contributor.userId.name} contributed GHS ${payment.amount} to "${fundraiser.title}"`,
                        {
                            fundraiserId: fundraiser._id,
                            contributorName: contributor.userId.name,
                            amount: payment.amount,
                            fundraiserTitle: fundraiser.title
                        }
                    );
                    
                    // If goal is reached, notify all association members
                    if (fundraiser.status === 'completed') {
                        // Broadcast goal reached update
                        broadcastFundraiserUpdate(payment.associationId.toString(), 'goal_reached', {
                            fundraiserId: fundraiser._id,
                            fundraiserTitle: fundraiser.title,
                            targetAmount: fundraiser.targetAmount,
                            finalAmount: fundraiser.currentAmount
                        });
                        
                        await sendAssociationNotification(
                            payment.associationId.toString(),
                            'fundraiser_goal_reached',
                            'Fundraiser Goal Achieved! 🎯',
                            `The fundraiser "${fundraiser.title}" has reached its goal of GHS ${fundraiser.targetAmount}!`,
                            {
                                fundraiserId: fundraiser._id,
                                fundraiserTitle: fundraiser.title,
                                targetAmount: fundraiser.targetAmount,
                                finalAmount: fundraiser.currentAmount
                            }
                        );
                    }
                }
            }
        }

        // Update association pending balance
        await PaymentAccount.findOneAndUpdate(
            { associationId: payment.associationId },
            { $inc: { pendingBalance: payment.associationAmount } }
        );

        res.status(200).json({ 
            message: 'Fundraiser payment verified successfully',
            status: 'successful',
            amount: verification.data.amount / 100
        });
    } catch (error) {
        console.error('Verify fundraiser payment error:', error);
        res.status(500).json({ message: 'Failed to verify fundraiser payment' });
    }
};