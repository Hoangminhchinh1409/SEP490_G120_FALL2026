# 📋 NEXLOG Backend — Coding Rules & Conventions

> **Phiên bản:** 1.0  
> **Cập nhật:** 2026-10-14  
> **Tech Stack:** Node.js · Express 5 · PostgreSQL (Supabase) · JWT · bcrypt

---

## 1. Kiến trúc dự án (Project Architecture)

```
BE/
├── config/           # Cấu hình database, Supabase client
│   ├── db.js         # PostgreSQL Pool (pg) — dùng cho raw SQL query
│   └── supabase.js   # Supabase Client — dùng cho Supabase SDK query
├── controllers/      # Xử lý request/response (nhận req, trả res)
├── services/         # Business logic (xử lý nghiệp vụ, không chạm req/res)
├── models/           # Data access layer (truy vấn database)
├── middlewares/      # Middleware (auth, logging, validation, error handler)
├── routes/           # Định nghĩa API endpoints & gắn middleware
│   └── index.js      # Route aggregator — gom tất cả sub-routes
├── server.js         # Entry point — khởi tạo Express app
├── .env              # Biến môi trường (KHÔNG commit lên git)
└── package.json
```

### 1.1 Luồng xử lý request

```
Client Request
    → routes/{module}Routes.js     (URL mapping + middleware)
    → middlewares/                  (auth, validation, role check)
    → controllers/{module}Controller.js  (parse input, gọi service, trả response)
    → services/{module}Service.js   (business logic)
    → models/{module}Model.js       (database query)
    → Response
```

### 1.2 Quy tắc phân tầng

| Tầng | Được phép truy cập | KHÔNG được |
|------|-------------------|-----------|
| **Route** | Controller, Middleware | Gọi trực tiếp Model/Service |
| **Controller** | Service, trả `res.json()` | Viết raw SQL, gọi trực tiếp Model |
| **Service** | Model, các Service khác | Truy cập `req`, `res` |
| **Model** | `pool` (pg) hoặc `supabase` client | Business logic |
| **Middleware** | `req`, `res`, `next()` | Business logic phức tạp |

> ⚠️ **Lưu ý thực tế:** `managerController.js` hiện tại đang query trực tiếp bằng `pool.query()` trong controller. Với các module **mới**, hãy tách ra theo đúng 3 tầng Controller → Service → Model. Các module cũ sẽ được refactor dần.

---

## 2. Quy tắc đặt tên (Naming Conventions)

### 2.1 Files

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Controller | `{module}Controller.js` | `orderController.js`, `managerController.js` |
| Service | `{module}Service.js` | `authService.js`, `orderService.js` |
| Model | `{module}Model.js` | `userModel.js`, `truckModel.js` |
| Route | `{module}Routes.js` | `authRoutes.js`, `managerRoutes.js` |
| Middleware | `{feature}Middleware.js` | `authMiddleware.js`, `validationMiddleware.js` |
| Config | `{name}.js` | `db.js`, `supabase.js` |

### 2.2 Variables & Functions

```javascript
// ✅ camelCase cho variables & functions
const totalRevenue = 100;
const findUserById = async (id) => { ... };

// ✅ UPPER_SNAKE_CASE cho constants & enums
const MAX_PAGE_SIZE = 100;
const ORDER_STATUS = {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED'
};

// ❌ KHÔNG dùng
const Total_Revenue = 100;    // PascalCase cho biến
const find_user_by_id = () => {}; // snake_case cho function JS
```

### 2.3 API Endpoints

```
GET    /api/{module}                   # Lấy danh sách
GET    /api/{module}/:id               # Lấy chi tiết
POST   /api/{module}                   # Tạo mới
PUT    /api/{module}/:id               # Cập nhật toàn bộ
PATCH  /api/{module}/:id               # Cập nhật một phần
DELETE /api/{module}/:id               # Xoá

# Hành động đặc biệt: dùng verb sau resource
PATCH  /api/orders/:id/reassign        # Gán lại đơn hàng
PATCH  /api/vendors/:id/approve        # Phê duyệt nhà xe
POST   /api/approvals/:id/decide       # Quyết định bồi thường
```

### 2.4 Database columns

