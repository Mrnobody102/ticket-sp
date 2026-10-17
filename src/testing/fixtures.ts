import zone from '../../fixtures/zone.html?raw';
import assigned from '../../fixtures/assigned.html?raw';
import seats from '../../fixtures/seats.html?raw';
import canvas from '../../fixtures/canvas.html?raw';
import waiting from '../../fixtures/waiting.html?raw';
import challenge from '../../fixtures/challenge.html?raw';
import checkout from '../../fixtures/checkout.html?raw';
import notReady from '../../fixtures/not-ready.html?raw';
import unknown from '../../fixtures/unknown.html?raw';
import event from '../../fixtures/event.html?raw';
import mixed from '../../fixtures/mixed.html?raw';

export const fixtures = {
  zone: { label: 'Chọn khu vực', html: zone },
  assigned: { label: 'Ghế tự cấp', html: assigned },
  seats: { label: 'Chọn ghế', html: seats },
  canvas: { label: 'Canvas', html: canvas },
  waiting: { label: 'Phòng chờ', html: waiting },
  challenge: { label: 'Xác minh', html: challenge },
  checkout: { label: 'Thanh toán', html: checkout },
  'not-ready': { label: 'Chưa mở bán', html: notReady },
  unknown: { label: 'Chưa nhận diện', html: unknown },
  event: { label: 'Trang concert', html: event },
  mixed: { label: 'Nhiều cách chọn', html: mixed },
};
export type FixtureName = keyof typeof fixtures;
