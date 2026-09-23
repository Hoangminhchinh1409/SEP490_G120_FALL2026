import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/common/Header';
import '../../style/AuthPages.css';

const LoginPage = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    identifier: '',
    password: '',
    rememberMe: true
  });
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
    
    // Giả lập API gọi đăng nhập
    setTimeout(() => {
      setSubmitting(false);
      // Chuyển hướng sau khi đăng nhập thành công
      // Nếu là Dispatcher -> /dispatcher
      if (form.identifier.includes('admin') || form.identifier.includes('dispatcher')) {
        navigate('/dispatcher', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }, 1000);
  };

  return (
    <>
      <Header />
      <div className="auth-shell auth-page auth-with-header login-page-shell">
        <div className="auth-layout auth-layout-login max-w-5xl mx-auto mt-10">
          <section
            className="auth-showcase login-hero relative overflow-hidden rounded-2xl"
            style={{ 
              backgroundColor: '#0056a0', 
              backgroundImage: 'linear-gradient(rgba(0, 86, 160, 0.7), rgba(0, 86, 160, 0.8)), url(https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=2070&auto=format&fit=crop)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="login-hero-top mb-10 z-10 relative text-white">
              <h2 className="font-black text-4xl tracking-tighter">NEXLOG</h2>
            </div>

            <div className="login-hero-copy z-10 relative text-white mt-10">
              <h1 className="text-3xl font-bold mb-2">Hệ thống Điều phối Vận tải</h1>
              <p className="login-hero-slogan text-gray-200">Smart Logistics Tracking and Dispatch System</p>
            </div>

            <ul className="auth-showcase-points login-benefits z-10 relative text-white mt-12 space-y-3">
              <li className="flex items-center gap-2"><span className="benefit-icon bg-green-500 rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span><span>Quản lý đơn hàng hiệu quả</span></li>
              <li className="flex items-center gap-2"><span className="benefit-icon bg-green-500 rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span><span>Theo dõi trạng thái theo thời gian thực</span></li>
              <li className="flex items-center gap-2"><span className="benefit-icon bg-green-500 rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span><span>Đồng bộ Offline-First cho tài xế</span></li>
            </ul>
            
            {/* Decorative background element */}
            <div className="absolute -bottom-20 -right-20 opacity-20 pointer-events-none">
              <svg width="300" height="300" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z" />
              </svg>
            </div>
          </section>

          <section className="auth-card auth-panel login-form-card p-8">
            <h2 className="auth-title font-bold text-2xl !text-[#0056a0]">Đăng nhập hệ thống</h2>
            <p className="auth-subtitle !text-[#0056a0] opacity-80 mb-8">Vui lòng đăng nhập để sử dụng các tính năng nội bộ.</p>

            <form className="auth-form space-y-5" onSubmit={handleSubmit}>
              <div className="auth-input-wrap">
                <label className="block text-sm font-semibold !text-[#0056a0] mb-1">Email / Tên đăng nhập</label>
                <div className="auth-input-icon-wrap flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus-within:border-[#0056a0] focus-within:ring-1 focus-within:ring-[#0056a0] transition">
                  <span className="auth-input-icon text-gray-400 mr-2">@</span>
                  <input
                    id="login-identifier"
                    type="text"
                    placeholder="Email hoặc Tên đăng nhập"
                    value={form.identifier}
                    onChange={(event) => applyFieldChange('identifier', event.target.value)}
                    autoComplete="username"
                    className="w-full bg-transparent outline-none text-gray-800"
                    required
                  />
                </div>
              </div>

              <div className="auth-input-wrap">
                <label className="block text-sm font-semibold !text-[#0056a0] mb-1">Mật khẩu</label>
                <div className="auth-input-icon-wrap flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus-within:border-[#0056a0] focus-within:ring-1 focus-within:ring-[#0056a0] transition">
                  <span className="auth-input-icon text-gray-400 mr-2">*</span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    value={form.password}
                    onChange={(event) => applyFieldChange('password', event.target.value)}
                    autoComplete="current-password"
                    className="w-full bg-transparent outline-none text-gray-800"
                    required
                  />
                  <button
                    type="button"
                    className="text-xs !bg-transparent !p-0 !min-h-0 !text-[#0056a0] font-bold hover:underline"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              <div className="auth-row-between flex justify-between items-center text-sm">
                <label className="flex items-center gap-2 cursor-pointer !text-[#0056a0] font-semibold">
                  <input
                    type="checkbox"
                    checked={form.rememberMe}
                    onChange={(event) => {
                      setForm({ ...form, rememberMe: event.target.checked });
                    }}
                    className="rounded text-[#0056a0] focus:ring-[#0056a0]"
                  />
                  <span className="whitespace-nowrap">Ghi nhớ tôi</span>
                </label>
                <Link to="#" className="text-[#0056a0] hover:underline font-semibold whitespace-nowrap">Quên mật khẩu?</Link>
              </div>

              {error && <div className="text-red-500 text-sm font-medium p-2 bg-red-50 rounded" role="alert">{error}</div>}

              <button 
                type="submit" 
                disabled={submitting} 
                className="w-full py-3 !bg-[#0056a0] text-white rounded-lg font-bold hover:!bg-blue-800 transition disabled:opacity-70 mt-4"
              >
                {submitting ? 'Đang xác thực...' : 'Đăng nhập'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
