const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const session = require("express-session");
const ReplitDBStore = require("./replit-session-store");
const multer = require("multer");
const fs = require("fs");
const db = require("./database.js");
const jwt = require("jsonwebtoken");
const discordWebhook = require("./discord-webhook.js");
const moderationRoutes = require("./moderation-routes.js");

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
    store: new ReplitDBStore({ prefix: "vybez_session:", ttl: 86400 }),
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

const banCheckMiddleware = async (req, res, next) => {
    const allowedForBannedUsers = ['/ban.html', '/support', '/support.html', '/api/moderation/check-status', '/check-session', '/logout'];
    const allowedForAnonymous = ['/', '/signup', '/login', '/desktop-login', '/health'];
    const isStaticAsset = req.path.startsWith('/tailwind.css') || 
                          req.path.startsWith('/dist/') ||
                          req.path.startsWith('/uploads/') ||
                          req.path === '/support.js';
    const isSupportAPI = req.path.startsWith('/api/support/');
    
    if (!req.session.user) {
        const isAnonymousRoute = allowedForAnonymous.includes(req.path) || isStaticAsset;
        if (isAnonymousRoute) {
            return next();
        }
        return res.redirect('/');
    }
    
    db.getActiveBan(req.session.user.username, (err, ban) => {
        if (err) {
            console.error('Error checking ban status:', err);
            return next();
        }
        
        if (ban) {
            const isBannedUserRoute = allowedForBannedUsers.includes(req.path) || 
                                     isSupportAPI || 
                                     isStaticAsset;
            
            if (isBannedUserRoute) {
                return next();
            }
            
            if (req.path.startsWith('/api/')) {
                return res.status(403).json({ banned: true, message: 'Your account is banned', ban });
            } else {
                return res.redirect('/ban.html');
            }
        }
        
        next();
    });
};

app.use(banCheckMiddleware);

const requireAdmin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect("/");
    }
    if (req.session.user.role !== 'admin') {
        return res.status(403).send("Access denied. Admin privileges required.");
    }
    next();
};

app.get("/admin-panel.html", requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin-panel.html"));
});

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

moderationRoutes(app);

const requireAdminAPI = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
};

app.get("/api/admin/stats", requireAdminAPI, (req, res) => {
    db.pool.query(`
        SELECT 
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM rooms) as total_rooms,
            (SELECT COUNT(*) FROM messages) as total_messages,
            (SELECT COUNT(*) FROM bans WHERE is_active = true AND (is_permanent = true OR expires_at > NOW())) as active_bans
    `, (err, result) => {
        if (err) {
            console.error("Error fetching stats:", err);
            return res.status(500).json({ message: "Failed to fetch stats" });
        }
        res.json({
            totalUsers: parseInt(result.rows[0].total_users),
            totalRooms: parseInt(result.rows[0].total_rooms),
            totalMessages: parseInt(result.rows[0].total_messages),
            activeBans: parseInt(result.rows[0].active_bans)
        });
    });
});

app.get("/api/admin/users", requireAdminAPI, (req, res) => {
    db.pool.query(`
        SELECT 
            u.username, 
            u.chat_color, 
            u.avatar_url, 
            u.role, 
            u.email,
            EXISTS(SELECT 1 FROM bans WHERE username = u.username AND is_active = true AND (is_permanent = true OR expires_at > NOW())) as is_banned,
            EXISTS(SELECT 1 FROM mutes WHERE username = u.username AND is_active = true AND expires_at > NOW()) as is_muted
        FROM users u
        ORDER BY u.username ASC
    `, (err, result) => {
        if (err) {
            console.error("Error fetching users:", err);
            return res.status(500).json({ message: "Failed to fetch users" });
        }
        res.json({ users: result.rows });
    });
});

app.get("/api/admin/rooms", requireAdminAPI, (req, res) => {
    db.pool.query(`
        SELECT name, created_by, created_at, is_default
        FROM rooms
        ORDER BY is_default DESC, created_at DESC
    `, (err, result) => {
        if (err) {
            console.error("Error fetching rooms:", err);
            return res.status(500).json({ message: "Failed to fetch rooms" });
        }
        res.json({ rooms: result.rows });
    });
});

app.get("/api/admin/messages", requireAdminAPI, (req, res) => {
    db.pool.query(`
        SELECT m.id, m.room, m.username, m.message_text, m.chat_color, m.timestamp, m.file_url, m.file_type, u.avatar_url
        FROM messages m
        LEFT JOIN users u ON m.username = u.username
        ORDER BY m.timestamp DESC
        LIMIT 100
    `, (err, result) => {
        if (err) {
            console.error("Error fetching messages:", err);
            return res.status(500).json({ message: "Failed to fetch messages" });
        }
        res.json({ messages: result.rows });
    });
});

