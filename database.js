const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT UNIQUE,
                chat_color TEXT DEFAULT '#000000',
                bio TEXT DEFAULT 'No bio yet.',
                status TEXT DEFAULT 'Online',
                avatar_url TEXT DEFAULT NULL,
                role TEXT DEFAULT 'user'
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                room TEXT NOT NULL,
                username TEXT NOT NULL,
                message_text TEXT,
                chat_color TEXT,
                timestamp TIMESTAMP NOT NULL,
                file_url TEXT DEFAULT NULL,
                file_type TEXT DEFAULT NULL
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS reactions (
                id SERIAL PRIMARY KEY,
                message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
                username TEXT NOT NULL,
                emoji TEXT NOT NULL
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS private_messages (
                id SERIAL PRIMARY KEY,
                from_user TEXT NOT NULL,
                to_user TEXT NOT NULL,
                message_text TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                read INTEGER DEFAULT 0
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS read_receipts (
                id SERIAL PRIMARY KEY,
                message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
                username TEXT NOT NULL,
                read_at TIMESTAMP NOT NULL
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                created_by TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_default BOOLEAN DEFAULT FALSE
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS warnings (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                warned_by TEXT NOT NULL,
                reason TEXT NOT NULL,
                message_evidence TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS mutes (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                muted_by TEXT NOT NULL,
                reason TEXT NOT NULL,
                message_evidence TEXT DEFAULT NULL,
                duration_minutes INTEGER NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS bans (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                banned_by TEXT NOT NULL,
                reason TEXT NOT NULL,
                message_evidence TEXT DEFAULT NULL,
                is_permanent BOOLEAN DEFAULT FALSE,
                expires_at TIMESTAMP DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_notifications (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                type TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP DEFAULT NULL
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS blocked_users (
                id SERIAL PRIMARY KEY,
                blocker_username TEXT NOT NULL,
                blocked_username TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(blocker_username, blocked_username)
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS support_tickets (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT DEFAULT 'open',
                priority TEXT DEFAULT 'normal',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                admin_response TEXT,
                responded_by TEXT
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                api_key TEXT UNIQUE NOT NULL,
                app_name TEXT NOT NULL,
                description TEXT DEFAULT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                last_used_at TIMESTAMP DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                rate_limit INTEGER DEFAULT 100
            )
        `);
        
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_keys' AND column_name='key_hash') THEN
                    ALTER TABLE api_keys ADD COLUMN key_hash TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_keys' AND column_name='name') THEN
                    ALTER TABLE api_keys ADD COLUMN name TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_keys' AND column_name='scopes') THEN
                    ALTER TABLE api_keys ADD COLUMN scopes JSONB DEFAULT '[]'::jsonb;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_keys' AND column_name='rate_limit_tier') THEN
                    ALTER TABLE api_keys ADD COLUMN rate_limit_tier TEXT DEFAULT 'standard';
                END IF;
            END $$;
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS api_logs (
                id SERIAL PRIMARY KEY,
                api_key_id INTEGER,
                username TEXT,
                route TEXT NOT NULL,
                method TEXT NOT NULL,
                status_code INTEGER,
                latency_ms INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS server_logs (
                id SERIAL PRIMARY KEY,
                level TEXT NOT NULL,
                category TEXT NOT NULL,
                message TEXT NOT NULL,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_api_logs_api_key_id ON api_logs(api_key_id);
            CREATE INDEX IF NOT EXISTS idx_server_logs_created_at ON server_logs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_server_logs_level ON server_logs(level);
            CREATE INDEX IF NOT EXISTS idx_server_logs_category ON server_logs(category);
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            INSERT INTO system_settings (key, value) 
            VALUES ('maintenance_mode', 'false') 
            ON CONFLICT (key) DO NOTHING
        `);
        
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='confirmation_sent_at') THEN
                    ALTER TABLE support_tickets ADD COLUMN confirmation_sent_at TIMESTAMP DEFAULT NULL;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_tickets' AND column_name='response_sent_at') THEN
                    ALTER TABLE support_tickets ADD COLUMN response_sent_at TIMESTAMP DEFAULT NULL;
                END IF;
            END $$;
        `);
        
        const defaultRooms = ['#general', '#tech', '#random'];
        for (const room of defaultRooms) {
            await client.query(
                `INSERT INTO rooms (name, created_by, is_default) 
                 VALUES ($1, 'system', TRUE) 
                 ON CONFLICT (name) DO NOTHING`,
                [room]
            );
        }
        
        console.log('Connected to PostgreSQL database and tables initialized.');
    } catch (err) {
        console.error('Error initializing database:', err);
    } finally {
        client.release();
    }
};

initializeDatabase();

const addUser = (username, password, chat_color, callback) => {
    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) return callback(err);
        try {
            const result = await pool.query(
                'INSERT INTO users (username, password, chat_color) VALUES ($1, $2, $3) RETURNING id',
                [username, hash, chat_color]
            );
            callback(null, { id: result.rows[0].id });
        } catch (error) {
            if (error.code === '23505') {
                error.code = 'SQLITE_CONSTRAINT';
            }
            callback(error);
        }
    });
};

const findUser = async (username, callback) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        callback(null, result.rows[0] || null);
    } catch (err) {
        callback(err);
    }
};

const verifyPassword = (password, user, callback) => {
    bcrypt.compare(password, user.password, (err, result) => {
        callback(err, result);
    });
};

const getUserProfile = async (username, callback) => {
    try {
        const result = await pool.query(
            'SELECT username, email, chat_color, bio, status FROM users WHERE username = $1',
            [username]
        );
        callback(null, result.rows[0] || null);
    } catch (err) {
        callback(err);
    }
};

const updateUserProfile = async (username, { bio, status, chat_color, email }, callback) => {
    try {
        // Build dynamic query to only update provided fields
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (bio !== undefined) {
            updates.push(`bio = $${paramCount++}`);
            values.push(bio);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(status);
        }
        if (chat_color !== undefined) {
            updates.push(`chat_color = $${paramCount++}`);
            values.push(chat_color);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramCount++}`);
            values.push(email || null); // Allow null to remove email
        }
        
        if (updates.length === 0) {
            return callback(null);
        }
        
        values.push(username);
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE username = $${paramCount}`,
            values
        );
        callback(null);
    } catch (err) {
        // Handle duplicate email error
        if (err.code === '23505' && err.constraint === 'users_email_key') {
            const error = new Error('Email already in use');
            error.code = 'EMAIL_DUPLICATE';
            return callback(error);
        }
        callback(err);
    }
};

const updateUserPassword = (username, newPassword, callback) => {
    const saltRounds = 10;
    bcrypt.hash(newPassword, saltRounds, async (err, hash) => {
        if (err) return callback(err);
        try {
            await pool.query('UPDATE users SET password = $1 WHERE username = $2', [hash, username]);
            callback(null);
        } catch (error) {
            callback(error);
        }
    });
};

const addMessage = async (room, username, message_text, chat_color, timestamp, fileUrl, fileType, callback) => {
    try {
        const result = await pool.query(
            'INSERT INTO messages (room, username, message_text, chat_color, timestamp, file_url, file_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [room, username, message_text, chat_color, timestamp, fileUrl, fileType]
        );
        callback(null, { id: result.rows[0].id });
    } catch (err) {
        callback(err);
    }
};

const getRecentMessages = async (room, callback) => {
    try {
        const result = await pool.query(
            `SELECT messages.*, users.avatar_url 
             FROM messages 
             LEFT JOIN users ON messages.username = users.username 
             WHERE room = $1 
             ORDER BY messages.timestamp DESC 
             LIMIT 50`,
            [room]
        );
        callback(null, result.rows.reverse());
    } catch (err) {
        callback(err);
    }
};

const searchMessages = async (room, query, callback) => {
    try {
        const result = await pool.query(
            `SELECT messages.*, users.avatar_url 
             FROM messages 
             LEFT JOIN users ON messages.username = users.username 
             WHERE room = $1 AND message_text ILIKE $2 
             ORDER BY messages.timestamp DESC 
             LIMIT 50`,
            [room, `%${query}%`]
        );
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const deleteMessage = async (messageId, callback) => {
    try {
        await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const addReaction = async (message_id, username, emoji, callback) => {
    try {
        const result = await pool.query(
            'INSERT INTO reactions (message_id, username, emoji) VALUES ($1, $2, $3) RETURNING id',
            [message_id, username, emoji]
        );
        callback(null, { id: result.rows[0].id });
    } catch (err) {
        callback(err);
    }
};

const removeReaction = async (message_id, username, emoji, callback) => {
    try {
        await pool.query(
            'DELETE FROM reactions WHERE message_id = $1 AND username = $2 AND emoji = $3',
            [message_id, username, emoji]
        );
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const getReactionsForMessage = async (message_id, callback) => {
    try {
        const result = await pool.query('SELECT * FROM reactions WHERE message_id = $1', [message_id]);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const getReactionsForMessages = async (messageIds, callback) => {
    if (messageIds.length === 0) return callback(null, {});
    try {
        const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(',');
        const result = await pool.query(
            `SELECT * FROM reactions WHERE message_id IN (${placeholders})`,
            messageIds
        );
        const reactionsByMessage = {};
        result.rows.forEach(row => {
            if (!reactionsByMessage[row.message_id]) {
                reactionsByMessage[row.message_id] = [];
            }
            reactionsByMessage[row.message_id].push({ username: row.username, emoji: row.emoji });
        });
        callback(null, reactionsByMessage);
    } catch (err) {
        callback(err);
    }
};

const addPrivateMessage = async (from_user, to_user, message_text, timestamp, callback) => {
    try {
        const result = await pool.query(
            'INSERT INTO private_messages (from_user, to_user, message_text, timestamp) VALUES ($1, $2, $3, $4) RETURNING id',
            [from_user, to_user, message_text, timestamp]
        );
        callback(null, { id: result.rows[0].id });
    } catch (err) {
        callback(err);
    }
};

const getPrivateMessages = async (user1, user2, callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM private_messages WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1) ORDER BY timestamp ASC LIMIT 100',
            [user1, user2]
        );
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const markPrivateMessageAsRead = async (message_id, callback) => {
    try {
        await pool.query('UPDATE private_messages SET read = 1 WHERE id = $1', [message_id]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const addReadReceipt = async (message_id, username, timestamp, callback) => {
    try {
        const result = await pool.query(
            'INSERT INTO read_receipts (message_id, username, read_at) VALUES ($1, $2, $3) RETURNING id',
            [message_id, username, timestamp]
        );
        callback(null, { id: result.rows[0].id });
    } catch (err) {
        callback(err);
    }
};

const getReadReceipts = async (message_id, callback) => {
    try {
        const result = await pool.query('SELECT * FROM read_receipts WHERE message_id = $1', [message_id]);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const updateUserAvatar = async (username, avatar_url, callback) => {
    try {
        await pool.query('UPDATE users SET avatar_url = $1 WHERE username = $2', [avatar_url, username]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const updateUserRole = async (username, role, callback) => {
    try {
        await pool.query('UPDATE users SET role = $1 WHERE username = $2', [role, username]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const createRoom = async (name, created_by, callback) => {
    try {
        if (!name.startsWith('#')) {
            name = '#' + name;
        }
        const result = await pool.query(
            'INSERT INTO rooms (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by, created_at',
            [name, created_by]
        );
        callback(null, result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            callback(new Error('Room already exists'));
        } else {
            callback(err);
        }
    }
};

const getAllRooms = async (callback) => {
    try {
        const result = await pool.query('SELECT * FROM rooms ORDER BY is_default DESC, created_at ASC');
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const deleteRoom = async (name, callback) => {
    try {
        const result = await pool.query('DELETE FROM rooms WHERE name = $1 AND is_default = FALSE RETURNING name', [name]);
        if (result.rows.length === 0) {
            callback(new Error('Cannot delete default room or room does not exist'));
        } else {
            callback(null);
        }
    } catch (err) {
        callback(err);
    }
};

const deleteUserAccount = async (username, callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query('DELETE FROM read_receipts WHERE message_id IN (SELECT id FROM messages WHERE username = $1) OR message_id IN (SELECT id FROM private_messages WHERE from_user = $1 OR to_user = $1)', [username]);
        await client.query('DELETE FROM reactions WHERE username = $1 OR message_id IN (SELECT id FROM messages WHERE username = $1)', [username]);
        await client.query('DELETE FROM private_messages WHERE from_user = $1 OR to_user = $1', [username]);
        await client.query('DELETE FROM messages WHERE username = $1', [username]);
        await client.query('DELETE FROM rooms WHERE created_by = $1 AND is_default = FALSE', [username]);
        await client.query('DELETE FROM warnings WHERE username = $1', [username]);
        await client.query('DELETE FROM mutes WHERE username = $1', [username]);
        await client.query('DELETE FROM bans WHERE username = $1', [username]);
        await client.query('DELETE FROM user_notifications WHERE username = $1', [username]);
        await client.query('DELETE FROM support_tickets WHERE username = $1', [username]);
        await client.query('DELETE FROM blocked_users WHERE blocker_username = $1 OR blocked_username = $1', [username]);
        await client.query('DELETE FROM api_keys WHERE username = $1', [username]);
        await client.query('DELETE FROM users WHERE username = $1', [username]);
        
        await client.query('COMMIT');
        callback(null);
    } catch (err) {
        await client.query('ROLLBACK');
        callback(err);
    } finally {
        client.release();
    }
};

const changeUsername = async (oldUsername, newUsername, callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query('UPDATE users SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE messages SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE private_messages SET from_user = $1 WHERE from_user = $2', [newUsername, oldUsername]);
        await client.query('UPDATE private_messages SET to_user = $1 WHERE to_user = $2', [newUsername, oldUsername]);
        await client.query('UPDATE reactions SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE read_receipts SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE rooms SET created_by = $1 WHERE created_by = $2', [newUsername, oldUsername]);
        await client.query('UPDATE warnings SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE warnings SET warned_by = $1 WHERE warned_by = $2', [newUsername, oldUsername]);
        await client.query('UPDATE mutes SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE mutes SET muted_by = $1 WHERE muted_by = $2', [newUsername, oldUsername]);
        await client.query('UPDATE bans SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE bans SET banned_by = $1 WHERE banned_by = $2', [newUsername, oldUsername]);
        await client.query('UPDATE user_notifications SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE support_tickets SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE support_tickets SET responded_by = $1 WHERE responded_by = $2', [newUsername, oldUsername]);
        await client.query('UPDATE blocked_users SET blocker_username = $1 WHERE blocker_username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE blocked_users SET blocked_username = $1 WHERE blocked_username = $2', [newUsername, oldUsername]);
        await client.query('UPDATE api_keys SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
        
        await client.query('COMMIT');
        callback(null);
    } catch (err) {
        await client.query('ROLLBACK');
        callback(err);
    } finally {
        client.release();
    }
};

const addWarning = async (username, warnedBy, reason, messageEvidence, callback) => {
    try {
        const result = await pool.query(
            'INSERT INTO warnings (username, warned_by, reason, message_evidence) VALUES ($1, $2, $3, $4) RETURNING *',
            [username, warnedBy, reason, messageEvidence || null]
        );
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const getWarnings = async (username, callback) => {
    try {
        let query = 'SELECT warnings.*, users.email AS user_email FROM warnings LEFT JOIN users ON warnings.username = users.username';
        let params = [];
        
        if (username) {
            query += ' WHERE warnings.username = $1 ORDER BY warnings.created_at DESC';
            params = [username];
        } else {
            query += ' ORDER BY warnings.created_at DESC';
        }
        
        const result = await pool.query(query, params);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const deleteWarning = async (id, callback) => {
    try {
        await pool.query('DELETE FROM warnings WHERE id = $1', [id]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const addMute = async (username, mutedBy, reason, messageEvidence, durationMinutes, callback) => {
    try {
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
        const result = await pool.query(
            'INSERT INTO mutes (username, muted_by, reason, message_evidence, duration_minutes, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [username, mutedBy, reason, messageEvidence || null, durationMinutes, expiresAt]
        );
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const getMutes = async (activeOnly, callback) => {
    try {
        let query = 'SELECT mutes.*, users.email AS user_email FROM mutes LEFT JOIN users ON mutes.username = users.username';
        if (activeOnly) {
            query += ' WHERE mutes.is_active = TRUE AND mutes.expires_at > NOW()';
        }
        query += ' ORDER BY mutes.created_at DESC';
        
        const result = await pool.query(query);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const removeMute = async (id, callback) => {
    try {
        await pool.query('UPDATE mutes SET is_active = FALSE WHERE id = $1', [id]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const checkIfUserMuted = async (username, callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM mutes WHERE username = $1 AND is_active = TRUE AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1',
            [username]
        );
        callback(null, result.rows[0] || null);
    } catch (err) {
        callback(err);
    }
};

const addBan = async (username, bannedBy, reason, messageEvidence, isPermanent, expiresAt, callback) => {
    try {
        const result = await pool.query(
            'INSERT INTO bans (username, banned_by, reason, message_evidence, is_permanent, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [username, bannedBy, reason, messageEvidence || null, isPermanent, expiresAt]
        );
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const getBans = async (activeOnly, callback) => {
    try {
        let query = 'SELECT bans.*, users.email AS user_email FROM bans LEFT JOIN users ON bans.username = users.username';
        if (activeOnly) {
            query += ' WHERE bans.is_active = TRUE AND (bans.is_permanent = TRUE OR bans.expires_at > NOW())';
        }
        query += ' ORDER BY bans.created_at DESC';
        
        const result = await pool.query(query);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const removeBan = async (id, callback) => {
    try {
        await pool.query('UPDATE bans SET is_active = FALSE WHERE id = $1', [id]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const checkIfUserBanned = async (username, callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM bans WHERE username = $1 AND is_active = TRUE AND (is_permanent = TRUE OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
            [username]
        );
        callback(null, result.rows[0] || null);
    } catch (err) {
        callback(err);
    }
};

const addNotification = async (username, type, message, callback) => {
    try {
        const result = await pool.query(
            'INSERT INTO user_notifications (username, type, message) VALUES ($1, $2, $3) RETURNING *',
            [username, type, message]
        );
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const getNotifications = async (username, unreadOnly, callback) => {
    try {
        let query = 'SELECT * FROM user_notifications WHERE username = $1';
        if (unreadOnly) {
            query += ' AND read_at IS NULL';
        }
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, [username]);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const markNotificationRead = async (id, callback) => {
    try {
        await pool.query('UPDATE user_notifications SET read_at = NOW() WHERE id = $1', [id]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const getActiveMute = async (username, callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM mutes WHERE username = $1 AND is_active = TRUE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [username]
        );
        callback(null, result.rows[0] || null);
    } catch (err) {
        callback(err);
    }
};

const getActiveBan = async (username, callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM bans WHERE username = $1 AND is_active = TRUE AND (is_permanent = TRUE OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
            [username]
        );
        callback(null, result.rows[0] || null);
    } catch (err) {
        callback(err);
    }
};

const blockUser = async (blockerUsername, blockedUsername, callback) => {
    try {
        if (blockerUsername === blockedUsername) {
            return callback(new Error('Cannot block yourself'));
        }
        const result = await pool.query(
            'INSERT INTO blocked_users (blocker_username, blocked_username) VALUES ($1, $2) RETURNING *',
            [blockerUsername, blockedUsername]
        );
        callback(null, result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return callback(new Error('User is already blocked'));
        }
        callback(err);
    }
};

const unblockUser = async (blockerUsername, blockedUsername, callback) => {
    try {
        const result = await pool.query(
            'DELETE FROM blocked_users WHERE blocker_username = $1 AND blocked_username = $2 RETURNING *',
            [blockerUsername, blockedUsername]
        );
        if (result.rowCount === 0) {
            return callback(new Error('User is not blocked'));
        }
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const getBlockedUsers = async (username, callback) => {
    try {
        const result = await pool.query(
            'SELECT blocked_username, created_at FROM blocked_users WHERE blocker_username = $1 ORDER BY created_at DESC',
            [username]
        );
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const isUserBlocked = async (blockerUsername, blockedUsername, callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM blocked_users WHERE blocker_username = $1 AND blocked_username = $2',
            [blockerUsername, blockedUsername]
        );
        callback(null, result.rows.length > 0);
    } catch (err) {
        callback(err);
    }
};

const isBlockedBy = async (username, otherUsername, callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM blocked_users WHERE blocker_username = $1 AND blocked_username = $2',
            [otherUsername, username]
        );
        callback(null, result.rows.length > 0);
    } catch (err) {
        callback(err);
    }
};

// API Key Management Functions
const crypto = require('crypto');

const generateApiKey = () => {
    return `vybez_${crypto.randomBytes(32).toString('hex')}`;
};

const createApiKey = async (username, appName, description, callback) => {
    try {
        const plaintextKey = generateApiKey();
        const hashedKey = await bcrypt.hash(plaintextKey, 10);
        const result = await pool.query(
            'INSERT INTO api_keys (username, api_key, app_name, description) VALUES ($1, $2, $3, $4) RETURNING id, username, app_name, description, is_active, created_at, rate_limit',
            [username, hashedKey, appName, description]
        );
        // Return the plaintext key so it can be shown to the user once
        callback(null, { ...result.rows[0], plaintextKey });
    } catch (err) {
        callback(err);
    }
};

const getUserApiKeys = async (username, callback) => {
    try {
        const result = await pool.query(
            'SELECT id, app_name, description, is_active, last_used_at, created_at, rate_limit FROM api_keys WHERE username = $1 ORDER BY created_at DESC',
            [username]
        );
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const validateApiKey = async (apiKey, callback) => {
    try {
        // Get all active API keys (we need to check hashes)
        const result = await pool.query(
            'SELECT id, username, app_name, api_key, is_active, rate_limit FROM api_keys WHERE is_active = TRUE'
        );
        
        // Find matching key by comparing hashes
        let matchedKey = null;
        for (const row of result.rows) {
            const isMatch = await bcrypt.compare(apiKey, row.api_key);
            if (isMatch) {
                matchedKey = row;
                break;
            }
        }
        
        if (!matchedKey) {
            return callback(null, null);
        }
        
        // Update last_used_at
        await pool.query(
            'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
            [matchedKey.id]
        );
        
        callback(null, {
            username: matchedKey.username,
            appName: matchedKey.app_name,
            rateLimit: matchedKey.rate_limit
        });
    } catch (err) {
        callback(err);
    }
};

const deactivateApiKey = async (username, keyId, callback) => {
    try {
        const result = await pool.query(
            'UPDATE api_keys SET is_active = FALSE WHERE id = $1 AND username = $2 RETURNING *',
            [keyId, username]
        );
        if (result.rowCount === 0) {
            return callback(new Error('API key not found'));
        }
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const deleteApiKey = async (username, keyId, callback) => {
    try {
        const result = await pool.query(
            'DELETE FROM api_keys WHERE id = $1 AND username = $2 RETURNING *',
            [keyId, username]
        );
        if (result.rowCount === 0) {
            return callback(new Error('API key not found'));
        }
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

module.exports = {
    addUser,
    findUser,
    verifyPassword,
    getUserProfile,
    updateUserProfile,
    updateUserPassword,
    addMessage,
    getRecentMessages,
    searchMessages,
    deleteMessage,
    addReaction,
    removeReaction,
    getReactionsForMessage,
    getReactionsForMessages,
    addPrivateMessage,
    getPrivateMessages,
    markPrivateMessageAsRead,
    addReadReceipt,
    getReadReceipts,
    updateUserAvatar,
    updateUserRole,
    createRoom,
    getAllRooms,
    deleteRoom,
    deleteUserAccount,
    changeUsername,
    addWarning,
    getWarnings,
    deleteWarning,
    addMute,
    getMutes,
    removeMute,
    checkIfUserMuted,
    addBan,
    getBans,
    removeBan,
    checkIfUserBanned,
    addNotification,
    getNotifications,
    markNotificationRead,
    getActiveMute,
    getActiveBan,
    blockUser,
    unblockUser,
    getBlockedUsers,
    isUserBlocked,
    isBlockedBy,
    createApiKey,
    getUserApiKeys,
    validateApiKey,
    deactivateApiKey,
    deleteApiKey,
    pool
};
