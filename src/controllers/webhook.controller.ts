import { Request, Response } from 'express';
import { Payment, PaymentAccount } from '../models';
import MemberDue from '../models/memberDues.models';
import Income from '../models/income.models';
import IncomeType from '../models/incomeType.models';
import User from '../models/user.models';
import crypto from 'crypto';

export const paystackWebhook = async (req: Request, res: Response) => {
    try {
        console.log('🔔 Webhook received:', JSON.stringify(req.body, null, 2));
        
        const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            console.log('❌ Invalid webhook signature');
            return res.status(400).json({ message: 'Invalid signature' });
        }

        const event = req.body;
        console.log('✅ Webhook signature valid, event:', event.event);

        if (event.event === 'charge.success') {
            const { reference, status, amount, metadata } = event.data;
            console.log('💰 Payment success:', { reference, status, amount, metadata });

            // Check if this is a dues payment
            if (metadata?.type === 'dues_payment') {
                console.log('📋 Processing dues payment for dueId:', metadata.dueId);
                
                const due = await MemberDue.findById(metadata.dueId);
                if (due && status === 'success') {
                    console.log('✅ Due found, updating status to paid');
                    
                    due.status = 'paid';
                    due.paidDate = new Date(event.data.paid_at);
                    due.paidAmount = amount / 100; // Convert from kobo/pesewas
                    due.paymentMethod = 'paystack';
                    await due.save();

                    // Get member details
                    const memberUser = await User.findById(metadata.memberId);

                    // Create income record for dues payment
                    let duesIncomeType = await IncomeType.findOne({ 
                        associationId: due.associationId, 
                        name: 'Member Dues' 
                    });
                    
                    if (!duesIncomeType) {
                        duesIncomeType = await IncomeType.create({
                            associationId: due.associationId,
                            name: 'Member Dues',
                            description: 'Payments from member dues',
                            isDefault: true
                        });
                    }

                    await Income.create({
                        associationId: due.associationId,
                        incomeTypeId: duesIncomeType._id,
                        amount: due.paidAmount,
                        description: `Dues payment from ${memberUser?.name || 'Member'}`,
                        source: memberUser?.name || 'Member',
                        sourceMember: metadata.memberId,
                        paymentMethod: 'paystack',
                        type: 'dues',
                        recordedBy: metadata.memberId,
                        status: 'approved'
                    });

                    console.log(`✅ Dues payment processed: ${reference} - ${memberUser?.name}`);
                } else {
                    console.log('❌ Due not found or payment not successful:', { dueFound: !!due, status });
                }
            } else {
                // Regular payment processing
                const payment = await Payment.findOne({ paystackReference: reference });
                if (!payment) {
                    return res.status(404).json({ message: 'Payment not found' });
                }

                if (status === 'success' && payment.status === 'pending') {
                    payment.status = 'successful';
                    payment.paystackTransactionId = event.data.id.toString();
                    payment.paidAt = new Date(event.data.paid_at);
                    await payment.save();

                    // Update association pending balance
                    await PaymentAccount.findOneAndUpdate(
                        { associationId: payment.associationId },
                        { $inc: { pendingBalance: payment.associationAmount } }
                    );
                }
            }
        }

        res.status(200).json({ message: 'Webhook processed' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
};