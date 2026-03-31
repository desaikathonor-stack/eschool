// src/utils/api.js
// Preferred: configure VITE_API_BASE_URL in env.
// Fallback behavior:
// - local dev => http://localhost:5000/api
// - deployed host => /api (same-origin)

const configuredApiBase = import.meta.env.VITE_API_BASE_URL;
const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = configuredApiBase || (isLocalHost ? 'http://localhost:5000/api' : '/api');

export default API_BASE_URL;
