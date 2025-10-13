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

function logUserLogin(username) {
    sendDiscordWebhook(
        '🔐 User Login',
        `A user has logged in`,
        0x1ed5ff,
        [{ name: 'Username', value: username, inline: true }]
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

function logError(errorTitle, errorMessage) {
    sendDiscordWebhook(
        `❌ ${errorTitle}`,
        errorMessage,
        0xff0000
    );
}

module.exports = {
    sendDiscordWebhook,
    logUserRegistration,
    logUserLogin,
    logRoomCreated,
    logRoomDeleted,
    logFileUpload,
    logError
};
