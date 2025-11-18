# Vybez Chat App

## Overview
Vybez is a real-time chat application built with Node.js, Express, and Socket.IO, offering a full-featured chatroom experience. It provides user authentication, custom chat rooms, private messaging, file sharing, and a responsive interface, including a robust Electron desktop client. The project aims to be a comprehensive and modern chat solution, serving as a learning platform for Node.js development.

## User Preferences
I prefer detailed explanations and an iterative development approach. Ask before making major changes. Do not make changes to files within the `sessions/` directory.

## System Architecture

### UI/UX Decisions
The application features a "Neon Nightlife" aesthetic with a "BREAK FREE" slogan. The color palette includes Midnight, Deep Violet, Electric Magenta, Cyber Cyan, and Warm accent. Typography uses Space Grotesk (headings) and Inter (body). The design incorporates glassmorphism, gradients, a unified 4-column footer, and a custom modal system, all built with Tailwind CSS v4. Dark theme is the default for new users, with a light theme option available. UI elements dynamically change colors based on the selected theme.

### Technical Implementations
Vybez is a Node.js application using Express.js for the backend and Socket.IO for real-time communication. User authentication uses bcrypt and `express-session`. PostgreSQL, hosted on Replit's Neon database, is the primary data store. The frontend uses vanilla JavaScript and Tailwind CSS v4.

**Key Features:**
-   **User Authentication & Guest Demo:** Secure login/signup and a read-only guest mode.
-   **Discord-Style Settings:** Full-page settings for Appearance, Profile, Account, Privacy & Safety, and Advanced options.
-   **Custom Chat Rooms:** User-creatable and deletable rooms with real-time updates, unread message indicators, and permission-based deletion.
-   **Real-time Messaging:** Instant messages, history, typing indicators, reactions, @mentions (with notifications), message deletion, smart read tracking, and admin indicators.
-   **Discord-Style Members List:** Displays registered users with online status and admin roles.
-   **Notifications & Announcements:** In-app notification system with "Mark All Read" and announcements with unread indicators.
-   **Support Ticket System:** Priority-based tickets for users, with admin management and email notifications.
-   **Developer Portal:** API management with key creation, scopes, rate limiting, logs, and documentation.
-   **Admin Panel:** Comprehensive dashboard for live stats, user management, moderation, room management, message logs, file tracking, support tickets, API/Server logs, maintenance mode, database management, and activity graphs.
-   **Logging System:** Structured server logging (Winston) to console and database, with category-based logs and automatic API request tracking.
-   **User Profiles:** Customizable avatars, bios, status, and chat colors.
-   **File Sharing:** Uploads up to 10MB with secure filenames and image previews.
-   **Private Messaging:** Direct messages with notifications and read receipts.
-   **Message Search:** Search functionality for message history.
-   **User Roles:** Admin and standard user permission system.
-   **Moderation System:** Three-tier enforcement (warnings, mutes, bans) with evidence tracking.
-   **Custom Error Pages:** Branded 404 and 401 pages.
-   **Electron Desktop Client:** Offers desktop notifications, system tray integration, badge counts, global shortcuts, native dark mode, offline detection, auto-updater, auto-launch, native file picker, borderless window, and secure IPC.

### System Design Choices
The application separates server-side logic (`index.js`, `database.js`), client-side logic (`public/client.js`), and Electron components. The main server file is `index.js`. Database interactions use `pg` for PostgreSQL. A file-based session store manages user sessions (migrating to Replit key-value store). Frontend styles are compiled with `@tailwindcss/cli`. Database schema uses username-based relationships with transactional integrity. Custom error handling middleware serves branded 404 and 401 pages.

The Version 1.2 database schema introduces Discord-style servers with channels, roles, and permissions, ensuring data integrity with foreign keys and triggers. A backward-compatible adapter layer was implemented to allow the new server/channel architecture to work with the existing client UI, translating between client-side "rooms" and backend "channels."

## External Dependencies
-   **Node.js**: Backend runtime.
-   **Express.js**: Web application framework.
-   **Socket.IO**: Real-time communication.
-   **PostgreSQL**: Relational database (Replit managed Neon database).
-   **`pg`**: PostgreSQL client.
-   **`express-session`**: Session management middleware.
-   **`session-file-store`**: File system session store.
-   **`bcrypt`**: Password hashing.
-   **`multer`**: File upload handling.
-   **Tailwind CSS v4**: Styling framework.
-   **Electron**: Desktop application framework.
-   **`electron-builder`**: Electron app packaging.
-   **`auto-launch`**: Auto-launch for Electron apps.
-   **`electron-updater`**: Auto-updates for Electron apps.
-   **`electron-store`**: Data persistence for Electron apps.
-   **Google Fonts CDN**: For typography.
-   **Discord Webhook**: For server activity logging and monitoring.
-   **SendGrid**: For email integration (support tickets).