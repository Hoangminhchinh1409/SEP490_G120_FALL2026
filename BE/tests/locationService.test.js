const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const locationModelPath = require.resolve(path.resolve(__dirname, '../models/locationModel'));
const locationServicePath = require.resolve(path.resolve(__dirname, '../services/locationService'));

let mockLocations = [];

require.cache[locationModelPath] = {
  id: locationModelPath,
  filename: locationModelPath,
  loaded: true,
  exports: {
    findAll: async () => mockLocations,
    create: async (data) => data,
    update: async (id, data) => ({ id, ...data }),
    findRelatedOrders: async () => [],
    findRelatedTrips: async () => [],
    reassignOrdersToDefaultLocation: async () => {},
    deleteById: async () => {},
    delete: async () => {}
  }
};

delete require.cache[locationServicePath];
const {
  isAlsWarehouseType,
  formatLocation,
  getAlsWarehouses
} = require('../services/locationService');

describe('Location Service - Giới hạn Danh sách Kho Thực Tế ALS', () => {
  beforeEach(() => {
    mockLocations = [
      {
        id: 109,
        name: 'Kho ALS Gia Lâm - Long Biên (ALSW)',
        type: 'ALS Warehouse',
        customer_id: null,
        address: 'Số 200/8 Nguyễn Sơn, Phường Bồ Đề, Long Biên, Hà Nội',
        province: 'Hà Nội',
        latitude: 21.0452,
        longitude: 105.8758
      },
      {
        id: 108,
        name: 'Kho Hàng không kéo dài ALS Đông Hà Nội (ALSE)',
        type: 'ALS Warehouse',
        customer_id: null,
        address: 'Số 10, Đường số 5, KCN VSIP Bắc Ninh, Từ Sơn, Bắc Ninh',
        province: 'Bắc Ninh',
        latitude: 21.1165,
        longitude: 105.9748
      },
      {
        id: 105,
        name: 'qưeqweqweqweqweqwe, Xã Xuân Lương, Thành phố Bắc Ninh',
        type: 'Customer Site',
        customer_id: null,
        address: 'qưeqweqweqweqweqwe, Xã Xuân Lương, Thành phố Bắc Ninh',
        province: 'Bắc Ninh',
        latitude: 21.0285,
        longitude: 105.8542
      },
      {
        id: 38,
        name: 'KCN Tiên Sơn, Bắc Ninh',
        type: 'Warehouse',
        customer_id: null,
        address: 'KCN Tiên Sơn, Bắc Ninh',
        province: 'Bắc Ninh',
        latitude: 21.0285,
        longitude: 105.8542
      },
      {
        id: 34,
        name: 'Kho Cửa khẩu Quốc tế Kim Thành (Lào Cai)',
        type: 'Customs Checkpoint',
        customer_id: null,
        address: 'Khu thương mại Kim Thành, Phường Duyên Hải, TP. Lào Cai, Lào Cai',
        province: 'Lào Cai',
        latitude: 22.5089,
        longitude: 103.9556
      },
      {
        id: 33,
        name: 'Kho Hàng không kéo dài ALS Hải Phòng (ALSH)',
        type: 'External Warehouse',
        customer_id: null,
        address: 'KCN Nam Cầu Kiền, Xã Kiền Bái, Huyện Thủy Nguyên, Hải Phòng',
        province: 'Hải Phòng',
        latitude: 20.8924,
        longitude: 106.6851
      },
      {
        id: 32,
        name: 'Kho Hàng không kéo dài ALS Thái Nguyên (ALST)',
        type: 'ALS Warehouse',
        customer_id: null,
        address: 'KCN Yên Bình, Phường Đồng Tiến, TP. Phổ Yên, Thái Nguyên',
        province: 'Thái Nguyên',
        latitude: 21.4312,
        longitude: 105.8821
      },
      {
        id: 31,
        name: 'Kho Cửa khẩu Quốc tế Hữu Nghị (Lạng Sơn)',
        type: 'Customs Checkpoint',
        customer_id: null,
        address: 'Khu vực Cửa khẩu Quốc tế Hữu Nghị, Thị trấn Đồng Đăng, Cao Lộc, Lạng Sơn',
        province: 'Lạng Sơn',
        latitude: 21.9833,
        longitude: 106.7167
      },
      {
        id: 30,
        name: 'Kho ALS ICD Mỹ Đình (ALSW)',
        type: 'ALS Warehouse',
        customer_id: null,
        address: 'Cảng cạn ICD Mỹ Đình, 17 Phạm Hùng, Phường Mỹ Đình 2, Nam Từ Liêm, Hà Nội',
        province: 'Hà Nội',
        latitude: 21.0278,
        longitude: 105.7769
      },
      {
        id: 29,
        name: 'Kho Hàng không kéo dài ALS Bắc Ninh (ALSB)',
        type: 'ALS Warehouse',
        customer_id: null,
        address: 'KCN Yên Phong 1, Xã Yên Trung, Huyện Yên Phong, Bắc Ninh',
        province: 'Bắc Ninh',
        latitude: 21.1969,
        longitude: 105.9733
      },
      {
        id: 50,
        name: 'Kho Khách hàng cạnh ALS Nội Bài',
        type: 'ALS Warehouse',
        customer_id: 21,
        address: 'Sóc Sơn, Hà Nội',
        province: 'Hà Nội',
        latitude: 21.22,
        longitude: 105.81
      },
      {
        id: 1,
        name: 'Kho ALS Cảng HKQT Nội Bài (ALSC)',
        type: 'ALS Warehouse',
        customer_id: null,
        address: 'Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội',
        province: 'Hà Nội',
        latitude: 21.2187,
        longitude: 105.8042
      }
    ];
  });

  describe('1. isAlsWarehouseType()', () => {
    test('Chấp nhận đúng các biến thể ALS Warehouse', () => {
      assert.equal(isAlsWarehouseType('ALS Warehouse'), true);
      assert.equal(isAlsWarehouseType('ALS_WAREHOUSE'), true);
      assert.equal(isAlsWarehouseType('ALS warehouse'), true);
    });

    test('Từ chối các loại địa điểm khác dù không gắn customer_id', () => {
      assert.equal(isAlsWarehouseType('Warehouse'), false);
      assert.equal(isAlsWarehouseType('Customs Checkpoint'), false);
      assert.equal(isAlsWarehouseType('Customer Site'), false);
      assert.equal(isAlsWarehouseType('External Warehouse'), false);
      assert.equal(isAlsWarehouseType('Company location'), false);
      assert.equal(isAlsWarehouseType(null), false);
      assert.equal(isAlsWarehouseType(''), false);
    });
  });

  describe('2. formatLocation()', () => {
    test('Chỉ gán is_als_hub = true khi customer_id là null và type là ALS Warehouse', () => {
      const alsHub = formatLocation({
        id: 1,
        name: 'Kho ALS Cảng HKQT Nội Bài (ALSC)',
        type: 'ALS Warehouse',
        customer_id: null,
        address: 'Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội',
        province: 'Hà Nội',
        latitude: 21.2187,
        longitude: 105.8042
      });
      assert.equal(alsHub.is_als_hub, true);
      assert.equal(alsHub.type, 'KHO_HANG_KHONG');
    });

    test('Loại bỏ Hữu Nghị, Kim Thành, KCN Tiên Sơn, ALSH và địa điểm thuộc khách hàng (kể cả tên có chữ ALS)', () => {
      const huuNghi = formatLocation(mockLocations.find((l) => l.id === 31));
      const kimThanh = formatLocation(mockLocations.find((l) => l.id === 34));
      const tienSon = formatLocation(mockLocations.find((l) => l.id === 38));
      const alsh = formatLocation(mockLocations.find((l) => l.id === 33));
      const customerNamedAls = formatLocation(mockLocations.find((l) => l.id === 50));

      assert.equal(huuNghi.is_als_hub, false);
      assert.equal(kimThanh.is_als_hub, false);
      assert.equal(tienSon.is_als_hub, false);
      assert.equal(alsh.is_als_hub, false);
      assert.equal(customerNamedAls.is_als_hub, false);
    });
  });

  describe('3. getAlsWarehouses()', () => {
    test('Chỉ trả về đúng 6 kho thực tế của ALS và luôn xếp Nội Bài (id = 1) đầu tiên', async () => {
      const result = await getAlsWarehouses();
      assert.equal(result.length, 6);
      assert.equal(result[0].raw_id, 1);
      assert.equal(result[0].name, 'Kho ALS Cảng HKQT Nội Bài (ALSC)');
      assert.deepEqual(
        result.map((r) => r.raw_id),
        [1, 30, 109, 29, 108, 32]
      );
      assert.equal(result.every((r) => r.is_als_hub === true), true);
    });
  });
});
