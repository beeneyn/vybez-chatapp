const winston = require('winston');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, category, ...metadata }) => {
        let msg = `${timestamp} [${level.toUpperCase()}] [${category || 'GENERAL'}] ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    })
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                customFormat
            )
        })
    ]
});

async function logToDatabase(level, category, message, metadata = {}) {
    try {
        await pool.query(
            'INSERT INTO server_logs (level, category, message, metadata) VALUES ($1, $2, $3, $4)',
            [level, category, message, JSON.stringify(metadata)]
        );
    } catch (err) {
        console.error('Error logging to database:', err);
    }
}

const serverLogger = {
    info: (category, message, metadata = {}) => {
        logger.info({ category, message, ...metadata });
        logToDatabase('info', category, message, metadata);
    },
    
    warn: (category, message, metadata = {}) => {
        logger.warn({ category, message, ...metadata });
        logToDatabase('warn', category, message, metadata);
    },
    
    error: (category, message, metadata = {}) => {
        logger.error({ category, message, ...metadata });
        logToDatabase('error', category, message, metadata);
    },
    
    debug: (category, message, metadata = {}) => {
        logger.debug({ category, message, ...metadata });
        if (process.env.LOG_LEVEL === 'debug') {
            logToDatabase('debug', category, message, metadata);
        }
    },
    
    auth: (message, metadata = {}) => {
        serverLogger.info('AUTH', message, metadata);
    },
    
    moderation: (message, metadata = {}) => {
        serverLogger.info('MODERATION', message, metadata);
    },
    
    api: (message, metadata = {}) => {
        serverLogger.info('API', message, metadata);
    },
    
    system: (message, metadata = {}) => {
        serverLogger.info('SYSTEM', message, metadata);
    },
    
    socket: (message, metadata = {}) => {
        serverLogger.debug('SOCKET', message, metadata);
    }
};

module.exports = serverLogger;
