const express = require('express');
const router = express.Router();
const pool = require('./database');

router.get('/servers/discover', async (req, res) => {
    try {
        const {
            search = '',
            minMembers = '0',
            maxMembers = '999999',
            sortBy = 'members',
            sortOrder = 'desc',
            limit = '20',
            offset = '0'
        } = req.query;

        const validSortBy = ['members', 'created_at', 'name'];
        const validSortOrder = ['asc', 'desc'];
        
        const sortColumn = validSortBy.includes(sortBy) ? sortBy : 'members';
        const order = validSortOrder.includes(sortOrder) ? sortOrder : 'desc';
        const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
        const offsetNum = Math.max(parseInt(offset) || 0, 0);
        const minMembersNum = Math.max(parseInt(minMembers) || 0, 0);
        const maxMembersNum = Math.max(parseInt(maxMembers) || 999999, 0);

        const searchTerm = search.trim();

        let countQuery = `
            SELECT COUNT(*) 
            FROM servers s
            LEFT JOIN (
                SELECT server_id, COUNT(*) as member_count
                FROM server_members
                GROUP BY server_id
            ) sm ON s.id = sm.server_id
            WHERE s.is_public = true
        `;

        const queryParams = [];
        let paramIndex = 1;

        if (searchTerm) {
            const searchPattern = `%${searchTerm}%`;
            countQuery += ` AND (s.name ILIKE $${paramIndex} OR COALESCE(s.description, '') ILIKE $${paramIndex})`;
            queryParams.push(searchPattern);
            paramIndex++;
        }

        countQuery += ` AND COALESCE(sm.member_count, 0) >= $${paramIndex}`;
        queryParams.push(minMembersNum);
        paramIndex++;

        countQuery += ` AND COALESCE(sm.member_count, 0) <= $${paramIndex}`;
        queryParams.push(maxMembersNum);
        paramIndex++;

        const countResult = await pool.query(countQuery, queryParams);
        const totalCount = parseInt(countResult.rows[0].count);

        const orderByMap = {
            members: 'member_count',
            created_at: 's.created_at',
            name: 's.name'
        };

        let serversQuery = `
            SELECT 
                s.id,
                s.name,
                s.description,
                s.icon,
                s.created_at,
                COALESCE(sm.member_count, 0) as member_count,
                COALESCE(ch.channel_count, 0) as channel_count,
                u.username as owner_username
            FROM servers s
            LEFT JOIN (
                SELECT server_id, COUNT(*) as member_count
                FROM server_members
                GROUP BY server_id
            ) sm ON s.id = sm.server_id
            LEFT JOIN (
                SELECT server_id, COUNT(*) as channel_count
                FROM channels
                GROUP BY server_id
            ) ch ON s.id = ch.server_id
            LEFT JOIN users u ON s.owner_username = u.username
            WHERE s.is_public = true
        `;

        const serversQueryParams = [];
        let serversParamIndex = 1;

        if (searchTerm) {
            const searchPattern = `%${searchTerm}%`;
            serversQuery += ` AND (s.name ILIKE $${serversParamIndex} OR COALESCE(s.description, '') ILIKE $${serversParamIndex})`;
            serversQueryParams.push(searchPattern);
            serversParamIndex++;
        }

        serversQuery += ` AND COALESCE(sm.member_count, 0) >= $${serversParamIndex}`;
        serversQueryParams.push(minMembersNum);
        serversParamIndex++;

        serversQuery += ` AND COALESCE(sm.member_count, 0) <= $${serversParamIndex}`;
        serversQueryParams.push(maxMembersNum);
        serversParamIndex++;

        serversQuery += ` ORDER BY ${orderByMap[sortColumn]} ${order.toUpperCase()}`;
        serversQuery += ` LIMIT $${serversParamIndex} OFFSET $${serversParamIndex + 1}`;
        serversQueryParams.push(limitNum, offsetNum);

        const serversResult = await pool.query(serversQuery, serversQueryParams);

        res.json({
            servers: serversResult.rows,
            pagination: {
                total: totalCount,
                limit: limitNum,
                offset: offsetNum,
                hasMore: offsetNum + limitNum < totalCount
            }
        });
    } catch (err) {
        console.error('Error fetching public servers:', err);
        res.status(500).json({ message: 'Failed to fetch public servers' });
    }
});

