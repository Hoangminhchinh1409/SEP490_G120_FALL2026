const prisma = require("../config/prisma");
const { serializePrisma, toBigInt, toNum } = require("../utils/prismaHelper");

// Helper to sanitize input strings (preserve legacy API export)
const sanitizePostgrestParam = (str) => {
  if (!str || typeof str !== "string") return "";
  return str.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim();
};

const USER_PUBLIC_SELECT = {
  id: true,
  username: true,
  full_name: true,
  email: true,
  phone: true,
  zalo_link: true,
  role_id: true,
  status: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,
  roles: {
    select: { id: true, name: true },
  },
};

const mapUserWithRole = (row) => {
  if (!row) return null;
  const serialized = serializePrisma(row);
  const { roles: roleObj, ...rest } = serialized;
  return {
    ...rest,
    role: roleObj || null,
  };
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
  keyword = null,
}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);
  const where = {};

  if (actorId) where.actor_id = toBigInt(actorId);
  if (action && action !== "ALL") where.action = action;
  if (targetType && targetType !== "ALL") where.target_type = targetType;

  if (startDate || endDate) {
    where.created_time = {};
    if (startDate) where.created_time.gte = new Date(startDate);
    if (endDate) where.created_time.lte = new Date(endDate);
  }

  if (keyword && typeof keyword === "string") {
    const cleanKw = sanitizePostgrestParam(keyword);
    if (cleanKw) {
      where.OR = [
        { action: { contains: cleanKw, mode: "insensitive" } },
        { target_type: { contains: cleanKw, mode: "insensitive" } },
        { reason: { contains: cleanKw, mode: "insensitive" } },
      ];
    }
  }

  const [rows, total] = await Promise.all([
    prisma.activity_logs.findMany({
      where,
      include: {
        users: {
          select: { id: true, username: true, full_name: true, email: true, role_id: true },
        },
      },
      orderBy: { created_time: "desc" },
      skip,
      take,
    }),
    prisma.activity_logs.count({ where }),
  ]);

  const logs = serializePrisma(rows).map((item) => {
    const { users: actorObj, ...rest } = item;
    return {
      ...rest,
      actor: actorObj || null,
    };
  });

  return {
    logs,
    total: total || 0,
    page: Number(page),
    limit: Number(limit),
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
  ipAddress = null,
}) => {
  const numericTargetId = isNaN(Number(targetId)) ? 0 : Number(targetId);

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

  const created = await prisma.activity_logs.create({
    data: {
      actor_id: actorId ? toBigInt(actorId) : null,
      actor_type: actorType,
      action,
      target_type: targetType,
      target_id: BigInt(numericTargetId),
      changes: changes ?? undefined,
      reason,
      ip_address: cleanIp || null,
      created_time: new Date(),
    },
  });

  return serializePrisma(created);
};

// ==========================================
// 2. USER MANAGEMENT
// ==========================================

const getUsers = async ({
  page = 1,
  limit = 20,
  roleId = null,
  status = null,
  keyword = null,
}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);
  const where = {};

  if (roleId && roleId !== "ALL") {
    where.role_id = toBigInt(roleId);
  }
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (keyword && typeof keyword === "string") {
    const cleanKw = sanitizePostgrestParam(keyword);
    if (cleanKw) {
      where.OR = [
        { username: { contains: cleanKw, mode: "insensitive" } },
        { full_name: { contains: cleanKw, mode: "insensitive" } },
        { email: { contains: cleanKw, mode: "insensitive" } },
        { phone: { contains: cleanKw, mode: "insensitive" } },
      ];
    }
  }

  const [rows, total] = await Promise.all([
    prisma.users.findMany({
      where,
      select: USER_PUBLIC_SELECT,
      orderBy: { created_at: "desc" },
      skip,
      take,
    }),
    prisma.users.count({ where }),
  ]);

  return {
    users: rows.map(mapUserWithRole),
    total: total || 0,
    page: Number(page),
    limit: Number(limit),
  };
};

