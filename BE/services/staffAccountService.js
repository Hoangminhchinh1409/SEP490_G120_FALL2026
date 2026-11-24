const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const staffAccountModel = require("../models/staffAccountModel");
const userModel = require("../models/userModel");
const { toBigInt } = require("../utils/prismaHelper");

// Role IDs hợp lệ theo quy định hệ thống: Chỉ Dispatcher (3) và Driver (4)
const ALLOWED_STAFF_ROLE_IDS = [3, 4];
const ALLOWED_STAFF_STATUSES = ["ACTIVE", "LOCKED"];
const VALID_LICENSE_CLASSES = ["B2", "C", "FC"];
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+() -]{9,15}$/;

const ROLE_NAME_TO_ID = {
  DISPATCHER: 3,
  DRIVER: 4,
};
const ROLE_ID_TO_NAME = {
  3: "DISPATCHER",
  4: "DRIVER",
};

const createHttpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const getTodayGMT7Str = () =>
  new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];

const parseValidDateStr = (val, label = "Ngày", { mustBeFutureOrToday = true } = {}) => {
  if (typeof val !== "string" || !val.trim()) {
    throw createHttpError(`${label} là bắt buộc và phải là chuỗi ngày hợp lệ.`, 400);
  }
  const trimmed = val.trim();
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  let isoDate;
  if (ymdMatch) {
    const y = Number(ymdMatch[1]);
    const m = Number(ymdMatch[2]);
    const d = Number(ymdMatch[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
      throw createHttpError(`${label} không đúng định dạng ngày hợp lệ.`, 400);
    }
    isoDate = trimmed;
  } else {
    const parsedMs = Date.parse(trimmed);
    if (Number.isNaN(parsedMs)) {
      throw createHttpError(`${label} không đúng định dạng ngày hợp lệ.`, 400);
    }
    isoDate = new Date(parsedMs).toISOString().split("T")[0];
  }

  if (mustBeFutureOrToday && isoDate < getTodayGMT7Str()) {
    throw createHttpError(`${label} không được nằm trong quá khứ.`, 400);
  }
  return isoDate;
};

const validatePasswordPolicy = (password) => {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    throw createHttpError(`Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`, 400);
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    throw createHttpError(`Mật khẩu không được vượt quá ${PASSWORD_MAX_BYTES} byte.`, 400);
  }
  return password;
};

const isUniqueViolation = (err) => err && err.code === "P2002";

const validateDriverLicensePayload = async (
  { license_number, license_class, license_expiry, expiry },
  { excludeProfileId = null } = {},
) => {
  if (typeof license_number !== "string" || !license_number.trim()) {
    throw createHttpError(
      "Số giấy phép lái xe (license_number) là bắt buộc khi tạo hoặc chuyển sang vai trò Tài xế.",
      400,
    );
  }
  const cleanLicNum = license_number.trim();

  let cleanLicClass = "C";
  if (license_class !== undefined) {
    if (typeof license_class !== "string" || !license_class.trim()) {
      throw createHttpError("Hạng bằng lái không hợp lệ (chỉ chấp nhận B2, C, FC).", 400);
    }
    cleanLicClass = license_class.trim().toUpperCase();
    if (!VALID_LICENSE_CLASSES.includes(cleanLicClass)) {
      throw createHttpError("Hạng bằng lái không hợp lệ (chỉ chấp nhận B2, C, FC).", 400);
    }
  }

  const rawExpiry = license_expiry !== undefined ? license_expiry : expiry;
  const cleanExpiry = parseValidDateStr(rawExpiry, "Ngày hết hạn GPLX", {
    mustBeFutureOrToday: true,
  });

  const dupLicense = await prisma.driver_profiles.findFirst({
    where: {
      license_number: cleanLicNum,
      ...(excludeProfileId ? { id: { not: toBigInt(excludeProfileId) } } : {}),
    },
    select: { id: true },
  });
  if (dupLicense) {
    throw createHttpError(`Số giấy phép lái xe ${cleanLicNum} đã tồn tại trong hệ thống.`, 409);
  }

  return {
    license_number: cleanLicNum,
    license_class: cleanLicClass,
    license_expiry: cleanExpiry,
  };
};

