import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

let ioInstance: Server;

export const getIO = (): Server => {
    if (!ioInstance) {
        throw new Error('Socket.IO not initialized');
    }
    return ioInstance;
};

interface AuthenticatedSocket extends Socket {
    userId?: string;
    associationId?: string;
    isTyping?: boolean;
    lastSeen?: Date;
}

// Track online users
const onlineUsers = new Map<string, { socketId: string; associationId?: string; lastSeen: Date }>();

export const initializeSocket = (io: Server) => {
    ioInstance = io;
    // Authentication middleware for Socket.IO
    io.use((socket: AuthenticatedSocket, next) => {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`🔌 User ${socket.userId} connected`);
        
        // Track online user
        if (socket.userId) {
            onlineUsers.set(socket.userId, {
                socketId: socket.id,
                lastSeen: new Date()
            });
            
            socket.join(`user_${socket.userId}`);
            console.log(`🔔 User ${socket.userId} joined notification room`);
        }

        // Join association room
        socket.on('join-association', (associationId: string) => {
            socket.associationId = associationId;
            socket.join(`association-${associationId}`);
            
            // Update user's association
            if (socket.userId) {
                const user = onlineUsers.get(socket.userId);
                if (user) {
                    user.associationId = associationId;
                }
                
                // Notify association of user joining
                socket.to(`association-${associationId}`).emit('user_joined', {
                    userId: socket.userId,
                    timestamp: new Date()
                });
            }
            
            console.log(`🏢 User ${socket.userId} joined association ${associationId}`);
        });

        // Chat-specific room joining
        socket.on('JOIN_CHAT', (data: { payload: { associationId: string } }) => {
            const { associationId } = data.payload;
            socket.associationId = associationId;
            socket.join(`association-${associationId}`);
            
            console.log(`💬 User ${socket.userId} joined chat room: association-${associationId}`);
        });

        socket.on('LEAVE_CHAT', (data: { payload: { associationId: string } }) => {
            const { associationId } = data.payload;
            socket.leave(`association-${associationId}`);
            
            console.log(`💬 User ${socket.userId} left chat room: association-${associationId}`);
        });

        // Leave association room
        socket.on('leave-association', (associationId: string) => {
            socket.leave(`association-${associationId}`);
            
            // Notify association of user leaving
            if (socket.userId) {
                socket.to(`association-${associationId}`).emit('user_left', {
                    userId: socket.userId,
                    timestamp: new Date()
                });
            }
            
            console.log(`User ${socket.userId} left association ${associationId}`);
        });

        // Chat events
        socket.on('typing_start', (data: { chatId: string; associationId: string }) => {
            socket.isTyping = true;
            socket.to(`association-${data.associationId}`).emit('user_typing', {
                userId: socket.userId,
                chatId: data.chatId,
                isTyping: true
            });
        });

        socket.on('typing_stop', (data: { chatId: string; associationId: string }) => {
            socket.isTyping = false;
            socket.to(`association-${data.associationId}`).emit('user_typing', {
                userId: socket.userId,
                chatId: data.chatId,
                isTyping: false
            });
        });

        // Update last seen
        socket.on('update_presence', () => {
            if (socket.userId) {
                const user = onlineUsers.get(socket.userId);
                if (user) {
                    user.lastSeen = new Date();
                }
            }
        });

        socket.on('disconnect', () => {
            console.log(`🔌 User ${socket.userId} disconnected`);
            
            // Remove from online users
            if (socket.userId) {
                onlineUsers.delete(socket.userId);
                
                // Notify association of user going offline
                if (socket.associationId) {
                    socket.to(`association-${socket.associationId}`).emit('user_offline', {
                        userId: socket.userId,
                        timestamp: new Date()
                    });
                }
            }
        });
    });
};

// Helper functions for real-time events
export const emitToAssociation = (associationId: string, event: string, data: any) => {
    const io = getIO();
    io.to(`association-${associationId}`).emit(event, data);
    console.log(`📡 Emitted ${event} to association ${associationId}`);
};

export const emitToUser = (userId: string, event: string, data: any) => {
    const io = getIO();
    io.to(`user_${userId}`).emit(event, data);
    console.log(`📡 Emitted ${event} to user ${userId}`);
};

// Financial updates
export const broadcastFinancialUpdate = (associationId: string, type: 'income' | 'expense', data: any) => {
    emitToAssociation(associationId, 'financial_update', {
        type,
        data,
        timestamp: new Date()
    });
};

// Member management
export const broadcastMemberUpdate = (associationId: string, type: 'joined' | 'left' | 'role_changed' | 'status_changed', data: any) => {
    emitToAssociation(associationId, 'member_update', {
        type,
        data,
        timestamp: new Date()
    });
};

// Chat messages
export const broadcastChatMessage = (associationId: string, message: any) => {
    emitToAssociation(associationId, 'NEW_MESSAGE', {
        type: 'NEW_MESSAGE',
        payload: message
    });
};

// Message deletion
export const broadcastMessageDeletion = (associationId: string, messageId: string) => {
    emitToAssociation(associationId, 'MESSAGE_DELETED', {
        type: 'MESSAGE_DELETED',
        payload: { associationId, messageId }
    });
};

// Settings changes
export const broadcastSettingsChange = (associationId: string, settingType: string, data: any) => {
    emitToAssociation(associationId, 'settings_changed', {
        settingType,
        data,
        timestamp: new Date()
    });
};

// Dashboard updates
export const broadcastDashboardUpdate = (associationId: string, data: any) => {
    emitToAssociation(associationId, 'dashboard_update', {
        data,
        timestamp: new Date()
    });
};

// Fundraiser updates
export const broadcastFundraiserUpdate = (associationId: string, type: 'contribution' | 'goal_reached' | 'created' | 'updated', data: any) => {
    emitToAssociation(associationId, 'fundraiser_update', {
        type,
        data,
        timestamp: new Date()
    });
};

// Payment updates
export const broadcastPaymentUpdate = (associationId: string, type: 'initiated' | 'completed' | 'failed', data: any) => {
    emitToAssociation(associationId, 'payment_update', {
        type,
        data,
        timestamp: new Date()
    });
};
// Get online users
export const getOnlineUsers = () => {
    return Array.from(onlineUsers.entries()).map(([userId, info]) => ({
        userId,
        ...info
    }));
};

export const getAssociationOnlineUsers = (associationId: string) => {
    return Array.from(onlineUsers.entries())
        .filter(([_, info]) => info.associationId === associationId)
        .map(([userId, info]) => ({
            userId,
            ...info
        }));
};