const getUserById = async (id) => {
  const numId = Number(id);
  if (!Number.isSafeInteger(numId) || numId <= 0) {
    return null;
  }

  const row = await prisma.users.findUnique({
    where: { id: BigInt(numId) },
    select: USER_PUBLIC_SELECT,
  });

  return mapUserWithRole(row);
};

const findUserByUsernameOrEmail = async (username, email, excludeId = null) => {
  const orConditions = [];

  if (username && typeof username === "string" && username.trim()) {
    const cleanUsername = sanitizePostgrestParam(username.trim());
    if (cleanUsername) {
      orConditions.push({ username: { equals: cleanUsername, mode: "insensitive" } });
    }
  }

  if (email && typeof email === "string" && email.trim()) {
    const cleanEmail = sanitizePostgrestParam(email.trim());
    if (cleanEmail) {
      orConditions.push({ email: { equals: cleanEmail, mode: "insensitive" } });
    }
  }

  if (orConditions.length === 0) {
    return null;
  }

  const where = { OR: orConditions };
  if (excludeId && !isNaN(Number(excludeId))) {
    where.id = { not: BigInt(Number(excludeId)) };
  }

  const row = await prisma.users.findFirst({
    where,
    select: { id: true, username: true, email: true },
  });

  return serializePrisma(row);
};

const createUser = async ({
  username,
  password_hash,
  full_name,
  email,
  phone = null,
  zalo_link = null,
  role_id,
  status = "ACTIVE",
}) => {
  const now = new Date();
  const created = await prisma.users.create({
    data: {
      username,
      password_hash,
      full_name,
      email,
      phone,
      zalo_link,
      role_id: BigInt(Number(role_id)),
      status,
      created_at: now,
      updated_at: now,
    },
    select: {
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
    },
  });

  return serializePrisma(created);
};

const updateUser = async (id, updateFields) => {
  const numId = Number(id);
  if (!Number.isSafeInteger(numId) || numId <= 0) {
    return null;
  }

  const fieldsToUpdate = {
    ...updateFields,
    updated_at: new Date(),
  };
  if (fieldsToUpdate.role_id !== undefined) {
    fieldsToUpdate.role_id = BigInt(Number(fieldsToUpdate.role_id));
  }

  try {
    const updated = await prisma.users.update({
      where: { id: BigInt(numId) },
      data: fieldsToUpdate,
      select: USER_PUBLIC_SELECT,
    });
    return mapUserWithRole(updated);
  } catch (err) {
    if (err.code === "P2025") return null;
    throw err;
  }
};

const updateUserStatus = async (id, status) => {
  const numId = Number(id);
  if (!Number.isSafeInteger(numId) || numId <= 0) {
    return null;
  }

  try {
    const updated = await prisma.users.update({
      where: { id: BigInt(numId) },
      data: {
        status,
        updated_at: new Date(),
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        role_id: true,
        status: true,
        updated_at: true,
      },
    });
    return serializePrisma(updated);
  } catch (err) {
    if (err.code === "P2025") return null;
    throw err;
  }
};

const countActiveAdmins = async (excludeId = null) => {
  const where = {
    role_id: 1n,
    status: "ACTIVE",
  };
  if (excludeId && !isNaN(Number(excludeId))) {
    where.id = { not: BigInt(Number(excludeId)) };
  }

  return (await prisma.users.count({ where })) || 0;
};

// ==========================================
// 3. ROLES
// ==========================================

const getRoles = async () => {
  const rows = await prisma.roles.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  return serializePrisma(rows || []);
};

// ==========================================
// 4. DASHBOARD STATS
// ==========================================