router.get('/servers/:serverId/preview', async (req, res) => {
    try {
        const { serverId } = req.params;

        const serverQuery = `
            SELECT 
                s.id,
                s.name,
                s.description,
                s.icon,
                s.is_public,
                s.created_at,
                u.username as owner_username,
                COALESCE(sm.member_count, 0) as member_count,
                COALESCE(ch.channel_count, 0) as channel_count
            FROM servers s
            LEFT JOIN users u ON s.owner_username = u.username
            LEFT JOIN (
                SELECT server_id, COUNT(*) as member_count
                FROM server_members
                GROUP BY server_id
            ) sm ON s.id = sm.server_id
            LEFT JOIN (
                SELECT server_id, COUNT(*) as channel_count
                FROM channels
                GROUP BY server_id
            ) ch ON s.id = ch.server_id
            WHERE s.id = $1 AND s.is_public = true
        `;

        const serverResult = await pool.query(serverQuery, [serverId]);

        if (!serverResult.rows.length) {
            return res.status(404).json({ message: 'Server not found or not public' });
        }

        const channelsQuery = `
            SELECT id, name, type, topic, position
            FROM channels
            WHERE server_id = $1
            ORDER BY position ASC
            LIMIT 5
        `;

        const channelsResult = await pool.query(channelsQuery, [serverId]);

        const rolesQuery = `
            SELECT id, name, color, position
            FROM roles
            WHERE server_id = $1
            ORDER BY position DESC
            LIMIT 5
        `;

        const rolesResult = await pool.query(rolesQuery, [serverId]);

        res.json({
            ...serverResult.rows[0],
            channels: channelsResult.rows,
            roles: rolesResult.rows
        });
    } catch (err) {
        console.error('Error fetching server preview:', err);
        res.status(500).json({ message: 'Failed to fetch server preview' });
    }
});

router.post('/servers/:serverId/join', async (req, res) => {
    try {
        const { serverId } = req.params;
        const username = req.session?.user?.username;

        if (!username) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const userExists = await pool.query(
            'SELECT username FROM users WHERE username = $1',
            [username]
        );

        if (!userExists.rows.length) {
            return res.status(403).json({ message: 'User account not found' });
        }

        const serverQuery = await pool.query(
            'SELECT id, name, is_public FROM servers WHERE id = $1',
            [serverId]
        );

        if (!serverQuery.rows.length) {
            return res.status(404).json({ message: 'Server not found' });
        }

        const server = serverQuery.rows[0];

        if (!server.is_public) {
            return res.status(403).json({ message: 'This server is private and requires an invite' });
        }

        const existingMember = await pool.query(
            'SELECT 1 FROM server_members WHERE server_id = $1 AND username = $2',
            [serverId, username]
        );

        if (existingMember.rows.length) {
            return res.status(400).json({ message: 'You are already a member of this server' });
        }

        await pool.query(
            'INSERT INTO server_members (server_id, username) VALUES ($1, $2)',
            [serverId, username]
        );

        const everyoneRole = await pool.query(
            'SELECT id FROM roles WHERE server_id = $1 AND name = $2',
            [serverId, '@everyone']
        );

        if (everyoneRole.rows.length) {
            await pool.query(
                'INSERT INTO user_roles (username, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [username, everyoneRole.rows[0].id]
            );
        }

        res.json({ 
            message: 'Successfully joined server',
            server: {
                id: server.id,
                name: server.name
            }
        });
    } catch (err) {
        console.error('Error joining server:', err);
        res.status(500).json({ message: 'Failed to join server' });
    }
});

module.exports = router;
