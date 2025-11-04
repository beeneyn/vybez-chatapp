const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./database.js');
const serverLogger = require('./serverLogger.js');

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
};

function generateAPIKey() {
    const prefix = 'vybz_live_';
    const randomPart = crypto.randomBytes(32).toString('hex');
    return prefix + randomPart;
}

async function hashAPIKey(apiKey) {
    return await bcrypt.hash(apiKey, 10);
}

async function verifyAPIKey(apiKey, hash) {
    return await bcrypt.compare(apiKey, hash);
}

router.get('/keys', requireAuth, async (req, res) => {
    try {
        const result = await db.pool.query(
            'SELECT id, name, app_name, scopes, rate_limit_tier, is_active, last_used_at, created_at FROM api_keys WHERE username = $1 ORDER BY created_at DESC',
            [req.session.user.username]
        );
        res.json({ keys: result.rows });
    } catch (err) {
        serverLogger.error('API', 'Failed to fetch API keys', { username: req.session.user.username, error: err.message });
        res.status(500).json({ message: 'Failed to fetch API keys' });
    }
});

router.post('/keys', requireAuth, async (req, res) => {
    try {
        const { name, appName, scopes, rateLimitTier } = req.body;
        
        if (!name || !appName) {
            return res.status(400).json({ message: 'Name and app name are required' });
        }
        
        const apiKey = generateAPIKey();
        const keyHash = await hashAPIKey(apiKey);
        
        const result = await db.pool.query(
            `INSERT INTO api_keys (username, key_hash, name, app_name, scopes, rate_limit_tier) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id, name, app_name, scopes, rate_limit_tier, created_at`,
            [
                req.session.user.username,
                keyHash,
                name,
                appName,
                JSON.stringify(scopes || []),
                rateLimitTier || 'standard'
            ]
        );
        
        serverLogger.api('API key created', { 
            username: req.session.user.username, 
            keyId: result.rows[0].id, 
            appName 
        });
        
        res.json({
            success: true,
            key: result.rows[0],
            apiKey: apiKey
        });
    } catch (err) {
        serverLogger.error('API', 'Failed to create API key', { username: req.session.user.username, error: err.message });
        res.status(500).json({ message: 'Failed to create API key' });
    }
});

router.delete('/keys/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.pool.query(
            'DELETE FROM api_keys WHERE id = $1 AND username = $2 RETURNING id',
            [id, req.session.user.username]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'API key not found' });
        }
        
        serverLogger.api('API key deleted', { username: req.session.user.username, keyId: id });
        res.json({ success: true });
    } catch (err) {
        serverLogger.error('API', 'Failed to delete API key', { username: req.session.user.username, error: err.message });
        res.status(500).json({ message: 'Failed to delete API key' });
    }
});

router.put('/keys/:id/toggle', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.pool.query(
            'UPDATE api_keys SET is_active = NOT is_active WHERE id = $1 AND username = $2 RETURNING is_active',
            [id, req.session.user.username]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'API key not found' });
        }
        
        serverLogger.api('API key toggled', { 
            username: req.session.user.username, 
            keyId: id, 
            isActive: result.rows[0].is_active 
        });
        
        res.json({ success: true, isActive: result.rows[0].is_active });
    } catch (err) {
        serverLogger.error('API', 'Failed to toggle API key', { username: req.session.user.username, error: err.message });
        res.status(500).json({ message: 'Failed to toggle API key' });
    }
});

router.get('/admin/all-keys', requireAdmin, async (req, res) => {
    try {
        const result = await db.pool.query(
            'SELECT id, username, name, app_name, scopes, rate_limit_tier, is_active, last_used_at, created_at FROM api_keys ORDER BY created_at DESC'
        );
        res.json({ keys: result.rows });
    } catch (err) {
        serverLogger.error('API', 'Failed to fetch all API keys', { error: err.message });
        res.status(500).json({ message: 'Failed to fetch API keys' });
    }
});

router.get('/logs', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const result = await db.pool.query(
            `SELECT al.*, ak.name as key_name, ak.app_name 
             FROM api_logs al 
             LEFT JOIN api_keys ak ON al.api_key_id = ak.id 
             WHERE al.username = $1 
             ORDER BY al.created_at DESC 
             LIMIT $2 OFFSET $3`,
            [req.session.user.username, limit, offset]
        );
        
        res.json({ logs: result.rows });
    } catch (err) {
        serverLogger.error('API', 'Failed to fetch API logs', { username: req.session.user.username, error: err.message });
        res.status(500).json({ message: 'Failed to fetch API logs' });
    }
});

router.get('/admin/logs', requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const username = req.query.username;
        
        let query = `SELECT al.*, ak.name as key_name, ak.app_name 
                     FROM api_logs al 
                     LEFT JOIN api_keys ak ON al.api_key_id = ak.id`;
        const params = [limit, offset];
        
        if (username) {
            query += ' WHERE al.username = $3';
            params.push(username);
        }
        
        query += ' ORDER BY al.created_at DESC LIMIT $1 OFFSET $2';
        
        const result = await db.pool.query(query, params);
        res.json({ logs: result.rows });
    } catch (err) {
        serverLogger.error('API', 'Failed to fetch admin API logs', { error: err.message });
        res.status(500).json({ message: 'Failed to fetch API logs' });
    }
});

router.get('/admin/server-logs', requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const level = req.query.level;
        const category = req.query.category;
        
        let query = 'SELECT * FROM server_logs WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (level) {
            query += ` AND level = $${paramIndex++}`;
            params.push(level);
        }
        
        if (category) {
            query += ` AND category = $${paramIndex++}`;
            params.push(category);
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);
        
        const result = await db.pool.query(query, params);
        res.json({ logs: result.rows });
    } catch (err) {
        serverLogger.error('API', 'Failed to fetch server logs', { error: err.message });
        res.status(500).json({ message: 'Failed to fetch server logs' });
    }
});

router.get('/admin/maintenance', requireAdmin, async (req, res) => {
    try {
        const result = await db.pool.query(
            "SELECT value FROM system_settings WHERE key = 'maintenance_mode'"
        );
        const maintenanceMode = result.rows[0]?.value === 'true';
        res.json({ maintenanceMode });
    } catch (err) {
        serverLogger.error('SYSTEM', 'Failed to get maintenance mode status', { error: err.message });
        res.status(500).json({ message: 'Failed to get maintenance mode status' });
    }
});

router.post('/admin/maintenance', requireAdmin, async (req, res) => {
    try {
        const { enabled } = req.body;
        
        await db.pool.query(
            "UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = 'maintenance_mode'",
            [enabled ? 'true' : 'false']
        );
        
        serverLogger.system('Maintenance mode toggled', { 
            enabled, 
            admin: req.session.user.username 
        });
        
        res.json({ success: true, maintenanceMode: enabled });
    } catch (err) {
        serverLogger.error('SYSTEM', 'Failed to toggle maintenance mode', { error: err.message });
        res.status(500).json({ message: 'Failed to toggle maintenance mode' });
    }
});

module.exports = router;
