import { Router } from 'express';
import { authenticateToken } from '../libs/middleware/auth.middleware';
import {
    createAssociation,
    joinAssociation,
    getUserAssociations,
    searchAssociations,
    updateAssociation,
    updateAssociationSettings,
    getAssociationSettings,
    getDashboardData,
    getPendingRequests,
    approveMemberRequest,
    rejectMemberRequest
} from '../controllers/association.controller';
import {
    getMemberDues,
    markDueAsPaid,
    generateDues,
    payDue,
    verifyDuesPayment,
    getMemberDuesDetails,
    sendPaymentReminder
} from '../controllers/dues.controller';

const router = Router();

// Public route to search associations
router.get('/search', searchAssociations);

// All routes require authentication
router.use(authenticateToken);

router.post('/create', createAssociation);
router.post('/join', joinAssociation);
router.get('/my-associations', getUserAssociations);
router.put('/:associationId', updateAssociation);
router.get('/:associationId/settings', getAssociationSettings);
router.put('/:associationId/settings', updateAssociationSettings);
router.get('/:associationId/dashboard', getDashboardData);
router.get('/:associationId/pending-requests', getPendingRequests);
router.post('/:associationId/approve/:memberId', approveMemberRequest);
router.delete('/:associationId/reject/:memberId', rejectMemberRequest);

// Dues routes
router.get('/:associationId/dues', getMemberDues as any);
router.post('/:associationId/dues/generate', generateDues as any);
router.put('/dues/:dueId/mark-paid', markDueAsPaid as any);
router.post('/:associationId/dues/:memberId/pay', payDue as any);
router.post('/:associationId/dues/:memberId/remind', sendPaymentReminder as any);
router.get('/dues/verify/:reference', verifyDuesPayment as any);
router.get('/dues/member/:memberId', getMemberDuesDetails as any);

export default router;