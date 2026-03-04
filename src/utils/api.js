// src/utils/api.js
// Set your API URL here. For local development use 'http://localhost:5000'
// For production, replace it with your hosted backend URL (e.g. 'https://my-eschool-api.onrender.com')

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default API_BASE_URL;
