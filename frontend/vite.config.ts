import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { compression } from 'vite-plugin-compression2'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    compression(), // 启用 Gzip 压缩
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://nas.betterspace.top:8003',
        changeOrigin: true,
      },
    },
    // 允许所有主机访问
    host: '0.0.0.0',
    // 允许特定主机访问
    allowedHosts: [
      '5173-ip0dm3bsf477vyvvj97qw-39386b98.manusvm.computer',
      '.manusvm.computer'
    ],
  },
  build: {
    // 生产环境打包配置
    minify: 'terser', // 使用 terser 进行压缩
    terserOptions: {
      compress: {
        drop_console: true, // 移除 console
        drop_debugger: true // 移除 debugger
      }
    },
    rollupOptions: {
      output: {
        // 分包策略
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
        // 用于静态资源分类打包
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
        assetFileNames: 'static/[ext]/[name]-[hash].[ext]'
      }
    },
    // 设置块大小警告的限制
    chunkSizeWarningLimit: 1500,
    // 启用源码映射
    sourcemap: false
  }
});

