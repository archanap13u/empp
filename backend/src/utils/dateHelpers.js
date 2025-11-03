// Format date to YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get today's date in YYYY-MM-DD format
const getToday = () => {
  return formatDate(new Date());
};

// Check if date is in the future
const isFutureDate = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date > today;
};

// Get date N days ago
const getDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
};

// Get start of week (Monday)
const getStartOfWeek = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust if Sunday
  date.setDate(diff);
  return formatDate(date);
};

// Get start of month
const getStartOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  return formatDate(date);
};

// Calculate difference in minutes between two timestamps
const getMinutesDifference = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  return Math.floor(diffMs / 60000); // Convert milliseconds to minutes
};

// Add hours to a timestamp
const addHours = (timestamp, hours) => {
  const date = new Date(timestamp);
  date.setHours(date.getHours() + hours);
  return date;
};

module.exports = {
  formatDate,
  getToday,
  isFutureDate,
  getDaysAgo,
  getStartOfWeek,
  getStartOfMonth,
  getMinutesDifference,
  addHours,
};
