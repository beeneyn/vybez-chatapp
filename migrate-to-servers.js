const db = require('./database');
const { pool } = db;

/**
 * Migration Script: Convert Flat Rooms to Server/Channel Architecture
 * 
 * This script migrates Vybez from the old flat room structure to the new
 * Discord-style server/channel architecture introduced in Version 1.2.
 * 
 * What it does:
 * 1. Creates a default "Vybez Community" server
 * 2. Converts each existing room into a channel under the default server
 * 3. Adds all registered users as members of the default server
 * 4. Creates default roles (Everyone, Moderator, Admin)
 * 5. Preserves all message history by updating room references to channel IDs
 * 
 * Server Owner Selection:
 * The script intelligently selects a server owner using this fallback hierarchy:
 * 1. First admin user (role='admin') if one exists
 * 2. First registered user by creation date if no admin
 * 3. Creator of first room if no users exist
 * 
 * Note: In a fresh install with no users, ensure an admin account exists
 * before running this migration to establish proper ownership.
 * 
 * Safety Features:
 * - Idempotent: Safe to run multiple times (skips if servers already exist)
 * - Transactional: All changes in one transaction, rolls back on any error
 * - Backward Compatible: Message room references updated seamlessly
 */

async function migrateToServers() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting migration to server/channel architecture...\n');
        
        await client.query('BEGIN');
        
        // Step 1: Check if migration has already been run
        const existingServers = await client.query('SELECT COUNT(*) as count FROM servers');
        if (parseInt(existingServers.rows[0].count) > 0) {
            console.log('⚠️  Migration already completed - servers exist in database.');
            console.log('   Skipping migration to prevent duplicates.\n');
            await client.query('ROLLBACK');
            return;
        }
        
        // Step 2: Get all existing rooms
        const roomsResult = await client.query(`
            SELECT id, name, created_by, created_at, is_default 
            FROM rooms 
            ORDER BY is_default DESC, created_at ASC
        `);
        
        if (roomsResult.rows.length === 0) {
            console.log('ℹ️  No existing rooms found. Creating fresh server structure...\n');
        } else {
            console.log(`📋 Found ${roomsResult.rows.length} existing rooms to migrate:\n`);
            roomsResult.rows.forEach(room => {
                console.log(`   • ${room.name} ${room.is_default ? '(default)' : ''}`);
            });
            console.log('');
        }
        
        // Step 3: Determine the server owner (admin user or first user, or fallback to room creator)
        let serverOwner = 'admin';
        const adminCheck = await client.query('SELECT username FROM users WHERE role = $1 LIMIT 1', ['admin']);
        if (adminCheck.rows.length > 0) {
            serverOwner = adminCheck.rows[0].username;
        } else {
            const firstUser = await client.query('SELECT username FROM users ORDER BY created_at ASC LIMIT 1');
            if (firstUser.rows.length > 0) {
                serverOwner = firstUser.rows[0].username;
            } else if (roomsResult.rows.length > 0) {
                serverOwner = roomsResult.rows[0].created_by;
            }
        }
        
        // Step 4: Create the default server
        console.log(`🏗️  Creating default "Vybez Community" server (owner: ${serverOwner})...`);
        const serverResult = await client.query(`
            INSERT INTO servers (name, description, owner_username, is_public, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, name
        `, [
            'Vybez Community',
            'Welcome to Vybez! Connect, chat, and break free.',
            serverOwner,
            true
        ]);
        
        const serverId = serverResult.rows[0].id;
        console.log(`✅ Server created: "${serverResult.rows[0].name}" (ID: ${serverId})\n`);
        
        // Step 5: Create default roles
        console.log('🎭 Creating default roles...');
        
        const everyoneRole = await client.query(`
            INSERT INTO roles (server_id, name, color, position, mentionable, is_default)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name
        `, [serverId, 'Everyone', '#99AAB5', 0, false, true]);
        console.log(`   ✓ Created role: ${everyoneRole.rows[0].name}`);
        
        const modRole = await client.query(`
            INSERT INTO roles (server_id, name, color, position, mentionable, is_default)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name
        `, [serverId, 'Moderator', '#F39C12', 1, true, false]);
        console.log(`   ✓ Created role: ${modRole.rows[0].name}`);
        
        const adminRole = await client.query(`
            INSERT INTO roles (server_id, name, color, position, mentionable, is_default)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name
        `, [serverId, 'Admin', '#FF10F0', 2, true, false]);
        console.log(`   ✓ Created role: ${adminRole.rows[0].name}\n`);
        
        // Step 5: Set up role permissions
        console.log('🔐 Setting up role permissions...');
        
        const everyonePerms = [
            'read_messages', 'send_messages', 'add_reactions', 
            'use_emojis', 'read_message_history'
        ];
        
        const modPerms = [
            ...everyonePerms,
            'delete_messages', 'manage_messages', 'mute_members', 
            'kick_members', 'view_audit_log'
        ];
        
        const adminPerms = [
            ...modPerms,
            'manage_channels', 'manage_roles', 'manage_server',
            'ban_members', 'administrator'
        ];
        
        for (const perm of everyonePerms) {
            await client.query(`
                INSERT INTO role_permissions (role_id, permission)
                VALUES ($1, $2)
            `, [everyoneRole.rows[0].id, perm]);
        }
        console.log(`   ✓ Everyone role: ${everyonePerms.length} permissions`);
        
        for (const perm of modPerms) {
            await client.query(`
                INSERT INTO role_permissions (role_id, permission)
                VALUES ($1, $2)
            `, [modRole.rows[0].id, perm]);
        }
        console.log(`   ✓ Moderator role: ${modPerms.length} permissions`);
        
        for (const perm of adminPerms) {
            await client.query(`
                INSERT INTO role_permissions (role_id, permission)
                VALUES ($1, $2)
            `, [adminRole.rows[0].id, perm]);
        }
        console.log(`   ✓ Admin role: ${adminPerms.length} permissions\n`);
        
        // Step 7: Convert rooms to channels
        const channelMapping = new Map(); // Old room ID -> new channel ID
        
        if (roomsResult.rows.length === 0) {
            // Create default channels if no rooms exist
            console.log('📺 Creating default channels...');
            
            const defaultChannels = [
                { name: 'general', category: 'TEXT CHANNELS', position: 0, description: 'General discussion' },
                { name: 'random', category: 'TEXT CHANNELS', position: 1, description: 'Off-topic conversations' },
                { name: 'announcements', category: 'TEXT CHANNELS', position: 2, description: 'Server announcements' }
            ];
            
            for (const ch of defaultChannels) {
                const result = await client.query(`
                    INSERT INTO channels (server_id, name, type, category, position, description, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    RETURNING id, name
                `, [serverId, ch.name, 'text', ch.category, ch.position, ch.description]);
                
                console.log(`   ✓ Created #${result.rows[0].name}`);
            }
        } else {
            // Convert existing rooms to channels
            console.log('🔄 Converting rooms to channels...');
            
            for (let i = 0; i < roomsResult.rows.length; i++) {
                const room = roomsResult.rows[i];
                const channelName = room.name.replace('#', '').toLowerCase();
                
                const channelResult = await client.query(`
                    INSERT INTO channels (server_id, name, type, category, position, description, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id, name
                `, [
                    serverId,
                    channelName,
                    'text',
                    'TEXT CHANNELS',
                    i,
                    room.is_default ? 'Default channel' : `Migrated from room: ${room.name}`,
                    room.created_at
                ]);
                
                const channelId = channelResult.rows[0].id;
                channelMapping.set(room.id, channelId);
                
                console.log(`   ✓ ${room.name} → #${channelResult.rows[0].name} (Channel ID: ${channelId})`);
            }
        }
        
        console.log('');
        
        // Step 8: Update message room references to channel IDs
        if (channelMapping.size > 0) {
            console.log('💬 Updating message references...');
            
            for (const [roomId, channelId] of channelMapping.entries()) {
                const updateResult = await client.query(`
                    UPDATE messages 
                    SET room = $1 
                    WHERE room = (SELECT name FROM rooms WHERE id = $2)
                `, [channelId.toString(), roomId]);
                
                if (updateResult.rowCount > 0) {
                    console.log(`   ✓ Updated ${updateResult.rowCount} messages`);
                }
            }
            console.log('');
        }
        
        // Step 9: Add all users as server members
        console.log('👥 Adding users as server members...');
        
        const usersResult = await client.query('SELECT username FROM users ORDER BY username');
        
        if (usersResult.rows.length === 0) {
            console.log('   ℹ️  No users found to add\n');
        } else {
            for (const user of usersResult.rows) {
                await client.query(`
                    INSERT INTO server_members (server_id, username, joined_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (server_id, username) DO NOTHING
                `, [serverId, user.username]);
            }
            
            console.log(`   ✓ Added ${usersResult.rows.length} users to server\n`);
            
            // Assign admin role to users with admin role in users table
            console.log('🛡️  Assigning admin roles...');
            const adminUsers = await client.query(`
                SELECT username FROM users WHERE role = 'admin'
            `);
            
            for (const user of adminUsers.rows) {
                await client.query(`
                    INSERT INTO user_roles (server_id, username, role_id)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (server_id, username, role_id) DO NOTHING
                `, [serverId, user.username, adminRole.rows[0].id]);
            }
            
            console.log(`   ✓ Assigned admin role to ${adminUsers.rows.length} user(s)\n`);
        }
        
        // Step 10: Commit transaction
        await client.query('COMMIT');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✨ Migration completed successfully!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`\n📊 Summary:`);
        console.log(`   • Created 1 server: "Vybez Community"`);
        console.log(`   • Created ${channelMapping.size || 3} channels`);
        console.log(`   • Created 3 roles with permissions`);
        console.log(`   • Added ${usersResult.rows.length || 0} server members`);
        console.log(`   • Preserved all message history\n`);
        console.log('🎉 Your Vybez instance is now running on the Version 1.2 architecture!\n');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Migration failed:', error.message);
        console.error('\n   Stack trace:', error.stack);
        console.error('\n   Transaction rolled back. Database unchanged.\n');
        throw error;
    } finally {
        client.release();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateToServers()
        .then(() => {
            console.log('Migration script finished.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateToServers };
