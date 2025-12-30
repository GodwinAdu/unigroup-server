import { Request, Response } from 'express';
import { Fundraiser, IFundraiser } from '../models/fundraiser.models';
import  Member  from '../models/member.models';
import  Association  from '../models/association.models';

export class FundraiserController {
  // Create a new fundraiser
  static async createFundraiser(req: Request, res: Response) {
    try {
      const { associationId } = req.params;
      const { type, title, description, targetAmount, deadline, createdBy } = req.body;

      // Validate required fields
      if (!type || !title || !description || !deadline || !createdBy) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Validate type-specific requirements
      if (type === 'goal' && (!targetAmount || targetAmount <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'Target amount is required for goal fundraisers'
        });
      }

      // Check if association exists
      const association = await Association.findById(associationId);
      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Association not found'
        });
      }

      // Check if user is admin/moderator of the association
      const member = await Member.findOne({ 
        associationId, 
        userId: createdBy,
        role: { $in: ['admin', 'moderator'] }
      });

      if (!member) {
        return res.status(403).json({
          success: false,
          message: 'Only admins and moderators can create fundraisers'
        });
      }

      // Create fundraiser
      const fundraiser = new Fundraiser({
        associationId,
        type,
        title: title.trim(),
        description: description.trim(),
        targetAmount: type === 'goal' ? targetAmount : undefined,
        deadline: new Date(deadline),
        createdBy
      });

      await fundraiser.save();

      res.status(201).json({
        success: true,
        message: 'Fundraiser created successfully',
        fundraiser: {
          id: fundraiser._id,
          type: fundraiser.type,
          title: fundraiser.title,
          description: fundraiser.description,
          targetAmount: fundraiser.targetAmount,
          currentAmount: fundraiser.currentAmount,
          deadline: fundraiser.deadline,
          status: fundraiser.status,
          contributorsCount: fundraiser.contributors.length,
          createdAt: fundraiser.createdAt
        }
      });
    } catch (error) {
      console.error('Error creating fundraiser:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create fundraiser'
      });
    }
  }

  // Get active fundraisers for an association
  static async getActiveFundraisers(req: Request, res: Response) {
    try {
      const { associationId } = req.params;

      // Update expired fundraisers first
      await Fundraiser.updateMany(
        { status: 'active', deadline: { $lt: new Date() } },
        { $set: { status: 'expired' } }
      );

      const fundraisers = await Fundraiser.find({
        associationId,
        status: 'active'
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('type title description targetAmount currentAmount deadline status contributors createdAt');

      const formattedFundraisers = fundraisers.map(fundraiser => ({
        id: fundraiser._id,
        type: fundraiser.type,
        title: fundraiser.title,
        description: fundraiser.description,
        targetAmount: fundraiser.targetAmount,
        currentAmount: fundraiser.currentAmount,
        deadline: fundraiser.deadline,
        status: fundraiser.status,
        contributorsCount: fundraiser.contributors.length,
        createdAt: fundraiser.createdAt
      }));

      res.json({
        success: true,
        fundraisers: formattedFundraisers
      });
    } catch (error) {
      console.error('Error fetching active fundraisers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch fundraisers'
      });
    }
  }

  // Get fundraiser details
  static async getFundraiserDetails(req: Request, res: Response) {
    try {
      const { fundraiserId } = req.params;

      const fundraiser = await Fundraiser.findById(fundraiserId);
      if (!fundraiser) {
        return res.status(404).json({
          success: false,
          message: 'Fundraiser not found'
        });
      }

      // Check expiration
      if (fundraiser.status === 'active' && new Date() > fundraiser.deadline) {
        fundraiser.status = 'expired';
        await fundraiser.save();
      }

      res.json({
        success: true,
        fundraiser: {
          id: fundraiser._id,
          type: fundraiser.type,
          title: fundraiser.title,
          description: fundraiser.description,
          targetAmount: fundraiser.targetAmount,
          currentAmount: fundraiser.currentAmount,
          deadline: fundraiser.deadline,
          status: fundraiser.status,
          createdBy: fundraiser.createdBy,
          contributors: fundraiser.contributors.map(contributor => ({
            id: contributor.userId,
            name: contributor.name,
            amount: contributor.amount,
            message: contributor.message,
            date: contributor.date
          })),
          createdAt: fundraiser.createdAt
        }
      });
    } catch (error) {
      console.error('Error fetching fundraiser details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch fundraiser details'
      });
    }
  }

  // Contribute to a fundraiser
  static async contributeFundraiser(req: Request, res: Response) {
    try {
      const { fundraiserId } = req.params;
      const { amount, message, contributorId } = req.body;

      if (!amount || amount <= 0 || !contributorId) {
        return res.status(400).json({
          success: false,
          message: 'Valid amount and contributor ID are required'
        });
      }

      const fundraiser = await Fundraiser.findById(fundraiserId);
      if (!fundraiser) {
        return res.status(404).json({
          success: false,
          message: 'Fundraiser not found'
        });
      }

      // Check if fundraiser is active
      if (fundraiser.status === 'active' && new Date() > fundraiser.deadline) {
        fundraiser.status = 'expired';
        await fundraiser.save();
      }
      
      if (fundraiser.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'This fundraiser is no longer active'
        });
      }

      // Get contributor details
      const contributor = await Member.findOne({ 
        associationId: fundraiser.associationId,
        userId: contributorId 
      });

      if (!contributor) {
        return res.status(404).json({
          success: false,
          message: 'Contributor not found in this association'
        });
      }

      // Add contribution
      fundraiser.contributors.push({
        userId: contributorId,
        name: contributor.name,
        amount: parseFloat(amount.toString()),
        message: message?.trim(),
        date: new Date()
      });
      
      fundraiser.currentAmount += parseFloat(amount.toString());
      
      // Check if goal is reached for goal type fundraisers
      if (fundraiser.type === 'goal' && fundraiser.targetAmount && fundraiser.currentAmount >= fundraiser.targetAmount) {
        fundraiser.status = 'completed';
      }
      
      await fundraiser.save();

      res.json({
        success: true,
        message: 'Contribution added successfully',
        fundraiser: {
          id: fundraiser._id,
          currentAmount: fundraiser.currentAmount,
          status: fundraiser.status,
          contributorsCount: fundraiser.contributors.length
        }
      });
    } catch (error) {
      console.error('Error adding contribution:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add contribution'
      });
    }
  }

  // Update fundraiser
  static async updateFundraiser(req: Request, res: Response) {
    try {
      const { fundraiserId } = req.params;
      const { title, description, targetAmount, deadline, status } = req.body;

      const fundraiser = await Fundraiser.findById(fundraiserId);
      if (!fundraiser) {
        return res.status(404).json({
          success: false,
          message: 'Fundraiser not found'
        });
      }

      // Update fields if provided
      if (title) fundraiser.title = title.trim();
      if (description) fundraiser.description = description.trim();
      if (targetAmount && fundraiser.type === 'goal') fundraiser.targetAmount = targetAmount;
      if (deadline) fundraiser.deadline = new Date(deadline);
      if (status) fundraiser.status = status;

      await fundraiser.save();

      res.json({
        success: true,
        message: 'Fundraiser updated successfully',
        fundraiser: {
          id: fundraiser._id,
          type: fundraiser.type,
          title: fundraiser.title,
          description: fundraiser.description,
          targetAmount: fundraiser.targetAmount,
          currentAmount: fundraiser.currentAmount,
          deadline: fundraiser.deadline,
          status: fundraiser.status
        }
      });
    } catch (error) {
      console.error('Error updating fundraiser:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update fundraiser'
      });
    }
  }

  // Delete fundraiser
  static async deleteFundraiser(req: Request, res: Response) {
    try {
      const { fundraiserId } = req.params;

      const fundraiser = await Fundraiser.findById(fundraiserId);
      if (!fundraiser) {
        return res.status(404).json({
          success: false,
          message: 'Fundraiser not found'
        });
      }

      // Only allow deletion if no contributions have been made
      if (fundraiser.contributors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete fundraiser with existing contributions'
        });
      }

      await Fundraiser.findByIdAndDelete(fundraiserId);

      res.json({
        success: true,
        message: 'Fundraiser deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting fundraiser:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete fundraiser'
      });
    }
  }

  // Get all fundraisers for an association (including completed/expired)
  static async getAllFundraisers(req: Request, res: Response) {
    try {
      const { associationId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      const query: any = { associationId };
      if (status) {
        query.status = status;
      }

      const fundraisers = await Fundraiser.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .select('type title description targetAmount currentAmount deadline status contributors createdAt');

      const total = await Fundraiser.countDocuments(query);

      const formattedFundraisers = fundraisers.map(fundraiser => ({
        id: fundraiser._id,
        type: fundraiser.type,
        title: fundraiser.title,
        description: fundraiser.description,
        targetAmount: fundraiser.targetAmount,
        currentAmount: fundraiser.currentAmount,
        deadline: fundraiser.deadline,
        status: fundraiser.status,
        contributorsCount: fundraiser.contributors.length,
        createdAt: fundraiser.createdAt
      }));

      res.json({
        success: true,
        fundraisers: formattedFundraisers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching fundraisers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch fundraisers'
      });
    }
  }
}