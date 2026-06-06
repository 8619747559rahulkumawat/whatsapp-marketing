import axios from 'axios';
import axiosRetry from 'axios-retry';

const API = axios.create({
  baseURL: '/api',
  timeout: 35000
});

axiosRetry(API, {
  retries: 1,
  retryDelay: () => 2000,
  retryCondition: (error) => {
    return !error.response || error.code === 'ECONNABORTED';
  }
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;
