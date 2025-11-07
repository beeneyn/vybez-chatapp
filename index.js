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
const discordWebhook = require("./discord-webhook.js");
const moderationRoutes = require("./moderation-routes.js");
const emailService = require("./emailService.js");
const serverLogger = require("./serverLogger.js");
const apiRoutes = require("./api-routes.js");
const apiMiddleware = require("./api-middleware.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const sessionsDir = path.join(__dirname, "sessions");
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

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
    store: new FileStore({ path: sessionsDir, ttl: 86400, retries: 0 }),
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
    const allowedForAnonymous = ['/', '/signup', '/login', '/desktop-login', '/health', '/404.html', '/401.html', '/403.html', '/500.html', '/502.html', '/maintenance.html', '/invite-mockup.html', '/roadmap.html'];
    
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.mp3', '.wav'];
    const isStaticAsset = staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext)) ||
                          req.path.startsWith('/dist/') ||
                          req.path.startsWith('/uploads/');
    const isSupportAPI = req.path.startsWith('/api/support/');
    
    if (!req.session.user) {
        const isAnonymousRoute = allowedForAnonymous.includes(req.path) || isStaticAsset;
        if (isAnonymousRoute) {
            return next();
        }
        if (req.path.endsWith('.html') || req.path.startsWith('/api/')) {
            return res.redirect('/');
        }
        return next();
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

const maintenanceMiddleware = async (req, res, next) => {
    const excludedPaths = [
        '/maintenance',
        '/admin-panel.html',
        '/api/admin/maintenance',
        '/login',
        '/signup',
        '/desktop-login',
        '/landing.html',
        '/check-session',
        '/404.html',
        '/401.html',
        '/403.html',
        '/500.html',
        '/502.html',
        '/dist/',
        '/uploads/',
        '/favicon.png',
        '/tailwind.css',
        '/style.css',
        '.js',
        '.css',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
        '.ico',
        '.woff',
        '.woff2',
        '.ttf'
    ];
    
    const isExcluded = excludedPaths.some(path => req.path.includes(path));
    
    if (isExcluded) {
        return next();
    }
    
    if (req.path === '/') {
        return next();
    }
    
    try {
        const result = await db.pool.query(
            "SELECT value FROM system_settings WHERE key = 'maintenance_mode'"
        );
        const maintenanceMode = result.rows[0]?.value === 'true';
        
        if (maintenanceMode) {
            const isAdmin = req.session.user && req.session.user.role === 'admin';
            
            if (!isAdmin) {
                return res.status(503).sendFile(path.join(__dirname, "public", "maintenance.html"));
            }
        }
        
        next();
    } catch (err) {
        console.error('Error checking maintenance mode:', err);
        next();
    }
};

app.use(maintenanceMiddleware);

app.use('/api/developer', apiRoutes);

const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).sendFile(path.join(__dirname, "public", "401.html"));
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

app.post("/api/support/tickets", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    const { email, priority, subject, message } = req.body;
    const username = req.session.user.username;
    const userEmail = email || req.session.user.email;
    
    if (!subject || !message) {
        return res.status(400).json({ message: "Subject and message are required" });
    }
    
    try {
        const result = await db.pool.query(
            'INSERT INTO support_tickets (username, email, subject, message, priority) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [username, userEmail, subject, message, priority || 'normal']
        );
        
        const ticketId = result.rows[0].id;
        
        discordWebhook.sendDiscordWebhook(
            '🎫 New Support Ticket',
            `**${username}** submitted a new **${priority || 'normal'}** priority ticket\n**Subject:** ${subject}`,
            0x1ed5ff
        );
        
        if (userEmail) {
            const emailSent = await emailService.sendSupportTicketConfirmation(userEmail, username, ticketId, subject);
            if (emailSent) {
                await db.pool.query(
                    'UPDATE support_tickets SET confirmation_sent_at = NOW() WHERE id = $1',
                    [ticketId]
                );
                serverLogger.system('Support ticket confirmation email sent', { ticketId, username, email: userEmail });
            }
        }
        
        res.json({ success: true, ticketId, user: req.session.user });
    } catch (err) {
        console.error("Error creating ticket:", err);
        serverLogger.error('SUPPORT', 'Failed to create support ticket', { username, error: err.message });
        res.status(500).json({ message: "Failed to create ticket" });
    }
});

