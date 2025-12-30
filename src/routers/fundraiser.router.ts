import { Router } from 'express';
import { FundraiserController } from '../controllers/fundraiser.controller';
import { authenticateToken } from '../libs/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Create fundraiser for association
router.post('/:associationId', FundraiserController.createFundraiser);

// Get active fundraisers for association
router.get('/:associationId/active', FundraiserController.getActiveFundraisers);

// Get all fundraisers for association (with pagination and filtering)
router.get('/:associationId/all', FundraiserController.getAllFundraisers);

// Get fundraiser details
router.get('/details/:fundraiserId', FundraiserController.getFundraiserDetails);

// Contribute to fundraiser
router.post('/:fundraiserId/contribute', FundraiserController.contributeFundraiser);

// Update fundraiser
router.put('/details/:fundraiserId', FundraiserController.updateFundraiser);

// Delete fundraiser
router.delete('/details/:fundraiserId', FundraiserController.deleteFundraiser);

export default router;