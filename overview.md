# Vybez Chat App - Overview

## 🌟 Project Description

**Vybez** is a production-ready, real-time chat application built with Node.js, Express, and Socket.IO. It offers a full-featured messaging experience with a distinctive **Neon Nightlife** aesthetic, combining modern web technologies with a comprehensive feature set that rivals popular chat platforms.

**Tagline:** BREAK FREE

**Live Instance:** https://www.vybez.page  
**Desktop Client:** Electron app available for Windows, macOS, and Linux

---

## ✨ Key Features

### 💬 Core Chat Functionality
- **Real-time Messaging** - Instant message delivery via Socket.IO
- **Custom Chat Rooms** - User-created rooms with full CRUD operations
- **Private Messaging** - Direct messages with read receipts
- **Message Reactions** - Emoji reactions on messages
- **@Mentions** - Tag users with notification system
- **Message History** - Persistent chat history with search
- **Typing Indicators** - Real-time typing status
- **File Sharing** - Upload files up to 10MB with image previews
- **Unread Message Tracking** - Smart badge indicators with automatic read marking

### 👥 User Management
- **Authentication System** - Secure bcrypt password hashing
- **User Profiles** - Customizable avatars, bios, status, and chat colors
- **Display Names** - Separate display names from usernames
- **Guest Demo Mode** - Read-only guest access for previewing
- **Role-Based Permissions** - Admin and standard user roles with visual indicators
- **Online Status** - Real-time online/offline indicators

### 🛡️ Moderation & Safety
- **Three-Tier Enforcement** - Warnings, mutes, and bans with evidence tracking
- **Admin Panel** - Comprehensive dashboard for user management
- **Message Logs** - Complete audit trail of all messages
- **File Tracking** - Monitor and manage uploaded files
- **User Deletion** - Soft delete with data retention policies

