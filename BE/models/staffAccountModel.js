const prisma = require("../config/prisma");
const { serializePrisma, toBigInt, formatDateOnly } = require("../utils/prismaHelper");

const DRIVER_PROFILE_SELECT = {
  id: true,
  license_number: true,
  license_class: true,
  license_expiry: true,
  status: true,
};

const STAFF_ACCOUNT_SELECT = {
  id: true,
  username: true,
  full_name: true,
  email: true,
  phone: true,
  role_id: true,
  status: true,
  order_form_token: true,
  created_at: true,
  updated_at: true,
  last_login_at: true,
  roles: {
    select: {
      id: true,
      name: true,
    },
  },
  driver_profiles: {
    select: DRIVER_PROFILE_SELECT,
  },
};

// Chuẩn hoá kết quả Prisma: BigInt/Date -> JSON thuần, license_expiry -> YYYY-MM-DD
const serializeStaffRow = (row) => {
  if (!row) return row;
  const out = serializePrisma(row);
  if (row.driver_profiles) {
    out.driver_profiles = {
      ...out.driver_profiles,
      license_expiry: formatDateOnly(row.driver_profiles.license_expiry),
    };
  } else {
    out.driver_profiles = null;
  }
  return out;
};

/**
 * Model quản lý tài khoản nhân viên (Dispatcher & Driver)
 * Chỉ truy vấn các tài khoản có role_id = 3 (DISPATCHER) hoặc role_id = 4 (DRIVER)
 */
