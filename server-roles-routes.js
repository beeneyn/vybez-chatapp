const express = require("express");
const router = express.Router();
const db = require("./database");

const PERMISSION_TYPES = [
    'read_messages',
    'send_messages',
    'manage_messages',
    'mention_everyone',
    'add_reactions',
    'read_history',
    'attach_files',
    'create_channels',
    'manage_channels',
    'delete_channels',
    'invite_members',
    'kick_members',
    'ban_members',
    'manage_roles',
    'manage_server',
    'administrator'
];

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
};

async function checkServerPermission(username, serverId, permission) {
    try {
        const result = await db.pool.query(`
            SELECT rp.permission_name
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            JOIN role_permissions rp ON r.id = rp.role_id
            WHERE ur.username = $1 AND r.server_id = $2 AND rp.permission_name = $3
            LIMIT 1
        `, [username, serverId, permission]);

        if (result.rows.length > 0) return true;

        const adminResult = await db.pool.query(`
            SELECT rp.permission_name
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            JOIN role_permissions rp ON r.id = rp.role_id
            WHERE ur.username = $1 AND r.server_id = $2 AND rp.permission_name = 'administrator'
            LIMIT 1
        `, [username, serverId]);

        return adminResult.rows.length > 0;
    } catch (err) {
        console.error('Permission check error:', err);
        return false;
    }
}

async function checkServerOwnership(username, serverId) {
    try {
        const result = await db.pool.query(
            'SELECT owner_username FROM servers WHERE id = $1 AND owner_username = $2',
            [serverId, username]
        );
        return result.rows.length > 0;
    } catch (err) {
        console.error('Ownership check error:', err);
        return false;
    }
}

router.get('/servers/:serverId/roles', requireAuth, async (req, res) => {
    try {
        const { serverId } = req.params;
        
        const memberCheck = await db.pool.query(
            'SELECT 1 FROM server_members WHERE server_id = $1 AND username = $2',
            [serverId, req.session.user.username]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const roles = await db.pool.query(`
            SELECT r.id, r.name, r.color, r.position, r.mentionable,
                   COALESCE(
                       json_agg(
                           DISTINCT rp.permission_name
                       ) FILTER (WHERE rp.permission_name IS NOT NULL),
                       '[]'
                   ) as permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            WHERE r.server_id = $1
            GROUP BY r.id, r.name, r.color, r.position, r.mentionable
            ORDER BY r.position DESC
        `, [serverId]);

        res.json({ roles: roles.rows });
    } catch (err) {
        console.error('Error fetching roles:', err);
        res.status(500).json({ message: 'Failed to fetch roles' });
    }
});

router.post('/servers/:serverId/roles', requireAuth, async (req, res) => {
    try {
        const { serverId } = req.params;
        const { name, color, permissions } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Role name is required' });
        }

        if (name.length > 100) {
            return res.status(400).json({ message: 'Role name must be 100 characters or less' });
        }

        const isOwner = await checkServerOwnership(req.session.user.username, serverId);
        const hasPermission = await checkServerPermission(req.session.user.username, serverId, 'manage_roles');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to create roles' });
        }

        const maxPosition = await db.pool.query(
            'SELECT COALESCE(MAX(position), 0) as max_pos FROM roles WHERE server_id = $1',
            [serverId]
        );
        const newPosition = maxPosition.rows[0].max_pos + 1;

        const roleResult = await db.pool.query(
            'INSERT INTO roles (server_id, name, color, position, mentionable) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [serverId, name.trim(), color || '#99AAB5', newPosition, false]
        );

        const role = roleResult.rows[0];

        if (permissions && Array.isArray(permissions)) {
            const validPermissions = permissions.filter(p => PERMISSION_TYPES.includes(p));
            for (const permission of validPermissions) {
                await db.pool.query(
                    'INSERT INTO role_permissions (role_id, permission_name) VALUES ($1, $2)',
                    [role.id, permission]
                );
            }
        }

        res.json({ 
            message: 'Role created successfully', 
            role: { ...role, permissions: permissions || [] }
        });
    } catch (err) {
        console.error('Error creating role:', err);
        res.status(500).json({ message: 'Failed to create role' });
    }
});

