import { Request, Response } from 'express';
import { Notification, Association, Member } from '../models';
import { getIO } from '../sockets';

// Get user notifications
export const getUserNotifications = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { page = 1, limit = 20 } = req.query;
        
        console.log(`🔔 Getting notifications for user: ${userId}`);

        const notifications = await Notification.find({ userId })
            .populate('associationId', 'name')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
            
        console.log(`📧 Found ${notifications.length} notifications for user ${userId}`);
        
        if (notifications.length > 0) {
            console.log('📝 First notification:', {
                id: notifications[0]._id,
                type: notifications[0].type,
                title: notifications[0].title,
                userId: notifications[0].userId
            });
        }

        const unreadCount = await Notification.countDocuments({ userId, isRead: false });
        console.log(`🔴 Unread count: ${unreadCount}`);
        
        const response = {
            notifications: notifications.map(notif => ({
                id: notif._id,
                type: notif.type,
                title: notif.title,
                message: notif.message,
                associationName: notif.associationId?.name,
                isRead: notif.isRead,
                createdAt: notif.createdAt,
                data: notif.data
            })),
            unreadCount
        };
        
        console.log(`✅ Sending ${response.notifications.length} notifications to frontend`);
        res.status(200).json(response);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ message: 'Failed to get notifications' });
    }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user?.userId;

        await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { isRead: true }
        );

        res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ message: 'Failed to mark notification as read' });
    }
};

// Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;

        await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );

        res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
};

// Create notification helper function
export const createNotification = async (
    userId: string,
    associationId: string,
    type: string,
    title: string,
    message: string,
    data?: any
) => {
    try {
        console.log(`📝 Creating notification for user ${userId}:`, { type, title, message });
        
        const notification = new Notification({
            userId,
            associationId,
            type,
            title,
            message,
            data
        });
        
        const savedNotification = await notification.save();
        console.log(`✅ Notification saved with ID: ${savedNotification._id}`);
        
        // Emit real-time notification via WebSocket
        try {
            const io = getIO();
            io.to(`user_${userId}`).emit('new_notification', {
                id: savedNotification._id,
                type: savedNotification.type,
                title: savedNotification.title,
                message: savedNotification.message,
                createdAt: savedNotification.createdAt,
                isRead: false
            });
            console.log(`📡 WebSocket notification sent to user ${userId}`);
        } catch (socketError) {
            console.error('WebSocket notification error:', socketError);
        }
        
        return savedNotification;
    } catch (error) {
        console.error('Create notification error:', error);
        return null;
    }
};

// Send notification to association members based on their settings
export const sendAssociationNotification = async (
    associationId: string,
    type: string,
    title: string,
    message: string,
    data?: any,
    excludeUserId?: string
) => {
    try {
        console.log(`📧 Starting notification process for ${type} in association ${associationId}`);
        
        const association = await Association.findById(associationId);
        if (!association) {
            console.log(`⚠️ Association ${associationId} not found`);
            return;
        }
        
        console.log(`🏢 Association found: ${association.name}`);
        console.log(`🔔 Notification settings:`, association.settings.notifications);

        const members = await Member.find({ 
            associationId, 
            status: 'active',
            ...(excludeUserId && { userId: { $ne: excludeUserId } })
        });
        
        console.log(`👥 Found ${members.length} active members`);
        if (excludeUserId) {
            console.log(`🚫 Excluding user: ${excludeUserId}`);
        }

        for (const member of members) {
            console.log(`👤 Processing member: ${member.userId}`);
            
            // Check if user has this notification type enabled
            let notificationKey: keyof typeof association.settings.notifications;
            
            // Map notification types to association settings keys
            switch (type) {
                case 'income_recorded':
                    notificationKey = 'incomeRecorded';
                    break;
                case 'expense_recorded':
                    notificationKey = 'expenseRecorded';
                    break;
                case 'new_member':
                    notificationKey = 'newMembers';
                    break;
                case 'member_request':
                    notificationKey = 'memberRequests';
                    break;
                case 'financial_update':
                    notificationKey = 'financialUpdates';
                    break;
                case 'fundraiser_contribution':
                case 'fundraiser_goal_reached':
                    notificationKey = 'financialUpdates'; // Use financial updates setting for fundraiser notifications
                    break;
                default:
                    notificationKey = 'systemUpdates';
            }
            
            console.log(`🔑 Checking notification key: ${notificationKey} = ${association.settings.notifications[notificationKey]}`);
            
            if (association.settings.notifications[notificationKey]) {
                const notification = await createNotification(
                    member.userId.toString(),
                    associationId,
                    type,
                    title,
                    message,
                    data
                );
                console.log(`✅ Notification created for user ${member.userId}:`, notification?._id);
            } else {
                console.log(`🔕 Notification ${type} (${notificationKey}) disabled for association ${associationId}`);
            }
        }
        
        console.log(`🏁 Notification process completed for ${type}`);
    } catch (error) {
        console.error('Send association notification error:', error);
    }
};