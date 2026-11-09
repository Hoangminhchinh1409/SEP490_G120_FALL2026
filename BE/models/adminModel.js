const supabase = require("../config/supabase");

// Helper to sanitize input strings for PostgREST query parameters (prevent filter injection)
const sanitizePostgrestParam = (str) => {
    if (!str || typeof str !== "string") return "";
    return str.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim();
};

// ==========================================
// 1. ACTIVITY LOGS (Append-Only)
// ==========================================

const getActivityLogs = async ({
    page = 1,
    limit = 20,
    actorId = null,
    action = null,
    targetType = null,
    startDate = null,
    endDate = null,
    keyword = null
}) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("activity_logs")
        .select("*, actor:users(id, username, full_name, email, role_id)", { count: "exact" })
        .order("created_time", { ascending: false });

    if (actorId) {
        query = query.eq("actor_id", actorId);
    }

    if (action && action !== "ALL") {
        query = query.eq("action", action);
    }

    if (targetType && targetType !== "ALL") {
        query = query.eq("target_type", targetType);
    }

    if (startDate) {
        query = query.gte("created_time", startDate);
    }

    if (endDate) {
        query = query.lte("created_time", endDate);
    }

    if (keyword && typeof keyword === "string") {
        const cleanKw = sanitizePostgrestParam(keyword);
        if (cleanKw) {
            query = query.or(`action.ilike.%${cleanKw}%,target_type.ilike.%${cleanKw}%,reason.ilike.%${cleanKw}%`);
        }
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
        throw error;
    }

    return {
        logs: data || [],
        total: count || 0,
        page: Number(page),
        limit: Number(limit)
    };
};

const createActivityLog = async ({
    actorId = null,
    actorType = "USER",
    action,
    targetType,
    targetId = 0,
    changes = null,
    reason = null,
    ipAddress = null
}) => {
    const numericTargetId = isNaN(Number(targetId)) ? 0: Number(targetId);

    // BUG-ADM-14: Sanitize IP to ensure single valid address for PostgreSQL inet column
    let cleanIp = ipAddress;
    if (cleanIp && typeof cleanIp === "string") {
        if (cleanIp.includes(",")) {
            cleanIp = cleanIp.split(",")[0].trim();
        }
        if (cleanIp === "::1" || cleanIp === "::ffff:127.0.0.1") {
            cleanIp = "127.0.0.1";
        } else if (cleanIp.startsWith("::ffff:")) {
            cleanIp = cleanIp.replace("::ffff:", "");
        }
    }

    const { data, error } = await supabase
        .from("activity_logs")
        .insert({
            actor_id: actorId ? Number(actorId): null,
            actor_type: actorType,
            action,
            target_type: targetType,
            target_id: numericTargetId,
            changes: changes ? (typeof changes === "object" ? JSON.stringify(changes): changes): null,
            reason,
            ip_address: cleanIp,
            created_time: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

// ==========================================
// 2. USER MANAGEMENT
// ==========================================

const getUsers = async ({
    page = 1,
    limit = 20,
    roleId = null,
    status = null,
    keyword = null
}) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("users")
        .select("id, username, full_name, email, phone, zalo_link, role_id, status, last_login_at, created_at, updated_at, role:roles(id, name)", { count: "exact" })
        .order("created_at", { ascending: false });

    if (roleId && roleId !== "ALL") {
        query = query.eq("role_id", Number(roleId));
    }

    if (status && status !== "ALL") {
        query = query.eq("status", status);
    }

    if (keyword && typeof keyword === "string") {
        const cleanKw = sanitizePostgrestParam(keyword);
        if (cleanKw) {
            query = query.or(`username.ilike.%${cleanKw}%,full_name.ilike.%${cleanKw}%,email.ilike.%${cleanKw}%,phone.ilike.%${cleanKw}%`);
        }
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
        throw error;
    }

    return {
        users: data || [],
        total: count || 0,
        page: Number(page),
        limit: Number(limit)
    };
};

const getUserById = async (id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        return null;
    }

    const { data, error } = await supabase
        .from("users")
        .select("id, username, full_name, email, phone, zalo_link, role_id, status, last_login_at, created_at, updated_at, role:roles(id, name)")
        .eq("id", numId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
};

const findUserByUsernameOrEmail = async (username, email, excludeId = null) => {
    const conditions = [];

    if (username && typeof username === "string" && username.trim()) {
        const cleanUsername = sanitizePostgrestParam(username.trim());
        if (cleanUsername) {
            conditions.push(`username.ilike.${cleanUsername}`);
        }
    }

    if (email && typeof email === "string" && email.trim()) {
        const cleanEmail = sanitizePostgrestParam(email.trim());
        if (cleanEmail) {
            conditions.push(`email.ilike.${cleanEmail}`);
        }
    }

    if (conditions.length === 0) {
        return null;
    }

    let query = supabase
        .from("users")
        .select("id, username, email")
        .or(conditions.join(","));

    if (excludeId) {
        const numExcludeId = Number(excludeId);
        if (!isNaN(numExcludeId)) {
            query = query.neq("id", numExcludeId);
        }
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data && data.length > 0 ? data[0]: null;
};

const createUser = async ({
    username,
    password_hash,
    full_name,
    email,
    phone = null,
    zalo_link = null,
    role_id,
    status = "ACTIVE"
}) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("users")
        .insert({
            username,
            password_hash,
            full_name,
            email,
            phone,
            zalo_link,
            role_id: Number(role_id),
            status,
            created_at: now,
            updated_at: now
        })
        .select("id, username, full_name, email, phone, zalo_link, role_id, status, created_at, updated_at")
        .single();

    if (error) {
        throw error;
    }

    return data;
};

const updateUser = async (id, updateFields) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        return null;
    }

    const fieldsToUpdate = {
        ...updateFields,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from("users")
        .update(fieldsToUpdate)
        .eq("id", numId)
        .select("id, username, full_name, email, phone, zalo_link, role_id, status, last_login_at, created_at, updated_at, role:roles(id, name)")
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
};

const updateUserStatus = async (id, status) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        return null;
    }

    const { data, error } = await supabase
        .from("users")
        .update({
            status,
            updated_at: new Date().toISOString()
        })
        .eq("id", numId)
        .select("id, username, full_name, email, role_id, status, updated_at")
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
};

