import { Document, model, models, Schema } from "mongoose";

export interface IPaymentAccount extends Document {
    associationId: Schema.Types.ObjectId;
    accountType: 'bank' | 'momo';
    accountNumber: string;
    accountName: string;
    bankCode?: string;
    bankName?: string;
    momoProvider?: 'mtn' | 'vodafone' | 'airtel';
    paystackSubaccountCode?: string;
    settlementSchedule: 'daily' | 'weekly' | 'monthly';
    minimumSettlement: number;
    pendingBalance: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const PaymentAccountSchema = new Schema({
    associationId: {
        type: Schema.Types.ObjectId,
        ref: 'Association',
        required: true
    },
    accountType: {
        type: String,
        enum: ['bank', 'momo'],
        required: true
    },
    accountNumber: {
        type: String,
        required: true
    },
    accountName: {
        type: String,
        required: true
    },
    bankCode: {
        type: String
    },
    bankName: {
        type: String
    },
    momoProvider: {
        type: String,
        enum: ['mtn', 'vodafone', 'airtel']
    },
    paystackSubaccountCode: {
        type: String
    },
    settlementSchedule: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'weekly'
    },
    minimumSettlement: {
        type: Number,
        default: 1000 // Minimum amount before settlement
    },
    pendingBalance: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const PaymentAccount = models.PaymentAccount ?? model<IPaymentAccount>("PaymentAccount", PaymentAccountSchema);
export default PaymentAccount;