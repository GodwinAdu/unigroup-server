import express from 'express';

import {
  getOrCreateDefaultChat,
  getAssociationChats,
  sendMessage,
  getChatMessages,
  markMessageAsRead,
  createDirectChat,
  getAssociationMessages,
  sendAssociationMessage,
  deleteAssociationMessage
} from '../controllers/chat.controller';
import { authenticateToken } from '../libs/middleware/auth.middleware';

const router = express.Router();

router.use(authenticateToken);

// Association chat routes (for frontend integration)
router.get('/:associationId/chat/messages', getAssociationMessages);
router.post('/:associationId/chat/messages', sendAssociationMessage);
router.delete('/:associationId/chat/messages/:messageId', deleteAssociationMessage);

// Legacy routes (keep for backward compatibility)
router.get('/default/:associationId', getOrCreateDefaultChat);
router.post('/direct', createDirectChat);
router.get('/association/:associationId', getAssociationChats);
router.post('/message', sendMessage);
router.get('/:chatId/messages', getChatMessages);
router.put('/message/:messageId/read', markMessageAsRead);

export default router;