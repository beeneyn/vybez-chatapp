# Version 1.2 Server Management API

## Overview
The Server Management API provides complete CRUD operations for Discord-style servers. Users can create, join, leave, and manage servers with granular permission controls.

## Authorization
All endpoints require user authentication via session. Specific operations require:
- **Server Owner**: Full control (edit, delete, transfer)
- **manage_server Permission**: Can edit settings (but not delete)
- **Public Servers**: Anyone can join
- **Private Servers**: Invitation required (future feature)

## API Endpoints

### List User's Servers
```
GET /api/servers
```
Get all servers the authenticated user owns or has joined.

**Response:**
```json
{
  "servers": [
    {
      "id": 1,
      "name": "Vybez Community",
      "description": "Official Vybez community server",
      "icon": "https://example.com/icon.png",
      "is_public": true,
      "owner_username": "alice",
      "created_at": "2025-11-18T00:00:00Z",
      "member_count": 42,
      "is_owner": true
    },
    ...
  ]
}
```

---

### Get Server Details
```
GET /api/servers/:serverId
```
Get detailed information about a specific server.

**Authorization:**
- Server members can view
- Public servers visible to all
- Private servers require membership

**Response:**
```json
{
  "server": {
    "id": 1,
    "name": "Vybez Community",
    "description": "Official Vybez community server",
    "icon": "https://example.com/icon.png",
    "is_public": true,
    "owner_username": "alice",
    "created_at": "2025-11-18T00:00:00Z",
    "member_count": 42,
    "is_owner": true,
    "is_member": true
  }
}
```

---

### Create Server
```
POST /api/servers
```
Create a new server with default setup.

**Request Body:**
```json
{
  "name": "My Gaming Server",
  "description": "A server for gamers",
  "icon": "https://example.com/icon.png",
  "is_public": true
}
```

**Validation:**
- `name`: Required, 1-100 characters
- `description`: Optional, max 500 characters
- `icon`: Optional URL
- `is_public`: Optional boolean (default: true)

**Automatic Setup:**
- Creates @everyone role (read_messages, send_messages, read_history, add_reactions)
- Creates Admin role (administrator permission)
- Creates #general text channel
- Adds creator as first member with both roles

**Response:**
```json
{
  "message": "Server created successfully",
  "server": {
    "id": 2,
    "name": "My Gaming Server",
    "description": "A server for gamers",
    "icon": "https://example.com/icon.png",
    "is_public": true,
    "owner_username": "bob",
    "created_at": "2025-11-18T01:00:00Z",
    "channels": [
      {
        "id": 1,
        "name": "general",
        "type": "text",
        "position": 0
      }
    ],
    "roles": [
      {
        "id": 1,
        "name": "@everyone",
        "color": "#99AAB5",
        "position": 0
      },
      {
        "id": 2,
        "name": "Admin",
        "color": "#E94EFF",
        "position": 100
      }
    ]
  }
}
```

**Transaction Safety:**
- All operations (server, roles, channel creation) are atomic
- If any step fails, entire creation is rolled back
- No partial servers or dangling data

---

### Update Server
```
PUT /api/servers/:serverId
```
Update server name, description, icon, or visibility.

**Authorization:**
- Server owner, OR
- User with `manage_server` permission
- Only owner can change `is_public` setting

**Request Body:**
```json
{
  "name": "Updated Server Name",
  "description": "New description",
  "icon": "https://example.com/new-icon.png",
  "is_public": false
}
```

All fields are optional. Only provided fields will be updated.

**Response:**
```json
{
  "message": "Server updated successfully",
  "server": { ... }
}
```

---

### Delete Server
```
DELETE /api/servers/:serverId
```
Permanently delete a server and all associated data.

**Authorization:** Server owner only

**Cascade Deletion Order:**
1. Message reactions
2. Message edit history
3. Messages (all channels)
4. User role assignments
5. Role permissions
6. Roles
7. Channels
8. Server members
9. Server

**Response:**
```json
{
  "message": "Server deleted successfully"
}
```

**Warning:** This operation is irreversible. All server data is permanently deleted.

---

### Join Server
```
POST /api/servers/:serverId/join
```
Join a public server.

**Requirements:**
- Server must be public (`is_public: true`)
- User must not already be a member

