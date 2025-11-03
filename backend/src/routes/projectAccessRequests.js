const express = require('express');
const { query, getClient } = require('../config/database');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// POST /api/project-access-requests - Request access to project (employee)
router.post('/', async (req, res) => {
  try {
    const { project_id } = req.body;
    const user_id = req.user.id;

    if (!project_id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Fetch project
    const projectResult = await query('SELECT * FROM projects WHERE id = $1', [project_id]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Check if project is active
    if (project.status !== 'active') {
      return res.status(400).json({ error: 'Cannot request access to inactive project' });
    }

    // Check if already assigned
    const existingAssignment = await query(
      'SELECT id FROM project_assignments WHERE project_id = $1 AND user_id = $2',
      [project_id, user_id]
    );

    if (existingAssignment.rows.length > 0) {
      return res.status(400).json({ error: 'You already have access to this project' });
    }

    // Check for existing pending request
    const existingRequest = await query(
      "SELECT id FROM project_access_requests WHERE project_id = $1 AND user_id = $2 AND status = 'pending'",
      [project_id, user_id]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: 'Access request already pending for this project' });
    }

    // Insert request
    const result = await query(
      'INSERT INTO project_access_requests (project_id, user_id) VALUES ($1, $2) RETURNING *',
      [project_id, user_id]
    );

    res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    console.error('Create access request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/project-access-requests - Get project access requests
router.get('/', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    let whereClause = '';
    const params = [];

    // If employee, return only own requests
    if (req.user.role === 'employee') {
      whereClause = 'WHERE par.user_id = $1';
      params.push(req.user.id);

      if (status !== 'all') {
        whereClause += ' AND par.status = $2';
        params.push(status);
      }
    } else {
      // Admin can see all
      if (status !== 'all') {
        whereClause = 'WHERE par.status = $1';
        params.push(status);
      }
    }

    const sql = `
      SELECT
        par.*,
        p.name as project_name,
        u.full_name as user_name,
        reviewer.full_name as reviewed_by_name
      FROM project_access_requests par
      JOIN projects p ON par.project_id = p.id
      JOIN users u ON par.user_id = u.id
      LEFT JOIN users reviewer ON par.reviewed_by = reviewer.id
      ${whereClause}
      ORDER BY par.requested_at DESC
    `;

    const result = await query(sql, params);

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get access requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/project-access-requests/:id/approve - Approve access request (admin only)
router.put('/:id/approve', adminAuth, async (req, res) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const admin_id = req.user.id;

    // Fetch request
    const requestResult = await client.query('SELECT * FROM project_access_requests WHERE id = $1', [id]);

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Check if already reviewed
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Request already reviewed' });
    }

    // Update request status
    await client.query(
      `UPDATE project_access_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [admin_id, id]
    );

    // Create project assignment
    await client.query(
      'INSERT INTO project_assignments (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [request.project_id, request.user_id]
    );

    await client.query('COMMIT');

    // Fetch updated request
    const updatedRequest = await query(
      `SELECT par.*, p.name as project_name, u.full_name as user_name
       FROM project_access_requests par
       JOIN projects p ON par.project_id = p.id
       JOIN users u ON par.user_id = u.id
       WHERE par.id = $1`,
      [id]
    );

    res.json({ request: updatedRequest.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve access request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/project-access-requests/:id/reject - Reject access request (admin only)
router.put('/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason = null } = req.body;
    const admin_id = req.user.id;

    if (rejection_reason && rejection_reason.length > 500) {
      return res.status(400).json({ error: 'Rejection reason must be 500 characters or less' });
    }

    // Fetch request
    const requestResult = await query('SELECT * FROM project_access_requests WHERE id = $1', [id]);

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
      `UPDATE project_access_requests
       SET status = 'rejected', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = $2
       WHERE id = $3
       RETURNING *`,
      [admin_id, rejection_reason, id]
    );

    res.json({ request: result.rows[0] });
  } catch (error) {
    console.error('Reject access request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
