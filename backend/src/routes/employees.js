const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { isValidEmail, isValidPassword, getPasswordRequirements, isValidFullName } = require('../utils/validation');

const router = express.Router();

// All routes require admin authentication
router.use(auth, adminAuth);

// GET /api/employees - Get all employees with filters
router.get('/', async (req, res) => {
  try {
    const { status = 'active', search = '' } = req.query;

    let whereClause = [];
    let params = [];
    let paramCount = 1;

    // Status filter
    if (status === 'active') {
      whereClause.push(`is_active = true`);
    } else if (status === 'inactive') {
      whereClause.push(`is_active = false`);
    }
    // 'all' means no filter

    // Search filter (name or email)
    if (search) {
      params.push(`%${search}%`);
      whereClause.push(`(full_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
      paramCount++;
    }

    const whereSQL = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

    const sql = `
      SELECT
        u.id, u.email, u.full_name, u.role, u.is_active, u.created_at,
        (
          SELECT MAX(GREATEST(lh.timestamp, te.created_at))
          FROM (
            SELECT MAX(timestamp) as timestamp FROM location_history WHERE user_id = u.id
            UNION ALL
            SELECT MAX(created_at) FROM time_entries WHERE user_id = u.id
          ) as combined(timestamp)
        ) as last_active
      FROM users u
      ${whereSQL}
      ORDER BY u.created_at DESC
    `;

    const result = await query(sql, params);

    res.json({ employees: result.rows });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/employees/:id - Get detailed employee information
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch employee basic info
    const employeeResult = await query(
      'SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id = $1',
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Calculate statistics
    const today = new Date().toISOString().split('T')[0];
    const startOfWeek = getStartOfWeek();
    const startOfMonth = getStartOfMonth();

    // Hours today
    const hoursToday = await query(
      'SELECT COALESCE(SUM(duration_minutes), 0) as total FROM time_entries WHERE user_id = $1 AND entry_date = $2',
      [id, today]
    );

    // Hours this week
    const hoursWeek = await query(
      'SELECT COALESCE(SUM(duration_minutes), 0) as total FROM time_entries WHERE user_id = $1 AND entry_date >= $2',
      [id, startOfWeek]
    );

    // Hours this month
    const hoursMonth = await query(
      'SELECT COALESCE(SUM(duration_minutes), 0) as total FROM time_entries WHERE user_id = $1 AND entry_date >= $2',
      [id, startOfMonth]
    );

    // Active projects count
    const activeProjects = await query(
      'SELECT COUNT(*) as count FROM project_assignments pa JOIN projects p ON pa.project_id = p.id WHERE pa.user_id = $1 AND p.status = $2',
      [id, 'active']
    );

    // Latest location
    const latestLocation = await query(
      'SELECT latitude, longitude, timestamp, status FROM location_history WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [id]
    );

    // Recent reports (last 7)
    const recentReports = await query(
      'SELECT id, report_date, hours_worked, created_at FROM daily_reports WHERE user_id = $1 ORDER BY report_date DESC LIMIT 7',
      [id]
    );

    // Recent time entries (last 10)
    const recentTimeEntries = await query(
      `SELECT te.id, te.task_description, te.duration_minutes, te.entry_type, te.entry_date, te.created_at,
              p.name as project_name
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       WHERE te.user_id = $1
       ORDER BY te.created_at DESC
       LIMIT 10`,
      [id]
    );

    // Assigned projects
    const assignedProjects = await query(
      `SELECT p.id, p.name, p.status, pa.assigned_at
       FROM project_assignments pa
       JOIN projects p ON pa.project_id = p.id
       WHERE pa.user_id = $1
       ORDER BY pa.assigned_at DESC`,
      [id]
    );

    res.json({
      employee: {
        ...employee,
        stats: {
          hours_today: parseFloat((hoursToday.rows[0].total / 60).toFixed(2)),
          hours_this_week: parseFloat((hoursWeek.rows[0].total / 60).toFixed(2)),
          hours_this_month: parseFloat((hoursMonth.rows[0].total / 60).toFixed(2)),
          active_projects: parseInt(activeProjects.rows[0].count),
        },
        current_location: latestLocation.rows[0] || null,
        recent_reports: recentReports.rows,
        recent_time_entries: recentTimeEntries.rows,
        assigned_projects: assignedProjects.rows,
      },
    });
  } catch (error) {
    console.error('Get employee details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions for date calculations
function getStartOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

function getStartOfMonth() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().split('T')[0];
}

// POST /api/employees - Create new employee
router.post('/', async (req, res) => {
  try {
    const { email, password, full_name, role = 'employee', is_active = true } = req.body;

    // Validate email
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password
    if (!password || !isValidPassword(password)) {
      return res.status(400).json({ error: getPasswordRequirements() });
    }

    // Validate full name
    if (!full_name || !isValidFullName(full_name)) {
      return res.status(400).json({ error: 'Full name must be between 2 and 255 characters' });
    }

    // Validate role
    if (role !== 'admin' && role !== 'employee') {
      return res.status(400).json({ error: 'Role must be either admin or employee' });
    }

    // Check email uniqueness
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert employee
    const result = await query(
      'INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, is_active, created_at',
      [email.toLowerCase(), password_hash, full_name.trim(), role, is_active]
    );

    res.status(201).json({ employee: result.rows[0] });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/employees/:id - Update employee
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, full_name, role, is_active } = req.body;

    // Fetch existing employee
    const existingEmployee = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingEmployee.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const updates = [];
    const params = [];
    let paramCount = 1;

    // Update email if provided
    if (email !== undefined) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check uniqueness (exclude current user)
      const emailCheck = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), id]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      updates.push(`email = $${paramCount}`);
      params.push(email.toLowerCase());
      paramCount++;
    }

    // Update password if provided
    if (password !== undefined) {
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: getPasswordRequirements() });
      }

      const password_hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCount}`);
      params.push(password_hash);
      paramCount++;
    }

    // Update full name if provided
    if (full_name !== undefined) {
      if (!isValidFullName(full_name)) {
        return res.status(400).json({ error: 'Full name must be between 2 and 255 characters' });
      }

      updates.push(`full_name = $${paramCount}`);
      params.push(full_name.trim());
      paramCount++;
    }

    // Update role if provided
    if (role !== undefined) {
      if (role !== 'admin' && role !== 'employee') {
        return res.status(400).json({ error: 'Role must be either admin or employee' });
      }

      updates.push(`role = $${paramCount}`);
      params.push(role);
      paramCount++;
    }

    // Update is_active if provided
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      params.push(is_active);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add id parameter
    params.push(id);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, email, full_name, role, is_active, updated_at`;

    const result = await query(sql, params);

    res.json({ employee: result.rows[0] });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/employees/:id - Archive employee (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if trying to archive self
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot archive your own account' });
    }

    // Fetch employee
    const employeeResult = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Set is_active to false
    await query('UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    res.json({ message: 'Employee archived successfully' });
  } catch (error) {
    console.error('Archive employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
