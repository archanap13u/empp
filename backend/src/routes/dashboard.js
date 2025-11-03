const express = require('express');
const { query } = require('../config/database');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { getToday, getStartOfWeek, getStartOfMonth } = require('../utils/dateHelpers');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Helper functions
function getWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

function getMonthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().split('T')[0];
}

// GET /api/dashboard/admin - Get admin dashboard statistics
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const today = getToday();

    // Total active employees
    const totalEmployeesResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE is_active = true AND role = 'employee'",
      []
    );

    // Active projects count
    const activeProjectsResult = await query(
      "SELECT COUNT(*) as count FROM projects WHERE status = 'active'",
      []
    );

    // Pending access requests count (both project and report edit)
    const pendingProjectRequestsResult = await query(
      "SELECT COUNT(*) as count FROM project_access_requests WHERE status = 'pending'",
      []
    );

    const pendingEditRequestsResult = await query(
      "SELECT COUNT(*) as count FROM report_edit_requests WHERE status = 'pending'",
      []
    );

    const pendingRequests = parseInt(pendingProjectRequestsResult.rows[0].count) +
                           parseInt(pendingEditRequestsResult.rows[0].count);

    // Reports submitted today
    const reportsTodayResult = await query(
      'SELECT COUNT(*) as count FROM daily_reports WHERE report_date = $1',
      [today]
    );

    // Recent employee activity (all employees with latest activity)
    const recentActivity = await query(
      `SELECT
        u.id as user_id,
        u.full_name,
        (
          SELECT MAX(timestamp)
          FROM location_history
          WHERE user_id = u.id
        ) as last_active,
        (
          SELECT JSON_BUILD_OBJECT('latitude', latitude, 'longitude', longitude)
          FROM location_history
          WHERE user_id = u.id
          ORDER BY timestamp DESC
          LIMIT 1
        ) as current_location,
        COALESCE(
          (
            SELECT SUM(duration_minutes) / 60.0
            FROM time_entries
            WHERE user_id = u.id AND entry_date = $1
          ),
          0
        ) as hours_today
      FROM users u
      WHERE u.is_active = true
      ORDER BY last_active DESC NULLS LAST
      LIMIT 20`,
      [today]
    );

    // Pending project access requests (top 10)
    const pendingAccessRequests = await query(
      `SELECT
        par.id,
        par.requested_at,
        u.full_name as user_name,
        p.name as project_name,
        par.project_id,
        par.user_id
      FROM project_access_requests par
      JOIN users u ON par.user_id = u.id
      JOIN projects p ON par.project_id = p.id
      WHERE par.status = 'pending'
      ORDER BY par.requested_at DESC
      LIMIT 10`,
      []
    );

    // Pending report edit requests (top 10)
    const pendingEditRequests = await query(
      `SELECT
        rer.id,
        rer.requested_at,
        rer.reason,
        u.full_name as user_name,
        dr.report_date,
        rer.report_id,
        rer.user_id
      FROM report_edit_requests rer
      JOIN users u ON rer.user_id = u.id
      JOIN daily_reports dr ON rer.report_id = dr.id
      WHERE rer.status = 'pending'
      ORDER BY rer.requested_at DESC
      LIMIT 10`,
      []
    );

    res.json({
      stats: {
        total_employees: parseInt(totalEmployeesResult.rows[0].count),
        active_projects: parseInt(activeProjectsResult.rows[0].count),
        pending_requests: pendingRequests,
        reports_today: parseInt(reportsTodayResult.rows[0].count),
      },
      recent_activity: recentActivity.rows,
      pending_access_requests: pendingAccessRequests.rows,
      pending_edit_requests: pendingEditRequests.rows,
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/employee - Get employee dashboard statistics
router.get('/employee', async (req, res) => {
  try {
    const user_id = req.user.id;
    const today = getToday();
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();

    // Hours worked today
    const hoursTodayResult = await query(
      'SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 as hours FROM time_entries WHERE user_id = $1 AND entry_date = $2',
      [user_id, today]
    );

    // Hours worked this week
    const hoursWeekResult = await query(
      'SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 as hours FROM time_entries WHERE user_id = $1 AND entry_date >= $2',
      [user_id, weekStart]
    );

    // Active projects count
    const activeProjectsResult = await query(
      `SELECT COUNT(*) as count
       FROM project_assignments pa
       JOIN projects p ON pa.project_id = p.id
       WHERE pa.user_id = $1 AND p.status = 'active'`,
      [user_id]
    );

    // Reports submitted this month
    const reportsMonthResult = await query(
      'SELECT COUNT(*) as count FROM daily_reports WHERE user_id = $1 AND report_date >= $2',
      [user_id, monthStart]
    );

    // Active timer
    const activeTimerResult = await query(
      `SELECT te.*, p.name as project_name
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       WHERE te.user_id = $1 AND te.entry_type = 'timer' AND te.end_time IS NULL
       LIMIT 1`,
      [user_id]
    );

    let activeTimer = null;
    if (activeTimerResult.rows.length > 0) {
      const timer = activeTimerResult.rows[0];
      const now = new Date();
      const startTime = new Date(timer.start_time);
      const elapsedSeconds = Math.floor((now - startTime) / 1000);

      activeTimer = {
        ...timer,
        elapsed_seconds: elapsedSeconds,
      };
    }

    // Recent time entries (last 5)
    const recentTimeEntries = await query(
      `SELECT te.*, p.name as project_name
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       WHERE te.user_id = $1 AND te.end_time IS NOT NULL
       ORDER BY te.created_at DESC
       LIMIT 5`,
      [user_id]
    );

    // Recent reports (last 3)
    const recentReports = await query(
      'SELECT id, report_date, hours_worked, created_at FROM daily_reports WHERE user_id = $1 ORDER BY report_date DESC LIMIT 3',
      [user_id]
    );

    // Recent access requests (last 5)
    const recentAccessRequests = await query(
      `SELECT par.*, p.name as project_name
       FROM project_access_requests par
       JOIN projects p ON par.project_id = p.id
       WHERE par.user_id = $1
       ORDER BY par.requested_at DESC
       LIMIT 5`,
      [user_id]
    );

    res.json({
      stats: {
        hours_today: parseFloat(hoursTodayResult.rows[0].hours),
        hours_this_week: parseFloat(hoursWeekResult.rows[0].hours),
        active_projects: parseInt(activeProjectsResult.rows[0].count),
        reports_this_month: parseInt(reportsMonthResult.rows[0].count),
      },
      active_timer: activeTimer,
      recent_time_entries: recentTimeEntries.rows,
      recent_reports: recentReports.rows,
      recent_access_requests: recentAccessRequests.rows,
    });
  } catch (error) {
    console.error('Get employee dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
