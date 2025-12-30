import mongoose, { Schema, Document } from 'mongoose';

export interface IContributor {
  userId: string;
  name: string;
  amount: number;
  message?: string;
  date: Date;
}

export interface IFundraiser extends Document {
  associationId: string;
  type: 'goal' | 'contribution';
  title: string;
  description: string;
  targetAmount?: number;
  currentAmount: number;
  deadline: Date;
  status: 'active' | 'completed' | 'expired';
  createdBy: string;
  contributors: IContributor[];
  createdAt: Date;
  updatedAt: Date;
}

const ContributorSchema = new Schema<IContributor>({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  message: { type: String, maxlength: 200 },
  date: { type: Date, default: Date.now }
});

const FundraiserSchema = new Schema<IFundraiser>({
  associationId: { type: String, required: true, index: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['goal', 'contribution'] 
  },
  title: { 
    type: String, 
    required: true, 
    maxlength: 100,
    trim: true 
  },
  description: { 
    type: String, 
    required: true, 
    maxlength: 500,
    trim: true 
  },
  targetAmount: { 
    type: Number, 
    min: 0,
    validate: {
      validator: function(this: IFundraiser, value: number) {
        // Target amount is required for goal type fundraisers
        if (this.type === 'goal') {
          return value != null && value > 0;
        }
        return true;
      },
      message: 'Target amount is required for goal fundraisers'
    }
  },
  currentAmount: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  deadline: { 
    type: Date, 
    required: true,
    validate: {
      validator: function(value: Date) {
        return value > new Date();
      },
      message: 'Deadline must be in the future'
    }
  },
  status: { 
    type: String, 
    enum: ['active', 'completed', 'expired'], 
    default: 'active' 
  },
  createdBy: { 
    type: String, 
    required: true 
  },
  contributors: [ContributorSchema]
}, {
  timestamps: true
});

// Index for efficient queries
FundraiserSchema.index({ associationId: 1, status: 1 });
FundraiserSchema.index({ deadline: 1 });
FundraiserSchema.index({ createdBy: 1 });

// Virtual for contributors count
FundraiserSchema.virtual('contributorsCount').get(function() {
  return this.contributors.length;
});

// Method to add contribution
FundraiserSchema.methods.addContribution = function(contributor: IContributor) {
  this.contributors.push(contributor);
  this.currentAmount += contributor.amount;
  
  // Check if goal is reached for goal type fundraisers
  if (this.type === 'goal' && this.targetAmount && this.currentAmount >= this.targetAmount) {
    this.status = 'completed';
  }
  
  return this.save();
};

// Method to check if fundraiser is expired
FundraiserSchema.methods.checkExpiration = function() {
  if (this.status === 'active' && new Date() > this.deadline) {
    this.status = 'expired';
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to update expired fundraisers
FundraiserSchema.statics.updateExpiredFundraisers = function() {
  return this.updateMany(
    { 
      status: 'active', 
      deadline: { $lt: new Date() } 
    },
    { 
      $set: { status: 'expired' } 
    }
  );
};

export const Fundraiser = mongoose.model<IFundraiser>('Fundraiser', FundraiserSchema);