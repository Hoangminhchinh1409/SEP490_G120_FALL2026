# Project Guidelines & Coding Rules

Khi phát triển, sửa lỗi hoặc tái cấu trúc mã nguồn trong dự án này, luôn tuân thủ các quy chuẩn sau:

## 1. Back-end Rules
Tham chiếu chi tiết tại [BE/CODING_RULES.md](file:///c:/Users/admin/Desktop/ALS-LTDS/SEP490_G120_FALL2026/BE/CODING_RULES.md):
- **Kiến trúc hệ thống 2 Processes (Cùng codebase):**
  - `API Process`: Chạy Express 5, cung cấp REST API chuẩn `/api/v1` (JWT httpOnly cookies, RBAC).
  - `Job Worker Process`: Chạy `node-cron` cho các background jobs (`JOB-01` đến `JOB-06`), bắt buộc dùng **PostgreSQL advisory locks** (`SELECT pg_try_advisory_lock(...)`) để chống race condition.
- **Mô hình phân tầng Module 3 lớp (Package Diagram):**
  - `Entry modules` (driver, tracking, monitoring, dashboard, news, workflows) $\rightarrow$ gọi xuống `Business modules`.
  - `Business modules` (orders, trips, incidents, claims, vendors, documents) $\rightarrow$ gọi xuống `Base modules`.
  - `Base modules` (fleet, customers, locations, users, auth, notifications): **TUYỆT ĐỐI KHÔNG** import hay chứa business rules của module khác.
- **Kiến trúc 3 tầng nội bộ từng module:**
  - `Routes`: Chỉ định nghĩa endpoint `/api/v1/...` và gắn middleware.
  - `Controllers`: Nhận `req`, gọi service, trả `res.status().json()`.
  - `Services`: Xử lý nghiệp vụ (business logic), không đụng vào `req` hoặc `res`.
  - `Models`: Tầng truy vấn database (sử dụng Prisma, Supabase SDK hoặc pg pool).
- **An toàn Database & Truy vấn:**
  - Cơ sở dữ liệu: PostgreSQL 16 hosted trên Supabase (36 tables, Prisma migrations).
  - Luôn sử dụng parameterized queries (`$1`, `$2`...) đối với raw SQL để chống SQL Injection.
  - Luôn kiểm tra soft delete (`deleted_at IS NULL`) khi query các bảng hỗ trợ soft delete.
  - Sử dụng chính xác các giá trị ENUM trong database (`orders.status`, `trips.status`, `trucks.status`...).
- **Tích hợp dịch vụ bên ngoài (External Services):**
  - Tuân thủ mã API: Cloudinary (`API-02`, `API-03`), Google Maps (`API-01`, `API-05`), Vehicle GPS (`API-04`), Gemini AI (`API-06`), Vendor Systems (`API-07`), Email Service.
- **Bảo mật (Security):**
  - Băm mật khẩu bằng `bcrypt` (salt rounds $\ge 10$).
  - Lưu trữ JWT trong `httpOnly` cookie.
  - Tuyệt đối KHÔNG log mật khẩu/token và KHÔNG trả về `password_hash` trong bất kỳ response nào.
- **Quy chuẩn mã nguồn:**
  - Naming: camelCase cho hàm/biến, UPPER_SNAKE_CASE cho hằng số và enum.
  - Tập trung `module.exports` ở cuối file.

## 2. Front-end Rules
Tham chiếu chi tiết cấu trúc App Router tại [FE/app](file:///c:/Users/admin/Desktop/ALS-LTDS/SEP490_G120_FALL2026/FE/app) và [FE/src](file:///c:/Users/admin/Desktop/ALS-LTDS/SEP490_G120_FALL2026/FE/src):
- **Cấu trúc phân quyền Route Groups (`app/`):**
  - `(public)`: home, news, login, forgot-password, reset-password, order form `/f/[token]`, tracking `/t/[token]`.
  - `admin`: users, roles, system logs, settings, dashboard.
  - `manager`: dashboard, orders, fleet, shifts, vendors, incidents, claims, news.
  - `dispatcher`: orders, order details, locations, trip assignment, monitoring, incidents, contracts.
  - `driver`: my trips, trip execution, report incident, shifts (PWA).
- **Tầng cấu trúc `src/`:**
  - `views, components, layouts` $\rightarrow$ `contexts, providers` (Auth, Role Guard, Theme) $\rightarrow$ `api/apiClient` (gửi kèm credentials, map mã lỗi hệ thống MSG) $\rightarrow$ Backend API `/api/v1`.
- **Phân hệ Driver PWA (`src/pwa/`):**
  - Tích hợp Service Worker, hàng đợi ngoại tuyến `IndexedDB outbox`, `sync manager` để đồng bộ offline khi có mạng, và `photo compressor` để nén ảnh chứng từ/biên bản trước khi upload trực tiếp lên Cloudinary với signed URL.
- **Nguyên tắc Agent Next.js:**
  - Giữ nguyên các khối cấu hình agent tự sinh trong `FE/AGENTS.md` để đảm bảo git commit sạch sẽ.

## 3. Project Specification & Business Rules
Tài liệu đặc tả yêu cầu phần mềm chính thức (SRS) mới nhất của dự án được lưu tại [srs_doc.txt](file:///c:/Users/admin/Desktop/ALS-LTDS/SEP490_G120_FALL2026/srs_doc.txt).
- **Bám sát Use Cases & Prototype:** Luôn code bám sát 100% theo các Use Case Specifications (UC-01 đến UC-48), Screen Specifications, Prototype UI và các Business Rules (BR-01 đến BR-34+) trong tài liệu này.
- **Tính chính xác của dữ liệu & Nghiệp vụ:** Khi xây dựng API Backend hay giao diện Frontend, các trường dữ liệu, validation, trạng thái (status enums) và thông báo hệ thống (system messages MSG) phải chuẩn xác theo tài liệu SRS, không tự ý thêm bớt sai lệch so với prototype và use case.
