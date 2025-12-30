import { Request, Response } from 'express';
import { AnalyticsEvent } from '../models/analytics.models';

export const trackEvent = async (req: Request, res: Response) => {
  try {
    const { event, properties, timestamp, sessionId, app, platform } = req.body;
    
    const analyticsEvent = new AnalyticsEvent({
      event,
      properties,
      timestamp: new Date(timestamp),
      sessionId,
      app,
      platform,
      userId: req.user?.userId
    });

    await analyticsEvent.save();
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
};