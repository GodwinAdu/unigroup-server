import { Document, model, models, Schema } from "mongoose";

export interface IExpenseType extends Document {
    associationId: Schema.Types.ObjectId;
    name: string;
    description?: string;
    isActive: boolean;
    createdBy: Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ExpenseTypeSchema = new Schema({
    associationId: {
        type: Schema.Types.ObjectId,
        ref: 'Association',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Ensure unique expense type names per association
ExpenseTypeSchema.index({ associationId: 1, name: 1 }, { unique: true });

const ExpenseType = models.ExpenseType ?? model<IExpenseType>("ExpenseType", ExpenseTypeSchema);
export default ExpenseType;