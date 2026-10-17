import { defineConfig } from 'wxt';
import { contentMatches } from './src/core/platform-catalog';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  webExt: { disabled: true },
  manifest: {
    name: 'Camp vé · 1Zone Assistant',
    description: 'Camp vé theo ưu tiên: tự chọn khu/ghế, đặt số lượng và đi tới checkout.',
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: [...contentMatches],
    icons: { 128: 'icon-128.png' },
    action: { default_title: 'Camp vé · 1Zone Assistant' },
  },
});
