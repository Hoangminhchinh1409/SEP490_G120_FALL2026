# 📋 NEXLOG Backend — Coding Rules & Conventions

> **Phiên bản:** 2.0 (Đồng bộ toàn diện theo System Architecture, Package Diagram & Frontend Integration)  
> **Cập nhật:** 2026-10-28  
> **Tech Stack:** Node.js · Express 5 · PostgreSQL 16 (Supabase - 36 tables) · Prisma · JWT (httpOnly) · bcrypt · node-cron (Advisory Locks) · Next.js (App Router & PWA)

---

## 1. Kiến trúc hệ thống tổng thể (System Architecture)

Hệ thống được tổ chức theo mô hình phân tán giữa Client (Web & PWA), Backend Application (2 processes chung codebase), Cơ sở dữ liệu và các Dịch vụ tích hợp bên ngoài (External Services):

```
┌────────────────────────────────────────────────────────┐
│                        CLIENTS                         │
│  - Guest browser: Order form, tracking page, news      │
│  - Staff browser: Admin, Manager, Dispatcher portals   │
│  - Driver phone (PWA): Service worker, IndexedDB, GPS  │
└───────────────┬────────────────────────┬───────────────┘
                │ HTTPS                  │ HTTPS, Offline sync
                ▼                        ▼
┌────────────────────────────────────────────────────────┐     Prisma     ┌────────────────────────┐
│               APPLICATION (Node.js)                    ├───────────────>│   PostgreSQL 16        │
│                                                        │                │   (Supabase host)      │
│  ┌──────────────────────────────────────────────────┐  │                │   - 36 tables          │
│  │ API Process: Express 5, REST /api/v1             │  │                │   - Prisma migrations  │
│  │ (auth, orders, trips, fleet... JWT cookies, RBAC)│  │                └────────────────────────┘
│  └──────────────────────────────────────────────────┘  │
│                                                        │  GPS pull,     ┌────────────────────────┐
│  ┌──────────────────────────────────────────────────┐  │  Routes, maps, │   EXTERNAL SERVICES    │
│  │ Job Worker Process: node-cron (JOB-01 to JOB-06) ├──┼───────────────>│ - Cloudinary (API-02/03│
│  │ (PostgreSQL advisory lock, own process)          │  │  AI, files...  │ - Google Maps (API-01/05│
│  └──────────────────────────────────────────────────┘  │                │ - Vehicle GPS (API-04) │
│                (Same codebase, two processes)          │                │ - Gemini AI (API-06)   │
└────────────────────────────────────────────────────────┘                │ - Email Service        │
                                                                          │ - Vendor System (API-07│
                                                                          └────────────────────────┘
```

### 1.1 Nguyên tắc 2 Processes (API Process & Job Worker Process)
- **Cùng một codebase**, khởi chạy thành 2 process độc lập trong môi trường production:
  1. **API Process (`server.js`):** Tiếp nhận request qua giao thức HTTPS, cung cấp REST API `/api/v1` cho các portal Web và Mobile PWA.
  2. **Job Worker Process (`jobs/`):** Chạy background worker định kỳ với `node-cron`. 
- **Quy tắc Advisory Lock:** Tất cả các cron job chạy ngầm (`JOB-01` đến `JOB-06`) **bắt buộc** phải sử dụng cơ chế PostgreSQL Session-level hoặc Transaction-level Advisory Lock (`SELECT pg_try_advisory_lock(...)`) để chống hiện tượng race condition hoặc thực thi trùng lặp khi chạy đa tiến trình/scale container.

---

## 2. Kiến trúc phân tầng Module Backend (Package Diagram & Dependencies)

