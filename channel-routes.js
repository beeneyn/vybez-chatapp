const express = require("express");
const router = express.Router();
const db = require("./database");
const { checkServerOwnership, checkServerPermission } = require("./server-roles-routes");

const CHANNEL_TYPES = ['text', 'voice', 'announcements'];

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
};

router.get('/servers/:serverId/channels', requireAuth, async (req, res) => {
    try {
        const { serverId } = req.params;
        const username = req.session.user.username;

        const isMember = await db.pool.query(`
            SELECT 1 FROM server_members sm 
            JOIN users u ON sm.username = u.username 
            WHERE sm.server_id = $1 AND sm.username = $2
        `, [serverId, username]);

        if (isMember.rows.length === 0) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const channels = await db.pool.query(`
            SELECT id, name, topic, type, position, created_at
            FROM channels
            WHERE server_id = $1
            ORDER BY position ASC, created_at ASC
        `, [serverId]);

        res.json({ channels: channels.rows });
    } catch (err) {
        console.error('Error fetching channels:', err);
        res.status(500).json({ message: 'Failed to fetch channels' });
    }
});

router.get('/servers/:serverId/channels/:channelId', requireAuth, async (req, res) => {
    try {
        const { serverId, channelId } = req.params;
        const username = req.session.user.username;

        const isMember = await db.pool.query(`
            SELECT 1 FROM server_members sm 
            JOIN users u ON sm.username = u.username 
            WHERE sm.server_id = $1 AND sm.username = $2
        `, [serverId, username]);

        if (isMember.rows.length === 0) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const channel = await db.pool.query(`
            SELECT id, name, topic, type, position, created_at
            FROM channels
            WHERE id = $1 AND server_id = $2
        `, [channelId, serverId]);

        if (channel.rows.length === 0) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        res.json({ channel: channel.rows[0] });
    } catch (err) {
        console.error('Error fetching channel:', err);
        res.status(500).json({ message: 'Failed to fetch channel' });
    }
});

router.post('/servers/:serverId/channels', requireAuth, async (req, res) => {
    try {
        const { serverId } = req.params;
        const { name, topic, type } = req.body;
        const username = req.session.user.username;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Channel name is required' });
        }

        if (name.length > 100) {
            return res.status(400).json({ message: 'Channel name must be 100 characters or less' });
        }

        if (type && !CHANNEL_TYPES.includes(type)) {
            return res.status(400).json({ 
                message: `Invalid channel type. Must be one of: ${CHANNEL_TYPES.join(', ')}` 
            });
        }

        if (topic && topic.length > 1000) {
            return res.status(400).json({ message: 'Channel topic must be 1000 characters or less' });
        }

        const isMember = await db.pool.query(`
            SELECT 1 FROM server_members sm 
            JOIN users u ON sm.username = u.username 
            WHERE sm.server_id = $1 AND sm.username = $2
        `, [serverId, username]);

        if (!isMember.rows.length) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const isOwner = await checkServerOwnership(username, serverId);
        const hasPermission = await checkServerPermission(username, serverId, 'create_channels');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to create channels' });
        }

        const maxPosition = await db.pool.query(
            'SELECT COALESCE(MAX(position), -1) as max_pos FROM channels WHERE server_id = $1',
            [serverId]
        );
        const newPosition = maxPosition.rows[0].max_pos + 1;

        const channelResult = await db.pool.query(
            'INSERT INTO channels (server_id, name, topic, type, position) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [serverId, name.trim(), topic?.trim() || null, type || 'text', newPosition]
        );

        res.json({ 
            message: 'Channel created successfully', 
            channel: channelResult.rows[0]
        });
    } catch (err) {
        console.error('Error creating channel:', err);
        res.status(500).json({ message: 'Failed to create channel' });
    }
});

router.put('/servers/:serverId/channels/:channelId', requireAuth, async (req, res) => {
    try {
        const { serverId, channelId } = req.params;
        const { name, topic, type } = req.body;
        const username = req.session.user.username;

        const isMember = await db.pool.query(`
            SELECT 1 FROM server_members sm 
            JOIN users u ON sm.username = u.username 
            WHERE sm.server_id = $1 AND sm.username = $2
        `, [serverId, username]);

        if (!isMember.rows.length) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const isOwner = await checkServerOwnership(username, serverId);
        const hasPermission = await checkServerPermission(username, serverId, 'manage_channels');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to edit channels' });
        }

        const channelCheck = await db.pool.query(
            'SELECT id FROM channels WHERE id = $1 AND server_id = $2',
            [channelId, serverId]
        );

        if (channelCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        if (name !== undefined) {
            if (name.trim().length === 0) {
                return res.status(400).json({ message: 'Channel name cannot be empty' });
            }
            if (name.length > 100) {
                return res.status(400).json({ message: 'Channel name must be 100 characters or less' });
            }
            await db.pool.query('UPDATE channels SET name = $1 WHERE id = $2', [name.trim(), channelId]);
        }

        if (topic !== undefined) {
            if (topic && topic.length > 1000) {
                return res.status(400).json({ message: 'Channel topic must be 1000 characters or less' });
            }
            await db.pool.query('UPDATE channels SET topic = $1 WHERE id = $2', [topic?.trim() || null, channelId]);
        }

        if (type !== undefined) {
            if (!CHANNEL_TYPES.includes(type)) {
                return res.status(400).json({ 
                    message: `Invalid channel type. Must be one of: ${CHANNEL_TYPES.join(', ')}` 
                });
            }
            await db.pool.query('UPDATE channels SET type = $1 WHERE id = $2', [type, channelId]);
        }

        const updatedChannel = await db.pool.query(
            'SELECT * FROM channels WHERE id = $1',
            [channelId]
        );

        res.json({ 
            message: 'Channel updated successfully', 
            channel: updatedChannel.rows[0]
        });
    } catch (err) {
        console.error('Error updating channel:', err);
        res.status(500).json({ message: 'Failed to update channel' });
    }
});

