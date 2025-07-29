/**
 * Application Logger Utility
 * Provides structured logging for different environments
 */

const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log levels
 */
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Format log message
 */
const formatLogMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  return JSON.stringify(logEntry);
};

/**
 * Write log to file
 */
const writeToFile = (filename, message) => {
  const logFile = path.join(logsDir, filename);
  const logMessage = message + '\n';
  
  fs.appendFile(logFile, logMessage, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
};

/**
 * Console logger with colors (development)
 */
const consoleLog = (level, message, meta = {}) => {
  const colors = {
    ERROR: '\x1b[31m', // Red
    WARN: '\x1b[33m',  // Yellow
    INFO: '\x1b[36m',  // Cyan
    DEBUG: '\x1b[35m'  // Magenta
  };
  
  const reset = '\x1b[0m';
  const timestamp = new Date().toISOString();
  
  console.log(
    `${colors[level]}[${timestamp}] ${level}:${reset} ${message}`,
    Object.keys(meta).length > 0 ? meta : ''
  );
};

/**
 * Logger class
 */
class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Log error message
   */
  error(message, meta = {}) {
    const logMessage = formatLogMessage(LOG_LEVELS.ERROR, message, meta);
    
    if (this.isDevelopment) {
      consoleLog(LOG_LEVELS.ERROR, message, meta);
    }
    
    writeToFile('error.log', logMessage);
    writeToFile('combined.log', logMessage);
  }

  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    const logMessage = formatLogMessage(LOG_LEVELS.WARN, message, meta);
    
    if (this.isDevelopment) {
      consoleLog(LOG_LEVELS.WARN, message, meta);
    }
    
    writeToFile('combined.log', logMessage);
  }

  /**
   * Log info message
   */
  info(message, meta = {}) {
    const logMessage = formatLogMessage(LOG_LEVELS.INFO, message, meta);
    
    if (this.isDevelopment) {
      consoleLog(LOG_LEVELS.INFO, message, meta);
    }
    
    writeToFile('combined.log', logMessage);
  }

  /**
   * Log debug message (only in development)
   */
  debug(message, meta = {}) {
    if (!this.isDevelopment) return;
    
    const logMessage = formatLogMessage(LOG_LEVELS.DEBUG, message, meta);
    consoleLog(LOG_LEVELS.DEBUG, message, meta);
    writeToFile('debug.log', logMessage);
  }

  /**
   * Log HTTP request
   */
  logRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous'
    };

    const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`;
    
    if (res.statusCode >= 400) {
      this.error(message, meta);
    } else {
      this.info(message, meta);
    }
  }

  /**
   * Log authentication events
   */
  logAuth(event, userId, meta = {}) {
    const message = `Authentication event: ${event}`;
    const logMeta = {
      event,
      userId,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.info(message, logMeta);
    writeToFile('auth.log', formatLogMessage(LOG_LEVELS.INFO, message, logMeta));
  }

  /**
   * Log database operations
   */
  logDatabase(operation, collection, meta = {}) {
    const message = `Database operation: ${operation} on ${collection}`;
    const logMeta = {
      operation,
      collection,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.debug(message, logMeta);
  }

  /**
   * Log security events
   */
  logSecurity(event, meta = {}) {
    const message = `Security event: ${event}`;
    const logMeta = {
      event,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.warn(message, logMeta);
    writeToFile('security.log', formatLogMessage(LOG_LEVELS.WARN, message, logMeta));
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation, duration, meta = {}) {
    const message = `Performance: ${operation} took ${duration}ms`;
    const logMeta = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...meta
    };

    if (duration > 1000) { // Log slow operations as warnings
      this.warn(message, logMeta);
    } else {
      this.debug(message, logMeta);
    }
  }
}

// Create singleton instance
const logger = new Logger();

/**
 * Express middleware for request logging
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    logger.logRequest(req, res, responseTime);
    originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Error logging helper
 */
const logError = (error, req = null, additionalMeta = {}) => {
  const meta = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...additionalMeta
  };

  if (req) {
    meta.request = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      userId: req.user?.id
    };
  }

  logger.error('Application error occurred', meta);
};

module.exports = {
  logger,
  requestLogger,
  logError,
  LOG_LEVELS
};