app.get("/api/admin/files", requireAdminAPI, (req, res) => {
    db.pool.query(`
        SELECT id, room, username, file_url, file_type, timestamp
        FROM messages
        WHERE file_url IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT 100
    `, (err, result) => {
        if (err) {
            console.error("Error fetching files:", err);
            return res.status(500).json({ message: "Failed to fetch files" });
        }
        res.json({ files: result.rows });
    });
});

app.post("/api/admin/toggle-admin", requireAdminAPI, (req, res) => {
    const { username, promote } = req.body;
    
    if (!username) {
        return res.status(400).json({ message: "Username is required" });
    }
    
    if (username === req.session.user.username) {
        return res.status(400).json({ message: "You cannot change your own role" });
    }
    
    const newRole = promote ? 'admin' : 'user';
    
    db.pool.query(
        'UPDATE users SET role = $1 WHERE username = $2',
        [newRole, username],
        (err) => {
            if (err) {
                console.error("Error updating user role:", err);
                return res.status(500).json({ message: "Failed to update user role" });
            }
            
            discordWebhook.sendDiscordWebhook(
                promote ? '⬆️ Admin Promotion' : '⬇️ Admin Demotion',
                `**${req.session.user.username}** ${promote ? 'promoted' : 'demoted'} **${username}** ${promote ? 'to' : 'from'} admin`,
                promote ? 0x5b2bff : 0x808080
            );
            
            res.json({ success: true, message: `User ${promote ? 'promoted to' : 'demoted from'} admin` });
        }
    );
});

app.post("/api/admin/delete-user", requireAdminAPI, (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ message: "Username is required" });
    }
    
    if (username === req.session.user.username) {
        return res.status(400).json({ message: "You cannot delete your own account from the admin panel. Use settings instead." });
    }
    
    db.pool.query('SELECT role FROM users WHERE username = $1', [username], (err, result) => {
        if (err) {
            console.error("Error checking user:", err);
            return res.status(500).json({ message: "Failed to check user" });
        }
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        
        db.deleteUserAccount(username, (deleteErr) => {
            if (deleteErr) {
                console.error("Error deleting user:", deleteErr);
                return res.status(500).json({ message: "Failed to delete user account" });
            }
            
            discordWebhook.sendDiscordWebhook(
                '🗑️ User Deleted by Admin',
                `**${req.session.user.username}** permanently deleted user **${username}**`,
                0xff0000
            );
            
            res.json({ success: true, message: `User ${username} has been deleted` });
        });
    });
});

app.get("/api/admin/user-modview/:username", requireAdminAPI, (req, res) => {
    const { username } = req.params;
    
    const queries = {
        user: db.pool.query('SELECT username, email, chat_color, bio, status, avatar_url, role FROM users WHERE username = $1', [username]),
        messageCount: db.pool.query('SELECT COUNT(*) as count FROM messages WHERE username = $1', [username]),
        fileCount: db.pool.query('SELECT COUNT(*) as count FROM messages WHERE username = $1 AND file_url IS NOT NULL', [username]),
        warnings: db.pool.query('SELECT * FROM warnings WHERE username = $1 ORDER BY created_at DESC', [username]),
        mutes: db.pool.query('SELECT * FROM mutes WHERE username = $1 ORDER BY created_at DESC LIMIT 10', [username]),
        bans: db.pool.query('SELECT * FROM bans WHERE username = $1 ORDER BY created_at DESC LIMIT 10', [username]),
        tickets: db.pool.query('SELECT COUNT(*) as count FROM support_tickets WHERE username = $1', [username])
    };
    
    Promise.all([
        queries.user,
        queries.messageCount,
        queries.fileCount,
        queries.warnings,
        queries.mutes,
        queries.bans,
        queries.tickets
    ]).then(([userResult, msgResult, fileResult, warningsResult, mutesResult, bansResult, ticketsResult]) => {
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.json({
            user: userResult.rows[0],
            activity: {
                messages: parseInt(msgResult.rows[0].count),
                files: parseInt(fileResult.rows[0].count),
                supportTickets: parseInt(ticketsResult.rows[0].count)
            },
            moderation: {
                warnings: warningsResult.rows,
                mutes: mutesResult.rows,
                bans: bansResult.rows
            }
        });
    }).catch(err => {
        console.error("Error fetching mod view data:", err);
        res.status(500).json({ message: "Failed to fetch user data" });
    });
});

