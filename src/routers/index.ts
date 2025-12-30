import { Router } from 'express';
import authRoutes from './auth.routes';
import associationRoutes from './association.routes';
import memberRoutes from './member.routes';
import notificationRoutes from './notification.router';
import chatRoutes from './chat.routes';
import expenseTypeRoutes from './expenseType.routes';
import expenseRoutes from './expense.routes';
import incomeTypeRoutes from './incomeType.routes';
import incomeRoutes from './income.routes';
import subscriptionRoutes from './subscription.routes';
import paymentAccountRoutes from './paymentAccount.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';
import twoFactorRoutes from './twoFactor.routes';
import analyticsRoutes from './analytics.routes';
import settlementRoutes from './settlement.routes';
import fundraiserRoutes from './fundraiser.router';

const router = Router();

// API routes
router.use('/auth', authRoutes);
router.use('/associations', associationRoutes);
router.use('/associations', chatRoutes); // Mount chat routes under associations
router.use('/members', memberRoutes);
router.use('/notifications', notificationRoutes);
router.use('/chat', chatRoutes); // Keep legacy chat routes
router.use('/expense-types', expenseTypeRoutes);
router.use('/expenses', expenseRoutes);
router.use('/income-types', incomeTypeRoutes);
router.use('/incomes', incomeRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/payment-accounts', paymentAccountRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/2fa', twoFactorRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settlements', settlementRoutes);
router.use('/fundraisers', fundraiserRoutes);

export default router;