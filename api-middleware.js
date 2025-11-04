const bcrypt = require('bcrypt');
const db = require('./database.js');
const serverLogger = require('./serverLogger.js');

const rateLimitStore = new Map();

const RATE_LIMITS = {
    free: { requests: 100, window: 60000 },
    standard: { requests: 500, window: 60000 },
    premium: { requests: 2000, window: 60000 },
    unlimited: { requests: 10000, window: 60000 }
};

async function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required', message: 'Provide an API key in X-API-Key header or Authorization header' });
    }
    
    if (!apiKey.startsWith('vybz_live_')) {
        return res.status(401).json({ error: 'Invalid API key format' });
    }
    
    try {
        const result = await db.pool.query(
            'SELECT id, username, key_hash, scopes, rate_limit_tier, is_active FROM api_keys WHERE api_key = $1',
            [apiKey]
        );
        
        if (result.rows.length === 0) {
            serverLogger.warn('API', 'Invalid API key attempt', { apiKey: apiKey.substring(0, 20) + '...' });
            return res.status(401).json({ error: 'Invalid API key' });
        }
        
        const keyData = result.rows[0];
        
        if (!keyData.is_active) {
            return res.status(403).json({ error: 'API key is deactivated' });
        }
        
        await db.pool.query(
            'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
            [keyData.id]
        );
        
        req.apiKey = {
            id: keyData.id,
            username: keyData.username,
            scopes: keyData.scopes || [],
            rateLimitTier: keyData.rate_limit_tier || 'standard'
        };
        
        next();
    } catch (err) {
        serverLogger.error('API', 'API key authentication error', { error: err.message });
        res.status(500).json({ error: 'Authentication failed' });
    }
}

function checkScope(requiredScope) {
    return (req, res, next) => {
        if (!req.apiKey) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const scopes = req.apiKey.scopes;
        
        if (!scopes.includes(requiredScope) && !scopes.includes('*')) {
            return res.status(403).json({ 
                error: 'Insufficient permissions', 
                required: requiredScope,
                current: scopes
            });
        }
        
        next();
    };
}

function rateLimiter(req, res, next) {
    if (!req.apiKey) {
        return next();
    }
    
    const keyId = req.apiKey.id;
    const tier = req.apiKey.rateLimitTier;
    const limit = RATE_LIMITS[tier] || RATE_LIMITS.standard;
    
    const now = Date.now();
    const windowStart = now - limit.window;
    
    if (!rateLimitStore.has(keyId)) {
        rateLimitStore.set(keyId, []);
    }
    
    const requests = rateLimitStore.get(keyId);
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= limit.requests) {
        const oldestRequest = Math.min(...recentRequests);
        const retryAfter = Math.ceil((oldestRequest + limit.window - now) / 1000);
        
        serverLogger.warn('API', 'Rate limit exceeded', { 
            keyId, 
            username: req.apiKey.username,
            tier 
        });
        
        return res.status(429).json({
            error: 'Rate limit exceeded',
            limit: limit.requests,
            window: `${limit.window / 1000}s`,
            retryAfter: `${retryAfter}s`
        });
    }
    
    recentRequests.push(now);
    rateLimitStore.set(keyId, recentRequests);
    
    res.setHeader('X-RateLimit-Limit', limit.requests);
    res.setHeader('X-RateLimit-Remaining', limit.requests - recentRequests.length);
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + limit.window) / 1000));
    
    next();
}

async function apiLogger(req, res, next) {
    if (!req.apiKey) {
        return next();
    }
    
    const startTime = Date.now();
    
    const originalSend = res.send;
    res.send = function(data) {
        const latency = Date.now() - startTime;
        
        db.pool.query(
            `INSERT INTO api_logs (api_key_id, username, route, method, status_code, latency_ms, ip_address, user_agent) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                req.apiKey.id,
                req.apiKey.username,
                req.path,
                req.method,
                res.statusCode,
                latency,
                req.ip,
                req.get('user-agent')
            ]
        ).catch(err => {
            console.error('Error logging API request:', err);
        });
        
        originalSend.call(this, data);
    };
    
    next();
}

setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((requests, keyId) => {
        const recentRequests = requests.filter(timestamp => timestamp > now - 300000);
        if (recentRequests.length === 0) {
            rateLimitStore.delete(keyId);
        } else {
            rateLimitStore.set(keyId, recentRequests);
        }
    });
}, 60000);

module.exports = {
    apiKeyAuth,
    checkScope,
    rateLimiter,
    apiLogger
};
