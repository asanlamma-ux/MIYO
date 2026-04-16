/**
 * Professional Logger Utility for Miyo EPUB Reader
 * Provides centralized error handling, logging levels, and log persistence
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  details?: unknown;
  stack?: string;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addLog(entry: LogEntry): void {
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => this.listeners.delete(listener);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  clearLogs(): void {
    this.logs = [];
    this.notifyListeners();
  }

  debug(message: string, details?: unknown): void {
    const entry: LogEntry = {
      id: this.generateId(),
      level: 'debug',
      message,
      timestamp: this.formatTimestamp(),
      details,
    };
    this.addLog(entry);
    if (__DEV__) {
      console.log(`[DEBUG] ${message}`, details ?? '');
    }
  }

  info(message: string, details?: unknown): void {
    const entry: LogEntry = {
      id: this.generateId(),
      level: 'info',
      message,
      timestamp: this.formatTimestamp(),
      details,
    };
    this.addLog(entry);
    if (__DEV__) {
      console.info(`[INFO] ${message}`, details ?? '');
    }
  }

  warn(message: string, details?: unknown): void {
    const entry: LogEntry = {
      id: this.generateId(),
      level: 'warn',
      message,
      timestamp: this.formatTimestamp(),
      details,
    };
    this.addLog(entry);
    console.warn(`[WARN] ${message}`, details ?? '');
  }

  error(message: string, error?: Error | unknown): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const entry: LogEntry = {
      id: this.generateId(),
      level: 'error',
      message,
      timestamp: this.formatTimestamp(),
      details: errorObj.message,
      stack: errorObj.stack,
    };
    this.addLog(entry);
    console.error(`[ERROR] ${message}`, errorObj);
  }
}

export const logger = Logger.getInstance();

// Error boundary helper
export function captureError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`${context}: ${errorMessage}`, error);
  if (additionalInfo) {
    logger.debug(`Additional context for ${context}`, additionalInfo);
  }
}

// Async error wrapper
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    captureError(context, error);
    return fallback;
  }
}
