import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <header className="bg-white shadow-sm py-4 px-8 flex justify-between items-center sticky top-0 z-50">
      <Link to="/" className="flex flex-col items-start">
        <span className="font-black text-3xl text-[#0056a0] tracking-tighter leading-none">NEXLOG</span>
      </Link>
      <nav className="hidden md:flex gap-6 font-semibold text-gray-700 text-sm">
        <Link to="/" className="hover:text-[#0056a0] transition">Về NEXLOG</Link>
        <Link to="/" className="hover:text-[#0056a0] transition">Dịch vụ</Link>
        <Link to="/" className="hover:text-[#0056a0] transition">Khách hàng</Link>
        <Link to="/" className="hover:text-[#0056a0] transition">Tin tức</Link>
        <Link to="/" className="hover:text-[#0056a0] transition">Liên hệ</Link>
      </nav>
      <div className="hidden md:flex gap-4 items-center">
        <div className="flex flex-col text-right">
          <span className="text-xs text-gray-500">Hotline</span>
          <span className="text-[#0056a0] font-bold">1900 3133</span>
        </div>
        <button className="px-4 py-2 border border-[#f2a900] text-[#f2a900] rounded hover:bg-[#f2a900] hover:text-white transition font-medium">Nhận tư vấn</button>
        <Link to="/login" className="px-4 py-2 bg-[#0056a0] text-white rounded hover:bg-blue-800 transition font-medium flex items-center gap-2">
          Đăng nhập
        </Link>
      </div>
    </header>
  );
};

export default Header;
