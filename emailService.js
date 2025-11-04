const sgMail = require('@sendgrid/mail');

async function getCredentials() {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
        ? 'repl ' + process.env.REPL_IDENTITY 
        : process.env.WEB_REPL_RENEWAL 
        ? 'depl ' + process.env.WEB_REPL_RENEWAL 
        : null;

    if (!xReplitToken) {
        throw new Error('X_REPLIT_TOKEN not found for repl/depl');
    }

    const connectionSettings = await fetch(
        'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
        {
            headers: {
                'Accept': 'application/json',
                'X_REPLIT_TOKEN': xReplitToken
            }
        }
    ).then(res => res.json()).then(data => data.items?.[0]);

    if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
        throw new Error('SendGrid not connected');
    }
    return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
}

async function getUncachableSendGridClient() {
    const {apiKey, email} = await getCredentials();
    sgMail.setApiKey(apiKey);
    return {
        client: sgMail,
        fromEmail: email
    };
}

async function sendSupportTicketConfirmation(toEmail, username, ticketId, subject) {
    try {
        const { client, fromEmail } = await getUncachableSendGridClient();
        
        const msg = {
            to: toEmail,
            from: fromEmail,
            subject: `Support Ticket Received - #${ticketId}`,
            html: `
                <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a0b2e 0%, #16213e 100%);">
                    <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 30px; border: 1px solid rgba(139, 92, 246, 0.3);">
                        <h1 style="color: #a78bfa; margin-bottom: 20px; font-size: 28px;">
                            <span style="font-size: 36px;">🎧</span> Vybez Support
                        </h1>
                        
                        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.6;">
                            Hey <strong style="color: #8b5cf6;">${username}</strong>,
                        </p>
                        
                        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.6;">
                            We've received your support ticket and our team will review it shortly!
                        </p>
                        
                        <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 6px;">
                            <p style="color: #a78bfa; margin: 0; font-weight: 600;">Ticket ID: #${ticketId}</p>
                            <p style="color: #d1d5db; margin: 10px 0 0 0;">Subject: ${subject}</p>
                        </div>
                        
                        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.6;">
                            You'll receive an email notification when our team responds. In the meantime, you can check your ticket status in your Vybez account.
                        </p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
                            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
                                Thanks for using Vybez!<br>
                                <strong style="color: #ec4899;">BREAK FREE</strong> 🌟
                            </p>
                        </div>
                    </div>
                </div>
            `
        };
        
        await client.send(msg);
        return true;
    } catch (error) {
        console.error('Error sending support ticket confirmation email:', error);
        return false;
    }
}

async function sendSupportTicketResponse(toEmail, username, ticketId, subject, adminResponse, respondedBy) {
    try {
        const { client, fromEmail } = await getUncachableSendGridClient();
        
        const msg = {
            to: toEmail,
            from: fromEmail,
            subject: `Response to Your Support Ticket #${ticketId}`,
            html: `
                <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a0b2e 0%, #16213e 100%);">
                    <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 30px; border: 1px solid rgba(139, 92, 246, 0.3);">
                        <h1 style="color: #a78bfa; margin-bottom: 20px; font-size: 28px;">
                            <span style="font-size: 36px;">💬</span> Support Response
                        </h1>
                        
                        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.6;">
                            Hey <strong style="color: #8b5cf6;">${username}</strong>,
                        </p>
                        
                        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.6;">
                            Our team has responded to your support ticket!
                        </p>
                        
                        <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 6px;">
                            <p style="color: #a78bfa; margin: 0; font-weight: 600;">Ticket ID: #${ticketId}</p>
                            <p style="color: #d1d5db; margin: 10px 0 0 0;">Subject: ${subject}</p>
                        </div>
                        
                        <div style="background: rgba(6, 182, 212, 0.1); border-radius: 8px; padding: 20px; margin: 20px 0;">
                            <p style="color: #06b6d4; font-weight: 600; margin: 0 0 10px 0;">Response from ${respondedBy}:</p>
                            <p style="color: #e5e7eb; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${adminResponse}</p>
                        </div>
                        
                        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.6;">
                            If you have any additional questions, feel free to reply to this ticket or create a new one.
                        </p>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(139, 92, 246, 0.2);">
                            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
                                Thanks for using Vybez!<br>
                                <strong style="color: #ec4899;">BREAK FREE</strong> 🌟
                            </p>
                        </div>
                    </div>
                </div>
            `
        };
        
        await client.send(msg);
        return true;
    } catch (error) {
        console.error('Error sending support ticket response email:', error);
        return false;
    }
}

module.exports = {
    sendSupportTicketConfirmation,
    sendSupportTicketResponse
};
