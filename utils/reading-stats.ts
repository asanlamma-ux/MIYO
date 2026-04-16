/**
 * Reading Statistics Tracker for Miyo EPUB Reader
 * Tracks reading time, sessions, and calculates reading speed.
 */

import { FastStorage } from './fast-storage';
import { logger } from './logger';

const READING_STATS_KEY = '@miyo/reading-stats';
const DAILY_READING_KEY = '@miyo/daily-reading';
const DAILY_GOAL_MINUTES_KEY = '@miyo/daily-reading-goal-minutes';

export interface ReadingSession {
  bookId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  chaptersRead: number;
  wordsRead: number;
}

export interface DailyReading {
  date: string; // YYYY-MM-DD
  totalMinutes: number;
  sessions: number;
  wordsRead: number;
}

export interface ReadingStats {
  totalReadingMinutes: number;
  totalSessions: number;
  totalWordsRead: number;
  currentStreak: number;
  longestStreak: number;
  averageSessionMinutes: number;
  averageWordsPerMinute: number;
  lastReadDate: string | null;
}

let sessionStartTime: number | null = null;
let sessionBookId: string | null = null;
let sessionWordsRead = 0;
let sessionChaptersRead = 0;

/**
 * Start tracking a reading session
 */
export function startReadingSession(bookId: string): void {
  sessionStartTime = Date.now();
  sessionBookId = bookId;
  sessionWordsRead = 0;
  sessionChaptersRead = 0;
  logger.debug('Reading session started', { bookId });
}

/**
 * Record words read during the current session
 */
export function recordWordsRead(words: number): void {
  sessionWordsRead += words;
}

/**
 * Record a chapter read during the current session
 */
export function recordChapterRead(): void {
  sessionChaptersRead += 1;
}

/**
 * End the current reading session and persist
 */
export async function endReadingSession(): Promise<ReadingSession | null> {
  if (!sessionStartTime || !sessionBookId) return null;

  const endTime = Date.now();
  const durationMs = endTime - sessionStartTime;
  const durationMinutes = Math.round(durationMs / 60000);

  // Don't record sessions shorter than 30 seconds
  if (durationMs < 30000) {
    sessionStartTime = null;
    sessionBookId = null;
    return null;
  }

  const session: ReadingSession = {
    bookId: sessionBookId,
    startTime: new Date(sessionStartTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationMinutes: Math.max(1, durationMinutes),
    chaptersRead: sessionChaptersRead,
    wordsRead: sessionWordsRead,
  };

  try {
    // Save daily reading data
    const today = new Date().toISOString().split('T')[0];
    const dailyData: Record<string, DailyReading> = FastStorage.getJSON(DAILY_READING_KEY) || {};

    if (!dailyData[today]) {
      dailyData[today] = { date: today, totalMinutes: 0, sessions: 0, wordsRead: 0 };
    }
    dailyData[today].totalMinutes += session.durationMinutes;
    dailyData[today].sessions += 1;
    dailyData[today].wordsRead += session.wordsRead;

    // Keep only last 90 days
    const keys = Object.keys(dailyData).sort();
    if (keys.length > 90) {
      const toRemove = keys.slice(0, keys.length - 90);
      for (const key of toRemove) {
        delete dailyData[key];
      }
    }

    FastStorage.setJSON(DAILY_READING_KEY, dailyData);
    
    // Save to session history
    const historyKey = `@miyo/session-history`;
    const history: ReadingSession[] = FastStorage.getJSON(historyKey) || [];
    history.unshift(session);
    if (history.length > 100) history.pop();
    FastStorage.setJSON(historyKey, history);

    logger.info('Reading session saved via FastStorage', { 
      durationMinutes: session.durationMinutes, 
      wordsRead: session.wordsRead 
    });
  } catch (error) {
    logger.error('Failed to save reading session', error);
  }

  sessionStartTime = null;
  sessionBookId = null;
  sessionWordsRead = 0;
  sessionChaptersRead = 0;

  return session;
}

/**
 * Get overall reading statistics
 */
export async function getReadingStats(): Promise<ReadingStats> {
  try {
    const dailyData: Record<string, DailyReading> = FastStorage.getJSON(DAILY_READING_KEY) || {};
    const days = Object.keys(dailyData).sort();

    if (days.length === 0) {
      return {
        totalReadingMinutes: 0,
        totalSessions: 0,
        totalWordsRead: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageSessionMinutes: 0,
        averageWordsPerMinute: 0,
        lastReadDate: null,
      };
    }

    let totalMinutes = 0;
    let totalSessions = 0;
    let totalWords = 0;

    for (const day of days) {
      totalMinutes += dailyData[day].totalMinutes;
      totalSessions += dailyData[day].sessions;
      totalWords += dailyData[day].wordsRead;
    }

    // Calculate streaks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;

    // Check from today backwards
    const checkDate = new Date(today);
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (dailyData[dateStr]) {
        streak++;
        if (i === 0 || currentStreak > 0) {
          currentStreak = streak;
        }
      } else {
        if (i === 0) {
          // Today has no reading yet, check yesterday
          currentStreak = 0;
        }
        longestStreak = Math.max(longestStreak, streak);
        if (currentStreak === 0 && i > 1) break;
        streak = 0;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }
    longestStreak = Math.max(longestStreak, streak);

    return {
      totalReadingMinutes: totalMinutes,
      totalSessions: totalSessions,
      totalWordsRead: totalWords,
      currentStreak,
      longestStreak,
      averageSessionMinutes: totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0,
      averageWordsPerMinute: totalMinutes > 0 ? Math.round(totalWords / totalMinutes) : 0,
      lastReadDate: days[days.length - 1],
    };
  } catch (error) {
    logger.error('Failed to get reading stats', error);
    return {
      totalReadingMinutes: 0,
      totalSessions: 0,
      totalWordsRead: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageSessionMinutes: 0,
      averageWordsPerMinute: 0,
      lastReadDate: null,
    };
  }
}

/**
 * Get daily reading data for charts/graphs
 */
export async function getDailyReadingData(days: number = 7): Promise<DailyReading[]> {
  try {
    const dailyData: Record<string, DailyReading> = FastStorage.getJSON(DAILY_READING_KEY) || {};
    const result: DailyReading[] = [];

    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      result.push(dailyData[dateStr] || { date: dateStr, totalMinutes: 0, sessions: 0, wordsRead: 0 });
    }

    return result;
  } catch (error) {
    logger.error('Failed to get daily reading data', error);
    return [];
  }
}

