import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  // 构建产物内联为单个 dist/index.html，双击即可游玩
  plugins: [viteSingleFile()],
});
