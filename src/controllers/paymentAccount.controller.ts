import { Request, Response } from 'express';
import { PaymentAccount, Member } from '../models';
import { PaystackService } from '../services/paystack.service';

export const getPaymentAccount = async (req: Request, res: Response) => {
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

        const account = await PaymentAccount.findOne({ associationId, isActive: true });
        
        res.status(200).json({
            account: account ? {
                id: account._id,
                accountType: account.accountType,
                accountNumber: account.accountNumber,
                accountName: account.accountName,
                bankName: account.bankName,
                momoProvider: account.momoProvider
            } : null
        });
    } catch (error) {
        console.error('Get payment account error:', error);
        res.status(500).json({ message: 'Failed to get payment account' });
    }
};

export const createPaymentAccount = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const { accountType, accountNumber, accountName, bankCode, bankName, momoProvider } = req.body;
        const userId = req.user?.userId;

        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: 'admin'
        });
        if (!member) {
            return res.status(403).json({ message: 'Only admins can set payment accounts' });
        }

        // Deactivate existing accounts
        await PaymentAccount.updateMany({ associationId }, { isActive: false });

        // Verify account with Paystack if bank account
        let recipientCode = '';
        if (accountType === 'bank') {
            try {
                const verification = await PaystackService.verifyAccountNumber(accountNumber, bankCode);
                
                if (!verification.account_name) {
                    return res.status(400).json({ message: 'Invalid bank account details' });
                }

                // Create transfer recipient
                const recipient = await PaystackService.createTransferRecipient(
                    verification.account_name,
                    accountNumber,
                    bankCode
                );

                recipientCode = recipient.recipient_code;
            } catch (error: any) {
                return res.status(400).json({ message: `Account verification failed: ${error.message}` });
            }
        }

        const account = new PaymentAccount({
            associationId,
            accountType,
            accountNumber,
            accountName,
            bankCode,
            bankName,
            momoProvider,
            paystackRecipientCode: recipientCode
        });

        await account.save();

        res.status(201).json({
            message: 'Payment account created successfully',
            account: {
                id: account._id,
                accountType: account.accountType,
                accountNumber: account.accountNumber,
                accountName: account.accountName
            }
        });
    } catch (error) {
        console.error('Create payment account error:', error);
        res.status(500).json({ message: 'Failed to create payment account' });
    }
};

export const updatePaymentAccount = async (req: Request, res: Response) => {
    try {
        const { associationId, accountId } = req.params;
        const updates = req.body;
        const userId = req.user?.userId;

        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: 'admin'
        });
        if (!member) {
            return res.status(403).json({ message: 'Only admins can update payment accounts' });
        }

        await PaymentAccount.findOneAndUpdate(
            { _id: accountId, associationId },
            updates,
            { new: true }
        );

        res.status(200).json({ message: 'Payment account updated successfully' });
    } catch (error) {
        console.error('Update payment account error:', error);
        res.status(500).json({ message: 'Failed to update payment account' });
    }
};

export const getBanks = async (req: Request, res: Response) => {
    try {
        const banks = await PaystackService.getBanks();
        
        res.status(200).json({ 
            banks: banks.map((bank: any) => ({
                code: bank.code,
                name: bank.name
            }))
        });
    } catch (error) {
        console.error('Get banks error:', error);
        res.status(500).json({ message: 'Failed to get banks' });
    }
};

export const verifyAccountNumber = async (req: Request, res: Response) => {
    try {
        const { accountNumber, bankCode } = req.body;

        if (!accountNumber || !bankCode) {
            return res.status(400).json({ message: 'Account number and bank code required' });
        }

        const verification = await PaystackService.verifyAccountNumber(accountNumber, bankCode);

        res.status(200).json({
            accountName: verification.account_name,
            accountNumber: verification.account_number,
            bankCode
        });
    } catch (error: any) {
        console.error('Verify account error:', error);
        res.status(400).json({ message: error.message || 'Failed to verify account' });
    }
};