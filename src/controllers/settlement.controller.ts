import { Request, Response } from 'express';
import { Settlement } from '../models/settlement.models';
import mongoose from 'mongoose';

export const getSettlements = async (req: Request, res: Response) => {
  try {
    const { associationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(associationId)) {
      return res.status(400).json({ message: 'Invalid association ID' });
    }

    const settlements = await Settlement.find({ 
      associationId: new mongoose.Types.ObjectId(associationId) 
    })
    .sort({ year: -1, month: -1 })
    .lean();

    res.json({ settlements });
  } catch (error) {
    console.error('Error fetching settlements:', error);
    res.status(500).json({ message: 'Failed to fetch settlements' });
  }
};

export const createSettlement = async (req: Request, res: Response) => {
  try {
    const { associationId } = req.params;
    const settlementData = req.body;

    if (!mongoose.Types.ObjectId.isValid(associationId)) {
      return res.status(400).json({ message: 'Invalid association ID' });
    }

    const settlement = new Settlement({
      ...settlementData,
      associationId: new mongoose.Types.ObjectId(associationId),
    });

    await settlement.save();

    res.status(201).json({ settlement });
  } catch (error) {
    console.error('Error creating settlement:', error);
    res.status(500).json({ message: 'Failed to create settlement' });
  }
};