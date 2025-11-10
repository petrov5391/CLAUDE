/**
 * Система логирования для AI Browser
 * Использует Winston для записи логов в файл и консоль
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Настройка системы логирования
 */
function setupLogging() {
  // Путь к директории логов
  const logsDir = path.join(__dirname, '../../../logs');

  // Создаем директорию если не существует
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Формат логов
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}] ${message}`;

      // Добавляем дополнительные данные если есть
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }

      return log;
    })
  );

  // Создание logger
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
      // Логи в файл
      new winston.transports.File({
        filename: path.join(logsDir, 'ai-browser-error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'ai-browser.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10
      })
    ]
  });

  // В режиме разработки также выводим в консоль
  if (process.env.NODE_ENV === 'development') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }

  return logger;
}

module.exports = { setupLogging };
