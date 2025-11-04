const db = require('./database.js');

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
};
