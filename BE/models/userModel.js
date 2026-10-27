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
    updatePassword
};