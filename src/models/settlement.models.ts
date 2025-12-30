import mongoose, { Schema, Document } from 'mongoose';

export interface ISettlement extends Document {
  associationId: mongoose.Types.ObjectId;
  month: string;
  year: number;
  totalCollected: number;
  platformFee: number;
  platformFeePercentage: number;
  netAmount: number;
  status: 'pending' | 'completed' | 'failed';
  settlementDate?: Date;
  transactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const settlementSchema = new Schema<ISettlement>(
  {
    associationId: {
      type: Schema.Types.ObjectId,
      ref: 'Association',
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    totalCollected: {
      type: Number,
      required: true,
      default: 0,
    },
    platformFee: {
      type: Number,
      required: true,
      default: 0,
    },
    platformFeePercentage: {
      type: Number,
      required: true,
      default: 2.5,
    },
    netAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    settlementDate: {
      type: Date,
    },
    transactionCount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

settlementSchema.index({ associationId: 1, year: -1, month: -1 });

export const Settlement = mongoose.model<ISettlement>('Settlement', settlementSchema);