app.put("/api/support/tickets/:id", requireAdminAPI, async (req, res) => {
    const { id } = req.params;
    const { status, adminResponse } = req.body;
    
    try {
        const ticketResult = await db.pool.query('SELECT username, email, subject FROM support_tickets WHERE id = $1', [id]);
        if (ticketResult.rows.length === 0) {
            return res.status(404).json({ message: "Ticket not found" });
        }
        
        const ticket = ticketResult.rows[0];
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
        
        const query = `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        
        await db.pool.query(query, params);
        
        if (adminResponse && ticket.email) {
            const emailSent = await emailService.sendSupportTicketResponse(
                ticket.email, 
                ticket.username, 
                id, 
                ticket.subject, 
                adminResponse, 
                req.session.user.username
            );
            if (emailSent) {
                await db.pool.query(
                    'UPDATE support_tickets SET response_sent_at = NOW() WHERE id = $1',
                    [id]
                );
                serverLogger.system('Support ticket response email sent', { ticketId: id, username: ticket.username, email: ticket.email });
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error("Error updating ticket:", err);
        serverLogger.error('SUPPORT', 'Failed to update support ticket', { ticketId: id, error: err.message });
        res.status(500).json({ message: "Failed to update ticket" });
    }
});

app.get("/api/admin/announcements", requireAdminAPI, (req, res) => {
    db.getAllAnnouncements((err, announcements) => {
        if (err) {
            console.error("Error fetching announcements:", err);
            return res.status(500).json({ message: "Failed to fetch announcements" });
        }
        res.json({ announcements });
    });
});

app.get("/api/announcements", (req, res) => {
    db.getAllAnnouncements((err, announcements) => {
        if (err) {
            console.error("Error fetching announcements:", err);
            return res.status(500).json({ message: "Failed to fetch announcements" });
        }
        res.json({ announcements });
    });
});

app.post("/api/admin/announcements", requireAdminAPI, (req, res) => {
    const { title, content } = req.body;
    const postedBy = req.session.user.username;
    
    if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
    }
    
    db.createAnnouncement(title, content, postedBy, (err, announcement) => {
        if (err) {
            console.error("Error creating announcement:", err);
            serverLogger.error('ANNOUNCEMENTS', 'Failed to create announcement', { username: postedBy, error: err.message });
            return res.status(500).json({ message: "Failed to create announcement" });
        }
        
        io.emit("newAnnouncement", announcement);
        
        discordWebhook.sendDiscordWebhook(
            '📢 New Announcement',
            `**${postedBy}** posted: **${title}**\n${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`,
            0xff3f8f
        );
        
        serverLogger.system('Announcement created', { title, postedBy, id: announcement.id });
        res.json({ success: true, announcement });
    });
});

app.delete("/api/admin/announcements/:id", requireAdminAPI, (req, res) => {
    const { id } = req.params;
    
    db.deleteAnnouncement(id, (err, announcement) => {
        if (err) {
            console.error("Error deleting announcement:", err);
            serverLogger.error('ANNOUNCEMENTS', 'Failed to delete announcement', { id, error: err.message });
            return res.status(500).json({ message: "Failed to delete announcement" });
        }
        
        io.emit("announcementDeleted", { id: parseInt(id) });
        
        serverLogger.system('Announcement deleted', { id, deletedBy: req.session.user.username });
        res.json({ success: true });
    });
});

app.patch("/api/admin/announcements/:id/pin", requireAdminAPI, (req, res) => {
    const { id } = req.params;
    
    db.togglePinAnnouncement(id, (err, announcement) => {
        if (err) {
            console.error("Error toggling pin:", err);
            serverLogger.error('ANNOUNCEMENTS', 'Failed to toggle pin', { id, error: err.message });
            return res.status(500).json({ message: "Failed to toggle pin" });
        }
        
        io.emit("announcementUpdated", announcement);
        
        serverLogger.system('Announcement pin toggled', { id, isPinned: announcement.is_pinned, user: req.session.user.username });
        res.json({ success: true, announcement });
    });
});

app.post("/api/announcements/:id/mark-read", (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
    
    const { id } = req.params;
    const username = req.session.user.username;
    
    db.markAnnouncementAsRead(username, id, (err) => {
        if (err) {
            console.error("Error marking announcement as read:", err);
            return res.status(500).json({ message: "Failed to mark announcement as read" });
        }
        res.json({ success: true });
    });
});

app.get("/api/announcements/unread", (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
    
    db.getUnreadAnnouncementIds(req.session.user.username, (err, unreadIds) => {
        if (err) {
            console.error("Error fetching unread announcements:", err);
            return res.status(500).json({ message: "Failed to fetch unread announcements" });
        }
        res.json({ unreadIds });
    });
});

app.get("/api/unread-counts", (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
    
    db.getUnreadCounts(req.session.user.username, (err, counts) => {
        if (err) {
            console.error("Error fetching unread counts:", err);
            return res.status(500).json({ message: "Failed to fetch unread counts" });
        }
        res.json({ counts });
    });
});

app.post("/api/rooms/:room/mark-read", (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
    
    const { room } = req.params;
    const { messageId } = req.body;
    const username = req.session.user.username;
    
    if (!messageId) {
        return res.status(400).json({ message: "Message ID is required" });
    }
    
    db.updateRoomReadPosition(username, room, messageId, (err) => {
        if (err) {
            console.error("Error updating read position:", err);
            return res.status(500).json({ message: "Failed to update read position" });
        }
        res.json({ success: true });
    });
});

app.post("/api/notifications/mark-all-read", (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
    
    db.markAllNotificationsRead(req.session.user.username, (err) => {
        if (err) {
            console.error("Error marking notifications as read:", err);
            return res.status(500).json({ message: "Failed to mark notifications as read" });
        }
        res.json({ success: true });
    });
});

app.get("/api/admin/maintenance", requireAdminAPI, async (req, res) => {
    try {
        const result = await db.pool.query(
            "SELECT value FROM system_settings WHERE key = 'maintenance_mode'"
        );
        const maintenanceMode = result.rows[0]?.value === 'true';
        res.json({ maintenanceMode });
    } catch (err) {
        serverLogger.error('SYSTEM', 'Failed to get maintenance mode status', { error: err.message });
        res.status(500).json({ message: 'Failed to get maintenance mode status' });
    }
});

app.post("/api/admin/maintenance", requireAdminAPI, async (req, res) => {
    try {
        const { enabled } = req.body;
        
        await db.pool.query(
            "UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = 'maintenance_mode'",
            [enabled ? 'true' : 'false']
        );
        
        serverLogger.system('Maintenance mode toggled', { 
            enabled, 
            admin: req.session.user.username 
        });
        
        res.json({ success: true, maintenanceMode: enabled });
    } catch (err) {
        serverLogger.error('SYSTEM', 'Failed to toggle maintenance mode', { error: err.message });
        res.status(500).json({ message: 'Failed to toggle maintenance mode' });
    }
});

app.get("/api/admin/database-stats", requireAdminAPI, async (req, res) => {
    try {
        const tableStatsQuery = `
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
                (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = tablename AND table_schema = schemaname) AS column_count
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `;
        
        const rowCountsQuery = `
            SELECT 
                schemaname || '.' || relname as table_name,
                n_live_tup as row_count
            FROM pg_stat_user_tables
            WHERE schemaname = 'public'
            ORDER BY relname
        `;
        
        const databaseSizeQuery = `
            SELECT pg_size_pretty(pg_database_size(current_database())) as database_size,
                   pg_database_size(current_database()) as database_size_bytes
        `;
        
        const indexStatsQuery = `
            SELECT 
                tablename,
                indexname,
                pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
            FROM pg_indexes
            WHERE schemaname = 'public'
            ORDER BY pg_relation_size(indexname::regclass) DESC
            LIMIT 10
        `;
        
        const [tableStats, rowCounts, dbSize, indexStats] = await Promise.all([
            db.pool.query(tableStatsQuery),
            db.pool.query(rowCountsQuery),
            db.pool.query(databaseSizeQuery),
            db.pool.query(indexStatsQuery)
        ]);
        
        res.json({
            tables: tableStats.rows,
            rowCounts: rowCounts.rows,
            databaseSize: dbSize.rows[0],
            indexes: indexStats.rows
        });
    } catch (err) {
        serverLogger.error('DATABASE', 'Failed to fetch database statistics', { error: err.message });
        res.status(500).json({ message: 'Failed to fetch database statistics' });
    }
});

app.get("/health-check", async (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
    });
});

async function performHealthCheck() {
    try {
        const port = process.env.PORT || 5000;
        const start = Date.now();
        const response = await fetch(`http://localhost:${port}/health-check`);
        const responseTime = Date.now() - start;
        
        if (response.ok) {
            await db.pool.query(
                'INSERT INTO health_checks (response_time_ms) VALUES ($1)',
                [responseTime]
            );
            serverLogger.system('Health check completed', { responseTime });
        } else {
            serverLogger.error('HEALTH', 'Health check returned non-OK status', { status: response.status, responseTime });
        }
    } catch (err) {
        serverLogger.error('HEALTH', 'Health check failed', { error: err.message });
    }
}

setInterval(performHealthCheck, 3 * 60 * 60 * 1000);

setTimeout(performHealthCheck, 5000);

app.get("/api/admin/health-check-data", requireAdminAPI, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        
        const query = `
            SELECT 
                checked_at,
                response_time_ms
            FROM health_checks
            WHERE checked_at >= NOW() - INTERVAL '${days} days'
            ORDER BY checked_at ASC
            LIMIT 1000
        `;
        
        const result = await db.pool.query(query);
        res.json({ healthChecks: result.rows });
    } catch (err) {
        serverLogger.error('DATABASE', 'Failed to fetch health check data', { error: err.message });
        res.status(500).json({ message: 'Failed to fetch health check data' });
    }
});

