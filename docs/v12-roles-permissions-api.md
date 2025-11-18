# Version 1.2 Roles & Permissions API

## Overview
The Roles & Permissions API provides granular access control for Discord-style servers. It allows server owners and authorized users to create roles, assign permissions, and manage member access.

## Permission Types

### Available Permissions
- `read_messages` - View messages in channels
- `send_messages` - Send messages in channels
- `manage_messages` - Delete and edit other users' messages
- `mention_everyone` - Mention @everyone and @here
- `add_reactions` - Add reactions to messages
- `read_history` - Read message history
- `attach_files` - Upload files and media
- `create_channels` - Create new channels
- `manage_channels` - Edit and delete channels
- `delete_channels` - Delete channels
- `invite_members` - Invite new members to the server
- `kick_members` - Remove members from the server
- `ban_members` - Ban members from the server
- `manage_roles` - Create, edit, and delete roles
- `manage_server` - Change server name, icon, and settings
- `administrator` - All permissions (bypass all checks)

## Authorization
All endpoints require user authentication via session. Most endpoints also require:
- Server ownership, OR
- `manage_roles` permission (for role management)
- Server membership (for viewing roles)

## API Endpoints

### Get Permission Types
```
GET /api/permission-types
```
Returns all available permission types with descriptions.

**Response:**
```json
{
  "permissions": ["read_messages", "send_messages", ...],
  "descriptions": {
    "read_messages": "View messages in channels",
    ...
  }
}
```

---

### List Server Roles
```
GET /api/servers/:serverId/roles
```
Get all roles for a server (requires server membership).

**Response:**
```json
{
  "roles": [
    {
      "id": 1,
      "name": "Admin",
      "color": "#E94EFF",
      "position": 10,
      "mentionable": true,
      "permissions": ["administrator"]
    },
    ...
  ]
}
```

---

### Create Role
```
POST /api/servers/:serverId/roles
```
Create a new role (requires `manage_roles` or ownership).

**Request Body:**
```json
{
  "name": "Moderator",
  "color": "#00E5FF",
  "permissions": ["manage_messages", "kick_members"]
}
```

**Validation:**
- `name`: Required, 1-100 characters
- `color`: Optional, hex color (default: #99AAB5)
- `permissions`: Optional array of valid permission names

**Response:**
```json
{
  "message": "Role created successfully",
  "role": {
    "id": 2,
    "name": "Moderator",
    "color": "#00E5FF",
    "position": 11,
    "permissions": ["manage_messages", "kick_members"]
  }
}
```

---

### Update Role
```
PUT /api/servers/:serverId/roles/:roleId
```
Update role name, color, permissions, or mentionable status (requires `manage_roles` or ownership).

**Request Body:**
```json
{
  "name": "Senior Moderator",
  "color": "#7C3AED",
  "permissions": ["manage_messages", "kick_members", "ban_members"],
  "mentionable": true
}
```

All fields are optional. Only provided fields will be updated.

**Response:**
```json
{
  "message": "Role updated successfully",
  "role": { ... }
}
```

---

### Delete Role
```
DELETE /api/servers/:serverId/roles/:roleId
```
Delete a role and all associated permissions/assignments (requires `manage_roles` or ownership).

**Response:**
```json
{
  "message": "Role deleted successfully"
}
```

**Note:** This cascades to remove all user role assignments.

---

### Get User Roles
```
GET /api/servers/:serverId/members/:username/roles
```
Get all roles assigned to a specific user (requires server membership).

**Response:**
```json
{
  "roles": [
    {
      "id": 1,
      "name": "Admin",
      "color": "#E94EFF",
      "position": 10
    }
  ]
}
```

---

### Assign Role to User
```
POST /api/servers/:serverId/members/:username/roles/:roleId
```
Assign a role to a user (requires `manage_roles` or ownership).

**Requirements:**
- User must be a server member
- Role must exist in the server
- User cannot already have the role

**Response:**
```json
{
  "message": "Role assigned successfully"
}
```

**Database Trigger:** Automatically enforces that only server members can receive roles.

---

### Remove Role from User
```
DELETE /api/servers/:serverId/members/:username/roles/:roleId
```
Remove a role from a user (requires `manage_roles` or ownership).

**Response:**
```json
{
  "message": "Role removed successfully"
}
```

---

### Get User Permissions
```
GET /api/servers/:serverId/permissions/:username
```
Get all permissions for a user (aggregated from all roles).

**Response:**
```json
{
  "permissions": ["read_messages", "send_messages", "manage_messages"]
}
```

**Special Cases:**
- Server owners receive all permissions automatically
- Users with `administrator` permission receive all permissions

---

## Helper Functions (Backend Only)

### checkServerPermission(username, serverId, permission)
Checks if a user has a specific permission on a server.

**Returns:** `true` if user has permission or administrator role, `false` otherwise.

### checkServerOwnership(username, serverId)
Checks if a user owns a server.

**Returns:** `true` if user is server owner, `false` otherwise.

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
  "message": "Insufficient permissions to create roles"
}
```

### 404 Not Found
```json
{
  "message": "Role not found"
}
```

### 400 Bad Request
```json
{
  "message": "Role name is required"
}
```

---

## Data Integrity

### Database Trigger
A PostgreSQL trigger (`check_user_role_membership`) ensures users can only be assigned roles if they are members of the role's server. This prevents:
- Orphaned role assignments
- Cross-server role pollution
- Invalid permission escalation

### Cascading Deletes
When a role is deleted:
1. All `user_roles` entries are removed
2. All `role_permissions` entries are removed
3. The role itself is deleted

---

## Best Practices

1. **Default Roles**: Create a default "@everyone" role for all server members
2. **Role Hierarchy**: Use `position` to establish role precedence
3. **Permission Groups**: Group related permissions (e.g., moderation bundle)
4. **Administrator Role**: Reserve for trusted users only
5. **Audit Logs**: Track role changes for security

---

## Example Usage

### Creating a Moderator System
```javascript
// 1. Create Moderator role
POST /api/servers/1/roles
{
  "name": "Moderator",
  "color": "#00E5FF",
  "permissions": ["manage_messages", "kick_members", "mute_members"]
}

// 2. Assign to user
POST /api/servers/1/members/alice/roles/2

// 3. Verify permissions
GET /api/servers/1/permissions/alice
// Returns: { permissions: ["manage_messages", "kick_members", "mute_members"] }
```

---

## Security Considerations

1. All endpoints require authentication
2. Permission checks use database-level constraints
3. Server ownership bypasses permission checks
4. Input validation on all text fields
5. SQL injection protected via parameterized queries
6. Trigger-enforced membership validation
