import { Request, Response } from 'express';
import { User, Member, Notification, Income, Expense } from '../models';
import { AnalyticsEvent } from '../models/analytics.models';
import { Chat, Message } from '../models/chat.models';

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`🗑️ Starting account deletion for user: ${userId}`);

    // Delete all user data in parallel
    await Promise.all([
      // Delete analytics data
      AnalyticsEvent.deleteMany({ userId }),
      
      // Delete notifications
      Notification.deleteMany({ userId }),
      
      // Delete chat messages sent by user
      Message.deleteMany({ senderId: userId }),
      
      // Delete member records
      Member.deleteMany({ userId }),
      
      // Delete income records created by user
      Income.deleteMany({ createdBy: userId }),
      
      // Delete expense records created by user
      Expense.deleteMany({ createdBy: userId })
    ]);

    // Remove user from chat participants
    await Chat.updateMany(
      { participants: userId },
      { $pull: { participants: userId } }
    );

    // Delete user account
    await User.findByIdAndDelete(userId);

    console.log(`✅ Account and all data deleted for user: ${userId}`);
    res.status(200).json({ message: 'Account and all associated data deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};