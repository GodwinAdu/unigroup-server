import { Document, model, models, Schema } from "mongoose";

export interface INotification extends Document {
    userId: Schema.Types.ObjectId;
    associationId: Schema.Types.ObjectId;
    type: 'new_member' | 'member_request' | 'financial_update' | 'income_recorded' | 'expense_recorded' | 'monthly_report' | 'event_reminder' | 'system_update' | 'fundraiser_contribution' | 'fundraiser_goal_reached';
    title: string;
    message: string;
    data?: any;
    isRead: boolean;
    createdAt: Date;
}

const NotificationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    associationId: {
        type: Schema.Types.ObjectId,
        ref: 'Association',
        required: true
    },
    type: {
        type: String,
        enum: ['new_member', 'member_request', 'financial_update', 'income_recorded', 'expense_recorded', 'monthly_report', 'event_reminder', 'system_update', 'fundraiser_contribution', 'fundraiser_goal_reached'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    data: {
        type: Schema.Types.Mixed
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const Notification = models.Notification ?? model<INotification>("Notification", NotificationSchema);
export default Notification;