/**
 * Clear all reading statistics
 */
export async function clearReadingStats(): Promise<void> {
  try {
    FastStorage.delete(READING_STATS_KEY);
    FastStorage.delete(DAILY_READING_KEY);
    FastStorage.delete('@miyo/session-history');
    logger.info('Reading statistics cleared');
  } catch (error) {
    logger.error('Failed to clear reading statistics', error);
  }
}

const clampGoal = (n: number) => Math.max(5, Math.min(480, Math.round(n)));

/**
 * Daily reading goal in minutes (Koodo-style target), persisted separately from session aggregates.
 */
export async function getDailyReadingGoalMinutes(): Promise<number> {
  try {
    const raw = FastStorage.get(DAILY_GOAL_MINUTES_KEY);
    if (!raw) return 30;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? clampGoal(n) : 30;
  } catch {
    return 30;
  }
}

export async function setDailyReadingGoalMinutes(minutes: number): Promise<void> {
  try {
    FastStorage.set(DAILY_GOAL_MINUTES_KEY, String(clampGoal(minutes)));
  } catch (error) {
    logger.error('Failed to save daily reading goal', error);
  }
}

/** Minutes logged for the current local calendar day (from daily aggregates). */
export async function getTodayReadingMinutes(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dailyData: Record<string, DailyReading> = FastStorage.getJSON(DAILY_READING_KEY) || {};
    return dailyData[today]?.totalMinutes ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Get the reading trend (minutes per day) for the last 7 days
 */
export async function getWeeklyTrend(): Promise<Array<{ date: string; minutes: number }>> {
  const dailyData: Record<string, DailyReading> = FastStorage.getJSON(DAILY_READING_KEY) || {};
  const trend = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    trend.push({
      date: dateStr,
      minutes: dailyData[dateStr]?.totalMinutes || 0
    });
  }
  return trend;
}

/**
 * Get reading stats for a specific book
 */
export async function getBookStats(bookId: string): Promise<{ totalMinutes: number, sessions: number }> {
  const history: ReadingSession[] = FastStorage.getJSON('@miyo/session-history') || [];
  let totalMinutes = 0;
  let sessions = 0;
  for (const session of history) {
    if (session.bookId === bookId) {
      totalMinutes += session.durationMinutes;
      sessions += 1;
    }
  }
  return { totalMinutes, sessions };
}

/**
 * Get recent session history
 */
export async function getSessionHistory(limit = 10): Promise<ReadingSession[]> {
  const history: ReadingSession[] = FastStorage.getJSON('@miyo/session-history') || [];
  return history.slice(0, limit);
}
