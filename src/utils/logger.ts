/**
 * Logger - Debug-Logging für das Plugin
 * Kann später erweitert werden für File-Logging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  message: string;
  context?: Record<string, any>;
}

export class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private minLevel: LogLevel = LogLevel.DEBUG;

  constructor(minLevel: LogLevel = LogLevel.DEBUG) {
    this.minLevel = minLevel;
  }

  /**
   * Log auf DEBUG-Level
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log auf INFO-Level
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log auf WARN-Level
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log auf ERROR-Level
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Internal Log-Funktion
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level < this.minLevel) {
      return; // Skip
    }

    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      message,
      context,
    };

    this.logs.push(entry);

    // Begrenze Log-Größe
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Konsole ausgeben (für Development)
    const levelName = LogLevel[level];
    const contextStr = context ? JSON.stringify(context) : "";
    console.log(`[${levelName}] ${message}`, contextStr);
  }

  /**
   * Gibt alle Logs zurück
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Gibt Logs ab einem bestimmten Level zurück
   */
  getLogsSince(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level >= level);
  }

  /**
   * Löscht alle Logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Setzt Minimum-Log-Level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Formatiert einen Log-Eintrag als String
   */
  formatEntry(entry: LogEntry): string {
    const date = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level];
    const context = entry.context ? ` | ${JSON.stringify(entry.context)}` : "";
    return `[${date}] ${level}: ${entry.message}${context}`;
  }

  /**
   * Exportiert alle Logs als formatierter String
   */
  export(): string {
    return this.logs.map((log) => this.formatEntry(log)).join("\n");
  }
}

// Globale Logger-Instanz
export const globalLogger = new Logger(LogLevel.DEBUG);

export default Logger;
