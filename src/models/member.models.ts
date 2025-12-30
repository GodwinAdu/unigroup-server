import { Document, model, models, Schema } from "mongoose";

export interface IMember extends Document {
    userId: Schema.Types.ObjectId;
    associationId: Schema.Types.ObjectId;
    membershipNumber?: string;
    status: 'active' | 'inactive' | 'suspended' | 'pending';
    role: 'admin' | 'moderator' | 'treasurer' | 'secretary' | 'member';
    joinedAt: Date;
    lastPayment?: Date;
    duesStatus: 'current' | 'overdue' | 'exempt';
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const MemberSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    associationId: {
        type: Schema.Types.ObjectId,
        ref: 'Association',
        required: true
    },
    membershipNumber: {
        type: String,
        sparse: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending'],
        default: 'pending'
    },
    role: {
        type: String,
        enum: ['admin', 'moderator', 'treasurer', 'secretary', 'member'],
        default: 'member'
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    lastPayment: {
        type: Date
    },
    duesStatus: {
        type: String,
        enum: ['current', 'overdue', 'exempt'],
        default: 'overdue'
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Compound index for unique user-association pairs
MemberSchema.index({ userId: 1, associationId: 1 }, { unique: true });

const Member = models.Member ?? model<IMember>("Member", MemberSchema);
export default Member;