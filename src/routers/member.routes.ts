import { Router } from "express";
import { addMembers, getAssociationMembers, checkExistingMembers, getMemberDetails, updateMemberDetails, deleteMember, getAssociationDetails, updateAssociation, getMemberStatement, } from "../controllers/member.controller";
import { authenticateToken } from "../libs/middleware/auth.middleware";

const router = Router();

// Test endpoint without auth
router.get("/test", (req, res) => {
    res.json({ message: "Member routes working!" });
});

router.post("/add-members", authenticateToken, addMembers);
router.get("/:associationId/members", authenticateToken, getAssociationMembers);
router.post("/check-existing", authenticateToken, checkExistingMembers);
router.get("/details/:memberId", authenticateToken, getMemberDetails);
router.put("/details/:memberId", authenticateToken, updateMemberDetails);
router.delete("/details/:memberId", authenticateToken, deleteMember);
router.get("/association/:associationId", authenticateToken, getAssociationDetails);
router.put("/association/:associationId", authenticateToken, updateAssociation);
router.get("/statement/:memberId", authenticateToken, getMemberStatement);


export default router;