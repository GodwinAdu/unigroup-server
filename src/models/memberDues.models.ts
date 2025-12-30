import { Document, model, models, Schema } from "mongoose";

export interface IMemberDue extends Document {
    associationId: Schema.Types.ObjectId;
    memberId: Schema.Types.ObjectId;
    amount: number;
    dueDate: Date;
    status: 'pending' | 'paid' | 'overdue';
    paidDate?: Date;
    paidAmount?: number;
    paymentMethod?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const MemberDueSchema = new Schema({
    associationId: {
        type: Schema.Types.ObjectId,
        ref: 'Association',
        required: true
    },
    memberId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    dueDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'overdue'],
        default: 'pending'
    },
    paidDate: {
        type: Date
    },
    paidAmount: {
        type: Number,
        min: 0
    },
    paymentMethod: {
        type: String
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
MemberDueSchema.index({ associationId: 1, memberId: 1, dueDate: 1 });
MemberDueSchema.index({ associationId: 1, status: 1 });

const MemberDue = models.MemberDue ?? model<IMemberDue>("MemberDue", MemberDueSchema);

export default MemberDue;