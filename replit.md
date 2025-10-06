# Vybez Chat App

## Overview
Vybez is a real-time chat application built with Node.js, Express, and Socket.IO. It features multiple chat rooms, user authentication, session management, and a modern responsive interface.

**Purpose:** A learning project for Node.js development that provides a full-featured chatroom experience.

**Current State:** Fully configured and running in the Replit environment on port 5000.

## Recent Changes
- **2025-10-06:** Configured for Replit environment
  - Updated server to bind to 0.0.0.0:5000 (required for Replit)
  - Configured workflow to run the app
  - Set up deployment configuration using VM target (stateful app with sessions)
  - Installed all npm dependencies

## Tech Stack
- **Backend:** Node.js, Express.js
- **Real-time Communication:** Socket.IO
- **Database:** SQLite3 (local file-based)
- **Session Management:** express-session with SQLite store
- **Authentication:** bcrypt for password hashing
- **Frontend:** Bootstrap 5, vanilla JavaScript

## Project Architecture

### File Structure
```
├── server.js           # Main server file with Express and Socket.IO setup
├── database.js         # SQLite database operations and schema
├── package.json        # Project dependencies
├── public/            # Static frontend files
│   ├── landing.html   # Landing/login page
│   ├── chat.html      # Main chat interface
│   ├── client.js      # Client-side Socket.IO logic
│   ├── style.css      # Chat interface styles
│   ├── landing.css    # Landing page styles
│   └── [other assets] # Images, videos, documentation pages
├── chat.db            # SQLite database for users and messages
└── sessions.db        # SQLite database for sessions
```

### Key Features
1. **User Authentication:** Secure signup/login with bcrypt password hashing
2. **Multiple Chat Rooms:** Pre-configured rooms (#general, #tech, #random)
3. **Real-time Messaging:** Socket.IO for instant message delivery
4. **Message History:** Persisted in SQLite, loaded on room join
5. **Online Users:** Real-time list of connected users
6. **User Profiles:** Custom chat colors, bio, and status
7. **Session Persistence:** Server-side sessions with SQLite storage

### Database Schema
- **users table:** id, username, password, chat_color, bio, status
- **messages table:** id, room, username, message_text, chat_color, timestamp
- **reactions table:** id, message_id, username, emoji

## Configuration

### Development
- **Port:** 5000 (Replit standard)
- **Host:** 0.0.0.0 (required for Replit proxy)
- **Workflow:** `npm start` runs `node server.js`

### Deployment
- **Type:** VM (stateful deployment)
- **Command:** `node server.js`
- **Reason for VM:** Application maintains WebSocket connections and session state in memory

## How to Run
The application runs automatically via the configured workflow. To manually start:
```bash
npm start
```

## Dependencies
All dependencies are installed and listed in package.json:
- express, socket.io - Web server and real-time communication
- sqlite3, connect-sqlite3 - Database operations
- express-session, session-file-store - Session management
- bcrypt - Password hashing
- multer - File upload handling (future feature)
