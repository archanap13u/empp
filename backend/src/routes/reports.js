const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const { getToday, isFutureDate, getDaysAgo } = require('../utils/dateHelpers');
const { isValidHours } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

// POST /api/reports - Submit daily report
router.post('/', async (req, res) => {
  try {
    const { report_date = getToday(), tasks_completed, hours_worked, notes = null } = req.body;
    const user_id = req.user.id;

    // Validate report_date is not in future
    if (isFutureDate(report_date)) {
      return res.status(400).json({ error: 'Cannot submit report for future dates' });
    }

    // Validate tasks_completed
    if (!tasks_completed || !Array.isArray(tasks_completed) || tasks_completed.length === 0) {
      return res.status(400).json({ error: 'At least one task is required' });
    }

    // Check individual task length
    for (const task of tasks_completed) {
      if (typeof task !== 'string' || task.trim().length === 0) {
        return res.status(400).json({ error: 'All tasks must be non-empty strings' });
      }
      if (task.length > 500) {
        return res.status(400).json({ error: 'Each task must be 500 characters or less' });
      }
    }

    // Validate hours_worked
    if (!hours_worked || !isValidHours(hours_worked)) {
      return res.status(400).json({ error: 'Hours worked must be between 0.1 and 24' });
    }

    // Validate notes length
    if (notes && notes.length > 1000) {
      return res.status(400).json({ error: 'Notes must be 1000 characters or less' });
    }

    // Check if report already exists for this date
    const existingReport = await query(
      'SELECT id FROM daily_reports WHERE user_id = $1 AND report_date = $2',
      [user_id, report_date]
    );

    if (existingReport.rows.length > 0) {
      return res.status(400).json({ error: 'Report already exists for this date' });
    }

    // Store tasks as JSON string
    const tasksJson = JSON.stringify(tasks_completed);

    // Insert report
    const result = await query(
      'INSERT INTO daily_reports (user_id, report_date, tasks_completed, hours_worked, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, report_date, tasksJson, hours_worked, notes]
    );

    const report = result.rows[0];
    report.tasks_completed = JSON.parse(report.tasks_completed);

    res.status(201).json({ report });
  } catch (error) {
    console.error('Submit report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports - Get reports with filters
router.get('/', async (req, res) => {
  try {
    const { user_id, start_date = getDaysAgo(7), end_date = getToday() } = req.query;

    let targetUserId = user_id;

    // If employee, force to own reports only
    if (req.user.role === 'employee') {
      targetUserId = req.user.id;
    }

    const params = [start_date, end_date];
    let whereClause = 'WHERE dr.report_date >= $1 AND dr.report_date <= $2';

    if (targetUserId) {
      params.push(targetUserId);
      whereClause += ` AND dr.user_id = $${params.length}`;
    }

    const sql = `
      SELECT
        dr.*,
        u.full_name as user_name
      FROM daily_reports dr
      JOIN users u ON dr.user_id = u.id
      ${whereClause}
      ORDER BY dr.report_date DESC, dr.created_at DESC
    `;

    const result = await query(sql, params);

    // Parse tasks_completed JSON for each report
    const reports = result.rows.map(report => ({
      ...report,
      tasks_completed: JSON.parse(report.tasks_completed),
    }));

    res.json({ reports });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/:id - Get single report
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT dr.*, u.full_name as user_name
       FROM daily_reports dr
       JOIN users u ON dr.user_id = u.id
       WHERE dr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];

    // If employee, verify ownership
    if (req.user.role === 'employee' && report.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    report.tasks_completed = JSON.parse(report.tasks_completed);

    res.json({ report });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/reports/:id - Edit report (only if edit approved)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tasks_completed, hours_worked, notes } = req.body;
    const user_id = req.user.id;

    // Fetch report
    const reportResult = await query('SELECT * FROM daily_reports WHERE id = $1', [id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    // Verify ownership
    if (report.user_id !== user_id) {
      return res.status(403).json({ error: 'Not your report' });
    }

    // Check for approved edit request with valid deadline
    const editRequestResult = await query(
      `SELECT * FROM report_edit_requests
       WHERE report_id = $1 AND status = 'approved' AND edit_deadline > NOW()
       ORDER BY edit_deadline DESC
       LIMIT 1`,
      [id]
    );

    if (editRequestResult.rows.length === 0) {
      return res.status(403).json({ error: 'No active edit permission' });
    }

    // Validate new data
    if (!tasks_completed || !Array.isArray(tasks_completed) || tasks_completed.length === 0) {
      return res.status(400).json({ error: 'At least one task is required' });
    }

    for (const task of tasks_completed) {
      if (typeof task !== 'string' || task.trim().length === 0) {
        return res.status(400).json({ error: 'All tasks must be non-empty strings' });
      }
      if (task.length > 500) {
        return res.status(400).json({ error: 'Each task must be 500 characters or less' });
      }
    }

    if (!hours_worked || !isValidHours(hours_worked)) {
      return res.status(400).json({ error: 'Hours worked must be between 0.1 and 24' });
    }

    if (notes && notes.length > 1000) {
      return res.status(400).json({ error: 'Notes must be 1000 characters or less' });
    }

    const tasksJson = JSON.stringify(tasks_completed);

    // Update report
    const updateResult = await query(
      'UPDATE daily_reports SET tasks_completed = $1, hours_worked = $2, notes = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [tasksJson, hours_worked, notes, id]
    );

    // Mark edit request as used by deleting it (or could add 'used' status)
    await query('DELETE FROM report_edit_requests WHERE id = $1', [editRequestResult.rows[0].id]);

    const updatedReport = updateResult.rows[0];
    updatedReport.tasks_completed = JSON.parse(updatedReport.tasks_completed);

    res.json({ report: updatedReport });
  } catch (error) {
    console.error('Edit report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