const getDashboardStats = async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalUsers, activeUsers, lockedUsers, recentLogs, roleCounts] = await Promise.all([
    prisma.users.count(),
    prisma.users.count({ where: { status: "ACTIVE" } }),
    prisma.users.count({ where: { status: "LOCKED" } }),
    prisma.activity_logs.count({ where: { created_time: { gte: yesterday } } }),
    prisma.users.findMany({
      select: { role_id: true, roles: { select: { name: true } } },
    }),
  ]);

  const usersByRole = {
    ADMINISTRATOR: 0,
    MANAGER: 0,
    DISPATCHER: 0,
    DRIVER: 0,
  };

  for (const u of roleCounts || []) {
    const roleIdNum = toNum(u.role_id);
    const roleName =
      u.roles?.name ||
      (roleIdNum === 1
        ? "ADMINISTRATOR"
        : roleIdNum === 2
        ? "MANAGER"
        : roleIdNum === 3
        ? "DISPATCHER"
        : "DRIVER");
    if (usersByRole[roleName] !== undefined) {
      usersByRole[roleName]++;
    }
  }

  return {
    totalUsers: totalUsers || 0,
    activeUsers: activeUsers || 0,
    lockedUsers: lockedUsers || 0,
    recentLogs24h: recentLogs || 0,
    usersByRole,
  };
};

// ==========================================
// 5. SYSTEM SETTINGS
// ==========================================

const getSystemSettings = async () => {
  const rows = await prisma.system_settings.findMany({
    orderBy: { key: "asc" },
  });
  return serializePrisma(rows || []);
};

const upsertSystemSetting = async (key, value, updatedBy = null) => {
  const now = new Date();
  const strVal = String(value);
  const bigUpdatedBy = updatedBy ? toBigInt(updatedBy) : null;

  const row = await prisma.system_settings.upsert({
    where: { key },
    create: {
      key,
      value: strVal,
      updated_by: bigUpdatedBy,
      updated_time: now,
    },
    update: {
      value: strVal,
      updated_by: bigUpdatedBy,
      updated_time: now,
    },
    select: { key: true, value: true, updated_time: true },
  });

  return serializePrisma(row);
};

const upsertSystemSettingsBulk = async (settingsArray, updatedBy = null) => {
  const now = new Date();
  const bigUpdatedBy = updatedBy ? toBigInt(updatedBy) : null;

  const results = await prisma.$transaction(
    settingsArray.map((s) =>
      prisma.system_settings.upsert({
        where: { key: s.key },
        create: {
          key: s.key,
          value: String(s.value),
          updated_by: bigUpdatedBy,
          updated_time: now,
        },
        update: {
          value: String(s.value),
          updated_by: bigUpdatedBy,
          updated_time: now,
        },
        select: { key: true, value: true, updated_time: true },
      })
    )
  );

  return serializePrisma(results);
};

// ==========================================
// 6. PERMISSIONS & ROLES MATRIX
// ==========================================

const getPermissionsMatrix = async () => {
  const [roles, permissions, rolePermissions] = await Promise.all([
    prisma.roles.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } }),
    prisma.permissions.findMany({ select: { id: true, key: true }, orderBy: { id: "asc" } }),
    prisma.role_permissions.findMany({ select: { role_id: true, permission_id: true } }),
  ]);

  return {
    roles: serializePrisma(roles || []),
    permissions: serializePrisma(permissions || []),
    rolePermissions: serializePrisma(rolePermissions || []),
  };
};

const getExistingPermissionIds = async (ids = []) => {
  if (!ids || ids.length === 0) return [];
  const bigIds = ids.map((id) => toBigInt(id)).filter((v) => v !== null);
  if (bigIds.length === 0) return [];

  const rows = await prisma.permissions.findMany({
    where: { id: { in: bigIds } },
    select: { id: true },
  });
  return rows.map((r) => Number(r.id));
};

const updateRolePermissions = async (roleId, permissionIds = []) => {
  const numRoleId = Number(roleId);
  const bigRoleId = BigInt(numRoleId);

  await prisma.$transaction(async (tx) => {
    await tx.role_permissions.deleteMany({
      where: { role_id: bigRoleId },
    });

    if (permissionIds.length > 0) {
      await tx.role_permissions.createMany({
        data: permissionIds.map((pId) => ({
          role_id: bigRoleId,
          permission_id: BigInt(Number(pId)),
        })),
      });
    }
  });

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
  updateRolePermissions,
};
