import axios from "axios";
import { ENV } from "@/config";
import { STORAGE_KEYS } from "@/config/constants";

// ===== Axios Instance =====
// Centralized API client with base URL and auth interceptor
const api = axios.create({
    baseURL: ENV.API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

// Request interceptor: attach JWT token if present
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: handle 401 globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid — clear auth state
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER);
            // Optionally redirect to login
        }
        return Promise.reject(error);
    }
);

export default api;
