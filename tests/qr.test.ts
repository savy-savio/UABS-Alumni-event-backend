import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';

test('QR library renders PNG data for opaque token strings', async () => {
  const png = await QRCode.toBuffer('opaque-verification-token-test', { type: 'png', errorCorrectionLevel: 'H', width: 480, margin: 4 });
  assert.ok(png.length > 100);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});
