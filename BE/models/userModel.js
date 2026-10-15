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

module.exports = {
    findUserByIdentifier,
    findUserById,
    updateLastLogin
};