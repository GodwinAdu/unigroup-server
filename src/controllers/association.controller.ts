import { Request, Response } from 'express';
import { Association, Expense, Income, Member, User } from '../models';
import { sendAssociationNotification } from './notification.controller';
import { broadcastMemberUpdate, broadcastSettingsChange } from '../sockets';
import mongoose from 'mongoose';

// Generate unique association code
const generateCode = (): string => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Create Association
export const createAssociation = async (req: Request, res: Response) => {
    try {
        const { name, type, description, city, country, schoolInfo, communityInfo, currency, timezone } = req.body;
        const userId = req.user?.userId;

        if (!name || !type) {
            return res.status(400).json({ message: 'Name and type are required' });
        }

        if (!['school', 'community'].includes(type)) {
            return res.status(400).json({ message: 'Type must be school or community' });
        }

        // Generate unique code
        let code = generateCode();
        while (await Association.findOne({ code })) {
            code = generateCode();
        }

        const association = new Association({
            name,
            type,
            description,
            city,
            country,
            code,
            createdBy: userId,
            currency: currency || 'USD',
            timezone: timezone || 'UTC',
            ...(schoolInfo && { schoolInfo }),
            ...(communityInfo && { communityInfo }),
            members: [{
                userId,
                role: 'admin',
                joinedAt: new Date(),
                isActive: true,
                status: 'active'
            }],
            stats: {
                totalMembers: 1,
                activeMembers: 1,
                totalIncome: 0,
                totalExpenses: 0,
                lastActivity: new Date()
            },
            settings: {
                isPublic: true,
                requireApproval: true,
                allowMemberInvites: true,
                showMemberList: true,
                showFinancials: false,
                allowDataExport: false,
                notifications: {
                    newMembers: true,
                    memberRequests: true,
                    financialUpdates: true,
                    incomeRecorded: false,
                    expenseRecorded: false,
                    monthlyReports: true,
                    eventReminders: true,
                    systemUpdates: false,
                    emailNotifications: true,
                    pushNotifications: true
                },
                financial: {
                    allowMemberContributions: true,
                    requireReceiptUpload: false,
                    autoApproveExpenses: false,
                    expenseApprovalLimit: 1000
                },
                security: {
                    requireTwoFactorForAdmins: false,
                    allowGuestAccess: false,
                    sessionTimeout: 60
                }
            }
        });

        await association.save();

        // Create member record
        const member = new Member({
            userId,
            associationId: association._id,
            status: 'active',
            role: 'admin',
            duesStatus: 'exempt'
        });

        await member.save();

        res.status(201).json({
            message: 'Association created successfully',
            association: {
                id: association._id,
                name: association.name,
                type: association.type,
                code: association.code,
                description: association.description
            }
        });

    } catch (error) {
        console.error('Create association error:', error);
        res.status(500).json({ message: 'Failed to create association' });
    }
};

// Join Association
export const joinAssociation = async (req: Request, res: Response) => {
    try {
        const { code } = req.body;
        const userId = req.user?.userId;

        if (!code) {
            return res.status(400).json({ message: 'Association code is required' });
        }

        const association = await Association.findOne({ code: code.toUpperCase() });
        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        // Check if already a member
        const existingMember = await Member.findOne({ userId, associationId: association._id });
        if (existingMember) {
            return res.status(400).json({ message: 'Already a member of this association' });
        }

        // Create member record
        const member = new Member({
            userId,
            associationId: association._id,
            status: association.settings.requireApproval ? 'pending' : 'active',
            role: 'member'
        });

        await member.save();

        // Add to association members array
        association.members.push({
            userId,
            role: 'member',
            joinedAt: new Date(),
            isActive: true,
            status: association.settings.requireApproval ? 'pending' : 'active'
        });

        // Update stats
        association.stats.totalMembers += 1;
        if (member.status === 'active') {
            association.stats.activeMembers += 1;
        }
        association.stats.lastActivity = new Date();

        await association.save();

        // Send notification to association members
        const user = await User.findById(userId);
        if (member.status === 'active') {
            // Broadcast real-time member update
            broadcastMemberUpdate(association._id.toString(), 'joined', {
                id: member._id,
                name: user?.name,
                role: member.role,
                joinedAt: member.joinedAt
            });
            
            await sendAssociationNotification(
                association._id.toString(),
                'new_member',
                'New Member Joined',
                `${user?.name} has joined ${association.name}`,
                { userId, userName: user?.name },
                userId
            );
        } else {
            await sendAssociationNotification(
                association._id.toString(),
                'member_request',
                'New Join Request',
                `${user?.name} has requested to join ${association.name}`,
                { userId, userName: user?.name },
                userId
            );
        }

        res.status(200).json({
            message: 'Successfully joined association',
            association: {
                id: association._id,
                name: association.name,
                type: association.type,
                status: member.status
            }
        });

    } catch (error) {
        console.error('Join association error:', error);
        res.status(500).json({ message: 'Failed to join association' });
    }
};

