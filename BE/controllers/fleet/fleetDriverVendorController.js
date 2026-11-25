const prisma = require('../../config/prisma');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fleetService = require('../../services/fleetService');
const staffAccountService = require('../../services/staffAccountService');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../../utils/prismaHelper');
const {
  VALID_DRIVER_PROFILE_STATUSES,
  EMAIL_REGEX,
  PHONE_REGEX,
  TX_OPTIONS,
  normalizeDriverProfileStatus,
  formatP2002Message,
  sendSafeError,
  parseValidDateStr,
  validateLicenseClassValue,
  toDateObj
} = require('./fleetValidationHelper');

// ==========================================
// DISPATCHER DRIVER & VENDOR OPERATIONS
// ==========================================

const getFleetDrivers = async (req, res) => {
  try {
    const formattedDrivers = await fleetService.getAllDrivers();
    return res.json({ drivers: formattedDrivers });
  } catch (err) {
    return sendSafeError(res, err, 'Lỗi tải danh sách tài xế', 'getFleetDrivers');
  }
};

const updateFleetDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await fleetService.updateDriver(id, req.body);
    return res.json({ message: 'Cập nhật thành công', driver: updated });
  } catch (err) {
    return sendSafeError(res, err, 'Lỗi cập nhật tài xế', 'updateFleetDriver');
  }
};

const getFleetVendors = async (req, res) => {
  try {
    const formattedVendors = await fleetService.getAllVendors();
    return res.json({ vendors: formattedVendors });
  } catch (err) {
    return sendSafeError(res, err, 'Lỗi tải danh sách đối tác', 'getFleetVendors');
  }
};

// ==========================================
// MANAGER STAFF ACCOUNTS
// ==========================================

const getStaffAccounts = async (req, res) => {
  try {
    const { search, role, status } = req.query;
    const accounts = await staffAccountService.getStaffAccounts({ search, role, status });
    return res.status(200).json({
      message: 'Lấy danh sách tài khoản nhân viên thành công',
      total: accounts.length,
      accounts
    });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi lấy danh sách tài khoản nhân viên', 'getStaffAccounts');
  }
};

const getStaffAccountDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await staffAccountService.getStaffAccountById(id);
    return res.status(200).json({
      message: 'Lấy thông tin tài khoản thành công',
      account
    });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi lấy thông tin tài khoản', 'getStaffAccountDetail');
  }
};

const createStaffAccount = async (req, res) => {
  try {
    const result = await staffAccountService.createStaffAccount(req.body);
    return res.status(201).json({
      message: `Tạo tài khoản ${result.username} thành công`,
      account: result
    });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi tạo tài khoản nhân viên', 'createStaffAccount');
  }
};

const updateStaffAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await staffAccountService.updateStaffAccount(id, req.body);
    return res.status(200).json({
      message: 'Cập nhật thông tin tài khoản thành công',
      account: result
    });
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi cập nhật tài khoản nhân viên', 'updateStaffAccount');
  }
};

const updateAccountStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await staffAccountService.toggleStaffAccountStatus(id, status);
    return res.status(200).json(result);
  } catch (error) {
    return sendSafeError(res, error, 'Lỗi khi thay đổi trạng thái tài khoản', 'updateAccountStatus');
  }
};

// ==========================================
// MANAGER DRIVER PROFILES
// ==========================================

