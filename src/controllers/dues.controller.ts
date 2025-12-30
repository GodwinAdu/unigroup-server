import { Request, Response } from 'express';
import Association from '../models/association.models';
import MemberDue from '../models/memberDues.models';
import User from '../models/user.models';
import Income from '../models/income.models';
import IncomeType from '../models/incomeType.models';
import { smsConfig } from '../sms/config';

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        userId: string;
    };
}

// Get member dues for an association
export const getMemberDues = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        console.log('Fetching dues for user:', userId, 'in association:', associationId);

        // Verify user is member of association
        const association = await Association.findById(associationId);
        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        const member = association.members.find((m: any) => m.userId.toString() === userId);
        if (!member) {
            return res.status(403).json({ message: 'Not a member of this association' });
        }

        // Check if dues are enabled
        if (association.settings?.dues?.enabled) {
            // Calculate current due date and period range
            const currentDueDate = calculateNextDueDate(
                association.settings.dues.frequency,
                association.settings.dues.dueDate
            );
            const periodRange = calculatePeriodRange(
                association.settings.dues.frequency,
                currentDueDate
            );

            // Get active members
            const activeMembers = association.members.filter((m: any) => m.status === 'active');

            // Auto-generate dues for active members if they don't exist for current period
            for (const activeMember of activeMembers) {
                const existingDue = await MemberDue.findOne({
                    associationId,
                    memberId: activeMember.userId,
                    dueDate: {
                        $gte: periodRange.start,
                        $lte: periodRange.end
                    }
                });

                if (!existingDue) {
                    await MemberDue.create({
                        associationId,
                        memberId: activeMember.userId,
                        amount: association.settings.dues.amount,
                        dueDate: currentDueDate,
                        status: new Date() > currentDueDate ? 'overdue' : 'pending'
                    });
                }
            }
        }

        // Get all member dues for the association
        const dues = await MemberDue.find({ associationId })
            .populate('memberId', 'name email')
            .sort({ dueDate: -1 });

        // Update status for overdue dues
        const now = new Date();
        for (const due of dues) {
            if (due.status === 'pending' && new Date(due.dueDate) < now) {
                due.status = 'overdue';
                await due.save();
            }
        }

        // Format response
        const formattedDues = dues.map(due => ({
            id: due._id,
            memberId: due.memberId._id,
            memberName: due.memberId.name,
            amount: due.amount,
            dueDate: due.dueDate,
            status: due.status,
            paidDate: due.paidDate,
            paidAmount: due.paidAmount,
            paymentMethod: due.paymentMethod,
            notes: due.notes
        }));

        res.json({ dues: formattedDues });
    } catch (error) {
        console.error('Error fetching member dues:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Mark due as paid
export const markDueAsPaid = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dueId } = req.params;
        const { paidAmount, paymentMethod, notes } = req.body;
        const userId = req.user?.id;

        const due = await MemberDue.findById(dueId);
        if (!due) {
            return res.status(404).json({ message: 'Due not found' });
        }

        // Verify user is admin/moderator of association
        const association = await Association.findById(due.associationId);
        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        const member = association.members.find((m: any) => m.userId.toString() === userId);
        if (!member || !['admin', 'moderator'].includes(member.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        // Update due status
        due.status = 'paid';
        due.paidDate = new Date();
        due.paidAmount = paidAmount || due.amount;
        if (paymentMethod) due.paymentMethod = paymentMethod;
        if (notes) due.notes = notes;

        await due.save();

        // Create income record for manual dues payment
        const memberUser = await User.findById(due.memberId);
        let duesIncomeType = await IncomeType.findOne({ 
            associationId: due.associationId, 
            name: 'Member Dues' 
        });
        
        if (!duesIncomeType) {
            duesIncomeType = await IncomeType.create({
                associationId: due.associationId,
                name: 'Member Dues',
                description: 'Payments from member dues',
                isDefault: true,
                createdBy: userId
            });
        }

        await Income.create({
            associationId: due.associationId,
            incomeTypeId: duesIncomeType._id,
            amount: due.paidAmount,
            description: `Dues payment from ${memberUser?.name || 'Member'}`,
            source: memberUser?.name || 'Member',
            sourceMember: due.memberId,
            paymentMethod: paymentMethod || 'manual',
            type: 'dues',
            recordedBy: userId,
            status: 'approved'
        });

        res.json({ message: 'Due marked as paid', due });
    } catch (error) {
        console.error('Error marking due as paid:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Generate dues for all active members
export const generateDues = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.id;

        const association = await Association.findById(associationId);
        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        // Verify user is admin
        const member = association.members.find((m: any) => m.userId.toString() === userId);
        if (!member || member.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can generate dues' });
        }

        if (!association.settings.dues.enabled) {
            return res.status(400).json({ message: 'Dues are not enabled for this association' });
        }

        // Calculate next due date
        const nextDueDate = calculateNextDueDate(
            association.settings.dues.frequency,
            association.settings.dues.dueDate
        );

        // Get active members
        const activeMembers = association.members.filter((m: any) => m.status === 'active');

        // Create dues for each active member
        const duesPromises = activeMembers.map(async (member: any) => {
            // Check if due already exists for this period
            const existingDue = await MemberDue.findOne({
                associationId,
                memberId: member.userId,
                dueDate: nextDueDate
            });

            if (!existingDue) {
                return MemberDue.create({
                    associationId,
                    memberId: member.userId,
                    amount: association.settings.dues.amount,
                    dueDate: nextDueDate,
                    status: 'pending'
                });
            }
            return existingDue;
        });

        const dues = await Promise.all(duesPromises);

        res.json({ 
            message: 'Dues generated successfully', 
            count: dues.length,
            dueDate: nextDueDate 
        });
    } catch (error) {
        console.error('Error generating dues:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Pay due via Paystack
export const payDue = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { associationId, memberId } = req.params;
        const userId = req.user?.userId;
        
        console.log('Generating payment link for member:', memberId, 'in association:', associationId);

        // Find the most recent unpaid due for this member in this association
        const due = await MemberDue.findOne({
            associationId,
            memberId,
            status: 'pending'
        }).sort({ dueDate: -1 });
        
        if (!due) {
            return res.status(404).json({ message: 'No pending dues found for this member' });
        }

        // Verify user owns this due
        if (due.memberId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to pay this due' });
        }

        if (due.status === 'paid') {
            return res.status(400).json({ message: 'Due already paid' });
        }

        // Get association for currency
        const association = await Association.findById(due.associationId);
        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user has email, if not use phone number or generate temporary email
        let paymentEmail = user.email;
        if (!paymentEmail) {
            if (user.phoneNumber) {
                // Use phone number as temporary email for Paystack
                paymentEmail = `${user.phoneNumber.replace(/[^0-9]/g, '')}@temp.alumzi.com`;
            } else {
                // Generate temporary email using user ID
                paymentEmail = `user_${userId}@temp.alumzi.com`;
            }
        }

        // Initialize Paystack payment
        const paymentData = {
            email: paymentEmail,
            amount: Math.round(due.amount * 100), // Convert to kobo/pesewas
            currency: association.currency || 'GHS',
            reference: `dues_${due._id}_${Date.now()}`,
           // Remove callback_url since member is not in app
            metadata: {
                dueId: due._id.toString(),
                associationId: association._id.toString(),
                userId: userId,
                memberId: memberId,
                type: 'dues_payment',
                memberName: user.name,
                actualEmail: user.email || null,
                phoneNumber: user.phoneNumber || null
            }
        };

        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        const result = await paystackResponse.json() as any;

        if (!result.status) {
            return res.status(400).json({ message: 'Payment initialization failed', error: result.message });
        }

        res.json({
            message: 'Payment initialized successfully',
            paymentUrl: result.data.authorization_url,
            reference: result.data.reference
        });
    } catch (error) {
        console.error('Error initializing dues payment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get member dues details for a specific member
export const getMemberDuesDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { memberId } = req.params;
        const userId = req.user?.userId;

        // Get member dues
        const dues = await MemberDue.find({ memberId })
            .populate('associationId', 'name currency')
            .sort({ dueDate: -1 });

        // Verify user can access this data (either the member themselves or admin/moderator)
        for (const due of dues) {
            const association = due.associationId as any;
            const member = association.members?.find((m: any) => m.userId.toString() === userId);
            
            if (memberId !== userId && (!member || !['admin', 'moderator'].includes(member.role))) {
                return res.status(403).json({ message: 'Not authorized to view this member\'s dues' });
            }
        }

        // Format response
        const formattedDues = dues.map(due => ({
            id: due._id,
            associationName: (due.associationId as any).name,
            amount: due.amount,
            dueDate: due.dueDate,
            status: due.status,
            paidDate: due.paidDate,
            paidAmount: due.paidAmount,
            paymentMethod: due.paymentMethod,
            notes: due.notes,
            currency: (due.associationId as any).currency || 'USD'
        }));

        const stats = {
            total: dues.length,
            paid: dues.filter(d => d.status === 'paid').length,
            pending: dues.filter(d => d.status === 'pending').length,
            overdue: dues.filter(d => d.status === 'overdue').length,
            totalAmount: dues.reduce((sum, due) => sum + due.amount, 0),
            paidAmount: dues.filter(d => d.status === 'paid').reduce((sum, due) => sum + (due.paidAmount || 0), 0)
        };

        res.json({ dues: formattedDues, stats });
    } catch (error) {
        console.error('Error fetching member dues details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Send payment reminder SMS to member
export const sendPaymentReminder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { associationId, memberId } = req.params;
        const userId = req.user?.userId;
        
        console.log('Sending payment reminder for member:', memberId, 'in association:', associationId);

        // Verify user is admin/moderator
        const association = await Association.findById(associationId);
        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        const adminMember = association.members.find((m: any) => m.userId.toString() === userId);
        if (!adminMember || !['admin', 'moderator'].includes(adminMember.role)) {
            return res.status(403).json({ message: 'Only admins and moderators can send payment reminders' });
        }

        // Find pending due for the member
        const due = await MemberDue.findOne({
            associationId,
            memberId,
            status: { $in: ['pending', 'overdue'] }
        }).sort({ dueDate: -1 });
        
        if (!due) {
            return res.status(404).json({ message: 'No pending dues found for this member' });
        }

        // Get member details
        const memberUser = await User.findById(memberId);
        if (!memberUser) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Generate payment link
        const paymentData = {
            email: memberUser.email || 'noemail@example.com',
            amount: Math.round(due.amount * 100),
            currency: association.currency || 'GHS',
            reference: `dues_${due._id}_${Date.now()}`,
            callback_url: `${process.env.FRONTEND_URL}/dues-payment-success`,
            metadata: {
                dueId: due._id.toString(),
                associationId: association._id.toString(),
                userId: memberId,
                memberId: memberId,
                type: 'dues_payment'
            }
        };

        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        const result = await paystackResponse.json() as any;

        if (!result.status) {
            return res.status(400).json({ message: 'Payment initialization failed', error: result.message });
        }

        // Send SMS using existing SMS config
        const smsMessage = `Hi ${memberUser.name}, you have a pending dues payment of ${association.currency || 'GHS'} ${due.amount} for ${association.name}. Pay now: ${result.data.authorization_url}`;
        
        if (memberUser.phoneNumber) {
            try {
                await smsConfig({
                    text: smsMessage,
                    destinations: [memberUser.phoneNumber]
                });
                console.log('SMS sent successfully to:', memberUser.phoneNumber);
            } catch (smsError) {
                console.error('SMS sending failed:', smsError);
                // Continue execution even if SMS fails
            }
        } else {
            console.log('No phone number available for member:', memberUser.name);
        }

        res.json({
            message: memberUser.phoneNumber ? 'Payment reminder sent via SMS' : 'Payment link generated (no phone number for SMS)',
            paymentUrl: result.data.authorization_url,
            reference: result.data.reference,
            sentTo: memberUser.phoneNumber || 'No phone number'
        });
    } catch (error) {
        console.error('Error sending payment reminder:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Verify dues payment
export const verifyDuesPayment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { reference } = req.params;
        
        console.log('Verifying dues payment for reference:', reference);
        
        // Verify payment with Paystack
        const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const verification = await paystackResponse.json() as any;
        
        if (!verification.status || verification.data.status !== 'success') {
            return res.status(400).json({ 
                message: 'Payment verification failed',
                status: verification.data?.status 
            });
        }

        const { metadata } = verification.data;
        if (metadata?.type !== 'dues_payment') {
            return res.status(400).json({ message: 'Invalid payment type' });
        }

        // Update due status
        const due = await MemberDue.findById(metadata.dueId).populate('memberId', 'name');
        if (!due) {
            return res.status(404).json({ message: 'Due not found' });
        }

        due.status = 'paid';
        due.paidDate = new Date(verification.data.paid_at);
        due.paidAmount = verification.data.amount / 100; // Convert from kobo/pesewas
        due.paymentMethod = 'paystack';
        await due.save();

        // Create income record
        let duesIncomeType = await IncomeType.findOne({ 
            associationId: due.associationId, 
            name: 'Member Dues' 
        });
        
        if (!duesIncomeType) {
            duesIncomeType = await IncomeType.create({
                associationId: due.associationId,
                name: 'Member Dues',
                description: 'Payments from member dues',
                isDefault: true,
                createdBy: due.memberId._id
            });
        }

        await Income.create({
            associationId: due.associationId,
            incomeTypeId: duesIncomeType._id,
            amount: due.paidAmount,
            description: `Dues payment from ${due.memberId.name}`,
            source: due.memberId.name,
            sourceMember: due.memberId._id,
            paymentMethod: 'paystack',
            type: 'dues',
            recordedBy: due.memberId._id,
            status: 'approved'
        });

        res.json({ 
            message: 'Dues payment verified successfully',
            status: 'success',
            amount: due.paidAmount
        });
    } catch (error) {
        console.error('Error verifying dues payment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Helper function to calculate next due date
function calculateNextDueDate(frequency: string, dueDay: number): Date {
    const now = new Date();
    let dueDate = new Date();
    
    switch (frequency) {
        case 'monthly':
            dueDate.setDate(dueDay);
            if (dueDate <= now) {
                dueDate.setMonth(dueDate.getMonth() + 1);
            }
            break;
        case 'quarterly':
            const currentQuarter = Math.floor(now.getMonth() / 3);
            const quarterStartMonth = currentQuarter * 3;
            dueDate = new Date(now.getFullYear(), quarterStartMonth, dueDay);
            if (dueDate <= now) {
                dueDate = new Date(now.getFullYear(), quarterStartMonth + 3, dueDay);
            }
            break;
        case 'yearly':
            dueDate = new Date(now.getFullYear(), 0, dueDay);
            if (dueDate <= now) {
                dueDate = new Date(now.getFullYear() + 1, 0, dueDay);
            }
            break;
        case 'weekly':
        default:
            dueDate.setDate(now.getDate() + 7);
            break;
    }
    
    return dueDate;
}

// Helper function to calculate period range for dues
function calculatePeriodRange(frequency: string, dueDate: Date): { start: Date; end: Date } {
    const start = new Date(dueDate);
    const end = new Date(dueDate);
    
    switch (frequency) {
        case 'monthly':
            start.setMonth(start.getMonth() - 1);
            start.setDate(start.getDate() + 1);
            break;
        case 'quarterly':
            start.setMonth(start.getMonth() - 3);
            start.setDate(start.getDate() + 1);
            break;
        case 'yearly':
            start.setFullYear(start.getFullYear() - 1);
            start.setDate(start.getDate() + 1);
            break;
        case 'weekly':
        default:
            start.setDate(start.getDate() - 7);
            start.setDate(start.getDate() + 1);
            break;
    }
    
    return { start, end };
}