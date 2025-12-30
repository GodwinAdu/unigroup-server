import { Request, Response } from 'express';
import { Association, Member, User, Income } from '../models';
import MemberDue from '../models/memberDues.models';
import { broadcastMemberUpdate, broadcastDashboardUpdate } from '../sockets';
import { checkLimits } from './subscription.controller';


// Add multiple members to association
export const addMembers = async (req: Request, res: Response) => {
    try {
        const { associationId, members } = req.body;
        const userId = req.user?.userId;

        console.log('Add members request:', { associationId, membersCount: members?.length, userId });

        if (!associationId || !members || !Array.isArray(members)) {
            return res.status(400).json({ message: 'Association ID and members array are required' });
        }

        // Check if user is admin or moderator
        const userMember = await Member.findOne({ 
            userId, 
            associationId, 
            role: { $in: ['admin', 'moderator'] } 
        });
        
        console.log('User member check:', { userMember: !!userMember, role: userMember?.role });
        
        if (!userMember) {
            return res.status(403).json({ message: 'Not authorized to add members' });
        }

        const association = await Association.findById(associationId);
        if (!association) {
            return res.status(404).json({ message: 'Association not found' });
        }

        // Check subscription limits
        const limits = await checkLimits(associationId);
        const currentMemberCount = await Member.countDocuments({ associationId });
        const newMemberCount = currentMemberCount + members.length;
        
        if (!limits.canAddMembers || (limits.memberLimit !== -1 && newMemberCount > limits.memberLimit)) {
            return res.status(403).json({ 
                message: `Member limit exceeded. Your ${limits.plan} plan allows ${limits.memberLimit} members. Upgrade to add more members.`,
                currentMembers: currentMemberCount,
                memberLimit: limits.memberLimit,
                plan: limits.plan
            });
        }

        const results = [];
        const existingMembers = await Member.find({ associationId }).populate('userId', 'phoneNumber email');
        
        // Normalize phone numbers for comparison
        const existingPhones = new Set(
            existingMembers
                .map(m => m.userId?.phoneNumber)
                .filter(Boolean)
                .map(phone => phone.replace(/\s+/g, "").substring(0, 20))
        );
        const existingEmails = new Set(existingMembers.map(m => m.userId?.email).filter(Boolean));

        for (const memberData of members) {
            const { name, email, phoneNumber, role = 'member' } = memberData;
            console.log('Processing member:', { name, email, phoneNumber, role });

            if (!name || (!email && !phoneNumber)) {
                console.log('Invalid member data:', { name, email, phoneNumber });
                results.push({ 
                    name, 
                    status: 'error', 
                    message: 'Name and either email or phone number required' 
                });
                continue;
            }

            // Check if already a member using normalized phone numbers
            const normalizedPhone = phoneNumber?.replace(/\s+/g, "").substring(0, 20);
            const isExisting = (normalizedPhone && existingPhones.has(normalizedPhone)) || 
                              (email && existingEmails.has(email));
            
            if (isExisting) {
                results.push({ 
                    name, 
                    status: 'exists', 
                    message: 'Already a member' 
                });
                continue;
            }

            try {
                // Find or create user
                let user = null;
                if (phoneNumber) {
                    user = await User.findOne({ phoneNumber });
                }
                if (!user && email) {
                    user = await User.findOne({ email });
                }

                if (!user) {
                    // Create temporary user
                    user = new User({
                        name,
                        email: email || undefined,
                        phoneNumber: phoneNumber || undefined,
                        status: 'temporary',
                        isVerified: false
                    });
                    await user.save();
                }

                // Create member record
                const member = new Member({
                    userId: user._id,
                    associationId,
                    status: 'active',
                    role: role || 'member'
                });

                await member.save();

                // Add to association members array
                association.members.push({
                    userId: user._id,
                    role: role || 'member',
                    joinedAt: new Date(),
                    isActive: true
                });
                
                // Broadcast real-time member update
                broadcastMemberUpdate(associationId, 'joined', {
                    id: member._id,
                    name: user.name,
                    role: member.role,
                    joinedAt: member.joinedAt
                });

                results.push({ 
                    name, 
                    status: 'added', 
                    message: 'Successfully added' 
                });

            } catch (error) {
                results.push({ 
                    name, 
                    status: 'error', 
                    message: 'Failed to add member' 
                });
            }
        }

        await association.save();

        console.log('Final results:', results);
        res.status(200).json({
            message: 'Members processing completed',
            results
        });

    } catch (error) {
        console.error('Add members error:', error);
        res.status(500).json({ message: 'Failed to add members' });
    }
};

