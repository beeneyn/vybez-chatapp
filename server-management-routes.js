const express = require("express");
const router = express.Router();
const db = require("./database");
const { checkServerOwnership, checkServerPermission } = require("./server-roles-routes");

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
};

router.get('/servers', requireAuth, async (req, res) => {
    try {
        const username = req.session.user.username;
        
        const servers = await db.pool.query(`
            SELECT DISTINCT s.id, s.name, s.description, s.icon, s.is_public, s.owner_username, s.created_at,
                   (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count,
                   (s.owner_username = $1) as is_owner
            FROM servers s
            LEFT JOIN server_members sm ON s.id = sm.server_id
            WHERE sm.username = $1 OR s.owner_username = $1
            ORDER BY s.created_at DESC
        `, [username]);

        res.json({ servers: servers.rows });
    } catch (err) {
        console.error('Error fetching servers:', err);
        res.status(500).json({ message: 'Failed to fetch servers' });
    }
});

router.get('/servers/:serverId', requireAuth, async (req, res) => {
    try {
        const { serverId } = req.params;
        const username = req.session.user.username;

        const server = await db.pool.query(`
            SELECT s.id, s.name, s.description, s.icon, s.is_public, s.owner_username, s.created_at,
                   (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count,
                   (s.owner_username = $1) as is_owner,
                   EXISTS(SELECT 1 FROM server_members WHERE server_id = s.id AND username = $1) as is_member
            FROM servers s
            WHERE s.id = $2
        `, [username, serverId]);

        if (server.rows.length === 0) {
            return res.status(404).json({ message: 'Server not found' });
        }

        const serverData = server.rows[0];

        if (!serverData.is_public && !serverData.is_member && !serverData.is_owner) {
            return res.status(403).json({ message: 'This server is private' });
        }

        res.json({ server: serverData });
    } catch (err) {
        console.error('Error fetching server:', err);
        res.status(500).json({ message: 'Failed to fetch server' });
    }
});

router.post('/servers', requireAuth, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { name, description, icon, is_public } = req.body;
        const username = req.session.user.username;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Server name is required' });
        }

        if (name.length > 100) {
            return res.status(400).json({ message: 'Server name must be 100 characters or less' });
        }

        if (description && description.length > 500) {
            return res.status(400).json({ message: 'Server description must be 500 characters or less' });
        }

        await client.query('BEGIN');

        const serverResult = await client.query(
            'INSERT INTO servers (name, description, icon, is_public, owner_username) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name.trim(), description?.trim() || null, icon || null, is_public !== false, username]
        );

        const server = serverResult.rows[0];

        await client.query(
            'INSERT INTO server_members (server_id, username) VALUES ($1, $2)',
            [server.id, username]
        );

        const everyoneRole = await client.query(
            'INSERT INTO roles (server_id, name, color, position, mentionable) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [server.id, '@everyone', '#99AAB5', 0, false]
        );

        const basicPermissions = ['read_messages', 'send_messages', 'read_history', 'add_reactions'];
        for (const permission of basicPermissions) {
            await client.query(
                'INSERT INTO role_permissions (role_id, permission_name) VALUES ($1, $2)',
                [everyoneRole.rows[0].id, permission]
            );
        }

        await client.query(
            'INSERT INTO user_roles (username, role_id) VALUES ($1, $2)',
            [username, everyoneRole.rows[0].id]
        );

        const adminRole = await client.query(
            'INSERT INTO roles (server_id, name, color, position, mentionable) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [server.id, 'Admin', '#E94EFF', 100, true]
        );

        const adminPermissions = [
            'administrator',
            'create_channels',
            'manage_channels',
            'delete_channels',
            'manage_server',
            'manage_roles'
        ];
        for (const permission of adminPermissions) {
            await client.query(
                'INSERT INTO role_permissions (role_id, permission_name) VALUES ($1, $2)',
                [adminRole.rows[0].id, permission]
            );
        }

        await client.query(
            'INSERT INTO user_roles (username, role_id) VALUES ($1, $2)',
            [username, adminRole.rows[0].id]
        );

        const generalChannel = await client.query(
            'INSERT INTO channels (server_id, name, type, position) VALUES ($1, $2, $3, $4) RETURNING *',
            [server.id, 'general', 'text', 0]
        );

        await client.query('COMMIT');

        res.json({ 
            message: 'Server created successfully', 
            server: {
                ...server,
                channels: [generalChannel.rows[0]],
                roles: [everyoneRole.rows[0], adminRole.rows[0]]
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating server:', err);
        res.status(500).json({ message: 'Failed to create server' });
    } finally {
        client.release();
    }
});

router.put('/servers/:serverId', requireAuth, async (req, res) => {
    try {
        const { serverId } = req.params;
        const { name, description, icon, is_public } = req.body;
        const username = req.session.user.username;

        const isOwner = await checkServerOwnership(username, serverId);
        const hasPermission = await checkServerPermission(username, serverId, 'manage_server');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to edit server' });
        }

        if (name !== undefined) {
            if (name.trim().length === 0) {
                return res.status(400).json({ message: 'Server name cannot be empty' });
            }
            if (name.length > 100) {
                return res.status(400).json({ message: 'Server name must be 100 characters or less' });
            }
            await db.pool.query('UPDATE servers SET name = $1 WHERE id = $2', [name.trim(), serverId]);
        }

        if (description !== undefined) {
            if (description && description.length > 500) {
                return res.status(400).json({ message: 'Server description must be 500 characters or less' });
            }
            await db.pool.query('UPDATE servers SET description = $1 WHERE id = $2', [description?.trim() || null, serverId]);
        }

        if (icon !== undefined) {
            await db.pool.query('UPDATE servers SET icon = $1 WHERE id = $2', [icon || null, serverId]);
        }

        if (is_public !== undefined && isOwner) {
            await db.pool.query('UPDATE servers SET is_public = $1 WHERE id = $2', [is_public, serverId]);
        }

        const updatedServer = await db.pool.query(
            'SELECT * FROM servers WHERE id = $1',
            [serverId]
        );

        res.json({ 
            message: 'Server updated successfully', 
            server: updatedServer.rows[0]
        });
    } catch (err) {
        console.error('Error updating server:', err);
        res.status(500).json({ message: 'Failed to update server' });
    }
});