app.get("/api/support/tickets", requireAdminAPI, (req, res) => {
    const status = req.query.status || 'all';
    
    let query = 'SELECT * FROM support_tickets';
    const params = [];
    
    if (status !== 'all') {
        query += ' WHERE status = $1';
        params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.pool.query(query, params, (err, result) => {
        if (err) {
            console.error("Error fetching tickets:", err);
            return res.status(500).json({ message: "Failed to fetch tickets" });
        }
        res.json({ tickets: result.rows });
    });
});

app.post("/api/support/tickets", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    const { email, priority, subject, message } = req.body;
    const username = req.session.user.username;
    
    if (!subject || !message) {
        return res.status(400).json({ message: "Subject and message are required" });
    }
    
    db.pool.query(
        'INSERT INTO support_tickets (username, email, subject, message, priority) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [username, email || req.session.user.email, subject, message, priority || 'normal'],
        (err, result) => {
            if (err) {
                console.error("Error creating ticket:", err);
                return res.status(500).json({ message: "Failed to create ticket" });
            }
            
            discordWebhook.sendDiscordWebhook(
                '🎫 New Support Ticket',
                `**${username}** submitted a new **${priority}** priority ticket\n**Subject:** ${subject}`,
                0x1ed5ff
            );
            
            res.json({ success: true, ticketId: result.rows[0].id, user: req.session.user });
        }
    );
});

