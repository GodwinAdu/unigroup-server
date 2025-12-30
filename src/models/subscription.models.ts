import { Document, model, models, Schema } from "mongoose";

export interface ISubscription extends Document {
    associationId: Schema.Types.ObjectId;
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired';
    startDate: Date;
    endDate: Date;
    memberLimit: number;
    features: string[];
    paymentReference?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SubscriptionSchema = new Schema({
    associationId: {
        type: Schema.Types.ObjectId,
        ref: 'Association',
        required: true,
        unique: true
    },
    plan: {
        type: String,
        enum: ['free', 'pro', 'enterprise'],
        default: 'free'
    },
    status: {
        type: String,
        enum: ['active', 'cancelled', 'expired'],
        default: 'active'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    memberLimit: {
        type: Number,
        default: 50
    },
    features: [{
        type: String
    }],
    paymentReference: {
        type: String
    }
}, {
    timestamps: true
});

const Subscription = models.Subscription ?? model<ISubscription>("Subscription", SubscriptionSchema);
export default Subscription;