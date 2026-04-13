import axios from "axios";
import { API_CONFIG } from '../utils/config';

export const executeQueryRequest = async (query) =>
    await axios.post(`${API_CONFIG.RENDER_SERVER}/query`, { query });
