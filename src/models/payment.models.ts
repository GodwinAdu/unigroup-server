import { Document, model, models, Schema } from "mongoose";

export interface IPayment extends Document {
    associationId: Schema.Types.ObjectId;
    payerId: Schema.Types.ObjectId;
    amount: number;
    purpose: 'dues' | 'donation' | 'event' | 'other';
    description: string;
    paystackReference: string;
    status: 'pending' | 'successful' | 'failed';
    platformFee: number; // Our 2-3% fee
    associationAmount: number; // Amount after our fee
    transferStatus: 'pending' | 'transferred' | 'failed';
    transferReference?: string;
    transferDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PaymentSchema = new Schema({
    associationId: {
        type: Schema.Types.ObjectId,
        ref: 'Association',
        required: true
    },
    payerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    purpose: {
        type: String,
        enum: ['dues', 'donation', 'event', 'other'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    paystackReference: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['pending', 'successful', 'failed'],
        default: 'pending'
    },
    platformFee: {
        type: Number,
        required: true
    },
    associationAmount: {
        type: Number,
        required: true
    },
    transferStatus: {
        type: String,
        enum: ['pending', 'transferred', 'failed'],
        default: 'pending'
    },
    transferReference: {
        type: String
    },
    transferDate: {
        type: Date
    }
}, {
    timestamps: true
});

const Payment = models.Payment ?? model<IPayment>("Payment", PaymentSchema);
export default Payment;