const countActiveAdmins = async (excludeId = null) => {
    let query = supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role_id", 1)
        .eq("status", "ACTIVE");

    if (excludeId) {
        const numExcludeId = Number(excludeId);
        if (!isNaN(numExcludeId)) {
            query = query.neq("id", numExcludeId);
        }
    }

    const { count, error } = await query;

    if (error) {
        throw error;
    }

    return count || 0;
};

// ==========================================
// 3. ROLES
// ==========================================

const getRoles = async () => {
    const { data, error } = await supabase
        .from("roles")
        .select("id, name")
        .order("id", { ascending: true });

    if (error) {
        throw error;
    }

    return data || [];
};

// ==========================================
// 4. DASHBOARD STATS
// ==========================================

const getDashboardStats = async () => {
    const { count: totalUsers, error: errUsers } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

    if (errUsers) throw errUsers;

    const { count: activeUsers, error: errActive } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("status", "ACTIVE");

    if (errActive) throw errActive;

    const { count: lockedUsers, error: errLocked } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("status", "LOCKED");

    if (errLocked) throw errLocked;

    // Logs in the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentLogs, error: errLogs } = await supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_time", yesterday);

    if (errLogs) throw errLogs;

    // Users by role
    const { data: roleCounts, error: errRoleCounts } = await supabase
        .from("users")
        .select("role_id, roles(name)");

    const usersByRole = {
        ADMINISTRATOR: 0,
        MANAGER: 0,
        DISPATCHER: 0,
        DRIVER: 0
    };

    if (!errRoleCounts && roleCounts) {
        for (const u of roleCounts) {
            const roleName = u.roles?.name || (u.role_id === 1 ? "ADMINISTRATOR": u.role_id === 2 ? "MANAGER": u.role_id === 3 ? "DISPATCHER": "DRIVER");
            if (usersByRole[roleName] !== undefined) {
                usersByRole[roleName]++;
            }
        }
    }

    return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        lockedUsers: lockedUsers || 0,
        recentLogs24h: recentLogs || 0,
        usersByRole
    };
};

