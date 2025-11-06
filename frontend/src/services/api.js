import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Employee endpoints (admin)
export const employeeAPI = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  archive: (id) => api.delete(`/employees/${id}`),
};

// Report endpoints
export const reportAPI = {
  getAll: (params) => api.get('/reports', { params }),
  getById: (id) => api.get(`/reports/${id}`),
  create: (data) => api.post('/reports', data),
  update: (id, data) => api.put(`/reports/${id}`, data),
};

// Report edit request endpoints
export const reportEditRequestAPI = {
  getAll: (params) => api.get('/report-edit-requests', { params }),
  create: (data) => api.post('/report-edit-requests', data),
  approve: (id) => api.put(`/report-edit-requests/${id}/approve`),
  reject: (id, data) => api.put(`/report-edit-requests/${id}/reject`, data),
};

// Project endpoints
export const projectAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  removeEmployee: (projectId, employeeId) => api.delete(`/projects/${projectId}/employees/${employeeId}`),
};

// Project access request endpoints
export const projectAccessRequestAPI = {
  getAll: (params) => api.get('/project-access-requests', { params }),
  create: (data) => api.post('/project-access-requests', data),
  approve: (id) => api.put(`/project-access-requests/${id}/approve`),
  reject: (id, data) => api.put(`/project-access-requests/${id}/reject`, data),
};

// Time entry endpoints
export const timeEntryAPI = {
  getAll: (params) => api.get('/time-entries', { params }),
  startTimer: (data) => api.post('/time-entries/start', data),
  stopTimer: (id) => api.put(`/time-entries/${id}/stop`),
  getActive: () => api.get('/time-entries/active'),
  addManual: (data) => api.post('/time-entries/manual', data),
};

// Location endpoints
export const locationAPI = {
  record: (data) => api.post('/locations', data),
  getAll: (params) => api.get('/locations', { params }),
  getLatest: (params) => api.get('/locations/latest', { params }),
};

// Dashboard endpoints
export const dashboardAPI = {
  getAdminStats: () => api.get('/dashboard/admin'),
  getEmployeeStats: () => api.get('/dashboard/employee'),
};

export default api;
