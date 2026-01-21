# Guard Training Support System (경비원 교육 지원 시스템)

## Overview

This is a Korean-language training management system for security guards. The application provides card-based educational materials and video learning management for two companies: Mirae ABM (미래에이비엠) and Dawon PMC (다원PMC). It features role-based access with separate dashboards for administrators and guards, training record tracking, site management, and a notification system for new training materials.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Form Handling**: React Hook Form with Zod validation
- **File Uploads**: Uppy with AWS S3 presigned URL integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx for development, esbuild for production
- **API Design**: REST API with JSON request/response format
- **Session Management**: express-session with cookie-based authentication
- **Build System**: Vite for frontend, custom esbuild script for backend bundling

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Managed via `drizzle-kit push` command
- **Object Storage**: Google Cloud Storage via Replit's sidecar integration for file uploads

### Authentication & Authorization
- **Pattern**: Session-based authentication with role-based access control
- **Roles**: Two user roles - "admin" and "guard"
- **Login**: Single unified login form - role is auto-detected based on username
  - Admin: username "관리자" / password "admin123"
  - Guard: username is their name / password is last 4 digits of phone
- **Middleware**: Custom `isAuthenticated` and `isAdmin` middleware functions
- **Session Storage**: Cookie-based with configurable secure settings for production

### Database Schema
Key entities include:
- **users**: Guards and admins with company affiliation and site assignment
- **sites**: Physical locations managed by the two companies
- **trainingMaterials**: Educational content (card images or video URLs)
- **trainingRecords**: Completion tracking linking guards to materials
- **notifications**: Alert system for new training materials

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/   # UI components including shadcn/ui
│       ├── pages/        # Route pages (login, admin/*, guard/*)
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities, auth context, query client
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database access layer
│   └── replit_integrations/  # Object storage integration
├── shared/           # Shared code between client and server
│   └── schema.ts     # Drizzle schema and Zod validation
└── migrations/       # Database migration files
```

## External Dependencies

### Database
- PostgreSQL database (required via DATABASE_URL environment variable)
- Drizzle ORM for type-safe database access

### Object Storage
- Google Cloud Storage via Replit sidecar (localhost:1106)
- Used for uploading training material images and videos
- Presigned URL pattern for direct client uploads

### UI Libraries
- Full shadcn/ui component set (40+ Radix-based components)
- Lucide React for icons
- Embla Carousel for carousel components
- Recharts for data visualization

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `SESSION_SECRET`: Session encryption key (defaults provided for development)
- `PUBLIC_OBJECT_SEARCH_PATHS`: Object storage access paths