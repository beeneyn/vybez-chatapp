const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
    application_name: 'vybez_chat_app',
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle database client:', err.message);
});

const initializeDatabase = async (retries = 3, delay = 5000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔌 Attempting database connection (attempt ${attempt}/${retries})...`);
            const client = await pool.connect();
            
            console.log('✅ Database connection established, initializing tables...');
            await initializeTables(client);
            client.release();
            console.log('✅ Database initialization complete');
            return;
        } catch (err) {
            console.error(`❌ Database connection attempt ${attempt} failed:`, err.message);
            
            if (attempt === retries) {
                console.error('❌ All database connection attempts failed. Server will continue but database operations may fail.');
                throw err;
            }
            
            console.log(`⏳ Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

const initializeTables = async (client) => {
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                display_name TEXT,
                password TEXT NOT NULL,
                email TEXT UNIQUE,
                chat_color TEXT DEFAULT '#000000',
                bio TEXT DEFAULT 'No bio yet.',
                status TEXT DEFAULT 'Online',
                avatar_url TEXT DEFAULT NULL,
                role TEXT DEFAULT 'user'
            )
        `);
        
        // Add display_name column if it doesn't exist (migration for existing databases)
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT
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
            CREATE TABLE IF NOT EXISTS room_read_positions (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                room TEXT NOT NULL,
                last_read_message_id INTEGER,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, room)
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS announcement_reads (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                announcement_id INTEGER NOT NULL,
                read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, announcement_id)
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
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_keys' AND column_name='api_key') THEN
                    ALTER TABLE api_keys DROP COLUMN api_key;
                END IF;
            END $$;
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
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                posted_by TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_pinned BOOLEAN DEFAULT FALSE
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS health_checks (
                id SERIAL PRIMARY KEY,
                response_time_ms INTEGER NOT NULL,
                checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at DESC)
        `);
        
        // VERSION 1.2: Server Organization Tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS servers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                icon_url TEXT DEFAULT NULL,
                owner_username TEXT NOT NULL,
                is_public BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS channels (
                id SERIAL PRIMARY KEY,
                server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'text',
                category TEXT DEFAULT NULL,
                position INTEGER DEFAULT 0,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(server_id, name)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS server_members (
                id SERIAL PRIMARY KEY,
                server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                username TEXT NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(server_id, username)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#99AAB5',
                position INTEGER DEFAULT 0,
                is_default BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(server_id, name)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                id SERIAL PRIMARY KEY,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                permission TEXT NOT NULL,
                UNIQUE(role_id, permission)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_roles (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, role_id)
            )
        `);
        
        // Create a function to check if user is member of role's server
        await client.query(`
            CREATE OR REPLACE FUNCTION check_user_role_membership()
            RETURNS TRIGGER AS $$
            DECLARE
                v_server_id INTEGER;
                v_is_member BOOLEAN;
            BEGIN
                -- Get server_id from the role
                SELECT server_id INTO v_server_id FROM roles WHERE id = NEW.role_id;
                
                -- Check if user is a member of that server
                SELECT EXISTS(
                    SELECT 1 FROM server_members 
                    WHERE server_id = v_server_id AND username = NEW.username
                ) INTO v_is_member;
                
                IF NOT v_is_member THEN
                    RAISE EXCEPTION 'User % is not a member of the server for role %', NEW.username, NEW.role_id;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        await client.query(`
            DROP TRIGGER IF EXISTS enforce_user_role_membership ON user_roles;
            CREATE TRIGGER enforce_user_role_membership
            BEFORE INSERT OR UPDATE ON user_roles
            FOR EACH ROW
            EXECUTE FUNCTION check_user_role_membership();
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS message_edits (
                id SERIAL PRIMARY KEY,
                message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                original_text TEXT NOT NULL,
                edited_text TEXT NOT NULL,
                edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                edited_by TEXT NOT NULL
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS server_invites (
                id SERIAL PRIMARY KEY,
                server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                code TEXT UNIQUE NOT NULL,
                created_by TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                max_uses INTEGER DEFAULT NULL,
                uses INTEGER DEFAULT 0,
                active BOOLEAN DEFAULT TRUE
            )
        `);

        // Create indexes for Version 1.2 tables
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_channels_server_id ON channels(server_id);
            CREATE INDEX IF NOT EXISTS idx_server_members_username ON server_members(username);
            CREATE INDEX IF NOT EXISTS idx_server_members_server_id ON server_members(server_id);
            CREATE INDEX IF NOT EXISTS idx_roles_server_id ON roles(server_id);
            CREATE INDEX IF NOT EXISTS idx_user_roles_username ON user_roles(username);
            CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
            CREATE INDEX IF NOT EXISTS idx_message_edits_message_id ON message_edits(message_id);
            CREATE INDEX IF NOT EXISTS idx_server_invites_code ON server_invites(code);
            CREATE INDEX IF NOT EXISTS idx_server_invites_server_id ON server_invites(server_id);
        `);
        
        // Migration: Add NOT NULL constraints to existing tables
        await client.query(`
            DO $$ BEGIN
                -- Channels: make server_id NOT NULL
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='channels' AND column_name='server_id' AND is_nullable='YES') THEN
                    DELETE FROM channels WHERE server_id IS NULL;
                    ALTER TABLE channels ALTER COLUMN server_id SET NOT NULL;
                END IF;
                
                -- Server members: make server_id and username NOT NULL
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='server_members' AND column_name='server_id' AND is_nullable='YES') THEN
                    DELETE FROM server_members WHERE server_id IS NULL OR username IS NULL;
                    ALTER TABLE server_members ALTER COLUMN server_id SET NOT NULL;
                    ALTER TABLE server_members ALTER COLUMN username SET NOT NULL;
                END IF;
                
                -- Roles: make server_id NOT NULL
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='roles' AND column_name='server_id' AND is_nullable='YES') THEN
                    DELETE FROM roles WHERE server_id IS NULL;
                    ALTER TABLE roles ALTER COLUMN server_id SET NOT NULL;
                END IF;
                
                -- Role permissions: make role_id NOT NULL
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='role_permissions' AND column_name='role_id' AND is_nullable='YES') THEN
                    DELETE FROM role_permissions WHERE role_id IS NULL;
                    ALTER TABLE role_permissions ALTER COLUMN role_id SET NOT NULL;
                END IF;
                
                -- User roles: clean up invalid assignments, drop server_id, add NOT NULL
                -- First, remove any user_roles where user is not a member of the role's server
                DELETE FROM user_roles ur
                WHERE NOT EXISTS (
                    SELECT 1 FROM server_members sm
                    JOIN roles r ON sm.server_id = r.server_id
                    WHERE sm.username = ur.username AND r.id = ur.role_id
                );
                
                -- Drop redundant server_id column if exists
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='user_roles' AND column_name='server_id') THEN
                    ALTER TABLE user_roles DROP COLUMN IF EXISTS server_id;
                END IF;
                
                -- Add NOT NULL constraints
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='user_roles' AND column_name='username' AND is_nullable='YES') THEN
                    DELETE FROM user_roles WHERE username IS NULL OR role_id IS NULL;
                    ALTER TABLE user_roles ALTER COLUMN username SET NOT NULL;
                    ALTER TABLE user_roles ALTER COLUMN role_id SET NOT NULL;
                END IF;
                
                -- Message edits: make message_id NOT NULL
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='message_edits' AND column_name='message_id' AND is_nullable='YES') THEN
                    DELETE FROM message_edits WHERE message_id IS NULL;
                    ALTER TABLE message_edits ALTER COLUMN message_id SET NOT NULL;
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
        
        console.log('✅ Database tables initialized successfully.');
    } catch (err) {
        console.error('❌ Error creating database tables:', err.message);
        throw err;
    }
};

