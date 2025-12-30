import { Document, model, models, Schema } from "mongoose";

export interface IUser extends Document {
    name: string;
    email?: string;
    phoneNumber?: string;
    country?: string;
    otp?: string;
    otpExpires?: Date;
    isVerified: boolean;
    status: 'temporary' | 'pending' | 'active' | 'inactive' | 'banned';
    devices: Array<{
        deviceId: string;
        deviceName: string;
        lastActive: Date;
        isActive: boolean;
    }>;
    twoFactor: {
        enabled: boolean;
        secret?: string;
        backupCodes?: string[];
        enabledAt?: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        sparse: true,
        lowercase: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        sparse: true,
        trim: true
    },
    country: {
        type: String,
        trim: true
    },
    otp: {
        type: String,
        select: false
    },
    otpExpires: {
        type: Date,
        select: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['temporary','pending', 'active', 'inactive', 'banned'],
        default: 'active'
    },
    devices: [{
        deviceId: String,
        deviceName: String,
        lastActive: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true }
    }],
    twoFactor: {
        enabled: {
            type: Boolean,
            default: false
        },
        secret: {
            type: String,
            select: false
        },
        backupCodes: {
            type: [String],
            select: false
        },
        enabledAt: Date
    }
}, {
    timestamps: true
});

// Ensure either email or phoneNumber is provided
UserSchema.pre('save', function(next) {
    if (!this.email && !this.phoneNumber) {
        next(new Error('Either email or phone number is required'));
    } else {
        next();
    }
});

const User = models.User ?? model<IUser>("User", UserSchema);
export default User;