const formatStaffAccount = (acc) => ({
  id: acc.id,
  username: acc.username,
  full_name: acc.full_name,
  email: acc.email,
  phone: acc.phone || "",
  role_id: acc.role_id,
  role: acc.roles?.name || ROLE_ID_TO_NAME[acc.role_id] || "STAFF",
  status: acc.status,
  order_form_token: acc.order_form_token || null,
  driver_profile: acc.driver_profiles || null,
  created_at: acc.created_at,
  updated_at: acc.updated_at,
  last_login_at: acc.last_login_at,
});

const makeOrderFormToken = (username) =>
  `disp_${String(username).toLowerCase().replace(/[^a-z0-9]/g, "")}_${crypto
    .randomBytes(6)
    .toString("hex")}`;

const staffAccountService = {
  // 1. Lấy danh sách tài khoản nhân viên kèm tìm kiếm & bộ lọc
  getStaffAccounts: async ({ search, role, status }) => {
    let roleId = null;
    if (role && role !== "ALL") {
      if (typeof role === "number") {
        roleId = role;
      } else if (ROLE_NAME_TO_ID[String(role).toUpperCase()]) {
        roleId = ROLE_NAME_TO_ID[String(role).toUpperCase()];
      }
    }

    const accounts = await staffAccountModel.findStaffAccounts({
      search,
      roleId,
      status: status && status !== "ALL" ? String(status).toUpperCase() : null,
    });

    return accounts.map(formatStaffAccount);
  },

  // 2. Lấy chi tiết tài khoản nhân viên
  getStaffAccountById: async (id) => {
    const acc = await staffAccountModel.findStaffAccountById(id);
    if (!acc) {
      throw createHttpError(
        "Không tìm thấy tài khoản nhân viên hoặc bạn không có quyền truy cập.",
        404,
      );
    }
    return formatStaffAccount(acc);
  },

  // 3. Tạo mới tài khoản nhân viên
  createStaffAccount: async (payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw createHttpError("Dữ liệu yêu cầu không hợp lệ.", 400);
    }

    const {
      username,
      full_name,
      email,
      phone,
      role,
      password,
      status = "ACTIVE",
      license_number,
      license_class,
      license_expiry,
      expiry,
    } = payload;

    // Validation kiểu dữ liệu & trường bắt buộc (BUG-MGR-07)
    if (typeof username !== "string" || !username.trim()) {
      throw createHttpError("Tên đăng nhập (Username) là bắt buộc.", 400);
    }
    const cleanUsername = username.trim();
    if (
      cleanUsername.length < 3 ||
      cleanUsername.length > 50 ||
      !USERNAME_REGEX.test(cleanUsername)
    ) {
      throw createHttpError(
        "Tên đăng nhập phải từ 3-50 ký tự và chỉ gồm chữ cái, số, dấu chấm, gạch dưới, gạch ngang.",
        400,
      );
    }

    if (typeof full_name !== "string" || !full_name.trim()) {
      throw createHttpError("Họ và tên (full_name) là bắt buộc.", 400);
    }
    const cleanFullName = full_name.trim();
    if (cleanFullName.length > 100) {
      throw createHttpError("Họ và tên không được vượt quá 100 ký tự.", 400);
    }

    if (typeof email !== "string" || !email.trim()) {
      throw createHttpError("Email là bắt buộc.", 400);
    }
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.length > 100 || !EMAIL_REGEX.test(cleanEmail)) {
      throw createHttpError("Định dạng email không hợp lệ.", 400);
    }

    let cleanPhone = "";
    if (phone !== undefined && phone !== "") {
      if (typeof phone !== "string") {
        throw createHttpError("Số điện thoại phải là chuỗi ký tự hợp lệ.", 400);
      }
      cleanPhone = phone.trim();
      if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
        throw createHttpError("Số điện thoại không hợp lệ.", 400);
      }
    }

    // Kiểm tra Role theo quy tắc
    let targetRoleId = null;
    if (typeof role === "number") {
      targetRoleId = role;
    } else if (typeof role === "string" && ROLE_NAME_TO_ID[role.trim().toUpperCase()]) {
      targetRoleId = ROLE_NAME_TO_ID[role.trim().toUpperCase()];
    }

    if (!targetRoleId || !ALLOWED_STAFF_ROLE_IDS.includes(targetRoleId)) {
      throw createHttpError(
        "Lỗi: Manager chỉ được phép tạo tài khoản có vai trò là Dispatcher hoặc Driver.",
        403,
      );
    }

    // Kiểm tra Status chặt chẽ (BUG-MGR-05)
    if (typeof status !== "string" || !status.trim()) {
      throw createHttpError("Trạng thái không hợp lệ (chỉ chấp nhận ACTIVE hoặc LOCKED).", 400);
    }
    const normalizedStatus = status.trim().toUpperCase();
    if (!ALLOWED_STAFF_STATUSES.includes(normalizedStatus)) {
      throw createHttpError("Trạng thái không hợp lệ (chỉ chấp nhận ACTIVE hoặc LOCKED).", 400);
    }

    // Chính sách mật khẩu & không dùng mật khẩu hard-code (BUG-MGR-06)
    let rawPassword;
    if (password !== undefined && password !== null && password !== "") {
      rawPassword = validatePasswordPolicy(password);
    } else {
      rawPassword = crypto.randomBytes(12).toString("base64url");
    }
    const password_hash = await bcrypt.hash(rawPassword, 10);

    // Vai trò Driver: bắt buộc dữ liệu GPLX thật (BUG-MGR-04)
    let validatedLicense = null;
    if (targetRoleId === 4) {
      validatedLicense = await validateDriverLicensePayload({
        license_number,
        license_class,
        license_expiry,
        expiry,
      });
    }

    // Kiểm tra trùng lặp Username & Email
    const dupCheck = await staffAccountModel.checkDuplicate({
      username: cleanUsername,
      email: cleanEmail,
    });
    if (dupCheck.exists) {
      throw createHttpError(dupCheck.message, 409);
    }

    const order_form_token = targetRoleId === 3 ? makeOrderFormToken(cleanUsername) : null;

    const accountPayload = {
      username: cleanUsername,
      password_hash,
      full_name: cleanFullName,
      email: cleanEmail,
      phone: cleanPhone,
      role_id: targetRoleId,
      status: normalizedStatus,
      order_form_token,
    };

    let newAccount;
    try {
      if (targetRoleId === 4) {
        // Tạo user + driver_profiles trong 1 transaction: lỗi thì rollback toàn bộ, không để lại tài khoản mồ côi
        newAccount = await staffAccountModel.createStaffAccountWithDriverProfile(accountPayload, {
          ...validatedLicense,
          status: normalizedStatus === "LOCKED" ? "INACTIVE" : "ACTIVE",
        });
      } else {
        newAccount = await staffAccountModel.createStaffAccount(accountPayload);
      }
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw createHttpError(
          "Thông tin bị trùng (tên đăng nhập, email hoặc số GPLX đã tồn tại).",
          409,
        );
      }
      throw err;
    }

    return {
      ...newAccount,
      role: newAccount.roles?.name || ROLE_ID_TO_NAME[newAccount.role_id] || "STAFF",
      order_form_token: newAccount.order_form_token || order_form_token,
      driver_profile: newAccount.driver_profiles || null,
    };
  },

  // 4. Cập nhật thông tin tài khoản nhân viên
  updateStaffAccount: async (id, payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw createHttpError("Dữ liệu cập nhật không hợp lệ.", 400);
    }

    const existing = await staffAccountModel.findStaffAccountById(id);
    if (!existing) {
      throw createHttpError(
        "Không tìm thấy tài khoản nhân viên hoặc bạn không có quyền cập nhật tài khoản này.",
        404,
      );
    }

    const {
      full_name,
      email,
      phone,
      role,
      status,
      password,
      license_number,
      license_class,
      license_expiry,
      expiry,
    } = payload;
    const updateData = {};

    // Validation kiểu dữ liệu (BUG-MGR-07)
    if (full_name !== undefined) {
      if (typeof full_name !== "string" || !full_name.trim()) {
        throw createHttpError("Họ và tên không được để trống và phải là chuỗi hợp lệ.", 400);
      }
      const cleanName = full_name.trim();
      if (cleanName.length > 100) {
        throw createHttpError("Họ và tên không được vượt quá 100 ký tự.", 400);
      }
      updateData.full_name = cleanName;
    }

    if (phone !== undefined) {
      if (phone === "") {
        updateData.phone = null;
      } else {
        if (typeof phone !== "string") {
          throw createHttpError("Số điện thoại phải là chuỗi ký tự hợp lệ.", 400);
        }
        const cleanPhone = phone.trim();
        if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
          throw createHttpError("Số điện thoại không hợp lệ.", 400);
        }
        updateData.phone = cleanPhone || null;
      }
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        throw createHttpError("Email không hợp lệ.", 400);
      }
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail.length > 100 || !EMAIL_REGEX.test(cleanEmail)) {
        throw createHttpError("Định dạng email không hợp lệ.", 400);
      }
      updateData.email = cleanEmail;

      const dupCheck = await staffAccountModel.checkDuplicate({
        username: existing.username,
        email: updateData.email,
        excludeId: id,
      });
      if (dupCheck.exists && dupCheck.field === "email") {
        throw createHttpError(dupCheck.message, 409);
      }
    }

    let targetRoleId = Number(existing.role_id);
    if (role !== undefined) {
      let parsedRoleId = null;
      if (typeof role === "number") parsedRoleId = role;
      else if (typeof role === "string" && ROLE_NAME_TO_ID[role.trim().toUpperCase()]) {
        parsedRoleId = ROLE_NAME_TO_ID[role.trim().toUpperCase()];
      }

      if (!parsedRoleId || !ALLOWED_STAFF_ROLE_IDS.includes(parsedRoleId)) {
        throw createHttpError("Lỗi: Manager chỉ được phép gán vai trò Dispatcher hoặc Driver.", 403);
      }
      targetRoleId = parsedRoleId;
      if (targetRoleId !== Number(existing.role_id)) {
        updateData.role_id = targetRoleId;
        updateData.password_changed_at = new Date().toISOString();
        if (targetRoleId === 3) {
          updateData.order_form_token = existing.order_form_token || makeOrderFormToken(existing.username);
        } else {
          updateData.order_form_token = null;
        }
      }
    }

    // Kiểm tra Status chặt chẽ (BUG-MGR-05)
    if (status !== undefined) {
      if (typeof status !== "string" || !status.trim()) {
        throw createHttpError("Trạng thái không hợp lệ (chỉ chấp nhận ACTIVE hoặc LOCKED).", 400);
      }
      const normalizedStatus = status.trim().toUpperCase();
      if (!ALLOWED_STAFF_STATUSES.includes(normalizedStatus)) {
        throw createHttpError("Trạng thái không hợp lệ (chỉ chấp nhận ACTIVE hoặc LOCKED).", 400);
      }
      updateData.status = normalizedStatus;
    }

    // Chính sách mật khẩu >= 8 ký tự (BUG-MGR-06)
    if (password !== undefined && password !== null && password !== "") {
      const validPwd = validatePasswordPolicy(password);
      updateData.password_hash = await bcrypt.hash(validPwd, 10);
      updateData.password_changed_at = new Date().toISOString();
    }

    // Đồng bộ hồ sơ tài xế theo vai trò mới (BUG-MGR-04)
    const existingProfile = existing.driver_profiles || null;
    const roleChanged = targetRoleId !== Number(existing.role_id);
    const hasLicensePayload =
      license_number !== undefined ||
      license_class !== undefined ||
      license_expiry !== undefined ||
      expiry !== undefined;

    let driverOp = null;
    if (targetRoleId === 4) {
      const effectiveStatus = updateData.status || existing.status;
      const profileStatus = effectiveStatus === "LOCKED" ? "INACTIVE" : "ACTIVE";

      if (!existingProfile || hasLicensePayload) {
        const validatedLicense = await validateDriverLicensePayload(
          {
            license_number:
              license_number !== undefined ? license_number : existingProfile?.license_number,
            license_class:
              license_class !== undefined ? license_class : existingProfile?.license_class,
            license_expiry:
              license_expiry !== undefined
                ? license_expiry
                : expiry !== undefined
                  ? expiry
                  : existingProfile?.license_expiry,
          },
          { excludeProfileId: existingProfile?.id || null },
        );
        if (!existingProfile) {
          driverOp = { type: "create", data: { ...validatedLicense, status: profileStatus } };
        } else {
          driverOp = {
            type: "update",
            profileId: existingProfile.id,
            data: {
              ...validatedLicense,
              ...(roleChanged || updateData.status !== undefined ? { status: profileStatus } : {}),
            },
          };
        }
      } else if (roleChanged || updateData.status !== undefined) {
        driverOp = { type: "update", profileId: existingProfile.id, data: { status: profileStatus } };
      }
    } else if (roleChanged && Number(existing.role_id) === 4 && existingProfile) {
      driverOp = { type: "deactivate", profileId: existingProfile.id };
    }

    let updated;
    try {
      updated = await staffAccountModel.updateStaffAccountWithDriverSync(id, updateData, driverOp);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw createHttpError("Thông tin bị trùng (email hoặc số GPLX đã tồn tại).", 409);
      }
      throw err;
    }

    userModel.invalidateAuthSessionCache(id);
    return {
      ...updated,
      role: updated.roles?.name || ROLE_ID_TO_NAME[updated.role_id] || "STAFF",
      driver_profile: updated.driver_profiles || null,
    };
  },

  // 5. Cập nhật trạng thái Khóa / Mở khóa tài khoản
  toggleStaffAccountStatus: async (id, status) => {
    const existing = await staffAccountModel.findStaffAccountById(id);
    if (!existing) {
      throw createHttpError(
        "Không tìm thấy tài khoản nhân viên hoặc bạn không có quyền cập nhật tài khoản này.",
        404,
      );
    }

    let newStatus;
    if (status !== undefined && status !== null && status !== "") {
      if (typeof status !== "string") {
        throw createHttpError("Trạng thái không hợp lệ (chỉ chấp nhận ACTIVE hoặc LOCKED).", 400);
      }
      newStatus = status.trim().toUpperCase();
    } else {
      newStatus = existing.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    }

    if (!ALLOWED_STAFF_STATUSES.includes(newStatus)) {
      throw createHttpError("Trạng thái không hợp lệ (chỉ chấp nhận ACTIVE hoặc LOCKED).", 400);
    }

    const updated = await staffAccountModel.updateAccountStatus(id, newStatus);
    userModel.invalidateAuthSessionCache(id);
    return {
      id: updated.id,
      username: updated.username,
      full_name: updated.full_name,
      status: updated.status,
      message:
        newStatus === "LOCKED"
          ? `Đã khóa tài khoản ${updated.username} thành công.`
          : `Đã mở khóa tài khoản ${updated.username} thành công.`,
    };
  },
};

module.exports = staffAccountService;
