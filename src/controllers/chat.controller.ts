import { Request, Response } from 'express';
import { Chat, Message } from '../models/chat.models';
import User from '../models/user.models';
import { broadcastChatMessage, emitToAssociation } from '../sockets';

// Get messages for association chat (simplified for group chat)
export const getAssociationMessages = async (req: Request, res: Response) => {
  try {
    console.log('🔍 GET messages request:', { params: req.params, userId: req.user?.userId });
    
    const { associationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.userId;

    if (!userId) {
      console.log('❌ No userId in GET request');
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Get or create default group chat
    let defaultChat = await Chat.findOne({
      associationId,
      type: 'group',
      name: 'General Chat'
    });

    console.log('💬 Default chat found:', defaultChat ? 'Yes' : 'No');

    if (!defaultChat) {
      defaultChat = new Chat({
        associationId,
        type: 'group',
        name: 'General Chat',
        participants: [{ userId, role: 'admin', joinedAt: new Date() }]
      });
      await defaultChat.save();
      console.log('✅ Created new default chat');
    }

    // Get messages for this chat
    const messages = await Message.find({ chatId: defaultChat._id })
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    console.log('📨 Raw messages found:', messages.length);

    // Format messages for frontend
    const formattedMessages = messages.reverse().map(msg => ({
      id: msg._id, // Convert ObjectId to string
      associationId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      text: msg.content, // Map content to text
      timestamp: msg.timestamp,
      isEdited: msg.edited || false,
      replyTo: msg.replyTo
    }));

    console.log('📤 Formatted messages:', formattedMessages);
    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

// Send message to association chat
export const sendAssociationMessage = async (req: Request, res: Response) => {
  try {
    console.log('📝 Send message request:', { params: req.params, body: req.body, userId: req.user?.userId });
    
    const { associationId } = req.params;
    const { text, replyTo } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      console.log('❌ No userId in request');
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (!text || text.trim().length === 0) {
      console.log('❌ No text provided');
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    // Get user name from database
    console.log('🔍 Fetching user:', userId);
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const userName = user.name;
    console.log('✅ User found:', userName);

    // Get or create default group chat
    let defaultChat = await Chat.findOne({
      associationId,
      type: 'group',
      name: 'General Chat'
    });

    if (!defaultChat) {
      defaultChat = new Chat({
        associationId,
        type: 'group',
        name: 'General Chat',
        participants: [{ userId, role: 'admin', joinedAt: new Date() }]
      });
      await defaultChat.save();
    }

    // Add user to chat if not already a participant
    const isParticipant = defaultChat.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      defaultChat.participants.push({ userId, role: 'member', joinedAt: new Date() });
      await defaultChat.save();
    }

    const message = new Message({
      chatId: defaultChat._id,
      senderId: userId,
      senderName: userName,
      content: text.trim(),
      messageType: 'text',
      replyTo: replyTo || undefined,
      readBy: [{ userId, readAt: new Date() }]
    });

    await message.save();

    // Update chat's last message
    await Chat.findByIdAndUpdate(defaultChat._id, {
      lastMessage: {
        content: text.trim(),
        senderId: userId,
        timestamp: new Date()
      },
      updatedAt: new Date()
    });

    const messageData = {
      id: message._id, // Convert ObjectId to string
      associationId,
      senderId: userId,
      senderName: userName,
      text: text.trim(),
      timestamp: message.timestamp,
      isEdited: false,
      replyTo: replyTo || undefined
    };

    console.log('📤 Sending message data:', messageData);

    // Broadcast to all users in association
    broadcastChatMessage(associationId, messageData);

    res.status(201).json(messageData);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// Delete message
export const deleteAssociationMessage = async (req: Request, res: Response) => {
  try {
    const { associationId, messageId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const message = await Message.findOne({
      _id: messageId,
      senderId: userId
    });

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found or unauthorized' });
    }

    await Message.findByIdAndDelete(messageId);

    // Broadcast deletion to all users in association
    emitToAssociation(associationId, 'message_deleted', {
      type: 'MESSAGE_DELETED',
      payload: { associationId, messageId }
    });

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
};

export const getOrCreateDefaultChat = async (req: Request, res: Response) => {
  try {
    const { associationId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    let defaultChat = await Chat.findOne({
      associationId,
      type: 'group',
      name: 'General Chat'
    });

    if (!defaultChat) {
      defaultChat = new Chat({
        associationId,
        type: 'group',
        name: 'General Chat',
        participants: [{ userId, role: 'admin', joinedAt: new Date() }]
      });
      await defaultChat.save();
    } else {
      // Add user to chat if not already a participant
      const isParticipant = defaultChat.participants.some(p => p.userId === userId);
      if (!isParticipant) {
        defaultChat.participants.push({ userId, role: 'member', joinedAt: new Date() });
        await defaultChat.save();
      }
    }

    res.json({ success: true, chat: defaultChat });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get default chat' });
  }
};

export const getAssociationChats = async (req: Request, res: Response) => {
  try {
    const { associationId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Check if default group chat exists, create if not
    let defaultChat = await Chat.findOne({
      associationId,
      type: 'group',
      name: 'General Chat'
    });

    if (!defaultChat) {
      defaultChat = new Chat({
        associationId,
        type: 'group',
        name: 'General Chat',
        participants: [{ userId, role: 'admin', joinedAt: new Date() }]
      });
      await defaultChat.save();
    }

    const chats = await Chat.find({
      associationId,
      'participants.userId': userId
    }).sort({ updatedAt: -1 });

    res.json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch chats' });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { chatId, content, messageType = 'text', replyTo } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Get user name from database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const userName = user.name;

    const message = new Message({
      chatId,
      senderId: userId,
      senderName: userName,
      content,
      messageType,
      replyTo,
      readBy: [{ userId, readAt: new Date() }]
    });

    await message.save();

    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: {
        content,
        senderId: userId,
        timestamp: new Date()
      },
      updatedAt: new Date()
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

export const getChatMessages = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({ chatId })
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

export const markMessageAsRead = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    await Message.findByIdAndUpdate(messageId, {
      $addToSet: {
        readBy: { userId, readAt: new Date() }
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

export const createDirectChat = async (req: Request, res: Response) => {
  try {
    const { associationId, participantId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Check if direct chat already exists
    const existingChat = await Chat.findOne({
      associationId,
      type: 'direct',
      'participants.userId': { $all: [userId, participantId] }
    });

    if (existingChat) {
      return res.json({ success: true, chat: existingChat });
    }

    const chat = new Chat({
      associationId,
      type: 'direct',
      participants: [
        { userId, role: 'member', joinedAt: new Date() },
        { userId: participantId, role: 'member', joinedAt: new Date() }
      ]
    });

    await chat.save();
    res.status(201).json({ success: true, chat });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create direct chat' });
  }
};