const https = require('https');
const { URL } = require('url');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

function sendDiscordWebhook(title, description, color = 0x5b2bff, fields = []) {
    if (!DISCORD_WEBHOOK_URL) {
        console.log('Discord webhook URL not configured, skipping notification');
        return;
    }

    const embed = {
        title: title,
        description: description,
        color: color,
        timestamp: new Date().toISOString(),
        footer: {
            text: 'Vybez Chat Platform'
        }
    };

    if (fields.length > 0) {
        embed.fields = fields;
    }

    const payload = JSON.stringify({
        embeds: [embed]
    });

    const url = new URL(DISCORD_WEBHOOK_URL);
    
    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, (res) => {
        if (res.statusCode !== 204) {
            console.error(`Discord webhook failed with status: ${res.statusCode}`);
        }
    });

    req.on('error', (error) => {
        console.error('Error sending Discord webhook:', error);
    });

    req.write(payload);
    req.end();
}

function logUserRegistration(username) {
    sendDiscordWebhook(
        '📝 New User Registration',
        `A new user has joined Vybez!`,
        0x5b2bff,
        [{ name: 'Username', value: username, inline: true }]
    );
}

function logUserLogin(username, clientType = 'web') {
    const clientEmojis = {
        'web': '🌐',
        'desktop': '💻',
        'api': '🤖',
        'discord': '🤖'
    };
    
    const emoji = clientEmojis[clientType.toLowerCase()] || '❓';
    const clientDisplay = clientType.charAt(0).toUpperCase() + clientType.slice(1);
    
    sendDiscordWebhook(
        '🔐 User Login',
        `A user has logged in via ${clientDisplay}`,
        0x1ed5ff,
        [
            { name: 'Username', value: username, inline: true },
            { name: 'Client', value: `${emoji} ${clientDisplay}`, inline: true }
        ]
    );
}

function logRoomCreated(roomName, createdBy) {
    sendDiscordWebhook(
        '🏠 Room Created',
        `A new custom room has been created`,
        0xff3f8f,
        [
            { name: 'Room Name', value: roomName, inline: true },
            { name: 'Created By', value: createdBy, inline: true }
        ]
    );
}

function logRoomDeleted(roomName, deletedBy) {
    sendDiscordWebhook(
        '🗑️ Room Deleted',
        `A custom room has been deleted`,
        0xf6b73c,
        [
            { name: 'Room Name', value: roomName, inline: true },
            { name: 'Deleted By', value: deletedBy, inline: true }
        ]
    );
}

function logFileUpload(username, fileName, fileType) {
    sendDiscordWebhook(
        '📎 File Uploaded',
        `A file has been uploaded to the platform`,
        0x5b2bff,
        [
            { name: 'Uploaded By', value: username, inline: true },
            { name: 'File Name', value: fileName, inline: true },
            { name: 'File Type', value: fileType, inline: true }
        ]
    );
}

function logChatMessage(username, room, messageText, hasFile = false, clientType = 'web') {
    const clientEmojis = {
        'web': '🌐',
        'desktop': '💻',
        'api': '🤖',
        'discord': '🤖'
    };
    
    const emoji = clientEmojis[clientType.toLowerCase()] || '❓';
    const clientDisplay = clientType.charAt(0).toUpperCase() + clientType.slice(1);
    const description = hasFile 
        ? `Message with file sent in chat room via ${clientDisplay}`
        : `Message sent in chat room via ${clientDisplay}`;
    
    sendDiscordWebhook(
        '💬 Chat Message',
        description,
        0x5b2bff,
        [
            { name: 'User', value: username, inline: true },
            { name: 'Room', value: room, inline: true },
            { name: 'Client', value: `${emoji} ${clientDisplay}`, inline: true },
            { name: 'Message', value: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''), inline: false }
        ]
    );
}

function logPrivateMessage(fromUser, toUser, messageText, clientType = 'web') {
    const clientEmojis = {
        'web': '🌐',
        'desktop': '💻',
        'api': '🤖',
        'discord': '🤖'
    };
    
    const emoji = clientEmojis[clientType.toLowerCase()] || '❓';
    const clientDisplay = clientType.charAt(0).toUpperCase() + clientType.slice(1);
    
    sendDiscordWebhook(
        '📧 Private Message',
        `Direct message sent between users via ${clientDisplay}`,
        0x1ed5ff,
        [
            { name: 'From', value: fromUser, inline: true },
            { name: 'To', value: toUser, inline: true },
            { name: 'Client', value: `${emoji} ${clientDisplay}`, inline: true },
            { name: 'Message', value: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''), inline: false }
        ]
    );
}