const createDriver = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      name,
      full_name,
      email,
      phone,
      license_number,
      license_class,
      license_expiry,
      expiry,
      password
    } = body;

    const rawName = full_name !== undefined ? full_name : name;
    if (typeof rawName !== 'string' || !rawName.trim()) {
      return res.status(400).json({ message: 'Họ và tên tài xế là bắt buộc.' });
    }
    const driverName = rawName.trim();
    if (driverName.length > 100) {
      return res.status(400).json({ message: 'Họ và tên tài xế không được vượt quá 100 ký tự.' });
    }

    if (typeof phone !== 'string' || !phone.trim() || !PHONE_REGEX.test(phone.trim())) {
      return res.status(400).json({ message: 'Số điện thoại là bắt buộc và phải đúng định dạng.' });
    }
    const cleanPhone = phone.trim();

    let cleanEmailInput = null;
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ message: 'Định dạng email không hợp lệ.' });
      }
      cleanEmailInput = email.trim().toLowerCase();
      if (cleanEmailInput.length > 100) {
        return res.status(400).json({ message: 'Email không được vượt quá 100 ký tự.' });
      }
    }

    if (typeof license_number !== 'string' || !license_number.trim()) {
      return res.status(400).json({ message: 'Số giấy phép lái xe (license_number) là bắt buộc.' });
    }
    const licNum = license_number.trim();
    if (licNum.length > 20) {
      return res.status(400).json({ message: 'Số giấy phép lái xe (license_number) không được vượt quá 20 ký tự.' });
    }

    const licClass = license_class !== undefined
      ? validateLicenseClassValue(license_class)
      : 'C';

    const rawExpiry = license_expiry !== undefined ? license_expiry : expiry;
    const licExpiry = parseValidDateStr(rawExpiry, 'Ngày hết hạn GPLX', { mustBeFutureOrToday: true });

    // Kiểm tra trùng số GPLX trước khi thao tác bảng users (BUG-MGR-03)
    const dupLicense = await prisma.driver_profiles.findFirst({
      where: { license_number: licNum },
      select: { id: true }
    });
    if (dupLicense) {
      return res.status(409).json({ message: `Số GPLX ${licNum} đã tồn tại trong hệ thống.` });
    }

    const userSelect = { id: true, full_name: true, phone: true, username: true, email: true, role_id: true };

    const userByPhone = await prisma.users.findFirst({
      where: { phone: cleanPhone },
      select: userSelect
    });
    const userByEmail = cleanEmailInput
      ? await prisma.users.findUnique({
          where: { email: cleanEmailInput },
          select: userSelect
        })
      : null;

    if (userByPhone && userByEmail && String(userByPhone.id) !== String(userByEmail.id)) {
      return res.status(409).json({
        message: 'Số điện thoại và Email thuộc về hai tài khoản khác nhau trong hệ thống.'
      });
    }

    const existingUser = userByPhone || userByEmail;

    let userId = null;
    let finalUsername = '';
    let finalEmail = '';
    let finalFullName = driverName;
    let finalPhone = cleanPhone;
    let profileResult = null;

    if (existingUser) {
      // BUG-MGR-01: Tuyệt đối không tự ý chuyển vai trò tài khoản khác thành Driver (BR-28)
      if (Number(existingUser.role_id) !== 4) {
        const matchedBy = userByPhone && String(userByPhone.id) === String(existingUser.id) ? 'Số điện thoại' : 'Email';
        return res.status(409).json({
          message: `Tài khoản không phải Driver: ${matchedBy} này đã thuộc về tài khoản "${existingUser.username}" (vai trò khác Tài xế). Vui lòng dùng SĐT/Email khác cho tài xế mới.`
        });
      }

      // BUG-MGR-03: Không cho phép đăng ký lại tài xế đã có hồ sơ
      const existingProfile = await prisma.driver_profiles.findUnique({
        where: { user_account_id: existingUser.id },
        select: { id: true }
      });
      if (existingProfile) {
        return res.status(409).json({ message: 'Tài xế này đã có hồ sơ trong hệ thống.' });
      }

      userId = existingUser.id;
      finalUsername = existingUser.username;
      finalEmail = existingUser.email;
      finalFullName = existingUser.full_name || driverName;
      finalPhone = existingUser.phone || cleanPhone;

      profileResult = await prisma.driver_profiles.create({
        data: {
          user_account_id: userId,
          license_number: licNum,
          license_class: licClass,
          license_expiry: toDateObj(licExpiry),
          status: 'ACTIVE'
        }
      });
    } else {
      const phoneDigits = cleanPhone.replace(/\D/g, '').slice(-4) || Math.floor(Math.random() * 1000);
      let candidateUsername = `driver_${phoneDigits}_${Math.floor(10 + Math.random() * 90)}`;
      const dupUser = await prisma.users.findUnique({
        where: { username: candidateUsername },
        select: { id: true }
      });
      if (dupUser) {
        candidateUsername = `driver_${phoneDigits}_${Date.now().toString().slice(-4)}`;
      }
      finalUsername = candidateUsername;

      finalEmail = cleanEmailInput || `${finalUsername}@nexlog.vn`;
      const dupEmail = await prisma.users.findUnique({
        where: { email: finalEmail },
        select: { id: true }
      });
      if (dupEmail) {
        if (cleanEmailInput) {
          return res.status(409).json({ message: 'Email đã tồn tại trong hệ thống.' });
        }
        finalEmail = `driver_${phoneDigits}_${Date.now()}@nexlog.vn`;
      }

      // Chính sách mật khẩu & không dùng mật khẩu hard-code (BUG-MGR-06)
      let rawPassword;
      if (password !== undefined && password !== null && password !== '') {
        if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
          return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 byte.' });
        }
        rawPassword = password;
      } else {
        rawPassword = crypto.randomBytes(12).toString('base64url');
      }
      const password_hash = await bcrypt.hash(rawPassword, 10);

      // BUG-MGR-01: user + hồ sơ tài xế tạo trong CÙNG MỘT transaction (lỗi thì rollback, không để lại user mồ côi)
      const txResult = await prisma.$transaction(async (tx) => {
        const newUser = await tx.users.create({
          data: {
            username: finalUsername,
            password_hash,
            full_name: driverName,
            email: finalEmail,
            phone: cleanPhone,
            role_id: 4n,
            status: 'ACTIVE'
          },
          select: { id: true }
        });
        const profile = await tx.driver_profiles.create({
          data: {
            user_account_id: newUser.id,
            license_number: licNum,
            license_class: licClass,
            license_expiry: toDateObj(licExpiry),
            status: 'ACTIVE'
          }
        });
        return { userId: newUser.id, profile };
      }, TX_OPTIONS);
      userId = txResult.userId;
      profileResult = txResult.profile;
    }

    return res.status(201).json({
      message: 'Thêm tài xế mới thành công.',
      driver: {
        id: toNum(profileResult.id),
        user_account_id: toNum(userId),
        name: finalFullName,
        phone: finalPhone,
        username: finalUsername,
        email: finalEmail,
        license: profileResult.license_class,
        license_class: profileResult.license_class,
        license_number: profileResult.license_number,
        expiry: formatDateOnly(profileResult.license_expiry),
        license_expiry: formatDateOnly(profileResult.license_expiry),
        status: normalizeDriverProfileStatus(profileResult.status)
      }
    });
  } catch (error) {
    console.error('Create Driver Error:', error);
    if (error && error.code === 'P2002') {
      return res.status(409).json({
        message: formatP2002Message(error, 'Thông tin bị trùng (số GPLX, email hoặc SĐT đã tồn tại).')
      });
    }
    if (error && error.code === 'P2000') {
      return res.status(400).json({ message: 'Dữ liệu nhập vào vượt quá độ dài cho phép.' });
    }
    return sendSafeError(res, error, 'Không thể thêm tài xế', 'createDriver');
  }
};

