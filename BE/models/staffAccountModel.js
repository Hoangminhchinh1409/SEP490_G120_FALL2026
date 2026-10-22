const supabase = require("../config/supabase");

/**
 * Model quản lý tài khoản nhân viên (Dispatcher & Driver)
 * BR-28: Chỉ truy vấn các tài khoản có role_id = 3 (DISPATCHER) hoặc role_id = 4 (DRIVER)
 */
const staffAccountModel = {
    // 1. Lấy danh sách tài khoản nhân viên (hỗ trợ tìm kiếm, lọc theo role và status)
    findStaffAccounts: async ({ search, roleId, status }) => {
        let query = supabase
            .from("users")
            .select(`
                id,
                username,
                full_name,
                email,
                phone,
                role_id,
                status,
                order_form_token,
                created_at,
                updated_at,
                last_login_at,
                roles (
                    id,
                    name
                )
            `)
            .in("role_id", [3, 4])
            .order("id", { ascending: false });

        if (roleId) {
            query = query.eq("role_id", roleId);
        }

        if (status) {
            query = query.eq("status", status);
        }

        if (search && search.trim() !== "") {
            const s = search.trim();
            query = query.or(`username.ilike.%${s}%,full_name.ilike.%${s}%,email.ilike.%${s}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    // 2. Lấy chi tiết một tài khoản nhân viên
    findStaffAccountById: async (id) => {
        const { data, error } = await supabase
            .from("users")
            .select(`
                id,
                username,
                full_name,
                email,
                phone,
                role_id,
                status,
                order_form_token,
                created_at,
                updated_at,
                last_login_at,
                roles (
                    id,
                    name
                )
            `)
            .eq("id", id)
            .in("role_id", [3, 4])
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data;
    },

    // 3. Kiểm tra xem username hoặc email đã tồn tại hay chưa
    checkDuplicate: async ({ username, email, excludeId }) => {
        // Kiểm tra username
        let userQuery = supabase.from("users").select("id, username, email").eq("username", username);
        if (excludeId) userQuery = userQuery.neq("id", excludeId);
        const { data: userByUsername } = await userQuery.maybeSingle();

        if (userByUsername) {
            return { exists: true, field: "username", message: "Tên đăng nhập (Username) đã tồn tại trong hệ thống." };
        }

        // Kiểm tra email
        let emailQuery = supabase.from("users").select("id, username, email").eq("email", email);
        if (excludeId) emailQuery = emailQuery.neq("id", excludeId);
        const { data: userByEmail } = await emailQuery.maybeSingle();

        if (userByEmail) {
            return { exists: true, field: "email", message: "Email đã tồn tại trong hệ thống." };
        }

        return { exists: false };
    },

    // 4. Tạo mới tài khoản nhân viên
    createStaffAccount: async (payload) => {
        const { data, error } = await supabase
            .from("users")
            .insert({
                username: payload.username,
                password_hash: payload.password_hash,
                full_name: payload.full_name,
                email: payload.email,
                phone: payload.phone || null,
                role_id: payload.role_id,
                status: payload.status || 'ACTIVE',
                order_form_token: payload.order_form_token || null
            })
            .select(`
                id,
                username,
                full_name,
                email,
                phone,
                role_id,
                status,
                order_form_token,
                created_at,
                updated_at,
                roles (
                    id,
                    name
                )
            `)
            .single();

        if (error) throw error;
        return data;
    },

    // 5. Cập nhật thông tin tài khoản nhân viên
    updateStaffAccount: async (id, payload) => {
        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (payload.full_name !== undefined) updateData.full_name = payload.full_name;
        if (payload.email !== undefined) updateData.email = payload.email;
        if (payload.phone !== undefined) updateData.phone = payload.phone;
        if (payload.role_id !== undefined) updateData.role_id = payload.role_id;
        if (payload.status !== undefined) updateData.status = payload.status;
        if (payload.password_hash) updateData.password_hash = payload.password_hash;

        const { data, error } = await supabase
            .from("users")
            .update(updateData)
            .eq("id", id)
            .in("role_id", [3, 4])
            .select(`
                id,
                username,
                full_name,
                email,
                phone,
                role_id,
                status,
                created_at,
                updated_at,
                roles (
                    id,
                    name
                )
            `)
            .single();

        if (error) throw error;
        return data;
    },

    // 6. Cập nhật trạng thái khóa/mở khóa
    updateAccountStatus: async (id, status) => {
        const { data, error } = await supabase
            .from("users")
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .in("role_id", [3, 4])
            .select(`
                id,
                username,
                full_name,
                status,
                updated_at
            `)
            .single();

        if (error) throw error;
        return data;
    }
};

module.exports = staffAccountModel;