### 🎨 UI/UX Excellence
- **Neon Nightlife Theme** - Custom color palette with glassmorphism effects
  - Midnight (#0A0118)
  - Deep Violet (#7C3AED)
  - Electric Magenta (#FF10F0)
  - Cyber Cyan (#00E5FF)
- **Dark Theme Default** - With light theme option in settings
- **Discord-Style Settings** - Full-page settings sidebar for Appearance, Profile, Account, Privacy & Safety, and Advanced
- **Discord-Style Members List** - Online users at top, admin shield icons, search functionality
- **Responsive Design** - Mobile-friendly Tailwind CSS v4 layout
- **Custom Error Pages** - Branded 404 and 401 pages with helpful navigation

### 🎫 Support & Communication
- **Support Ticket System** - Priority-based ticketing with admin management
- **Email Integration** - SendGrid for ticket notifications
- **Announcements** - System-wide announcements with unread tracking
- **In-App Notifications** - Real-time notification center with "Mark All Read"

### 🔧 Developer Tools
- **Developer Portal** - Comprehensive API management dashboard
- **API Key Management** - Create, deactivate, and delete API keys
- **Rate Limiting** - Tiered rate limits (100/min, 500/min, 1000/min)
- **API Documentation** - Built-in interactive documentation with code examples
- **API Usage Statistics** - Real-time request tracking and analytics
- **Code Examples** - JavaScript, Python, and cURL snippets
- **Webhooks (Coming Soon)** - HTTP callbacks for events
- **API Logs** - Complete audit trail of all API requests
- **Best Practices Guide** - Security and implementation guidelines

### 📊 Admin Dashboard
- **Live Statistics** - Real-time user count, message count, room count
- **User Management** - View, edit, and delete users
- **Room Management** - Create, edit, and delete chat rooms
- **Message Moderation** - View and manage all messages
- **Support Ticket Management** - Respond to and resolve tickets
- **Activity Graphs** - Chart.js visualizations for:
  - Messages over time
  - Private messages over time
  - Room creation trends
  - Support ticket volume
  - API request patterns
- **Server Logs** - Category-based logging with Winston
- **Database Management** - Table statistics, row counts, and indexes
- **Maintenance Mode** - Toggle system-wide maintenance with custom message

### 🖥️ Electron Desktop Client
- **Native Desktop App** - Cross-platform Electron application
- **Desktop Notifications** - System tray notifications for new messages
- **System Tray Integration** - Minimize to tray functionality
- **Badge Counts** - Unread message count on app icon
- **Global Shortcuts** - Keyboard shortcuts for quick access
- **Native Dark Mode** - Follows system theme preferences
- **Offline Detection** - Connection status monitoring
- **Auto-Updater** - Automatic app updates
- **Auto-Launch** - Start on system boot option
- **Native File Picker** - System file dialogs
- **Borderless Window** - Custom title bar with drag support
- **Secure IPC** - Sandboxed communication between main and renderer

### 🔐 Security & Performance
- **Session Management** - Express-session with file store
- **Password Hashing** - bcrypt with salt rounds
- **JWT Support** - JSON Web Tokens for API authentication
- **Input Validation** - Server-side validation for all inputs
- **XSS Prevention** - DOM-based text content insertion
- **CSRF Protection** - Token-based request validation
- **Rate Limiting** - API rate limiting per tier
- **Health Monitoring** - Discord webhook integration for uptime tracking
- **Structured Logging** - Winston logger with database persistence
- **Database Connection Pooling** - Optimized PostgreSQL connections (20 max, 5s timeout)

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-time:** Socket.IO (WebSocket)
- **Database:** PostgreSQL (Neon on Replit)
- **ORM:** pg (PostgreSQL client)
- **Authentication:** bcrypt, express-session, jsonwebtoken
- **File Upload:** multer
- **Logging:** winston
- **Email:** SendGrid

### Frontend
- **HTML5/CSS3/JavaScript** - Vanilla JS for maximum control
- **Tailwind CSS v4** - Utility-first CSS framework
- **Socket.IO Client** - Real-time WebSocket client
- **Google Fonts** - Space Grotesk (headings), Inter (body)

### Desktop
- **Electron** - Desktop app framework
- **electron-builder** - App packaging and distribution
- **electron-updater** - Auto-update functionality
- **electron-store** - Persistent data storage
- **auto-launch** - System startup integration

### DevOps
- **Replit** - Development and hosting platform
- **Discord Webhooks** - Server monitoring
- **PostgreSQL** - Managed Neon database

---

## 📁 Project Structure

```
vybez-chatapp/
├── public/                      # Frontend static files
│   ├── client.js               # Main client-side logic
│   ├── chat.html               # Chat interface
│   ├── admin.html              # Admin dashboard
│   ├── developer.html          # Developer portal
│   ├── developer.js            # Developer portal logic
│   ├── settings.html           # User settings page
│   ├── api-documentation.html  # API docs
│   ├── self-hosting.html       # Self-hosting guide
│   ├── 404.html                # Custom error pages
│   ├── 401.html
│   └── tailwind.css            # Compiled Tailwind styles
├── electron/                    # Electron desktop app
│   ├── main.js                 # Main process
│   ├── preload.js              # Preload script
│   └── index.html              # Electron renderer
├── sessions/                    # Session file store
├── uploads/                     # User-uploaded files
├── src/                         # Source files
│   └── input.css               # Tailwind input
├── index.js                     # Main server file
├── server.js                    # Symlink to index.js
├── database.js                  # Database layer
├── discord-webhook.js           # Discord integration
├── package.json                 # Dependencies
├── replit.md                    # Project documentation
└── overview.md                  # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- SendGrid API key (for email features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vybez.git
   cd vybez
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   DATABASE_URL=postgresql://user:password@host:port/database
   SESSION_SECRET=your-secure-session-secret
   JWT_SECRET=your-jwt-secret
   DISCORD_WEBHOOK_URL=your-discord-webhook-url
   ```

4. **Initialize the database**
   The database tables will be automatically created on first run.

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the application**
   - Web: http://localhost:5000
   - Health Check: http://localhost:5000/health
   - API Docs: http://localhost:5000/api-docs

### Electron Desktop App

```bash
npm run electron
```

To build the desktop app:
```bash
npm run electron:build
```

---

## 📈 Recent Performance Improvements

### Health Endpoint Optimization (Nov 2025)
- **Problem:** `/health` endpoint timing out at 15+ seconds
- **Solution:** 
  - Rewrote with proper async/await pattern
  - Added Promise.race() timeout protection (5s maintenance, 3s DB)
  - Optimized database connection pool (20 max connections, 5s timeout)
- **Result:** Response time reduced from **15,000ms → 67-73ms** (99.5% improvement)

### Developer Portal Enhancements (Nov 2025)
- Added API Usage Dashboard with live statistics
- Created Quick Start Code Examples (JavaScript, Python, cURL)
- Added Best Practices guide and Community Resources
- Implemented `/api/developer/stats` endpoint for real-time metrics

---

## 🗺️ Vybez 2.0 Roadmap

**Target Release:** Q2-Q3 2026

### Major Technology Upgrade
- **Frontend:** React 18+ with TypeScript, Vite, Redux Toolkit
- **Mobile:** React Native with Expo (Android priority, iOS later)
- **Backend:** Node.js + TypeScript, tRPC for type-safe APIs
- **Monorepo:** Turborepo with pnpm
- **File Storage:** AWS S3 with CloudFront CDN
- **Authentication:** JWT with refresh tokens, OAuth 2.0, 2FA

### Planned Features
- Voice Channels & Video Calls (v1.5)
- Custom Emojis (v1.2)
- Role Permissions System (v1.2)
- Bot Support/API (v1.3)
- Screen Sharing (v1.5)
- Rich Message Embeds (v1.6)
- Message Threading (v1.7)
- Server Boost System (v1.8)
- Webhooks (v1.9)
- End-to-End Encryption for PMs

---

## 📊 Database Schema

### Core Tables
- `users` - User accounts and profiles
- `messages` - Chat messages with room assignment
- `private_messages` - Direct messages between users
- `rooms` - Custom chat rooms
- `reactions` - Message reactions
- `read_receipts` - Message read tracking

### Moderation
- `warnings` - User warnings with evidence
- `mutes` - User mutes with duration and evidence
- `bans` - User bans with evidence
- `ban_appeals` - User-submitted appeals

### System
- `support_tickets` - Support ticket system
- `announcements` - System announcements
- `announcement_reads` - User read tracking
- `notifications` - In-app notifications
- `api_keys` - Developer API keys
- `api_logs` - API request logs
- `server_logs` - System event logs
- `health_checks` - Health check history
- `system_settings` - Configuration key-value store
- `unread_messages` - Unread message tracking

---

## 🔒 Security Best Practices

1. **Never expose API keys** - Use environment variables
2. **Password security** - bcrypt with appropriate salt rounds
3. **Input validation** - Server-side validation for all user input
4. **Rate limiting** - Prevent API abuse
5. **SQL injection prevention** - Parameterized queries only
6. **XSS prevention** - DOM-based content insertion
7. **Session security** - Secure session configuration
8. **HTTPS enforcement** - Always use TLS in production

---

## 📝 API Documentation

Full API documentation is available at `/api-docs` when the server is running, or see `public/api-documentation.html` for the complete reference.

### Key Endpoints
- `POST /login` - User authentication
- `POST /signup` - User registration
- `GET /health` - System health check
- `GET /api/developer/keys` - Manage API keys
- `GET /api/admin/*` - Admin endpoints (admin only)

### Socket.IO Events
- `chatMessage` - Send/receive messages
- `privateMessage` - Send/receive DMs
- `typing` - Typing indicators
- `reaction` - Message reactions
- `updateUserList` - User status updates
- `roomCreated` / `roomDeleted` - Room management
- `loadHistory` - Message history

---

## 🤝 Contributing

This project is currently in active development. For the Vybez 2.0 rewrite (Q2-Q3 2026), we'll be welcoming contributors. Stay tuned!

---

## 📄 License

Proprietary - © 2025 Vybez Chat App

---

## 📞 Support

- **In-App Support:** Use the support ticket system at `/support`
- **Email:** support@vybez.page
- **Discord:** https://discord.gg/vybez
- **GitHub:** https://github.com/yourusername/vybez
- **Twitter:** https://twitter.com/vybezchat

---

## 🎯 Performance Metrics

- **Response Time:** < 100ms for most endpoints
- **Health Check:** 67-73ms average
- **Database Connections:** 20 max, 5s timeout
- **File Upload Limit:** 10MB
- **API Rate Limits:** 100-1000 req/min (tier-based)
- **Session Timeout:** Configurable (default: 7 days)
- **Uptime Target:** 99.9%

---

**Built with ❤️ using Node.js, Express, Socket.IO, and PostgreSQL**  
**Styled with Tailwind CSS v4 and the Neon Nightlife aesthetic**

> "BREAK FREE from boring chat apps. Welcome to Vybez." 🌃