// Get association members with existing status check
export const getAssociationMembers = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        // Check if user is member
        const userMember = await Member.findOne({ userId, associationId });
        if (!userMember) {
            return res.status(403).json({ message: 'Not a member of this association' });
        }

        const members = await Member.find({ associationId })
            .populate('userId', 'name email phoneNumber status')
            .sort({ joinedAt: -1 });

        const memberList = members.map(member => ({
            id: member._id,
            userId: member.userId?._id,
            name: member.userId?.name,
            email: member.userId?.email,
            phoneNumber: member.userId?.phoneNumber,
            role: member.role,
            status: member.status,
            userStatus: member.userId?.status,
            joinedAt: member.joinedAt
        }));

        res.status(200).json({ members: memberList });

    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ message: 'Failed to get members' });
    }
};

// Check if contacts are already members
export const checkExistingMembers = async (req: Request, res: Response) => {
    try {
        const { associationId, contacts } = req.body;
        const userId = req.user?.userId;

        if (!associationId || !contacts || !Array.isArray(contacts)) {
            return res.status(400).json({ message: 'Association ID and contacts array are required' });
        }

        // Check if user is admin or moderator
        const userMember = await Member.findOne({ 
            userId, 
            associationId,
            role: { $in: ['admin', 'moderator'] }
        });
        if (!userMember) {
            return res.status(403).json({ message: 'Only admins and moderators can manage members' });
        }
        
        // Also check association document
        const association = await Association.findById(associationId).populate('members.userId', 'name phoneNumber email');
        console.log('Association members array:', association?.members?.map((m: any) => ({
            userId: m.userId?._id,
            name: m.userId?.name,
            phone: m.userId?.phoneNumber,
            role: m.role
        })));

        const existingMembers = await Member.find({ associationId }).populate('userId', 'phoneNumber email name');
        
        console.log('=== DATABASE DEBUG ===');
        console.log('Association ID:', associationId);
        console.log('Found members count:', existingMembers.length);
        console.log('Raw member data:', existingMembers.map(m => ({
            memberId: m._id,
            userId: m.userId?._id,
            name: m.userId?.name,
            phone: m.userId?.phoneNumber,
            email: m.userId?.email
        })));
        
        // Normalize phone numbers for comparison (remove spaces and limit to 20 chars)
        const existingPhones = new Set(
            existingMembers
                .map(m => m.userId?.phoneNumber)
                .filter(Boolean)
                .map(phone => phone.replace(/\s+/g, "").substring(0, 20))
        );
        
        console.log('Normalized existing phones:', Array.from(existingPhones));
        console.log('Incoming contact phones:', contacts.map(c => c.phoneNumber));
        console.log('=== END DATABASE DEBUG ===');

        const contactStatus = contacts.map(contact => {
            const normalizedPhone = contact.phoneNumber?.substring(0, 20);
            const isExisting = normalizedPhone && existingPhones.has(normalizedPhone);

            console.log('Contact check:', {
                
                isExisting
            });
            
            // console.log(`Contact ${normalizedPhone}: isExisting = ${isExisting}`);
            
            return {
                ...contact,
                isExisting
            };
        });

        res.status(200).json({ contacts: contactStatus });

    } catch (error) {
        console.error('Check existing members error:', error);
        res.status(500).json({ message: 'Failed to check existing members' });
    }
};

