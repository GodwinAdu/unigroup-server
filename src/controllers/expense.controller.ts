import { Request, Response } from 'express';
import { Expense, Member, ExpenseType, Association } from '../models';
import { sendAssociationNotification } from './notification.controller';
import { broadcastFinancialUpdate, broadcastDashboardUpdate } from '../sockets';

// Create expense
export const createExpense = async (req: Request, res: Response) => {
    try {
        const { associationId, expenseTypeId, amount, description, vendor, paymentMethod } = req.body;
        const userId = req.user?.userId;

        if (!associationId || !expenseTypeId || !amount || !description) {
            return res.status(400).json({ message: 'Required fields missing' });
        }

        // Check if user is admin or moderator
        const member = await Member.findOne({ 
            userId, 
            associationId,
            role: { $in: ['admin', 'moderator'] }
        });
        if (!member) {
            return res.status(403).json({ message: 'Only admins and moderators can create expenses' });
        }

        // Verify expense type exists
        const expenseType = await ExpenseType.findOne({ _id: expenseTypeId, associationId });
        if (!expenseType) {
            return res.status(404).json({ message: 'Expense type not found' });
        }

        // Get association to check financial settings
        const association = await Association.findById(associationId);
        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        const expenseAmount = parseFloat(amount);
        const shouldAutoApprove = association.settings?.financial?.autoApproveExpenses && 
                                 expenseAmount <= (association.settings?.financial?.expenseApprovalLimit || 0);

        const expense = new Expense({
            associationId,
            category: expenseType.name,
            amount: expenseAmount,
            description,
            vendor,
            paymentMethod,
            recordedBy: userId,
            isApproved: shouldAutoApprove
        });

        await expense.save();

        // Send notification
        const notificationTitle = shouldAutoApprove ? 'Expense Auto-Approved' : 'New Expense Recorded';
        const notificationMessage = shouldAutoApprove 
            ? `${member.userId.name} recorded and auto-approved an expense of $${amount} for ${expenseType.name}`
            : `${member.userId.name} recorded an expense of $${amount} for ${expenseType.name} (pending approval)`;
            
        await sendAssociationNotification(
            associationId,
            'expense_recorded',
            notificationTitle,
            notificationMessage,
            { expenseId: expense._id, amount, category: expenseType.name, autoApproved: shouldAutoApprove },
            userId
        );
        
        // Broadcast real-time financial update
        broadcastFinancialUpdate(associationId, 'expense', {
            id: expense._id,
            amount: expense.amount,
            category: expenseType.name,
            description: expense.description,
            recordedBy: member.userId.name,
            date: expense.date,
            isApproved: expense.isApproved,
            autoApproved: shouldAutoApprove
        });
        
        // Broadcast dashboard update
        broadcastDashboardUpdate(associationId, {
            type: 'expense_added',
            amount: expense.amount
        });

        res.status(201).json({
            message: shouldAutoApprove ? 'Expense recorded and automatically approved' : 'Expense recorded successfully',
            expense: {
                id: expense._id,
                category: expense.category,
                amount: expense.amount,
                description: expense.description,
                date: expense.date,
                isApproved: expense.isApproved,
                autoApproved: shouldAutoApprove
            }
        });
    } catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({ message: 'Failed to record expense' });
    }
};

// Get expenses for association
export const getExpenses = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;
        const { page = 1, limit = 20 } = req.query;

        // Check if user is member
        const member = await Member.findOne({ userId, associationId });
        if (!member) {
            return res.status(403).json({ message: 'Not a member of this association' });
        }

        const expenses = await Expense.find({ associationId })
            .populate('recordedBy', 'name')
            .sort({ date: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await Expense.countDocuments({ associationId });

        res.status(200).json({
            expenses: expenses.map(expense => ({
                id: expense._id,
                category: expense.category,
                amount: expense.amount,
                description: expense.description,
                vendor: expense.vendor,
                paymentMethod: expense.paymentMethod,
                recordedBy: expense.recordedBy.name,
                date: expense.date,
                isApproved: expense.isApproved
            })),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ message: 'Failed to get expenses' });
    }
};

// Delete expense
export const deleteExpense = async (req: Request, res: Response) => {
    try {
        const { expenseId } = req.params;
        const userId = req.user?.userId;

        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        // Check if user is admin or moderator
        const member = await Member.findOne({ 
            userId, 
            associationId: expense.associationId,
            role: { $in: ['admin', 'moderator'] }
        });

        if (!member) {
            return res.status(403).json({ message: 'Only admins and moderators can delete expenses' });
        }

        await Expense.findByIdAndDelete(expenseId);

        res.status(200).json({ message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({ message: 'Failed to delete expense' });
    }
};

// Update expense
export const updateExpense = async (req: Request, res: Response) => {
    try {
        const { expenseId } = req.params;
        const { expenseTypeId, amount, description, vendor, paymentMethod } = req.body;
        const userId = req.user?.userId;
        
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        const member = await Member.findOne({ 
            userId, 
            associationId: expense.associationId,
            $or: [
                { role: { $in: ['admin', 'moderator'] } },
                { userId: expense.recordedBy }
            ]
        });

        if (!member) {
            return res.status(403).json({ message: 'Not authorized to update this expense' });
        }

        const updateData: any = {};
        if (amount !== undefined) updateData.amount = parseFloat(amount);
        if (description !== undefined) updateData.description = description;
        if (vendor !== undefined) updateData.vendor = vendor;
        if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
        
        if (expenseTypeId !== undefined) {
            const expenseType = await ExpenseType.findById(expenseTypeId);
            if (expenseType) {
                updateData.category = expenseType.name;
            }
        }

        await Expense.findByIdAndUpdate(expenseId, updateData, { new: true });

        res.status(200).json({ message: 'Expense updated successfully' });
    } catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({ message: 'Failed to update expense' });
    }
};

// Approve expense
export const approveExpense = async (req: Request, res: Response) => {
    try {
        const { expenseId } = req.params;
        const userId = req.user?.userId;

        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        const member = await Member.findOne({ 
            userId, 
            associationId: expense.associationId,
            role: { $in: ['admin', 'moderator'] }
        });

        if (!member) {
            return res.status(403).json({ message: 'Only admins and moderators can approve expenses' });
        }

        await Expense.findByIdAndUpdate(expenseId, { isApproved: true });

        res.status(200).json({ message: 'Expense approved successfully' });
    } catch (error) {
        console.error('Approve expense error:', error);
        res.status(500).json({ message: 'Failed to approve expense' });
    }
};