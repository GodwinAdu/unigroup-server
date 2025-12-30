import { Request, Response } from 'express';
import { IncomeType, Member } from '../models';

export const getIncomeTypes = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        const member = await Member.findOne({ userId, associationId });
        if (!member) {
            return res.status(403).json({ message: 'Not a member of this association' });
        }

        const incomeTypes = await IncomeType.find({ associationId, isActive: true })
            .sort({ name: 1 });

        res.status(200).json({ incomeTypes });
    } catch (error: any) {
        console.error('Get income types error:', error);
        res.status(500).json({ message: 'Failed to get income types' });
    }
};

export const createIncomeType = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const { name, description } = req.body;
        const userId = req.user?.userId;

        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: { $in: ['admin', 'moderator'] } 
        });
        if (!member) {
            return res.status(403).json({ message: 'Not authorized to create income types' });
        }

        const incomeType = new IncomeType({
            associationId,
            name: name.trim(),
            description: description?.trim(),
            createdBy: userId
        });

        await incomeType.save();

        res.status(201).json({
            message: 'Income type created successfully',
            incomeType: {
                id: incomeType._id,
                name: incomeType.name,
                description: incomeType.description,
                isActive: incomeType.isActive
            }
        });
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Income type with this name already exists' });
        }
        console.error('Create income type error:', error);
        res.status(500).json({ message: 'Failed to create income type' });
    }
};

export const updateIncomeType = async (req: Request, res: Response) => {
    try {
        const { associationId, incomeTypeId } = req.params;
        const { name, description, isActive } = req.body;
        const userId = req.user?.userId;

        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: { $in: ['admin', 'moderator'] } 
        });
        if (!member) {
            return res.status(403).json({ message: 'Not authorized to update income types' });
        }

        const incomeType = await IncomeType.findOneAndUpdate(
            { _id: incomeTypeId, associationId },
            {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() }),
                ...(isActive !== undefined && { isActive })
            },
            { new: true }
        );

        if (!incomeType) {
            return res.status(404).json({ message: 'Income type not found' });
        }

        res.status(200).json({
            message: 'Income type updated successfully',
            incomeType: {
                id: incomeType._id,
                name: incomeType.name,
                description: incomeType.description,
                isActive: incomeType.isActive
            }
        });
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Income type with this name already exists' });
        }
        console.error('Update income type error:', error);
        res.status(500).json({ message: 'Failed to update income type' });
    }
};

export const deleteIncomeType = async (req: Request, res: Response) => {
    try {
        const { associationId, incomeTypeId } = req.params;
        const userId = req.user?.userId;

        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: { $in: ['admin', 'moderator'] } 
        });
        if (!member) {
            return res.status(403).json({ message: 'Not authorized to delete income types' });
        }

        const incomeType = await IncomeType.findOneAndUpdate(
            { _id: incomeTypeId, associationId },
            { isActive: false },
            { new: true }
        );

        if (!incomeType) {
            return res.status(404).json({ message: 'Income type not found' });
        }

        res.status(200).json({ message: 'Income type deleted successfully' });
    } catch (error: any) {
        console.error('Delete income type error:', error);
        res.status(500).json({ message: 'Failed to delete income type' });
    }
};