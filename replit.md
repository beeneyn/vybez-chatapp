# Vybez Chat App

## Overview
Vybez is a real-time chat application built with Node.js, Express, and Socket.IO, offering a full-featured chatroom experience. Key capabilities include user authentication, custom chat rooms, private messaging, file sharing, and a responsive interface. It also provides a robust Electron desktop client, available at https://www.vybez.page. The project aims to be a comprehensive and modern chat solution, serving as a learning platform for Node.js development.

## User Preferences
I prefer detailed explanations and an iterative development approach. Ask before making major changes. Do not make changes to files within the `sessions/` directory.

## System Architecture

### UI/UX Decisions
The application features a "Neon Nightlife" aesthetic with a "BREAK FREE" slogan. The color palette includes Midnight, Deep Violet, Electric Magenta, Cyber Cyan, and Warm accent. Typography uses Space Grotesk (headings) and Inter (body). The design incorporates glassmorphism, gradients, a unified 4-column footer, and a custom modal system, all built with Tailwind CSS v4. **Dark theme is the default theme** for new users, with a light theme option available in settings. The settings sidebar and all UI elements dynamically change colors based on the selected theme.

### Technical Implementations
Vybez is a Node.js application using Express.js for the backend and Socket.IO for real-time communication. User authentication uses bcrypt for password hashing and `express-session` for session management with a file-based store (planned migration to Replit Key-Value storage). PostgreSQL, hosted on Replit's Neon database, is the primary data store. The frontend uses vanilla JavaScript and Tailwind CSS v4.

**Key Features:**
-   **User Authentication & Guest Demo:** Secure login/signup and a read-only guest mode.
-   **Discord-Style Settings:** Full-page settings for Appearance, Profile, Account, Privacy & Safety, and Advanced options.
-   **Custom Chat Rooms:** User-creatable and deletable rooms with real-time updates.
-   **Real-time Messaging:** Instant messages, history, typing indicators, reactions, @mentions (with notifications), and message deletion.
-   **Discord-Style Members List:** Shows all registered users with online users sorted to the top. Online users have a green status indicator, offline users are dimmed with a gray indicator.
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

## Vybez 2.0 Roadmap

### Vision
Vybez 2.0 will be a complete architectural overhaul, modernizing the entire stack with React, TypeScript, and introducing native mobile apps. The goal is to improve maintainability, developer experience, performance, and expand platform support while preserving the Neon Nightlife aesthetic and all existing features.

### Target Release
Q2-Q3 2026 (Major Version)

### Technology Stack Upgrade

#### **Frontend (Web)**
-   **React 18+** with TypeScript - Component-based architecture with type safety
-   **Vite** - Lightning-fast build tooling and dev server
-   **React Router v6** - Client-side routing
-   **Redux Toolkit** - Centralized state management (SELECTED)
-   **TanStack Query (React Query)** - Server state management and caching
-   **Socket.IO Client** - Real-time WebSocket connection
-   **Tailwind CSS v4** - Keep existing design system
-   **Framer Motion** - Smooth animations and transitions
-   **React Hook Form + Zod** - Form validation with type safety
-   **Radix UI** or **Headless UI** - Accessible component primitives

#### **Mobile Apps (Android Priority, iOS Later)**
-   **React Native** with TypeScript - Code sharing with web app
-   **Expo** - Managed workflow for easier development and OTA updates
-   **Expo Router** - File-based routing for mobile
-   **React Native Paper** - Material Design components (themed to Neon Nightlife)
-   **Push Notifications** - Expo Notifications API
-   **Offline Support** - AsyncStorage + background sync
-   **Native Features** - Camera, contacts, biometric auth
-   **Platform Priority**: Android first (existing Play Console account), iOS later (Apple Developer Program $99/year)

#### **Backend**
-   **Node.js + TypeScript** - Fully typed backend
-   **Express.js** - Keep existing framework knowledge
-   **tRPC** (Optional) - End-to-end type-safe API alternative to REST
-   **Socket.IO Server** - Real-time communication
-   **Drizzle ORM** - Already using, keep for type-safe database queries
-   **PostgreSQL** - Keep existing database
-   **Redis** - Session storage, caching, and rate limiting
-   **BullMQ** - Background job processing (email sending, notifications)
-   **Helmet** - Security headers
-   **Compression** - Response compression
-   **Winston** - Keep existing logging system

#### **File Storage**
-   **AWS S3** - Cloud object storage for files/avatars (SELECTED)
-   Replace local file system storage for better scalability
-   S3 bucket configuration with CloudFront CDN for fast global delivery

#### **Authentication**
-   **JWT with Refresh Tokens** - More scalable than sessions
-   **OAuth 2.0** - Discord, Google, GitHub login options
-   **Two-Factor Authentication (2FA)** - TOTP support

#### **Monorepo Structure**
-   **Turborepo** - Monorepo management with blazing fast builds (SELECTED)
-   **pnpm** - Fast, disk space efficient package manager
    ```
    /packages
      /web           - React web app
      /mobile        - React Native app (Android priority)
      /server        - Node.js backend
      /shared        - Shared types, utilities, schemas
      /ui-components - Shared UI components
    ```

#### **DevOps & Infrastructure**
-   **Docker** - Development environment consistency
-   **GitHub Actions** - CI/CD pipelines
-   **Vitest** - Unit testing (Vite-native)
-   **Playwright** - E2E testing
-   **ESLint + Prettier** - Code quality and formatting
-   **Husky + lint-staged** - Pre-commit hooks

### New Features for 2.0
-   **Mobile Push Notifications** - Real-time alerts on mobile
-   **Offline Mode** - Message queue for offline use

### Features Already Planned for Earlier Updates
-   **Custom Emojis** - Coming in v1.2 update
-   **Role Permissions System** - Coming in v1.2 update
-   **Bot Support/API** - Coming in v1.3 update
-   **Voice Channels & Video Calls** - Coming in v1.5 update (WebRTC-based)
-   **Screen Sharing** - Coming in v1.5 update
-   **Rich Message Embeds** - Coming in v1.6 update
-   **Message Threading** - Coming in v1.7 update
-   **Server Boost System** - Coming in v1.8 update
-   **Webhooks** - Coming in v1.9 update
-   **End-to-End Encryption (E2EE)** - Part of PM (Private Messaging) overhaul

### Migration Strategy
1. **Phase 1**: Build 2.0 in parallel, maintain 1.0
2. **Phase 2**: Beta release with opt-in for testing
3. **Phase 3**: Data migration tools and scripts
4. **Phase 4**: Gradual rollout with feature parity
5. **Phase 5**: Deprecate 1.0, full 2.0 launch

### Backward Compatibility
-   Database schema migration scripts
-   API versioning (v1 and v2 endpoints)
-   Data export/import tools
-   User notification and migration guides

### Design Consistency
-   Preserve **Neon Nightlife** aesthetic across all platforms
-   Maintain **BREAK FREE** branding
-   Responsive design system for web, mobile, and desktop
-   Consistent animations and interactions
-   Dark theme remains default

### Performance Goals
-   **First Contentful Paint (FCP)**: < 1.5s
-   **Time to Interactive (TTI)**: < 3.5s
-   **Lighthouse Score**: 90+ on all metrics
-   **Mobile App Size**: < 50MB
-   **Real-time Latency**: < 100ms for messages

### Success Metrics
-   95% feature parity with 1.0 at launch
-   50% reduction in bundle size
-   100% TypeScript coverage
-   90%+ code test coverage
-   Support for iOS 14+, Android 10+
-   App Store and Google Play approval