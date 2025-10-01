export const API_CONFIG = {
  RENDER_SERVER: 'http://localhost:25060',
  LOCAL_HOST: 'http://localhost:25060'
};

export const getApiUrl = (endpoint) => `${API_CONFIG.RENDER_SERVER}${endpoint}`;