app.put("/api/support/tickets/:id", requireAdminAPI, (req, res) => {
    const { id } = req.params;
    const { status, adminResponse } = req.body;
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (status) {
        updates.push(`status = $${paramIndex++}`);
        params.push(status);
    }
    
    if (adminResponse !== undefined) {
        updates.push(`admin_response = $${paramIndex++}`);
        params.push(adminResponse);
        updates.push(`responded_by = $${paramIndex++}`);
        params.push(req.session.user.username);
    }
    
    updates.push(`updated_at = NOW()`);
    params.push(id);
    
    const query = `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    
    db.pool.query(query, params, (err) => {
        if (err) {
            console.error("Error updating ticket:", err);
            return res.status(500).json({ message: "Failed to update ticket" });
        }
        res.json({ success: true });
    });
});

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

app.get("/settings", (req, res) => {
    if (!req.session.user) res.redirect("/");
    else res.sendFile(path.join(__dirname, "public", "settings.html"));
});

app.get("/developer", (req, res) => {
    if (!req.session.user) res.redirect("/");
    else res.sendFile(path.join(__dirname, "public", "developer.html"));
});

app.get("/support", (req, res) => {
    if (!req.session.user) res.redirect("/");
    else res.sendFile(path.join(__dirname, "public", "support.html"));
});

app.get("/api-docs", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "api-documentation.html"));
});

app.get("/developer-terms", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "developer-terms.html"));
});

// Developer API Key Management Routes
app.get("/api/developer/keys", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    db.getUserApiKeys(req.session.user.username, (err, keys) => {
        if (err) {
            console.error("Failed to get API keys:", err);
            return res.status(500).json({ message: "Failed to retrieve API keys" });
        }
        res.status(200).json({ keys });
    });
});

app.post("/api/developer/keys", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    const { appName, description } = req.body;
    
    if (!appName || appName.trim().length === 0) {
        return res.status(400).json({ message: "Application name is required" });
    }
    
    db.createApiKey(req.session.user.username, appName.trim(), description?.trim() || null, (err, apiKeyData) => {
        if (err) {
            console.error("Failed to create API key:", err);
            return res.status(500).json({ message: "Failed to create API key" });
        }
        
        // Log to Discord webhook
        discordWebhook.sendDiscordWebhook(
            "🔑 API Key Created",
            `User **${req.session.user.username}** created a new API key`,
            0x5b2bff,
            [
                { name: "App Name", value: appName.trim(), inline: true },
                { name: "Description", value: description?.trim() || "None", inline: true }
            ]
        );
        
        // Return the plaintext key (only time it will be shown)
        res.status(201).json({ apiKey: apiKeyData.plaintextKey, message: "API key created successfully" });
    });
});

app.post("/api/developer/keys/:keyId/deactivate", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    const keyId = parseInt(req.params.keyId);
    
    db.deactivateApiKey(req.session.user.username, keyId, (err, result) => {
        if (err) {
            console.error("Failed to deactivate API key:", err);
            return res.status(500).json({ message: err.message || "Failed to deactivate API key" });
        }
        res.status(200).json({ message: "API key deactivated successfully" });
    });
});

app.delete("/api/developer/keys/:keyId", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    const keyId = parseInt(req.params.keyId);
    
    db.deleteApiKey(req.session.user.username, keyId, (err, result) => {
        if (err) {
            console.error("Failed to delete API key:", err);
            return res.status(500).json({ message: err.message || "Failed to delete API key" });
        }
        res.status(200).json({ message: "API key deleted successfully" });
    });
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
        discordWebhook.logAvatarUpload(req.session.user.username);
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
    const { bio, status, chat_color, email } = req.body;
    
    // Validate email format if provided
    if (email !== undefined && email !== null && email !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
    }
    
    db.updateUserProfile(
        req.session.user.username,
        { bio, status, chat_color, email },
        (err) => {
            if (err) {
                if (err.code === 'EMAIL_DUPLICATE') {
                    return res.status(409).json({ message: "Email already in use" });
                }
                return res
                    .status(500)
                    .json({ message: "Failed to update profile" });
            }
            req.session.user.bio = bio;
            req.session.user.status = status;
            req.session.user.color = chat_color;
            if (email !== undefined) {
                req.session.user.email = email || null;
            }
            
            const updatedFields = [];
            if (bio !== undefined) updatedFields.push('Bio');
            if (status !== undefined) updatedFields.push('Status');
            if (chat_color !== undefined) updatedFields.push('Chat Color');
            if (email !== undefined) updatedFields.push('Email');
            
            if (updatedFields.length > 0) {
                discordWebhook.logProfileUpdate(req.session.user.username, updatedFields);
            }
            
            if (status !== undefined) {
                discordWebhook.logStatusChange(req.session.user.username, status);
            }
            
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

app.post("/delete-account", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    
    const { password } = req.body;
    if (!password)
        return res.status(400).json({ message: "Password is required" });
    
    const username = req.session.user.username;
    
    db.findUser(username, (err, user) => {
        if (err || !user)
            return res.status(500).json({ message: "Error verifying user" });
        
        const bcrypt = require('bcrypt');
        bcrypt.compare(password, user.password, (compareErr, isMatch) => {
            if (compareErr || !isMatch)
                return res.status(401).json({ message: "Invalid password" });
            
            db.deleteUserAccount(username, (deleteErr) => {
                if (deleteErr)
                    return res.status(500).json({ message: "Failed to delete account" });
                
                discordWebhook.logAccountDeletion(username);
                
                req.session.destroy((sessionErr) => {
                    if (sessionErr)
                        console.error("Error destroying session:", sessionErr);
                    
                    res.status(200).json({ message: "Account deleted successfully" });
                });
            });
        });
    });
});

app.post("/change-username", (req, res) => {
    if (!req.session.user)
        return res.status(401).json({ message: "Unauthorized" });
    
    const { newUsername, password } = req.body;
    if (!newUsername || !password)
        return res.status(400).json({ message: "New username and password are required" });
    
    if (newUsername.length < 3 || newUsername.length > 20)
        return res.status(400).json({ message: "Username must be 3-20 characters" });
    
    const oldUsername = req.session.user.username;
    
    db.findUser(oldUsername, (err, user) => {
        if (err || !user)
            return res.status(500).json({ message: "Error verifying user" });
        
        const bcrypt = require('bcrypt');
        bcrypt.compare(password, user.password, (compareErr, isMatch) => {
            if (compareErr || !isMatch)
                return res.status(401).json({ message: "Invalid password" });
            
            db.changeUsername(oldUsername, newUsername, (changeErr) => {
                if (changeErr) {
                    if (changeErr.code === '23505')
                        return res.status(409).json({ message: "Username already taken" });
                    return res.status(500).json({ message: "Failed to change username" });
                }
                
                req.session.user.username = newUsername;
                discordWebhook.logUsernameChange(oldUsername, newUsername);
                req.session.save((saveErr) => {
                    if (saveErr)
                        return res.status(500).json({ message: "Error saving session" });
                    
                    io.emit("usernameChanged", { oldUsername, newUsername });
                    res.status(200).json({ message: "Username changed successfully", newUsername });
                });
            });
        });
    });
});

app.get("/user-profile/:username", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const { username } = req.params;
    db.findUser(username, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({
            username: user.username,
            chat_color: user.chat_color,
            bio: user.bio,
            status: user.status,
            avatar_url: user.avatar_url
        });
    });
});

app.get("/blocked-users", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    db.getBlockedUsers(req.session.user.username, (err, blockedUsers) => {
        if (err) {
            return res.status(500).json({ message: "Failed to get blocked users" });
        }
        res.status(200).json({ blockedUsers });
    });
});

app.post("/block-user", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: "Username is required" });
    }
    db.blockUser(req.session.user.username, username, (err, block) => {
        if (err) {
            if (err.message === 'Cannot block yourself') {
                return res.status(400).json({ message: err.message });
            }
            if (err.message === 'User is already blocked') {
                return res.status(409).json({ message: err.message });
            }
            return res.status(500).json({ message: "Failed to block user" });
        }
        discordWebhook.logUserBlocked(req.session.user.username, username);
        res.status(201).json({ message: "User blocked successfully", block });
    });
});

app.post("/unblock-user", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: "Username is required" });
    }
    db.unblockUser(req.session.user.username, username, (err, block) => {
        if (err) {
            if (err.message === 'User is not blocked') {
                return res.status(404).json({ message: err.message });
            }
            return res.status(500).json({ message: "Failed to unblock user" });
        }
        discordWebhook.logUserUnblocked(req.session.user.username, username);
        res.status(200).json({ message: "User unblocked successfully" });
    });
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

    db.getActiveBan(user.username, (banErr, ban) => {
        if (ban) {
            console.log(`Banned user ${user.username} attempted to connect. Disconnecting.`);
            socket.emit('error', { type: 'banned', message: 'You are banned from this server', ban });
            return socket.disconnect(true);
        }

        console.log(`User connected: ${user.username} (${clientType.toUpperCase()})`);

        socket.join(user.username);
        socket.user = user;
        socket.clientType = clientType;

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
        db.getActiveMute(user.username, (muteErr, mute) => {
            if (mute) {
                return socket.emit('error', { type: 'muted', message: 'You are muted and cannot send messages', mute });
            }
            
            const timestamp = new Date();
            const sanitizedText = msg.text
                ? msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")
                : "";
            
            const mentionRegex = /@(\w+)/g;
            const mentions = [];
            let match;
            while ((match = mentionRegex.exec(msg.text || '')) !== null) {
                mentions.push(match[1]);
            }
            
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
                        mentions: mentions,
                    };
                    discordWebhook.logChatMessage(user.username, socket.currentRoom, sanitizedText, !!msg.fileUrl, clientType);
                    io.to(socket.currentRoom).emit("chatMessage", messageToSend);
                    
                    mentions.forEach((mentionedUser) => {
                        if (mentionedUser !== user.username) {
                            db.findUser(mentionedUser, (userErr, foundUser) => {
                                if (!userErr && foundUser) {
                                    db.addNotification(mentionedUser, 'mention', `${user.username} mentioned you in ${socket.currentRoom}`, (notifErr) => {
                                        if (!notifErr) {
                                            io.to(mentionedUser).emit('notification', {
                                                type: 'mention',
                                                from: user.username,
                                                room: socket.currentRoom,
                                                message: sanitizedText
                                            });
                                            discordWebhook.logMention(user.username, mentionedUser, socket.currentRoom, sanitizedText);
                                        }
                                    });
                                }
                            });
                        }
                    });
                },
            );
        });
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
            discordWebhook.logReaction(user.username, emoji, socket.currentRoom);
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

    socket.on("deleteMessage", ({ messageId }) => {
        db.pool.query('SELECT username FROM messages WHERE id = $1', [messageId], (err, result) => {
            if (err || result.rows.length === 0) {
                return socket.emit('error', { message: 'Message not found' });
            }
            
            const messageAuthor = result.rows[0].username;
            const isAdmin = user.role === 'admin';
            const isAuthor = messageAuthor === user.username;
            
            if (!isAdmin && !isAuthor) {
                return socket.emit('error', { message: 'You can only delete your own messages' });
            }
            
            db.deleteMessage(messageId, (deleteErr) => {
                if (deleteErr) return console.error("Error deleting message:", deleteErr);
                io.to(socket.currentRoom).emit("messageDeleted", { messageId });
            });
        });
    });

    socket.on("privateMessage", ({ to, text }) => {
        db.getActiveMute(user.username, (muteErr, mute) => {
            if (mute) {
                return socket.emit('error', { type: 'muted', message: 'You are muted and cannot send messages', mute });
            }
            
            db.isUserBlocked(user.username, to, (blockErr, youBlocked) => {
                if (blockErr) {
                    return console.error("Error checking if user is blocked:", blockErr);
                }
                if (youBlocked) {
                    return socket.emit('error', { type: 'blocked', message: 'Cannot send message to blocked user' });
                }
                
                db.isBlockedBy(user.username, to, (blockedByErr, blockedByThem) => {
                    if (blockedByErr) {
                        return console.error("Error checking if blocked by user:", blockedByErr);
                    }
                    if (blockedByThem) {
                        return socket.emit('error', { type: 'blocked', message: 'This user has blocked you' });
                    }
                    
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
            });
        });
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
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () =>
    console.log(`Server is running on http://0.0.0.0:${PORT}`),
);