export const getMemberDetails = async (req: Request, res: Response) => {
    try {
        const { memberId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const member = await Member.findById(memberId).populate('userId', 'name email phoneNumber');
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        // Check if user is admin/moderator or viewing their own details
        const userMember = await Member.findOne({ userId, associationId: member.associationId });
        const canView = userMember && (
            ['admin', 'moderator'].includes(userMember.role) || 
            userMember._id.toString() === memberId
        );
        
        if (!canView) {
            return res.status(403).json({ success: false, message: 'Not authorized to view member details' });
        }

        // Calculate real financial data
        const incomes = await Income.find({ sourceMember: memberId });
        const totalContributions = incomes.reduce((sum, income) => sum + income.amount, 0);
        const verifiedContributions = incomes.filter(i => i.isVerified).reduce((sum, income) => sum + income.amount, 0);
        const pendingContributions = incomes.filter(i => !i.isVerified).reduce((sum, income) => sum + income.amount, 0);
        
        // Get member dues information (use userId from member record)
        const memberDues = await MemberDue.find({ memberId: member.userId })
            .populate('associationId', 'name currency')
            .sort({ dueDate: -1 })
            .limit(10);
        
        console.log('Member dues found:', memberDues.length, 'for userId:', member.userId);
        
        const duesStats = {
            total: memberDues.length,
            paid: memberDues.filter(d => d.status === 'paid').length,
            pending: memberDues.filter(d => d.status === 'pending').length,
            overdue: memberDues.filter(d => d.status === 'overdue').length,
            totalAmount: memberDues.reduce((sum, due) => sum + due.amount, 0),
            paidAmount: memberDues.filter(d => d.status === 'paid').reduce((sum, due) => sum + (due.paidAmount || 0), 0)
        };
        
        // Get recent activity
        const recentIncomes = await Income.find({ sourceMember: memberId })
            .populate('recordedBy', 'name')
            .sort({ date: -1 })
            .limit(5);
        
        const lastActivity = recentIncomes.length > 0 ? recentIncomes[0].date : member.joinedAt;

        const memberData = {
            id: member._id,
            name: member.userId?.name,
            email: member.userId?.email,
            phoneNumber: member.userId?.phoneNumber,
            role: member.role,
            status: member.status,
            joinedAt: member.joinedAt,
            totalContributions,
            verifiedContributions,
            pendingContributions,
            totalExpenses: 0,
            balance: verifiedContributions,
            lastActivity,
            dues: {
                stats: duesStats,
                recent: memberDues.slice(0, 5).map(due => ({
                    id: due._id,
                    associationName: (due.associationId as any).name,
                    amount: due.amount,
                    dueDate: due.dueDate,
                    status: due.status,
                    paidDate: due.paidDate,
                    paidAmount: due.paidAmount,
                    currency: (due.associationId as any).currency || 'USD'
                }))
            },
            recentTransactions: recentIncomes.map(income => ({
                id: income._id,
                type: 'income',
                amount: income.amount,
                description: income.description,
                date: income.date,
                status: income.isVerified ? 'verified' : 'pending',
                recordedBy: income.recordedBy?.name
            }))
        };

        res.json({ success: true, member: memberData });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch member details' });
    }
};

export const updateMemberDetails = async (req: Request, res: Response) => {
    try {
        const { memberId } = req.params;
        const { name, email, phoneNumber, role, status } = req.body;
        const userId = req.user?.userId;

        console.log('Update member request:', { memberId, updates: req.body, userId });

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const member = await Member.findById(memberId).populate('userId');
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        // Check if user is admin or moderator
        const userMember = await Member.findOne({ 
            userId, 
            associationId: member.associationId,
            role: { $in: ['admin', 'moderator'] }
        });
        
        if (!userMember) {
            return res.status(403).json({ success: false, message: 'Only admins and moderators can manage members' });
        }

        // Update member role and status
        if (role) member.role = role;
        if (status) member.status = status;
        await member.save();

        // Update association members array
        if (role || status) {
            const updateFields: any = {};
            if (role) updateFields['members.$.role'] = role;
            if (status === 'suspended') updateFields['members.$.isActive'] = false;
            if (status === 'active') updateFields['members.$.isActive'] = true;
            
            if (Object.keys(updateFields).length > 0) {
                await Association.findOneAndUpdate(
                    { _id: member.associationId, 'members.userId': member.userId },
                    { $set: updateFields }
                );
            }
        }

        // Update user details
        if (member.userId) {
            if (name) member.userId.name = name;
            if (email) member.userId.email = email;
            if (phoneNumber) member.userId.phoneNumber = phoneNumber;
            await member.userId.save();
        }
        
        // Broadcast real-time member update
        if (role || status) {
            broadcastMemberUpdate(member.associationId.toString(), 'role_changed', {
                id: member._id,
                name: member.userId?.name,
                role: member.role,
                status: member.status
            });
        }

        res.json({ success: true, message: 'Member updated successfully' });
    } catch (error) {
        console.error('Update member error:', error);
        res.status(500).json({ success: false, message: 'Failed to update member' });
    }
};

export const getAssociationDetails = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // TODO: Implement actual association lookup from database
        const association = {
            id: associationId,
            name: 'Sample Association',
            description: 'A sample association for testing',
            type: 'school',
            city: 'New York',
            country: 'United States',
            currency: 'USD',
            establishedYear: '2020',
            principalName: 'John Smith',
            studentCapacity: '500',
            leaderName: '',
            populationSize: '',
            communityType: ''
        };

        res.json({ success: true, association });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch association details' });
    }
};

