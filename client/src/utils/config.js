export const API_CONFIG = {
  RENDER_SERVER: 'http://https://coffeserver.onrender.com',
  LOCAL_HOST: 'http://localhost:25060'
};

export const getApiUrl = (endpoint) => `${API_CONFIG.RENDER_SERVER}${endpoint}`;