router.put('/servers/:serverId/roles/:roleId', requireAuth, async (req, res) => {
    try {
        const { serverId, roleId } = req.params;
        const { name, color, permissions, mentionable } = req.body;

        const isOwner = await checkServerOwnership(req.session.user.username, serverId);
        const hasPermission = await checkServerPermission(req.session.user.username, serverId, 'manage_roles');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to edit roles' });
        }

        const roleCheck = await db.pool.query(
            'SELECT id FROM roles WHERE id = $1 AND server_id = $2',
            [roleId, serverId]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (name !== undefined) {
            if (name.trim().length === 0) {
                return res.status(400).json({ message: 'Role name cannot be empty' });
            }
            if (name.length > 100) {
                return res.status(400).json({ message: 'Role name must be 100 characters or less' });
            }
            await db.pool.query('UPDATE roles SET name = $1 WHERE id = $2', [name.trim(), roleId]);
        }

        if (color !== undefined) {
            await db.pool.query('UPDATE roles SET color = $1 WHERE id = $2', [color, roleId]);
        }

        if (mentionable !== undefined) {
            await db.pool.query('UPDATE roles SET mentionable = $1 WHERE id = $2', [mentionable, roleId]);
        }

        if (permissions !== undefined && Array.isArray(permissions)) {
            await db.pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
            
            const validPermissions = permissions.filter(p => PERMISSION_TYPES.includes(p));
            for (const permission of validPermissions) {
                await db.pool.query(
                    'INSERT INTO role_permissions (role_id, permission_name) VALUES ($1, $2)',
                    [roleId, permission]
                );
            }
        }

        const updatedRole = await db.pool.query(`
            SELECT r.*, 
                   COALESCE(
                       json_agg(
                           DISTINCT rp.permission_name
                       ) FILTER (WHERE rp.permission_name IS NOT NULL),
                       '[]'
                   ) as permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            WHERE r.id = $1
            GROUP BY r.id
        `, [roleId]);

        res.json({ 
            message: 'Role updated successfully', 
            role: updatedRole.rows[0]
        });
    } catch (err) {
        console.error('Error updating role:', err);
        res.status(500).json({ message: 'Failed to update role' });
    }
});

router.delete('/servers/:serverId/roles/:roleId', requireAuth, async (req, res) => {
    try {
        const { serverId, roleId } = req.params;

        const isOwner = await checkServerOwnership(req.session.user.username, serverId);
        const hasPermission = await checkServerPermission(req.session.user.username, serverId, 'manage_roles');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to delete roles' });
        }

        const roleCheck = await db.pool.query(
            'SELECT id FROM roles WHERE id = $1 AND server_id = $2',
            [roleId, serverId]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        await db.pool.query('DELETE FROM user_roles WHERE role_id = $1', [roleId]);
        await db.pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
        await db.pool.query('DELETE FROM roles WHERE id = $1', [roleId]);

        res.json({ message: 'Role deleted successfully' });
    } catch (err) {
        console.error('Error deleting role:', err);
        res.status(500).json({ message: 'Failed to delete role' });
    }
});