function logProfileUpdate(username, updatedFields) {
    const fieldsList = updatedFields.join(', ');
    sendDiscordWebhook(
        '👤 Profile Updated',
        `A user has updated their profile`,
        0xff3f8f,
        [
            { name: 'Username', value: username, inline: true },
            { name: 'Updated Fields', value: fieldsList, inline: true }
        ]
    );
}

function logAvatarUpload(username) {
    sendDiscordWebhook(
        '🖼️ Avatar Uploaded',
        `A user has uploaded a new profile avatar`,
        0x5b2bff,
        [{ name: 'Username', value: username, inline: true }]
    );
}

function logUsernameChange(oldUsername, newUsername) {
    sendDiscordWebhook(
        '🔄 Username Changed',
        `A user has changed their username`,
        0xf6b73c,
        [
            { name: 'Old Username', value: oldUsername, inline: true },
            { name: 'New Username', value: newUsername, inline: true }
        ]
    );
}

function logAccountDeletion(username) {
    sendDiscordWebhook(
        '🗑️ Account Deleted',
        `A user has permanently deleted their account`,
        0xff0000,
        [{ name: 'Username', value: username, inline: true }]
    );
}

function logMention(mentionedBy, mentionedUser, room, messagePreview) {
    sendDiscordWebhook(
        '📢 User Mentioned',
        `A user was mentioned in a chat message`,
        0x1ed5ff,
        [
            { name: 'Mentioned By', value: mentionedBy, inline: true },
            { name: 'Mentioned User', value: `@${mentionedUser}`, inline: true },
            { name: 'Room', value: room, inline: true },
            { name: 'Message Preview', value: messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : ''), inline: false }
        ]
    );
}

function logReaction(username, emoji, room) {
    sendDiscordWebhook(
        '😊 Reaction Added',
        `A user reacted to a message`,
        0xff3f8f,
        [
            { name: 'User', value: username, inline: true },
            { name: 'Emoji', value: emoji, inline: true },
            { name: 'Room', value: room, inline: true }
        ]
    );
}

function logWarning(username, warnedBy, reason) {
    sendDiscordWebhook(
        '⚠️ Warning Issued',
        `A warning has been issued to a user`,
        0xf6b73c,
        [
            { name: 'User', value: username, inline: true },
            { name: 'Warned By', value: warnedBy, inline: true },
            { name: 'Reason', value: reason, inline: false }
        ]
    );
}

function logMute(username, mutedBy, reason, duration) {
    sendDiscordWebhook(
        '🔇 User Muted',
        `A user has been muted`,
        0xff3f8f,
        [
            { name: 'User', value: username, inline: true },
            { name: 'Muted By', value: mutedBy, inline: true },
            { name: 'Duration', value: duration, inline: true },
            { name: 'Reason', value: reason, inline: false }
        ]
    );
}

function logBan(username, bannedBy, reason, duration) {
    sendDiscordWebhook(
        '🔨 User Banned',
        `A user has been banned from the platform`,
        0xff0000,
        [
            { name: 'User', value: username, inline: true },
            { name: 'Banned By', value: bannedBy, inline: true },
            { name: 'Duration', value: duration, inline: true },
            { name: 'Reason', value: reason, inline: false }
        ]
    );
}

function logStatusChange(username, newStatus) {
    sendDiscordWebhook(
        '🟢 Status Changed',
        `A user has updated their status`,
        0x1ed5ff,
        [
            { name: 'Username', value: username, inline: true },
            { name: 'New Status', value: newStatus, inline: true }
        ]
    );
}

function logError(errorTitle, errorMessage) {
    sendDiscordWebhook(
        `❌ ${errorTitle}`,
        errorMessage,
        0xff0000
    );
}

function logUserBlocked(blockerUsername, blockedUsername) {
    sendDiscordWebhook(
        '🚫 User Blocked',
        `A user has blocked another user`,
        0xff3f8f,
        [
            { name: 'Blocked By', value: blockerUsername, inline: true },
            { name: 'Blocked User', value: blockedUsername, inline: true }
        ]
    );
}

function logUserUnblocked(blockerUsername, unblockedUsername) {
    sendDiscordWebhook(
        '✅ User Unblocked',
        `A user has unblocked another user`,
        0x1ed5ff,
        [
            { name: 'Unblocked By', value: blockerUsername, inline: true },
            { name: 'Unblocked User', value: unblockedUsername, inline: true }
        ]
    );
}

module.exports = {
    sendDiscordWebhook,
    logUserRegistration,
    logUserLogin,
    logRoomCreated,
    logRoomDeleted,
    logFileUpload,
    logChatMessage,
    logPrivateMessage,
    logProfileUpdate,
    logAvatarUpload,
    logUsernameChange,
    logAccountDeletion,
    logMention,
    logReaction,
    logWarning,
    logMute,
    logBan,
    logUserBlocked,
    logUserUnblocked,
    logStatusChange,
    logError
};
