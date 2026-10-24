import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add a request interceptor to add auth token
api.interceptors.request.use((config) => {
  // If data is FormData, ensure Content-Type header is omitted
  // so browser/Axios automatically sets multipart/form-data with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  const token = localStorage.getItem('adminToken');
  const existingAuth =
    config.headers.Authorization ||
    (typeof (config.headers as any).get === 'function' &&
      (config.headers as any).get('Authorization'));
  if (token && !existingAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