```sql
-- ✅ snake_case cho tên bảng và cột (PostgreSQL convention)
created_at, updated_at, deleted_at
full_name, role_id, password_hash
tracking_email, tracking_token

-- ✅ UPPER_SNAKE_CASE cho giá trị enum
'PENDING', 'ACTIVE', 'ON_TRIP', 'AVAILABLE', 'MAINTENANCE'
```

---

## 3. Patterns & Code Style

### 3.1 Controller Pattern

```javascript
// ✅ ĐÚNG — Controller function template
const getOrders = async (req, res) => {
    try {
        // 1. Parse input từ req
        const { page = 1, limit = 20, status } = req.query;
        const userId = req.user.id;

        // 2. Gọi service (hoặc query trực tiếp nếu đơn giản)
        const result = await orderService.getOrders({ page, limit, status, userId });

        // 3. Trả response thành công
        return res.status(200).json({
            message: "Success",
            ...result
        });

    } catch (error) {
        // 4. Log lỗi & trả response lỗi
        console.error("getOrders Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};
```

### 3.2 Service Pattern

```javascript
// ✅ ĐÚNG — Service không chạm req/res
const getOrders = async ({ page, limit, status, userId }) => {
    const orders = await orderModel.findOrders({ page, limit, status });
    
    // Business logic xử lý ở đây
    const enriched = orders.map(order => ({
        ...order,
        isOverdue: new Date(order.expected_delivery_time) < new Date()
    }));

    return { orders: enriched, total: orders.length };
};
```

### 3.3 Model Pattern (Supabase SDK)

```javascript
// ✅ ĐÚNG — Dùng Supabase Client
const supabase = require("../config/supabase");

const findUserByIdentifier = async (identifier) => {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .or(`username.eq.${identifier},email.eq.${identifier}`)
        .maybeSingle();

    if (error) throw error;
    return data;
};
```

### 3.4 Model Pattern (Raw SQL — pg Pool)

```javascript
// ✅ ĐÚNG — Dùng pg Pool với parameterized queries
const pool = require("../config/db");

const findOrderById = async (id) => {
    const result = await pool.query(
        `SELECT * FROM orders WHERE id = $1 AND deleted_at IS NULL`,
        [id]
    );
    return result.rows[0] || null;
};
```

### 3.5 Khi nào dùng `pool` vs `supabase`?

| Dùng `pool` (pg) | Dùng `supabase` SDK |
|-------------------|-------------------|
| Query phức tạp với nhiều JOIN | CRUD đơn giản (SELECT, INSERT, UPDATE) |
| Aggregate functions (SUM, COUNT, GROUP BY) | Cần dùng `.maybeSingle()`, `.single()` |
| Sub-queries, CTE (WITH ... AS) | Real-time subscriptions |
| Khi cần control tối đa SQL | Auth / Storage Supabase |

---

## 4. Route & Middleware Rules

### 4.1 Route Registration

```javascript
// ✅ ĐÚNG — Đăng ký route trong routes/{module}Routes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { getOrders, createOrder } = require("../controllers/orderController");

// Middleware cấp route-group (áp dụng cho tất cả route trong file)
router.use(requireAuth);

// Route definitions
router.get("/", getOrders);
router.post("/", createOrder);

module.exports = router;
```

```javascript
// ✅ ĐÚNG — Gom route trong routes/index.js
const router = express.Router();
router.use("/auth", authRoutes);
router.use("/orders", orderRoutes);
module.exports = router;
```

```javascript
// ✅ ĐÚNG — Mount trong server.js
app.use("/api/manager", managerRoutes);  // Route riêng
app.use("/api", apiRoutes);              // Route gom từ index.js
```

### 4.2 Role-Based Access Control

```javascript
// ✅ Role IDs trong database
// 1 = ADMIN (Administrator)
// 2 = MANAGER
// 3 = DISPATCHER
// 4 = DRIVER
// 5 = CUSTOMER

// ✅ ĐÚNG — Bảo vệ route theo role
router.use(requireRole(["MANAGER", "ADMIN"]));

// ✅ ĐÚNG — Bảo vệ route đơn lẻ
router.delete("/:id", requireRole(["ADMIN"]), deleteUser);
```

---

## 5. Database Rules

### 5.1 Parameterized Queries (CRITICAL)

