import { defineConfig } from 'wxt';
import { contentMatches } from './src/core/platform-catalog';
import { ONEZONE_READ_ORIGINS } from './src/platforms/onezone-catalog';
import { TICKETBOX_READ_ORIGIN } from './src/platforms/ticketbox-catalog';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  webExt: { disabled: true },
  manifest: {
    name: 'Camp vé · 1Zone Assistant',
    description: 'Camp vé theo ưu tiên: tự chọn khu/ghế, đặt số lượng và đi tới checkout.',
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: [...contentMatches, ...[...ONEZONE_READ_ORIGINS, TICKETBOX_READ_ORIGIN].map(origin => `${origin}/*`)],
    icons: { 128: 'icon-128.png' },
    action: { default_title: 'Camp vé · 1Zone Assistant' },
  },
});
