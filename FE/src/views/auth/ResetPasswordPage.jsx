"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import AuthSplitLayout from "../../components/auth/AuthSplitLayout";
import { API_ENDPOINTS } from "../../api/apiConfig";
import { fetchWithoutAuth } from "../../api/apiClient";

const MSG04 = "Mật khẩu mới không hợp lệ.";
const MSG59 = "Mật khẩu mới phải có ít nhất 8 ký tự và khác mật khẩu cũ.";
const MSG61 = "Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);

  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({ next: false, confirm: false });
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const applyChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setFieldError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldError("");

    if (!token) {
      setError(MSG61);
      return;
    }
    if (!form.newPassword || form.newPassword.length < 8) {
      setFieldError(MSG59);
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setFieldError(MSG04);
      return;
    }

    setSubmitting(true);
    try {
      await fetchWithoutAuth(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
        method: "POST",
        body: JSON.stringify({
          token,
          newPassword: form.newPassword,
        }),
      });
      router.replace("/login?reset=1");
    } catch (err) {
      const apiMessage = err.message || "";
      if (apiMessage.toLowerCase().includes("invalid") || apiMessage.toLowerCase().includes("expired")) {
        setError(MSG61);
      } else {
        setError(MSG61);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">Đặt mật khẩu mới</h2>
        <p className="text-slate-500 text-lg">
          Nhập mật khẩu mới hai lần. Sau khi lưu, bạn sẽ đăng nhập lại bằng mật khẩu này.
        </p>
      </div>

      {!token && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium">
          {MSG61}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        {[
          { key: "newPassword", show: "next", label: "Mật khẩu mới", placeholder: "Tối thiểu 8 ký tự" },
          { key: "confirmPassword", show: "confirm", label: "Nhập lại mật khẩu mới", placeholder: "Nhập lại mật khẩu mới" },
        ].map((field) => (
          <div key={field.key} className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700" htmlFor={`reset-${field.key}`}>
              {field.label}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id={`reset-${field.key}`}
                type={showPassword[field.show] ? "text" : "password"}
                placeholder={field.placeholder}
                value={form[field.key]}
                onChange={(event) => applyChange(field.key, event.target.value)}
                autoComplete="new-password"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-12 pr-12 py-3.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                onClick={() =>
                  setShowPassword((prev) => ({ ...prev, [field.show]: !prev[field.show] }))
                }
              >
                {showPassword[field.show] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        ))}

        {fieldError && (
          <p className="text-sm font-medium text-red-600">{fieldError}</p>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !token}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.25)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none text-base"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Đặt mật khẩu</span>
              <ShieldCheck className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 flex flex-col gap-2 text-sm font-semibold">
        <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700">
          Yêu cầu link mới
        </Link>
        <Link href="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Quay lại đăng nhập
        </Link>
      </div>
    </AuthSplitLayout>
  );
}
