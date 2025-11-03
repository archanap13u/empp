const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const { getToday, isFutureDate, getDaysAgo, getMinutesDifference } = require('../utils/dateHelpers');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/time-entries - Get time entries with filters
router.get('/', async (req, res) => {
  try {
    const { user_id, project_id, start_date = getDaysAgo(7), end_date = getToday() } = req.query;

    let targetUserId = user_id;

    // If employee, force to own entries only
    if (req.user.role === 'employee') {
      targetUserId = req.user.id;
    }

    const params = [start_date, end_date];
    let whereClause = 'WHERE te.entry_date >= $1 AND te.entry_date <= $2';
    let paramCount = 3;

    if (targetUserId) {
      whereClause += ` AND te.user_id = $${paramCount}`;
      params.push(targetUserId);
      paramCount++;
    }

    if (project_id) {
      whereClause += ` AND te.project_id = $${paramCount}`;
      params.push(project_id);
      paramCount++;
    }

    const sql = `
      SELECT
        te.*,
        u.full_name as user_name,
        p.name as project_name
      FROM time_entries te
      JOIN users u ON te.user_id = u.id
      JOIN projects p ON te.project_id = p.id
      ${whereClause}
      ORDER BY te.entry_date DESC, te.created_at DESC
    `;

    const result = await query(sql, params);

    // Calculate totals
    const totalMinutes = result.rows.reduce((sum, entry) => sum + parseInt(entry.duration_minutes), 0);
    const totalHours = parseFloat((totalMinutes / 60).toFixed(2));

    res.json({
      entries: result.rows,
      total_hours: totalHours,
      total_entries: result.rows.length,
    });
  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/time-entries/start - Start timer
router.post('/start', async (req, res) => {
  try {
    const { project_id, task_description } = req.body;
    const user_id = req.user.id;

    if (!project_id || !task_description) {
      return res.status(400).json({ error: 'Project ID and task description are required' });
    }

    if (task_description.length > 500) {
      return res.status(400).json({ error: 'Task description must be 500 characters or less' });
    }

    // Verify user has access to project
    const accessCheck = await query(
      'SELECT id FROM project_assignments WHERE project_id = $1 AND user_id = $2',
      [project_id, user_id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    // Check for already running timer
    const existingTimer = await query(
      "SELECT id FROM time_entries WHERE user_id = $1 AND entry_type = 'timer' AND end_time IS NULL",
      [user_id]
    );

    if (existingTimer.rows.length > 0) {
      return res.status(400).json({ error: 'Timer already running. Please stop current timer first.' });
    }

    // Insert timer entry (duration will be 0 initially, calculated when stopped)
    const result = await query(
      `INSERT INTO time_entries (user_id, project_id, task_description, start_time, entry_type, entry_date, duration_minutes)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'timer', $4, 1)
       RETURNING *`,
      [user_id, project_id, task_description, getToday()]
    );

    const timer = result.rows[0];

    // Fetch project name
    const projectResult = await query('SELECT name FROM projects WHERE id = $1', [project_id]);

    res.status(201).json({
      timer: {
        ...timer,
        project_name: projectResult.rows[0].name,
      },
    });
  } catch (error) {
    console.error('Start timer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/time-entries/:id/stop - Stop timer
router.put('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Fetch timer entry
    const entryResult = await query('SELECT * FROM time_entries WHERE id = $1', [id]);

    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    const entry = entryResult.rows[0];

    // Verify ownership
    if (entry.user_id !== user_id) {
      return res.status(403).json({ error: 'Not your time entry' });
    }

    // Verify it's a timer entry
    if (entry.entry_type !== 'timer') {
      return res.status(400).json({ error: 'Not a timer entry' });
    }

    // Verify not already stopped
    if (entry.end_time) {
      return res.status(400).json({ error: 'Timer already stopped' });
    }

    // Calculate duration
    const now = new Date();
    const durationMinutes = getMinutesDifference(entry.start_time, now);

    // Update entry
    const result = await query(
      'UPDATE time_entries SET end_time = CURRENT_TIMESTAMP, duration_minutes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [durationMinutes, id]
    );

    const updatedEntry = result.rows[0];

    // Fetch project name
    const projectResult = await query('SELECT name FROM projects WHERE id = $1', [updatedEntry.project_id]);

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    res.json({
      entry: {
        ...updatedEntry,
        project_name: projectResult.rows[0].name,
        duration_formatted: `${hours} hours ${minutes} minutes`,
      },
    });
  } catch (error) {
    console.error('Stop timer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/time-entries/active - Get currently running timer
router.get('/active', async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await query(
      `SELECT te.*, p.name as project_name
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       WHERE te.user_id = $1 AND te.entry_type = 'timer' AND te.end_time IS NULL
       LIMIT 1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.json({ timer: null });
    }

    const timer = result.rows[0];

    // Calculate elapsed seconds
    const now = new Date();
    const startTime = new Date(timer.start_time);
    const elapsedSeconds = Math.floor((now - startTime) / 1000);

    res.json({
      timer: {
        ...timer,
        elapsed_seconds: elapsedSeconds,
      },
    });
  } catch (error) {
    console.error('Get active timer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/time-entries/manual - Add manual time entry
router.post('/manual', async (req, res) => {
  try {
    const { project_id, task_description, entry_date, duration_hours, duration_minutes } = req.body;
    const user_id = req.user.id;

    if (!project_id || !task_description || !entry_date) {
      return res.status(400).json({ error: 'Project ID, task description, and entry date are required' });
    }

    if (task_description.length > 500) {
      return res.status(400).json({ error: 'Task description must be 500 characters or less' });
    }

    // Validate date is not in future
    if (isFutureDate(entry_date)) {
      return res.status(400).json({ error: 'Cannot log time for future dates' });
    }

    // Validate duration
    const hours = parseFloat(duration_hours) || 0;
    const minutes = parseFloat(duration_minutes) || 0;

    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
      return res.status(400).json({ error: 'Invalid duration values' });
    }

    const totalMinutes = Math.floor(hours * 60 + minutes);

    if (totalMinutes < 1) {
      return res.status(400).json({ error: 'Duration must be at least 1 minute' });
    }

    if (totalMinutes > 1440) {
      return res.status(400).json({ error: 'Duration cannot exceed 24 hours (1440 minutes)' });
    }

    // Verify user has access to project
    const accessCheck = await query(
      'SELECT id FROM project_assignments WHERE project_id = $1 AND user_id = $2',
      [project_id, user_id]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    // Insert manual entry
    const result = await query(
      `INSERT INTO time_entries (user_id, project_id, task_description, entry_type, entry_date, duration_minutes)
       VALUES ($1, $2, $3, 'manual', $4, $5)
       RETURNING *`,
      [user_id, project_id, task_description, entry_date, totalMinutes]
    );

    const entry = result.rows[0];

    // Fetch project name
    const projectResult = await query('SELECT name FROM projects WHERE id = $1', [project_id]);

    const durationHours = Math.floor(totalMinutes / 60);
    const durationMins = totalMinutes % 60;

    res.status(201).json({
      entry: {
        ...entry,
        project_name: projectResult.rows[0].name,
        duration_formatted: `${durationHours} hours ${durationMins} minutes`,
      },
    });
  } catch (error) {
    console.error('Add manual entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
