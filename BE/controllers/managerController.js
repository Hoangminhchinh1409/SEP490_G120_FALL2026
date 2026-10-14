const pool = require("../config/db");

// 1. DASHBOARD: Thống kê tổng quan
const getDashboardStats = async (req, res) => {
    try {
        // Thống kê doanh thu từ orders
        const revenueResult = await pool.query(`
            SELECT 
                COALESCE(SUM(agreed_price), 0) AS total_revenue,
                COUNT(*) AS total_orders,
                COUNT(CASE WHEN late_risk = true OR waiting_too_long = true THEN 1 END) AS delayed_orders
            FROM orders
        `);
        const totalRevenue = Number(revenueResult.rows[0]?.total_revenue || 0);
        const totalOrders = Number(revenueResult.rows[0]?.total_orders || 0);
        const delayedOrders = Number(revenueResult.rows[0]?.delayed_orders || 0);

        // Tỉ lệ SLA
        const slaRate = totalOrders > 0 
            ? (((totalOrders - delayedOrders) / totalOrders) * 100).toFixed(1) 
            : "92.5";

        // Thống kê xe
        const trucksResult = await pool.query(`
            SELECT status, COUNT(*) AS count 
            FROM trucks 
            WHERE deleted_at IS NULL 
            GROUP BY status
        `);
        const truckCounts = trucksResult.rows;
        const totalTrucks = truckCounts.reduce((acc, cur) => acc + Number(cur.count), 0);
        const onTripTrucks = Number(truckCounts.find(t => t.status === 'ON_TRIP')?.count || 0);
        const truckUtilization = totalTrucks > 0 
            ? ((onTripTrucks / totalTrucks) * 100).toFixed(1) 
            : "85.4";

        // Thống kê sự cố
        const incidentsResult = await pool.query(`
            SELECT type, COUNT(*) AS count 
            FROM incidents 
            GROUP BY type
        `);
        const totalIncidentsResult = await pool.query(`SELECT COUNT(*) FROM incidents`);
        const totalIncidents = Number(totalIncidentsResult.rows[0]?.count || 0);

        // Map loại sự cố sang tiếng Việt thân thiện
        const incidentTypeMap = {
            'BREAKDOWN': 'Hỏng xe',
            'ACCIDENT': 'Tai nạn',
            'CARGO_DAMAGED': 'Hàng hóa hư hỏng',
            'CARGO_LOST': 'Thất thoát hàng',
            'ROAD_BAN': 'Cấm đường / Trễ tuyến',
            'FAILED_DELIVERY': 'Giao hàng thất bại',
            'HELD_BY_AUTHORITIES': 'Cơ quan chức năng giữ xe',
            'OTHER': 'Sự cố khác'
        };

        const incidentData = incidentsResult.rows.map((row, idx) => ({
            key: String(idx + 1),
            type: incidentTypeMap[row.type] || row.type,
            rawType: row.type,
            count: Number(row.count),
            trend: Number(row.count) > 5 ? 'up' : 'down'
        }));

        // Khối lượng đơn của Dispatchers
        const dispatchersResult = await pool.query(`
            SELECT 
                u.id, 
                u.username, 
                u.full_name,
                COUNT(o.id) AS total_count,
                COUNT(CASE WHEN o.status IN ('READY_FOR_PLANNING', 'PLANNED', 'ASSIGNED', 'IN_TRANSIT') THEN 1 END) AS active_count
            FROM users u
            LEFT JOIN orders o ON o.responsible_dispatcher_id = u.id
            WHERE u.role_id = 3 OR u.username LIKE '%disp%'
            GROUP BY u.id, u.username, u.full_name
            ORDER BY total_count DESC
            LIMIT 5
        `);

        const dispatcherWorkload = dispatchersResult.rows.map(d => {
            const count = Number(d.total_count);
            const active = Number(d.active_count);
            const percent = count > 0 ? Math.min(Math.round((active / count) * 100), 100) : 0;
            return {
                id: d.id,
                name: `${d.full_name || d.username} (${d.username})`,
                count,
                active,
                percent: percent || 50
            };
        });

        return res.json({
            stats: {
                revenue: totalRevenue,
                revenueFormatted: totalRevenue >= 1000000000 
                    ? `${(totalRevenue / 1000000000).toFixed(2)}B` 
                    : (totalRevenue >= 1000000 
                        ? `${(totalRevenue / 1000000).toFixed(0)}M` 
                        : `${totalRevenue.toLocaleString('vi-VN')}`),
                truckUtilization: totalTrucks > 0 ? ((onTripTrucks / totalTrucks) * 100).toFixed(1) : "0.0",
                totalTrucks,
                onTripTrucks,
                slaRate: totalOrders > 0 ? (((totalOrders - delayedOrders) / totalOrders) * 100).toFixed(1) : "100.0",
                totalOrders,
                delayedOrders,
                totalIncidents: totalIncidents,
                incidentData: incidentData,
                dispatcherWorkload: dispatcherWorkload
            }
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// 2. FLEET: Lấy danh sách đội xe & tài xế
const getVehicles = async (req, res) => {
    try {
        // Danh sách xe tải
        const trucksResult = await pool.query(`
            SELECT 
                id, 
                plate_number, 
                payload_kg, 
                status, 
                box_length_cm, 
                box_width_cm, 
                box_height_cm,
                inspection_expiry,
                insurance_expiry
            FROM trucks 
            WHERE deleted_at IS NULL 
            ORDER BY id ASC
        `);

        // Danh sách tài xế
        const driversResult = await pool.query(`
            SELECT 
                dp.id, 
                dp.user_id, 
                u.full_name AS name, 
                u.phone, 
                dp.license_class AS license, 
                dp.license_expiry AS expiry, 
                dp.status
            FROM driver_profiles dp 
            JOIN users u ON dp.user_id = u.id 
            ORDER BY dp.id ASC
        `);

        return res.json({ 
            trucks: trucksResult.rows,
            drivers: driversResult.rows
        });
    } catch (error) {
        console.error("Get Vehicles Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Thêm tài xế mới
const createDriver = async (req, res) => {
    try {
        const { name, phone, license, expiry } = req.body;
        if (!name || !phone) {
            return res.status(400).json({ message: "Tên và số điện thoại là bắt buộc" });
        }

        // Tạo user tài xế nếu chưa có
        const username = `driver_${phone.slice(-4)}_${Math.floor(Math.random() * 100)}`;
        const userResult = await pool.query(`
            INSERT INTO users (username, full_name, phone, role_id, status)
            VALUES ($1, $2, $3, 4, 'ACTIVE')
            RETURNING id, full_name, phone
        `, [username, name, phone]);

        const newUser = userResult.rows[0];

        // Tạo hồ sơ tài xế
        const licenseNumber = `GPLX-${phone.slice(-6)}`;
        const driverResult = await pool.query(`
            INSERT INTO driver_profiles (user_id, license_number, license_class, license_expiry, status)
            VALUES ($1, $2, $3, $4, 'ACTIVE')
            RETURNING *
        `, [newUser.id, licenseNumber, license || 'B2', expiry ? new Date(expiry) : null]);

        return res.status(201).json({
            message: "Thêm tài xế thành công",
            driver: {
                id: driverResult.rows[0].id,
                name: newUser.full_name,
                phone: newUser.phone,
                license: driverResult.rows[0].license_class,
                expiry: driverResult.rows[0].license_expiry,
                status: driverResult.rows[0].status
            }
        });
    } catch (error) {
        console.error("Create Driver Error:", error);
        return res.status(500).json({ message: "Không thể thêm tài xế", error: error.message });
    }
};

// 3. ORDERS: Lấy danh sách đơn hàng & danh sách Dispatchers
const getOrders = async (req, res) => {
    try {
        const ordersResult = await pool.query(`
            SELECT 
                o.id, 
                o.order_code, 
                o.status, 
                o.responsible_dispatcher_id, 
                o.agreed_price, 
                o.created_at, 
                o.ready_for_planning_at, 
                o.waiting_too_long, 
                o.late_risk, 
                u.username AS dispatcher_username, 
                u.full_name AS dispatcher_name 
            FROM orders o 
            LEFT JOIN users u ON o.responsible_dispatcher_id = u.id 
            ORDER BY o.id DESC
        `);

        const dispatchersResult = await pool.query(`
            SELECT 
                u.id, 
                u.username, 
                u.full_name,
                COUNT(CASE WHEN o.status IN ('READY_FOR_PLANNING', 'PLANNED', 'ASSIGNED', 'IN_TRANSIT') THEN 1 END) AS active_orders
            FROM users u
            LEFT JOIN orders o ON o.responsible_dispatcher_id = u.id
            WHERE u.role_id = 3 OR u.username LIKE '%disp%'
            GROUP BY u.id, u.username, u.full_name
            ORDER BY u.id ASC
        `);

        return res.json({ 
            orders: ordersResult.rows,
            dispatchers: dispatchersResult.rows
        });
    } catch (error) {
        console.error("Get Orders Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Chuyển giao đơn hàng sang Dispatcher khác
const reassignOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { newDispatcherId } = req.body;

        if (!newDispatcherId) {
            return res.status(400).json({ message: "Vui lòng chọn điều phối viên mới" });
        }

        const updateResult = await pool.query(`
            UPDATE orders 
            SET responsible_dispatcher_id = $1, updated_at = NOW() 
            WHERE id = $2 
            RETURNING id, order_code, responsible_dispatcher_id
        `, [newDispatcherId, id]);

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        return res.json({ 
            message: "Chuyển giao đơn hàng thành công", 
            order: updateResult.rows[0] 
        });
    } catch (error) {
        console.error("Reassign Order Error:", error);
        return res.status(500).json({ message: "Chuyển giao thất bại", error: error.message });
    }
};

// 4. VENDORS: Lấy danh sách nhà cung cấp & hợp đồng
const getVendors = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                v.id, 
                v.company_name AS name, 
                v.approval_status AS status, 
                v.contact_person, 
                v.phone,
                v.truck_types,
                tc.id AS contract_id,
                COALESCE(tc.contract_number, 'HD-' || v.id || '-2026') AS "contractId",
                tc.valid_to AS expiry,
                COALESCE(tc.status, 'INACTIVE') AS contract_status
            FROM vendors v 
            LEFT JOIN transport_contracts tc ON v.id = tc.vendor_id 
            ORDER BY v.id DESC
        `);

        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) AS total_vendors,
                COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END) AS approved_vendors,
                COUNT(CASE WHEN approval_status = 'PENDING' THEN 1 END) AS pending_vendors
            FROM vendors
        `);

        const contractsResult = await pool.query(`
            SELECT 
                COUNT(*) AS total_contracts,
                COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active_contracts
            FROM transport_contracts
        `);

        return res.json({ 
            vendors: result.rows,
            stats: {
                totalVendors: Number(statsResult.rows[0]?.total_vendors || 0),
                approvedVendors: Number(statsResult.rows[0]?.approved_vendors || 0),
                pendingVendors: Number(statsResult.rows[0]?.pending_vendors || 0),
                totalContracts: Number(contractsResult.rows[0]?.total_contracts || 0),
                activeContracts: Number(contractsResult.rows[0]?.active_contracts || 0)
            }
        });
    } catch (error) {
        console.error("Get Vendors Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Phê duyệt nhà cung cấp / Hợp đồng
const approveVendor = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(`
            UPDATE vendors 
            SET approval_status = 'APPROVED', updated_at = NOW() 
            WHERE id = $1
        `, [id]);

        await pool.query(`
            UPDATE transport_contracts 
            SET status = 'ACTIVE', updated_at = NOW() 
            WHERE vendor_id = $1
        `, [id]);

        return res.json({ message: "Phê duyệt đối tác và hợp đồng thành công" });
    } catch (error) {
        console.error("Approve Vendor Error:", error);
        return res.status(500).json({ message: "Phê duyệt thất bại", error: error.message });
    }
};

// 5. APPROVALS: Lấy danh sách các yêu cầu / sự cố cần duyệt
const getApprovals = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                i.id, 
                'INC-' || LPAD(i.id::text, 3, '0') AS code,
                COALESCE('TRIP-' || i.trip_id, 'TRIP-998') AS "tripId",
                i.type,
                i.fault,
                i.status,
                i.description,
                cc.id AS claim_id,
                COALESCE(cc.amount, 0) AS cost,
                COALESCE(cc.status, 'PENDING') AS claim_status,
                cc.reason AS claim_reason,
                u.full_name AS requester_name
            FROM incidents i 
            LEFT JOIN compensation_claims cc ON cc.incident_id = i.id 
            LEFT JOIN driver_profiles dp ON i.reported_by = dp.id 
            LEFT JOIN users u ON dp.user_id = u.id 
            ORDER BY i.id DESC
        `);

        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) AS total_incidents,
                COUNT(CASE WHEN i.status = 'REPORTED' OR i.status = 'ESCALATED' OR cc.status = 'PENDING' THEN 1 END) AS pending_approvals,
                COUNT(CASE WHEN i.status = 'RESOLVED' OR cc.status = 'APPROVED' THEN 1 END) AS approved_count,
                COALESCE(SUM(cc.amount), 0) AS total_claim_amount
            FROM incidents i
            LEFT JOIN compensation_claims cc ON cc.incident_id = i.id
        `);

        return res.json({ 
            requests: result.rows,
            stats: {
                totalIncidents: Number(statsResult.rows[0]?.total_incidents || 0),
                pendingApprovals: Number(statsResult.rows[0]?.pending_approvals || 0),
                approvedCount: Number(statsResult.rows[0]?.approved_count || 0),
                totalClaimAmount: Number(statsResult.rows[0]?.total_claim_amount || 0)
            }
        });
    } catch (error) {
        console.error("Get Approvals Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Quyết định phê duyệt hoặc từ chối bồi thường sự cố
const decideApproval = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason, note } = req.body; // 'APPROVE' or 'REJECT'
        const userId = req.user?.id || null;

        const isApprove = action === 'APPROVE' || action === 'Approve';
        const claimStatus = isApprove ? 'APPROVED' : 'REJECTED';
        const incidentStatus = isApprove ? 'RESOLVED' : 'CLOSED';
        const decisionComment = note || reason || (isApprove ? 'Phê duyệt bồi thường' : 'Từ chối bồi thường');

        // Cập nhật claim nếu có
        await pool.query(`
            UPDATE compensation_claims 
            SET 
                status = $1, 
                decided_by = $2, 
                decided_at = NOW(), 
                decision_comment = $3,
                updated_at = NOW()
            WHERE incident_id = $4 OR id = $4
        `, [claimStatus, userId, decisionComment, id]);

        // Cập nhật sự cố
        await pool.query(`
            UPDATE incidents 
            SET 
                status = $1, 
                resolution_note = $2, 
                resolved_by = $3, 
                resolved_at = NOW(),
                updated_at = NOW()
            WHERE id = $4
        `, [incidentStatus, decisionComment, userId, id]);

        return res.json({ 
            message: isApprove ? "Đã phê duyệt bồi thường thành công" : "Đã từ chối bồi thường thành công" 
        });
    } catch (error) {
        console.error("Decide Approval Error:", error);
        return res.status(500).json({ message: "Xử lý phê duyệt thất bại", error: error.message });
    }
};

// 6. BLOGS: Quản lý bản tin & báo cáo chuyên ngành
const getBlogs = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id, 
                title, 
                summary, 
                content, 
                category, 
                author, 
                author_initial AS "authorInitial", 
                author_color AS "authorColor", 
                views, 
                status, 
                status_label AS "statusLabel", 
                image_url AS image, 
                TO_CHAR(published_at, 'DD/MM/YYYY') AS "publishDate"
            FROM blogs 
            ORDER BY id DESC
        `);

        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) AS total_blogs,
                COUNT(CASE WHEN status = 'PUBLISHED' THEN 1 END) AS published_blogs,
                COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) AS draft_blogs,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_blogs,
                COALESCE(SUM(views), 0) AS total_views
            FROM blogs
        `);

        return res.json({
            blogs: result.rows,
            stats: {
                totalBlogs: Number(statsResult.rows[0]?.total_blogs || 0),
                publishedBlogs: Number(statsResult.rows[0]?.published_blogs || 0),
                draftBlogs: Number(statsResult.rows[0]?.draft_blogs || 0),
                pendingBlogs: Number(statsResult.rows[0]?.pending_blogs || 0),
                totalViews: Number(statsResult.rows[0]?.total_views || 0)
            }
        });
    } catch (error) {
        console.error("Get Blogs Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const createBlog = async (req, res) => {
    try {
        const { title, summary, content, category, author, status, image } = req.body;
        const initial = (author || 'Q').charAt(0).toUpperCase();

        const insertResult = await pool.query(`
            INSERT INTO blogs (title, summary, content, category, author, author_initial, author_color, views, status, status_label, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, 'bg-secondary text-white', 0, $7, $8, $9)
            RETURNING id, title, category, status, TO_CHAR(published_at, 'DD/MM/YYYY') AS "publishDate"
        `, [
            title, 
            summary || '', 
            content || '', 
            category || 'Thị trường & Vận hành', 
            author || 'Nguyễn Quản Lý', 
            initial, 
            status || 'PUBLISHED', 
            status === 'DRAFT' ? 'Bản nháp' : (status === 'PENDING' ? 'Chờ duyệt xuất bản' : 'Đã xuất bản'), 
            image || null
        ]);

        return res.status(201).json({
            message: "Tạo bài viết thành công",
            blog: insertResult.rows[0]
        });
    } catch (error) {
        console.error("Create Blog Error:", error);
        return res.status(500).json({ message: "Lỗi tạo bài viết", error: error.message });
    }
};

const approveBlog = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`
            UPDATE blogs 
            SET status = 'PUBLISHED', status_label = 'Đã xuất bản', published_at = NOW(), updated_at = NOW() 
            WHERE id = $1
        `, [id]);

        return res.json({ message: "Duyệt xuất bản bài viết thành công" });
    } catch (error) {
        console.error("Approve Blog Error:", error);
        return res.status(500).json({ message: "Duyệt bài viết thất bại", error: error.message });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM blogs WHERE id = $1`, [id]);
        return res.json({ message: "Xoá bài viết thành công" });
    } catch (error) {
        console.error("Delete Blog Error:", error);
        return res.status(500).json({ message: "Xoá bài viết thất bại", error: error.message });
    }
};

const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, summary, content, category, author, status, image } = req.body;
        const initial = (author || 'Q').charAt(0).toUpperCase();

        const updateResult = await pool.query(`
            UPDATE blogs 
            SET 
                title = COALESCE($1, title),
                summary = COALESCE($2, summary),
                content = COALESCE($3, content),
                category = COALESCE($4, category),
                author = COALESCE($5, author),
                author_initial = COALESCE($6, author_initial),
                status = COALESCE($7, status),
                status_label = CASE 
                    WHEN $7 = 'DRAFT' THEN 'Bản nháp'
                    WHEN $7 = 'PENDING' THEN 'Chờ duyệt xuất bản'
                    WHEN $7 = 'PUBLISHED' THEN 'Đã xuất bản'
                    ELSE status_label
                END,
                image_url = COALESCE($8, image_url),
                updated_at = NOW()
            WHERE id = $9
            RETURNING id, title, category, status, TO_CHAR(published_at, 'DD/MM/YYYY') AS "publishDate"
        `, [title, summary, content, category, author, initial, status, image, id]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy bài viết để cập nhật" });
        }

        return res.json({
            message: "Cập nhật bài viết thành công",
            blog: updateResult.rows[0]
        });
    } catch (error) {
        console.error("Update Blog Error:", error);
        return res.status(500).json({ message: "Lỗi cập nhật bài viết", error: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getVehicles,
    createDriver,
    getOrders,
    reassignOrder,
    getVendors,
    approveVendor,
    getApprovals,
    decideApproval,
    getBlogs,
    createBlog,
    updateBlog,
    approveBlog,
    deleteBlog
};

