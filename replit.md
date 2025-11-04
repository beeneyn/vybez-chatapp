# Vybez Chat App

## Overview
Vybez is a real-time chat application built with Node.js, Express, and Socket.IO. It provides a full-featured chatroom experience with user authentication, custom chat rooms, private messaging, file sharing, and a modern, responsive interface. The project serves as a learning platform for Node.js development, currently configured and running in a Replit environment. Vybez offers a robust, multi-platform chat solution, including a full-featured Electron desktop client. The desktop app is live at https://www.vybez.page with Microsoft Store certification in progress (Store ID: 9NN89Z3HS891, Identity: VIBECO.Vybez).

## User Preferences
I prefer detailed explanations and an iterative development approach. Ask before making major changes. Do not make changes to files within the `sessions/` directory.

## System Architecture

### UI/UX Decisions
The application features a "Neon Nightlife" aesthetic with a brand slogan "BREAK FREE". The color palette includes Midnight base, Deep Violet (primary), Electric Magenta, Cyber Cyan, and a Warm accent. Typography uses Space Grotesk for headings and Inter for body text. The design incorporates modern glassmorphism and gradient effects, with a unified 4-column footer across all web pages. The UI is built using Tailwind CSS v4, replacing Bootstrap, and features a custom modal system.

### Technical Implementations
Vybez is a Node.js application using Express.js for the backend and Socket.IO for real-time communication. User authentication uses bcrypt for password hashing, and sessions are managed with `express-session` and a file-based store. The application uses PostgreSQL as its primary database, hosted on Replit's managed Neon database. Frontend development uses vanilla JavaScript and Tailwind CSS v4.

Key Features include:
- **User Authentication:** Secure signup/login with bcrypt.
- **Guest Demo Mode:** Read-only demo showcasing all features without account creation (designed for Microsoft Store reviewers).
- **Discord-Style Settings:** Full-page settings interface with categorized navigation (Appearance, Profile, My Account, Privacy & Safety, Advanced). Features light/dark theme toggle, profile customization, account management, and advanced options.
- **Custom Chat Rooms:** Users can create and delete rooms, with real-time updates via Socket.IO.
- **Real-time Messaging:** Instant message delivery, message history, typing indicators, and message reactions.
- **@Mentions:** Detect @username in messages with blue highlighting; mentioned users receive real-time notifications with XSS-safe rendering.
- **Message Deletion:** Users can delete their own messages; admins can delete any message; real-time Socket.IO broadcast removes messages for all connected clients.
- **Support Ticket System:** Full-featured support system at `/support` where users can submit tickets with priority levels (low, normal, high, urgent). Admins can view, respond to, and manage tickets through the admin panel with status tracking (open, in_progress, resolved, closed).
- **Admin Panel:** Comprehensive admin dashboard at `/admin-panel.html` with:
  - Live stats (users, rooms, messages, bans)
  - User management (promote/demote admins, **delete users**)
  - **Mod View:** Discord-style user profile inspection showing user activity (message count, file uploads, support tickets), complete moderation history (warnings, mutes, bans), and account details
  - **User Deletion:** Admins can permanently delete any user account (except their own) with double confirmation and automatic cleanup of all associated data
  - Room management
  - Recent message logs
  - File upload tracking
  - **Support Tickets tab:** View and manage support tickets with filtering by status, respond to tickets, and update ticket status
  - Quick access to moderation pages
  - Real-time data refresh
- **User Profiles:** Customizable avatars, bios, status, and chat colors.
- **File Sharing:** Uploads up to 10MB (images, documents, videos) with secure filename generation and automatic image previews.
- **Private Messaging:** Direct messages with notifications and read receipts.
- **Message Search:** Functionality to search through message history.
- **User Roles:** Admin and standard user permission system.
- **Moderation System:** Three-tier enforcement system with warnings (notification mailbox), mutes (chat blocking with countdown), and bans (complete site access restriction). Features include:
  - **Warning System:** Sends notifications to user's mailbox inbox; users retain full access but see warning messages
  - **Mute System:** Blocks message sending (chat and private messages); grays out input with visual feedback showing mute duration and reason; users can still view site
  - **Ban System:** Blocks access to all pages except ban page and support page; redirects to dedicated ban page showing reason, duration, and admin info; supports permanent and temporary bans (1 day, 3 day, 7 day, 2 week, 1 month); banned users can submit support tickets for appeals
  - **Message Evidence:** Moderators can attach message IDs as evidence when issuing warnings, mutes, or bans; evidence displayed in management tables for accountability
  - **Admin Management:** Three dedicated management pages for warnings, mutes, and bans with CRUD operations and evidence tracking
  - **Real-time Enforcement:** Server-side and client-side validation; Socket.IO middleware blocks banned/muted users; automatic expiration handling; ban routing ensures users can only access ban page and support page when banned

### System Design Choices
The application is structured with a clear separation between server-side logic (`server.js`, `database.js`), client-side logic (`public/client.js`), and Electron-specific components (`electron.js`, `preload.js`, `desktop-integration.js`). Database interactions are handled via `pg` for PostgreSQL. The system uses a file-based session store to maintain user sessions. All frontend styles are built with `@tailwindcss/cli`, ensuring a lean and production-ready CSS output.

### v1.1.0 Planned Features
**Session Storage Migration:**
- Migrate from file-based sessions to Replit key-value storage for better cloud-native performance
- Use `@replit/database` for persistent session management
- Remove dependency on `session-file-store`

**Core Features:**
- Restore file upload and search buttons to chat interface
- Enhanced private message modal with user profiles and neon nightlife theme
- #announcements system channel with markdown support (admin-only posting)
- Maintenance mode toggle for health endpoint

