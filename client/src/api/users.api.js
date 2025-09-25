import axios from "axios";
import { API_CONFIG } from '../utils/config';
export const autenticateUserRequest = async (userName, pass) =>
    await axios.get(`${API_CONFIG.RENDER_SERVER}/users/${userName}/${pass}`);
