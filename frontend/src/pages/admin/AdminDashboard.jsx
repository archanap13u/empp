import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI, employeeAPI, projectAPI, projectAccessRequestAPI, reportAPI } from '../../services/api';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Employee Tracking System - Admin</h1>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user?.full_name}</span>
          <button onClick={logout} style={styles.logoutButton}>Logout</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.sidebar}>
          <Link to="/admin/dashboard" style={styles.sidebarLink} onClick={() => setActiveTab('dashboard')}>Dashboard</Link>
          <Link to="/admin/employees" style={styles.sidebarLink} onClick={() => setActiveTab('employees')}>Employees</Link>
          <Link to="/admin/reports" style={styles.sidebarLink} onClick={() => setActiveTab('reports')}>Daily Reports</Link>
          <Link to="/admin/projects" style={styles.sidebarLink} onClick={() => setActiveTab('projects')}>Projects</Link>
          <Link to="/admin/access-requests" style={styles.sidebarLink} onClick={() => setActiveTab('requests')}>Access Requests</Link>
        </div>

        <div style={styles.content}>
          <Routes>
            <Route path="/dashboard" element={<DashboardOverview />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/access-requests" element={<AccessRequestsPage />} />
            <Route path="*" element={<DashboardOverview />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

// Dashboard Overview Component
const DashboardOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getAdminStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Dashboard Overview</h2>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <h3>Total Employees</h3>
          <p style={styles.statValue}>{stats?.stats.total_employees || 0}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Active Projects</h3>
          <p style={styles.statValue}>{stats?.stats.active_projects || 0}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Pending Requests</h3>
          <p style={styles.statValue}>{stats?.stats.pending_requests || 0}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Reports Today</h3>
          <p style={styles.statValue}>{stats?.stats.reports_today || 0}</p>
        </div>
      </div>

      <h3 style={{ marginTop: '30px' }}>Recent Employee Activity</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Employee</th>
            <th style={styles.th}>Hours Today</th>
            <th style={styles.th}>Last Active</th>
          </tr>
        </thead>
        <tbody>
          {stats?.recent_activity.map((activity, index) => (
            <tr key={index}>
              <td style={styles.td}>{activity.full_name}</td>
              <td style={styles.td}>{activity.hours_today?.toFixed(2) || '0.00'}</td>
              <td style={styles.td}>{activity.last_active ? new Date(activity.last_active).toLocaleString() : 'Never'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Employees Management Page
const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      setEmployees(response.data.employees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Employees Management</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id}>
              <td style={styles.td}>{emp.full_name}</td>
              <td style={styles.td}>{emp.email}</td>
              <td style={styles.td}><span style={emp.role === 'admin' ? styles.badgeAdmin : styles.badgeEmployee}>{emp.role}</span></td>
              <td style={styles.td}><span style={emp.is_active ? styles.badgeActive : styles.badgeInactive}>{emp.is_active ? 'Active' : 'Inactive'}</span></td>
              <td style={styles.td}>{new Date(emp.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Reports Page
const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await reportAPI.getAll();
      setReports(response.data.reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Daily Reports</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Employee</th>
            <th style={styles.th}>Hours Worked</th>
            <th style={styles.th}>Tasks Count</th>
            <th style={styles.th}>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td style={styles.td}>{report.report_date}</td>
              <td style={styles.td}>{report.user_name}</td>
              <td style={styles.td}>{report.hours_worked}</td>
              <td style={styles.td}>{report.tasks_completed?.length || 0}</td>
              <td style={styles.td}>{new Date(report.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Projects Page
const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getAll({ status: 'all' });
      setProjects(response.data.projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Projects Management</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Project Name</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Employees</th>
            <th style={styles.th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td style={styles.td}>{project.name}</td>
              <td style={styles.td}><span style={project.status === 'active' ? styles.badgeActive : styles.badgeInactive}>{project.status}</span></td>
              <td style={styles.td}>{project.assigned_employees_count}</td>
              <td style={styles.td}>{new Date(project.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Access Requests Page
const AccessRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await projectAccessRequestAPI.getAll({ status: 'pending' });
      setRequests(response.data.requests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await projectAccessRequestAPI.approve(id);
      alert('Request approved successfully');
      fetchRequests();
    } catch (error) {
      alert('Error approving request');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Rejection reason (optional):');
    try {
      await projectAccessRequestAPI.reject(id, { rejection_reason: reason });
      alert('Request rejected');
      fetchRequests();
    } catch (error) {
      alert('Error rejecting request');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Project Access Requests</h2>
      {requests.length === 0 ? (
        <p>No pending requests</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Employee</th>
              <th style={styles.th}>Project</th>
              <th style={styles.th}>Requested</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td style={styles.td}>{request.user_name}</td>
                <td style={styles.td}>{request.project_name}</td>
                <td style={styles.td}>{new Date(request.requested_at).toLocaleString()}</td>
                <td style={styles.td}>
                  <button onClick={() => handleApprove(request.id)} style={styles.approveButton}>Approve</button>
                  <button onClick={() => handleReject(request.id)} style={styles.rejectButton}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const styles = {
  container: { display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  header: { backgroundColor: '#007bff', color: 'white', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: '20px', margin: 0 },
  headerRight: { display: 'flex', gap: '15px', alignItems: 'center' },
  userName: { fontSize: '14px' },
  logoutButton: { padding: '8px 15px', backgroundColor: 'white', color: '#007bff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  main: { display: 'flex', flex: 1 },
  sidebar: { width: '200px', backgroundColor: '#f8f9fa', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', borderRight: '1px solid #ddd' },
  sidebarLink: { padding: '10px', textDecoration: 'none', color: '#333', borderRadius: '4px', ':hover': { backgroundColor: '#e9ecef' } },
  content: { flex: 1, padding: '30px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' },
  statCard: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  statValue: { fontSize: '32px', fontWeight: 'bold', color: '#007bff', margin: '10px 0 0 0' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px', backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  th: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa', fontWeight: '600' },
  td: { padding: '12px', borderBottom: '1px solid #ddd' },
  badgeAdmin: { padding: '4px 8px', backgroundColor: '#dc3545', color: 'white', borderRadius: '4px', fontSize: '12px' },
  badgeEmployee: { padding: '4px 8px', backgroundColor: '#6c757d', color: 'white', borderRadius: '4px', fontSize: '12px' },
  badgeActive: { padding: '4px 8px', backgroundColor: '#28a745', color: 'white', borderRadius: '4px', fontSize: '12px' },
  badgeInactive: { padding: '4px 8px', backgroundColor: '#6c757d', color: 'white', borderRadius: '4px', fontSize: '12px' },
  approveButton: { padding: '6px 12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' },
  rejectButton: { padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
};

export default AdminDashboard;
