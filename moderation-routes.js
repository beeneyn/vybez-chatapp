const db = require('./database.js');
const discordWebhook = require('./discord-webhook.js');

const isAdmin = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
};

module.exports = (app) => {
    app.get('/api/moderation/warnings', isAdmin, (req, res) => {
        const { username } = req.query;
        db.getWarnings(username || null, (err, warnings) => {
            if (err) return res.status(500).json({ message: "Failed to get warnings" });
            res.status(200).json({ warnings });
        });
    });

    app.post('/api/moderation/warnings', isAdmin, (req, res) => {
        const { username, reason } = req.body;
        if (!username || !reason) {
            return res.status(400).json({ message: "Username and reason are required" });
        }
        db.addWarning(username, req.session.user.username, reason, (err, warning) => {
            if (err) return res.status(500).json({ message: "Failed to create warning" });
            
            const notificationMessage = `You have received a warning from ${req.session.user.username}: ${reason}`;
            db.addNotification(username, 'warning', notificationMessage, (notifErr) => {
                if (notifErr) console.error('Failed to create notification:', notifErr);
            });
            
            discordWebhook.logWarning(username, req.session.user.username, reason);
            
            res.status(201).json({ message: "Warning created successfully", warning });
        });
    });

    app.delete('/api/moderation/warnings/:id', isAdmin, (req, res) => {
        const { id } = req.params;
        db.deleteWarning(id, (err) => {
            if (err) return res.status(500).json({ message: "Failed to delete warning" });
            res.status(200).json({ message: "Warning deleted successfully" });
        });
    });

    app.get('/api/moderation/mutes', isAdmin, (req, res) => {
        const activeOnly = req.query.active === 'true';
        db.getMutes(activeOnly, (err, mutes) => {
            if (err) return res.status(500).json({ message: "Failed to get mutes" });
            res.status(200).json({ mutes });
        });
    });

    app.post('/api/moderation/mutes', isAdmin, (req, res) => {
        const { username, reason, durationMinutes } = req.body;
        if (!username || !reason || !durationMinutes) {
            return res.status(400).json({ message: "Username, reason, and duration are required" });
        }
        db.addMute(username, req.session.user.username, reason, durationMinutes, (err, mute) => {
            if (err) return res.status(500).json({ message: "Failed to create mute" });
            
            const notificationMessage = `You have been muted by ${req.session.user.username} for ${durationMinutes} minutes. Reason: ${reason}`;
            db.addNotification(username, 'mute', notificationMessage, (notifErr) => {
                if (notifErr) console.error('Failed to create notification:', notifErr);
            });
            
            discordWebhook.logMute(username, req.session.user.username, reason, `${durationMinutes} minutes`);
            
            res.status(201).json({ message: "Mute created successfully", mute });
        });
    });

    app.delete('/api/moderation/mutes/:id', isAdmin, (req, res) => {
        const { id } = req.params;
        db.removeMute(id, (err) => {
            if (err) return res.status(500).json({ message: "Failed to remove mute" });
            res.status(200).json({ message: "Mute removed successfully" });
        });
    });

    app.get('/api/moderation/bans', isAdmin, (req, res) => {
        const activeOnly = req.query.active === 'true';
        db.getBans(activeOnly, (err, bans) => {
            if (err) return res.status(500).json({ message: "Failed to get bans" });
            res.status(200).json({ bans });
        });
    });

    app.post('/api/moderation/bans', isAdmin, (req, res) => {
        const { username, reason, isPermanent, durationDays } = req.body;
        if (!username || !reason) {
            return res.status(400).json({ message: "Username and reason are required" });
        }
        
        let expiresAt = null;
        if (!isPermanent && durationDays) {
            expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        }
        
        db.addBan(username, req.session.user.username, reason, isPermanent, expiresAt, (err, ban) => {
            if (err) return res.status(500).json({ message: "Failed to create ban" });
            
            const isTermination = reason && reason.toLowerCase().includes('[termination]');
            let notificationMessage;
            if (isTermination) {
                notificationMessage = `Your account has been permanently terminated by ${req.session.user.username}. Reason: ${reason.replace('[TERMINATION]', '').replace('[termination]', '').trim()}`;
            } else if (isPermanent) {
                notificationMessage = `You have been permanently banned by ${req.session.user.username}. Reason: ${reason}`;
            } else {
                notificationMessage = `You have been banned by ${req.session.user.username} for ${durationDays} days. Reason: ${reason}`;
            }
            db.addNotification(username, 'ban', notificationMessage, (notifErr) => {
                if (notifErr) console.error('Failed to create notification:', notifErr);
            });
            
            const durationText = isPermanent ? 'Permanent' : `${durationDays} days`;
            discordWebhook.logBan(username, req.session.user.username, reason, durationText);
            
            res.status(201).json({ message: "Ban created successfully", ban });
        });
    });

    app.delete('/api/moderation/bans/:id', isAdmin, (req, res) => {
        const { id } = req.params;
        db.removeBan(id, (err) => {
            if (err) return res.status(500).json({ message: "Failed to remove ban" });
            res.status(200).json({ message: "Ban removed successfully" });
        });
    });

    app.get('/api/notifications', (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const unreadOnly = req.query.unread === 'true';
        db.getNotifications(req.session.user.username, unreadOnly, (err, notifications) => {
            if (err) return res.status(500).json({ message: "Failed to get notifications" });
            res.status(200).json({ notifications });
        });
    });

    app.put('/api/notifications/:id/read', (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { id } = req.params;
        
        db.pool.query('SELECT username FROM user_notifications WHERE id = $1', [id], (err, result) => {
            if (err) return res.status(500).json({ message: "Failed to check notification ownership" });
            if (!result.rows[0]) return res.status(404).json({ message: "Notification not found" });
            if (result.rows[0].username !== req.session.user.username) {
                return res.status(403).json({ message: "You can only mark your own notifications as read" });
            }
            
            db.markNotificationRead(id, (err) => {
                if (err) return res.status(500).json({ message: "Failed to mark notification as read" });
                res.status(200).json({ message: "Notification marked as read" });
            });
        });
    });

    app.get('/api/moderation/check-status', (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const username = req.session.user.username;
        
        db.getActiveMute(username, (muteErr, mute) => {
            if (muteErr) return res.status(500).json({ message: "Failed to check mute status" });
            
            db.getActiveBan(username, (banErr, ban) => {
                if (banErr) return res.status(500).json({ message: "Failed to check ban status" });
                
                res.status(200).json({
                    isMuted: !!mute,
                    isBanned: !!ban,
                    mute: mute || null,
                    ban: ban || null
                });
            });
        });
    });
};