router.delete('/servers/:serverId', requireAuth, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { serverId } = req.params;
        const username = req.session.user.username;

        const isOwner = await checkServerOwnership(username, serverId);

        if (!isOwner) {
            return res.status(403).json({ message: 'Only the server owner can delete the server' });
        }

        await client.query('BEGIN');

        await client.query('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = $1))', [serverId]);
        await client.query('DELETE FROM message_edits WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = $1))', [serverId]);
        await client.query('DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = $1)', [serverId]);
        await client.query('DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE server_id = $1)', [serverId]);
        await client.query('DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE server_id = $1)', [serverId]);
        await client.query('DELETE FROM roles WHERE server_id = $1', [serverId]);
        await client.query('DELETE FROM channels WHERE server_id = $1', [serverId]);
        await client.query('DELETE FROM server_members WHERE server_id = $1', [serverId]);
        await client.query('DELETE FROM servers WHERE id = $1', [serverId]);

        await client.query('COMMIT');

        res.json({ message: 'Server deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting server:', err);
        res.status(500).json({ message: 'Failed to delete server' });
    } finally {
        client.release();
    }
});

router.post('/servers/:serverId/join', requireAuth, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { serverId } = req.params;
        const username = req.session.user.username;

        const server = await client.query(
            'SELECT id, is_public FROM servers WHERE id = $1',
            [serverId]
        );

        if (server.rows.length === 0) {
            return res.status(404).json({ message: 'Server not found' });
        }

        if (!server.rows[0].is_public) {
            return res.status(403).json({ message: 'This server is private. You need an invitation to join.' });
        }

        const existingMember = await client.query(
            'SELECT 1 FROM server_members WHERE server_id = $1 AND username = $2',
            [serverId, username]
        );

        if (existingMember.rows.length > 0) {
            return res.status(400).json({ message: 'You are already a member of this server' });
        }

        await client.query('BEGIN');

        await client.query(
            'INSERT INTO server_members (server_id, username) VALUES ($1, $2)',
            [serverId, username]
        );

        const everyoneRole = await client.query(
            'SELECT id FROM roles WHERE server_id = $1 AND name = $2',
            [serverId, '@everyone']
        );

        if (everyoneRole.rows.length > 0) {
            await client.query(
                'INSERT INTO user_roles (username, role_id) VALUES ($1, $2)',
                [username, everyoneRole.rows[0].id]
            );
        }

        await client.query('COMMIT');

        res.json({ message: 'Successfully joined the server' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error joining server:', err);
        res.status(500).json({ message: 'Failed to join server' });
    } finally {
        client.release();
    }
});

router.post('/servers/:serverId/leave', requireAuth, async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { serverId } = req.params;
        const username = req.session.user.username;

        const isOwner = await checkServerOwnership(username, serverId);

        if (isOwner) {
            return res.status(400).json({ message: 'Server owners cannot leave. Transfer ownership or delete the server instead.' });
        }

        const isMember = await client.query(
            'SELECT 1 FROM server_members WHERE server_id = $1 AND username = $2',
            [serverId, username]
        );

        if (isMember.rows.length === 0) {
            return res.status(400).json({ message: 'You are not a member of this server' });
        }

        await client.query('BEGIN');

        await client.query(
            'DELETE FROM user_roles WHERE username = $1 AND role_id IN (SELECT id FROM roles WHERE server_id = $2)',
            [username, serverId]
        );

        await client.query(
            'DELETE FROM server_members WHERE server_id = $1 AND username = $2',
            [serverId, username]
        );

        await client.query('COMMIT');

        res.json({ message: 'Successfully left the server' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error leaving server:', err);
        res.status(500).json({ message: 'Failed to leave server' });
    } finally {
        client.release();
    }
});

router.get('/servers/:serverId/members', requireAuth, async (req, res) => {
    try {
        const { serverId } = req.params;
        const username = req.session.user.username;

        const isMember = await db.pool.query(
            'SELECT 1 FROM server_members WHERE server_id = $1 AND username = $2',
            [serverId, username]
        );

        if (isMember.rows.length === 0) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const members = await db.pool.query(`
            SELECT sm.username, sm.nickname, sm.joined_at, u.avatar,
                   (s.owner_username = sm.username) as is_owner,
                   COALESCE(
                       json_agg(
                           json_build_object('id', r.id, 'name', r.name, 'color', r.color)
                       ) FILTER (WHERE r.id IS NOT NULL),
                       '[]'
                   ) as roles
            FROM server_members sm
            JOIN users u ON sm.username = u.username
            LEFT JOIN servers s ON sm.server_id = s.id
            LEFT JOIN user_roles ur ON sm.username = ur.username
            LEFT JOIN roles r ON ur.role_id = r.id AND r.server_id = sm.server_id
            WHERE sm.server_id = $1
            GROUP BY sm.username, sm.nickname, sm.joined_at, u.avatar, s.owner_username
            ORDER BY is_owner DESC, sm.joined_at ASC
        `, [serverId]);

        res.json({ members: members.rows });
    } catch (err) {
        console.error('Error fetching members:', err);
        res.status(500).json({ message: 'Failed to fetch members' });
    }
});

module.exports = router;