app.get("/api/admin/activity-data", requireAdminAPI, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        
        const messagesQuery = `
            SELECT DATE(timestamp) as date, COUNT(*) as count
            FROM messages
            WHERE timestamp >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `;
        
        const privateMessagesQuery = `
            SELECT DATE(timestamp) as date, COUNT(*) as count
            FROM private_messages
            WHERE timestamp >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `;
        
        const roomsCreatedQuery = `
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM rooms
            WHERE created_at >= NOW() - INTERVAL '${days} days' AND is_default = false
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `;
        
        const supportTicketsQuery = `
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM support_tickets
            WHERE created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `;
        
        const apiRequestsQuery = `
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM api_logs
            WHERE created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `;
        
        const totalUsersQuery = `
            SELECT COUNT(*) as count FROM users
        `;
        
        const [messages, privateMessages, roomsCreated, supportTickets, apiRequests, totalUsers] = await Promise.all([
            db.pool.query(messagesQuery),
            db.pool.query(privateMessagesQuery),
            db.pool.query(roomsCreatedQuery),
            db.pool.query(supportTicketsQuery),
            db.pool.query(apiRequestsQuery),
            db.pool.query(totalUsersQuery)
        ]);
        
        res.json({
            userSignups: [],
            totalUsers: parseInt(totalUsers.rows[0].count),
            messages: messages.rows,
            privateMessages: privateMessages.rows,
            roomsCreated: roomsCreated.rows,
            supportTickets: supportTickets.rows,
            apiRequests: apiRequests.rows
        });
    } catch (err) {
        serverLogger.error('DATABASE', 'Failed to fetch activity data', { error: err.message });
        res.status(500).json({ message: 'Failed to fetch activity data' });
    }
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

