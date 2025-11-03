import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI, reportAPI, timeEntryAPI, projectAPI, projectAccessRequestAPI } from '../../services/api';

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Employee Tracking System</h1>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user?.full_name}</span>
          <button onClick={logout} style={styles.logoutButton}>Logout</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.sidebar}>
          <Link to="/employee/dashboard" style={styles.sidebarLink} onClick={() => setActiveTab('dashboard')}>Dashboard</Link>
          <Link to="/employee/submit-report" style={styles.sidebarLink} onClick={() => setActiveTab('submit')}>Submit Report</Link>
          <Link to="/employee/my-reports" style={styles.sidebarLink} onClick={() => setActiveTab('reports')}>My Reports</Link>
          <Link to="/employee/time-tracking" style={styles.sidebarLink} onClick={() => setActiveTab('time')}>Time Tracking</Link>
          <Link to="/employee/projects" style={styles.sidebarLink} onClick={() => setActiveTab('projects')}>Projects</Link>
        </div>

        <div style={styles.content}>
          <Routes>
            <Route path="/dashboard" element={<DashboardOverview />} />
            <Route path="/submit-report" element={<SubmitReportPage />} />
            <Route path="/my-reports" element={<MyReportsPage />} />
            <Route path="/time-tracking" element={<TimeTrackingPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="*" element={<DashboardOverview />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

// Dashboard Overview
const DashboardOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getEmployeeStats();
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
          <h3>Hours Today</h3>
          <p style={styles.statValue}>{stats?.stats.hours_today?.toFixed(2) || '0.00'}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Hours This Week</h3>
          <p style={styles.statValue}>{stats?.stats.hours_this_week?.toFixed(2) || '0.00'}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Active Projects</h3>
          <p style={styles.statValue}>{stats?.stats.active_projects || 0}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Reports This Month</h3>
          <p style={styles.statValue}>{stats?.stats.reports_this_month || 0}</p>
        </div>
      </div>

      {stats?.active_timer && (
        <div style={styles.activeTimerCard}>
          <h3>Active Timer</h3>
          <p><strong>Project:</strong> {stats.active_timer.project_name}</p>
          <p><strong>Task:</strong> {stats.active_timer.task_description}</p>
          <p><strong>Elapsed:</strong> {Math.floor(stats.active_timer.elapsed_seconds / 3600)}h {Math.floor((stats.active_timer.elapsed_seconds % 3600) / 60)}m</p>
        </div>
      )}

      <h3 style={{ marginTop: '30px' }}>Recent Activity</h3>
      <h4>Latest Reports</h4>
      <ul>
        {stats?.recent_reports.map((report) => (
          <li key={report.id}>{report.report_date} - {report.hours_worked} hours</li>
        ))}
      </ul>
    </div>
  );
};

