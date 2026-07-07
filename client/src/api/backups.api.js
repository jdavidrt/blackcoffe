import axios from "axios";
import { API_CONFIG } from '../utils/config';
import * as mock from './backups.mock';

// Frontend-only validation switch. Set to true to resolve the three requests
// below against an in-memory mock (backups.mock.js) instead of the server —
// useful for reviewing the "Copias de seguridad" UI without a backend. The real
// endpoints now exist, so this defaults to false (production behavior).
const USE_MOCK = false;

export const getBackupDatesRequest = async () =>
  USE_MOCK
    ? mock.getBackupDatesRequest()
    : await axios.get(`${API_CONFIG.RENDER_SERVER}/backupDates`);

export const getBackupsByDateRequest = async (date) =>
  USE_MOCK
    ? mock.getBackupsByDateRequest(date)
    : await axios.get(`${API_CONFIG.RENDER_SERVER}/backupsByDate/${date}`);

export const restoreOrderFromSnapshotRequest = async (orderId, data) =>
  USE_MOCK
    ? mock.restoreOrderFromSnapshotRequest(orderId, data)
    : await axios.put(`${API_CONFIG.RENDER_SERVER}/order/${orderId}/restore`, data);

export const getOrderRestoresRequest = async (orderId) =>
  USE_MOCK
    ? mock.getOrderRestoresRequest(orderId)
    : await axios.get(`${API_CONFIG.RENDER_SERVER}/orderRestores/${orderId}`);
