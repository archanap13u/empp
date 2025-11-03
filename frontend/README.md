# Employee Tracking System - Frontend

React-based frontend application for the Employee Tracking System.

## Tech Stack

- **Framework**: React 18
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios
- **Maps**: Leaflet + React-Leaflet
- **Build Tool**: Create React App

## Installation

```bash
npm install
```

## Environment Configuration

Create a `.env` file:

```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_MAP_TILES_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

## Running the Application

Development mode:
```bash
npm start
```

Build for production:
```bash
npm run build
```

Application will be available at http://localhost:3000

## Project Structure

```
frontend/
├── public/
│   └── index.html           # HTML template
├── src/
│   ├── components/          # Reusable components
│   │   ├── common/         # Shared components
│   │   ├── admin/          # Admin-specific components
│   │   └── employee/       # Employee-specific components
│   ├── contexts/
│   │   └── AuthContext.jsx # Authentication context
│   ├── services/
│   │   └── api.js          # Axios instance and API functions
│   ├── pages/
│   │   ├── Login.jsx       # Login page
│   │   ├── Register.jsx    # Registration page
│   │   ├── admin/
│   │   │   └── AdminDashboard.jsx    # Admin dashboard
│   │   └── employee/
│   │       └── EmployeeDashboard.jsx # Employee dashboard
│   ├── App.jsx             # Main app component
│   └── index.js            # Entry point
├── package.json
└── .env
```

## Features

### Authentication
- Login/Register forms
- JWT token storage in localStorage
- Automatic token injection in API requests
- Token expiry handling
- Role-based routing

### Admin Dashboard
- **Overview**: Statistics cards and recent activity
- **Employees**: View and manage all employees
- **Reports**: View all employee daily reports
- **Projects**: Create and manage projects
- **Access Requests**: Approve/reject project access requests

### Employee Dashboard
- **Overview**: Personal statistics and active timer
- **Submit Report**: Daily report submission form
- **My Reports**: View report history
- **Time Tracking**: Start/stop timer, manual entries
- **Projects**: Request access to projects

## API Integration

### API Service (`src/services/api.js`)

Axios instance with:
- Base URL configuration
- JWT token interceptor
- Error handling interceptor
- Organized API methods by domain

Example usage:
```javascript
import { reportAPI } from '../services/api';

// Submit report
const response = await reportAPI.create({
  tasks_completed: ['Task 1', 'Task 2'],
  hours_worked: 8,
  notes: 'Great day'
});
```

### Authentication Context

Global authentication state management:
```javascript
const { user, login, logout, isAdmin, isEmployee } = useAuth();
```

## Routing

Protected routes based on authentication and role:
- `/login` - Login page (public)
- `/register` - Registration page (public)
- `/admin/*` - Admin dashboard (admin only)
- `/employee/*` - Employee dashboard (authenticated users)

## Styling

Inline styles using JavaScript objects for simplicity. Key style patterns:

- **Colors**:
  - Admin: Blue (#007bff)
  - Employee: Green (#28a745)
  - Success: Green (#28a745)
  - Error: Red (#dc3545)

- **Layout**:
  - Flexbox for responsive layouts
  - Grid for statistics cards
  - Sidebar navigation

## State Management

- **React Context**: Authentication state
- **Local State**: Component-specific data
- **useEffect**: Data fetching on mount
- **localStorage**: Token persistence

## Error Handling

1. **API Errors**:
   - Caught in try/catch blocks
   - Displayed to user via alerts or messages
   - 401 errors redirect to login

2. **Form Validation**:
   - HTML5 validation attributes
   - Custom validation messages
   - Disabled submit during processing

## Key Components

### Protected Route
```javascript
<ProtectedRoute requireAdmin={true}>
  <AdminDashboard />
</ProtectedRoute>
```

### Auth Context Usage
```javascript
const { user, login } = useAuth();

const handleLogin = async (e) => {
  const result = await login(email, password);
  if (!result.success) {
    // Handle error
  }
};
```

## Browser Requirements

- Modern browsers with ES6+ support
- JavaScript enabled
- LocalStorage enabled
- Geolocation API for location tracking

## Development Tips

1. **API Connection**:
   - Ensure backend is running on port 5000
   - Check REACT_APP_API_URL in .env

2. **Authentication**:
   - Token stored in localStorage after login
   - Cleared on logout or 401 errors
   - Check browser console for auth errors

3. **Debugging**:
   - Open browser DevTools
   - Check Network tab for API calls
   - Check Console for errors
   - Check Application tab for localStorage

## Build and Deployment

1. Create production build:
```bash
npm run build
```

2. Build output in `build/` directory

3. Serve static files:
```bash
npx serve -s build
```

4. Deploy to hosting service (Netlify, Vercel, etc.)

## Environment Variables

Required:
- `REACT_APP_API_URL`: Backend API base URL
- `REACT_APP_MAP_TILES_URL`: OpenStreetMap tiles URL

Optional:
- Additional configuration as needed

## Troubleshooting

### API Connection Failed
- Verify backend is running
- Check REACT_APP_API_URL
- Check CORS settings in backend
- Inspect Network tab in DevTools

### Login Not Working
- Check credentials
- Verify backend /api/auth/login endpoint
- Check browser console for errors
- Clear localStorage if token is corrupted

### Components Not Rendering
- Check React DevTools
- Verify route configuration
- Check authentication state
- Look for console errors

## Dependencies

Main:
- react: UI library
- react-dom: React DOM renderer
- react-router-dom: Routing
- axios: HTTP client
- leaflet: Maps library
- react-leaflet: React wrapper for Leaflet

Dev:
- react-scripts: Build tooling
