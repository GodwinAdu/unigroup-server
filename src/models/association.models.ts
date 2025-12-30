import { Document, model, models, Schema } from "mongoose";

export interface IAssociation extends Document {
    name: string;
    type: 'school' | 'community';
    description?: string;
    code: string; // Unique join code
    createdBy: Schema.Types.ObjectId;
    
    // School-specific fields
    schoolInfo?: {
        establishedYear?: number;
        address?: string;
        phoneNumber?: string;
        email?: string;
        schoolType?: 'public' | 'private' | 'charter';
        website?: string;
        studentCapacity?: number;
    };

    
    // Community-specific fields
    communityInfo?: {
        foundedYear?: number;
        location?: string;
        contactPhone?: string;
        contactEmail?: string;
        membershipFee?: number;
        meetingSchedule?: string;
        focusAreas?: string[]; // e.g., ['education', 'health', 'environment']
        organizationType?: 'nonprofit' | 'religious' | 'social' | 'professional';
        website?: string;
        maxMembers?: number;
    };
    city?: string;
    country?: string;
    
    members: Array<{
        userId: Schema.Types.ObjectId;
        role: 'admin' | 'moderator' | 'member';
        joinedAt: Date;
        isActive: boolean;
        invitedBy?: Schema.Types.ObjectId;
        status: 'active' | 'pending' | 'suspended';
    }>;
    
    // Additional useful fields
    avatar?: string; // Association profile image
    banner?: string; // Cover/banner image
    currency?: string; // Default currency for financial operations
    timezone?: string; // Association timezone
    socialLinks?: {
        website?: string;
        facebook?: string;
        twitter?: string;
        instagram?: string;
        linkedin?: string;
    };
    
    // Statistics (computed fields)
    stats?: {
        totalMembers: number;
        activeMembers: number;
        totalIncome: number;
        totalExpenses: number;
        lastActivity: Date;
    };
    settings: {
        // Visibility settings
        isPublic: boolean;
        requireApproval: boolean;
        
        // Member permissions
        allowMemberInvites: boolean;
        showMemberList: boolean;
        showFinancials: boolean;
        allowDataExport: boolean;
        
        // Notification settings
        notifications: {
            newMembers: boolean;
            memberRequests: boolean;
            financialUpdates: boolean;
            incomeRecorded: boolean;
            expenseRecorded: boolean;
            monthlyReports: boolean;
            eventReminders: boolean;
            systemUpdates: boolean;
            emailNotifications: boolean;
            pushNotifications: boolean;
        };
        
        // Financial settings
        financial: {
            allowMemberContributions: boolean;
            requireReceiptUpload: boolean;
            autoApproveExpenses: boolean;
            expenseApprovalLimit: number;
        };
        
        // Security settings
        security: {
            requireTwoFactorForAdmins: boolean;
            allowGuestAccess: boolean;
            sessionTimeout: number; // in minutes
        };
        
        // Dues settings
        dues: {
            enabled: boolean;
            amount: number;
            frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
            dueDate: number; // Day of period (1-31 for monthly, 1-7 for weekly, etc.)
            description: string;
        };
    };
    createdAt: Date;
    updatedAt: Date;
}

const AssociationSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['school', 'community'],
        required: true
    },
    description: {
        type: String,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // School-specific fields
    schoolInfo: {
        establishedYear: Number,
        address: String,
        phoneNumber: String,
        email: String,
        schoolType: {
            type: String,
            enum: ['public', 'private', 'charter']
        },
        website: String,
        studentCapacity: Number
    },
    
    // Community-specific fields
    communityInfo: {
        foundedYear: Number,
        location: String,
        contactPhone: String,
        contactEmail: String,
        membershipFee: Number,
        meetingSchedule: String,
        focusAreas: [String],
        organizationType: {
            type: String,
            enum: ['nonprofit', 'religious', 'social', 'professional']
        },
        website: String,
        maxMembers: Number
    },
    city: {
        type: String,
        trim: true,
    },
    country: {
        type: String,
        trim: true
    },
    members: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'moderator', 'member'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        },
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['active', 'pending', 'suspended'],
            default: 'active'
        }
    }],
    
    // Additional fields
    avatar: String,
    banner: String,
    currency: {
        type: String,
        default: 'USD'
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    socialLinks: {
        website: String,
        facebook: String,
        twitter: String,
        instagram: String,
        linkedin: String
    },
    
    stats: {
        totalMembers: {
            type: Number,
            default: 0
        },
        activeMembers: {
            type: Number,
            default: 0
        },
        totalIncome: {
            type: Number,
            default: 0
        },
        totalExpenses: {
            type: Number,
            default: 0
        },
        lastActivity: {
            type: Date,
            default: Date.now
        }
    },
    settings: {
        // Visibility settings
        isPublic: {
            type: Boolean,
            default: true
        },
        requireApproval: {
            type: Boolean,
            default: true
        },
        
        // Member permissions
        allowMemberInvites: {
            type: Boolean,
            default: true
        },
        showMemberList: {
            type: Boolean,
            default: true
        },
        showFinancials: {
            type: Boolean,
            default: false
        },
        allowDataExport: {
            type: Boolean,
            default: false
        },
        
        // Notification settings
        notifications: {
            newMembers: {
                type: Boolean,
                default: true
            },
            memberRequests: {
                type: Boolean,
                default: true
            },
            financialUpdates: {
                type: Boolean,
                default: true
            },
            incomeRecorded: {
                type: Boolean,
                default: false
            },
            expenseRecorded: {
                type: Boolean,
                default: false
            },
            monthlyReports: {
                type: Boolean,
                default: true
            },
            eventReminders: {
                type: Boolean,
                default: true
            },
            systemUpdates: {
                type: Boolean,
                default: false
            },
            emailNotifications: {
                type: Boolean,
                default: true
            },
            pushNotifications: {
                type: Boolean,
                default: true
            }
        },
        
        // Financial settings
        financial: {
            allowMemberContributions: {
                type: Boolean,
                default: true
            },
            requireReceiptUpload: {
                type: Boolean,
                default: false
            },
            autoApproveExpenses: {
                type: Boolean,
                default: false
            },
            expenseApprovalLimit: {
                type: Number,
                default: 1000
            }
        },
        
        // Security settings
        security: {
            requireTwoFactorForAdmins: {
                type: Boolean,
                default: false
            },
            allowGuestAccess: {
                type: Boolean,
                default: false
            },
            sessionTimeout: {
                type: Number,
                default: 60 // minutes
            }
        },
        
        // Dues settings
        dues: {
            enabled: {
                type: Boolean,
                default: false
            },
            amount: {
                type: Number,
                default: 0
            },
            frequency: {
                type: String,
                enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
                default: 'monthly'
            },
            dueDate: {
                type: Number,
                default: 1
            },
            description: {
                type: String,
                default: 'Member dues payment'
            }
        }
    }
}, {
    timestamps: true
});

const Association = models.Association ?? model<IAssociation>("Association", AssociationSchema);

export default Association;