// ==========================================
// 5. SYSTEM SETTINGS
// ==========================================

const getSystemSettings = async () => {
    const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .order("key", { ascending: true });

    if (error) {
        throw error;
    }

    return data || [];
};

const upsertSystemSetting = async (key, value, updatedBy = null) => {
    const { data, error } = await supabase
        .from("system_settings")
        .upsert({
            key,
            value: String(value),
            updated_by: updatedBy ? Number(updatedBy) : null,
            updated_time: new Date().toISOString()
        })
        .select("key, value, updated_time")
        .single();

    if (error) {
        throw error;
    }

    return data;
};

const upsertSystemSettingsBulk = async (settingsArray, updatedBy = null) => {
    const now = new Date().toISOString();
    const rows = settingsArray.map(s => ({
        key: s.key,
        value: String(s.value),
        updated_by: updatedBy ? Number(updatedBy) : null,
        updated_time: now
    }));

    const { data, error } = await supabase
        .from("system_settings")
        .upsert(rows, { onConflict: "key" })
        .select("key, value, updated_time");

    if (error) {
        throw error;
    }

    return data;
};

// ==========================================
// 6. PERMISSIONS & ROLES MATRIX
// ==========================================

const getPermissionsMatrix = async () => {
    const [rolesRes, permsRes, rolePermsRes] = await Promise.all([
        supabase.from("roles").select("id, name").order("id", { ascending: true }),
        supabase.from("permissions").select("id, key").order("id", { ascending: true }),
        supabase.from("role_permissions").select("role_id, permission_id")
    ]);

    if (rolesRes.error) throw rolesRes.error;
    if (permsRes.error) throw permsRes.error;
    if (rolePermsRes.error) throw rolePermsRes.error;

    return {
        roles: rolesRes.data || [],
        permissions: permsRes.data || [],
        rolePermissions: rolePermsRes.data || []
    };
};

const getExistingPermissionIds = async (ids = []) => {
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase
        .from("permissions")
        .select("id")
        .in("id", ids);

    if (error) throw error;
    return (data || []).map(r => r.id);
};

const updateRolePermissions = async (roleId, permissionIds = []) => {
    const numRoleId = Number(roleId);

    // Lưu lại quyền cũ để hỗ trợ rollback nếu có lỗi bất ngờ khi insert
    const { data: oldPerms, error: fetchErr } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", numRoleId);

    if (fetchErr) throw fetchErr;

    // Xóa toàn bộ quyền cũ của vai trò này
    const { error: delError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", numRoleId);

    if (delError) throw delError;

    // Chèn danh sách quyền mới (nếu có)
    if (permissionIds.length > 0) {
        const rowsToInsert = permissionIds.map(pId => ({
            role_id: numRoleId,
            permission_id: Number(pId)
        }));

        const { error: insError } = await supabase
            .from("role_permissions")
            .insert(rowsToInsert);

        if (insError) {
            // Rollback khôi phục quyền cũ để đảm bảo tính atomic
            if (oldPerms && oldPerms.length > 0) {
                await supabase
                    .from("role_permissions")
                    .insert(oldPerms.map(r => ({
                        role_id: numRoleId,
                        permission_id: r.permission_id
                    })));
            }
            throw insError;
        }
    }

    return { roleId: numRoleId, permissionIds };
};

module.exports = {
    getExistingPermissionIds,
    sanitizePostgrestParam,
    countActiveAdmins,
    getActivityLogs,
    createActivityLog,
    getUsers,
    getUserById,
    findUserByUsernameOrEmail,
    createUser,
    updateUser,
    updateUserStatus,
    getRoles,
    getDashboardStats,
    getSystemSettings,
    upsertSystemSetting,
    upsertSystemSettingsBulk,
    getPermissionsMatrix,
    updateRolePermissions
};
