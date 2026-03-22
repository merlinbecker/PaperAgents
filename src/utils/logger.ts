/**
 * Logger - Debug-Logging für das Plugin mit Ring-Buffer und Event-Bus-Pattern.
 * Alle Log-Einträge werden in einem Ring-Buffer gespeichert und an Subscriber
 * weitergegeben, damit die Sidebar-Log-Ansicht in Echtzeit aktualisiert werden kann.
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
  /** Die Komponente oder das Tool, das den Log-Eintrag erzeugt hat */
  emitter: string;
  message: string;
  context?: Record<string, unknown>;
}

/** Listener-Typ für den Event-Bus */
export type LogListener = (entry: LogEntry) => void;

/**
 * Kreisförmiger Puffer fester Größe (Ring-Buffer).
 * Älteste Einträge werden überschrieben, sobald die Kapazität erschöpft ist.
 */
export class RingBuffer<T> {
  private readonly buffer: Array<T | undefined>;
  private head = 0;
  private size = 0;

  constructor(private readonly capacity: number) {
    this.buffer = Array.from({ length: capacity });
  }

  /** Fügt ein Element ein. Überschreibt das älteste bei voller Kapazität. */
  push(item: T): void {
    const pos = (this.head + this.size) % this.capacity;
    this.buffer[pos] = item;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Puffer voll: ältestes Element verdrängen
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /** Gibt alle gespeicherten Elemente in Einfügereihenfolge zurück. */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[(this.head + i) % this.capacity];
      if (item !== undefined) result.push(item);
    }
    return result;
  }

  /** Aktuelle Anzahl der gespeicherten Elemente */
  get length(): number {
    return this.size;
  }

  /** Löscht den Puffer */
  clear(): void {
    this.head = 0;
    this.size = 0;
    for (let i = 0; i < this.capacity; i++) {
      this.buffer[i] = undefined;
    }
  }
}

/**
 * Komponentenspezifischer Logger, der immer denselben Emitter-Namen verwendet.
 * Erstellt mit `Logger.createLogger(emitter)`.
 */
export interface ComponentLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export class Logger {
  private readonly ringBuffer: RingBuffer<LogEntry>;
  private readonly listeners = new Set<LogListener>();
  private minLevel: LogLevel = LogLevel.DEBUG;

  constructor(
    minLevel: LogLevel = LogLevel.DEBUG,
    bufferSize = 500,
  ) {
    this.minLevel = minLevel;
    this.ringBuffer = new RingBuffer<LogEntry>(bufferSize);
  }

  // ── Öffentliche Log-Methoden ────────────────────────────────────────────────

  /** Log auf DEBUG-Level */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, "Plugin", context);
  }

  /** Log auf INFO-Level */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, "Plugin", context);
  }

  /** Log auf WARN-Level */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, "Plugin", context);
  }

  /** Log auf ERROR-Level */
  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, "Plugin", context);
  }

  // ── Event-Bus ───────────────────────────────────────────────────────────────

  /**
   * Registriert einen Listener, der bei jedem neuen Log-Eintrag aufgerufen wird.
   * Gibt eine Funktion zurück, mit der der Listener wieder abgemeldet werden kann.
   */
  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Komponentenspezifischer Logger ─────────────────────────────────────────

  /**
   * Erstellt einen Logger, der alle Einträge mit dem gegebenen Emitter-Namen versieht.
   * Empfohlen für alle Komponenten und Tools, um die Herkunft der Logs zu identifizieren.
   *
   * @example
   * const logger = globalLogger.createLogger("Sidebar");
   * logger.info("Sidebar wurde geöffnet");
   */
  createLogger(emitter: string): ComponentLogger {
    return {
      debug: (msg, ctx) => this.log(LogLevel.DEBUG, msg, emitter, ctx),
      info: (msg, ctx) => this.log(LogLevel.INFO, msg, emitter, ctx),
      warn: (msg, ctx) => this.log(LogLevel.WARN, msg, emitter, ctx),
      error: (msg, ctx) => this.log(LogLevel.ERROR, msg, emitter, ctx),
    };
  }

  // ── Abfrage-Methoden ────────────────────────────────────────────────────────

  /** Gibt alle gespeicherten Log-Einträge zurück (älteste zuerst) */
  getLogs(): LogEntry[] {
    return this.ringBuffer.toArray();
  }

  /** Gibt alle Log-Einträge ab dem angegebenen Level zurück */
  getLogsSince(level: LogLevel): LogEntry[] {
    return this.ringBuffer.toArray().filter((e) => e.level >= level);
  }

  /** Löscht alle gespeicherten Logs */
  clear(): void {
    this.ringBuffer.clear();
  }

  /** Setzt den minimalen Log-Level */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** Formatiert einen Log-Eintrag als lesbaren String */
  formatEntry(entry: LogEntry): string {
    const date = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level];
    const context = entry.context ? ` | ${JSON.stringify(entry.context)}` : "";
    return `[${date}] [${entry.emitter}] ${level}: ${entry.message}${context}`;
  }

  /** Exportiert alle Logs als formatierter String */
  export(): string {
    return this.ringBuffer.toArray().map((log) => this.formatEntry(log)).join("\n");
  }

  // ── Interne Logik ───────────────────────────────────────────────────────────

  private log(
    level: LogLevel,
    message: string,
    emitter: string,
    context?: Record<string, unknown>,
  ): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      emitter,
      message,
      context,
    };

    this.ringBuffer.push(entry);

    // Alle Subscriber benachrichtigen (Event-Bus)
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // Listener-Fehler dürfen das Logging nicht unterbrechen
      }
    }

    // Konsolenausgabe für Entwicklung
    const levelName = LogLevel[level];
    const contextStr = context ? JSON.stringify(context) : "";
    console.debug(`[${levelName}] [${emitter}] ${message}`, contextStr);
  }
}

// Globale Logger-Instanz
export const globalLogger = new Logger(LogLevel.DEBUG);

export default Logger;