Toàn bộ backend tuân thủ nghiêm ngặt **mô hình phân tầng 3 lớp phụ thuộc một chiều** (Top-Down Dependency, tuyệt đối không phụ thuộc vòng) và ánh xạ chuẩn với danh mục Use Case (UC-01 đến UC-48):

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. ENTRY MODULES (Tầng đầu vào — Gọi xuống Business Modules)                              │
│  - driver (UC-28 to 32)      - tracking (UC-01, 47)      - monitoring (UC-11, 42, 43, 48)│
│  - dashboard (UC-21, 27)     - news (UC-44, 45)          - workflows (cancel order, ...) │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ calls
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. BUSINESS MODULES (Tầng nghiệp vụ lõi — Gọi xuống Base Modules)                         │
│  - orders (UC-03, 04, 08, 12, 13, 22)                    - trips (UC-06, 07, 09, 41)     │
│  - incidents (UC-14, 15, 16, 25)                         - claims (UC-26)                │
│  - vendors (UC-10, 23)                                   - documents (UC-02, 05, 39)     │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ calls
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. BASE MODULES (Tầng nền tảng độc lập — KHÔNG chứa business rules của module khác)     │
│  - fleet (UC-18, 19, 20)     - customers (UC-24)         - locations (UC-40)             │
│  - users (UC-17, 33 to 36)   - auth (UC-37, 38, 46)      - notifications (alerts, msgs)  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Quy tắc ranh giới phân tầng (Layer Boundary Rules)
1. **Entry Modules:**
   - **Mục đích:** Là cổng giao tiếp trực tiếp với Client (Driver portal, Public tracking, Điều phối Dashboard...) hoặc điều phối các luồng nghiệp vụ phức tạp liên module (`workflows` như quy trình Hủy đơn hàng `cancel order`, Đổi xe điều phối `change truck`).
   - **Quy tắc:** Được phép gọi các hàm từ **Business Modules**. KHÔNG được phép query raw SQL trực tiếp vào database tầng dữ liệu của module khác.
2. **Business Modules:**
   - **Mục đích:** Xử lý nghiệp vụ chuyên biệt của từng miền nghiệp vụ cốt lõi (Orders, Trips, Incidents, Claims, Vendors, Documents).
   - **Quy tắc:** Được phép gọi xuống **Base Modules** hoặc thông qua các Service Interfaces được định nghĩa rõ ràng. **KHÔNG** được gọi ngược lên Entry Modules.
3. **Base Modules:**
   - **Mục đích:** Quản lý dữ liệu gốc và tiện ích hạ tầng nền tảng (Fleet, Customers, Locations, Users, Auth, Notifications).
   - **QUY TẮC CỐT LÕI (BẮT BUỘC):** Base Modules **tuyệt đối KHÔNG chứa business rules hay import code của các module khác**. Base Modules phải hoàn toàn độc lập để mọi module tầng trên có thể tái sử dụng an toàn.

---

## 3. Danh mục tích hợp dịch vụ bên ngoài (External Services Catalog)

Các dịch vụ bên ngoài phải được tích hợp chuẩn hóa theo mã hiệu quy định:

| Mã API | Dịch vụ bên thứ ba | Mục đích tích hợp | Quy chuẩn tích hợp |
|:-------|:-------------------|:------------------|:-------------------|
| **API-01** | Google Maps Platform | Routes API | Tính toán quãng đường, thời gian di chuyển (ETA), tối ưu lộ trình |
| **API-02** | Cloudinary | Upload & Storage | Lưu trữ ảnh chụp biên bản giao nhận POD, ảnh seal chì, ảnh chứng từ |
| **API-03** | Cloudinary | Signed URL Upload | Cấp `signature` từ API để điện thoại tài xế upload ảnh trực tiếp lên CDN |
| **API-04** | Vehicle GPS System | GPS Tracking | Thu thập toạ độ định vị xe từ thiết bị hộp đen / nhà cung cấp |
| **API-05** | Google Maps Platform | Geocoding API | Chuyển đổi giữa địa chỉ thực tế và toạ độ kinh độ / vĩ độ (Lat/Lng) |
| **API-06** | Gemini (Google AI) | Document AI | Gợi ý văn bản, trích xuất dữ liệu hóa đơn/chứng từ, hỗ trợ soạn thảo |
| **API-07** | Vendor Systems | Webhook / Inbound | Tiếp nhận dữ liệu chuyến xe/đơn từ hệ thống đối tác qua API Key |
| **EMAIL** | Email Service | Notification Mail | Gửi liên kết tra cứu đơn hàng (tracking link), email đặt lại mật khẩu |