initializeDatabase();

const addUser = (username, password, chat_color, display_name, callback) => {
    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) return callback(err);
        try {
            const result = await pool.query(
                'INSERT INTO users (username, password, chat_color, display_name) VALUES ($1, $2, $3, $4) RETURNING id',
                [username, hash, chat_color, display_name || username]
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

const updateUserProfile = async (username, { bio, status, chat_color, email, display_name }, callback) => {
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
        if (display_name !== undefined) {
            updates.push(`display_name = $${paramCount++}`);
            values.push(display_name || null); // Allow null to remove display name
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
            `SELECT messages.*, users.avatar_url, users.display_name 
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

const getAllUsers = async (callback) => {
    try {
        const result = await pool.query(
            'SELECT username, chat_color, avatar_url, bio, status, role FROM users ORDER BY username ASC'
        );
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

const getAllChannelsForServer = async (serverId, callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM channels WHERE server_id = $1 ORDER BY position ASC, created_at ASC',
            [serverId]
        );
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const getDefaultServer = async (callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM servers ORDER BY created_at ASC LIMIT 1'
        );
        if (result.rows.length === 0) {
            callback(new Error('No servers found'));
        } else {
            callback(null, result.rows[0]);
        }
    } catch (err) {
        callback(err);
    }
};

const getChannelById = async (channelId, callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM channels WHERE id = $1',
            [channelId]
        );
        if (result.rows.length === 0) {
            callback(new Error('Channel not found'));
        } else {
            callback(null, result.rows[0]);
        }
    } catch (err) {
        callback(err);
    }
};

const getUserServers = async (username, callback) => {
    try {
        const result = await pool.query(`
            SELECT s.* FROM servers s
            INNER JOIN server_members sm ON s.id = sm.server_id
            WHERE sm.username = $1
            ORDER BY s.created_at ASC
        `, [username]);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const createServer = async (name, description, owner_username, callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const serverResult = await client.query(
            'INSERT INTO servers (name, description, owner_username) VALUES ($1, $2, $3) RETURNING *',
            [name, description, owner_username]
        );
        const server = serverResult.rows[0];
        
        await client.query(
            'INSERT INTO server_members (server_id, username) VALUES ($1, $2)',
            [server.id, owner_username]
        );
        
        // Create @everyone role
        const everyoneRole = await client.query(
            'INSERT INTO roles (server_id, name, color, position, mentionable) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [server.id, '@everyone', '#99AAB5', 0, false]
        );
        
        const everyonePermissions = ['send_messages', 'read_messages', 'read_history', 'add_reactions'];
        for (const permission of everyonePermissions) {
            await client.query(
                'INSERT INTO role_permissions (role_id, permission_name) VALUES ($1, $2)',
                [everyoneRole.rows[0].id, permission]
            );
        }
        
        // Assign @everyone role to owner
        await client.query(
            'INSERT INTO user_roles (username, role_id) VALUES ($1, $2)',
            [owner_username, everyoneRole.rows[0].id]
        );
        
        // Create Admin role
        const adminRole = await client.query(
            'INSERT INTO roles (server_id, name, color, position, mentionable) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [server.id, 'Admin', '#E94EFF', 100, true]
        );
        
        const adminPermissions = [
            'administrator', 'manage_server', 'manage_roles', 'manage_channels',
            'create_channels', 'delete_channels', 'kick_members', 'ban_members',
            'invite_members', 'manage_messages', 'send_messages', 'read_messages',
            'mention_everyone', 'read_history', 'add_reactions', 'attach_files'
        ];
        
        for (const permission of adminPermissions) {
            await client.query(
                'INSERT INTO role_permissions (role_id, permission_name) VALUES ($1, $2)',
                [adminRole.rows[0].id, permission]
            );
        }
        
        // Assign Admin role to owner
        await client.query(
            'INSERT INTO user_roles (username, role_id) VALUES ($1, $2)',
            [owner_username, adminRole.rows[0].id]
        );
        
        // Create general channel
        await client.query(
            'INSERT INTO channels (server_id, name, type, position) VALUES ($1, $2, $3, $4)',
            [server.id, 'general', 'text', 0]
        );
        
        await client.query('COMMIT');
        callback(null, server);
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            callback(new Error('Server name already exists'));
        } else {
            callback(err);
        }
    } finally {
        client.release();
    }
};

const createChannel = async (serverId, name, type, created_by, description, callback) => {
    try {
        const channelName = name.startsWith('#') ? name.substring(1) : name;
        
        const positionResult = await pool.query(
            'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM channels WHERE server_id = $1',
            [serverId]
        );
        const position = positionResult.rows[0].next_position;
        
        const result = await pool.query(
            'INSERT INTO channels (server_id, name, type, description, position) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [serverId, channelName, type || 'text', description || null, position]
        );
        callback(null, result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            callback(new Error('Channel already exists in this server'));
        } else {
            callback(err);
        }
    }
};

const deleteChannel = async (channelId, username, callback) => {
    try {
        const channelResult = await pool.query(
            'SELECT c.*, s.owner FROM channels c JOIN servers s ON c.server_id = s.id WHERE c.id = $1',
            [channelId]
        );
        
        if (channelResult.rows.length === 0) {
            return callback(new Error('Channel not found'));
        }
        
        const channel = channelResult.rows[0];
        
        const userResult = await pool.query('SELECT role FROM users WHERE username = $1', [username]);
        const isGlobalAdmin = userResult.rows.length > 0 && userResult.rows[0].role === 'admin';
        const isOwner = channel.owner === username;
        
        const permissionResult = await pool.query(`
            SELECT COUNT(*) as count FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            JOIN role_permissions rp ON r.id = rp.role_id
            WHERE ur.username = $1 AND r.server_id = $2 AND rp.permission = 'manage_channels'
        `, [username, channel.server_id]);
        
        const hasManageChannels = permissionResult.rows[0].count > 0;
        
        if (!isGlobalAdmin && !isOwner && !hasManageChannels) {
            return callback(new Error('Permission denied: You need manage_channels permission to delete channels'));
        }
        
        await pool.query('DELETE FROM channels WHERE id = $1', [channelId]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const getChannelMessages = async (channelId, limit, callback) => {
    try {
        const result = await pool.query(
            `SELECT messages.*, users.avatar_url, users.display_name 
             FROM messages 
             LEFT JOIN users ON messages.username = users.username 
             WHERE room = $1 
             ORDER BY messages.timestamp DESC 
             LIMIT $2`,
            [channelId.toString(), limit || 50]
        );
        callback(null, result.rows.reverse());
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

const createAnnouncement = async (title, content, postedBy, callback) => {
    try {
        const result = await pool.query(
            'INSERT INTO announcements (title, content, posted_by) VALUES ($1, $2, $3) RETURNING *',
            [title, content, postedBy]
        );
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const getAllAnnouncements = async (callback) => {
    try {
        const result = await pool.query(
            'SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC'
        );
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const deleteAnnouncement = async (id, callback) => {
    try {
        const result = await pool.query(
            'DELETE FROM announcements WHERE id = $1 RETURNING *',
            [id]
        );
        if (result.rowCount === 0) {
            return callback(new Error('Announcement not found'));
        }
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const togglePinAnnouncement = async (id, callback) => {
    try {
        const result = await pool.query(
            'UPDATE announcements SET is_pinned = NOT is_pinned WHERE id = $1 RETURNING *',
            [id]
        );
        if (result.rowCount === 0) {
            return callback(new Error('Announcement not found'));
        }
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const updateRoomReadPosition = async (username, room, messageId, callback) => {
    try {
        await pool.query(
            `INSERT INTO room_read_positions (username, room, last_read_message_id, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (username, room)
             DO UPDATE SET last_read_message_id = $3, updated_at = CURRENT_TIMESTAMP`,
            [username, room, messageId]
        );
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const getUnreadCounts = async (username, callback) => {
    try {
        const result = await pool.query(
            `SELECT m.room, COUNT(*) as unread_count
             FROM messages m
             LEFT JOIN room_read_positions rp ON rp.username = $1 AND rp.room = m.room
             WHERE m.username != $1
             AND (rp.last_read_message_id IS NULL OR m.id > rp.last_read_message_id)
             GROUP BY m.room`,
            [username]
        );
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const markAnnouncementAsRead = async (username, announcementId, callback) => {
    try {
        await pool.query(
            `INSERT INTO announcement_reads (username, announcement_id, read_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (username, announcement_id) DO NOTHING`,
            [username, announcementId]
        );
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const getUnreadAnnouncementIds = async (username, callback) => {
    try {
        const result = await pool.query(
            `SELECT a.id
             FROM announcements a
             LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.username = $1
             WHERE ar.id IS NULL`,
            [username]
        );
        callback(null, result.rows.map(row => row.id));
    } catch (err) {
        callback(err);
    }
};

const markAllNotificationsRead = async (username, callback) => {
    try {
        await pool.query(
            'UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP WHERE username = $1 AND read_at IS NULL',
            [username]
        );
        callback(null);
    } catch (err) {
        callback(err);
    }
};

// ==================== SERVER INVITES ====================
const createInvite = async (serverId, createdBy, expiresInHours, maxUses, callback) => {
    try {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null;
        
        const result = await pool.query(
            'INSERT INTO server_invites (server_id, code, created_by, expires_at, max_uses) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [serverId, code, createdBy, expiresAt, maxUses]
        );
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const getInviteByCode = async (code, callback) => {
    try {
        const result = await pool.query(`
            SELECT i.*, s.name as server_name, s.description as server_description
            FROM server_invites i
            JOIN servers s ON i.server_id = s.id
            WHERE i.code = $1 AND i.active = TRUE
        `, [code]);
        
        if (result.rows.length === 0) {
            return callback(new Error('Invalid or expired invite'));
        }
        
        const invite = result.rows[0];
        
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            await pool.query('UPDATE server_invites SET active = FALSE WHERE id = $1', [invite.id]);
            return callback(new Error('This invite has expired'));
        }
        
        if (invite.max_uses && invite.uses >= invite.max_uses) {
            await pool.query('UPDATE server_invites SET active = FALSE WHERE id = $1', [invite.id]);
            return callback(new Error('This invite has reached its maximum uses'));
        }
        
        callback(null, invite);
    } catch (err) {
        callback(err);
    }
};

const useInvite = async (code, username, callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const inviteResult = await client.query(`
            SELECT i.*, s.id as server_id
            FROM server_invites i
            JOIN servers s ON i.server_id = s.id
            WHERE i.code = $1 AND i.active = TRUE
        `, [code]);
        
        if (inviteResult.rows.length === 0) {
            throw new Error('Invalid invite');
        }
        
        const invite = inviteResult.rows[0];
        
        const memberCheck = await client.query(
            'SELECT 1 FROM server_members WHERE server_id = $1 AND username = $2',
            [invite.server_id, username]
        );
        
        if (memberCheck.rows.length > 0) {
            throw new Error('You are already a member of this server');
        }
        
        await client.query(
            'INSERT INTO server_members (server_id, username) VALUES ($1, $2)',
            [invite.server_id, username]
        );
        
        await client.query(
            'UPDATE server_invites SET uses = uses + 1 WHERE id = $1',
            [invite.id]
        );
        
        await client.query('COMMIT');
        callback(null, invite.server_id);
    } catch (err) {
        await client.query('ROLLBACK');
        callback(err);
    } finally {
        client.release();
    }
};

const getServerInvites = async (serverId, callback) => {
    try {
        const result = await pool.query(`
            SELECT * FROM server_invites 
            WHERE server_id = $1 AND active = TRUE
            ORDER BY created_at DESC
        `, [serverId]);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const deleteInvite = async (inviteId, callback) => {
    try {
        await pool.query('UPDATE server_invites SET active = FALSE WHERE id = $1', [inviteId]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

// ==================== ROLE MANAGEMENT ====================
const getServerRoles = async (serverId, callback) => {
    try {
        const result = await pool.query(`
            SELECT r.*, 
                   COALESCE(json_agg(rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '[]') as permission_list
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            WHERE r.server_id = $1
            GROUP BY r.id
            ORDER BY r.position DESC
        `, [serverId]);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const updateRole = async (roleId, name, color, callback) => {
    try {
        const result = await pool.query(
            'UPDATE roles SET name = $1, color = $2 WHERE id = $3 RETURNING *',
            [name, color, roleId]
        );
        if (result.rowCount === 0) {
            return callback(new Error('Role not found'));
        }
        callback(null, result.rows[0]);
    } catch (err) {
        callback(err);
    }
};

const deleteRole = async (roleId, callback) => {
    try {
        await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
        await pool.query('DELETE FROM user_roles WHERE role_id = $1', [roleId]);
        await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const updateRolePermissions = async (roleId, permissions, callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
        
        for (const permission of permissions) {
            await client.query(
                'INSERT INTO role_permissions (role_id, permission) VALUES ($1, $2)',
                [roleId, permission]
            );
        }
        
        await client.query('COMMIT');
        callback(null);
    } catch (err) {
        await client.query('ROLLBACK');
        callback(err);
    } finally {
        client.release();
    }
};

// ==================== MEMBER MANAGEMENT ====================
const getServerMembers = async (serverId, callback) => {
    try {
        const result = await pool.query(`
            SELECT 
                sm.username,
                sm.joined_at,
                u.avatar_url,
                u.status,
                COALESCE(json_agg(
                    json_build_object(
                        'id', r.id,
                        'name', r.name,
                        'color', r.color,
                        'position', r.position
                    ) ORDER BY r.position DESC
                ) FILTER (WHERE r.id IS NOT NULL), '[]') as roles
            FROM server_members sm
            LEFT JOIN users u ON sm.username = u.username
            LEFT JOIN user_roles ur ON sm.username = ur.username
            LEFT JOIN roles r ON ur.role_id = r.id AND r.server_id = $1
            WHERE sm.server_id = $1
            GROUP BY sm.username, sm.joined_at, u.avatar_url, u.status
            ORDER BY sm.joined_at ASC
        `, [serverId]);
        callback(null, result.rows);
    } catch (err) {
        callback(err);
    }
};

const kickMember = async (serverId, username, callback) => {
    const client = await pool.connect();
    try {
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
        callback(null);
    } catch (err) {
        await client.query('ROLLBACK');
        callback(err);
    } finally {
        client.release();
    }
};

const assignRoleToMember = async (username, roleId, callback) => {
    try {
        await pool.query(
            'INSERT INTO user_roles (username, role_id) VALUES ($1, $2) ON CONFLICT (username, role_id) DO NOTHING',
            [username, roleId]
        );
        callback(null);
    } catch (err) {
        callback(err);
    }
};

const removeRoleFromMember = async (username, roleId, callback) => {
    try {
        await pool.query(
            'DELETE FROM user_roles WHERE username = $1 AND role_id = $2',
            [username, roleId]
        );
        callback(null);
    } catch (err) {
        callback(err);
    }
};

// Check if user is a member of a server
const isUserMemberOfServer = async (serverId, username, callback) => {
    try {
        const result = await pool.query(
            `SELECT EXISTS(
                SELECT 1 FROM server_members 
                WHERE server_id = $1 AND username = $2
            ) as is_member`,
            [serverId, username]
        );
        callback(null, result.rows[0].is_member);
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
    getAllUsers,
    updateUserAvatar,
    updateUserRole,
    createRoom,
    getAllRooms,
    deleteRoom,
    getAllChannelsForServer,
    getDefaultServer,
    getChannelById,
    getUserServers,
    createServer,
    createChannel,
    deleteChannel,
    getChannelMessages,
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
    createAnnouncement,
    getAllAnnouncements,
    deleteAnnouncement,
    togglePinAnnouncement,
    updateRoomReadPosition,
    getUnreadCounts,
    markAnnouncementAsRead,
    getUnreadAnnouncementIds,
    markAllNotificationsRead,
    createInvite,
    getInviteByCode,
    useInvite,
    getServerInvites,
    deleteInvite,
    getServerRoles,
    updateRole,
    deleteRole,
    updateRolePermissions,
    getServerMembers,
    kickMember,
    assignRoleToMember,
    removeRoleFromMember,
    isUserMemberOfServer,
    pool
};
