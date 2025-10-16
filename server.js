const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const multer = require("multer");
const fs = require("fs");
const db = require("./database.js");
const jwt = require("jsonwebtoken");
const discordWebhook = require("./discord-webhook.js"); // JWT library import

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "video/mp4",
            "video/webm",
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    },
});

const sessionMiddleware = session({
    store: new FileStore({ path: "./sessions", ttl: 86400 }),
    secret:
        process.env.SESSION_SECRET ||
        require("crypto").randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86400000,
        path: "/",
    },
    name: "connect.sid",
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);
app.use(
    express.static(path.join(__dirname, "public"), {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith(".html")) {
                res.setHeader(
                    "Cache-Control",
                    "no-cache, no-store, must-revalidate",
                );
            }
        },
    }),
);
app.use('/dist', express.static(path.join(__dirname, 'dist')));
app.use(express.json());

app.use((req, res, next) => {
    console.log(
        `--- SERVER LOG: Request Received! Method: [${req.method}], URL: [${req.url}] ---`,
    );
    next(); // This is crucial: it passes the request to the next route
});

app.get("/", (req, res) => {
    if (req.session.user) res.redirect("/chat");
    else res.sendFile(path.join(__dirname, "public", "landing.html"));
});
app.get("/desktop-login", (req, res) => {
    if (req.session.user) res.redirect("/chat");
    else res.sendFile(path.join(__dirname, "public", "desktop-login.html"));
});
app.get("/chat", (req, res) => {
    if (!req.session.user) res.redirect("/");
    else res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.get("/demo-chat", (req, res) => {
    req.session.user = {
        username: 'DemoUser',
        chat_color: '#ffb347',
        role: 'user',
        isDemo: true
    };
    res.sendFile(path.join(__dirname, "public", "demo-chat.html"));
});

app.get("/demo-data", (req, res) => {
    if (!req.session.user || !req.session.user.isDemo) {
        return res.status(403).json({ message: "Demo access only" });
    }
    const demoData = require('./demo-data.json');
    res.json(demoData);
});

app.get("/health", (req, res) => {
    const healthcheck = {
        status: "OK",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: "connected"
    };
    
    db.pool.query('SELECT NOW()', (err) => {
        if (err) {
            healthcheck.database = "disconnected";
            healthcheck.status = "ERROR";
            return res.status(503).json(healthcheck);
        }
        res.status(200).json(healthcheck);
    });
});

app.post("/signup", (req, res) => {
    const { username, password, chat_color } = req.body;
    db.addUser(username, password, chat_color, (err) => {
        if (err) {
            if (err.code === "SQLITE_CONSTRAINT")
                return res
                    .status(409)
                    .json({ message: "Username already exists." });
            return res.status(500).json({ message: "Server error." });
        }
        discordWebhook.logUserRegistration(username);
        
        db.findUser(username, (err, user) => {
            if (err || !user) {
                return res.status(500).json({ message: "Error retrieving user." });
            }
            
            const userPayload = {
                id: user.id,
                username: user.username,
                color: user.chat_color,
                bio: user.bio,
                status: user.status,
                avatar: user.avatar_url,
                role: user.role,
            };

            req.session.user = userPayload;

            req.session.save((saveErr) => {
                if (saveErr) {
                    return res.status(500).json({ message: "Error saving session." });
                }
                res.status(201).json({ message: "User created and logged in!" });
            });
        });
    });
});

// --- THIS IS THE CORRECTED LOGIN ROUTE ---
app.post("/login", (req, res) => {
    const { username, password, client } = req.body;
    const clientType = client || 'web';
    
    console.log(`--- SERVER-SIDE LOG: LOGIN from ${clientType.toUpperCase()} client ---`);

    db.findUser(username, (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: "Invalid credentials." });
        }
        db.verifyPassword(password, user, (err, isValid) => {
            if (err || !isValid) {
                return res
                    .status(401)
                    .json({ message: "Invalid credentials." });
            }
            const userPayload = {
                id: user.id,
                username: user.username,
                color: user.chat_color,
                bio: user.bio,
                status: user.status,
                avatar: user.avatar_url,
                role: user.role,
            };

            req.session.user = userPayload;

            const token = jwt.sign(userPayload, process.env.JWT_SECRET, {
                expiresIn: "1d",
            });

            req.session.save((saveErr) => {
                if (saveErr) {
                    return res
                        .status(500)
                        .json({ message: "Error saving session." });
                }
                discordWebhook.logUserLogin(username, clientType);
                res.status(200).json({
                    message: "Login successful!",
                    user: req.session.user,
                    token: token,
                });
            });
        });
    });
});

