const staffAccountService = require("../services/staffAccountService");

const staffAccountController = {
    // 1. GET /api/manager/accounts - Lấy danh sách tài khoản nhân viên (Screen 26)
    getStaffAccounts: async (req, res) => {
        try {
            const { search, role, status } = req.query;
            const accounts = await staffAccountService.getStaffAccounts({ search, role, status });
            return res.status(200).json({
                message: "Lấy danh sách tài khoản nhân viên thành công",
                total: accounts.length,
                accounts
            });
        } catch (error) {
            console.error("getStaffAccounts Error:", error);
            return res.status(error.statusCode || 500).json({
                message: error.message || "Lỗi khi lấy danh sách tài khoản nhân viên",
                error: error.message
            });
        }
    },

    // 2. GET /api/manager/accounts/:id - Lấy chi tiết tài khoản nhân viên (Screen 27)
    getStaffAccountDetail: async (req, res) => {
        try {
            const { id } = req.params;
            const account = await staffAccountService.getStaffAccountById(id);
            return res.status(200).json({
                message: "Lấy thông tin tài khoản thành công",
                account
            });
        } catch (error) {
            console.error("getStaffAccountDetail Error:", error);
            return res.status(error.statusCode || 500).json({
                message: error.message || "Lỗi khi lấy thông tin tài khoản",
                error: error.message
            });
        }
    },

    // 3. POST /api/manager/accounts - Tạo mới tài khoản nhân viên (Screen 27)
    createStaffAccount: async (req, res) => {
        try {
            const result = await staffAccountService.createStaffAccount(req.body);
            return res.status(201).json({
                message: `Tạo tài khoản ${result.username} thành công`,
                account: result
            });
        } catch (error) {
            console.error("createStaffAccount Error:", error);
            return res.status(error.statusCode || 500).json({
                message: error.message || "Lỗi khi tạo tài khoản nhân viên",
                error: error.message
            });
        }
    },

    // 4. PUT /api/manager/accounts/:id - Cập nhật thông tin tài khoản (Screen 27)
    updateStaffAccount: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await staffAccountService.updateStaffAccount(id, req.body);
            return res.status(200).json({
                message: "Cập nhật thông tin tài khoản thành công",
                account: result
            });
        } catch (error) {
            console.error("updateStaffAccount Error:", error);
            return res.status(error.statusCode || 500).json({
                message: error.message || "Lỗi khi cập nhật tài khoản nhân viên",
                error: error.message
            });
        }
    },

    // 5. PATCH /api/manager/accounts/:id/status - Khóa hoặc mở khóa tài khoản
    updateAccountStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const result = await staffAccountService.toggleStaffAccountStatus(id, status);
            return res.status(200).json(result);
        } catch (error) {
            console.error("updateAccountStatus Error:", error);
            return res.status(error.statusCode || 500).json({
                message: error.message || "Lỗi khi thay đổi trạng thái tài khoản",
                error: error.message
            });
        }
    }
};

module.exports = staffAccountController;
