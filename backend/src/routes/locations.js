const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { getToday } = require('../utils/dateHelpers');
const { isValidLatitude, isValidLongitude } = require('../utils/validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

// POST /api/locations - Record GPS location
router.post('/', async (req, res) => {
  try {
    const { latitude, longitude, accuracy = null, status = 'active' } = req.body;
    const user_id = req.user.id;

    // Validate latitude and longitude
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (!isValidLatitude(latitude)) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
    }

    if (!isValidLongitude(longitude)) {
      return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
    }

    if (status !== 'active' && status !== 'paused') {
      return res.status(400).json({ error: 'Status must be either active or paused' });
    }

    // Insert location
    const result = await query(
      'INSERT INTO location_history (user_id, latitude, longitude, accuracy, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, latitude, longitude, accuracy, status]
    );

    res.status(201).json({ location: result.rows[0] });
  } catch (error) {
    console.error('Record location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/locations - Get location history
router.get('/', async (req, res) => {
  try {
    const { user_id, start_date = getToday(), end_date = getToday() } = req.query;

    let targetUserId = user_id;

    // If employee, force to own locations only
    if (req.user.role === 'employee') {
      targetUserId = req.user.id;
    }

    const params = [start_date + ' 00:00:00', end_date + ' 23:59:59'];
    let whereClause = 'WHERE lh.timestamp >= $1 AND lh.timestamp <= $2';

    if (targetUserId) {
      params.push(targetUserId);
      whereClause += ` AND lh.user_id = $${params.length}`;
    }

    const sql = `
      SELECT
        lh.*,
        u.full_name as user_name
      FROM location_history lh
      JOIN users u ON lh.user_id = u.id
      ${whereClause}
      ORDER BY lh.timestamp DESC
    `;

    const result = await query(sql, params);

    res.json({ locations: result.rows });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/locations/latest - Get latest location for users (admin only)
router.get('/latest', adminAuth, async (req, res) => {
  try {
    const { user_id } = req.query;

    let whereClause = '';
    const params = [];

    if (user_id) {
      whereClause = 'WHERE lh.user_id = $1';
      params.push(user_id);
    }

    const sql = `
      SELECT DISTINCT ON (lh.user_id)
        lh.user_id,
        u.full_name as user_name,
        lh.latitude,
        lh.longitude,
        lh.accuracy,
        lh.timestamp,
        lh.status
      FROM location_history lh
      JOIN users u ON lh.user_id = u.id
      ${whereClause}
      ORDER BY lh.user_id, lh.timestamp DESC
    `;

    const result = await query(sql, params);

    res.json({ locations: result.rows });
  } catch (error) {
    console.error('Get latest locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