router.delete('/servers/:serverId/channels/:channelId', requireAuth, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { serverId, channelId } = req.params;
        const username = req.session.user.username;

        const isMember = await client.query(`
            SELECT 1 FROM server_members sm 
            JOIN users u ON sm.username = u.username 
            WHERE sm.server_id = $1 AND sm.username = $2
        `, [serverId, username]);

        if (!isMember.rows.length) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const isOwner = await checkServerOwnership(username, serverId);
        const hasPermission = await checkServerPermission(username, serverId, 'delete_channels');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to delete channels' });
        }

        const channelCheck = await client.query(
            'SELECT id, name FROM channels WHERE id = $1 AND server_id = $2',
            [channelId, serverId]
        );

        if (channelCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        const channelCount = await client.query(
            'SELECT COUNT(*) as count FROM channels WHERE server_id = $1',
            [serverId]
        );

        if (parseInt(channelCount.rows[0].count) <= 1) {
            return res.status(400).json({ message: 'Cannot delete the last channel in a server' });
        }

        await client.query('BEGIN');

        await client.query('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id = $1)', [channelId]);
        await client.query('DELETE FROM message_edits WHERE message_id IN (SELECT id FROM messages WHERE channel_id = $1)', [channelId]);
        await client.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
        await client.query('DELETE FROM channels WHERE id = $1', [channelId]);

        await client.query('COMMIT');

        res.json({ message: 'Channel deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting channel:', err);
        res.status(500).json({ message: 'Failed to delete channel' });
    } finally {
        client.release();
    }
});

router.put('/servers/:serverId/channels/:channelId/position', requireAuth, async (req, res) => {
    try {
        const { serverId, channelId } = req.params;
        const { position } = req.body;
        const username = req.session.user.username;

        if (position === undefined || position === null) {
            return res.status(400).json({ message: 'Position is required' });
        }

        if (!Number.isInteger(position) || position < 0) {
            return res.status(400).json({ message: 'Position must be a non-negative integer' });
        }

        const isMember = await db.pool.query(`
            SELECT 1 FROM server_members sm 
            JOIN users u ON sm.username = u.username 
            WHERE sm.server_id = $1 AND sm.username = $2
        `, [serverId, username]);

        if (!isMember.rows.length) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const isOwner = await checkServerOwnership(username, serverId);
        const hasPermission = await checkServerPermission(username, serverId, 'manage_channels');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to reorder channels' });
        }

        const channelCheck = await db.pool.query(
            'SELECT id FROM channels WHERE id = $1 AND server_id = $2',
            [channelId, serverId]
        );

        if (channelCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        await db.pool.query('UPDATE channels SET position = $1 WHERE id = $2', [position, channelId]);

        const updatedChannels = await db.pool.query(`
            SELECT id, name, type, position
            FROM channels
            WHERE server_id = $1
            ORDER BY position ASC, created_at ASC
        `, [serverId]);

        res.json({ 
            message: 'Channel position updated successfully',
            channels: updatedChannels.rows
        });
    } catch (err) {
        console.error('Error updating channel position:', err);
        res.status(500).json({ message: 'Failed to update channel position' });
    }
});

router.post('/servers/:serverId/channels/reorder', requireAuth, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { serverId } = req.params;
        const { channelOrder } = req.body;
        const username = req.session.user.username;

        if (!Array.isArray(channelOrder)) {
            return res.status(400).json({ message: 'channelOrder must be an array' });
        }

        const isMember = await client.query(`
            SELECT 1 FROM server_members sm 
            JOIN users u ON sm.username = u.username 
            WHERE sm.server_id = $1 AND sm.username = $2
        `, [serverId, username]);

        if (!isMember.rows.length) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const isOwner = await checkServerOwnership(username, serverId);
        const hasPermission = await checkServerPermission(username, serverId, 'manage_channels');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to reorder channels' });
        }

        await client.query('BEGIN');

        const channelValidation = await client.query(
            'SELECT id FROM channels WHERE server_id = $1',
            [serverId]
        );
        const validChannelIds = new Set(channelValidation.rows.map(row => row.id));

        for (const channelId of channelOrder) {
            if (!validChannelIds.has(channelId)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Invalid channel ID in reorder list' });
            }
        }

        for (let i = 0; i < channelOrder.length; i++) {
            const channelId = channelOrder[i];
            await client.query(
                'UPDATE channels SET position = $1 WHERE id = $2 AND server_id = $3',
                [i, channelId, serverId]
            );
        }

        await client.query('COMMIT');

        const updatedChannels = await client.query(`
            SELECT id, name, type, position
            FROM channels
            WHERE server_id = $1
            ORDER BY position ASC, created_at ASC
        `, [serverId]);

        res.json({ 
            message: 'Channels reordered successfully',
            channels: updatedChannels.rows
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error reordering channels:', err);
        res.status(500).json({ message: 'Failed to reorder channels' });
    } finally {
        client.release();
    }
});

module.exports = router;
