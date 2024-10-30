import { defineStore } from 'pinia';
import axios from 'axios';
import {useAblyStore} from './ably';

// 创建一个带有基础配置的 axios 实例
const api = axios.create({
  baseURL: import.meta.env.SERVICE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
});

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    loading: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isPremium: (state) => state?.user?.subscription === 'premium',
    userInfo: (state) => state.user
  },

  actions: {
    async login(username, password) {
      this.loading = true;
      this.error = null;
      
      try {
        // 使用 URLSearchParams 来正确编码表单数据
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);
        
        console.log(`user ${username} is logging in ...`);
        const response = await api.post('/api/token', params);
        const { access_token, user_info, token_request } = response.data;        
        
        this.token = access_token;
        this.user = user_info;
        
        // 设置后续请求的认证头
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        
        // Store token in localStorage
        localStorage.setItem('token', access_token);
        localStorage.setItem('user', JSON.stringify(user_info));
        console.log(`user ${username} logged in`);

        const ablyStore = useAblyStore();
        console.log(`got token_request for ${token_request['_TokenRequest__client_id']}`);
        console.dir(token_request);
        await ablyStore.updateAuthData(token_request);
        
        return true;
      } catch (err) {
        console.error('Login error:', err);
        this.error = err.response?.data?.detail || 'Failed to login';
        return false;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      const username = this.user?.username || 'unknown';

      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 清除认证头
      delete api.defaults.headers.common['Authorization'];

      console.log(`user ${username} logged out`);      
    },

    // Initialize auth state from localStorage
    init() {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        this.token = token;
        this.user = JSON.parse(user);
        // 设置认证头
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    },

    // 验证当前token是否有效
    async validateToken() {
      if (!this.token) return false;
      
      try {
        const response = await api.get('/api/users/me');
        return true;
      } catch (err) {
        this.logout();
        return false;
      }
    }
  }
});

// 导出配置好的 axios 实例，以供其他地方使用
export { api };