---

## 4. Tác vụ định kỳ ngầm (Background Job Worker: JOB-01 đến JOB-06)

Các Background Jobs chạy ngầm trong process Job Worker, quản lý qua `node-cron`:

| Mã Job | Tên Job | Nghiệp vụ SRS liên quan | Tần suất & Mô tả |
|:-------|:--------|:------------------------|:-----------------|
| **JOB-01** | File Retention | BR-22 | Bảo lưu chứng từ, ảnh chì, POD của các đơn hàng có khiếu nại đang `PENDING` |
| **JOB-02** | GPS & Shift Overtime Check | BR-34, MSG65, MSG83 | Cảnh báo tài xế lái xe liên tục quá 4 giờ và cảnh báo hết ca làm việc khi chuyến chưa hoàn tất |
| **JOB-03** | Order Flagger | BR-25, MSG41, BR-13 | Tự động gắn cờ các đơn hàng Draft quá hạn và đơn Confirmed quá hạn chưa được gán chuyến |
| **JOB-04** | Trip Status & ETA Tracking | BR-09, BR-12 | Cập nhật tự động tiến độ chuyến đi, đối soát toạ độ GPS và tính toán ETA |
| **JOB-05** | Contract & License Expiry Check | BR-18, BR-20 | Kiểm tra cảnh báo hợp đồng nhà xe, bằng lái tài xế hoặc giấy tờ sắp hết hạn |
| **JOB-06** | Auto-lock Expired Trucks | BR-24 | Tự động chuyển trạng thái các xe hết hạn đăng kiểm sang `INACTIVE` |

### 4.1 Mẫu cài đặt Advisory Lock cho Job Worker
```javascript
// ✅ BẮT BUỘC dùng PostgreSQL advisory lock khi thực thi job
const runJobWithLock = async (jobLockId, jobName, jobFunction) => {
    const client = await pool.connect();
    try {
        const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [jobLockId]);
        if (!rows[0].acquired) {
            console.log(`[Job Worker] ${jobName} đang chạy ở tiến trình khác, bỏ qua lượt này.`);
            return;
        }
        console.log(`[Job Worker] Bắt đầu thực hiện: ${jobName}`);
        await jobFunction();
    } catch (err) {
        console.error(`[Job Worker Error] ${jobName} thất bại:`, err.message);
    } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [jobLockId]);
        client.release();
    }
};
```

---

## 5. Kiến trúc tích hợp Frontend & PWA Driver (FE Architecture)

Frontend được phát triển bằng **Next.js (App Router)** và chia rõ ranh giới giữa `app/` và `src/`:

```
FE (Next.js, App Router)
├── app/                      # Cấu trúc Route groups theo phân quyền vai trò
│   ├── (public)/             # home, news, login, forgot-password, /f/[token] (order form), /t/[token] (tracking)
│   ├── admin/                # Quản trị người dùng, roles, system logs, cấu hình, dashboard
│   ├── manager/              # Dashboard, orders, fleet, shifts, vendors, incidents, claims, news
│   ├── dispatcher/           # Orders, chi tiết đơn, locations, trip assignment, monitoring, incidents, contracts
│   └── driver/               # My trips, thực thi chuyến, báo cáo sự cố, ca trực (chạy PWA)
└── src/
    ├── views, components, layouts/ # Giao diện màn hình và UI components dùng chung
    ├── contexts, providers/        # Quản lý Auth State, Role Guard, Theme
    ├── api/apiClient/              # Fetch client gửi credentials, map mã lỗi hệ thống (MSG)
    └── pwa/                        # Dành riêng cho Driver: Service Worker, IndexedDB outbox queue,
                                    # Sync Manager (đồng bộ offline), Photo Compressor (nén ảnh trước khi đẩy CDN)
```

---

## 6. Cấu trúc mã nguồn Backend (Source Tree)

