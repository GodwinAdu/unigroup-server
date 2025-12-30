import { Document, model, models, Schema } from "mongoose";

export interface IExpense extends Document {
    associationId: Schema.Types.ObjectId;
    category:string;
    amount: number;
    description: string;
    vendor?: string;
    paymentMethod?: 'cash' | 'bank' | 'mobile' | 'other';
    recordedBy: Schema.Types.ObjectId;
    approvedBy?: Schema.Types.ObjectId;
    date: Date;
    isApproved: boolean;
    receipt?: string; // File path or URL
    createdAt: Date;
    updatedAt: Date;
}

const ExpenseSchema = new Schema({
    associationId: {
        type: Schema.Types.ObjectId,
        ref: 'Association',
        required: true
    },
    category: {
        type: String,
        required: true
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
    vendor: {
        type: String,
        trim: true
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
    approvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    date: {
        type: Date,
        default: Date.now
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    receipt: {
        type: String
    }
}, {
    timestamps: true
});

const Expense = models.Expense ?? model<IExpense>("Expense", ExpenseSchema);
export default Expense;