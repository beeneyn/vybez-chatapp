const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./chat.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to the chat database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, chat_color TEXT DEFAULT '#000000', bio TEXT DEFAULT 'No bio yet.', status TEXT DEFAULT 'Online' )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages ( id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, username TEXT, message_text TEXT, chat_color TEXT, timestamp DATETIME )`);
    db.run(`CREATE TABLE IF NOT EXISTS reactions ( id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER, username TEXT, emoji TEXT, FOREIGN KEY(message_id) REFERENCES messages(id) )`);
});

const addUser = (username, password, chat_color, callback) => { const saltRounds = 10; bcrypt.hash(password, saltRounds, (err, hash) => { if (err) return callback(err); const sql = `INSERT INTO users (username, password, chat_color) VALUES (?, ?, ?)`; db.run(sql, [username, hash, chat_color], function(err) { callback(err, { id: this.lastID }); }); }); };
const findUser = (username, callback) => { const sql = `SELECT * FROM users WHERE username = ?`; db.get(sql, [username], (err, row) => { callback(err, row); }); };
const verifyPassword = (password, user, callback) => { bcrypt.compare(password, user.password, (err, result) => { callback(err, result); }); };
const getUserProfile = (username, callback) => { const sql = `SELECT username, chat_color, bio, status FROM users WHERE username = ?`; db.get(sql, [username], (err, row) => { callback(err, row); }); };
const updateUserProfile = (username, { bio, status, chat_color }, callback) => { const sql = `UPDATE users SET bio = ?, status = ?, chat_color = ? WHERE username = ?`; db.run(sql, [bio, status, chat_color, username], function(err) { callback(err); }); };
const updateUserPassword = (username, newPassword, callback) => { const saltRounds = 10; bcrypt.hash(newPassword, saltRounds, (err, hash) => { if (err) return callback(err); const sql = `UPDATE users SET password = ? WHERE username = ?`; db.run(sql, [hash, username], function(err) { callback(err); }); }); };
const addMessage = (room, username, message_text, chat_color, timestamp, callback) => { const sql = `INSERT INTO messages (room, username, message_text, chat_color, timestamp) VALUES (?, ?, ?, ?, ?)`; db.run(sql, [room, username, message_text, chat_color, timestamp], function(err) { callback(err, { id: this.lastID }); }); };
const getRecentMessages = (room, callback) => { const sql = `SELECT * FROM messages WHERE room = ? ORDER BY timestamp DESC LIMIT 50`; db.all(sql, [room], (err, rows) => { callback(err, rows.reverse()); }); };
const addReaction = (message_id, username, emoji, callback) => { const sql = `INSERT INTO reactions (message_id, username, emoji) VALUES (?, ?, ?)`; db.run(sql, [message_id, username, emoji], function(err) { callback(err, { id: this.lastID }); }); };
const getReactionsForMessages = (messageIds, callback) => { if (messageIds.length === 0) return callback(null, {}); const placeholders = messageIds.map(() => '?').join(','); const sql = `SELECT * FROM reactions WHERE message_id IN (${placeholders})`; db.all(sql, messageIds, (err, rows) => { if (err) return callback(err); const reactionsByMessage = {}; rows.forEach(row => { if (!reactionsByMessage[row.message_id]) { reactionsByMessage[row.message_id] = []; } reactionsByMessage[row.message_id].push({ username: row.username, emoji: row.emoji }); }); callback(null, reactionsByMessage); }); };

module.exports = { addUser, findUser, verifyPassword, getUserProfile, updateUserProfile, updateUserPassword, addMessage, getRecentMessages, addReaction, getReactionsForMessages, db };