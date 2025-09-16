import { config } from '../config';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = this.getLogLevel(config.logLevel);
  }

  private getLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
        return LogLevel.DEBUG;
      default:
        return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      return `${formattedMessage} ${JSON.stringify(data, null, 2)}`;
    }
    
    return formattedMessage;
  }

  error(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  debug(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }
}

export const logger = new Logger();
