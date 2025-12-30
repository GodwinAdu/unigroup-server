import { Request, Response } from 'express';
import { Expense, ExpenseType, Member } from '../models';

// Get expense types for association
export const getExpenseTypes = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        // Check if user is member
        const member = await Member.findOne({ userId, associationId });
        if (!member) {
            return res.status(403).json({ message: 'Not a member of this association' });
        }

        const expenseTypes = await ExpenseType.find({ associationId, isActive: true })
            .sort({ name: 1 });

        res.status(200).json({ expenseTypes });
    } catch (error: any) {
        console.error('Get expense types error:', error);
        res.status(500).json({ message: 'Failed to get expense types' });
    }
};

// Create expense type
export const createExpenseType = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const { name, description } = req.body;
        const userId = req.user?.userId;

        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        // Check if user is admin or moderator
        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: { $in: ['admin', 'moderator'] } 
        });
        if (!member) {
            return res.status(403).json({ message: 'Not authorized to create expense types' });
        }

        const expenseType = new ExpenseType({
            associationId,
            name: name.trim(),
            description: description?.trim(),
            createdBy: userId
        });

        await expenseType.save();

        res.status(201).json({
            message: 'Expense type created successfully',
            expenseType: {
                id: expenseType._id,
                name: expenseType.name,
                description: expenseType.description,
                isActive: expenseType.isActive
            }
        });
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Expense type with this name already exists' });
        }
        console.error('Create expense type error:', error);
        res.status(500).json({ message: 'Failed to create expense type' });
    }
};

// Update expense type
export const updateExpenseType = async (req: Request, res: Response) => {
    try {
        const { associationId, expenseTypeId } = req.params;
        const { name, description, isActive } = req.body;
        const userId = req.user?.userId;

        // Check if user is admin or moderator
        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: { $in: ['admin', 'moderator'] } 
        });
        if (!member) {
            return res.status(403).json({ message: 'Not authorized to update expense types' });
        }

        const expenseType = await ExpenseType.findOneAndUpdate(
            { _id: expenseTypeId, associationId },
            {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() }),
                ...(isActive !== undefined && { isActive })
            },
            { new: true }
        );

        if (!expenseType) {
            return res.status(404).json({ message: 'Expense type not found' });
        }

        res.status(200).json({
            message: 'Expense type updated successfully',
            expenseType: {
                id: expenseType._id,
                name: expenseType.name,
                description: expenseType.description,
                isActive: expenseType.isActive
            }
        });
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Expense type with this name already exists' });
        }
        console.error('Update expense type error:', error);
        res.status(500).json({ message: 'Failed to update expense type' });
    }
};

// Delete expense type
export const deleteExpenseType = async (req: Request, res: Response) => {
    try {
        const { associationId, expenseTypeId } = req.params;
        const userId = req.user?.userId;

        // Check if user is admin or moderator
        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: { $in: ['admin', 'moderator'] } 
        });
        if (!member) {
            return res.status(403).json({ message: 'Not authorized to delete expense types' });
        }

        // Soft delete by setting isActive to false
        const expenseType = await ExpenseType.findOneAndUpdate(
            { _id: expenseTypeId, associationId },
            { isActive: false },
            { new: true }
        );

        if (!expenseType) {
            return res.status(404).json({ message: 'Expense type not found' });
        }

        res.status(200).json({ message: 'Expense type deleted successfully' });
    } catch (error: any) {
        console.error('Delete expense type error:', error);
        res.status(500).json({ message: 'Failed to delete expense type' });
    }
};