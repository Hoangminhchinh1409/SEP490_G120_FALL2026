import { useState } from 'react';
import Header from '../../components/common/Header';
import { Search, Plane, FileText, CheckCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const HomePage = () => {
  const [activeTab, setActiveTab] = useState('waybill');
  const [trackingCode, setTrackingCode] = useState('');
  const [searchByHawb, setSearchByHawb] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (trackingCode) {
      // Navigate to tracking result page or show modal
      alert(`Đang tra cứu mã: ${trackingCode}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section with Tracking Form */}
        <section className="relative bg-[#0056a0] pt-10 pb-32 lg:pt-20 lg:pb-48 flex flex-col items-center">
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2074&auto=format&fit=crop" 
              alt="NEXLOG Aviation Logistics" 
              className="w-full h-full object-cover opacity-60 mix-blend-overlay"
            />
          </div>
          
          <div className="container mx-auto px-4 z-10 max-w-5xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-8 drop-shadow-lg">
              Smart Logistics Tracking and Dispatch System
            </h1>
            
            {/* Tracking Form Widget */}
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-4xl mx-auto transform translate-y-12 lg:translate-y-24">
              {/* Tabs */}
              <div className="flex bg-gray-100">
                <button 
                  onClick={() => setActiveTab('waybill')}
                  className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 transition ${activeTab === 'waybill' ? 'bg-[#0056a0] text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                  <Search size={18} /> Tra cứu vận đơn
                </button>
                <button 
                  onClick={() => setActiveTab('invoice')}
                  className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 transition ${activeTab === 'invoice' ? 'bg-[#0056a0] text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                  <FileText size={18} /> Tra cứu hóa đơn
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 md:p-8">
                {activeTab === 'waybill' && (
                  <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="w-full md:w-auto md:flex-1 relative">
                      <label className="sr-only">Mã vận đơn MAWB</label>
                      <input 
                        type="text" 
                        placeholder="Mã vận đơn MAWB" 
                        value={trackingCode}
                        onChange={(e) => setTrackingCode(e.target.value)}
                        className="w-full pl-4 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#0056a0] focus:ring-1 focus:ring-[#0056a0] transition"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        id="hawb-check" 
                        checked={searchByHawb}
                        onChange={(e) => setSearchByHawb(e.target.checked)}
                        className="rounded text-[#0056a0] focus:ring-[#0056a0] w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="hawb-check" className="cursor-pointer">Search by Hawb</label>
                    </div>

                    <div className="w-full md:w-auto relative">
                      <select className="w-full appearance-none pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#0056a0] focus:ring-1 focus:ring-[#0056a0] transition cursor-pointer">
                        <option value="nhap">Chọn Nhập</option>
                        <option value="xuat">Chọn Xuất</option>
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full md:w-auto bg-[#e59f1f] hover:bg-[#d48e10] text-white font-bold py-3 px-8 rounded-lg transition"
                    >
                      Tra cứu
                    </button>
                  </form>
                )}
                
                {activeTab !== 'waybill' && (
                  <div className="py-8 text-center text-gray-500">
                    Tính năng đang được cập nhật...
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section (Placeholder below hero) */}
        <section className="bg-white pt-32 pb-16 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-[#0056a0] mb-4">Dịch vụ Cốt lõi của NEXLOG</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">Hệ thống Điều phối Vận tải đường bộ hàng nặng qua 7 kho trung chuyển cốt lõi, cung cấp giải pháp tối ưu cho logistics.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: 'Vận tải Hàng nặng', desc: 'Chuyên chở hàng hóa từ 500kg đến 4.000kg an toàn, tối ưu chi phí.' },
                { title: '7 Kho Trung chuyển', desc: 'Mạng lưới 4 kho Sân bay Nội Bài và 3 kho cửa khẩu (Mỹ Đình, Gia Lâm, Bắc Ninh).' },
                { title: 'Điều phối Thông minh', desc: 'Ứng dụng công nghệ Offline-First cho tài xế và Web Tracking thời gian thực.' },
              ].map((item, idx) => (
                <div key={idx} className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:shadow-lg transition cursor-pointer group">
                  <div className="w-12 h-12 bg-blue-100 text-[#0056a0] rounded-full flex items-center justify-center mb-4 group-hover:bg-[#0056a0] group-hover:text-white transition">
                    <CheckCircle size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="bg-[#00386e] text-white py-16 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="md:w-1/2">
                <h2 className="text-2xl font-bold mb-2">Đăng ký nhận bản tin từ NEXLOG</h2>
                <p className="text-blue-200">Cập nhật những chính sách, thông tin mới nhất.</p>
              </div>
              <div className="md:w-1/2 w-full flex">
                <input 
                  type="email" 
                  placeholder="Nhập email của bạn vào đây..." 
                  className="flex-grow bg-blue-900 border border-blue-700 text-white placeholder-blue-300 px-4 py-3 rounded-l-lg outline-none focus:border-[#f2a900]"
                />
                <button className="bg-[#e59f1f] hover:bg-[#d48e10] text-white font-bold py-3 px-6 rounded-r-lg transition whitespace-nowrap">
                  Đăng ký
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 text-sm">
        <div className="container mx-auto max-w-5xl flex flex-col md:flex-row justify-between border-b border-gray-800 pb-8 mb-8">
          <div className="mb-8 md:mb-0 max-w-xs">
            <div className="flex flex-col items-start mb-4">
              <span className="font-black text-3xl text-white tracking-tighter leading-none">NEXLOG</span>
            </div>
            <p className="mb-2"><strong>CÔNG TY CỔ PHẦN LOGISTICS HÀNG KHÔNG</strong></p>
            <p className="mb-4">Tầng 4, Ga hàng hóa NEXLOG, Cảng HKQT Nội Bài, Sóc Sơn, Hà Nội</p>
            <p>Tổng đài hỗ trợ: <span className="text-white font-bold">1900 3133</span></p>
            <p>contact@nexlog.com.vn</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-white font-bold mb-4">Về NEXLOG</h4>
              <ul className="space-y-2">
                <li><Link to="#" className="hover:text-white transition">Giới thiệu chung</Link></li>
                <li><Link to="#" className="hover:text-white transition">Các công ty thành viên</Link></li>
                <li><Link to="#" className="hover:text-white transition">Chính sách bảo mật</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Dịch vụ</h4>
              <ul className="space-y-2">
                <li><Link to="#" className="hover:text-white transition">Vận tải đường bộ</Link></li>
                <li><Link to="#" className="hover:text-white transition">Kho trung chuyển</Link></li>
                <li><Link to="#" className="hover:text-white transition">Giải pháp Điều phối</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Hỗ trợ</h4>
              <ul className="space-y-2">
                <li><Link to="#" className="hover:text-white transition">Tra cứu</Link></li>
                <li><Link to="#" className="hover:text-white transition">Tư vấn giải pháp</Link></li>
                <li><Link to="#" className="hover:text-white transition">Liên hệ</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="container mx-auto max-w-5xl text-center md:text-left flex flex-col md:flex-row justify-between">
          <p>Copyright © NEXLOG 2026. All rights reserved.</p>
          <div className="mt-4 md:mt-0 space-x-4">
            <span>Kết nối với NEXLOG</span>
            <a href="#" className="inline-block hover:text-white">FB</a>
            <a href="#" className="inline-block hover:text-white">IN</a>
            <a href="#" className="inline-block hover:text-white">YT</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
