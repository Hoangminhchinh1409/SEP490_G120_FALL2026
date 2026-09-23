## I. TỔNG QUAN TỔ CHỨC & KIẾN TRÚC HỆ THỐNG

### 1. Thông tin Dự án
* **Tên sản phẩm**: NEXLOG - Smart Logistics Tracking and Dispatch System
* **Mã dự án**: `ALS-LTDS`
* **Phân khúc nghiệp vụ**: Vận tải đường bộ hàng nặng (500kg – 4.000kg) qua 7 kho trung chuyển cốt lõi (4 kho Sân bay Nội Bài + 3 kho cửa khẩu kéo dài: Mỹ Đình, Gia Lâm, Bắc Ninh).
* **Mô hình kết nối**: Web Admin (Điều phối viên / Manager / Admin) + PWA Offline-First (Tài xế) + Landing Page Tra cứu không Login (Khách hàng).

---

### 2. Công nghệ & Hạ tầng (Tech Stack Standard)

| Thành phần | Công nghệ / Thư viện Chọn lựa | Ghi chú & Ràng buộc Kỹ thuật |
| :--- | :--- | :--- |
| **Frontend Web Admin & Tracking** | ReactJS (Vite), Tailwind CSS / Ant Design, Zustand / Redux Toolkit | Triển khai trên **Vercel**. Tối ưu hiển thị bảng biểu điều phối phức tạp. |
| **Mobile App Driver** | Progressive Web App (PWA), `vite-plugin-pwa`, Service Worker, `IndexedDB` | **Offline-First**: Cho phép lưu đệm ảnh/trạng thái khi mất sóng 4G trong kho bọc thép, tự đồng bộ khi có mạng. |
| **Backend REST API** | Next.js/Express | RESTful APIs, JWT Authentication, phân quyền 5 nhóm vai trò. |
| **Database** | PostgreSQL / MySQL (Relational DB) | **Bắt buộc dùng SQL** theo chỉ đạo của giảng viên để chuẩn hóa ERD quan hệ. |
| **Third-Party APIs** | Google Maps API (Distance Matrix), Cloudinary / S3 | Tự động tính khoảng cách km; Lưu trữ ảnh chì & POD (Tự động xóa sau 60–90 ngày theo NĐ 13/2023). |

---

## II. THIẾT KẾ CƠ SỞ DỮ LIỆU CỐT LÕI (DATABASE SCHEMA)

Toàn bộ hệ thống xoay quanh thực thể duy nhất: **`OrderID`**.

