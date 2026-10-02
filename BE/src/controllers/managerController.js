const pool = require("../config/db");

// 1. DASHBOARD: Thống kê tổng quan
const getDashboardStats = async (req, res) => {
    try {
        const vehiclesResult = await pool.query("SELECT status, COUNT(*) FROM vehicles GROUP BY status");
        const ordersResult = await pool.query("SELECT status, COUNT(*) FROM orders GROUP BY status");
        const requestsResult = await pool.query("SELECT status, COUNT(*) FROM requests GROUP BY status");

        const stats = {
            vehicles: vehiclesResult.rows,
            orders: ordersResult.rows,
            requests: requestsResult.rows
        };

        return res.json({ stats });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 2. FLEET: Lấy danh sách đội xe
const getVehicles = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM vehicles ORDER BY id DESC");
        return res.json({ vehicles: result.rows });
    } catch (error) {
        console.error("Get Vehicles Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 3. ORDERS: Lấy danh sách đơn hàng
const getOrders = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders ORDER BY id DESC");
        return res.json({ orders: result.rows });
    } catch (error) {
        console.error("Get Orders Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 4. VENDORS: Lấy danh sách nhà cung cấp
const getVendors = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM vendors ORDER BY id DESC");
        return res.json({ vendors: result.rows });
    } catch (error) {
        console.error("Get Vendors Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// 5. APPROVALS: Lấy danh sách các yêu cầu
const getApprovals = async (req, res) => {
    try {
        // Lấy danh sách kèm theo thông tin người yêu cầu
        const result = await pool.query(`
            SELECT r.*, u.username as requester_name 
            FROM requests r 
            LEFT JOIN users u ON r.requested_by = u.id
            ORDER BY r.id DESC
        `);
        return res.json({ requests: result.rows });
    } catch (error) {
        console.error("Get Approvals Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    getDashboardStats,
    getVehicles,
    getOrders,
    getVendors,
    getApprovals
};
