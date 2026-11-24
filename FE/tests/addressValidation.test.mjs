import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateVietnamAddressDetail,
  validateVietnamAddressText,
  doesVietmapItemMatchDetail,
  stripAddressUnitPrefix,
  markAddressVerified,
  markAddressUnverified,
  clearAddressVerification
} from '../src/utils/addressValidation.js';

describe('Address Validation & Anti-Gibberish Guard (2026)', () => {
  test('Từ chối chuỗi gõ linh tinh / vô nghĩa giống hiohuibs vvd auvasayi', () => {
    const gibberishCases = [
      'hiohuibs vvd auvasayi, Phường Hồng Hà, Thành phố Hà Nội',
      'asdasd qweqwe, Phường Hồng Hà, Thành phố Hà Nội',
      'qưeqweqweqweqweqwe, Xã Xuân Lương, Thành phố Bắc Ninh',
      'fghfgh jkljkl, Phường Mai Động, Thành phố Hà Nội',
      '12345678, Phường Hồng Hà, Thành phố Hà Nội',
      'aaaa bbbb, Phường Hồng Hà, Thành phố Hà Nội',
      'test linh tinhh, Phường Hồng Hà, Thành phố Hà Nội',
      'ba ba ba, Phường Hồng Hà, Thành phố Hà Nội',
      'xzc vbn mnb, Phường Hồng Hà, Thành phố Hà Nội',
      'Phường Hồng Hà, Thành phố Hà Nội',
      'MộtTừDuyNhất, Phường Hồng Hà, Thành phố Hà Nội'
    ];

    for (const addr of gibberishCases) {
      const res = validateVietnamAddressText(addr);
      assert.equal(res.valid, false, `Phải từ chối địa chỉ không hợp lệ: "${addr}"`);
      assert.ok(res.reason.length > 0);
    }
  });

  test('Chấp nhận địa chỉ tiếng Việt hợp lệ, số lô KCN, tòa nhà thực tế', () => {
    const validCases = [
      '142 Nguyễn Văn Cừ, Phường Bồ Đề, Thành phố Hà Nội',
      'Số 10, Đường 5, KCN VSIP, Phường Từ Sơn, Thành phố Bắc Ninh',
      'Lô CN-05, KCN Yên Phong, Phường Yên Phong, Thành phố Bắc Ninh',
      '45 Giải Phóng, Phường Đồng Tâm, Thành phố Hà Nội',
      '68 Khuất Duy Tiến, Phường Thanh Xuân Trung, Thành phố Hà Nội',
      'Tòa nhà Keangnam, Phạm Hùng, Phường Mễ Trì, Thành phố Hà Nội',
      'Kho ALS Nội Bài, Xã Nội Bài, Thành phố Hà Nội',
      'Công ty TNHH Canon Việt Nam, Xã Thiên Lộc, Thành phố Hà Nội',
      '20 Lò Đúc, Phường Phạm Đình Hổ, Thành phố Hà Nội'
    ];

    for (const addr of validCases) {
      const res = validateVietnamAddressText(addr);
      assert.equal(res.valid, true, `Phải chấp nhận địa chỉ hợp lệ "${addr}", lý do từ chối: ${res.reason}`);
    }
  });

  test('Chặn fallback về tên Phường/Xã trong đối chiếu VietMap và cho phép địa chỉ thực tế', () => {
    const wardFallbackResult = {
      name: 'Phường Hồng Hà',
      display: 'Phường Hồng Hà, Thành phố Hà Nội',
      boundaries: [{ type: 2, full_name: 'Phường Hồng Hà' }, { type: 0, name: 'Thành phố Hà Nội' }]
    };

    assert.equal(
      doesVietmapItemMatchDetail(wardFallbackResult, 'hiohuibs vvd auvasayi', 'Phường Hồng Hà', 'Thành phố Hà Nội'),
      false
    );

    const realRoadResult = {
      name: '142 Nguyễn Văn Cừ',
      display: '142 Nguyễn Văn Cừ, Phường Bồ Đề, Thành phố Hà Nội',
      boundaries: [{ type: 2, full_name: 'Phường Bồ Đề' }, { type: 0, name: 'Thành phố Hà Nội' }]
    };

    assert.equal(
      doesVietmapItemMatchDetail(realRoadResult, '142 Nguyễn Văn Cừ', 'Phường Bồ Đề', 'Thành phố Hà Nội'),
      true
    );

    const realKcnResult = {
      name: 'Khu Công Nghiệp Yên Phong',
      display: 'Khu Công Nghiệp Yên Phong, Phường Yên Phong, Thành phố Bắc Ninh',
      boundaries: [{ type: 2, full_name: 'Phường Yên Phong' }, { type: 0, name: 'Thành phố Bắc Ninh' }]
    };

    assert.equal(
      stripAddressUnitPrefix('Lô CN-05, KCN Yên Phong'),
      'KCN Yên Phong'
    );
    assert.equal(
      doesVietmapItemMatchDetail(realKcnResult, 'Lô CN-05, KCN Yên Phong', 'Phường Yên Phong', 'Thành phố Bắc Ninh'),
      true
    );
  });

  test('requireVietmap chặn địa chỉ chưa khớp VietMap và mở khóa sau khi xác thực', () => {
    const addr = 'Đường Mới Không Tồn Tại, Phường Hồng Hà, Thành phố Hà Nội';
    markAddressUnverified(addr, 'Không tìm thấy trên VietMap');
    const blocked = validateVietnamAddressText(addr, { requireVietmap: true });
    assert.equal(blocked.valid, false);
    assert.match(blocked.reason, /VietMap/);

    markAddressVerified(addr, 21.0285, 105.8542);
    const verified = validateVietnamAddressText(addr, { requireVietmap: true });
    assert.equal(verified.valid, true);

    clearAddressVerification(addr);
  });

  test('validateVietnamAddressDetail chặn ký tự lặp và từ lặp', () => {
    assert.equal(validateVietnamAddressDetail('aaaaa').valid, false);
    assert.equal(validateVietnamAddressDetail('123456').valid, false);
  });
});
