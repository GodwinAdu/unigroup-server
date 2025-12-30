import { Document, model, models, Schema } from "mongoose";

export interface IIncome extends Document {
    associationId: Schema.Types.ObjectId;
    type: 'dues' | 'donation' | 'event' | 'other';
    category?: string;
    amount: number;
    description: string;
    source?: string; // Who paid
    sourceMember?: Schema.Types.ObjectId; // Reference to member who paid
    paymentMethod?: 'cash' | 'bank' | 'mobile' | 'other';
    recordedBy: Schema.Types.ObjectId;
    date: Date;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const IncomeSchema = new Schema({
    associationId: {
        type: Schema.Types.ObjectId,
        ref: 'Association',
        required: true
    },
    type: {
        type: String,
        enum: ['dues', 'donation', 'event', 'other'],
        required: true
    },
    category: {
        type: String,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    source: {
        type: String,
        trim: true
    },
    sourceMember: {
        type: Schema.Types.ObjectId,
        ref: 'Member'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank', 'mobile', 'other']
    },
    recordedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    isVerified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const Income = models.Income ?? model<IIncome>("Income", IncomeSchema);
export default Income;