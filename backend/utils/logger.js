// Simple logger using console with levels for now to avoid installing winston 
// if winston is strictly required, I will need to check npm status.
// Given the prompt "For production use: Winston or Pino", I will implement 
// a structured logger interface that can be easily swapped.

class Logger {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
  }

  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const env = process.env.NODE_ENV || 'development';
    
    if (env === 'production') {
      console.log(JSON.stringify({ timestamp, level, message, ...meta }));
    } else {
      let metaStr = '';
      if (Object.keys(meta).length > 0) {
        try {
          metaStr = ' | ' + JSON.stringify(meta, null, 2);
        } catch (e) {
          metaStr = ' | [Circular or Unserializable Meta]';
        }
      }
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`);
    }
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  debug(message, meta) {
    if (this.env !== 'production') {
      this.log('debug', message, meta);
    }
  }
}

module.exports = new Logger();
