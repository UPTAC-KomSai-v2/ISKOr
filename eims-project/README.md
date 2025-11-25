# ExamFlow - Exam Information Management System (EIMS)

A full-stack networked application demonstrating core Data Communication and Networking (DCN) concepts for managing university examinations.

## 🎯 Project Overview

ExamFlow is designed for UP Tacloban's exam management needs with three user roles:
- **Admin**: System configuration, user management, audit logs
- **Faculty**: Create/schedule exams, publish results, handle regrade requests
- **Student**: View exams, receive announcements, submit requests

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React + Vite)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Admin UI  │  │  Faculty UI │  │      Student UI         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │               │                     │                  │
│         └───────────────┴─────────────────────┘                  │
│                         │                                        │
│              WebSocket + REST API Client                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS / WSS
┌─────────────────────────┴───────────────────────────────────────┐
│                    SERVER (Node.js + Express)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  REST API   │  │  WebSocket  │  │    Auth Middleware      │  │
│  │  /api/v1/*  │  │   Server    │  │    (JWT + RBAC)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │               │                     │                  │
│         └───────────────┴─────────────────────┘                  │
│                         │                                        │
│              ┌──────────┴──────────┐                            │
│              │   SQLite Database   │                            │
│              │   (with Prisma ORM) │                            │
│              └─────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Tech Stack Justification (DCN Principles)

| Component | Choice | DCN Justification |
|-----------|--------|-------------------|
| Transport | HTTPS + WSS | TLS 1.3 for transport security, reliable TCP delivery |
| Real-time | WebSocket | Full-duplex communication for live notifications, lower latency than polling |
| API Style | REST + JSON | Stateless, cacheable, uniform interface for scalability |
| Auth | JWT + bcrypt | Stateless tokens reduce server load, secure password hashing |
| Database | SQLite + Prisma | ACID compliance, easy backup, type-safe queries |
| Serialization | JSON | Human-readable, wide support, schema via TypeScript |

## 📁 Project Structure

```
eims-project/
├── server/                 # Backend Node.js application
│   ├── src/
│   │   ├── index.ts       # Entry point
│   │   ├── config/        # Configuration
│   │   ├── routes/        # API routes
│   │   ├── controllers/   # Business logic
│   │   ├── middleware/    # Auth, validation, logging
│   │   ├── services/      # WebSocket, notifications
│   │   ├── prisma/        # Database schema
│   │   └── utils/         # Helpers
│   ├── package.json
│   └── tsconfig.json
│
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── main.tsx       # Entry point
│   │   ├── App.tsx        # Root component
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks (WebSocket, Auth)
│   │   ├── services/      # API client
│   │   ├── store/         # State management
│   │   └── types/         # TypeScript types
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                   # Documentation
│   ├── api/               # OpenAPI specs
│   └── deployment/        # Deployment guide
│
└── README.md
```

## 🚀 Step-by-Step Implementation Guide (VS Code)

### Prerequisites

1. **Install Node.js** (v18 or higher): https://nodejs.org/
2. **Install VS Code**: https://code.visualstudio.com/
3. **Install VS Code Extensions**:
   - ESLint
   - Prettier
   - Prisma
   - Thunder Client (API testing)
   - ES7+ React/Redux/React-Native snippets

### Step 1: Clone/Setup Project

```bash
# Navigate to your projects folder
cd ~/projects  # or wherever you keep projects

# Copy the eims-project folder (if provided) or create from scratch
# If starting fresh:
mkdir eims-project
cd eims-project
```

### Step 2: Setup Backend Server

```bash
# Navigate to server folder
cd server

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Seed initial data
npx prisma db seed

# Start development server
npm run dev
```

The server will start on `http://localhost:3001`

### Step 3: Setup Frontend Client

```bash
# Open new terminal, navigate to client folder
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

The client will start on `http://localhost:5173`

### Step 4: Access the Application

1. Open `http://localhost:5173` in your browser
2. Login with test credentials:
   - **Admin**: admin@up.edu.ph / admin123
   - **Faculty**: faculty@up.edu.ph / faculty123
   - **Student**: student@up.edu.ph / student123

## 🔌 API Endpoints (Public API)

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token

### Students
- `GET /api/v1/students` - List students (paginated)
- `GET /api/v1/students/:id` - Get student details
- `POST /api/v1/students/sync` - Sync from parent app

### Exams
- `GET /api/v1/exams` - List exams
- `POST /api/v1/exams` - Create exam
- `GET /api/v1/exams/:id` - Get exam details
- `PUT /api/v1/exams/:id` - Update exam
- `DELETE /api/v1/exams/:id` - Delete exam

### Schedules
- `GET /api/v1/schedules` - List schedules
- `POST /api/v1/schedules` - Create schedule
- `GET /api/v1/schedules/:examId` - Get schedules for exam

### Announcements
- `GET /api/v1/announcements` - List announcements
- `POST /api/v1/announcements` - Create announcement (triggers WebSocket)
- `PUT /api/v1/announcements/:id` - Update announcement

### Results
- `GET /api/v1/results` - List results (role-filtered)
- `POST /api/v1/results` - Publish results
- `POST /api/v1/results/:id/regrade` - Request regrade

## 🔔 WebSocket Events

### Client → Server
- `subscribe:exam` - Subscribe to exam updates
- `subscribe:announcements` - Subscribe to announcements
- `acknowledge:notification` - ACK for reliable delivery

### Server → Client
- `announcement:new` - New announcement
- `schedule:update` - Schedule changed
- `result:published` - Results available
- `notification:retry` - Retry unacknowledged messages

## 📊 DCN Features Demonstrated

1. **Transport Layer**: TLS encryption, TCP reliability
2. **Application Layer**: HTTP/1.1 with keep-alive, WebSocket upgrade
3. **Reliable Delivery**: ACK/retry with exponential backoff
4. **Concurrency**: Event-driven Node.js, connection pooling
5. **Security**: JWT auth, RBAC, input validation, CORS
6. **Scalability**: Stateless design, database indexing

## 🧪 Testing

```bash
# Run backend tests
cd server && npm test

# Run frontend tests
cd client && npm test

# Run E2E tests
npm run test:e2e
```

## 📝 License

Educational use for CMSC 135 - Data Communication and Networking