```
BE/
├── config/           # Cấu hình database, Supabase, Prisma client
│   ├── db.js         # PostgreSQL Pool (pg) — dùng cho raw SQL query phức tạp
│   ├── supabase.js   # Supabase Client — dùng cho Storage & SDK query
│   └── prisma.js     # Prisma client (nếu dùng)
├── controllers/      # Tầng Controller (nhận req, parse input, gọi service, trả res.status.json)
├── services/         # Tầng Service (xử lý business logic, độc lập hoàn toàn với req/res)
├── models/           # Data Access Layer (truy vấn DB qua Prisma, pg pool hoặc Supabase)
├── middlewares/      # Middleware (requireAuth, requireRole, validation, error handler)
├── routes/           # Định nghĩa endpoint REST /api/v1/ và gắn middleware
│   └── index.js      # Route aggregator
├── jobs/             # Các background jobs (JOB-01 đến JOB-06, advisory locks)
├── prisma/           # Prisma schema & migrations (quản lý 36 bảng)
├── server.js         # Entry point — khởi tạo Express app (API Process)
├── .env              # Biến môi trường (TUYỆT ĐỐI KHÔNG commit)
└── package.json
```

### 6.1 Luồng xử lý request 3 tầng chuẩn mực

```
Client Request (Browser / PWA)
    → routes/{module}Routes.js           (URL mapping /api/v1 + middleware nhóm)
    → middlewares/                       (requireAuth, requireRole, validateBody)
    → controllers/{module}Controller.js  (parse input req, gọi service, trả res.status.json)
    → services/{module}Service.js        (thực thi Business Logic, không đụng req/res)
    → models/{module}Model.js            (truy vấn Database qua Prisma / pg pool / Supabase)
    → Response JSON
```

### 6.2 Bảng quy chuẩn phân tầng

| Tầng | Được phép truy cập | KHÔNG được phép |
|:-----|:-------------------|:----------------|
| **Route** | Controller, Middleware | Gọi trực tiếp Model hoặc Service |
| **Controller** | Service, trả `res.status().json()` | Viết raw SQL, gọi trực tiếp Model |
| **Service** | Model, các Service khác tầng Base | Truy cập vào `req`, `res` |
| **Model** | `prisma`, `pool` (pg) hoặc `supabase` | Chứa business rules |
| **Middleware** | `req`, `res`, `next()` | Chứa business logic phức tạp |

---

## 7. Quy tắc đặt tên (Naming Conventions)

### 7.1 Files
| Loại | Convention | Ví dụ |
|:-----|:-----------|:------|
| Controller | `{module}Controller.js` | `orderController.js`, `managerController.js` |
| Service | `{module}Service.js` | `authService.js`, `orderService.js` |
| Model | `{module}Model.js` | `userModel.js`, `truckModel.js` |
| Route | `{module}Routes.js` | `authRoutes.js`, `managerRoutes.js` |
| Middleware | `{feature}Middleware.js` | `authMiddleware.js`, `validationMiddleware.js` |
| Job Worker | `{domain}Jobs.js` | `managerJobs.js`, `workerJobs.js` |
| Config | `{name}.js` | `db.js`, `supabase.js`, `prisma.js` |

### 7.2 Variables, Functions & Constants
```javascript
// ✅ camelCase cho variables & functions
const totalRevenue = 100;
const calculateTripDuration = async (tripId) => { ... };

// ✅ UPPER_SNAKE_CASE cho constants & enums
const MAX_PAGE_SIZE = 100;
const ORDER_STATUS = {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
};

// ❌ KHÔNG dùng PascalCase hoặc snake_case cho biến JS
const Total_Revenue = 100;
const calculate_duration = () => {};
```

### 7.3 REST API Endpoints (Quy chuẩn `/api/v1`)
```
GET    /api/v1/{module}                # Lấy danh sách (hỗ trợ phân trang page, limit)
GET    /api/v1/{module}/:id            # Lấy thông tin chi tiết một bản ghi
POST   /api/v1/{module}                # Tạo mới bản ghi
PUT    /api/v1/{module}/:id            # Cập nhật toàn bộ bản ghi
PATCH  /api/v1/{module}/:id            # Cập nhật một phần thuộc tính
DELETE /api/v1/{module}/:id            # Xoá (Soft delete)

# Hành động đặc biệt: Đặt động từ sau danh từ thực thể
PATCH  /api/v1/orders/:id/reassign     # Gán lại chuyến / tài xế
PATCH  /api/v1/vendors/:id/approve     # Phê duyệt nhà xe
POST   /api/v1/claims/:id/decide       # Quyết định chấp thuận / từ chối khiếu nại
POST   /api/v1/uploads/sign            # Cấp chữ ký upload ảnh Cloudinary (API-03)
```

