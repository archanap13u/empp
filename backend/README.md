# Employee Tracking System - Backend

Node.js/Express.js REST API for the Employee Tracking System.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: express-validator

## Installation

```bash
npm install
```

## Environment Configuration

Create a `.env` file:

```
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/employee_tracking
JWT_SECRET=your_secret_key_here_minimum_32_characters
JWT_EXPIRES_IN=24h
NODE_ENV=development
```

## Database Setup

Run migrations to create all tables:

```bash
npm run migrate
```

This will create 8 tables:
1. users
2. projects
3. daily_reports
4. report_edit_requests
5. project_access_requests
6. project_assignments
7. time_entries
8. location_history

## Running the Server

Development mode (with nodemon):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server will be available at http://localhost:5000

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
All endpoints except `/auth/register` and `/auth/login` require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Response Format
Success (200/201):
```json
{
  "data": { ... }
}
```

Error (4xx/5xx):
```json
{
  "error": "Error message"
}
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection pool
│   │   └── jwt.js               # JWT configuration
│   ├── middleware/
│   │   ├── auth.js              # JWT verification middleware
│   │   └── adminAuth.js         # Admin role check middleware
│   ├── routes/
│   │   ├── auth.js              # Authentication endpoints
│   │   ├── employees.js         # Employee management (admin)
│   │   ├── reports.js           # Daily reports
│   │   ├── reportEditRequests.js # Report edit requests
│   │   ├── projects.js          # Project management
│   │   ├── projectAccessRequests.js # Project access requests
│   │   ├── timeEntries.js       # Time tracking
│   │   ├── locations.js         # Location tracking
│   │   └── dashboard.js         # Dashboard statistics
│   ├── utils/
│   │   ├── validation.js        # Input validation helpers
│   │   └── dateHelpers.js       # Date utility functions
│   ├── migrations/
│   │   ├── 001_create_users_table.sql
│   │   ├── 002_create_projects_table.sql
│   │   ├── 003_create_daily_reports_table.sql
│   │   ├── 004_create_report_edit_requests_table.sql
│   │   ├── 005_create_project_access_requests_table.sql
│   │   ├── 006_create_project_assignments_table.sql
│   │   ├── 007_create_time_entries_table.sql
│   │   ├── 008_create_location_history_table.sql
│   │   └── runMigrations.js     # Migration runner script
│   ├── app.js                   # Express app setup
│   └── server.js                # Server startup
├── package.json
└── .env
```

## Key Features

### Authentication System
- First registered user automatically becomes admin
- JWT tokens with 24-hour expiry
- Bcrypt password hashing (10 rounds)
- Role-based access control

### Validation
- Email format validation
- Password strength requirements (min 8 chars, uppercase, lowercase, number)
- Input sanitization
- Data type validation

### Error Handling
- Centralized error handling middleware
- Descriptive error messages
- HTTP status codes
- Request logging

### Database
- Connection pooling for performance
- Parameterized queries (SQL injection prevention)
- Automatic timestamp updates
- Foreign key constraints
- Unique constraints

## Security Considerations

1. **Password Security**
   - Never log passwords
   - Hash with bcrypt before storage
   - Never return password hashes in responses

2. **JWT Security**
   - Signed tokens with secret key
   - Token expiry validation
   - Token verification on every protected request

3. **API Security**
   - CORS configuration
   - Input validation
   - Role-based authorization
   - Data access control (employees can only access own data)

4. **Database Security**
   - Parameterized queries
   - Connection string in environment variables
   - Proper error handling to prevent information leakage

## Testing

Health check endpoint:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-31T..."
}
```

## Troubleshooting

### Database Connection Errors
- Verify PostgreSQL is running
- Check DATABASE_URL in .env
- Ensure database exists
- Verify user permissions

### Port Already in Use
- Change PORT in .env
- Kill process using port 5000: `lsof -ti:5000 | xargs kill`

### Migration Errors
- Ensure database is empty or tables don't exist
- Check PostgreSQL user has CREATE permissions
- Run migrations again: `npm run migrate`

## Dependencies

Production:
- express: Web framework
- pg: PostgreSQL client
- bcrypt: Password hashing
- jsonwebtoken: JWT authentication
- cors: CORS middleware
- dotenv: Environment variables
- express-validator: Input validation

Development:
- nodemon: Auto-restart on file changes
