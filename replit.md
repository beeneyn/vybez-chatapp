# Vybez Chat App

## Overview
Vybez is a real-time chat application built with Node.js, Express, and Socket.IO, offering a full-featured chatroom experience. Key capabilities include user authentication, custom chat rooms, private messaging, file sharing, and a responsive interface. It also provides a robust Electron desktop client, available at https://www.vybez.page. The project aims to be a comprehensive and modern chat solution, serving as a learning platform for Node.js development.

## User Preferences
I prefer detailed explanations and an iterative development approach. Ask before making major changes. Do not make changes to files within the `sessions/` directory.

## System Architecture

### UI/UX Decisions
The application features a "Neon Nightlife" aesthetic with a "BREAK FREE" slogan. The color palette includes Midnight, Deep Violet, Electric Magenta, Cyber Cyan, and Warm accent. Typography uses Space Grotesk (headings) and Inter (body). The design incorporates glassmorphism, gradients, a unified 4-column footer, and a custom modal system, all built with Tailwind CSS v4.

### Technical Implementations
Vybez is a Node.js application using Express.js for the backend and Socket.IO for real-time communication. User authentication uses bcrypt for password hashing and `express-session` for session management with a file-based store (planned migration to Replit Key-Value storage). PostgreSQL, hosted on Replit's Neon database, is the primary data store. The frontend uses vanilla JavaScript and Tailwind CSS v4.

**Key Features:**
-   **User Authentication & Guest Demo:** Secure login/signup and a read-only guest mode.
-   **Discord-Style Settings:** Full-page settings for Appearance, Profile, Account, Privacy & Safety, and Advanced options.
-   **Custom Chat Rooms:** User-creatable and deletable rooms with real-time updates.
-   **Real-time Messaging:** Instant messages, history, typing indicators, reactions, @mentions (with notifications), and message deletion.
-   **Support Ticket System:** Users can submit priority-based tickets; admins can manage and respond. Includes SendGrid integration for email notifications.
-   **Developer Portal:** API management system with API key creation, scopes, tiered rate limiting, API logs, and built-in documentation.
-   **Admin Panel:** Comprehensive dashboard for live stats, user management (including deletion), moderation (warnings, mutes, bans with evidence tracking), room management, message logs, file tracking, support ticket management, API/Server logs, and maintenance mode toggle.
-   **Logging System:** Structured server logging (Winston) to console and database, with category-based server logs and automatic API request tracking.
-   **User Profiles:** Customizable avatars, bios, status, and chat colors.
-   **File Sharing:** Uploads up to 10MB with secure filenames and image previews.
-   **Private Messaging:** Direct messages with notifications and read receipts.
-   **Message Search:** Search functionality for message history.
-   **User Roles:** Admin and standard user permission system.
-   **Moderation System:** Three-tier enforcement (warnings, mutes, bans) with evidence tracking, real-time enforcement, and dedicated management pages.
-   **Custom Error Pages:** Branded 404 (Page Not Found) and 401 (Access Denied) pages with Neon Nightlife aesthetic, glassmorphism design, animated floating shapes, and helpful navigation buttons.
-   **Electron Desktop Client:** Offers desktop notifications, system tray integration, badge counts, global shortcuts, native dark mode, offline detection, auto-updater, auto-launch, native file picker, and secure IPC.

### System Design Choices
The application separates server-side logic (`index.js`, `database.js`), client-side logic (`public/client.js`), and Electron components. The main server file is `index.js` with `server.js` as a symbolic link for deployment compatibility. Database interactions use `pg` for PostgreSQL. A file-based session store manages user sessions (migrating to Replit key-value store). Frontend styles are compiled with `@tailwindcss/cli`. Database schema uses username-based relationships with transactional integrity for user actions. Custom error handling middleware serves branded 404 and 401 pages while preserving API JSON responses.

## External Dependencies
-   **Node.js**: Backend runtime.
-   **Express.js**: Web application framework.
-   **Socket.IO**: Real-time communication.
-   **PostgreSQL**: Relational database (Replit managed Neon database).
-   **`pg`**: PostgreSQL client.
-   **`express-session`**: Session management middleware.
-   **`session-file-store`**: File system session store (planned migration).
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