app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Logout failed." });
        res.clearCookie("connect.sid");
        res.status(200).json({ message: "Logout successful." });
    });
});
app.get("/check-session", (req, res) => {
    if (req.session.user)
        res.status(200).json({ loggedIn: true, user: req.session.user });
    else res.status(200).json({ loggedIn: false });
});
app.post("/upload-file", upload.single("file"), (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    discordWebhook.logFileUpload(req.session.user.username, req.file.filename, req.file.mimetype);
    res.status(200).json({
        fileUrl: `/uploads/${req.file.filename}`,
        fileType: req.file.mimetype,
    });
});
app.post("/upload-avatar", upload.single("avatar"), (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const avatarUrl = `/uploads/${req.file.filename}`;
    db.updateUserAvatar(req.session.user.username, avatarUrl, (err) => {
        if (err)
            return res.status(500).json({ message: "Failed to update avatar" });
        req.session.user.avatar = avatarUrl;
        res.status(200).json({ avatarUrl });
    });
});
app.get("/search-messages", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { room, query } = req.query;
    if (!room || !query)
        return res.status(400).json({ message: "Room and query required" });
    db.searchMessages(room, query, (err, messages) => {
        if (err) return res.status(500).json({ message: "Search failed" });
        res.status(200).json({ messages });
    });
});
app.get("/private-messages/:username", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    const otherUser = req.params.username;
    db.getPrivateMessages(
        req.session.user.username,
        otherUser,
        (err, messages) => {
            if (err)
                return res
                    .status(500)
                    .json({ message: "Failed to get messages" });
            res.status(200).json({ messages });
        },
    );
});
app.post("/update-profile", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { bio, status, chat_color } = req.body;
    db.updateUserProfile(
        req.session.user.username,
        { bio, status, chat_color },
        (err) => {
            if (err)
                return res
                    .status(500)
                    .json({ message: "Failed to update profile" });
            req.session.user.bio = bio;
            req.session.user.status = status;
            req.session.user.color = chat_color;
            req.session.save((saveErr) => {
                if (saveErr)
                    return res
                        .status(500)
                        .json({ message: "Error saving session" });
                res.status(200).json({
                    message: "Profile updated successfully",
                    user: req.session.user,
                });
            });
        },
    );
});
app.get("/rooms", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    db.getAllRooms((err, rooms) => {
        if (err)
            return res.status(500).json({ message: "Failed to get rooms" });
        res.status(200).json({ rooms });
    });
});
app.post("/rooms", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { name } = req.body;
    if (!name || name.trim() === "")
        return res.status(400).json({ message: "Room name is required" });
    db.createRoom(name.trim(), req.session.user.username, (err, room) => {
        if (err) {
            if (err.message === "Room already exists")
                return res.status(409).json({ message: "Room already exists" });
            return res.status(500).json({ message: "Failed to create room" });
        }
        discordWebhook.logRoomCreated(room.name, req.session.user.username);
        io.emit("roomCreated", room);
        res.status(201).json({ message: "Room created successfully", room });
    });
});
app.delete("/rooms/:name", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    const roomName = req.params.name;
    db.deleteRoom(roomName, (err) => {
        if (err) {
            if (err.message.includes("Cannot delete"))
                return res.status(403).json({ message: err.message });
            return res.status(500).json({ message: "Failed to delete room" });
        }
        discordWebhook.logRoomDeleted(roomName, req.session.user.username);
        io.emit("roomDeleted", { name: roomName });
        res.status(200).json({ message: "Room deleted successfully" });
    });
});

const onlineUsers = new Map();
const typingUsers = new Map();