export const updateAssociation = async (req: Request, res: Response) => {
    try {
        const { associationId } = req.params;
        const updates = req.body;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // TODO: Implement actual association update in database
        console.log('Updating association:', { associationId, updates });

        res.json({ success: true, message: 'Association updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update association' });
    }
};

export const deleteMember = async (req: Request, res: Response) => {
    try {
        const { memberId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const member = await Member.findById(memberId);
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        // Check if user is admin
        const userMember = await Member.findOne({ 
            userId, 
            associationId: member.associationId,
            role: 'admin'
        });
        
        if (!userMember) {
            return res.status(403).json({ success: false, message: 'Only admins can remove members' });
        }

        // Remove from association members array
        await Association.findByIdAndUpdate(member.associationId, {
            $pull: { members: { userId: member.userId } }
        });

        // Delete member record
        await Member.findByIdAndDelete(memberId);

        res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
        console.error('Delete member error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove member' });
    }
};

export const getMemberStatement = async (req: Request, res: Response) => {
    try {
        const { memberId } = req.params;
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const member = await Member.findById(memberId).populate('userId', 'name email phoneNumber');
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        // Get incomes where this member is the source
        const incomes = await Income.find({ sourceMember: memberId })
            .populate('recordedBy', 'name')
            .sort({ date: -1 });

        // Get expenses (if any expense model exists with member reference)
        // For now, we'll just use incomes as the main transaction type
        
        const totalContributions = incomes.reduce((sum, income) => sum + income.amount, 0);
        const totalExpenses = 0; // No expenses for now
        const balance = totalContributions - totalExpenses;

        const transactions = incomes.map(income => ({
            id: income._id,
            type: 'income',
            amount: income.amount,
            description: income.description,
            date: income.date,
            category: income.category || income.type,
            status: income.isVerified ? 'completed' : 'pending'
        }));

        const statement = {
            member: {
                id: member._id,
                name: member.userId?.name,
                email: member.userId?.email,
                phoneNumber: member.userId?.phoneNumber,
                role: member.role,
                joinedAt: member.joinedAt
            },
            summary: {
                totalContributions,
                totalExpenses,
                balance
            },
            transactions
        };

        res.json({ success: true, statement });
    } catch (error) {
        console.error('Get member statement error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch member statement' });
    }
};

