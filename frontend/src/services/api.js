import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const apiService = {
  // Auth
  async register(data) {
    const response = await api.post('/auth/register/', data);
    return response.data;
  },

  async login(data) {
    const response = await api.post('/auth/login/', data);
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me/');
    return response.data;
  },

  setAuthToken(token) {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('auth_token', token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('auth_token');
    }
  },

  getAuthToken() {
    return localStorage.getItem('auth_token');
  },

  // Spreadsheets
  async getSpreadsheets() {
    const response = await api.get('/spreadsheets/');
    return response.data;
  },

  async getSpreadsheet(id) {
    const response = await api.get(`/spreadsheets/${id}/`);
    return response.data;
  },

  async createSpreadsheet(data) {
    const response = await api.post('/spreadsheets/', data);
    return response.data;
  },

  async updateSpreadsheet(id, data) {
    const response = await api.patch(`/spreadsheets/${id}/`, data);
    return response.data;
  },

  async deleteSpreadsheet(id) {
    await api.delete(`/spreadsheets/${id}/`);
  },

  async shareSpreadsheet(id, username) {
    const response = await api.post(`/spreadsheets/${id}/share/`, { username });
    return response.data;
  },

  async unshareSpreadsheet(id, username) {
    const response = await api.post(`/spreadsheets/${id}/unshare/`, { username });
    return response.data;
  },

  async getSharedUsers(id) {
    const response = await api.get(`/spreadsheets/${id}/shared_users/`);
    return response.data;
  },

  // Sheets
  async getSheets(spreadsheetId) {
    const response = await api.get(`/sheets/?spreadsheet_id=${spreadsheetId}`);
    return response.data;
  },

  async addSheet(spreadsheetId, name) {
    const response = await api.post(`/spreadsheets/${spreadsheetId}/add_sheet/`, { name });
    return response.data;
  },

  async updateSheet(sheetId, data) {
    const response = await api.patch(`/sheets/${sheetId}/`, data);
    return response.data;
  },

  // Cells
  async getCells(sheetId) {
    const response = await api.get(`/cells/?sheet_id=${sheetId}`);
    return response.data;
  },

  async updateCell(sheetId, row, column, data) {
    const response = await api.post('/cells/', {
      sheet_id: sheetId,
      row,
      column,
      ...data,
    });
    return response.data;
  },

  async batchUpdateCells(sheetId, updates) {
    const response = await api.post('/cells/batch_update/', {
      sheet_id: sheetId,
      updates,
    });
    return response.data;
  },
};

export default apiService;

