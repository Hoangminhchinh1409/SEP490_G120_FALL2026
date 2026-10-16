const supabase = require("../config/supabase");

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

    if (keyword && keyword.trim()) {
        const kw = keyword.trim();
        query = query.or(`action.ilike.%${kw}%,target_type.ilike.%${kw}%,reason.ilike.%${kw}%`);
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
    const numericTargetId = isNaN(Number(targetId)) ? 0 : Number(targetId);

    const { data, error } = await supabase
        .from("activity_logs")
        .insert({
            actor_id: actorId ? Number(actorId) : null,
            actor_type: actorType,
            action,
            target_type: targetType,
            target_id: numericTargetId,
            changes: changes ? (typeof changes === "object" ? JSON.stringify(changes) : changes) : null,
            reason,
            ip_address: ipAddress,
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

    if (keyword && keyword.trim()) {
        const kw = keyword.trim();
        query = query.or(`username.ilike.%${kw}%,full_name.ilike.%${kw}%,email.ilike.%${kw}%,phone.ilike.%${kw}%`);
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
    const { data, error } = await supabase
        .from("users")
        .select("id, username, full_name, email, phone, zalo_link, role_id, status, last_login_at, created_at, updated_at, role:roles(id, name)")
        .eq("id", id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

const findUserByUsernameOrEmail = async (username, email, excludeId = null) => {
    let query = supabase
        .from("users")
        .select("id, username, email")
        .or(`username.eq.${username},email.eq.${email}`);

    if (excludeId) {
        query = query.neq("id", excludeId);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data && data.length > 0 ? data[0] : null;
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
    const fieldsToUpdate = {
        ...updateFields,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from("users")
        .update(fieldsToUpdate)
        .eq("id", id)
        .select("id, username, full_name, email, phone, zalo_link, role_id, status, last_login_at, created_at, updated_at, role:roles(id, name)")
        .single();

    if (error) {
        throw error;
    }

    return data;
};

const updateUserStatus = async (id, status) => {
    const { data, error } = await supabase
        .from("users")
        .update({
            status,
            updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select("id, username, full_name, email, role_id, status, updated_at")
        .single();

    if (error) {
        throw error;
    }

    return data;
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
            const roleName = u.roles?.name || (u.role_id === 1 ? "ADMINISTRATOR" : u.role_id === 2 ? "MANAGER" : u.role_id === 3 ? "DISPATCHER" : "DRIVER");
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
            updated_by: updatedBy,
            updated_time: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

module.exports = {
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
    upsertSystemSetting
};
