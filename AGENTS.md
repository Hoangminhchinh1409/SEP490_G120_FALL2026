# Project Guidelines & Coding Rules — NEXLOG System

> **Phiên bản:** Cập nhật đồng bộ theo **Report-3 v2**, **Report-4 v2** và **ALS Workflow Specification** (Tháng 10/2026).  
> **Tài liệu tham chiếu chuẩn tại thư mục gốc:**
> - [SRS v2 (Đặc tả yêu cầu phần mềm - 48 UCs, 60 BRs, 86 MSGs)](file:///c:/Users/Admin/Downloads/SEP490_G120_FALL2026/srs_doc.txt)
> - [SDS v2 (Đặc tả thiết kế phần mềm - Kiến trúc, Packages, DB 36 bảng)](file:///c:/Users/Admin/Downloads/SEP490_G120_FALL2026/sds_doc.txt)
> - [ALS Workflow (Quy trình vận hành 6 giai đoạn thực tế của ALS)](file:///c:/Users/Admin/Downloads/SEP490_G120_FALL2026/workflow_doc.txt)

---

## 1. Kiến trúc Hệ thống & Cấu trúc Thư mục (Software Architecture & Project Structure)

Hệ thống tuân thủ mô hình **Kiến trúc 3 tầng dạng Khối nguyên khối mô-đun hóa (Three-Tier Modular Monolith Architecture)** được quy định tại Report 4 (Mục I.1 & I.2).

### 1.1 Tổng quan Kiến trúc 3 tầng
1. **Client Tier (Front-end):**
   - Ứng dụng Next.js (App Router), React, responsive trên desktop và mobile.
   - Phục vụ đồng thời: Website công khai, 3 Cổng thông tin nhân viên (`Admin`, `Manager`, `Dispatcher`) và **Driver PWA** (hỗ trợ Service Worker và hoạt động ngoại tuyến với IndexedDB).
2. **Application Tier (Back-end & Background Jobs):**
   - Node.js & Express 5 (REST API quy chuẩn `/api/...`).
   - Kiến trúc phân tầng chặt chẽ: `Routes` $\rightarrow$ `Controllers` $\rightarrow$ `Services` $\rightarrow$ `Models/Repositories`.
   - Tiến trình chạy tác vụ nền độc lập (**Job Worker**) xử lý 5 background jobs định kỳ (`JOB-01` đến `JOB-05`), sử dụng cơ chế PostgreSQL Advisory Lock chống đụng độ tác vụ.
3. **Data Tier (Cơ sở dữ liệu):**
   - PostgreSQL 16 (hosted trên Supabase).
   - Mô hình dữ liệu chuẩn gồm **36 bảng dữ liệu** quan hệ theo thiết kế SDS Report 4. Supabase chỉ đóng vai trò database host; không dùng Supabase Auth hay Supabase Storage.
4. **Hệ thống Tích hợp Bên ngoài (External Integrations):**
   - **Cloudinary (API-02, API-03):** Lưu trữ toàn bộ ảnh (seal, xe, POD, sự cố) và tài liệu hồ sơ (chứng từ khách hàng). Phía client upload trực tiếp qua signed URL.
   - **Google Maps Platform (API-01, API-05):** Routes API tính khoảng cách/thời gian chạy xe có tải trọng và tắc đường; Geocoding API chuyển đổi địa chỉ thành tọa độ (lat, lng).
   - **Vehicle GPS System (API-04):** Tích hợp hệ thống GPS nhà xe lấy tọa độ/tốc độ thực tế.
   - **AI Document Assistant (API-06):** Google Gemini gợi ý danh mục chứng từ dựa trên loại hàng hóa.
   - **Email Service:** Gửi link tra cứu đơn, danh sách giấy tờ, link đổi mật khẩu (hạn 30 phút).
   - **Vendor Systems (API-07):** API tiếp nhận trạng thái từ các nhà xe thuê ngoài.

---

### 1.2 Cấu trúc Thư mục Dự án Chuẩn hóa (Package Structure)

```
SEP490_G120_FALL2026/
├── BE/                                # Ứng dụng Back-end API & Worker
│   ├── config/                        # Cấu hình kết nối (db.js, supabase.js, cloudinary.js)
│   ├── controllers/                   # Tầng Controller (nhận req, validate input sơ bộ, gọi service, trả res.status.json)
│   ├── services/                      # Tầng Service (chứa toàn bộ Business Rules BR-xx, logic tính toán, transaction)
│   ├── models/                        # Tầng Model/Repository (truy vấn DB, raw SQL parameterized hoặc ORM/SDK)
│   ├── middlewares/                   # Middlewares (authMiddleware, checkRole, maintenanceCheck, errorHandler)
│   ├── routes/                        # Tầng Route (định nghĩa endpoint URL, gắn middleware phân quyền)
│   │   └── index.js                   # Route Aggregator gom tất cả các routes
│   ├── jobs/                          # Tác vụ định kỳ (JOB-01 đến JOB-05) chạy bằng node-cron + advisory lock
│   ├── utils/                         # Hàm tiện ích chung (helpers, formatting, time, logger)
│   ├── server.js                      # Entry point Express API Server
│   └── package.json
│
├── FE/                                # Ứng dụng Front-end Next.js App Router
│   ├── app/                           # App Router Directory
│   │   ├── (public)/                  # Trang công khai: Trang chủ, Tin tức, Đăng ký form (/f/[token])
│   │   ├── login/                     # Màn hình Đăng nhập & Modal Quên/Đổi mật khẩu
│   │   ├── blog/                      # Chuyên mục Tin tức/Bài viết
│   │   ├── t/[token]/                 # Trang Khách hàng Tra cứu Hành trình Đơn hàng công khai
│   │   ├── admin/                     # Cổng Quản trị viên (Hệ thống, Tài khoản, Cấu hình, Nhật ký)
│   │   ├── manager/                   # Cổng Quản lý (Đội xe, Duyệt bồi thường/sự cố, Ca làm, Hiệu suất)
│   │   ├── dispatcher/                # Cổng Điều phối viên (Đơn hàng, Lập chuyến, Gán xe, Giám sát GPS)
│   │   └── driver/                    # Phân hệ Driver PWA (Chuyến của tôi, Thực thi 4 bước, Báo sự cố, Đăng ký ca)
│   │
│   ├── src/
│   │   ├── api/                       # API Client duy nhất gọi fetch, mapping mã lỗi sang câu thông báo MSG
│   │   ├── components/                # UI Components tái sử dụng (đặt tên PascalCase)
│   │   ├── contexts/                  # React Contexts (AuthContext, SocketContext...)
│   │   ├── utils/                     # Tiện ích (offlineQueue.js IndexedDB, photoCompressor.js, helpers)
│   │   └── views/                     # View component chi tiết theo từng role / trang
│   │
│   └── public/                        # Static assets, PWA manifest.json, Service Worker (sw.js)
│
├── srs_doc.txt                        # Toàn văn Đặc tả Yêu cầu SRS v2 (Report 3)
├── sds_doc.txt                        # Toàn văn Thiết kế Hệ thống SDS v2 (Report 4)
├── workflow_doc.txt                   # Toàn văn Quy trình Nghiệp vụ ALS Vận hành Thực tế
└── AGENTS.md                          # Bộ quy chuẩn phát triển dành cho Developers & AI Agents
```

---

### 1.3 Quy tắc Phân rã 19 Modules & Quy tắc Phụ thuộc Một Chiều (Dependency Rules)

Theo đặc tả Report 4 (Mục I.2), API được chia thành 19 phân hệ chức năng:
1. `auth`: Đăng nhập, đăng xuất, phiên làm việc, đổi mật khẩu, quên mật khẩu (30 phút, 1 lần).
2. `users`: Tài khoản nhân viên, phân quyền, nhật ký hoạt động (audit log), cài đặt hệ thống.
3. `locations`: Điểm kho, bãi, địa điểm giao nhận kèm tọa độ Geocoding.
4. `customers`: Khách hàng, hợp đồng nguyên tắc (bảng phí hủy, phí chờ, hạn mức bồi thường).
5. `orders`: Tiếp nhận đơn (Guest/Dispatcher), Draft, xác nhận Confirmed, phụ phí, ghi chú.
6. `documents`: Hồ sơ chứng từ khách hàng, upload Cloudinary, trợ lý AI gợi ý chứng từ.
7. `tracking`: Tra cứu đơn hàng công khai qua token (bảo mật, ẩn ảnh seal/POD, yêu cầu bồi thường $\le 14$ ngày).
8. `trips`: Gom đơn vào chuyến, tính cước/khoảng cách/ETA, gán xe/tài xế, giấy vận tải (waybill), xếp dỡ 3D.
9. `fleet`: Quản lý xe tải, hồ sơ tài xế, ca làm việc (shift).
10. `vendors`: Quản lý nhà xe thuê ngoài, bàn giao đơn cho thầu phụ, nhận webhook/API trạng thái.
11. `monitoring`: Giám sát chuyến thời gian thực, luồng GPS, phát lại hành trình, bảng điều khiển Dispatcher.
12. `driver`: API phục vụ Driver PWA: nhận chuyến, chuỗi 4 bước sự kiện điểm dừng, báo sự cố, đồng bộ ngoại tuyến.
13. `incidents`: Tiếp nhận sự cố trên đường, điều xe/tài xế thay thế, leo thang quản lý duyệt.
14. `claims`: Khiếu nại bồi thường hàng hóa từ khách hàng, quản lý xem xét và phê duyệt.
15. `news`: Quản lý bài viết tin tức và hiển thị trang tin công khai.
16. `dashboard`: Báo cáo chỉ số hiệu suất KPI, khối lượng công việc đơn hàng cho Manager.
17. `notifications`: Hệ thống cảnh báo và thông điệp gửi người dùng (chuẩn mã MSG).
18. `workflows`: Điều phối các luồng nghiệp vụ phức tạp tương tác chéo giữa nhiều module (ví dụ: Hủy đơn trước khi xếp hàng giải phóng xe/chuyến; Đổi xe khẩn cấp giữa đường kèm chuyển trạm trung chuyển).
19. `shared`: Middleware xác thực, error handler, định dạng chuẩn, bộ ghi log, kiểm tra lệch giờ.

#### Quy tắc Phụ thuộc Một Chiều Bắt Buộc (Strict One-Way Dependency Rules):
- `driver` $\rightarrow$ `trips`, `orders`, `documents`, `incidents`
- `trips` $\rightarrow$ `orders`, `fleet`, `locations`, `vendors`
- `incidents` $\rightarrow$ `trips`, `orders`, `claims`
- `tracking` $\rightarrow$ `orders`, `documents`, `claims`
- `dashboard`, `monitoring` $\rightarrow$ Đọc dữ liệu từ các module khác
- **Tuyệt đối KHÔNG có module nào được gọi ngược vào `driver` hoặc `tracking`.**
- Khi có luồng nghiệp vụ tương tác hai chiều hoặc đan xen giữa nhiều phân hệ, **bắt buộc phải đặt tại `workflows`**.
- **Controller tuyệt đối không viết raw SQL hay gọi trực tiếp Model.**
- **Một module chỉ được phép truy xuất dữ liệu của module khác thông qua Service công khai của module đó.**

---

## 2. Quy chuẩn Kỹ thuật Back-end & An toàn Cơ sở Dữ liệu

Tham chiếu chi tiết tại [BE/CODING_RULES.md](file:///c:/Users/Admin/Downloads/SEP490_G120_FALL2026/BE/CODING_RULES.md):
- **Phân tách trách nhiệm 3 tầng rõ ràng:**
  - `Routes`: Chỉ ánh xạ URL endpoint và gắn middleware bảo vệ (`requireAuth`, `requireRole`, `requireMaintenanceCheck`).
  - `Controllers`: Tiếp nhận request, bóc tách tham số, kiểm tra định dạng sơ bộ, gọi service và trả về `res.status().json()`.
  - `Services`: Chứa 100% nghiệp vụ logic, kiểm tra Business Rules (`BR-xx`), thực thi transaction cơ sở dữ liệu. Tuyệt đối không chạm vào biến `req` hoặc `res`.
  - `Models/Repositories`: Chịu trách nhiệm thực thi câu lệnh SQL với database.
- **An toàn Cơ sở Dữ liệu & Truy vấn:**
  - Luôn sử dụng parameterized queries (`$1`, `$2`...) đối với raw SQL qua pg pool để chống triệt để SQL Injection.
  - Luôn kiểm tra điều kiện xóa mềm (`deleted_at IS NULL`) khi truy vấn các bảng hỗ trợ soft delete (đặc biệt là bảng `trucks`).
  - Sử dụng chính xác các giá trị ENUM đã định nghĩa trong database (`orders.status`, `trips.status`, `trucks.status`, `incidents.status`...).
- **Bảo mật (Security):**
  - Mật khẩu người dùng bắt buộc băm bằng `bcrypt` với `salt rounds >= 10`.
  - Token JWT lưu trữ an toàn trong `httpOnly` cookie để phòng chống tấn công XSS.
  - Tuyệt đối không in (log) mật khẩu, chuỗi token nhạy cảm ra console log và **không bao giờ trả về trường `password_hash` trong bất kỳ HTTP response nào**.
- **Quy chuẩn mã nguồn:**
  - Naming: `camelCase` cho hàm/biến, `UPPER_SNAKE_CASE` cho hằng số (constants) và giá trị Enum.
  - Tập trung export qua `module.exports = { ... }` ở cuối mỗi file.

---

## 3. Quy chuẩn Kỹ thuật Front-end

Tham chiếu chi tiết tại [FE/AGENTS.md](file:///c:/Users/Admin/Downloads/SEP490_G120_FALL2026/FE/AGENTS.md):
- Tuân thủ cấu trúc App Router của Next.js; giữ nguyên các khối chú thích cấu hình do Next.js sinh ra.
- Thiết kế giao diện hiện đại, tối ưu UX, hiển thị thông báo lỗi/thành công bằng Alert hoặc Toast rõ ràng, kèm đúng câu chữ thông báo tương ứng với mã `MSG`.
- Toàn bộ lời gọi API qua network phải gom về thư mục `src/api/` (thông qua `apiClient.js` chung), tự động bắt lỗi HTTP và bóc tách `code` / `message`.

---

## 4. Đặc tả Nghiệp vụ Toàn diện & Quy trình ALS (SRS v2, SDS v2 & ALS Workflow)

### 4.1 Phạm vi Quy chuẩn Nghiệp vụ
- **48 Use Cases:** `UC-01` đến `UC-48`.
- **60 Business Rules:** `BR-01` đến `BR-60`.
- **86 System Messages:** `MSG01` đến `MSG86` (chuẩn hóa toàn bộ câu chữ tiếng Việt và mã thông báo hệ thống).
- **5 Background Jobs:**
  - `JOB-01`: Dọn dẹp chứng từ/dữ liệu hết hạn lưu trữ theo quy định (BR-22).
  - `JOB-02`: Polling dữ liệu vị trí GPS của đoàn xe tải mỗi phút (API-04).
  - `JOB-03`: Tự động tính toán lại thời gian lái xe liên tục và cảnh báo giới hạn lái xe (BR-34, MSG65).
  - `JOB-04`: Tự động tính toán lại ETA dự kiến của các chuyến đang chạy mỗi 5 phút (BR-04).
  - `JOB-05`: Quét các đơn hàng/chuyến xe quá hạn hoặc tài khoản chờ xác nhận.
- **7 External APIs:** `API-01` (Google Routes), `API-02/03` (Cloudinary Upload/Sign), `API-04` (Vehicle GPS), `API-05` (Google Geocoding), `API-06` (Gemini AI Docs), `API-07` (Vendor Partner Status).

---

### 4.2 Quy trình Vận hành Thực tế của ALS (6 Giai đoạn)
1. **Giai đoạn 1: Tiếp nhận Đơn & Chốt Giá (`Draft` $\rightarrow$ `Confirmed`):**
   - Khách điền thông tin qua link đặt đơn riêng (hàng nhập Import hoặc hàng xuất Export, địa điểm, quy cách hàng). Giới hạn tối đa 4.000 kg/đơn, không nhận hàng nguy hiểm. Tính cước theo số lớn hơn giữa cân nặng thực và cân quy đổi kích thước.
   - Dispatcher thương lượng giá và nhập mức giá chốt trực tiếp (`BR-01`).
   - Khách nộp đủ chứng từ (customs, giấy giới thiệu...), Dispatcher duyệt. Khách ký hợp đồng vận chuyển. Đơn chuyển thành `Confirmed`, kích hoạt các điều khoản về phí hủy, giờ chờ miễn phí và mức bồi thường.
2. **Giai đoạn 2: Lập Chuyến & Gán Xe (`Confirmed` $\rightarrow$ `Assigned`):**
   - Đơn có thể đi ghép nếu cùng một khách hàng và khách đã đồng ý (`BR-05`). Một đơn luôn đi trọn vẹn trên một xe tải, không tách xe.
   - Kiểm tra nghiêm ngặt 5 điều kiện của tài xế: Ca làm đã duyệt bao trùm chuyến; còn trong giới hạn 10h/ngày và 48h/tuần; không có chuyến dở dang; nghỉ đủ thời gian giữa 2 chuyến; bằng lái đúng hạng và còn hạn.
   - Nếu hết xe nội bộ, bàn giao sang nhà xe đối tác (`Handed Over to Vendor`).
3. **Giai đoạn 3: Bốc Hàng & Vận Chuyển (`Assigned` $\rightarrow$ `Accepted` $\rightarrow$ `In Progress` $\rightarrow$ `In Transit`):**
   - Tài xế nhận chuyến trên app mobile.
   - **Chuỗi 4 bước sự kiện Điểm dừng:** Tại mỗi điểm dừng, tài xế bấm tuần tự 4 nút: `Arrived` $\rightarrow$ `Loading Started` $\rightarrow$ `Loading Done` $\rightarrow$ `Left`.
   - Chụp ảnh hàng, chụp ảnh niêm phong kèm biển số xe tại điểm lấy hàng (`Picked Up`).
   - Khi tài xế bấm `Left` tại điểm lấy hàng cuối cùng, đơn chuyển sang `In Transit`.
4. **Giai đoạn 4: Quản lý Sự Cố & Bồi Thường:**
   - Tài xế gửi báo cáo sự cố kèm ảnh hiện trường.
   - Nếu xe hỏng giữa đường, Dispatcher thực hiện đổi xe hoặc đổi tài xế thay thế ngay trên chuyến đang chạy (`UC-15`). Vị trí xe hỏng trở thành điểm trung chuyển (Transit). Hệ thống cấp mã giấy vận tải mới (Waybill v2) và tính lại ETA.
   - Sự cố hư hỏng/mất mát hoặc tai nạn được leo thang lên Manager giải quyết. Khách hàng có quyền tạo khiếu nại bồi thường trong vòng 14 ngày kể từ khi đơn hoàn tất.
5. **Giai đoạn 5: Giao Hàng & Đóng Đơn (`In Transit` $\rightarrow$ `Delivered` $\rightarrow$ `Completed`):**
   - Tài xế chụp ảnh cắt seal, chụp ảnh dỡ hàng và chụp biên bản giao nhận có chữ ký (POD).
   - Nếu người nhận từ chối nhận hàng (Exception), xe chuyển hàng về kho lưu giữ của ALS.
6. **Giai đoạn 6: Hủy Đơn Hàng (`Cancelled`):**
   - Áp dụng các bậc phí hủy theo hợp đồng khách hàng tùy thuộc vào thời điểm hủy trước khi xe lăn bánh.

---

### 4.3 Quy tắc Chi tiết cho Phân hệ Driver PWA & Administrator

#### Phân hệ Driver PWA:
- **Chuỗi 4 bước điểm dừng & Phí chờ (BR-30, BR-36):**
  - $\text{Thời gian chờ} = \text{Loading Started} - \text{Arrived}$.
  - Nếu thời gian chờ vượt định mức miễn phí (`free_waiting_minutes`), hệ thống tự động gợi ý phụ phí chờ (100.000 VNĐ cho mỗi block 30 phút).
- **Hàng đợi Ngoại tuyến (Offline Engine - BR-27, BR-37, MSG39):**
  - Mất sóng trong kho kín: Các thao tác được lưu trữ tại IndexedDB (`driver_offline_queue`) tối đa 50 hành động.
  - Giao diện cung cấp thanh trạng thái mạng và nút **"Đồng bộ ngay" (Sync Now)**.
  - **Kiểm tra lệch giờ điện thoại (BR-27):** Nếu giờ gửi trên điện thoại lệch quá 5 phút so với đồng hồ máy chủ, hệ thống tự động lấy giờ máy chủ và đánh dấu cờ `time_flagged = true`.
- **Cache chứng từ ngoại tuyến (Report 4 - Mục 6781):**
  - Giấy vận tải (Waybill) và bộ chứng từ hải quan khi mở lần đầu lúc có sóng sẽ được lưu vào cache IndexedDB để tài xế có thể xem lại khi vào khu vực kho kín mất sóng.
- **Giới hạn thời gian lái xe liên tục (BR-34, MSG65):**
  - Hiển thị thanh cảnh báo đỏ khi thời gian lái xe liên tục tiến gần 4 giờ.

#### Phân hệ Administrator:
- **Chế độ bảo trì hệ thống (Maintenance Mode - MSG86):**
  - Khi cài đặt `maintenance_mode = true` được kích hoạt, chỉ tài khoản có vai trò `ADMINISTRATOR` (`role_id = 1`) mới được phép đăng nhập và sử dụng hệ thống. Toàn bộ các vai trò khác (`Driver`, `Dispatcher`, `Manager`, `Customer`) bị từ chối với mã lỗi `MSG86`: *"Hệ thống đang bảo trì. Vui lòng quay lại sau."*.
- **Cơ chế Khôi phục Mật khẩu Quên (BR-49, MSG59, MSG60, MSG61, MSG70):**
  - Yêu cầu gửi link đổi mật khẩu: Luôn trả về thông báo an toàn `MSG70` bất kể email có tồn tại hay không.
  - Token đặt lại mật khẩu có hiệu lực duy nhất 1 lần trong vòng 30 phút. Token sai hoặc hết hạn trả về `MSG61`.
  - Mật khẩu mới bắt buộc tối thiểu 8 ký tự (`MSG59`). Khi đổi mật khẩu thành công (`MSG60`), hệ thống tự động hủy bỏ toàn bộ các phiên đăng nhập đang hoạt động trước đó.
