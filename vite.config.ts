import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Codex 的沙箱工作目录是一个 ASCII 路径映射；保留符号链接可避免
    // Vitest 在中文真实路径上回退到 /@fs/... 后找不到测试文件。
    preserveSymlinks: true,
  },
  test: {
    environment: 'jsdom',
  },
});
