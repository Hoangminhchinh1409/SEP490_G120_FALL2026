const supabase = require("../config/supabase");

const findUserByIdentifier = async (identifier) => {
  if (typeof identifier !== "string" || !identifier.trim() || identifier.trim().length > 100) {
    const error = new TypeError("Identifier must be a non-empty string of at most 100 characters");
    error.statusCode = 400;
    error.code = "INVALID_IDENTIFIER";
    throw error;
  }

  const trimmedIdentifier = identifier.trim();
  const normalizedIdentifier = trimmedIdentifier.includes("@")
    ? trimmedIdentifier.toLowerCase()
    : trimmedIdentifier;

  const { data: usernameMatch, error: usernameError } = await supabase
    .from("users")
    .select("*")
    .eq("username", normalizedIdentifier)
    .maybeSingle();

  if (usernameError) {
    throw usernameError;
  }

  if (usernameMatch) {
    return usernameMatch;
  }

  const { data: emailMatch, error: emailError } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizedIdentifier)
    .maybeSingle();

  if (emailError) {
    throw emailError;
  }

  return emailMatch;
};

const findUserByEmail = async (email) => {
  if (typeof email !== "string" || !email.trim()) {
    const error = new TypeError("Email must be a non-empty string");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, status")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error("Find user by email failed:", {
      name: error.name,
      code: error.code || null
    });
    throw error;
  }

  return data;
};

const findUserById = async (id) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const getAuthSessionState = async (id) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, status, password_changed_at, role_id, role:roles(id, name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

const createPasswordResetToken = async (userId, tokenHash, expiresAt) => {
  // 1. Lưu trực tiếp lên cột password_reset_token & password_reset_expiry của bảng users (chuẩn schema DB)
  const { data: userData, error: userErr } = await supabase
    .from("users")
    .update({
      password_reset_token: tokenHash,
      password_reset_expiry: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id")
    .single();

  if (userErr) {
    throw userErr;
  }

  // 2. Đồng bộ sang bảng phụ password_reset_tokens nếu bảng không bị chặn RLS
  try {
    await supabase
      .from("password_reset_tokens")
      .delete()
      .or(`expires_at.lt.${new Date().toISOString()},user_id.eq.${userId}`);

    await supabase.from("password_reset_tokens").insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
  } catch {
    // Bỏ qua nếu bảng phụ bật RLS
  }

  return userData;
};

const consumePasswordResetToken = async (tokenHash) => {
  const nowIso = new Date().toISOString();

  // 1. Kiểm tra trên bảng users trước
  const { data: matchedUser, error: findErr } = await supabase
    .from("users")
    .select("id, password_reset_expiry")
    .eq("password_reset_token", tokenHash)
    .gt("password_reset_expiry", nowIso)
    .maybeSingle();

  if (!findErr && matchedUser) {
    await supabase
      .from("users")
      .update({
        password_reset_token: null,
        password_reset_expiry: null,
        updated_at: nowIso,
      })
      .eq("id", matchedUser.id);

    return { user_id: matchedUser.id };
  }

  // 2. Fallback kiểm tra bảng phụ password_reset_tokens nếu có
  const { data, error } = await supabase
    .from("password_reset_tokens")
    .delete()
    .eq("token_hash", tokenHash)
    .gt("expires_at", nowIso)
    .select("user_id")
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
};

const updateLastLogin = async (id) => {
  const { data, error } = await supabase
    .from("users")
    .update({
      last_login_at: new Date().toISOString(),
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
    updated_at: new Date().toISOString(),
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
      throw error;
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
    "id, username, full_name, email, phone, role_id, status, created_at, updated_at, last_login_at",
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, password_changed_at")
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
  getAuthSessionState,
  getAuthSessionState,
  createPasswordResetToken,
  consumePasswordResetToken,
  updateLastLogin,
  updateProfile,
  updatePassword,
};