```javascript
// ✅ ĐÚNG — Luôn dùng parameterized query ($1, $2, ...)
const result = await pool.query(
    `SELECT * FROM users WHERE id = $1 AND status = $2`,
    [userId, 'ACTIVE']
);

// ❌ SAI — TUYỆT ĐỐI KHÔNG string interpolation trong SQL
const result = await pool.query(
    `SELECT * FROM users WHERE id = '${userId}'`  // SQL INJECTION!
);
```

### 5.2 Soft Delete

```javascript
// ✅ ĐÚNG — Dùng soft delete (cột deleted_at)
await pool.query(
    `UPDATE trucks SET deleted_at = NOW() WHERE id = $1`, [id]
);

// ✅ ĐÚNG — Luôn filter deleted_at khi SELECT
await pool.query(
    `SELECT * FROM trucks WHERE deleted_at IS NULL`
);

// ❌ SAI — KHÔNG dùng hard delete trừ khi có lý do đặc biệt
await pool.query(`DELETE FROM trucks WHERE id = $1`, [id]);
```

### 5.3 Timestamps

```javascript
// ✅ Database tự quản lý created_at, updated_at qua trigger/default
// Chỉ cần set khi cần override
await pool.query(
    `INSERT INTO users (username, email, created_at) 
     VALUES ($1, $2, NOW())`,
    [username, email]
);
```

### 5.4 UUID

```
-- Project dùng UUID v4 cho primary keys
-- PostgreSQL tự generate: DEFAULT gen_random_uuid()
-- Không cần truyền id khi INSERT (trừ khi cần gán cụ thể)
```

### 5.5 Enum Values (PHẢI đúng chính xác)

```
-- orders.status:
'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED'

-- trucks.status:
'AVAILABLE', 'ON_TRIP', 'MAINTENANCE', 'DECOMMISSIONED'

-- users.status:
'ACTIVE', 'INACTIVE', 'SUSPENDED'

-- incidents.type:
'BREAKDOWN', 'ACCIDENT', 'CARGO_DAMAGED', 'DELAY', 'OTHER'

-- compensation_claims.status:
'PENDING', 'APPROVED', 'REJECTED'

-- vendors.approval_status:
'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'

-- transport_contracts.status:
'DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'

-- trips.status:
'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
```

> ⚠️ Kiểm tra enum thật trong database trước khi INSERT/UPDATE. Sai enum sẽ bị PostgreSQL reject với lỗi constraint.

---

## 6. Authentication & Authorization

### 6.1 Token Flow

```
1. Client POST /api/auth/login  →  Server trả cookie httpOnly chứa JWT
2. Client gọi API khác          →  Cookie tự động gửi kèm (credentials: 'include')
3. Middleware requireAuth        →  Lấy token từ cookie HOẶC header Authorization
4. Middleware requireRole        →  Kiểm tra role_id trong JWT payload
```

### 6.2 JWT Payload

```javascript
// JWT chứa:
{
    id: "uuid-v4",          // user.id
    username: "manager01",  // user.username
    role_id: 2,             // user.role_id (Number)
    iat: 1234567890,        // issued at (tự động)
    exp: 1234654290         // expires in 1 day (tự động)
}
```

### 6.3 Cookie Settings

```javascript
// ✅ ĐÚNG — Cookie config
res.cookie("token", token, {
    httpOnly: true,                                    // Không truy cập qua JS
    secure: process.env.NODE_ENV === "production",     // HTTPS only in prod
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000                        // 1 ngày
});
```

---

## 7. Error Handling

### 7.1 HTTP Status Codes

| Code | Dùng khi |
|------|---------|
| `200` | Thành công |
| `201` | Tạo mới thành công |
| `400` | Input không hợp lệ (missing fields, wrong format) |
| `401` | Chưa đăng nhập / Token hết hạn |
| `403` | Không có quyền truy cập |
| `404` | Resource không tìm thấy |
| `409` | Conflict (duplicate username, email) |
| `500` | Lỗi server / database |

### 7.2 Response Format

```javascript
// ✅ ĐÚNG — Response thành công
return res.status(200).json({
    message: "Success",
    data: result
});

// ✅ ĐÚNG — Response lỗi
return res.status(400).json({
    message: "Validation failed",
    error: "Email is required"
});

// ✅ ĐÚNG — Response với danh sách
return res.status(200).json({
    message: "Success",
    orders: [...],
    total: 100,
    page: 1,
    limit: 20
});
```

