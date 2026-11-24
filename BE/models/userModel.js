const prisma = require("../config/prisma");
const { serializePrisma, toBigInt } = require("../utils/prismaHelper");

const AUTH_SESSION_CACHE_TTL_MS = 5000;
const AUTH_SESSION_CACHE_MAX = 500;
const authSessionCache = new Map();
const authSessionInflight = new Map();

const invalidateAuthSessionCache = (id) => {
  if (id === undefined || id === null) {
    authSessionCache.clear();
    return;
  }
  authSessionCache.delete(String(Number(id)));
};

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

  const usernameMatch = await prisma.users.findUnique({
    where: { username: normalizedIdentifier },
  });
  if (usernameMatch) {
    return serializePrisma(usernameMatch);
  }

  const emailMatch = await prisma.users.findUnique({
    where: { email: normalizedIdentifier },
  });
  return serializePrisma(emailMatch);
};

const findUserByEmail = async (email) => {
  if (typeof email !== "string" || !email.trim()) {
    const error = new TypeError("Email must be a non-empty string");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.users.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, full_name: true, status: true },
  });
  return serializePrisma(user);
};

const findUserById = async (id) => {
  const userId = toBigInt(id);
  if (userId === null) return null;
  const user = await prisma.users.findUnique({
    where: { id: userId },
  });
  return serializePrisma(user);
};

const getAuthSessionState = async (id) => {
  const userId = toBigInt(id);
  if (userId === null) return null;

  const cacheKey = String(userId);
  const now = Date.now();
  const cached = authSessionCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const inflight = authSessionInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const fetchPromise = prisma.users
    .findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        password_changed_at: true,
        role_id: true,
        roles: {
          select: { id: true, name: true },
        },
      },
    })
    .then((user) => {
      if (!user) {
        authSessionCache.delete(cacheKey);
        return null;
      }
      const serialized = serializePrisma(user);
      const result = {
        ...serialized,
        role: serialized.roles || null,
      };
      if (authSessionCache.size >= AUTH_SESSION_CACHE_MAX) {
        const oldestKey = authSessionCache.keys().next().value;
        authSessionCache.delete(oldestKey);
      }
      authSessionCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + AUTH_SESSION_CACHE_TTL_MS,
      });
      return result;
    })
    .finally(() => {
      if (authSessionInflight.get(cacheKey) === fetchPromise) {
        authSessionInflight.delete(cacheKey);
      }
    });

  authSessionInflight.set(cacheKey, fetchPromise);
  return fetchPromise;
};

const createPasswordResetToken = async (userId, tokenHash, expiresAt) => {
  const bigUserId = toBigInt(userId);
  const now = new Date();
  const userData = await prisma.users.update({
    where: { id: bigUserId },
    data: {
      password_reset_token: tokenHash,
      password_reset_expiry: new Date(expiresAt),
      updated_at: now,
    },
    select: { id: true },
  });

  try {
    await prisma.password_reset_tokens.deleteMany({
      where: {
        OR: [{ expires_at: { lt: now } }, { user_id: bigUserId }],
      },
    });
    await prisma.password_reset_tokens.create({
      data: {
        user_id: bigUserId,
        token_hash: tokenHash,
        expires_at: new Date(expiresAt),
      },
    });
  } catch {
    // Bỏ qua nếu bảng phụ bị hạn chế quyền
  }

  return serializePrisma(userData);
};

const consumePasswordResetToken = async (tokenHash) => {
  const now = new Date();

  const matchedUser = await prisma.users.findFirst({
    where: {
      password_reset_token: tokenHash,
      password_reset_expiry: { gt: now },
    },
    select: { id: true, password_reset_expiry: true },
  });

  if (matchedUser) {
    await prisma.users.update({
      where: { id: matchedUser.id },
      data: {
        password_reset_token: null,
        password_reset_expiry: null,
        updated_at: now,
      },
    });
    return { user_id: Number(matchedUser.id) };
  }

  try {
    const tokenRow = await prisma.password_reset_tokens.findFirst({
      where: {
        token_hash: tokenHash,
        expires_at: { gt: now },
      },
      select: { id: true, user_id: true },
    });
    if (!tokenRow) return null;
    await prisma.password_reset_tokens.delete({
      where: { id: tokenRow.id },
    });
    return { user_id: Number(tokenRow.user_id) };
  } catch {
    return null;
  }
};

const updateLastLogin = async (id) => {
  const data = await prisma.users.update({
    where: { id: toBigInt(id) },
    data: { last_login_at: new Date() },
  });
  return serializePrisma(data);
};

const PROFILE_SELECT = {
  id: true,
  username: true,
  full_name: true,
  email: true,
  phone: true,
  zalo_link: true,
  role_id: true,
  status: true,
  created_at: true,
  updated_at: true,
  last_login_at: true,
};

const updateProfile = async (id, payload) => {
  const fieldsToUpdate = {
    full_name: payload.full_name,
    phone: payload.phone,
    updated_at: new Date(),
  };

  if (payload.zalo_link !== undefined) {
    fieldsToUpdate.zalo_link = payload.zalo_link;
  }

  try {
    const data = await prisma.users.update({
      where: { id: toBigInt(id) },
      data: fieldsToUpdate,
      select: PROFILE_SELECT,
    });
    return serializePrisma(data);
  } catch (error) {
    if (error.code === "P2025") {
      const err = new Error("Không tìm thấy tài khoản để cập nhật");
      err.statusCode = 404;
      throw err;
    }
    throw error;
  }
};

const updatePassword = async (id, passwordHash) => {
  const now = new Date();
  const data = await prisma.users.update({
    where: { id: toBigInt(id) },
    data: {
      password_hash: passwordHash,
      password_changed_at: now,
      updated_at: now,
    },
    select: { id: true, password_changed_at: true },
  });
  invalidateAuthSessionCache(id);
  return serializePrisma(data);
};

module.exports = {
  findUserByIdentifier,
  findUserByEmail,
  findUserById,
  getAuthSessionState,
  invalidateAuthSessionCache,
  createPasswordResetToken,
  consumePasswordResetToken,
  updateLastLogin,
  updateProfile,
  updatePassword,
};