// Get User Associations
export const getUserAssociations = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        console.log('Fetching associations for user:', userId);

        const members = await Member.find({ userId, status: { $in: ['active', 'pending'] } })
            .populate('associationId', 'name type code description currency timezone city country schoolInfo communityInfo settings')
            .sort({ joinedAt: -1 });

        const associations = members
            .filter(member => member.associationId) // Filter out null associations
            .map(member => ({
                id: member.associationId._id,
                name: member.associationId.name,
                type: member.associationId.type,
                code: member.associationId.code,
                description: member.associationId.description,
                currency: member.associationId.currency,
                timezone: member.associationId.timezone,
                city: member.associationId.city,
                country: member.associationId.country,
                schoolInfo: member.associationId.schoolInfo,
                communityInfo: member.associationId.communityInfo,
                settings: member.associationId.settings,
                role: member.role,
                status: member.status,
                joinedAt: member.joinedAt
            }));


        console.log('User associations retrieved:', associations);
        res.status(200).json({ associations });

    } catch (error) {
        console.error('Get user associations error:', error);
        res.status(500).json({ message: 'Failed to get associations' });
    }
};

// Search Associations
export const searchAssociations = async (req: Request, res: Response) => {
    try {
        const { query, type } = req.query;
        console.log('Search associations with query:', query, 'and type:', type);

        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const searchFilter: any = {
            'settings.isPublic': true,
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { code: { $regex: query, $options: 'i' } },
                { country: { $regex: query, $options: 'i' } }
            ]
        };
        console.log('Search filter constructed:', searchFilter);

        if (type && ['school', 'community'].includes(type as string)) {
            searchFilter.type = type;
        }

        const associations = await Association.find(searchFilter)
            .select('name type code description members')
            .limit(20);

            console.log('Associations found:', associations.length);

        const results = associations.map(assoc => ({
            id: assoc._id,
            name: assoc.name,
            type: assoc.type,
            code: assoc.code,
            description: assoc.description,
            memberCount: assoc.members.length
        }));

        res.status(200).json({ associations: results });

    } catch (error) {
        console.error('Search associations error:', error);
        res.status(500).json({ message: 'Failed to search associations' });
    }
};

// Update association settings
export const updateAssociationSettings = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;
        const { settings } = req.body;

        // Check if user is admin or moderator
        const member = await Member.findOne({ userId, associationId, role: { $in: ['admin', 'moderator'] } });
        if (!member) {
            return res.status(403).json({ message: 'Only admins and moderators can update association settings' });
        }

        const association = await Association.findByIdAndUpdate(
            associationId,
            { $set: { settings } },
            { new: true }
        );

        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }
        
        // Broadcast settings change
        broadcastSettingsChange(associationId, 'general', association.settings);

        res.status(200).json({ message: 'Settings updated successfully', settings: association.settings });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ message: 'Failed to update settings' });
    }
};

// Get association settings
export const getAssociationSettings = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        // Check if user is member
        const member = await Member.findOne({ userId, associationId });
        if (!member) {
            return res.status(403).json({ message: 'Not a member of this association' });
        }

        const association = await Association.findById(associationId).select('settings');
        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        res.status(200).json({ settings: association.settings });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ message: 'Failed to get settings' });
    }
};

// Get pending member requests
export const getPendingRequests = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        // Check if user is admin or moderator
        const member = await Member.findOne({ userId, associationId, role: { $in: ['admin', 'moderator'] } });
        if (!member) {
            return res.status(403).json({ message: 'Not authorized to view requests' });
        }

        const pendingMembers = await Member.find({ associationId, status: 'pending' })
            .populate('userId', 'name email phoneNumber')
            .sort({ createdAt: -1 });

        const requests = pendingMembers.map(member => ({
            id: member._id,
            user: {
                id: member.userId._id,
                name: member.userId.name,
                email: member.userId.email,
                phoneNumber: member.userId.phoneNumber
            },
            requestedAt: member.createdAt
        }));

        res.status(200).json({ requests });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ message: 'Failed to get pending requests' });
    }
};

// Approve member request
export const approveMemberRequest = async (req: Request, res: Response) => {
    try {
        const { associationId, memberId } = req.params;
        const userId = req.user?.userId;

        // Check if user is admin or moderator
        const adminMember = await Member.findOne({ userId, associationId, role: { $in: ['admin', 'moderator'] } });
        if (!adminMember) {
            return res.status(403).json({ message: 'Not authorized to approve requests' });
        }

        // Update member status to active
        const member = await Member.findOneAndUpdate(
            { _id: memberId, associationId, status: 'pending' },
            { status: 'active' },
            { new: true }
        ).populate('userId', 'name');

        if (!member) {
            return res.status(404).json({ message: 'Pending request not found' });
        }

        // Update association members array
        await Association.findByIdAndUpdate(associationId, {
            $set: {
                'members.$[elem].isActive': true
            }
        }, {
            arrayFilters: [{ 'elem.userId': member.userId._id }]
        });

        // Send notification to approved member
        const association = await Association.findById(associationId);
        if (association) {
            // Broadcast real-time member update
            broadcastMemberUpdate(associationId, 'status_changed', {
                id: member._id,
                name: member.userId.name,
                role: member.role,
                status: 'active'
            });
            
            await sendAssociationNotification(
                associationId,
                'member_approved',
                'Request Approved',
                `Your request to join ${association.name} has been approved`,
                { approvedBy: userId },
                member.userId._id.toString()
            );
        }

        res.status(200).json({ message: 'Member request approved successfully' });
    } catch (error) {
        console.error('Approve member error:', error);
        res.status(500).json({ message: 'Failed to approve member request' });
    }
};

