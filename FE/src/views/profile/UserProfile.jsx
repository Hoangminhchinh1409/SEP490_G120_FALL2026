"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  MapPin,
  Pencil,
  Save,
  Shield,
  Truck,
} from "lucide-react";
import { message } from "antd";
import { useAuth } from "../../providers/AuthProvider";
import { API_ENDPOINTS } from "../../api/apiConfig";
import { fetchWithAuth } from "../../api/apiClient";

const ROLE_LABELS = {
  1: "Quản trị viên hệ thống",
  2: "Quản lý vận hành",
  3: "Điều phối viên",
};

const TABS = [
  { id: "info", label: "Thông tin cá nhân" },
  { id: "security", label: "Bảo mật" },
];

const COMPANY_HQ = {
  name: "Trụ sở chính",
  lines: [
    "Khu Công Nghệ Cao Hòa Lạc, CT03",
    "Hòa Lạc, Hà Nội, Việt Nam",
  ],
};
const PREFERRED_CARRIER = "NEXLOG Express";

const MSG04 = "Mật khẩu mới không hợp lệ.";
const MSG58 = "Mật khẩu hiện tại không đúng.";
const MSG59 = "Mật khẩu mới phải có ít nhất 8 ký tự và khác mật khẩu cũ.";
const MSG60 = "Đã đổi mật khẩu. Các thiết bị khác cần đăng nhập lại.";

function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatMemberSince(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `Tháng ${month}, ${date.getFullYear()}`;
}

function normalizePhone(phone) {
  if (typeof phone !== "string") return "";
  return phone.trim().replace(/[.\s()-]/g, "");
}

function profileFromUser(user) {
  return {
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    zalo_link: user?.zalo_link || "",
  };
}

