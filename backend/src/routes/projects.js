const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/projects - Get all projects
router.get('/', async (req, res) => {
  try {
    const { status = 'active' } = req.query;

    let whereClause = '';
    const params = [];

    // Employees can only see active projects
    if (req.user.role === 'employee') {
      whereClause = "WHERE p.status = 'active'";
    } else {
      // Admin can filter by status
      if (status === 'active') {
        whereClause = "WHERE p.status = 'active'";
      } else if (status === 'inactive') {
        whereClause = "WHERE p.status = 'inactive'";
      }
      // 'all' means no filter
    }

    const sql = `
      SELECT
        p.*,
        u.full_name as created_by_name,
        (SELECT COUNT(*) FROM project_assignments WHERE project_id = p.id) as assigned_employees_count
      FROM projects p
      JOIN users u ON p.created_by = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const result = await query(sql, params);

    res.json({ projects: result.rows });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id - Get project details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch project
    const projectResult = await query(
      `SELECT p.*, u.full_name as created_by_name
       FROM projects p
       JOIN users u ON p.created_by = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // If employee, verify access
    if (req.user.role === 'employee') {
      const accessCheck = await query(
        'SELECT id FROM project_assignments WHERE project_id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied. You are not assigned to this project.' });
      }
    }

    // Fetch assigned employees with their total hours
    const assignedEmployees = await query(
      `SELECT
        u.id as user_id,
        u.full_name,
        pa.assigned_at,
        COALESCE(SUM(te.duration_minutes), 0) / 60.0 as total_hours
      FROM project_assignments pa
      JOIN users u ON pa.user_id = u.id
      LEFT JOIN time_entries te ON te.user_id = u.id AND te.project_id = pa.project_id
      WHERE pa.project_id = $1
      GROUP BY u.id, u.full_name, pa.assigned_at
      ORDER BY pa.assigned_at DESC`,
      [id]
    );

    // Calculate total hours logged
    const totalHoursResult = await query(
      'SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 as total_hours FROM time_entries WHERE project_id = $1',
      [id]
    );

    const responseData = {
      project: {
        ...project,
        assigned_employees: assignedEmployees.rows,
        total_hours_logged: parseFloat(totalHoursResult.rows[0].total_hours),
      },
    };

    // If admin, include pending access requests
    if (req.user.role === 'admin') {
      const pendingRequests = await query(
        `SELECT par.*, u.full_name as user_name
         FROM project_access_requests par
         JOIN users u ON par.user_id = u.id
         WHERE par.project_id = $1 AND par.status = 'pending'
         ORDER BY par.requested_at DESC`,
        [id]
      );

      responseData.project.pending_requests = pendingRequests.rows;
    }

    res.json(responseData);
  } catch (error) {
    console.error('Get project details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects - Create new project (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, description = null, status = 'active' } = req.body;
    const created_by = req.user.id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (name.length > 255) {
      return res.status(400).json({ error: 'Project name must be 255 characters or less' });
    }

    if (status !== 'active' && status !== 'inactive') {
      return res.status(400).json({ error: 'Status must be either active or inactive' });
    }

    // Check name uniqueness
    const existingProject = await query('SELECT id FROM projects WHERE name = $1', [name.trim()]);

    if (existingProject.rows.length > 0) {
      return res.status(400).json({ error: 'Project name already exists' });
    }

    // Insert project
    const result = await query(
      'INSERT INTO projects (name, description, status, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), description, status, created_by]
    );

    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id - Update project (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    // Fetch existing project
    const existingProject = await query('SELECT * FROM projects WHERE id = $1', [id]);

    if (existingProject.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updates = [];
    const params = [];
    let paramCount = 1;

    // Update name if provided
    if (name !== undefined) {
      if (name.trim().length === 0) {
        return res.status(400).json({ error: 'Project name cannot be empty' });
      }

      if (name.length > 255) {
        return res.status(400).json({ error: 'Project name must be 255 characters or less' });
      }

      // Check uniqueness (exclude current project)
      const nameCheck = await query('SELECT id FROM projects WHERE name = $1 AND id != $2', [name.trim(), id]);

      if (nameCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Project name already exists' });
      }

      updates.push(`name = $${paramCount}`);
      params.push(name.trim());
      paramCount++;
    }

    // Update description if provided
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    // Update status if provided
    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') {
        return res.status(400).json({ error: 'Status must be either active or inactive' });
      }

      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add id parameter
    params.push(id);

    const sql = `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await query(sql, params);

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id/employees/:employee_id - Remove employee from project (admin only)
router.delete('/:id/employees/:employee_id', adminAuth, async (req, res) => {
  try {
    const { id, employee_id } = req.params;

    // Check if assignment exists
    const assignment = await query(
      'SELECT id FROM project_assignments WHERE project_id = $1 AND user_id = $2',
      [id, employee_id]
    );

    if (assignment.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Delete assignment
    await query('DELETE FROM project_assignments WHERE project_id = $1 AND user_id = $2', [id, employee_id]);

    res.json({ message: 'Employee removed from project' });
  } catch (error) {
    console.error('Remove employee from project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