// Reject member request
export const rejectMemberRequest = async (req: Request, res: Response) => {
    try {
        const { associationId, memberId } = req.params;
        const userId = req.user?.userId;

        // Check if user is admin or moderator
        const adminMember = await Member.findOne({ userId, associationId, role: { $in: ['admin', 'moderator'] } });
        if (!adminMember) {
            return res.status(403).json({ message: 'Not authorized to reject requests' });
        }

        // Remove member record
        const member = await Member.findOneAndDelete({
            _id: memberId,
            associationId,
            status: 'pending'
        }).populate('userId', 'name');

        if (!member) {
            return res.status(404).json({ message: 'Pending request not found' });
        }

        // Remove from association members array
        await Association.findByIdAndUpdate(associationId, {
            $pull: { members: { userId: member.userId._id } }
        });

        res.status(200).json({ message: 'Member request rejected successfully' });
    } catch (error) {
        console.error('Reject member error:', error);
        res.status(500).json({ message: 'Failed to reject member request' });
    }
};

// Update Association
export const updateAssociation = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;
        const { name, description, city, country, schoolInfo, communityInfo, currency, timezone, socialLinks } = req.body;

        // Check if user is admin or moderator
        const member = await Member.findOne({ 
            userId, 
            associationId, 
            role: { $in: ['admin', 'moderator'] } 
        });
        
        if (!member) {
            return res.status(403).json({ message: 'Not authorized to update association' });
        }

        const updateData: any = {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(city !== undefined && { city }),
            ...(country !== undefined && { country }),
            ...(currency && { currency }),
            ...(timezone && { timezone }),
            ...(schoolInfo && { schoolInfo }),
            ...(communityInfo && { communityInfo }),
            ...(socialLinks && { socialLinks }),
            'stats.lastActivity': new Date()
        };

        // Handle settings update
        if (req.body.settings) {
            updateData.settings = req.body.settings;
        }

        const association = await Association.findByIdAndUpdate(
            associationId,
            updateData,
            { new: true }
        );

        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        res.status(200).json({
            message: 'Association updated successfully',
            association: {
                id: association._id,
                name: association.name,
                type: association.type,
                description: association.description,
                city: association.city,
                country: association.country,
                currency: association.currency,
                timezone: association.timezone,
                schoolInfo: association.schoolInfo,
                communityInfo: association.communityInfo,
                settings: association.settings
            }
        });

    } catch (error) {
        console.error('Update association error:', error);
        res.status(500).json({ message: 'Failed to update association' });
    }
};

export const getDashboardData = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Get total income
        const incomeResult = await Income.aggregate([
            { $match: { associationId: new mongoose.Types.ObjectId(associationId) } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalIncome = incomeResult[0]?.total || 0;

        // Get total expenses
        const expenseResult = await Expense.aggregate([
            { $match: { associationId: new mongoose.Types.ObjectId(associationId) } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalExpenses = expenseResult[0]?.total || 0;

        // Calculate balance
        const balance = totalIncome - totalExpenses;

        // Get member count
        const memberCount = await Member.countDocuments({
            associationId: new mongoose.Types.ObjectId(associationId),
            status: { $in: ['active', 'pending'] }
        });

        // Get recent transactions (income and expenses combined)
        const recentIncome = await Income.find({ associationId: new mongoose.Types.ObjectId(associationId) })
            .sort({ date: -1 })
            .limit(5)
            .select('amount description date type')
            .lean();

        const recentExpenses = await Expense.find({ associationId: new mongoose.Types.ObjectId(associationId) })
            .sort({ date: -1 })
            .limit(5)
            .select('amount description date category')
            .lean();

        // Combine and sort transactions
        const allTransactions = [
            ...recentIncome.map(income => ({
                id: (income._id as mongoose.Types.ObjectId).toString(),
                type: 'income',
                amount: income.amount,
                description: income.description,
                date: income.date.toISOString(),
                category: income.type
            })),
            ...recentExpenses.map(expense => ({
                id: (expense._id as mongoose.Types.ObjectId).toString(),
                type: 'expense',
                amount: expense.amount,
                description: expense.description,
                date: expense.date.toISOString(),
                category: expense.category
            }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

        const dashboardData = {
            totalIncome,
            totalExpenses,
            balance,
            members: memberCount,
            recentTransactions: allTransactions
        };

        res.json({ success: true, data: dashboardData });
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
    }
};