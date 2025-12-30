import { Document, model, models, Schema } from "mongoose";

export interface IIncomeType extends Document {
    associationId: Schema.Types.ObjectId;
    name: string;
    description?: string;
    isActive: boolean;
    createdBy: Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const IncomeTypeSchema = new Schema({
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

IncomeTypeSchema.index({ associationId: 1, name: 1 }, { unique: true });

const IncomeType = models.IncomeType ?? model<IIncomeType>("IncomeType", IncomeTypeSchema);
export default IncomeType;