### 7.4 Database Columns & Enums
```sql
-- ✅ snake_case cho tên bảng và cột (PostgreSQL convention)
created_at, updated_at, deleted_at, plate_number, inspection_expiry, password_hash

-- ✅ UPPER_SNAKE_CASE cho giá trị enum
'PENDING', 'ACTIVE', 'ON_TRIP', 'AVAILABLE', 'MAINTENANCE', 'COMPLETED'
```

---

## 8. Patterns & Code Style

### 8.1 Controller Pattern
```javascript
// ✅ ĐÚNG — Controller chuẩn hóa
const getOrders = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const userId = req.user.id;

        const result = await orderService.getOrders({
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            status,
            search,
            userId
        });

        return res.status(200).json({
            message: "Success",
            ...result
        });
    } catch (error) {
        console.error("[OrderController.getOrders Error]:", error);
        return res.status(error.statusCode || 500).json({
            message: error.message || "Internal server error",
            code: error.code || "ERR_INTERNAL"
        });
    }
};
```

### 8.2 Service Pattern
```javascript
// ✅ ĐÚNG — Service xử lý nghiệp vụ, không nhận req, res
const getOrders = async ({ page, limit, status, userId }) => {
    const { orders, total } = await orderModel.findOrders({ page, limit, status });
    
    // Xử lý Business Logic / Flagging
    const enriched = orders.map(order => ({
        ...order,
        isOverdue: order.expected_delivery_time ? new Date(order.expected_delivery_time) < new Date() : false
    }));

    return { orders: enriched, total, page, limit };
};
```

### 8.3 Model Pattern (Prisma / pg Pool / Supabase SDK)
```javascript
// 1. Prisma Model (Khuyến nghị cho entity chuẩn)
const prisma = require("../config/prisma");
const findTruckById = async (id) => {
    return await prisma.trucks.findFirst({
        where: { id, deleted_at: null }
    });
};

// 2. pg Pool (Dùng cho Raw SQL truy vấn phức tạp, nhiều JOIN / Aggregate / Advisory Lock)
const pool = require("../config/db");
const findOrderDetailsWithJoins = async (orderId) => {
    const query = `
        SELECT o.*, c.name AS customer_name, t.plate_number
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN trips tr ON tr.order_id = o.id
        LEFT JOIN trucks t ON tr.truck_id = t.id
        WHERE o.id = $1 AND o.deleted_at IS NULL
    `;
    const { rows } = await pool.query(query, [orderId]);
    return rows[0] || null;
};
```

---

## 9. Route & Middleware Rules

### 9.1 Phân quyền truy cập theo vai trò (Role-Based Access Control - RBAC)
Database lưu trữ role người dùng theo ID số hoặc Enum:
- `1` = **ADMIN** (Administrator)
- `2` = **MANAGER** (Quản lý)
- `3` = **DISPATCHER** (Điều phối viên)
- `4` = **DRIVER** (Tài xế)
- `5` = **CUSTOMER** (Khách hàng)

```javascript
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const orderController = require("../controllers/orderController");

// Bắt buộc đăng nhập
router.use(requireAuth);

// Cho phép Manager và Dispatcher tạo/sửa đơn
router.get("/", orderController.getOrders);
router.post("/", requireRole(["MANAGER", "DISPATCHER", "ADMIN"]), orderController.createOrder);
router.delete("/:id", requireRole(["ADMIN"]), orderController.deleteOrder);

module.exports = router;
```

---

## 10. Database Rules (PostgreSQL 16 & Prisma)

