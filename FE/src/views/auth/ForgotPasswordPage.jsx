"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Send } from "lucide-react";
import AuthSplitLayout from "../../components/auth/AuthSplitLayout";
import { API_ENDPOINTS } from "../../api/apiConfig";
import { fetchWithoutAuth } from "../../api/apiClient";

const MSG70 = "Nếu email có trong hệ thống, link đặt lại mật khẩu đã được gửi.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email không được để trống.");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError("Email không hợp lệ.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchWithoutAuth(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        method: "POST",
        body: JSON.stringify({ email: trimmed }),
      });
      setInfo(MSG70);
    } catch {
      setInfo(MSG70);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">Quên mật khẩu</h2>
        <p className="text-slate-500 text-lg">
          Nhập email tài khoản để nhận link đặt lại mật khẩu. Link có hiệu lực trong 30 phút và chỉ dùng một lần.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="forgot-email">
            Email
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
              <Mail className="w-5 h-5" />
            </div>
            <input
              id="forgot-email"
              type="email"
              placeholder="vd: nam.nguyen@nexlog.vn"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
                setInfo("");
              }}
              autoComplete="email"
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              required
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {info && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium">
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.25)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none text-base"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Gửi link đặt lại</span>
              <Send className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại đăng nhập
      </Link>
    </AuthSplitLayout>
  );
}
