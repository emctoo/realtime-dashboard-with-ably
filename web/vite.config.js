import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  },
  server: {
    proxy: {
      // 配置代理
      '/api': {
        target: 'http://192.168.8.34:8000',  // 后端服务器地址
        changeOrigin: true,  // 支持跨域
        secure: false,  // 如果是 https 接口，需要配置这个参数
        // rewrite: (path) => path.replace(/^\/api/, '')  // 可选：重写路径
      }
    }
  }
})