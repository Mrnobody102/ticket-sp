import { defineContentScript } from 'wxt/utils/define-content-script';
import { installOnezoneMapBridge } from '../platforms/onezone-map-bridge';

export default defineContentScript({
  matches: ['https://ticket.1zone.vn/*'], world: 'MAIN', runAt: 'document_start',
  main() { installOnezoneMapBridge(window); },
});
