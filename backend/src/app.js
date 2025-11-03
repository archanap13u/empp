const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const reportRoutes = require('./routes/reports');
const reportEditRequestRoutes = require('./routes/reportEditRequests');
const projectRoutes = require('./routes/projects');
const projectAccessRequestRoutes = require('./routes/projectAccessRequests');
const timeEntryRoutes = require('./routes/timeEntries');
const locationRoutes = require('./routes/locations');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/report-edit-requests', reportEditRequestRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/project-access-requests', projectAccessRequestRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