const staffAccountModel = {
  // 1. Lấy danh sách tài khoản nhân viên (hỗ trợ tìm kiếm, lọc theo role và status)
  findStaffAccounts: async ({ search, roleId, status }) => {
    const numericRoleId = roleId !== undefined && roleId !== null ? Number(roleId) : null;
    const safeRoleFilter = [3, 4].includes(numericRoleId) ? toBigInt(numericRoleId) : { in: [3n, 4n] };
    const where = {
      role_id: safeRoleFilter,
    };

    if (status) {
      where.status = status;
    }

    if (search && search.trim() !== "") {
      const s = search.trim();
      where.OR = [
        { username: { contains: s, mode: "insensitive" } },
        { full_name: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
      ];
    }

    const rows = await prisma.users.findMany({
      where,
      select: STAFF_ACCOUNT_SELECT,
      orderBy: { id: "desc" },
    });

    return (rows || []).map(serializeStaffRow);
  },

  // 2. Lấy chi tiết một tài khoản nhân viên
  findStaffAccountById: async (id) => {
    const userId = toBigInt(id);
    if (userId === null) return null;

    const row = await prisma.users.findFirst({
      where: {
        id: userId,
        role_id: { in: [3n, 4n] },
      },
      select: STAFF_ACCOUNT_SELECT,
    });

    return serializeStaffRow(row);
  },

  // 3. Kiểm tra xem username hoặc email đã tồn tại hay chưa
  checkDuplicate: async ({ username, email, excludeId }) => {
    const excludeBigId = excludeId ? toBigInt(excludeId) : null;

    const userByUsername = await prisma.users.findFirst({
      where: {
        username,
        ...(excludeBigId ? { id: { not: excludeBigId } } : {}),
      },
      select: { id: true, username: true, email: true },
    });

    if (userByUsername) {
      return {
        exists: true,
        field: "username",
        message: "Tên đăng nhập (Username) đã tồn tại trong hệ thống.",
      };
    }

    const userByEmail = await prisma.users.findFirst({
      where: {
        email,
        ...(excludeBigId ? { id: { not: excludeBigId } } : {}),
      },
      select: { id: true, username: true, email: true },
    });

    if (userByEmail) {
      return {
        exists: true,
        field: "email",
        message: "Email đã tồn tại trong hệ thống.",
      };
    }

    return { exists: false };
  },

  // 4. Tạo mới tài khoản nhân viên
  createStaffAccount: async (payload) => {
    const created = await prisma.users.create({
      data: {
        username: payload.username,
        password_hash: payload.password_hash,
        full_name: payload.full_name,
        email: payload.email,
        phone: payload.phone || null,
        role_id: toBigInt(payload.role_id),
        status: payload.status || "ACTIVE",
        order_form_token: payload.order_form_token || null,
      },
      select: STAFF_ACCOUNT_SELECT,
    });

    return serializeStaffRow(created);
  },

  // 4b. Tạo tài khoản + hồ sơ tài xế trong CÙNG MỘT transaction (all-or-nothing)
  createStaffAccountWithDriverProfile: async (payload, profile) => {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          username: payload.username,
          password_hash: payload.password_hash,
          full_name: payload.full_name,
          email: payload.email,
          phone: payload.phone || null,
          role_id: toBigInt(payload.role_id),
          status: payload.status || "ACTIVE",
          order_form_token: payload.order_form_token || null,
        },
        select: { id: true },
      });

      await tx.driver_profiles.create({
        data: {
          user_account_id: user.id,
          license_number: profile.license_number,
          license_class: profile.license_class,
          license_expiry: new Date(`${profile.license_expiry}T00:00:00.000Z`),
          status: profile.status || "ACTIVE",
        },
      });

      return tx.users.findUnique({
        where: { id: user.id },
        select: STAFF_ACCOUNT_SELECT,
      });
    }, { maxWait: 10000, timeout: 15000 });

    return serializeStaffRow(created);
  },

  // 5. Cập nhật thông tin tài khoản nhân viên
  updateStaffAccount: async (id, payload) => {
    const userId = toBigInt(id);
    const existing = await prisma.users.findFirst({
      where: { id: userId, role_id: { in: [3n, 4n] } },
      select: { id: true },
    });
    if (!existing) {
      const err = new Error("Không tìm thấy tài khoản nhân viên để cập nhật.");
      err.statusCode = 404;
      throw err;
    }

    const updateData = {
      updated_at: new Date(),
    };

    if (payload.full_name !== undefined) updateData.full_name = payload.full_name;
    if (payload.email !== undefined) updateData.email = payload.email;
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.role_id !== undefined) updateData.role_id = toBigInt(payload.role_id);
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.order_form_token !== undefined) updateData.order_form_token = payload.order_form_token;
    if (payload.password_hash) updateData.password_hash = payload.password_hash;
    if (payload.password_changed_at !== undefined) {
      updateData.password_changed_at = payload.password_changed_at
        ? new Date(payload.password_changed_at)
        : null;
    }

    const updated = await prisma.users.update({
      where: { id: userId },
      data: updateData,
      select: STAFF_ACCOUNT_SELECT,
    });

    return serializeStaffRow(updated);
  },

  // 5b. Cập nhật tài khoản + đồng bộ hồ sơ tài xế trong CÙNG MỘT transaction
  // driverOp: { type: 'create' | 'update' | 'deactivate', profileId?, data? } | null
  updateStaffAccountWithDriverSync: async (id, payload, driverOp) => {
    const userId = toBigInt(id);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.users.findFirst({
        where: { id: userId, role_id: { in: [3n, 4n] } },
        select: { id: true },
      });
      if (!existing) {
        const err = new Error("Không tìm thấy tài khoản nhân viên để cập nhật.");
        err.statusCode = 404;
        throw err;
      }

      const updateData = { updated_at: new Date() };
      if (payload.full_name !== undefined) updateData.full_name = payload.full_name;
      if (payload.email !== undefined) updateData.email = payload.email;
      if (payload.phone !== undefined) updateData.phone = payload.phone;
      if (payload.role_id !== undefined) updateData.role_id = toBigInt(payload.role_id);
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.order_form_token !== undefined) updateData.order_form_token = payload.order_form_token;
      if (payload.password_hash) updateData.password_hash = payload.password_hash;
      if (payload.password_changed_at !== undefined) {
        updateData.password_changed_at = payload.password_changed_at
          ? new Date(payload.password_changed_at)
          : null;
      }

      await tx.users.update({ where: { id: userId }, data: updateData });

      if (driverOp) {
        const toDate = (s) => new Date(`${s}T00:00:00.000Z`);
        if (driverOp.type === "create") {
          await tx.driver_profiles.create({
            data: {
              user_account_id: userId,
              license_number: driverOp.data.license_number,
              license_class: driverOp.data.license_class,
              license_expiry: toDate(driverOp.data.license_expiry),
              status: driverOp.data.status || "ACTIVE",
            },
          });
        } else if (driverOp.type === "update") {
          const data = { updated_at: new Date() };
          if (driverOp.data.license_number !== undefined) data.license_number = driverOp.data.license_number;
          if (driverOp.data.license_class !== undefined) data.license_class = driverOp.data.license_class;
          if (driverOp.data.license_expiry !== undefined) data.license_expiry = toDate(driverOp.data.license_expiry);
          if (driverOp.data.status !== undefined) data.status = driverOp.data.status;
          await tx.driver_profiles.update({ where: { id: toBigInt(driverOp.profileId) }, data });
        } else if (driverOp.type === "deactivate") {
          await tx.driver_profiles.update({
            where: { id: toBigInt(driverOp.profileId) },
            data: { status: "INACTIVE", updated_at: new Date() },
          });
        }
      }

      return tx.users.findUnique({ where: { id: userId }, select: STAFF_ACCOUNT_SELECT });
    }, { maxWait: 10000, timeout: 15000 });

    return serializeStaffRow(updated);
  },

  // 6. Cập nhật trạng thái khóa/mở khóa
  updateAccountStatus: async (id, status) => {
    const userId = toBigInt(id);
    const existing = await prisma.users.findFirst({
      where: { id: userId, role_id: { in: [3n, 4n] } },
      select: { id: true },
    });
    if (!existing) {
      const err = new Error("Không tìm thấy tài khoản nhân viên để cập nhật trạng thái.");
      err.statusCode = 404;
      throw err;
    }

    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        status,
        updated_at: new Date(),
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        status: true,
        updated_at: true,
      },
    });

    return serializePrisma(updated);
  },
};

module.exports = staffAccountModel;