### 7.3 Error Logging

```javascript
// ✅ ĐÚNG — Log đủ context
console.error("getOrders Error:", error);
console.error(`[OrderController] Failed to get order ${id}:`, error.message);

// ❌ SAI — Log không đủ thông tin
console.log(error);
console.error("error");
```

---

## 8. Security Rules

### 8.1 Bắt buộc (MUST)

- ✅ **Parameterized queries** cho tất cả database calls — KHÔNG BAO GIỜ nối string
- ✅ **bcrypt** để hash password (cost factor ≥ 10)
- ✅ **httpOnly cookie** cho JWT — không lưu token ở localStorage
- ✅ **Input validation** trước khi query database
- ✅ **CORS** chỉ cho phép origin cụ thể (`http://localhost:3000`)
- ✅ **Rate limiting** cho login endpoint (sẽ bổ sung)

### 8.2 Cấm (MUST NOT)

- ❌ KHÔNG log password / token ra console
- ❌ KHÔNG trả `password_hash` trong bất kỳ API response nào
- ❌ KHÔNG commit file `.env` lên git
- ❌ KHÔNG hard-code credentials trong source code
- ❌ KHÔNG dùng `SELECT *` khi chỉ cần vài cột (trừ model cần full data)

---

## 9. Environment Variables (.env)

```env
# Database
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Auth
JWT_SECRET=your-jwt-secret-here

# Server
PORT=9999
NODE_ENV=development
```

> ⚠️ File `.env` đã có trong `.gitignore`. KHÔNG BAO GIỜ commit lên repository.

---

## 10. Import Order

```javascript
// 1. Node.js built-in modules
const path = require("path");

// 2. Third-party packages
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// 3. Project config
const pool = require("../config/db");
const supabase = require("../config/supabase");

// 4. Project modules (services, models, middlewares)
const authService = require("../services/authService");
const userModel = require("../models/userModel");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
```

---

## 11. Module Export Convention

```javascript
// ✅ ĐÚNG — Module export ở cuối file
const functionA = async (req, res) => { ... };
const functionB = async (req, res) => { ... };

module.exports = {
    functionA,
    functionB
};

// ❌ SAI — export inline
module.exports.functionA = async (req, res) => { ... };
exports.functionA = async (req, res) => { ... };
```

---

## 12. Git & Code Review

### 12.1 Branch Naming

```
feature/{module}-{feature}    # feature/manager-fleet-crud
bugfix/{module}-{description} # bugfix/auth-token-expired
hotfix/{description}          # hotfix/cors-production
```

### 12.2 Commit Message

```
feat(manager): add fleet management endpoints
fix(auth): handle numeric role_id comparison
refactor(orders): extract service layer
docs(backend): add coding rules document
```

### 12.3 Checklist trước khi Push

- [ ] Không có `console.log()` dư thừa (chỉ giữ `console.error` cho error)
- [ ] Không có file test/seed tạm còn sót
- [ ] Không có credentials/secrets trong code
- [ ] Tất cả SQL queries dùng parameterized ($1, $2...)
- [ ] Đã test API bằng Postman / cURL / script
- [ ] Response format nhất quán (có `message`, data key rõ ràng)

---

## 13. Checklist tạo Module mới

Khi tạo module mới (VD: `dispatcher`), tạo theo thứ tự:

```
1. models/dispatcherModel.js      → Database queries
2. services/dispatcherService.js   → Business logic
3. controllers/dispatcherController.js → Request handling
4. routes/dispatcherRoutes.js      → Endpoint definitions
5. routes/index.js                 → Đăng ký route mới
6. (hoặc server.js nếu route riêng)
```

---

## 14. Các công cụ phát triển

| Công cụ | Mục đích |
|---------|---------|
| `nodemon` | Auto-restart khi code thay đổi |
| `dotenv` | Load biến môi trường từ `.env` |
| Postman / Thunder Client | Test API thủ công |
| `pg` (node-postgres) | Raw SQL queries |
| `@supabase/supabase-js` | Supabase SDK queries |

---

> 📌 **Tài liệu này sẽ được cập nhật khi project phát triển thêm.**  
> Mọi thành viên trong team Backend phải đọc và tuân thủ trước khi code.
