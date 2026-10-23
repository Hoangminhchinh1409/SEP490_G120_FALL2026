const bcrypt = require("bcrypt");
const crypto = require("crypto");
const staffAccountModel = require("../models/staffAccountModel");

// Role IDs hợp lệ theo đặc tả BR-28: Chỉ Dispatcher (3) và Driver (4)
const ALLOWED_STAFF_ROLE_IDS = [3, 4];
const ROLE_NAME_TO_ID = {
    DISPATCHER: 3,
    DRIVER: 4
};
const ROLE_ID_TO_NAME = {
    3: "DISPATCHER",
    4: "DRIVER"
};

const staffAccountService = {
    // 1. Lấy danh sách tài khoản nhân viên kèm tìm kiếm & bộ lọc
    getStaffAccounts: async ({ search, role, status }) => {
        let roleId = null;
        if (role && role !== 'ALL') {
            if (typeof role === 'number') {
                roleId = role;
            } else if (ROLE_NAME_TO_ID[role.toUpperCase()]) {
                roleId = ROLE_NAME_TO_ID[role.toUpperCase()];
            }
        }

        const accounts = await staffAccountModel.findStaffAccounts({
            search,
            roleId,
            status: status && status !== 'ALL' ? status.toUpperCase() : null
        });

        // Định dạng dữ liệu trả về cho Frontend
        return accounts.map(acc => ({
            id: acc.id,
            username: acc.username,
            full_name: acc.full_name,
            email: acc.email,
            phone: acc.phone || '',
            role_id: acc.role_id,
            role: acc.roles?.name || ROLE_ID_TO_NAME[acc.role_id] || 'STAFF',
            status: acc.status,
            order_form_token: acc.order_form_token || null,
            created_at: acc.created_at,
            updated_at: acc.updated_at,
            last_login_at: acc.last_login_at
        }));
    },

    // 2. Lấy chi tiết tài khoản nhân viên (Screen 27)
    getStaffAccountById: async (id) => {
        const acc = await staffAccountModel.findStaffAccountById(id);
        if (!acc) {
            const error = new Error("Không tìm thấy tài khoản nhân viên hoặc bạn không có quyền truy cập (BR-28).");
            error.statusCode = 404;
            throw error;
        }

        return {
            id: acc.id,
            username: acc.username,
            full_name: acc.full_name,
            email: acc.email,
            phone: acc.phone || '',
            role_id: acc.role_id,
            role: acc.roles?.name || ROLE_ID_TO_NAME[acc.role_id] || 'STAFF',
            status: acc.status,
            order_form_token: acc.order_form_token || null,
            created_at: acc.created_at,
            updated_at: acc.updated_at,
            last_login_at: acc.last_login_at
        };
    },

    // 3. Tạo mới tài khoản nhân viên (Screen 27)
    createStaffAccount: async (payload) => {
        const { username, full_name, email, phone, role, password, status = 'ACTIVE' } = payload;

        // Validation các trường bắt buộc
        if (!username || !username.trim()) {
            const err = new Error("Tên đăng nhập (Username) là bắt buộc.");
            err.statusCode = 400;
            throw err;
        }

        if (!email || !email.trim()) {
            const err = new Error("Email là bắt buộc.");
            err.statusCode = 400;
            throw err;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            const err = new Error("Định dạng email không hợp lệ.");
            err.statusCode = 400;
            throw err;
        }

        // Kiểm tra Role theo quy tắc BR-28
        let targetRoleId = null;
        if (typeof role === 'number') {
            targetRoleId = role;
        } else if (typeof role === 'string' && ROLE_NAME_TO_ID[role.toUpperCase()]) {
            targetRoleId = ROLE_NAME_TO_ID[role.toUpperCase()];
        }

        if (!targetRoleId || !ALLOWED_STAFF_ROLE_IDS.includes(targetRoleId)) {
            const err = new Error("Lỗi BR-28: Manager chỉ được phép tạo tài khoản có vai trò là Dispatcher hoặc Driver.");
            err.statusCode = 403;
            throw err;
        }

        // Kiểm tra Status
        const normalizedStatus = status.toUpperCase() === 'LOCKED' ? 'LOCKED' : 'ACTIVE';

        // Kiểm tra trùng lặp Username & Email
        const dupCheck = await staffAccountModel.checkDuplicate({
            username: username.trim(),
            email: email.trim().toLowerCase()
        });
        if (dupCheck.exists) {
            const err = new Error(dupCheck.message);
            err.statusCode = 409;
            throw err;
        }

        // Mật khẩu mặc định nếu Manager không chỉ định
        const rawPassword = password || "Nexlog@2026";
        const password_hash = await bcrypt.hash(rawPassword, 10);

        // BR-44: Tự động sinh order_form_token duy nhất cho Dispatcher
        const order_form_token = targetRoleId === 3 
            ? `disp_${username.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}_${crypto.randomBytes(6).toString('hex')}`
            : null;

        const newAccount = await staffAccountModel.createStaffAccount({
            username: username.trim(),
            password_hash,
            full_name: (full_name || '').trim(),
            email: email.trim().toLowerCase(),
            phone: (phone || '').trim(),
            role_id: targetRoleId,
            status: normalizedStatus,
            order_form_token
        });

        return {
            ...newAccount,
            role: newAccount.roles?.name || ROLE_ID_TO_NAME[newAccount.role_id] || 'STAFF',
            order_form_token: newAccount.order_form_token || order_form_token,
            initial_password: rawPassword
        };
    },

    // 4. Cập nhật thông tin tài khoản nhân viên (Screen 27)
    updateStaffAccount: async (id, payload) => {
        const existing = await staffAccountModel.findStaffAccountById(id);
        if (!existing) {
            const err = new Error("Không tìm thấy tài khoản nhân viên hoặc bạn không có quyền cập nhật tài khoản này (BR-28).");
            err.statusCode = 404;
            throw err;
        }

        const { full_name, email, phone, role, status, password } = payload;
        const updateData = {};

        if (full_name !== undefined) updateData.full_name = full_name.trim();
        if (phone !== undefined) updateData.phone = phone.trim();

        if (email !== undefined) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                const err = new Error("Định dạng email không hợp lệ.");
                err.statusCode = 400;
                throw err;
            }
            updateData.email = email.trim().toLowerCase();

            // Kiểm tra trùng email nếu thay đổi
            const dupCheck = await staffAccountModel.checkDuplicate({
                username: existing.username,
                email: updateData.email,
                excludeId: id
            });
            if (dupCheck.exists && dupCheck.field === 'email') {
                const err = new Error(dupCheck.message);
                err.statusCode = 409;
                throw err;
            }
        }

        if (role !== undefined) {
            let targetRoleId = null;
            if (typeof role === 'number') targetRoleId = role;
            else if (typeof role === 'string' && ROLE_NAME_TO_ID[role.toUpperCase()]) targetRoleId = ROLE_NAME_TO_ID[role.toUpperCase()];

            if (!targetRoleId || !ALLOWED_STAFF_ROLE_IDS.includes(targetRoleId)) {
                const err = new Error("Lỗi BR-28: Manager chỉ được phép gán vai trò Dispatcher hoặc Driver.");
                err.statusCode = 403;
                throw err;
            }
            updateData.role_id = targetRoleId;
        }

        if (status !== undefined) {
            updateData.status = status.toUpperCase() === 'LOCKED' ? 'LOCKED' : 'ACTIVE';
        }

        if (password && password.trim() !== '') {
            updateData.password_hash = await bcrypt.hash(password.trim(), 10);
        }

        const updated = await staffAccountModel.updateStaffAccount(id, updateData);
        return {
            ...updated,
            role: updated.roles?.name || ROLE_ID_TO_NAME[updated.role_id] || 'STAFF'
        };
    },

    // 5. Cập nhật trạng thái Khóa / Mở khóa tài khoản (Screen 27 & Screen 26)
    toggleStaffAccountStatus: async (id, status) => {
        const existing = await staffAccountModel.findStaffAccountById(id);
        if (!existing) {
            const err = new Error("Không tìm thấy tài khoản nhân viên hoặc bạn không có quyền cập nhật tài khoản này (BR-28).");
            err.statusCode = 404;
            throw err;
        }

        const newStatus = status ? status.toUpperCase() : (existing.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE');
        if (!['ACTIVE', 'LOCKED'].includes(newStatus)) {
            const err = new Error("Trạng thái không hợp lệ (chỉ chấp nhận ACTIVE hoặc LOCKED).");
            err.statusCode = 400;
            throw err;
        }

        const updated = await staffAccountModel.updateAccountStatus(id, newStatus);
        return {
            id: updated.id,
            username: updated.username,
            full_name: updated.full_name,
            status: updated.status,
            message: newStatus === 'LOCKED' 
                ? `Đã khóa tài khoản ${updated.username} thành công.` 
                : `Đã mở khóa tài khoản ${updated.username} thành công.`
        };
    }
};

module.exports = staffAccountService;
