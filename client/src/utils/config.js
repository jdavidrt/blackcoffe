// Toggle between local and production server
const USE_LOCAL_SERVER = false; // Set to false for production

export const API_CONFIG = {
  RENDER_SERVER: USE_LOCAL_SERVER ? 'http://localhost:25060' : 'https://coffeserver.onrender.com',
  LOCAL_HOST: 'http://localhost:25060'
};

export const getApiUrl = (endpoint) => `${API_CONFIG.RENDER_SERVER}${endpoint}`;