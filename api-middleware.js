const db = require('./database');

// Middleware to validate API keys for developer endpoints
const requireApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
        return res.status(401).json({ 
            error: 'API key required',
            message: 'Please provide an API key in the X-API-Key header or Authorization header'
        });
    }
    
    db.validateApiKey(apiKey, (err, keyData) => {
        if (err) {
            console.error('API key validation error:', err);
            return res.status(500).json({ 
                error: 'Internal server error',
                message: 'Failed to validate API key'
            });
        }
        
        if (!keyData) {
            return res.status(401).json({ 
                error: 'Invalid API key',
                message: 'The provided API key is invalid or has been deactivated'
            });
        }
        
        // Attach API key data to request for use in route handlers
        req.apiUser = {
            username: keyData.username,
            appName: keyData.appName,
            rateLimit: keyData.rateLimit
        };
        
        next();
    });
};

// Simple in-memory rate limiter (for production, use Redis or similar)
const rateLimitStore = new Map();

const rateLimit = (req, res, next) => {
    if (!req.apiUser) {
        return next(); // Skip if not an API request
    }
    
    const key = req.apiUser.username;
    const limit = req.apiUser.rateLimit;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return next();
    }
    
    const data = rateLimitStore.get(key);
    
    // Reset if window has passed
    if (now > data.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return next();
    }
    
    // Check if limit exceeded
    if (data.count >= limit) {
        const retryAfter = Math.ceil((data.resetTime - now) / 1000);
        res.set('Retry-After', retryAfter.toString());
        res.set('X-RateLimit-Limit', limit.toString());
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', new Date(data.resetTime).toISOString());
        
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `You have exceeded your rate limit of ${limit} requests per minute`,
            retryAfter: retryAfter
        });
    }
    
    // Increment count
    data.count++;
    rateLimitStore.set(key, data);
    
    // Set rate limit headers
    res.set('X-RateLimit-Limit', limit.toString());
    res.set('X-RateLimit-Remaining', (limit - data.count).toString());
    res.set('X-RateLimit-Reset', new Date(data.resetTime).toISOString());
    
    next();
};

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

module.exports = {
    requireApiKey,
    rateLimit
};
