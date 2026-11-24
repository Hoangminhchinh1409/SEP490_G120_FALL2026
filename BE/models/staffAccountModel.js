const prisma = require("../config/prisma");
const { serializePrisma, toBigInt } = require("../utils/prismaHelper");

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
};

/**
 * Model quản lý tài khoản nhân viên (Dispatcher & Driver)
 * Chỉ truy vấn các tài khoản có role_id = 3 (DISPATCHER) hoặc role_id = 4 (DRIVER)
 */
const staffAccountModel = {
  // 1. Lấy danh sách tài khoản nhân viên (hỗ trợ tìm kiếm, lọc theo role và status)
  findStaffAccounts: async ({ search, roleId, status }) => {
    const where = {
      role_id: roleId ? toBigInt(roleId) : { in: [3n, 4n] },
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

    return serializePrisma(rows || []);
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

    return serializePrisma(row);
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
      select: {
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
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return serializePrisma(created);
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
    if (payload.password_hash) updateData.password_hash = payload.password_hash;

    const updated = await prisma.users.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        role_id: true,
        status: true,
        created_at: true,
        updated_at: true,
        roles: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return serializePrisma(updated);
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
