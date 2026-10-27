const supabase = require("../config/supabase");

const findUserByIdentifier = async (identifier) => {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .or(`username.eq.${identifier},email.eq.${identifier}`)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
};

const findUserByEmail = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name")
        .ilike("email", normalizedEmail)
        .maybeSingle();

    if (error) {
        console.error("Find user by email error:", error);
        throw error;
    }

    console.log("Searching email:", normalizedEmail);
    console.log("User found:", Boolean(data));

    return data;
};

const findUserById = async (id) => {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

const createPasswordResetToken = async (userId, tokenHash, expiresAt) => {
    const { error: cleanupError } = await supabase
        .from("password_reset_tokens")
        .delete()
        .lt("expires_at", new Date().toISOString());

    if (cleanupError) {
        throw cleanupError;
    }

    const { error: deleteError } = await supabase
        .from("password_reset_tokens")
        .delete()
        .eq("user_id", userId);

    if (deleteError) {
        throw deleteError;
    }

    const { data, error } = await supabase
        .from("password_reset_tokens")
        .insert({
            user_id: userId,
            token_hash: tokenHash,
            expires_at: expiresAt
        })
        .select("id")
        .single();

    if (error) {
        throw error;
    }

    return data;
};

const consumePasswordResetToken = async (tokenHash) => {
    const { data, error } = await supabase
        .from("password_reset_tokens")
        .delete()
        .eq("token_hash", tokenHash)
        .gt("expires_at", new Date().toISOString())
        .select("user_id")
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
};

const updateLastLogin = async (id) => {
    const { data, error } = await supabase
        .from("users")
        .update({
            last_login_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

const PROFILE_SELECT =
    "id, username, full_name, email, phone, zalo_link, role_id, status, created_at, updated_at, last_login_at";

const updateProfile = async (id, payload) => {
    const fieldsToUpdate = {
        full_name: payload.full_name,
        phone: payload.phone,
        updated_at: new Date().toISOString()
    };

    if (payload.zalo_link !== undefined) {
        fieldsToUpdate.zalo_link = payload.zalo_link;
    }

    const runUpdate = async (fields, selectColumns) => {
        const { data, error } = await supabase
            .from("users")
            .update(fields)
            .eq("id", id)
            .select(selectColumns)
            .maybeSingle();

        if (error) {
            const err = new Error(error.message || "Không thể cập nhật hồ sơ");
            err.statusCode = 400;
            err.code = error.code;
            throw err;
        }

        return data;
    };

    try {
        const data = await runUpdate(fieldsToUpdate, PROFILE_SELECT);
        if (data) return data;
    } catch (error) {
        if (!/zalo_link/i.test(error.message || "")) {
            throw error;
        }
    }

    const { zalo_link, ...fieldsWithoutZalo } = fieldsToUpdate;
    const data = await runUpdate(
        fieldsWithoutZalo,
        "id, username, full_name, email, phone, role_id, status, created_at, updated_at, last_login_at"
    );

    if (!data) {
        const err = new Error("Không tìm thấy tài khoản để cập nhật");
        err.statusCode = 404;
        throw err;
    }

    return data;
};

const updatePassword = async (id, passwordHash) => {
    const { data, error } = await supabase
        .from("users")
        .update({
            password_hash: passwordHash,
            password_changed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        throw error;
    }

    return data;
};

module.exports = {
    findUserByIdentifier,
    findUserByEmail,
    findUserById,
    createPasswordResetToken,
    consumePasswordResetToken,
    updateLastLogin,
    updateProfile,
    updatePassword
};