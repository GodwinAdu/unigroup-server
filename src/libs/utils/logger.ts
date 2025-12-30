// utils/logger.ts

/* eslint-disable no-console */
const getTimestamp = (): string => {
  return new Date().toISOString();
};

const formatMessage = (level: string, msg: string, context?: string): string => {
  const timestamp = getTimestamp();
  const contextStr = context ? ` [${context}]` : '';
  return `${timestamp} ${level}${contextStr}: ${msg}`;
};

export const log = {
  info: (msg: string, context?: string) =>
    console.log(`\x1b[36m${formatMessage('ℹ️ INFO', msg, context)}\x1b[0m`),

  success: (msg: string, context?: string) =>
    console.log(`\x1b[32m${formatMessage('✅ SUCCESS', msg, context)}\x1b[0m`),

  warn: (msg: string, context?: string) =>
    console.warn(`\x1b[33m${formatMessage('⚠️ WARNING', msg, context)}\x1b[0m`),

  error: (msg: string, context?: string) =>
    console.error(`\x1b[31m${formatMessage('❌ ERROR', msg, context)}\x1b[0m`),

  debug: (msg: string, context?: string) =>
    console.debug(`\x1b[35m${formatMessage('🐛 DEBUG', msg, context)}\x1b[0m`),
};
