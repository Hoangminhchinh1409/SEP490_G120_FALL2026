"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import Header from '../../components/common/Header';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowRight, Truck } from 'lucide-react';

const LoginPage = () => {
  const navigate = useRouter();

  const [form, setForm] = useState({
    identifier: '',
    password: '',
    rememberMe: true
  });
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-400/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-5xl bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col md:flex-row relative z-10">

          {/* Left Side: Branding & Info */}
          <div
            className="md:w-5/12 p-10 flex flex-col justify-between relative overflow-hidden hidden md:flex"
            style={{
              backgroundImage: 'url("https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2070&auto=format&fit=crop")',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Overlay Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 to-blue-900/60 z-0"></div>
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay z-0"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-12">
                <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm shadow-lg border border-white/30">
                  <Truck className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-black text-3xl tracking-tight text-white drop-shadow-sm">NEXLOG</h2>
              </div>

              <h1 className="text-4xl font-bold mb-4 text-white leading-tight drop-shadow-sm">
                Hệ thống Điều phối Vận tải Thông minh
              </h1>
              <p className="text-blue-100 text-lg mb-12 font-medium">
                Smart Logistics Tracking and Dispatch System
              </p>

              <ul className="space-y-5">
                {[
                  'Quản lý đơn hàng hiệu quả & tối ưu',
                  'Theo dõi trạng thái theo thời gian thực',
                  'Đồng bộ Offline-First cho tài xế'
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3.5 text-blue-50">
                    <div className="bg-blue-400/30 p-1 rounded-full border border-blue-400/50">
                      <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                    </div>
                    <span className="font-medium text-white">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative z-10 text-sm text-blue-200/80 font-semibold tracking-wide">
              © {new Date().getFullYear()} NEXLOG SYSTEM.
            </div>
          </div>

          {/* Right Side: Login Form */}
          <div className="w-full md:w-7/12 p-8 sm:p-12 md:p-16 flex flex-col justify-center bg-white">
            <div className="max-w-md w-full mx-auto">
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
                  <Link href="#" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors hover:underline underline-offset-4">
                    Quên mật khẩu?
                  </Link>
                </div>

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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
