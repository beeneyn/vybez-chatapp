const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./chat.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to the chat database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, chat_color TEXT DEFAULT '#000000', bio TEXT DEFAULT 'No bio yet.', status TEXT DEFAULT 'Online', avatar_url TEXT DEFAULT NULL, role TEXT DEFAULT 'user' )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages ( id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, username TEXT, message_text TEXT, chat_color TEXT, timestamp DATETIME, file_url TEXT DEFAULT NULL, file_type TEXT DEFAULT NULL )`);
    db.run(`CREATE TABLE IF NOT EXISTS reactions ( id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER, username TEXT, emoji TEXT, FOREIGN KEY(message_id) REFERENCES messages(id) )`);
    db.run(`CREATE TABLE IF NOT EXISTS private_messages ( id INTEGER PRIMARY KEY AUTOINCREMENT, from_user TEXT, to_user TEXT, message_text TEXT, timestamp DATETIME, read INTEGER DEFAULT 0 )`);
    db.run(`CREATE TABLE IF NOT EXISTS read_receipts ( id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER, username TEXT, read_at DATETIME, FOREIGN KEY(message_id) REFERENCES messages(id) )`);
});

const addUser = (username, password, chat_color, callback) => { const saltRounds = 10; bcrypt.hash(password, saltRounds, (err, hash) => { if (err) return callback(err); const sql = `INSERT INTO users (username, password, chat_color) VALUES (?, ?, ?)`; db.run(sql, [username, hash, chat_color], function(err) { callback(err, { id: this.lastID }); }); }); };
const findUser = (username, callback) => { const sql = `SELECT * FROM users WHERE username = ?`; db.get(sql, [username], (err, row) => { callback(err, row); }); };
const verifyPassword = (password, user, callback) => { bcrypt.compare(password, user.password, (err, result) => { callback(err, result); }); };
const getUserProfile = (username, callback) => { const sql = `SELECT username, chat_color, bio, status FROM users WHERE username = ?`; db.get(sql, [username], (err, row) => { callback(err, row); }); };
const updateUserProfile = (username, { bio, status, chat_color }, callback) => { const sql = `UPDATE users SET bio = ?, status = ?, chat_color = ? WHERE username = ?`; db.run(sql, [bio, status, chat_color, username], function(err) { callback(err); }); };
const updateUserPassword = (username, newPassword, callback) => { const saltRounds = 10; bcrypt.hash(newPassword, saltRounds, (err, hash) => { if (err) return callback(err); const sql = `UPDATE users SET password = ? WHERE username = ?`; db.run(sql, [hash, username], function(err) { callback(err); }); }); };
const addMessage = (room, username, message_text, chat_color, timestamp, fileUrl, fileType, callback) => { const sql = `INSERT INTO messages (room, username, message_text, chat_color, timestamp, file_url, file_type) VALUES (?, ?, ?, ?, ?, ?, ?)`; db.run(sql, [room, username, message_text, chat_color, timestamp, fileUrl, fileType], function(err) { callback(err, { id: this.lastID }); }); };
const getRecentMessages = (room, callback) => { const sql = `SELECT messages.*, users.avatar_url FROM messages LEFT JOIN users ON messages.username = users.username WHERE room = ? ORDER BY messages.timestamp DESC LIMIT 50`; db.all(sql, [room], (err, rows) => { callback(err, rows.reverse()); }); };
const searchMessages = (room, query, callback) => { const sql = `SELECT messages.*, users.avatar_url FROM messages LEFT JOIN users ON messages.username = users.username WHERE room = ? AND message_text LIKE ? ORDER BY messages.timestamp DESC LIMIT 50`; db.all(sql, [room, `%${query}%`], (err, rows) => { callback(err, rows); }); };
const addReaction = (message_id, username, emoji, callback) => { const sql = `INSERT INTO reactions (message_id, username, emoji) VALUES (?, ?, ?)`; db.run(sql, [message_id, username, emoji], function(err) { callback(err, { id: this.lastID }); }); };
const removeReaction = (message_id, username, emoji, callback) => { const sql = `DELETE FROM reactions WHERE message_id = ? AND username = ? AND emoji = ?`; db.run(sql, [message_id, username, emoji], function(err) { callback(err); }); };
const getReactionsForMessage = (message_id, callback) => { const sql = `SELECT * FROM reactions WHERE message_id = ?`; db.all(sql, [message_id], (err, rows) => { callback(err, rows); }); };
const getReactionsForMessages = (messageIds, callback) => { if (messageIds.length === 0) return callback(null, {}); const placeholders = messageIds.map(() => '?').join(','); const sql = `SELECT * FROM reactions WHERE message_id IN (${placeholders})`; db.all(sql, messageIds, (err, rows) => { if (err) return callback(err); const reactionsByMessage = {}; rows.forEach(row => { if (!reactionsByMessage[row.message_id]) { reactionsByMessage[row.message_id] = []; } reactionsByMessage[row.message_id].push({ username: row.username, emoji: row.emoji }); }); callback(null, reactionsByMessage); }); };
const addPrivateMessage = (from_user, to_user, message_text, timestamp, callback) => { const sql = `INSERT INTO private_messages (from_user, to_user, message_text, timestamp) VALUES (?, ?, ?, ?)`; db.run(sql, [from_user, to_user, message_text, timestamp], function(err) { callback(err, { id: this.lastID }); }); };
const getPrivateMessages = (user1, user2, callback) => { const sql = `SELECT * FROM private_messages WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) ORDER BY timestamp ASC LIMIT 100`; db.all(sql, [user1, user2, user2, user1], (err, rows) => { callback(err, rows); }); };
const markPrivateMessageAsRead = (message_id, callback) => { const sql = `UPDATE private_messages SET read = 1 WHERE id = ?`; db.run(sql, [message_id], function(err) { callback(err); }); };
const addReadReceipt = (message_id, username, timestamp, callback) => { const sql = `INSERT INTO read_receipts (message_id, username, read_at) VALUES (?, ?, ?)`; db.run(sql, [message_id, username, timestamp], function(err) { callback(err, { id: this.lastID }); }); };
const getReadReceipts = (message_id, callback) => { const sql = `SELECT * FROM read_receipts WHERE message_id = ?`; db.all(sql, [message_id], (err, rows) => { callback(err, rows); }); };
const updateUserAvatar = (username, avatar_url, callback) => { const sql = `UPDATE users SET avatar_url = ? WHERE username = ?`; db.run(sql, [avatar_url, username], function(err) { callback(err); }); };
const updateUserRole = (username, role, callback) => { const sql = `UPDATE users SET role = ? WHERE username = ?`; db.run(sql, [role, username], function(err) { callback(err); }); };

module.exports = { addUser, findUser, verifyPassword, getUserProfile, updateUserProfile, updateUserPassword, addMessage, getRecentMessages, searchMessages, addReaction, removeReaction, getReactionsForMessage, getReactionsForMessages, addPrivateMessage, getPrivateMessages, markPrivateMessageAsRead, addReadReceipt, getReadReceipts, updateUserAvatar, updateUserRole, db };