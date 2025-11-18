const express = require('express');
const router = express.Router();
const pool = require('./database');

const requireAuth = (req, res, next) => {
    if (!req.session?.user?.username) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    next();
};

router.put('/messages/:messageId', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const username = req.session.user.username;

        if (!content || typeof content !== 'string') {
            return res.status(400).json({ message: 'Content is required' });
        }

        const trimmedContent = content.trim();
        if (!trimmedContent || trimmedContent.length === 0) {
            return res.status(400).json({ message: 'Content cannot be empty' });
        }

        if (trimmedContent.length > 2000) {
            return res.status(400).json({ message: 'Content cannot exceed 2000 characters' });
        }

        const userExists = await client.query(
            'SELECT username FROM users WHERE username = $1',
            [username]
        );

        if (!userExists.rows.length) {
            return res.status(403).json({ message: 'User account not found' });
        }

        const messageQuery = await client.query(
            'SELECT id, username, content, room FROM messages WHERE id = $1',
            [messageId]
        );

        if (!messageQuery.rows.length) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const message = messageQuery.rows[0];

        if (message.username !== username) {
            const isAdmin = await client.query(
                'SELECT role FROM users WHERE username = $1 AND role = $2',
                [username, 'admin']
            );

            if (!isAdmin.rows.length) {
                return res.status(403).json({ message: 'You can only edit your own messages' });
            }
        }

        if (message.content === trimmedContent) {
            return res.status(400).json({ message: 'New content is the same as current content' });
        }

        await client.query('BEGIN');

        await client.query(
            `INSERT INTO message_edits (message_id, original_content, edited_content, edited_by, edited_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [messageId, message.content, trimmedContent, username]
        );

        const updateResult = await client.query(
            `UPDATE messages 
             SET content = $1, edited = true, edited_at = NOW()
             WHERE id = $2
             RETURNING id, username, content, room, timestamp, edited, edited_at`,
            [trimmedContent, messageId]
        );

        await client.query('COMMIT');

        res.json({
            message: 'Message edited successfully',
            data: updateResult.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error editing message:', err);
        res.status(500).json({ message: 'Failed to edit message' });
    } finally {
        client.release();
    }
});

router.get('/messages/:messageId/history', requireAuth, async (req, res) => {
    try {
        const { messageId } = req.params;
        const username = req.session.user.username;

        const userExists = await pool.query(
            'SELECT username FROM users WHERE username = $1',
            [username]
        );

        if (!userExists.rows.length) {
            return res.status(403).json({ message: 'User account not found' });
        }

        const messageQuery = await pool.query(
            'SELECT id, username, content FROM messages WHERE id = $1',
            [messageId]
        );

        if (!messageQuery.rows.length) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const historyQuery = await pool.query(
            `SELECT id, original_content, edited_content, edited_by, edited_at
             FROM message_edits
             WHERE message_id = $1
             ORDER BY edited_at ASC`,
            [messageId]
        );

        res.json({
            message: messageQuery.rows[0],
            history: historyQuery.rows
        });
    } catch (err) {
        console.error('Error fetching message history:', err);
        res.status(500).json({ message: 'Failed to fetch message history' });
    }
});

router.delete('/messages/:messageId', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { messageId } = req.params;
        const username = req.session.user.username;

        const userExists = await client.query(
            'SELECT username FROM users WHERE username = $1',
            [username]
        );

        if (!userExists.rows.length) {
            return res.status(403).json({ message: 'User account not found' });
        }

        const messageQuery = await client.query(
            'SELECT id, username, room FROM messages WHERE id = $1',
            [messageId]
        );

        if (!messageQuery.rows.length) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const message = messageQuery.rows[0];

        if (message.username !== username) {
            const isAdmin = await client.query(
                'SELECT role FROM users WHERE username = $1 AND role = $2',
                [username, 'admin']
            );

            if (!isAdmin.rows.length) {
                return res.status(403).json({ message: 'You can only delete your own messages' });
            }
        }

        await client.query('BEGIN');

        await client.query('DELETE FROM reactions WHERE message_id = $1', [messageId]);
        await client.query('DELETE FROM message_edits WHERE message_id = $1', [messageId]);
        await client.query('DELETE FROM messages WHERE id = $1', [messageId]);

        await client.query('COMMIT');

        res.json({ 
            message: 'Message deleted successfully',
            messageId: messageId,
            room: message.room
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting message:', err);
        res.status(500).json({ message: 'Failed to delete message' });
    } finally {
        client.release();
    }
});

module.exports = router;
