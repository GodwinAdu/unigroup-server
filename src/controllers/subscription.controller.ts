import { Request, Response } from 'express';
import { Subscription, Association, Member, User } from '../models';
import { PaystackService } from '../services/paystack.service';

const PLANS = {
    free: { 
        memberLimit: 50, 
        price: 0, 
        features: [
            'Up to 50 members',
            'Basic financial tracking',
            'Member management',
            'Basic reports'
        ] 
    },
    pro: { 
        memberLimit: 200, 
        price: 1500, // 15 GHS in pesewas
        features: [
            'Up to 200 members',
            'Advanced financial tracking',
            'Custom expense/income types',
            'Advanced reports & analytics',
            'Payment processing',
            'Email notifications'
        ] 
    },
    enterprise: { 
        memberLimit: -1, 
        price: 6000, // 60 GHS in pesewas
        features: [
            'Unlimited members',
            'All Pro features',
            'Priority support',
            'Custom integrations',
            'Advanced security',
            'Dedicated account manager'
        ] 
    }
};

export const getSubscription = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        // const userId = req.user?.userId;

        // const member = await Member.findOne({ 
        //     userId, 
        //     associationId, 
        //     role: { $in: ['admin', 'moderator'] } 
        // });
        // if (!member) {
        //     return res.status(403).json({ message: 'Not authorized' });
        // }

        let subscription = await Subscription.findOne({ associationId });
        if (!subscription) {
            // Create free subscription
            subscription = new Subscription({
                associationId,
                plan: 'free',
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                memberLimit: PLANS.free.memberLimit,
                features: PLANS.free.features
            });
            await subscription.save();
        }

        const memberCount = await Member.countDocuments({ associationId });
        
        res.status(200).json({
            subscription: {
                id: subscription._id,
                plan: subscription.plan,
                status: subscription.status,
                memberLimit: subscription.memberLimit,
                currentMembers: memberCount,
                features: subscription.features,
                expiresAt: subscription.endDate
            },
            availablePlans: PLANS
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ message: 'Failed to get subscription' });
    }
};

export const upgradePlan = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const { plan } = req.body;
        const userId = req.user?.userId;

        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: 'admin'
        });
        if (!member) {
            return res.status(403).json({ message: 'Only admins can upgrade plans' });
        }

        if (!PLANS[plan as keyof typeof PLANS]) {
            return res.status(400).json({ message: 'Invalid plan' });
        }

        const planDetails = PLANS[plan as keyof typeof PLANS];
        
        // Get user email from database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.email) {
            return res.status(400).json({ message: 'User email is required for payment processing' });
        }
        
        // Generate payment reference
        const reference = `SUB_${associationId}_${Date.now()}`;
        
        console.log('Initializing payment with:', {
            email: user.email,
            amount: planDetails.price,
            reference,
            currency: 'GHS'
        });

        // Initialize payment with Paystack
        const paymentData = await PaystackService.initializePayment(
            user.email,
            planDetails.price, // Amount in pesewas
            reference,
            'GHS',
            {
                associationId,
                plan,
                userId,
                type: 'subscription_upgrade'
            }
        );

        res.status(200).json({
            authorization_url: paymentData.authorization_url,
            access_code: paymentData.access_code,
            reference: paymentData.reference
        });
    } catch (error) {
        console.error('Upgrade plan error:', error);
        res.status(500).json({ message: 'Failed to upgrade plan' });
    }
};

export const confirmUpgrade = async (req: Request, res: Response) => {
    try {
        const { reference } = req.body;
        
        console.log('Confirming upgrade for reference:', reference);
        
        // Verify payment with Paystack
        const verification = await PaystackService.verifyPayment(reference);
        
        console.log('Payment verification response:', JSON.stringify(verification, null, 2));
        
        if (!verification.status || verification.data.status !== 'success') {
            console.log('Payment verification failed:', {
                status: verification.status,
                dataStatus: verification.data?.status,
                message: verification.message
            });
            return res.status(400).json({ 
                message: 'Payment verification failed',
                details: {
                    status: verification.status,
                    paymentStatus: verification.data?.status,
                    paystackMessage: verification.message
                }
            });
        }

        const { associationId, plan } = verification.data.metadata;
        const planDetails = PLANS[plan as keyof typeof PLANS];
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        console.log('Updating subscription:', { associationId, plan });

        await Subscription.findOneAndUpdate(
            { associationId },
            {
                plan,
                memberLimit: planDetails.memberLimit,
                features: planDetails.features,
                endDate,
                paymentReference: reference,
                status: 'active'
            },
            { upsert: true }
        );

        res.status(200).json({ message: 'Plan upgraded successfully' });
    } catch (error) {
        console.error('Confirm upgrade error:', error);
        res.status(500).json({ message: 'Failed to confirm upgrade' });
    }
};



export const checkLimits = async (associationId: string) => {
    const subscription = await Subscription.findOne({ associationId });
    const memberCount = await Member.countDocuments({ associationId });
    
    if (!subscription) return { canAddMembers: memberCount < 50 };
    
    return {
        canAddMembers: subscription.memberLimit === -1 || memberCount < subscription.memberLimit,
        currentMembers: memberCount,
        memberLimit: subscription.memberLimit,
        plan: subscription.plan
    };
};