app.get("/maintenance", (req, res) => {
    res.status(503).sendFile(path.join(__dirname, "public", "maintenance.html"));
});

app.get("/500", (req, res) => {
    res.status(500).sendFile(path.join(__dirname, "public", "500.html"));
});

app.get("/502", (req, res) => {
    res.status(502).sendFile(path.join(__dirname, "public", "502.html"));
});

app.get("/403", (req, res) => {
    res.status(403).sendFile(path.join(__dirname, "public", "403.html"));
});

app.get("/api-docs", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "api-documentation.html"));
});

app.get("/developer-terms", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "developer-terms.html"));
});

app.get("/self-hosting", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "self-hosting.html"));
});

app.get("/invite-mockup.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "invite-mockup.html"));
});

// Developer API Key Management Routes
app.get("/api/developer/stats", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Get API usage statistics for the user
    const username = req.session.user.username;
    
    // Count total API requests in the last 30 days
    db.pool.query(
        `SELECT COUNT(*) as total FROM api_logs WHERE username = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
        [username],
        (err, requestsResult) => {
            if (err) {
                console.error("Failed to get API stats:", err);
                return res.status(500).json({ message: "Failed to retrieve stats" });
            }
            
            // Count active API keys
            db.pool.query(
                `SELECT COUNT(*) as active FROM api_keys WHERE username = $1 AND is_active = true`,
                [username],
                (err, keysResult) => {
                    if (err) {
                        console.error("Failed to get active keys count:", err);
                        return res.status(500).json({ message: "Failed to retrieve stats" });
                    }
                    
                    res.status(200).json({
                        totalRequests: parseInt(requestsResult.rows[0].total) || 0,
                        activeKeys: parseInt(keysResult.rows[0].active) || 0
                    });
                }
            );
        }
    );
});

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

app.get("/health", async (req, res) => {
    try {
        const maintenanceResult = await db.pool.query(
            "SELECT value FROM system_settings WHERE key = 'maintenance_mode'"
        );
        const maintenanceMode = maintenanceResult.rows[0]?.value === 'true';
        
        if (maintenanceMode) {
            return res.status(503).json({
                status: "MAINTENANCE",
                message: "System is currently under maintenance",
                timestamp: new Date().toISOString()
            });
        }
        
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
    } catch (err) {
        res.status(503).json({
            status: "ERROR",
            message: "Health check failed",
            timestamp: new Date().toISOString()
        });
    }
});

app.post("/signup", (req, res) => {
    let { username, password, chat_color, display_name } = req.body;
    
    // Convert username to lowercase automatically
    username = username.toLowerCase();
    
    // Username validation
    const usernameRegex = /^[a-z0-9_.]+$/;
    if (!usernameRegex.test(username)) {
        return res.status(400).json({ 
            message: "Username can only contain lowercase letters, numbers, underscores, and periods." 
        });
    }
    
    if (username.length > 15) {
        return res.status(400).json({ 
            message: "Username must be 15 characters or less." 
        });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ 
            message: "Username must be at least 3 characters." 
        });
    }
    
    // Password validation
    if (password.length < 8) {
        return res.status(400).json({ 
            message: "Password must be at least 8 characters long." 
        });
    }
    
    if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ 
            message: "Password must contain at least one uppercase letter." 
        });
    }
    
    if (!/[a-z]/.test(password)) {
        return res.status(400).json({ 
            message: "Password must contain at least one lowercase letter." 
        });
    }
    
    if (!/[0-9]/.test(password)) {
        return res.status(400).json({ 
            message: "Password must contain at least one number." 
        });
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return res.status(400).json({ 
            message: "Password must contain at least one special character (!@#$%^&*)." 
        });
    }
    
    // If no display name provided, use username
    if (!display_name || display_name.trim() === '') {
        display_name = username;
    }
    
    db.addUser(username, password, chat_color, display_name, (err) => {
        if (err) {
            if (err.code === "SQLITE_CONSTRAINT" || err.code === "23505")
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
    const { bio, status, chat_color, email, display_name } = req.body;
    
    // Validate email format if provided
    if (email !== undefined && email !== null && email !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
    }
    
    // Validate display name length if provided
    if (display_name && display_name.length > 32) {
        return res.status(400).json({ message: "Display name must be 32 characters or less" });
    }
    
    db.updateUserProfile(
        req.session.user.username,
        { bio, status, chat_color, email, display_name },
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
            if (display_name !== undefined) {
                req.session.user.display_name = display_name || null;
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

app.get("/api/user/stats", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const username = req.session.user.username;
        
        const messageCountQuery = await db.pool.query(
            "SELECT COUNT(*) as count FROM messages WHERE username = $1",
            [username]
        );
        
        const fileCountQuery = await db.pool.query(
            "SELECT COUNT(*) as count FROM messages WHERE username = $1 AND file_url IS NOT NULL",
            [username]
        );
        
        const roomCountQuery = await db.pool.query(
            "SELECT COUNT(*) as count FROM rooms WHERE created_by = $1",
            [username]
        );
        
        const userQuery = await db.pool.query(
            "SELECT created_at FROM users WHERE username = $1",
            [username]
        );
        
        const accountAge = userQuery.rows[0]?.created_at 
            ? Math.floor((Date.now() - new Date(userQuery.rows[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
        
        res.json({
            messageCount: parseInt(messageCountQuery.rows[0]?.count || 0),
            fileCount: parseInt(fileCountQuery.rows[0]?.count || 0),
            roomCount: parseInt(roomCountQuery.rows[0]?.count || 0),
            accountAge
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        serverLogger.error('USER', 'Failed to fetch user stats', { username: req.session.user.username, error: error.message });
        res.status(500).json({ message: "Failed to fetch user statistics" });
    }
});

app.get("/api/user/download-data", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const username = req.session.user.username;
        
        const userDataQuery = await db.pool.query(
            "SELECT username, email, bio, status, chat_color, avatar_url, role, created_at FROM users WHERE username = $1",
            [username]
        );
        
        const messagesQuery = await db.pool.query(
            "SELECT room, message_text, timestamp, file_url, file_type FROM messages WHERE username = $1 ORDER BY timestamp DESC",
            [username]
        );
        
        const roomsQuery = await db.pool.query(
            "SELECT name, created_at FROM rooms WHERE created_by = $1 ORDER BY created_at DESC",
            [username]
        );
        
        const privateMessagesQuery = await db.pool.query(
            "SELECT sender_username, recipient_username, message_text, timestamp FROM private_messages WHERE sender_username = $1 OR recipient_username = $1 ORDER BY timestamp DESC",
            [username]
        );
        
        const userData = {
            profile: userDataQuery.rows[0],
            messages: messagesQuery.rows,
            rooms: roomsQuery.rows,
            privateMessages: privateMessagesQuery.rows,
            exportDate: new Date().toISOString()
        };
        
        serverLogger.system('User data downloaded', { username });
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="vybez-data-${username}-${Date.now()}.json"`);
        res.send(JSON.stringify(userData, null, 2));
    } catch (error) {
        console.error('Error downloading user data:', error);
        serverLogger.error('USER', 'Failed to download user data', { username: req.session.user.username, error: error.message });
        res.status(500).json({ message: "Failed to download user data" });
    }
});