```sql
-- 1. Bảng Người dùng (Users)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    role VARCHAR(20) CHECK (role IN ('ADMIN', 'MANAGER', 'DISPATCHER', 'DRIVER', 'OPS')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Phương tiện (Vehicles)
CREATE TABLE vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type VARCHAR(20) CHECK (vehicle_type IN ('1.25T', '2.5T', '4T')),
    status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'IN_TRANSIT', 'MAINTENANCE'))
);

-- 3. Bảng Kho bãi (Warehouses)
CREATE TABLE warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_terminal BOOLEAN DEFAULT FALSE
);

-- 4. Bảng Đơn hàng (Orders) - Trung tâm của Hệ thống
CREATE TABLE orders (
    order_id VARCHAR(30) PRIMARY KEY, -- Mã OrderID duy nhất
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(100),
    pickup_address TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    cargo_type VARCHAR(50),
    weight_kg DECIMAL(10, 2) NOT NULL,
    length_cm DECIMAL(10, 2) NOT NULL,
    width_cm DECIMAL(10, 2) NOT NULL,
    height_cm DECIMAL(10, 2) NOT NULL,
    is_stackable BOOLEAN DEFAULT TRUE,
    chargeable_weight DECIMAL(10, 2), -- Tự động tính = (D x R x C)/5000
    suggested_vehicle_type VARCHAR(20),
    status VARCHAR(30) DEFAULT 'CREATED' CHECK (status IN (
        'CREATED', 'CONFIRMED', 'VEHICLE_ASSIGNED', 'CARGO_PICKED_UP', 
        'IN_TRANSIT', 'ARRIVED_TRANSIT_WAREHOUSE', 'DELIVERED', 'CANCELLED', 'INCIDENT'
    )),
    dispatcher_id INT REFERENCES users(user_id),
    vehicle_id INT REFERENCES vehicles(vehicle_id),
    driver_id INT REFERENCES users(user_id),
    vendor_name VARCHAR(100), -- Nếu thuê ngoài Vendor
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng Lưu vết Lịch sử Trạng thái & Minh chứng (Order_Milestones)
CREATE TABLE order_milestones (
    milestone_id SERIAL PRIMARY KEY,
    order_id VARCHAR(30) REFERENCES orders(order_id),
    status VARCHAR(30) NOT NULL,
    updated_by INT REFERENCES users(user_id),
    location_name VARCHAR(255),
    lead_seal_photo_url TEXT, -- Ảnh niêm chì + biển số xe
    pod_photo_url TEXT,       -- Ảnh biên bản bàn giao POD
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng Phí phát sinh (Order_Surcharges)
CREATE TABLE order_surcharges (
    surcharge_id SERIAL PRIMARY KEY,
    order_id VARCHAR(30) REFERENCES orders(order_id),
    surcharge_type VARCHAR(100) NOT NULL, -- Phí lưu xe, Phí thông quan sớm,...
    amount DECIMAL(12, 2) NOT NULL,
    is_off_book BOOLEAN DEFAULT FALSE, -- Cờ Thu hộ (Off-book)
    created_by INT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bảng Báo cáo Sự cố (Order_Incidents)
CREATE TABLE order_incidents (
    incident_id SERIAL PRIMARY KEY,
    order_id VARCHAR(30) REFERENCES orders(order_id),
    reported_by INT REFERENCES users(user_id),
    incident_type VARCHAR(50) CHECK (incident_type IN ('VEHICLE_BREAKDOWN', 'CARGO_DAMAGE', 'TRAFFIC_DELAY', 'CUSTOMS_HOLD')),
    description TEXT NOT NULL,
    evidence_photo_url TEXT,
    fault_party VARCHAR(20) CHECK (fault_party IN ('ALS', 'CUSTOMER', 'EXTERNAL')),
    resolution_status VARCHAR(20) DEFAULT 'PENDING' CHECK (resolution_status IN ('PENDING', 'APPROVED', 'RESOLVED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

## IV. LÝ THUYẾT & KỸ THUẬT XỬ LÝ OFFLINE PWA CHO TÀI XẾ

Do đặc thù các kho hải quan bọc thép (**Dead-zones**) bị chắn hoàn toàn sóng 4G/5G, PWA của Tài xế cần thực hiện theo đúng mô hình:

1. **Khi có mạng (Online)**:
   - Tải danh sách đơn hàng đã phân công trong ngày lưu vào **IndexedDB**.
2. **Khi vào kho mất mạng (Offline)**:
   - Tài xế chụp ảnh chì niêm phong / POD hoặc bấm nút chuyển mốc trạng thái.
   - PWA chuyển file ảnh thành `Base64` / `Blob` và lưu toàn bộ payload mutation vào `IndexedDB` local store.
   - Hiển thị thông báo trạng thái "Đã lưu ngoại tuyến (Chờ có mạng để đồng bộ)".
3. **Khi ra khỏi kho có mạng trở lại (Online Event Trigger)**:
   - Service Worker phát hiện sự kiện `navigator.onLine == true` hoặc `sync` event.
   - Tự động đẩy toàn bộ queue mutation từ `IndexedDB` lên Server API.
   - Cập nhật trạng thái chính thức và xóa queue đệm.

/Chức năng
1. Phân hệ Tiếp nhận & Điều phối Đơn hàng (Dispatcher Web Admin)Tiếp nhận & Tạo đơn (Dispatcher Order Ingestion):Nhập thông tin đơn hàng trực tiếp trên Web Admin từ các yêu cầu nhận qua Zalo hoặc Hotline2.Tự động ước tính thể tích/trọng lượng quy đổi lô hàng (Chargeable weight) theo công thức $(D \times R \times C / 5000)$ kết hợp với đặc tính xếp chồng (stackability)24.Tự động khởi tạo mã đơn hàng duy nhất (OrderID) và link tra cứu đơn hàng công khai (Public Tracking Link)24.Phân bổ Nguồn lực (Resource Allocation & Fleet Management):Phân công xe thuộc đội xe nội bộ (6 xe Thaco 1.25 tấn) hoặc gán xe thuê ngoài (Vendor phụ) cho 18 tài xế dựa trên ca làm việc và trạng thái sẵn sàng của xe/tài xế5.Gộp đơn hàng theo tỉnh (Multi-Drop Order Grouping):Hỗ trợ gộp các đơn hàng nhỏ lẻ (LTL - Less-Than-Truckload) giao cùng tỉnh/tuyến đường để tối ưu thùng xe5.Áp dụng quy tắc tính giá tự động: Giá tính theo điểm xa nhất A + 300.000 VNĐ cho mỗi điểm dừng phụ5.Ghi nhận Phí phát sinh (Agile Surcharge Logging):Ghi nhận các khoản phí phát sinh hiện trường (như phí chờ bốc dỡ, lưu xe)5.Tích hợp cờ đánh dấu "Thu hộ" (Off-book / Collection on Behalf) để tách biệt xử lý kế toán nội bộ và cô lập thuế VAT45.Ghi chú & Tập trung Dữ liệu theo OrderID (Order History & Notes):Lưu trữ tập trung toàn bộ ghi chú vận hành, ảnh niêm chì, biên bản bàn giao (POD) và tài liệu hải quan dưới một mã OrderID duy nhất34.2. Phân hệ Lái xe (Driver Progressive Web App - PWA)Ứng dụng PWA hỗ trợ Ngoại tuyến (Offline-First Driver PWA):Phát triển ứng dụng Progressive Web App tích hợp lưu trữ bộ nhớ đệm (IndexedDB) và Service Worker5.Cho phép tài xế chụp ảnh và cập nhật trạng thái bình thường ngay cả khi mất sóng 4G/5G trong các kho hải quan bọc thép (Dead-zones); dữ liệu sẽ tự động đồng bộ (Auto-sync) về máy chủ ngay khi có mạng trở lại45.Cập nhật Trạng thái Chặng (Multi-Leg Status Tracking):Cho phép tài xế cập nhật mốc trạng thái vận chuyển qua từng chặng chỉ với 1 chạm (ví dụ: Đã phân công → Đã đến kho Nội Bài → Đã đến kho Mỹ Đình → Đã giao hàng)56.Thu thập Minh chứng Hiện trường (Visual Evidence Capture):Bắt buộc chụp và tải lên ảnh niêm phong chì (phải hiển thị rõ số chì và biển số xe) ngay khi đóng hàng tại kho cảng46.Chụp và tải lên ảnh biên bản giao nhận có chữ ký (POD - Proof of Delivery) sau khi hoàn tất hạ hàng46.3. Phân hệ Khách hàng (No-Login Public Tracking Page)Trang Tra cứu Công khai không cần Đăng nhập:Khách hàng doanh nghiệp mở link tra cứu dạng Landing page nhẹ mà không cần đăng ký hay đăng nhập tài khoản3.Theo dõi Tiến độ Thời gian thực:Theo dõi 5 mốc trạng thái trung chuyển hàng hóa thời gian thực3.Xem Ảnh Niêm chì & Tải POD:Xem trực tiếp ảnh chụp chì niêm phong xe tải và tải file biên bản giao nhận (POD) đã ký3.Tải lên Chứng từ Hải quan (Public Customs Document Upload):Tải lên các bản scan tờ khai hải quan, giấy ủy quyền giao nhận trực tiếp qua link tra cứu3.Hệ thống tự động xóa/ẩn (purge) file chứng từ và hình ảnh sau 60–90 ngày để tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân và tối ưu chi phí lưu trữ37.4. Phân hệ Quản lý & Báo cáo Quản trị (Manager Oversight & BI Dashboard)Quản lý Ca làm việc & Điều chuyển Đơn (Shift Coordination):Quản lý tài khoản/ca làm việc của Điều phối viên; can thiệp phân công lại (re-assign) đối với các đơn hàng bị tồn đọng/quá hạn38.Phê duyệt Sự cố & Đền bù (Incident & Claim Approval):Phê duyệt các yêu cầu bồi thường sự cố đền bù hàng hóa hư hỏng/mất mát do Điều phối viên chuyển lên (escalate)39.Quản lý Đối tác Vận tải (Vendor Management):Quản lý danh mục và phê duyệt các nhà xe thuê ngoài khi đội xe nội bộ bị đầy tải3.Báo cáo Trực quan BI (Operational BI Dashboard):Cung cấp biểu đồ phân tích trực quan về: xu hướng doanh thu, tỷ lệ lấp đầy tải trọng xe, hiệu suất SLA của điều phối viên và chỉ số sự cố ( mục 3,6).