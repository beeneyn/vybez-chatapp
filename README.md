# Vybez Chat App 💬

A modern, real-time chat application built with Node.js and Socket.IO. Vybez provides a Discord-like experience with multiple chat rooms, user authentication, and customizable profiles.

## Features

### 🎯 Core Functionality
- **Real-time Messaging** - Instant message delivery using WebSocket technology
- **Multiple Chat Rooms** - Pre-configured rooms (#general, #tech, #random) for organized conversations
- **User Authentication** - Secure signup and login with bcrypt password hashing
- **Session Persistence** - Server-side sessions that persist across page refreshes
- **Message History** - Automatic loading of recent messages when joining a room

### 👤 User Features
- **Custom Profiles** - Personalize your chat color, bio, and status
- **Online Users List** - See who's currently active in real-time
- **Private Messaging** - Direct message other users (UI ready)
- **Theme Toggle** - Switch between light and dark modes

### 🔒 Security
- Password hashing with bcrypt
- Session-based authentication
- XSS protection with message sanitization
- Secure cookie configuration

## Tech Stack

**Backend:**
- Node.js
- Express.js
- Socket.IO (WebSocket communication)
- SQLite3 (local database)

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- Bootstrap 5
- Socket.IO Client

**Session & Auth:**
- express-session
- connect-sqlite3 (session store)
- bcrypt (password hashing)

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd vybez-chatapp
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
vybez-chatapp/
├── server.js              # Main server file (Express + Socket.IO)
├── database.js            # Database operations and schema
├── package.json           # Project dependencies
├── public/                # Static files
│   ├── landing.html       # Landing/login page
│   ├── chat.html          # Main chat interface
│   ├── client.js          # Client-side Socket.IO logic
│   ├── style.css          # Chat UI styles
│   ├── landing.css        # Landing page styles
│   ├── about.html         # About page
│   ├── privacy.html       # Privacy policy
│   ├── terms.html         # Terms of service
│   └── assets/            # Images and media files
├── chat.db                # SQLite database (auto-created)
└── sessions.db            # Session storage (auto-created)
```

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `password` - Hashed password
- `chat_color` - Hex color code for messages
- `bio` - User biography
- `status` - Current status text

### Messages Table
- `id` - Primary key
- `room` - Chat room name
- `username` - Message sender
- `message_text` - Message content
- `chat_color` - Sender's color
- `timestamp` - Message timestamp

### Reactions Table
- `id` - Primary key
- `message_id` - Foreign key to messages
- `username` - User who reacted
- `emoji` - Reaction emoji

## How It Works

1. **Authentication Flow:**
   - User signs up or logs in
   - Password is hashed and stored securely
   - Session is created and stored in SQLite
   - User is redirected to chat interface

2. **Real-time Communication:**
   - Client connects to server via Socket.IO
   - Session is verified on connection
   - User joins default room (#general)
   - Messages are broadcast to all users in the room
   - Online users list updates in real-time

3. **Room Management:**
   - Users can switch between predefined rooms
   - Message history loads automatically on room join
   - Each room maintains separate message history

## API Endpoints

### Authentication
- `POST /signup` - Create new user account
- `POST /login` - Authenticate user
- `POST /logout` - End user session
- `GET /check-session` - Verify active session

### Socket Events
- `connection` - Client connects to server
- `switchRoom` - Change chat room
- `chatMessage` - Send/receive messages
- `updateUserList` - Sync online users
- `disconnect` - Client disconnects

## Development

### Running in Development Mode
```bash
npm start
```

### Environment Variables
- `PORT` - Server port (default: 5000)

### Adding New Rooms
Edit the `rooms` array in `server.js`:
```javascript
const rooms = ['#general', '#tech', '#random', '#your-room'];
```

## Deployment

This application is configured for deployment on platforms like Replit, Heroku, or similar Node.js hosting services.

**Deployment Configuration:**
- Uses VM deployment for stateful WebSocket connections
- Binds to `0.0.0.0` for cloud environments
- Environment-aware port configuration

## Future Enhancements

- [ ] File/image sharing with Multer
- [ ] Message reactions (schema ready)
- [ ] User avatars
- [ ] Private messaging completion
- [ ] User roles and permissions
- [ ] Message search functionality
- [ ] Typing indicators
- [ ] Read receipts

## Learning Outcomes

This project was created as a Node.js learning exercise and demonstrates:
- Building real-time applications with WebSockets
- Session management and user authentication
- Database integration with SQLite
- RESTful API design
- Frontend-backend communication
- Security best practices

## License

This is a learning project created for educational purposes.

## Acknowledgments

- Built as a learning project to understand Node.js and real-time web applications
- Inspired by modern chat platforms like Discord and Slack