**Automatic Actions:**
- Adds user to server_members
- Assigns @everyone role automatically

**Response:**
```json
{
  "message": "Successfully joined the server"
}
```

**Errors:**
- `403`: Server is private
- `400`: Already a member
- `404`: Server not found

---

### Leave Server
```
POST /api/servers/:serverId/leave
```
Leave a server you're a member of.

**Requirements:**
- User must be a member
- User cannot be the server owner

**Automatic Actions:**
- Removes all role assignments
- Removes server membership

**Response:**
```json
{
  "message": "Successfully left the server"
}
```

**Errors:**
- `400`: Server owners cannot leave (must transfer ownership or delete)
- `400`: Not a member of this server

---

### List Server Members
```
GET /api/servers/:serverId/members
```
Get all members of a server.

**Authorization:** Server membership required

**Response:**
```json
{
  "members": [
    {
      "username": "alice",
      "nickname": "The Queen",
      "joined_at": "2025-11-18T00:00:00Z",
      "avatar": "/uploads/avatar-alice.png",
      "is_owner": true,
      "roles": [
        {
          "id": 1,
          "name": "@everyone",
          "color": "#99AAB5"
        },
        {
          "id": 2,
          "name": "Admin",
          "color": "#E94EFF"
        }
      ]
    },
    ...
  ]
}
```

**Privacy:**
- Only returns public profile fields (username, avatar, nickname)
- Does NOT return bio, email, or other private data
- Members sorted by: owner first, then join date

---

## Error Responses

### 401 Unauthorized
```json
{
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "message": "Insufficient permissions to edit server"
}
```

### 404 Not Found
```json
{
  "message": "Server not found"
}
```

### 400 Bad Request
```json
{
  "message": "Server name is required"
}
```

---

## Data Integrity

### Transaction Safety
All multi-step operations use database transactions:
- Server creation (BEGIN...COMMIT)
- Server deletion (BEGIN...COMMIT)
- Join server (BEGIN...COMMIT)
- Leave server (BEGIN...COMMIT)

If any step fails, the entire operation rolls back.

### Cascading Deletes
Server deletion properly cascades through:
1. Message reactions → Message edits → Messages
2. User roles → Role permissions → Roles
3. Channels → Server members → Server

This prevents FK constraint violations and orphaned data.

### Automatic Role Assignment
- All new servers get @everyone and Admin roles
- All new members automatically receive @everyone role
- Owner receives both @everyone and Admin roles

---

## Best Practices

### Creating Servers
1. Choose descriptive names and descriptions
2. Set appropriate visibility (public/private)
3. Customize default roles after creation
4. Create additional channels as needed

### Managing Servers
1. Use `manage_server` permission for trusted moderators
2. Only owner can delete server
3. Transfer ownership before leaving
4. Regularly audit member list

### Joining/Leaving
1. Check server description before joining
2. Respect server rules
3. Leave gracefully if server doesn't fit
4. Owners must transfer ownership or delete

---

## Example Usage

### Create a Gaming Server
```javascript
// 1. Create server
POST /api/servers
{
  "name": "Epic Gamers",
  "description": "For the most epic gamers",
  "is_public": true
}

// Response includes default #general channel and roles

// 2. Invite friends (future: invite links)
// Friends use: POST /api/servers/1/join

// 3. Create additional channels
POST /api/servers/1/channels
{
  "name": "voice-chat",
  "type": "voice"
}
```

### Server Lifecycle
```javascript
// Create → Customize → Grow → Manage → Archive/Delete

// Archive: Set to private
PUT /api/servers/1
{ "is_public": false }

// Delete when done
DELETE /api/servers/1
// All data permanently removed
```

---

## Security Considerations

1. **Authentication Required**: All endpoints need valid session
2. **Authorization Checks**: Owner/permission verification on sensitive operations
3. **Privacy Protection**: Member list only shows public profile data
4. **Transaction Safety**: Atomic operations prevent data corruption
5. **Cascading Deletes**: Complete cleanup prevents orphaned data
6. **Input Validation**: All text fields have length limits
7. **SQL Injection Protected**: Parameterized queries throughout

---

## Future Enhancements

- Invitation links for private servers
- Server templates for quick setup
- Server banners and splash screens
- Server verification system
- Server discovery page
- Transfer ownership feature
- Server statistics and analytics