router.get('/servers/:serverId/members/:username/roles', requireAuth, async (req, res) => {
    try {
        const { serverId, username } = req.params;

        const memberCheck = await db.pool.query(
            'SELECT 1 FROM server_members WHERE server_id = $1 AND username = $2',
            [serverId, req.session.user.username]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const roles = await db.pool.query(`
            SELECT r.id, r.name, r.color, r.position
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.username = $1 AND r.server_id = $2
            ORDER BY r.position DESC
        `, [username, serverId]);

        res.json({ roles: roles.rows });
    } catch (err) {
        console.error('Error fetching user roles:', err);
        res.status(500).json({ message: 'Failed to fetch user roles' });
    }
});

router.post('/servers/:serverId/members/:username/roles/:roleId', requireAuth, async (req, res) => {
    try {
        const { serverId, username, roleId } = req.params;

        const isOwner = await checkServerOwnership(req.session.user.username, serverId);
        const hasPermission = await checkServerPermission(req.session.user.username, serverId, 'manage_roles');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to assign roles' });
        }

        const roleCheck = await db.pool.query(
            'SELECT id FROM roles WHERE id = $1 AND server_id = $2',
            [roleId, serverId]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        const memberCheck = await db.pool.query(
            'SELECT 1 FROM server_members WHERE server_id = $1 AND username = $2',
            [serverId, username]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(404).json({ message: 'User is not a member of this server' });
        }

        const existingRole = await db.pool.query(
            'SELECT 1 FROM user_roles WHERE username = $1 AND role_id = $2',
            [username, roleId]
        );

        if (existingRole.rows.length > 0) {
            return res.status(400).json({ message: 'User already has this role' });
        }

        await db.pool.query(
            'INSERT INTO user_roles (username, role_id) VALUES ($1, $2)',
            [username, roleId]
        );

        res.json({ message: 'Role assigned successfully' });
    } catch (err) {
        console.error('Error assigning role:', err);
        res.status(500).json({ message: 'Failed to assign role' });
    }
});

router.delete('/servers/:serverId/members/:username/roles/:roleId', requireAuth, async (req, res) => {
    try {
        const { serverId, username, roleId } = req.params;

        const isOwner = await checkServerOwnership(req.session.user.username, serverId);
        const hasPermission = await checkServerPermission(req.session.user.username, serverId, 'manage_roles');

        if (!isOwner && !hasPermission) {
            return res.status(403).json({ message: 'Insufficient permissions to remove roles' });
        }

        const roleCheck = await db.pool.query(
            'SELECT id FROM roles WHERE id = $1 AND server_id = $2',
            [roleId, serverId]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        await db.pool.query(
            'DELETE FROM user_roles WHERE username = $1 AND role_id = $2',
            [username, roleId]
        );

        res.json({ message: 'Role removed successfully' });
    } catch (err) {
        console.error('Error removing role:', err);
        res.status(500).json({ message: 'Failed to remove role' });
    }
});

router.get('/servers/:serverId/permissions/:username', requireAuth, async (req, res) => {
    try {
        const { serverId, username } = req.params;

        const memberCheck = await db.pool.query(
            'SELECT 1 FROM server_members WHERE server_id = $1 AND username = $2',
            [serverId, req.session.user.username]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Not a member of this server' });
        }

        const ownerCheck = await db.pool.query(
            'SELECT 1 FROM servers WHERE id = $1 AND owner_username = $2',
            [serverId, username]
        );

        if (ownerCheck.rows.length > 0) {
            return res.json({ permissions: PERMISSION_TYPES });
        }

        const permissions = await db.pool.query(`
            SELECT DISTINCT rp.permission_name
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            JOIN role_permissions rp ON r.id = rp.role_id
            WHERE ur.username = $1 AND r.server_id = $2
        `, [username, serverId]);

        const permissionList = permissions.rows.map(row => row.permission_name);

        if (permissionList.includes('administrator')) {
            return res.json({ permissions: PERMISSION_TYPES });
        }

        res.json({ permissions: permissionList });
    } catch (err) {
        console.error('Error fetching permissions:', err);
        res.status(500).json({ message: 'Failed to fetch permissions' });
    }
});

router.get('/permission-types', requireAuth, (req, res) => {
    res.json({ 
        permissions: PERMISSION_TYPES,
        descriptions: {
            read_messages: 'View messages in channels',
            send_messages: 'Send messages in channels',
            manage_messages: 'Delete and edit other users\' messages',
            mention_everyone: 'Mention @everyone and @here',
            add_reactions: 'Add reactions to messages',
            read_history: 'Read message history',
            attach_files: 'Upload files and media',
            create_channels: 'Create new channels',
            manage_channels: 'Edit and delete channels',
            delete_channels: 'Delete channels',
            invite_members: 'Invite new members to the server',
            kick_members: 'Remove members from the server',
            ban_members: 'Ban members from the server',
            manage_roles: 'Create, edit, and delete roles',
            manage_server: 'Change server name, icon, and settings',
            administrator: 'All permissions (bypass all checks)'
        }
    });
});

module.exports = {
    router,
    checkServerPermission,
    checkServerOwnership,
    PERMISSION_TYPES
};
