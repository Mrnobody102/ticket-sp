import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  webExt: { disabled: true },
  manifest: {
    name: 'Camp vé · 1Zone Assistant',
    description: 'Nhắc giờ, theo dõi trang vé và làm nổi bật hạng vé ưu tiên trên 1Zone.',
    version: '0.1.0',
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: ['https://ticket.1zone.vn/*'],
    icons: { 128: 'icon-128.png' },
    action: { default_title: 'Camp vé · 1Zone Assistant' },
  },
});