const updateDriverProfile = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    const body = req.body || {};
    const { license_number, license_class, license_expiry, expiry, status } = body;

    const existingProfile = bigId === null ? null : await prisma.driver_profiles.findUnique({
      where: { id: bigId },
      select: { id: true }
    });
    if (!existingProfile) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ tài xế.' });
    }

    const profileUpdates = { updated_at: new Date() };

    if (license_number !== undefined) {
      if (typeof license_number !== 'string' || !license_number.trim()) {
        return res.status(400).json({ message: 'Số GPLX không được để trống.' });
      }
      const cleanLicNum = license_number.trim();
      if (cleanLicNum.length > 20) {
        return res.status(400).json({ message: 'Số giấy phép lái xe (license_number) không được vượt quá 20 ký tự.' });
      }
      const dupLic = await prisma.driver_profiles.findFirst({
        where: { license_number: cleanLicNum, id: { not: bigId } },
        select: { id: true }
      });
      if (dupLic) {
        return res.status(409).json({ message: `Số GPLX ${cleanLicNum} đã tồn tại trong hệ thống.` });
      }
      profileUpdates.license_number = cleanLicNum;
    }

    if (license_class !== undefined) {
      profileUpdates.license_class = validateLicenseClassValue(license_class);
    }

    // BUG-MGR-02: Chấp nhận cả license_expiry lẫn expiry
    const rawExpiry = license_expiry !== undefined ? license_expiry : expiry;
    if (rawExpiry !== undefined) {
      profileUpdates.license_expiry = toDateObj(
        parseValidDateStr(rawExpiry, 'Ngày hết hạn GPLX', { mustBeFutureOrToday: true })
      );
    }

    if (status !== undefined) {
      if (typeof status !== 'string' || !status.trim()) {
        return res.status(400).json({ message: 'Trạng thái hồ sơ tài xế không hợp lệ.' });
      }
      const normStatus = status.trim().toUpperCase();
      if (!VALID_DRIVER_PROFILE_STATUSES.includes(normStatus)) {
        return res.status(400).json({ message: 'Trạng thái hồ sơ tài xế không hợp lệ.' });
      }
      profileUpdates.status = normStatus;
    }

    // BUG-MGR-03: Không cập nhật full_name / phone / email vào bảng users từ hồ sơ tài xế (SRS: chỉ đọc)
    const updatedProfile = await prisma.driver_profiles.update({
      where: { id: bigId },
      data: profileUpdates
    });

    const serialized = serializePrisma(updatedProfile);
    serialized.license_expiry = formatDateOnly(updatedProfile.license_expiry);

    return res.json({
      message: 'Cập nhật hồ sơ tài xế thành công.',
      profile: serialized
    });
  } catch (error) {
    console.error('Update Driver Profile Error:', error);
    if (error && error.code === 'P2002') {
      return res.status(409).json({
        message: formatP2002Message(error, 'Số GPLX đã tồn tại trong hệ thống.')
      });
    }
    if (error && error.code === 'P2000') {
      return res.status(400).json({ message: 'Dữ liệu nhập vào vượt quá độ dài cho phép.' });
    }
    return sendSafeError(res, error, 'Lỗi khi cập nhật hồ sơ tài xế', 'updateDriverProfile');
  }
};

module.exports = {
  getFleetDrivers,
  updateFleetDriver,
  getFleetVendors,
  getStaffAccounts,
  getStaffAccountDetail,
  createStaffAccount,
  updateStaffAccount,
  updateAccountStatus,
  createDriver,
  updateDriverProfile
};
