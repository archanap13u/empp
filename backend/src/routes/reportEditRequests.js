const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { addHours } = require('../utils/dateHelpers');

const router = express.Router();

// All routes require authentication
router.use(auth);

// POST /api/report-edit-requests - Request permission to edit report
router.post('/', async (req, res) => {
  try {
    const { report_id, reason } = req.body;
    const user_id = req.user.id;

    if (!report_id || !reason) {
      return res.status(400).json({ error: 'Report ID and reason are required' });
    }

    if (reason.length > 500) {
      return res.status(400).json({ error: 'Reason must be 500 characters or less' });
    }

    // Fetch report
    const reportResult = await query('SELECT * FROM daily_reports WHERE id = $1', [report_id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    // Verify ownership
    if (report.user_id !== user_id) {
      return res.status(403).json({ error: 'Not your report' });
    }

    // Check for existing pending request
    const existingRequest = await query(
      "SELECT id FROM report_edit_requests WHERE report_id = $1 AND status = 'pending'",
      [report_id]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: 'Edit request already pending for this report' });
    }

    // Insert request
    const result = await query(
      'INSERT INTO report_edit_requests (report_id, user_id, reason) VALUES ($1, $2, $3) RETURNING *',
      [report_id, user_id, reason]
    );

    res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    console.error('Create edit request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/report-edit-requests - Get edit requests
router.get('/', async (req, res) => {
  try {
    const { status = 'all' } = req.query;

    let whereClause = '';
    const params = [];

    // If employee, return only own requests
    if (req.user.role === 'employee') {
      whereClause = 'WHERE rer.user_id = $1';
      params.push(req.user.id);

      if (status !== 'all') {
        whereClause += ' AND rer.status = $2';
        params.push(status);
      }
    } else {
      // Admin can see all
      if (status !== 'all') {
        whereClause = 'WHERE rer.status = $1';
        params.push(status);
      }
    }

    const sql = `
      SELECT
        rer.*,
        dr.report_date,
        u.full_name as user_name,
        reviewer.full_name as reviewed_by_name
      FROM report_edit_requests rer
      JOIN daily_reports dr ON rer.report_id = dr.id
      JOIN users u ON rer.user_id = u.id
      LEFT JOIN users reviewer ON rer.reviewed_by = reviewer.id
      ${whereClause}
      ORDER BY rer.requested_at DESC
    `;

    const result = await query(sql, params);

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get edit requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/report-edit-requests/:id/approve - Approve edit request (admin only)
router.put('/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const admin_id = req.user.id;

    // Fetch request
    const requestResult = await query('SELECT * FROM report_edit_requests WHERE id = $1', [id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Check if already reviewed
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already reviewed' });
    }

    // Calculate edit deadline (24 hours from now)
    const deadline = addHours(new Date(), 24);

    // Update request
    const result = await query(
      `UPDATE report_edit_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, edit_deadline = $2
       WHERE id = $3
       RETURNING *`,
      [admin_id, deadline, id]
    );

    res.json({ request: result.rows[0] });
  } catch (error) {
    console.error('Approve edit request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/report-edit-requests/:id/reject - Reject edit request (admin only)
router.put('/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason = null } = req.body;
    const admin_id = req.user.id;

    if (rejection_reason && rejection_reason.length > 500) {
      return res.status(400).json({ error: 'Rejection reason must be 500 characters or less' });
    }

    // Fetch request
    const requestResult = await query('SELECT * FROM report_edit_requests WHERE id = $1', [id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Check if already reviewed
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already reviewed' });
    }

    // Update request
    const result = await query(
      `UPDATE report_edit_requests
       SET status = 'rejected', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = $2
       WHERE id = $3
       RETURNING *`,
      [admin_id, rejection_reason, id]
    );

    res.json({ request: result.rows[0] });
  } catch (error) {
    console.error('Reject edit request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