// --- THIS IS THE CORRECTED CONNECTION HANDLER ---
io.on("connection", (socket) => {
    let user;
    let clientType = 'web';

    if (socket.handshake.auth && socket.handshake.auth.token) {
        try {
            user = jwt.verify(
                socket.handshake.auth.token,
                process.env.JWT_SECRET,
            );
            clientType = socket.handshake.auth.client || 'desktop';
        } catch (err) {
            console.log("Authentication error: Invalid token");
            return socket.disconnect(true);
        }
    } else if (socket.request.session && socket.request.session.user) {
        user = socket.request.session.user;
        clientType = 'web';
    }

    if (!user) {
        console.log("Authentication error: No session or token provided.");
        return socket.disconnect(true);
    }

    console.log(`User connected: ${user.username} (${clientType.toUpperCase()})`);

    socket.join(user.username);

    db.getAllRooms((err, rooms) => {
        const roomList = err ? ["#general"] : rooms.map((r) => r.name);
        const defaultRoom = roomList[0];
        socket.join(defaultRoom);
        socket.currentRoom = defaultRoom;
        onlineUsers.set(socket.id, user);
        io.emit("updateUserList", Array.from(onlineUsers.values()));
        socket.emit("roomList", roomList);

        db.getRecentMessages(defaultRoom, (err, messages) => {
            if (!err && messages) {
                const history = messages.map((msg) => ({
                    id: msg.id,
                    user: msg.username,
                    text: msg.message_text,
                    color: msg.chat_color,
                    timestamp: msg.timestamp,
                    fileUrl: msg.file_url,
                    fileType: msg.file_type,
                    avatar: msg.avatar_url,
                }));
                socket.emit("loadHistory", {
                    room: defaultRoom,
                    messages: history,
                });
            }
        });
    });

    socket.on("switchRoom", (newRoom) => {
        socket.leave(socket.currentRoom);
        socket.join(newRoom);
        socket.currentRoom = newRoom;
        db.getRecentMessages(newRoom, (err, messages) => {
            if (!err && messages) {
                const history = messages.map((msg) => ({
                    id: msg.id,
                    user: msg.username,
                    text: msg.message_text,
                    color: msg.chat_color,
                    timestamp: msg.timestamp,
                    fileUrl: msg.file_url,
                    fileType: msg.file_type,
                    avatar: msg.avatar_url,
                }));
                socket.emit("loadHistory", {
                    room: newRoom,
                    messages: history,
                });
            }
        });
    });

    socket.on("chatMessage", (msg) => {
        const timestamp = new Date();
        const sanitizedText = msg.text
            ? msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")
            : "";
        db.addMessage(
            socket.currentRoom,
            user.username,
            sanitizedText,
            user.color,
            timestamp,
            msg.fileUrl || null,
            msg.fileType || null,
            (err, result) => {
                if (err) return console.error("Error saving message:", err);
                const messageToSend = {
                    id: result.id,
                    user: user.username,
                    text: sanitizedText,
                    color: user.color,
                    timestamp: timestamp,
                    fileUrl: msg.fileUrl,
                    fileType: msg.fileType,
                    avatar: user.avatar,
                };
                discordWebhook.logChatMessage(user.username, socket.currentRoom, sanitizedText, !!msg.fileUrl, clientType);
                io.to(socket.currentRoom).emit("chatMessage", messageToSend);
            },
        );
    });

    socket.on("typing", (isTyping) => {
        const key = `${socket.currentRoom}:${socket.id}`;
        if (isTyping) {
            typingUsers.set(key, user.username);
        } else {
            typingUsers.delete(key);
        }
        const roomTypingUsers = Array.from(typingUsers.entries())
            .filter(([k]) => k.startsWith(socket.currentRoom + ":"))
            .map(([, username]) => username);
        io.to(socket.currentRoom).emit("typingUsers", roomTypingUsers);
    });

    socket.on("addReaction", ({ messageId, emoji }) => {
        db.addReaction(messageId, user.username, emoji, (err) => {
            if (err) return console.error("Error adding reaction:", err);
            db.getReactionsForMessage(messageId, (err, reactions) => {
                if (!err)
                    io.to(socket.currentRoom).emit("reactionUpdate", {
                        messageId,
                        reactions,
                    });
            });
        });
    });

    socket.on("removeReaction", ({ messageId, emoji }) => {
        db.removeReaction(messageId, user.username, emoji, (err) => {
            if (err) return console.error("Error removing reaction:", err);
            db.getReactionsForMessage(messageId, (err, reactions) => {
                if (!err)
                    io.to(socket.currentRoom).emit("reactionUpdate", {
                        messageId,
                        reactions,
                    });
            });
        });
    });

    socket.on("privateMessage", ({ to, text }) => {
        const timestamp = new Date();
        const sanitizedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        db.addPrivateMessage(
            user.username,
            to,
            sanitizedText,
            timestamp,
            (err, result) => {
                if (err)
                    return console.error("Error sending private message:", err);
                const pm = {
                    id: result.id,
                    from: user.username,
                    to: to,
                    text: sanitizedText,
                    timestamp: timestamp,
                    color: user.color,
                };
                discordWebhook.logPrivateMessage(user.username, to, sanitizedText, clientType);
                io.to(to).emit("privateMessage", pm);
                socket.emit("privateMessageSent", pm);
            },
        );
    });

    socket.on("markAsRead", ({ messageId }) => {
        const timestamp = new Date();
        db.addReadReceipt(messageId, user.username, timestamp, (err) => {
            if (err) return console.error("Error adding read receipt:", err);
            db.getReadReceipts(messageId, (err, receipts) => {
                if (!err)
                    io.to(socket.currentRoom).emit("readReceiptUpdate", {
                        messageId,
                        receipts,
                    });
            });
        });
    });

    socket.on("disconnect", () => {
        onlineUsers.delete(socket.id);
        const keys = Array.from(typingUsers.keys()).filter((k) =>
            k.endsWith(":" + socket.id),
        );
        keys.forEach((key) => typingUsers.delete(key));
        io.emit("updateUserList", Array.from(onlineUsers.values()));
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () =>
    console.log(`Server is running on http://0.0.0.0:${PORT}`),
);