### 10.1 Parameterized Queries (BẮT BUỘC ĐỐI VỚI RAW SQL)
```javascript
// ✅ ĐÚNG — Luôn dùng tham số ($1, $2, ...)
const result = await pool.query(
    `SELECT * FROM users WHERE id = $1 AND status = $2`,
    [userId, 'ACTIVE']
);

// ❌ TUYỆT ĐỐI CẤM — Nối chuỗi câu SQL (Nguy cơ SQL Injection)
const result = await pool.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

### 10.2 Soft Delete
```javascript
// ✅ Cập nhật cột deleted_at
await pool.query(`UPDATE trucks SET deleted_at = NOW() WHERE id = $1`, [id]);

// ✅ Luôn lọc deleted_at IS NULL khi query
await pool.query(`SELECT * FROM trucks WHERE deleted_at IS NULL`);
```

### 10.3 Chuẩn hóa ENUM Values (Khớp 100% với SRS)
```sql
-- orders.status:
'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED'

-- trips.status:
'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'

-- trucks.status:
'AVAILABLE', 'ON_TRIP', 'MAINTENANCE', 'DECOMMISSIONED', 'INACTIVE'

-- incidents.type:
'BREAKDOWN', 'ACCIDENT', 'CARGO_DAMAGED', 'DELAY', 'OTHER'

-- compensation_claims.status:
'PENDING', 'APPROVED', 'REJECTED'

-- vendors.approval_status:
'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'

-- transport_contracts.status:
'DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'
```

---

## 11. Authentication & Security Rules

### 11.1 Token & Cookie Flow
1. Client `POST /api/v1/auth/login` $\rightarrow$ Server xác thực bcrypt $\rightarrow$ Trả về JWT qua **Cookie httpOnly**.
2. Client tự động đính kèm cookie (`credentials: 'include'`).
3. `requireAuth` middleware đọc token từ `req.cookies.token` hoặc `Authorization: Bearer <token>`.
4. Không bao giờ lưu token trong `localStorage` để chống tấn công XSS.

### 11.2 Bảo mật tuyệt đối (Security Musts & Forbiddens)
- ✅ Băm mật khẩu bằng `bcrypt` (salt rounds $\ge 10$).
- ✅ Thiết lập CORS giới hạn domain cụ thể (`http://localhost:3000`, production domain).
- ❌ **TUYỆT ĐỐI KHÔNG** log password / token / secret key ra console log.
- ❌ **TUYỆT ĐỐI KHÔNG** trả về `password_hash` trong bất kỳ response JSON nào.
- ❌ **TUYỆT ĐỐI KHÔNG** commit file `.env` lên Git repository.

---

## 12. Error Handling & Mã thông báo hệ thống (MSG Mapping)

### 12.1 Format Response chuẩn
```javascript
// Response thành công
return res.status(200).json({
    message: "Success",
    data: result
});

// Response lỗi có gắn mã thông báo hệ thống MSG (theo SRS)
return res.status(400).json({
    message: "Dữ liệu không hợp lệ",
    code: "MSG41",
    error: "Đơn hàng đã quá hạn xử lý gán chuyến."
});
```

---

## 13. Quy trình tạo mới một Module (Checklist)

Khi phát triển thêm tính năng hoặc phân hệ mới (ví dụ: `documents`, `claims`), tuân thủ thứ tự:

1. Xác định vị trí phân tầng: **Entry Module**, **Business Module** hay **Base Module**.
2. Kiểm tra/Tạo migration database: Cập nhật schema trong `prisma/schema.prisma` hoặc bảng PostgreSQL.
3. Tạo Data Access: `models/{module}Model.js`.
4. Tạo Business Logic: `services/{module}Service.js`.
5. Tạo Controller xử lý API: `controllers/{module}Controller.js`.
6. Định nghĩa Routes và phân quyền: `routes/{module}Routes.js`.
7. Đăng ký vào route aggregator `routes/index.js` (dưới tiền tố `/api/v1/{module}`).
8. Viết Background Job tương ứng (nếu có yêu cầu xử lý ngầm) tại `jobs/`.

---

> 📌 **Tài liệu này là quy chuẩn bắt buộc cho mọi thành viên trong dự án NEXLOG.** Mọi pull request hoặc commit phải tuân thủ nghiêm ngặt các nguyên tắc trên.