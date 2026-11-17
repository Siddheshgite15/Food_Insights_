import axios from 'axios';

const api = axios.create({
  baseURL: '', // Uses Vite proxy to /api or localhost:5000
  timeout: 45000,
});

export default api;
