import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalyticsEvent extends Document {
  event: string;
  properties?: Record<string, any>;
  timestamp: Date;
  sessionId: string;
  app: string;
  platform: string;
  userId?: string;
}

const AnalyticsEventSchema: Schema = new Schema({
  event: { type: String, required: true },
  properties: { type: Schema.Types.Mixed },
  timestamp: { type: Date, required: true },
  sessionId: { type: String, required: true },
  app: { type: String, required: true },
  platform: { type: String, required: true },
  userId: { type: String }
});

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>('AnalyticsEvent', AnalyticsEventSchema);