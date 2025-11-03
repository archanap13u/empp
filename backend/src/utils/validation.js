// Email validation
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation
// Must be at least 8 characters with uppercase, lowercase, and number
const isValidPassword = (password) => {
  if (password.length < 8) return false;

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return hasUppercase && hasLowercase && hasNumber;
};

const getPasswordRequirements = () => {
  return 'Password must be at least 8 characters and include uppercase, lowercase, and number';
};

// Validate full name length
const isValidFullName = (fullName) => {
  return fullName && fullName.trim().length >= 2 && fullName.trim().length <= 255;
};

// Validate hours worked
const isValidHours = (hours) => {
  return hours >= 0.1 && hours <= 24;
};

// Validate latitude
const isValidLatitude = (lat) => {
  return lat >= -90 && lat <= 90;
};

// Validate longitude
const isValidLongitude = (lon) => {
  return lon >= -180 && lon <= 180;
};

module.exports = {
  isValidEmail,
  isValidPassword,
  getPasswordRequirements,
  isValidFullName,
  isValidHours,
  isValidLatitude,
  isValidLongitude,
};
