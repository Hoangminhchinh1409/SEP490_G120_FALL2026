-- Migration: 20261123_restrict_als_warehouses.sql
-- Chuẩn hóa danh sách các kho thực tế thuộc hệ thống ALS (type = 'ALS Warehouse', customer_id IS NULL)
-- và phân loại lại các điểm không thuộc hệ thống kho ALS mà không làm hỏng khóa ngoại từ orders / trip_stops.

BEGIN;

-- 1. Chuẩn hóa 4 kho ALS thực tế hiện có trong hệ thống
UPDATE locations
SET
  name = 'Kho ALS Cảng HKQT Nội Bài (ALSC)',
  type = 'ALS Warehouse',
  customer_id = NULL,
  address = 'Cảng Hàng không Quốc tế Nội Bài, Sóc Sơn, Hà Nội',
  province = 'Hà Nội',
  latitude = 21.218700,
  longitude = 105.804200,
  updated_at = NOW()
WHERE id = 1;

UPDATE locations
SET
  name = 'Kho Hàng không kéo dài ALS Bắc Ninh (ALSB)',
  type = 'ALS Warehouse',
  customer_id = NULL,
  address = 'KCN Yên Phong 1, Xã Yên Trung, Huyện Yên Phong, Bắc Ninh',
  province = 'Bắc Ninh',
  latitude = 21.196900,
  longitude = 105.973300,
  updated_at = NOW()
WHERE id = 29;

UPDATE locations
SET
  name = 'Kho ALS ICD Mỹ Đình (ALSW)',
  type = 'ALS Warehouse',
  customer_id = NULL,
  address = 'Cảng cạn ICD Mỹ Đình, 17 Phạm Hùng, Phường Mỹ Đình 2, Nam Từ Liêm, Hà Nội',
  province = 'Hà Nội',
  latitude = 21.027800,
  longitude = 105.776900,
  updated_at = NOW()
WHERE id = 30;

UPDATE locations
SET
  name = 'Kho Hàng không kéo dài ALS Thái Nguyên (ALST)',
  type = 'ALS Warehouse',
  customer_id = NULL,
  address = 'KCN Yên Bình, Phường Đồng Tiến, TP. Phổ Yên, Thái Nguyên',
  province = 'Thái Nguyên',
  latitude = 21.431200,
  longitude = 105.882100,
  updated_at = NOW()
WHERE id = 32;

-- 2. Bổ sung 2 kho ALS thực tế còn thiếu (ALSE Đông Hà Nội tại VSIP Bắc Ninh & ALS Gia Lâm - Long Biên)
INSERT INTO locations (
  name,
  type,
  customer_id,
  address,
  province,
  latitude,
  longitude,
  receiving_hours,
  geofence_radius,
  created_by
)
SELECT
  'Kho Hàng không kéo dài ALS Đông Hà Nội (ALSE)',
  'ALS Warehouse',
  NULL,
  'Số 10, Đường số 5, KCN VSIP Bắc Ninh, Từ Sơn, Bắc Ninh',
  'Bắc Ninh',
  21.116500,
  105.974800,
  '24/7',
  200,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM locations
  WHERE COALESCE(customer_id, 0) = 0
    AND (
      name = 'Kho Hàng không kéo dài ALS Đông Hà Nội (ALSE)'
      OR address = 'Số 10, Đường số 5, KCN VSIP Bắc Ninh, Từ Sơn, Bắc Ninh'
    )
);

INSERT INTO locations (
  name,
  type,
  customer_id,
  address,
  province,
  latitude,
  longitude,
  receiving_hours,
  geofence_radius,
  created_by
)
SELECT
  'Kho ALS Gia Lâm - Long Biên (ALSW)',
  'ALS Warehouse',
  NULL,
  'Số 200/8 Nguyễn Sơn, Phường Bồ Đề, Long Biên, Hà Nội',
  'Hà Nội',
  21.045200,
  105.875800,
  '24/7',
  200,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM locations
  WHERE COALESCE(customer_id, 0) = 0
    AND (
      name = 'Kho ALS Gia Lâm - Long Biên (ALSW)'
      OR address = 'Số 200/8 Nguyễn Sơn, Phường Bồ Đề, Long Biên, Hà Nội'
    )
);

-- 3. Phân loại lại các điểm không thuộc hệ thống kho ALS (giữ nguyên bản ghi để bảo toàn FK từ orders & trip_stops)
UPDATE locations
SET
  type = 'External Warehouse',
  updated_at = NOW()
WHERE id = 33;

UPDATE locations
SET
  type = 'Customer Site',
  updated_at = NOW()
WHERE id IN (38, 105, 107);

COMMIT;
