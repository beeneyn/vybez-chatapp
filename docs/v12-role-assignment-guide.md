# Role Assignment & Permission Management Guide

## Overview
Vybez uses a granular permission system where roles define what members can do within a server. This guide covers role creation, assignment, and best practices.

## Permission System

### 16 Granular Permissions
All permissions are explicit and granular. There are **no shorthand permissions**.

| Permission | Description |
|------------|-------------|
| `read_messages` | View messages in channels |
| `send_messages` | Send messages in channels |
| `manage_messages` | Delete and pin messages |
| `read_history` | View message history |
| `create_channels` | Create new channels |
| `manage_channels` | Edit channel settings, topics, positions |
| `delete_channels` | Delete channels |
| `manage_server` | Edit server settings |
| `manage_roles` | Create, edit, and delete roles |
| `kick_members` | Remove members from server |
| `ban_members` | Ban members from server |
| `invite_members` | Create server invites |
| `mention_everyone` | Use @everyone and @here mentions |
| `add_reactions` | React to messages |
| `attach_files` | Upload files |
| `administrator` | Bypass all permission checks (grants all permissions) |

### Permission Inheritance
- **administrator** permission grants ALL other permissions automatically
- Permissions are additive (multiple roles stack permissions)
- No permission conflicts (user has permission if ANY role grants it)

## Default Roles

### @everyone
Created automatically for all servers. Every member gets this role.

**Default Permissions:**
- `read_messages`
- `send_messages`
- `read_history`
- `add_reactions`

### Admin
Created automatically when server is created. Assigned to server owner.

**Default Permissions:**
- `administrator`
- `create_channels`
- `manage_channels`
- `delete_channels`
- `manage_server`
- `manage_roles`

## Creating Roles

### API Endpoint
```http
POST /api/servers/:serverId/roles
Content-Type: application/json

{
  "name": "Moderator",
  "color": "#00E5FF",
  "permissions": ["manage_messages", "kick_members", "ban_members"],
  "mentionable": true
}
```

### Common Role Templates

#### Moderator Role
```json
{
  "name": "Moderator",
  "color": "#00E5FF",
  "permissions": [
    "read_messages",
    "send_messages",
    "read_history",
    "manage_messages",
    "kick_members",
    "ban_members",
    "add_reactions",
    "attach_files"
  ],
  "mentionable": true
}
```

#### Channel Manager Role
```json
{
  "name": "Channel Manager",
  "color": "#7C3AED",
  "permissions": [
    "read_messages",
    "send_messages",
    "create_channels",
    "manage_channels",
    "delete_channels",
    "add_reactions",
    "attach_files"
  ],
  "mentionable": false
}
```

#### Content Creator Role
```json
{
  "name": "Content Creator",
  "color": "#E94EFF",
  "permissions": [
    "read_messages",
    "send_messages",
    "read_history",
    "attach_files",
    "mention_everyone",
    "add_reactions"
  ],
  "mentionable": true
}
```

## Assigning Roles

### Assign Role to Member
```http
POST /api/servers/:serverId/roles/:roleId/assign
Content-Type: application/json

{
  "username": "alice"
}
```

**Requirements:**
- User must be server member
- Requester must have `manage_roles` permission or be server owner
- Cannot assign roles to non-members (enforced by database trigger)

### Remove Role from Member
```http
DELETE /api/servers/:serverId/roles/:roleId/members/:username
```

**Requirements:**
- User must be server member
- Requester must have `manage_roles` permission or be server owner
- Cannot remove @everyone role

## Checking Permissions

### Server-Level Permission Check
The `checkServerPermission(username, serverId, permissionName)` helper checks:

1. Does user have `administrator` permission? → Grant access
2. Does user have the specific permission? → Grant access
3. Otherwise → Deny access

### Usage Example
```javascript
const canManageChannels = await checkServerPermission(username, serverId, 'manage_channels');
if (canManageChannels) {
  // Allow channel editing
}
```

## Best Practices

### 1. Use Specific Permissions
✅ **Good:** Grant `manage_channels` to channel managers
❌ **Bad:** Grant `administrator` to everyone who needs any permission

### 2. Layer Permissions
Create multiple roles for different responsibilities:
- **Admin** - Full server control
- **Moderator** - Content moderation
- **Channel Manager** - Channel organization
- **Member** - Basic participation (@everyone)

### 3. Color Coding
Use distinct colors to visually identify role hierarchy:
- Admin: `#E94EFF` (Electric Magenta)
- Moderator: `#00E5FF` (Cyber Cyan)
- Trusted Member: `#7C3AED` (Deep Violet)
- Member: `#99AAB5` (Gray)

### 4. Position Matters
Higher position roles appear above lower positions in member lists. Use position to show hierarchy:
- Admin: 100
- Moderator: 50
- Trusted Member: 25
- @everyone: 0

### 5. Mentionable Flag
Only make roles mentionable if they need to be pinged:
- ✅ Support Team, Moderators, Admins
- ❌ Decorative roles, Member roles

## Common Scenarios

### Scenario: Create a Moderator Team
1. Create "Moderator" role with moderation permissions
2. Assign role to trusted members
3. Set mentionable=true so members can ping moderators

### Scenario: Channel Organization Team
1. Create "Channel Manager" role with channel permissions
2. Grant `create_channels`, `manage_channels`, `delete_channels`
3. Assign to members who organize server structure

### Scenario: Content Creators
1. Create "Creator" role
2. Grant `mention_everyone` and `attach_files`
3. Assign to members who make announcements

## Security Considerations

### Database Trigger Protection
A database trigger prevents assigning roles to non-members:
```sql
CREATE OR REPLACE FUNCTION check_user_role_membership()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM server_members sm
        INNER JOIN roles r ON r.id = NEW.role_id
        WHERE sm.username = NEW.username
        AND sm.server_id = r.server_id
    ) THEN
        RAISE EXCEPTION 'User must be a server member to be assigned a role';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Permission Validation
All role creation/update endpoints validate permissions against `PERMISSION_TYPES`:
```javascript
const invalidPermissions = permissions.filter(p => !PERMISSION_TYPES.includes(p));
if (invalidPermissions.length > 0) {
  return res.status(400).json({ 
    message: 'Invalid permissions', 
    invalid: invalidPermissions 
  });
}
```

## API Reference Summary

| Endpoint | Method | Description | Permission Required |
|----------|--------|-------------|---------------------|
| `/api/servers/:serverId/roles` | GET | List all server roles | Server member |
| `/api/servers/:serverId/roles` | POST | Create new role | `manage_roles` or owner |
| `/api/servers/:serverId/roles/:roleId` | PUT | Update role | `manage_roles` or owner |
| `/api/servers/:serverId/roles/:roleId` | DELETE | Delete role | `manage_roles` or owner |
| `/api/servers/:serverId/roles/:roleId/assign` | POST | Assign role to member | `manage_roles` or owner |
| `/api/servers/:serverId/roles/:roleId/members/:username` | DELETE | Remove role from member | `manage_roles` or owner |
| `/api/servers/:serverId/members/:username/permissions` | GET | Get member's effective permissions | Server member |

For complete API documentation, see [v12-roles-permissions-api.md](./v12-roles-permissions-api.md).

## Migration Notes

### From V1.0 to V1.2
V1.0 had flat chat rooms with basic admin/user roles. V1.2 introduces:
- Server-based organization
- Granular permissions (16 types)
- Multi-role system
- Position-based hierarchy

When migrating, existing rooms become channels in a default server, and admin users get the Admin role.