// Submit Report Page
const SubmitReportPage = () => {
  const [formData, setFormData] = useState({
    tasks_completed: [''],
    hours_worked: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleTaskChange = (index, value) => {
    const newTasks = [...formData.tasks_completed];
    newTasks[index] = value;
    setFormData({ ...formData, tasks_completed: newTasks });
  };

  const addTask = () => {
    setFormData({
      ...formData,
      tasks_completed: [...formData.tasks_completed, ''],
    });
  };

  const removeTask = (index) => {
    const newTasks = formData.tasks_completed.filter((_, i) => i !== index);
    setFormData({ ...formData, tasks_completed: newTasks });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const filteredTasks = formData.tasks_completed.filter(task => task.trim() !== '');
      await reportAPI.create({
        tasks_completed: filteredTasks,
        hours_worked: parseFloat(formData.hours_worked),
        notes: formData.notes || null,
      });

      setMessage('Report submitted successfully!');
      setFormData({ tasks_completed: [''], hours_worked: '', notes: '' });
    } catch (error) {
      setMessage(`Error: ${error.response?.data?.error || 'Failed to submit report'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Submit Daily Report</h2>
      {message && <div style={message.startsWith('Error') ? styles.errorMessage : styles.successMessage}>{message}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Tasks Completed</label>
          {formData.tasks_completed.map((task, index) => (
            <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                value={task}
                onChange={(e) => handleTaskChange(index, e.target.value)}
                style={styles.input}
                placeholder={`Task ${index + 1}`}
                required
              />
              {formData.tasks_completed.length > 1 && (
                <button type="button" onClick={() => removeTask(index)} style={styles.removeButton}>Remove</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addTask} style={styles.addButton}>Add Another Task</button>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Hours Worked</label>
          <input
            type="number"
            step="0.5"
            min="0.1"
            max="24"
            value={formData.hours_worked}
            onChange={(e) => setFormData({ ...formData, hours_worked: e.target.value })}
            style={styles.input}
            required
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Notes (Optional)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            style={styles.textarea}
            maxLength="1000"
            rows="4"
          />
        </div>

        <button type="submit" disabled={submitting} style={styles.submitButton}>
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
};

// My Reports Page
const MyReportsPage = () => {
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
      <h2>My Reports</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Hours Worked</th>
            <th style={styles.th}>Tasks</th>
            <th style={styles.th}>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td style={styles.td}>{report.report_date}</td>
              <td style={styles.td}>{report.hours_worked}</td>
              <td style={styles.td}>{report.tasks_completed?.length || 0} tasks</td>
              <td style={styles.td}>{new Date(report.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Time Tracking Page
const TimeTrackingPage = () => {
  const [activeTimer, setActiveTimer] = useState(null);
  const [projects, setProjects] = useState([]);
  const [formData, setFormData] = useState({ project_id: '', task_description: '' });

  useEffect(() => {
    fetchActiveTimer();
    fetchProjects();
  }, []);

  const fetchActiveTimer = async () => {
    try {
      const response = await timeEntryAPI.getActive();
      setActiveTimer(response.data.timer);
    } catch (error) {
      console.error('Error fetching timer:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getAll();
      setProjects(response.data.projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleStartTimer = async (e) => {
    e.preventDefault();
    try {
      await timeEntryAPI.startTimer(formData);
      alert('Timer started!');
      fetchActiveTimer();
      setFormData({ project_id: '', task_description: '' });
    } catch (error) {
      alert(`Error: ${error.response?.data?.error || 'Failed to start timer'}`);
    }
  };

  const handleStopTimer = async () => {
    try {
      await timeEntryAPI.stopTimer(activeTimer.id);
      alert('Timer stopped!');
      setActiveTimer(null);
    } catch (error) {
      alert('Error stopping timer');
    }
  };

  return (
    <div>
      <h2>Time Tracking</h2>

      {activeTimer ? (
        <div style={styles.activeTimerCard}>
          <h3>Active Timer</h3>
          <p><strong>Project:</strong> {activeTimer.project_name}</p>
          <p><strong>Task:</strong> {activeTimer.task_description}</p>
          <p><strong>Elapsed:</strong> {Math.floor(activeTimer.elapsed_seconds / 3600)}h {Math.floor((activeTimer.elapsed_seconds % 3600) / 60)}m</p>
          <button onClick={handleStopTimer} style={styles.stopButton}>Stop Timer</button>
        </div>
      ) : (
        <form onSubmit={handleStartTimer} style={styles.form}>
          <h3>Start New Timer</h3>
          <div style={styles.formGroup}>
            <label style={styles.label}>Project</label>
            <select
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              style={styles.input}
              required
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Task Description</label>
            <input
              type="text"
              value={formData.task_description}
              onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
              style={styles.input}
              maxLength="500"
              required
            />
          </div>

          <button type="submit" style={styles.submitButton}>Start Timer</button>
        </form>
      )}
    </div>
  );
};

// Projects Page
const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getAll();
      setProjects(response.data.projects);
      setAllProjects(response.data.projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    try {
      await projectAccessRequestAPI.create({ project_id: selectedProject });
      alert('Access request submitted!');
      setSelectedProject('');
    } catch (error) {
      alert(`Error: ${error.response?.data?.error || 'Failed to request access'}`);
    }
  };

  return (
    <div>
      <h2>Projects</h2>

      <form onSubmit={handleRequestAccess} style={styles.form}>
        <h3>Request Project Access</h3>
        <div style={styles.formGroup}>
          <label style={styles.label}>Select Project</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={styles.input}
            required
          >
            <option value="">Select a project</option>
            {allProjects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" style={styles.submitButton}>Request Access</button>
      </form>

      <h3 style={{ marginTop: '30px' }}>Available Projects</h3>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>{project.name} - {project.description || 'No description'}</li>
        ))}
      </ul>
    </div>
  );
};

const styles = {
  container: { display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  header: { backgroundColor: '#28a745', color: 'white', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: '20px', margin: 0 },
  headerRight: { display: 'flex', gap: '15px', alignItems: 'center' },
  userName: { fontSize: '14px' },
  logoutButton: { padding: '8px 15px', backgroundColor: 'white', color: '#28a745', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  main: { display: 'flex', flex: 1 },
  sidebar: { width: '200px', backgroundColor: '#f8f9fa', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', borderRight: '1px solid #ddd' },
  sidebarLink: { padding: '10px', textDecoration: 'none', color: '#333', borderRadius: '4px' },
  content: { flex: 1, padding: '30px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' },
  statCard: { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  statValue: { fontSize: '32px', fontWeight: 'bold', color: '#28a745', margin: '10px 0 0 0' },
  activeTimerCard: { backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', marginTop: '20px', border: '1px solid #ffc107' },
  form: { marginTop: '20px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  formGroup: { marginBottom: '20px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: '500' },
  input: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' },
  textarea: { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit' },
  submitButton: { padding: '12px 24px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' },
  addButton: { padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  removeButton: { padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  stopButton: { padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', marginTop: '10px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px', backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  th: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', backgroundColor: '#f8f9fa', fontWeight: '600' },
  td: { padding: '12px', borderBottom: '1px solid #ddd' },
  successMessage: { backgroundColor: '#d4edda', color: '#155724', padding: '15px', borderRadius: '4px', marginBottom: '20px' },
  errorMessage: { backgroundColor: '#f8d7da', color: '#721c24', padding: '15px', borderRadius: '4px', marginBottom: '20px' },
};

export default EmployeeDashboard;