async function updateUserProfile(payload) {
  const requests = [
    [API_ENDPOINTS.AUTH.UPDATE_PROFILE, "POST"],
    [API_ENDPOINTS.AUTH.ME, "PATCH"],
    [API_ENDPOINTS.AUTH.ME, "PUT"],
  ];
  let lastError;

  for (const [endpoint, method] of requests) {
    try {
      return await fetchWithAuth(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (error.status !== 404) throw error;
      lastError = error;
    }
  }

  throw lastError;
}

export default function UserProfile() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(user);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("info");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let ignore = false;

    fetchWithAuth(API_ENDPOINTS.AUTH.ME)
      .then((data) => {
        if (ignore) return;
        setProfile(data.user);
        if (setUser) setUser(data.user);
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || "Không thể tải hồ sơ cá nhân");
      })
      .finally(() => {
        if (!ignore) setLoadingProfile(false);
      });

    return () => {
      ignore = true;
    };
  }, [setUser]);

  const editing = draft !== null;
  const form = draft ?? profileFromUser(profile);
  const roleText = ROLE_LABELS[profile?.role_id] || "Người dùng";
  const initials = getInitials(profile?.full_name || profile?.username);
  const isActive = (profile?.status || "ACTIVE") === "ACTIVE";

  const fieldClass = useMemo(
    () =>
      `w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-all ${
        editing
          ? "bg-white border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          : "bg-slate-50 border-slate-100 cursor-default"
      }`,
    [editing]
  );

  const handleChange = (field, value) => {
    setDraft((prev) => ({ ...(prev ?? profileFromUser(profile)), [field]: value }));
  };

  const startEdit = () => setDraft(profileFromUser(profile));
  const cancelEdit = () => setDraft(null);

  const saveProfile = async (event) => {
    event?.preventDefault?.();
    if (draft === null) return;
    if (!form.full_name.trim()) {
      message.warning("Vui lòng nhập họ và tên");
      return;
    }
    const phone = normalizePhone(form.phone);
    if (phone && !/^\+?\d{9,15}$/.test(phone)) {
      message.warning("Số điện thoại không hợp lệ");
      return;
    }

    setSaving(true);
    try {
      const data = await updateUserProfile({
        full_name: form.full_name.trim(),
        phone: phone || null,
        zalo_link: (form.zalo_link || "").trim() || null,
      });
      setProfile(data.user);
      if (setUser) setUser(data.user);
      setDraft(null);
      message.success("Đã cập nhật hồ sơ cá nhân");
    } catch (error) {
      message.error(error.message || "Không thể cập nhật hồ sơ");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setPasswordError("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.");
      return;
    }
    if (passwordForm.newPassword.length < 8 || passwordForm.newPassword === passwordForm.currentPassword) {
      setPasswordError(MSG59);
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(MSG04);
      return;
    }

    setSavingPassword(true);
    try {
      const result = await fetchWithAuth(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      message.success(result?.message || MSG60);
    } catch (error) {
      const text = error.message || MSG58;
      if (text.includes("hiện tại")) setPasswordError(MSG58);
      else if (text.includes("8 ký tự") || text.includes("khác")) setPasswordError(MSG59);
      else setPasswordError(text);
    } finally {
      setSavingPassword(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm font-medium text-slate-500">
        Đang tải hồ sơ cá nhân...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
            Quản lý tài khoản
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-800">
            Hồ sơ cá nhân
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Thông tin lấy từ tài khoản đang đăng nhập trên hệ thống.
          </p>
        </div>

        {tab === "info" && (
          <div className="flex items-center gap-2">
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
            )}
            <button
              type="button"
              onClick={editing ? saveProfile : startEdit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-60"
            >
              {editing ? <Save className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Chỉnh sửa hồ sơ"}
            </button>
          </div>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      )}

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f2b5c] to-[#1e4ed8] px-6 py-6 text-white shadow-sm shadow-blue-900/10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-xl font-bold ring-2 ring-white/25">
                {initials}
              </div>
              <span className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-[#163a78] ${isActive ? "bg-emerald-400" : "bg-slate-300"}`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold leading-tight">
                {profile?.full_name || profile?.username || "Người dùng"}
              </h2>
              <p className="mt-0.5 text-sm text-blue-100">
                {roleText}
                <span className="mx-2 text-white/40">•</span>
                {profile?.username || "—"}
              </p>
              {isActive && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Tài khoản đã xác minh
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 border-t border-white/20 pt-3 text-right lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">
              Thành viên từ
            </p>
            <p className="mt-1 text-sm font-semibold">
              {formatMemberSince(profile?.created_at)}
            </p>
          </div>
        </div>
      </section>

      <div className="flex gap-6 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${
              tab === item.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <form id="user-profile-form" onSubmit={saveProfile} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-slate-800">Thông tin cơ bản</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Họ tên, số điện thoại và Zalo có thể chỉnh sửa. Email và tên đăng nhập do quản trị cấp.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Họ và tên</span>
                <input
                  value={form.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  readOnly={!editing}
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Địa chỉ email</span>
                <input value={profile?.email || ""} readOnly className={`${fieldClass} opacity-80`} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Số điện thoại</span>
                <input
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  readOnly={!editing}
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Link Zalo</span>
                <input
                  value={form.zalo_link}
                  onChange={(e) => handleChange("zalo_link", e.target.value)}
                  readOnly={!editing}
                  placeholder={editing ? "https://zalo.me/..." : "Chưa cập nhật"}
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Chức vụ</span>
                <input value={roleText} readOnly className={`${fieldClass} opacity-80`} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Tên đăng nhập</span>
                <input value={profile?.username || "—"} readOnly className={`${fieldClass} opacity-80`} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Địa chỉ làm việc</h3>
              <span className="rounded-lg p-1.5 text-slate-400" title="Địa chỉ theo trụ sở công ty">
                <MapPin className="h-4 w-4" />
              </span>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{COMPANY_HQ.name}</p>
                  {COMPANY_HQ.lines.map((line) => (
                    <p key={line} className="text-xs leading-5 text-slate-500">
                      {line}
                    </p>
                  ))}
                  <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                    Mặc định
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Đơn vị vận chuyển ưu tiên</p>
                  <p className="text-sm font-semibold text-slate-800">{PREFERRED_CARRIER}</p>
                </div>
              </div>
            </div>
          </section>
        </form>
      )}

      {tab === "security" && (
        <section className="max-w-xl rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Đặt lại mật khẩu</h3>
              <p className="text-sm text-slate-500">
                Nhập mật khẩu hiện tại, rồi đặt mật khẩu mới tối thiểu 8 ký tự.
              </p>
            </div>
          </div>

          <form onSubmit={resetPassword} className="space-y-4">
            {[
              { key: "currentPassword", show: "current", label: "Mật khẩu hiện tại" },
              { key: "newPassword", show: "next", label: "Mật khẩu mới" },
              { key: "confirmPassword", show: "confirm", label: "Nhập lại mật khẩu mới" },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">{field.label}</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPasswords[field.show] ? "text" : "password"}
                    value={passwordForm[field.key]}
                    onChange={(e) => {
                      setPasswordError("");
                      setPasswordForm((prev) => ({ ...prev, [field.key]: e.target.value }));
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords((prev) => ({ ...prev, [field.show]: !prev[field.show] }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswords[field.show] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            ))}

            {passwordError && (
              <p className="text-sm font-medium text-red-600">{passwordError}</p>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-60"
            >
              {savingPassword ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
