const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const db = require('./database.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const sessionMiddleware = session({ store: new SQLiteStore({ db: 'sessions.db', dir: './' }), secret: 'a very secret key to sign the cookie', resave: false, saveUninitialized: false, cookie: { secure: 'auto', httpOnly: true } });
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => { if (req.session.user) res.redirect('/chat'); else res.sendFile(path.join(__dirname, 'public', 'landing.html')); });
app.get('/chat', (req, res) => { if (!req.session.user) res.redirect('/'); else res.sendFile(path.join(__dirname, 'public', 'chat.html')); });

app.post('/signup', (req, res) => { const { username, password, chat_color } = req.body; db.addUser(username, password, chat_color, (err) => { if (err) { if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ message: 'Username already exists.' }); return res.status(500).json({ message: 'Server error.' }); } res.status(201).json({ message: 'User created!' }); }); });
app.post('/login', (req, res) => { const { username, password } = req.body; db.findUser(username, (err, user) => { if (err || !user) return res.status(401).json({ message: 'Invalid credentials.' }); db.verifyPassword(password, user, (err, isValid) => { if (err || !isValid) return res.status(401).json({ message: 'Invalid credentials.' }); req.session.user = { id: user.id, username: user.username, color: user.chat_color, bio: user.bio, status: user.status }; req.session.save((saveErr) => { if (saveErr) return res.status(500).json({ message: 'Error saving session.' }); res.status(200).json({ message: 'Login successful!', user: req.session.user }); }); }); }); });
app.post('/logout', (req, res) => { req.session.destroy(err => { if (err) return res.status(500).json({ message: 'Logout failed.' }); res.clearCookie('connect.sid'); res.status(200).json({ message: 'Logout successful.' }); }); });
app.get('/check-session', (req, res) => { if (req.session.user) res.status(200).json({ loggedIn: true, user: req.session.user }); else res.status(200).json({ loggedIn: false }); });

const onlineUsers = new Map();
const rooms = ['#general', '#tech', '#random'];
io.on('connection', (socket) => {
    const session = socket.request.session;
    if (!session.user) return socket.disconnect(true);
    socket.join(session.user.username);
    const defaultRoom = rooms[0];
    socket.join(defaultRoom);
    socket.currentRoom = defaultRoom;
    onlineUsers.set(socket.id, session.user);
    io.emit('updateUserList', Array.from(onlineUsers.values()));
    socket.emit('roomList', rooms);
    db.getRecentMessages(defaultRoom, (err, messages) => { if (!err && messages) { const history = messages.map(msg => ({ user: msg.username, text: msg.message_text, color: msg.chat_color, timestamp: msg.timestamp })); socket.emit('loadHistory', { room: defaultRoom, messages: history }); } });
    socket.on('switchRoom', (newRoom) => { socket.leave(socket.currentRoom); socket.join(newRoom); socket.currentRoom = newRoom; db.getRecentMessages(newRoom, (err, messages) => { if (!err && messages) { const history = messages.map(msg => ({ user: msg.username, text: msg.message_text, color: msg.chat_color, timestamp: msg.timestamp })); socket.emit('loadHistory', { room: newRoom, messages: history }); } }); });
    socket.on('chatMessage', (msg) => { const timestamp = new Date(); const sanitizedText = msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); db.addMessage(socket.currentRoom, session.user.username, sanitizedText, session.user.color, timestamp, (err, result) => { if (err) return console.error('Error saving message:', err); const messageToSend = { user: session.user.username, text: sanitizedText, color: session.user.color, timestamp: timestamp }; io.to(socket.currentRoom).emit('chatMessage', messageToSend); }); });
    socket.on('disconnect', () => { onlineUsers.delete(socket.id); io.emit('updateUserList', Array.from(onlineUsers.values())); });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server is running on http://0.0.0.0:${PORT}`));