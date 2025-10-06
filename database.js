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
            'SELECT username, chat_color, bio, status FROM users WHERE username = $1',
            [username]
        );
        callback(null, result.rows[0] || null);
    } catch (err) {
        callback(err);
    }
};

const updateUserProfile = async (username, { bio, status, chat_color }, callback) => {
    try {
        await pool.query(
            'UPDATE users SET bio = $1, status = $2, chat_color = $3 WHERE username = $4',
            [bio, status, chat_color, username]
        );
        callback(null);
    } catch (err) {
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
    pool
};
