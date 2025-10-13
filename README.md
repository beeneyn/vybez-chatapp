# Vybez Chat App 💬

**BREAK INTO THE VYBE** - A modern, real-time chat application with a stunning Neon Nightlife aesthetic. Built with Node.js, Socket.IO, and PostgreSQL.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Educational-green.svg)

## 🎨 Brand Identity

**Slogan:** BREAK INTO THE VYBE  
**Theme:** Neon Nightlife Aesthetic

**Brand Colors:**
- 🟣 Violet: `#5b2bff` (Primary)
- 💗 Magenta: `#ff3f8f` (Accent)
- 🔵 Cyan: `#1ed5ff` (Accent)
- 🌑 Midnight: `#0b1220` (Base)
- 🟡 Warm: `#f6b73c` (Highlight)

**Typography:**
- Display/Headings: Space Grotesk (600-700)
- Body/UI: Inter (400-600)

## ✨ Features

### 🎯 Core Functionality
- **Real-time Messaging** - Instant message delivery using WebSocket technology
- **Custom Chat Rooms** - Create unlimited custom rooms beyond default rooms (#general, #tech, #random)
- **User Authentication** - Secure signup and login with bcrypt password hashing
- **Session Persistence** - Server-side sessions that persist across page refreshes
- **Message History** - Automatic loading of recent messages when joining a room

### 👤 User Features
- **Custom Profiles** - Personalize your chat color, bio, status, and avatar
- **User Avatars** - Upload and display custom profile pictures (with dynamic placeholders)
- **Online Users List** - See who's currently active in real-time
- **Private Messaging** - Send direct messages to other users with notifications
- **Room Management** - Create custom rooms and delete rooms you no longer need

### ✨ Advanced Features
- **Message Reactions** - React to messages with emojis (👍, ❤️, 😂, 😮, 😢, 🎉, 🔥, 👏)
- **Typing Indicators** - See when other users are typing in real-time
- **File & Image Sharing** - Upload and share files up to 10MB with automatic image preview
- **Message Search** - Search through message history in any room
- **Read Receipts** - Track who has read your messages
- **User Roles** - Admin and user role system for permissions management

### 🖥️ Desktop Client (Electron)
- **Cross-Platform Desktop App** - Native apps for Windows, macOS (Apple Silicon), and Linux
- **Desktop Notifications** - Native OS notifications for new messages and private DMs
- **System Tray Integration** - Minimize to tray, always-on-top, auto-launch options
- **Badge Counts** - Unread message counter on app icon
- **Global Shortcuts** - Ctrl+Shift+V to show/hide window
- **Auto-Updates** - Automatic app updates via electron-updater
- **Offline Detection** - Visual banner when internet connection is lost

### 🔒 Security
- Environment-based secrets (SESSION_SECRET, JWT_SECRET)
- Password hashing with bcrypt
- Session-based authentication with file storage
- XSS protection with message sanitization
- Secure cookie configuration

## 🛠️ Tech Stack

**Backend:**
- Node.js & Express.js
- Socket.IO (WebSocket communication)
- PostgreSQL (Replit managed Neon database)
- Multer (file upload handling)

**Frontend:**
- Tailwind CSS v4 (@tailwindcss/cli)
- Vanilla JavaScript (ES6+)
- Socket.IO Client

**Desktop Client:**
- Electron with electron-builder
- electron-updater (auto-updates)
- electron-store (settings persistence)
- auto-launch (startup integration)

**Session & Auth:**
- express-session
- session-file-store
- bcrypt (password hashing)
- JWT tokens

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL database (or use Replit's managed database)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd vybez-chatapp
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env` file or set these in your Replit Secrets:
```
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret
```

4. **Build Tailwind CSS**
```bash
npm run build:css
```

5. **Start the server**
```bash
npm start
```

6. **Open your browser**
```
http://localhost:5000
```

### Running Desktop Client

**Development:**
```bash
npm run electron
```

**Build installers:**
```bash
# Build for all platforms
npm run dist

# Build for specific platform
npm run dist:win     # Windows (NSIS installer + portable)
npm run dist:mac     # macOS (DMG + zip) - Apple Silicon only
npm run dist:linux   # Linux (AppImage + deb)
```

## 📁 Project Structure

```
vybez-chatapp/
├── server.js              # Main server (Express + Socket.IO)
├── database.js            # PostgreSQL operations and schema
├── electron.js            # Electron main process
├── preload.js             # Electron preload script
├── package.json           # Dependencies and build config
├── tailwind.css           # Compiled Tailwind CSS
├── public/                # Static files
│   ├── landing.html       # Landing/login page
│   ├── chat.html          # Main chat interface
│   ├── downloads.html     # Desktop client downloads
│   ├── client.js          # Client-side Socket.IO logic
│   ├── desktop-integration.js  # Desktop feature bridge
│   ├── style.css          # Chat UI styles
│   ├── landing.css        # Landing page styles
│   ├── about.html         # About page
│   ├── brand-kit.html     # Brand guidelines
│   ├── privacy.html       # Privacy policy
│   ├── terms.html         # Terms of service
│   └── uploads/           # User-uploaded files
├── sessions/              # Session file storage
├── dist/                  # Desktop app builds
└── build/                 # Build resources (icons)
```

## 💾 Database Schema (PostgreSQL)

### Users Table
- `id` (SERIAL) - Primary key
- `username` (VARCHAR UNIQUE) - Username
- `password` (VARCHAR) - Hashed password
- `chat_color` (VARCHAR) - Hex color code
- `bio` (TEXT) - User biography
- `status` (VARCHAR) - Status text
- `avatar_url` (VARCHAR) - Profile picture URL
- `role` (VARCHAR) - User role (admin/user)

### Messages Table
- `id` (SERIAL) - Primary key
- `room` (VARCHAR) - Chat room name
- `username` (VARCHAR) - Message sender
- `message_text` (TEXT) - Message content
- `chat_color` (VARCHAR) - Sender's color
- `timestamp` (TIMESTAMP) - Message time
- `file_url` (VARCHAR) - Attached file URL
- `file_type` (VARCHAR) - MIME type

### Rooms Table
- `id` (SERIAL) - Primary key
- `name` (VARCHAR UNIQUE) - Room name
- `created_by` (VARCHAR) - Creator username
- `created_at` (TIMESTAMP) - Creation time
- `is_default` (BOOLEAN) - System room flag

### Reactions, Private Messages, Read Receipts
See `database.js` for complete schema with foreign keys and constraints.

## 🔌 API Endpoints

### Authentication
- `POST /signup` - Create new user account
- `POST /login` - Authenticate user
- `POST /logout` - End user session
- `GET /check-session` - Verify active session

### Profile & Files
- `POST /upload-file` - Upload file (max 10MB)
- `POST /upload-avatar` - Upload avatar image
- `POST /update-profile` - Update user profile
- `GET /search-messages` - Search messages
- `GET /private-messages/:username` - Get DM history

### Rooms
- `GET /rooms` - Get all rooms
- `POST /rooms` - Create new room
- `DELETE /rooms/:name` - Delete custom room

### Socket Events
- `connection` - Client connects
- `switchRoom` - Change room
- `chatMessage` - Send/receive messages
- `updateUserList` - Sync online users
- `typing` - Typing indicators
- `addReaction` / `removeReaction` - Reactions
- `privateMessage` - Send private message
- `roomCreated` / `roomDeleted` - Room updates
- `disconnect` - Client disconnects

## 🎨 Customization

### Adding Custom Colors
Edit CSS variables in `public/style.css` and `public/landing.css`:
```css
:root {
    --brand-violet: #5b2bff;
    --brand-magenta: #ff3f8f;
    --brand-cyan: #1ed5ff;
    /* ... */
}
```

### Modifying Default Rooms
Default rooms are stored in the database with `is_default = true`. Users cannot delete default rooms.

## 🚢 Deployment

### Replit Deployment
1. Set environment secrets (SESSION_SECRET, JWT_SECRET, DATABASE_URL)
2. Click the **Deploy** button
3. Choose **VM** deployment (required for WebSocket support)
4. Your app will be live at your Replit URL

### Desktop App Distribution
1. Update `serverUrl` in `electron.js` to your deployed URL
2. Run build commands for each platform
3. Distribute installers from the `dist/` folder
4. **macOS builds are Apple Silicon only** (M1/M2/M3)

## 📦 Available Scripts

```bash
npm start              # Start the web server
npm run electron       # Run desktop app in dev mode
npm run build:css      # Build Tailwind CSS
npm run db:push        # Push database schema changes
npm run dist           # Build desktop apps for all platforms
npm run dist:win       # Build for Windows
npm run dist:mac       # Build for macOS (Apple Silicon)
npm run dist:linux     # Build for Linux
```

## 🎯 Learning Outcomes

This project demonstrates:
- Real-time WebSocket communication
- PostgreSQL database design and queries
- Session management and authentication
- Modern CSS with Tailwind v4
- Cross-platform desktop app development with Electron
- File upload handling and storage
- RESTful API design
- Security best practices (bcrypt, environment secrets)

## 📸 Screenshots

Visit the live app to see:
- Beautiful Neon Nightlife gradient hero
- Modern chat interface with real-time features
- Custom room creation and management
- Desktop client with native integrations

## 🙏 Acknowledgments

- Built as a learning project for Node.js and real-time web applications
- Inspired by modern chat platforms like Discord and Slack
- Branding and design: Neon Nightlife aesthetic
- Created by Beeny

## 📄 License

This is an educational project created for learning purposes.

---

**Version 1.0.0** - Production Ready 🎉  
*BREAK INTO THE VYBE*