**File Storage:**
- Migrate file uploads to Replit App Storage (object storage)
- Host desktop client installers via App Storage
- Update download links on landing page

**Desktop Client Improvements:**
- Single instance lock (prevent multiple app instances)
- Fix tray icon functionality
- Flathub publishing support for Linux
- Custom branded installers for Windows/macOS/Linux

**UI/UX Polish:**
- Fix chat column stretching with long strings
- Consistent room list background colors
- Performance optimizations and code cleanup

### Electron Desktop Client
A full-featured Electron desktop client provides enhanced user experience with:
- Desktop notifications for new messages.
- System tray integration with context menu (minimize to tray, always on top, auto-launch, quit).
- Badge counts on the app icon for unread messages.
- Global keyboard shortcuts.
- Native dark mode detection.
- Offline detection.
- Auto-updater for seamless updates.
- Auto-launch on startup.
- Native file picker for uploads.
- Window bounds persistence.
- Secure IPC communication via a preload script.

### Database Schema
- **`users`**: id, username, password, chat_color, bio, status, avatar_url, role
- **`messages`**: id, room, username, message_text, chat_color, timestamp, file_url, file_type
- **`reactions`**: id, message_id (FK), username, emoji
- **`private_messages`**: id, from_user, to_user, message_text, timestamp, read
- **`read_receipts`**: id, message_id (FK), username, read_at
- **`rooms`**: id, name (UNIQUE), created_by, created_at, is_default
- **`warnings`**: id, username, warned_by, reason, message_evidence, created_at
- **`mutes`**: id, username, muted_by, reason, message_evidence, duration_minutes, expires_at, created_at, is_active
- **`bans`**: id, username, banned_by, reason, message_evidence, is_permanent, expires_at (NULL for permanent), created_at, is_active
- **`support_tickets`**: id, username, email, subject, message, status (open/in_progress/resolved/closed), priority (low/normal/high/urgent), created_at, updated_at, admin_response, responded_by

All tables utilize PostgreSQL SERIAL for auto-incrementing IDs. The codebase uses a username-based schema pattern where relationships are maintained via TEXT username fields rather than foreign key constraints. Data integrity during account deletion and username changes is handled via transactional updates in `deleteUserAccount()` and `changeUsername()` functions.

## External Dependencies
- **Node.js**: Backend runtime environment.
- **Express.js**: Web application framework for Node.js.
- **Socket.IO**: Real-time bidirectional event-based communication.
- **PostgreSQL**: Relational database (Replit managed Neon database).
- **`pg`**: PostgreSQL client for Node.js.
- **`express-session`**: Middleware for session management.
- **`session-file-store`**: File system-based session store.
- **`bcrypt`**: Library for hashing passwords.
- **`multer`**: Middleware for handling `multipart/form-data` (file uploads).
- **Tailwind CSS v4**: Utility-first CSS framework for styling.
- **Electron**: Framework for building desktop applications with web technologies.
- **`electron-builder`**: Tool for packaging and distributing Electron apps.
- **`auto-launch`**: For launching Electron apps on system startup.
- **`electron-updater`**: For enabling auto-updates in Electron apps.
- **`electron-store`**: For simple data persistence in Electron apps.
- **Google Fonts CDN**: For loading Space Grotesk and Inter fonts.
- **Discord Webhook**: For server-wide activity logging and monitoring (DISCORD_WEBHOOK_URL stored in environment secrets).

## Health Monitoring
The server includes a `/health` endpoint for uptime monitoring and status checks:
- **Endpoint:** `GET /health`
- **Response Format:** JSON with status, uptime, timestamp, and database connectivity
- **HTTP Status Codes:** 
  - `200 OK` - Server and database are healthy
  - `503 Service Unavailable` - Database connection error
- **Use Cases:** External monitoring services, load balancers, deployment verification

Example response:
```json
{
  "status": "OK",
  "uptime": 14.977,
  "timestamp": "2025-10-13T23:19:05.476Z",
  "database": "connected"
}
```

## Discord Integration
The platform includes comprehensive Discord webhook logging for real-time monitoring of server-wide activities:
- **📝 User Registration:** Logged when new users join the platform
- **🔐 User Login:** Logged when users authenticate (includes client type: 🌐 Web, 💻 Desktop, 🤖 API)
- **👤 Profile Updates:** Logged when users change bio, status, or chat color
- **🖼️ Avatar Uploads:** Logged when users upload new profile pictures
- **✏️ Username Changes:** Logged when users change their display name
- **❌ Account Deletions:** Logged when users permanently delete their accounts
- **🏠 Room Creation:** Logged when custom chat rooms are created
- **🗑️ Room Deletion:** Logged when chat rooms are removed
- **📎 File Uploads:** Logged when files are uploaded to the platform
- **💬 Chat Messages:** Logged when messages are sent in chat rooms (with 100-char preview and client type)
- **📧 Private Messages:** Logged when direct messages are sent between users (with 100-char preview and client type)
- **👍 Message Reactions:** Logged when users react to messages with emojis
- **@️⃣ User Mentions:** Logged when users are mentioned in chat messages
- **⚠️ Warnings Issued:** Logged when moderators issue warnings to users
- **🔇 Mutes Applied:** Logged when moderators mute users (includes duration)
- **🚫 Bans Applied:** Logged when moderators ban users (includes duration or permanent status)

All webhook notifications include:
- Color-coded embeds matching the brand identity (violet, cyan, magenta)
- Client detection to differentiate between Web (🌐), Desktop (💻), and External API/Discord bot (🤖) usage
- Real-time delivery to the configured Discord channel