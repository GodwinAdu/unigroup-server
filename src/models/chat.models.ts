import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  timestamp: Date;
  readBy: Array<{
    userId: string;
    readAt: Date;
  }>;
  replyTo?: string;
  edited?: boolean;
  editedAt?: Date;
}

export interface IChat extends Document {
  associationId: string;
  type: 'group' | 'direct';
  name?: string;
  participants: Array<{
    userId: string;
    role: 'admin' | 'member';
    joinedAt: Date;
    lastSeen?: Date;
  }>;
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  chatId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  messageType: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
  timestamp: { type: Date, default: Date.now },
  readBy: [{
    userId: { type: String, required: true },
    readAt: { type: Date, default: Date.now }
  }],
  replyTo: { type: String },
  edited: { type: Boolean, default: false },
  editedAt: { type: Date }
});

const ChatSchema = new Schema<IChat>({
  associationId: { type: String, required: true, index: true },
  type: { type: String, enum: ['group', 'direct'], required: true },
  name: { type: String },
  participants: [{
    userId: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    lastSeen: { type: Date }
  }],
  lastMessage: {
    content: { type: String },
    senderId: { type: String },
    timestamp: { type: Date }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
export const Chat = mongoose.model<IChat>('Chat', ChatSchema);