app.post("/api/sessions/logout-all", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const username = req.session.user.username;
        const currentSessionId = req.sessionID;
        
        serverLogger.system('All sessions logged out', { username, keptSession: currentSessionId });
        
        res.json({ 
            success: true, 
            message: "Logged out from all other sessions",
            note: "Multi-session tracking will be fully implemented in v1.2"
        });
    } catch (error) {
        console.error('Error logging out sessions:', error);
        serverLogger.error('SESSIONS', 'Failed to logout all sessions', { username: req.session.user.username, error: error.message });
        res.status(500).json({ message: "Failed to logout from all sessions" });
    }
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
    
    // Check if user has permission to delete this room
    db.getAllRooms((err, rooms) => {
        if (err) return res.status(500).json({ message: "Failed to get room info" });
        
        const room = rooms.find(r => r.name === roomName);
        if (!room) return res.status(404).json({ message: "Room not found" });
        
        const isCreator = room.created_by === req.session.user.username;
        const isAdmin = req.session.user.role === 'admin';
        
        if (!isCreator && !isAdmin) {
            return res.status(403).json({ message: "Only the room creator or admins can delete this room" });
        }
        
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
});

const onlineUsers = new Map();
const typingUsers = new Map();

const emitFullUserList = () => {
    db.getAllUsers((err, allUsers) => {
        if (err) {
            console.error('Error fetching all users:', err);
            return;
        }
        
        const onlineUsernames = Array.from(onlineUsers.values()).map(u => u.username);
        
        const usersWithStatus = allUsers.map(user => ({
            username: user.username,
            color: user.chat_color,
            avatar: user.avatar_url,
            bio: user.bio,
            status: user.status,
            role: user.role,
            isOnline: onlineUsernames.includes(user.username)
        }));
        
        usersWithStatus.sort((a, b) => {
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return a.username.localeCompare(b.username);
        });
        
        io.emit("updateUserList", usersWithStatus);
    });
};

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
        emitFullUserList();
        socket.emit("roomList", roomList);

        db.getRecentMessages(defaultRoom, (err, messages) => {
            if (!err && messages) {
                const history = messages.map((msg) => ({
                    id: msg.id,
                    user: msg.username,
                    display_name: msg.display_name,
                    text: msg.message_text,
                    color: msg.chat_color,
                    timestamp: msg.timestamp,
                    fileUrl: msg.file_url,
                    fileType: msg.file_type,
                    avatar: msg.avatar_url,
                    role: msg.role,
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
                    display_name: msg.display_name,
                    text: msg.message_text,
                    color: msg.chat_color,
                    timestamp: msg.timestamp,
                    fileUrl: msg.file_url,
                    fileType: msg.file_type,
                    avatar: msg.avatar_url,
                    role: msg.role,
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
                        display_name: user.display_name,
                        text: sanitizedText,
                        color: user.color,
                        timestamp: timestamp,
                        fileUrl: msg.fileUrl,
                        fileType: msg.fileType,
                        avatar: user.avatar,
                        role: user.role,
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
            emitFullUserList();
        });
    });
});

app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.use((err, req, res, next) => {
    console.error("Server error:", err);
    serverLogger.error('SYSTEM', 'Unhandled server error', { 
        error: err.message, 
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    res.status(500).sendFile(path.join(__dirname, "public", "500.html"));
});

const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('⚠️  MISSING REQUIRED ENVIRONMENT VARIABLES:', missingEnvVars.join(', '));
    console.error('⚠️  Server may not function correctly without these variables');
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server is running on http://0.0.0.0:${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Database URL: ${process.env.DATABASE_URL ? 'configured' : 'MISSING'}`);
});
