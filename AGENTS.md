# Project Guidelines & Coding Rules

Khi phát triển, sửa lỗi hoặc tái cấu trúc mã nguồn trong dự án này, luôn tuân thủ các quy chuẩn sau:

## 1. Back-end Rules
Tham chiếu chi tiết tại [BE/CODING_RULES.md](file:///c:/Users/Admin/Downloads/SEP490_G120_FALL2026/BE/CODING_RULES.md):
- **Kiến trúc 3 tầng (3-tier architecture):**
  - `Routes`: Chỉ định nghĩa endpoint và gắn middleware.
  - `Controllers`: Nhận `req`, gọi service, trả `res.status().json()`.
  - `Services`: Xử lý nghiệp vụ (business logic), không đụng vào `req` hoặc `res`.
  - `Models`: Tầng truy vấn database (sử dụng Supabase SDK hoặc pg pool).
- **An toàn Database & Truy vấn:**
  - Luôn sử dụng parameterized queries (`$1`, `$2`...) đối với raw SQL để chống SQL Injection.
  - Luôn kiểm tra soft delete (`deleted_at IS NULL`) khi query các bảng hỗ trợ soft delete.
  - Sử dụng chính xác các giá trị ENUM trong database (`orders.status`, `trips.status`, `trucks.status`...).
- **Bảo mật (Security):**
  - Băm mật khẩu bằng `bcrypt` (salt rounds >= 10).
  - Lưu trữ JWT trong `httpOnly` cookie.
  - Tuyệt đối KHÔNG log mật khẩu/token và KHÔNG trả về `password_hash` trong bất kỳ response nào.
- **Quy chuẩn mã nguồn:**
  - Naming: camelCase cho hàm/biến, UPPER_SNAKE_CASE cho hằng số và enum.
  - Tập trung `module.exports` ở cuối file.

## 2. Front-end Rules
Tham chiếu chi tiết tại [FE/AGENTS.md](file:///c:/Users/Admin/Downloads/SEP490_G120_FALL2026/FE/AGENTS.md):
- Tuân thủ cấu trúc App Router và các quy chuẩn cập nhật mới nhất của Next.js.
- Giữ nguyên các khối cấu hình agent tự sinh để đảm bảo git commit sạch sẽ.

## 3. Project Specification & Business Rules
Tài liệu đặc tả yêu cầu phần mềm chính thức (SRS) mới nhất của dự án được lưu tại [srs_doc.txt](file:///c:/Users/Admin/Downloads/SEP490_G120_FALL2026/srs_doc.txt) (đồng bộ từ bản cập nhật mới nhất `Report-3_Software Requirement Specification_1.docx`).
- **Bám sát Use Cases & Prototype:** Luôn code bám sát 100% theo các Use Case Specifications (tác nhân, luồng chính, luồng phụ), Screen Specifications, Prototype UI (danh sách trường dữ liệu, các nút bấm, luồng màn hình) và các Business Rules (BR-01 đến BR-25+) trong tài liệu này.
- **Tính chính xác của dữ liệu & Nghiệp vụ:** Khi xây dựng API Backend hay giao diện Frontend, các trường dữ liệu, validation, trạng thái (status enums) và thông báo hệ thống (system messages MSG) phải chuẩn xác theo tài liệu SRS, không tự ý thêm bớt sai lệch so với prototype và use case.


