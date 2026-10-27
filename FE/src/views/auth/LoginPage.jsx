"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';

const LoginPage = () => {
  const [form, setForm] = useState({
    identifier: '',
    password: '',
    rememberMe: true
  });
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetDone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('reset') === '1';
  });

  const applyFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.identifier || !form.password) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }

    setSubmitting(true);

    try {
      await login(form.identifier, form.password);
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại.');
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout>
              <div className="mb-10">
                <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">Chào mừng trở lại</h2>
                <p className="text-slate-500 text-lg">Đăng nhập vào hệ thống để tiếp tục công việc của bạn.</p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="login-identifier">
                    Email / Tên đăng nhập
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      id="login-identifier"
                      type="text"
                      placeholder="Nhập email hoặc username"
                      value={form.identifier}
                      onChange={(event) => applyFieldChange('identifier', event.target.value)}
                      autoComplete="username"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="login-password">
                    Mật khẩu
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Nhập mật khẩu"
                      value={form.password}
                      onChange={(event) => applyFieldChange('password', event.target.value)}
                      autoComplete="current-password"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-12 pr-12 py-3.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer text-slate-600 hover:text-slate-800 transition-colors group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={form.rememberMe}
                        onChange={(event) => setForm({ ...form, rememberMe: event.target.checked })}
                        className="peer appearance-none w-5 h-5 border border-slate-300 rounded bg-white checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all cursor-pointer"
                      />
                      <CheckCircle2 className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth={3} />
                    </div>
                    <span className="font-medium select-none">Ghi nhớ đăng nhập</span>
                  </label>
                  <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors hover:underline underline-offset-4">
                    Quên mật khẩu?
                  </Link>
                </div>

                {resetDone && !error && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium">
                    Đã đặt mật khẩu mới. Vui lòng đăng nhập lại.
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                    <span className="block mt-0.5 text-red-500">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.25)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none mt-4 text-base"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Đăng nhập hệ thống</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
    </AuthSplitLayout>
  );
};

export default LoginPage;
