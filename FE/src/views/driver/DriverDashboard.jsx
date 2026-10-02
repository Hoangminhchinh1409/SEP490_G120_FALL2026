"use client";
import React, { useState, useEffect } from 'react';
import { Card, Tag, Button, Steps, Modal, Upload, Input, message, Badge } from 'antd';
import { MapPin, Camera, CheckCircle, AlertTriangle, CloudOff, Cloud, UploadOutlined, Navigation, Package, Key, Navigation2, Truck } from 'lucide-react';

export default function DriverDashboard() {
  const [isOffline, setIsOffline] = useState(false);
  const trips = [
    { 
      id: 'TRIP-260930', 
      status: 1, // 0: Đã nhận, 1: Tới kho, 2: Đã bốc hàng, 3: Đang giao, 4: Hoàn thành
      pickup: 'Kho ALS Cảng Nội Bài', 
      dropoff: 'Nhà máy VinFast Hải Phòng',
      orders: ['NEX-827364', 'NEX-827365'],
      sealCaptured: false,
      podCaptured: false
    }
  ];

  const [activeTrip, setActiveTrip] = useState(trips.length > 0 ? trips[0] : null);
  const [sealModalOpen, setSealModalOpen] = useState(false);
  const [podModalOpen, setPodModalOpen] = useState(false);
  
  // Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      message.success('Đã khôi phục kết nối. Đang đồng bộ dữ liệu...');
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  const handleUpdateStatus = (trip, newStatus) => {
    message.success(isOffline ? 'Đã lưu Offline. Sẽ đồng bộ khi có mạng.' : 'Cập nhật trạng thái thành công!');
    setActiveTrip({ ...trip, status: newStatus });
  };



  if (!activeTrip) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-200 p-6">
      <Package className="w-16 h-16 text-slate-600 mb-4 opacity-50" />
      <p className="text-center font-medium">Chưa có chuyến xe nào được phân công.</p>
    </div>
  );

  return (
    <div className="bg-slate-900 min-h-screen font-sans text-slate-100 relative">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 rounded-b-[40px] opacity-80 pointer-events-none overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-40"></div>
        <div className="absolute top-20 left-[-50px] w-48 h-48 bg-indigo-500 rounded-full blur-[60px] opacity-40"></div>
      </div>
      
      {/* PWA Connection Status Bar */}
      <div className={`fixed top-0 left-0 w-full z-50 px-4 py-2 text-center text-xs font-bold text-white transition-all backdrop-blur-md border-b flex items-center justify-center gap-2 ${isOffline ? 'bg-red-500/80 border-red-500/50' : 'bg-emerald-500/80 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}>
        {isOffline ? <><CloudOff size={14}/> LƯU TẠM (OFFLINE FIRST)</> : <><Cloud size={14}/> KẾT NỐI ỔN ĐỊNH</>}
      </div>

      <div className="max-w-lg mx-auto pt-14 pb-28 px-4 relative z-10">
        
        {/* Header Section */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-md">NEXLOG Driver</h1>
            <p className="text-blue-200 text-sm font-medium">Xin chào, Nguyễn Văn A</p>
          </div>
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center shadow-lg">
            <Truck className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="mb-3 flex justify-between items-end">
          <h2 className="text-lg font-bold text-white tracking-wide">Chuyến xe hiện tại</h2>
          <div className="bg-blue-500/20 text-blue-200 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-inner">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
            ĐANG CHẠY
          </div>
        </div>

        {/* Trip Summary Card (Glassmorphism) */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-5 mb-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[40px]"></div>
          
          <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4 relative z-10">
            <div>
              <p className="text-[10px] text-blue-200/80 font-bold uppercase tracking-widest mb-1">Mã Chuyến</p>
              <h3 className="text-xl font-black text-white tracking-tight drop-shadow-sm">{activeTrip.id}</h3>
            </div>
            <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10 text-white font-semibold text-sm">
              <Package size={14} />
              <span>{activeTrip.orders.length} Đơn</span>
            </div>
          </div>

          <div className="space-y-5 relative z-10 pl-2">
            <div className="absolute left-[15px] top-6 bottom-4 w-0.5 bg-gradient-to-b from-blue-400 to-indigo-500 opacity-50 z-0"></div>
            
            <div className="flex gap-4 relative z-10">
              <div className="w-4 h-4 rounded-full bg-slate-900 border-[3px] border-blue-400 flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(96,165,250,0.6)]"></div>
              <div>
                <p className="text-[11px] text-blue-200/80 font-bold tracking-wide">ĐIỂM LẤY HÀNG</p>
                <p className="font-semibold text-white leading-tight mt-0.5 text-[15px]">{activeTrip.pickup}</p>
              </div>
            </div>
            
            <div className="flex gap-4 relative z-10 pt-1">
              <div className="w-4 h-4 rounded-full bg-slate-900 border-[3px] border-indigo-400 flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(129,140,248,0.6)]"></div>
              <div>
                <p className="text-[11px] text-blue-200/80 font-bold tracking-wide">ĐIỂM GIAO HÀNG</p>
                <p className="font-semibold text-white leading-tight mt-0.5 text-[15px]">{activeTrip.dropoff}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Steps Card */}
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-3xl p-5 mb-6 shadow-xl">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Navigation2 className="w-4 h-4 text-indigo-400" />
            Cập nhật Tiến độ
          </h3>
          
          <div className="driver-steps-override">
            <Steps
              orientation="vertical"
              size="small"
              current={activeTrip.status}
              className="!text-slate-200"
              items={[
                { title: <span className="text-slate-200 font-medium">Đã nhận chuyến</span> },
                { 
                  title: <span className="text-slate-200 font-medium">Đã đến kho bãi</span>, 
                  content: activeTrip.status === 0 ? <button className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95" onClick={() => handleUpdateStatus(activeTrip, 1)}>Cập nhật</button> : null 
                },
                { 
                  title: <span className="text-slate-200 font-medium">Đã bốc hàng (Niêm chì)</span>, 
                  content: activeTrip.status === 1 ? (
                    <div className="mt-3 space-y-2.5">
                      <button className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95" onClick={() => handleUpdateStatus(activeTrip, 2)}>Cập nhật Đã Bốc</button>
                      <button className="w-full py-2.5 border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex justify-center items-center gap-2 transition-all active:scale-95" onClick={() => setSealModalOpen(true)}>
                        <Camera size={16}/> Chụp ảnh Niêm chì
                      </button>
                    </div>
                  ) : activeTrip.status > 1 ? <div className="mt-1.5 flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 w-fit px-2 py-1 rounded-md border border-emerald-400/20"><CheckCircle size={14}/> Đã chụp chì</div> : null
                },
                { 
                  title: <span className="text-slate-200 font-medium">Đang di chuyển</span>, 
                  content: activeTrip.status === 2 ? <button className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95" onClick={() => handleUpdateStatus(activeTrip, 3)}>Cập nhật</button> : null 
                },
                { 
                  title: <span className="text-slate-200 font-medium">Đã giao hàng (Hoàn thành)</span>, 
                  content: activeTrip.status === 3 ? (
                    <div className="mt-3 space-y-2.5">
                      <button className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 transition-all active:scale-95" onClick={() => handleUpdateStatus(activeTrip, 4)}>Hoàn Thành Chuyến</button>
                      <button className="w-full py-2.5 border border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex justify-center items-center gap-2 transition-all active:scale-95" onClick={() => setPodModalOpen(true)}>
                        <Camera size={16}/> Chụp POD (Có chữ ký)
                      </button>
                    </div>
                  ) : null
                },
              ]}
            />
          </div>
        </div>

      </div>

      {/* Action Buttons for Mobile (Floating Bottom Bar) */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-800/90 backdrop-blur-xl border-t border-slate-700/50 p-4 pb-8 flex gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-40 rounded-t-3xl">
        <a href="/driver/incidents" className="flex-1 flex flex-col h-14 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 items-center justify-center text-red-400 font-bold rounded-2xl transition-colors active:scale-95">
          <AlertTriangle size={18} className="mb-0.5"/>
          <span className="text-[10px] tracking-wide uppercase">Báo Sự cố</span>
        </a>
        <button className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 flex flex-row gap-2 h-14 items-center justify-center text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all active:scale-95">
          <MapPin size={20}/>
          <span className="text-sm tracking-wide uppercase">Dẫn đường</span>
        </button>
      </div>

      {/* Modals for Evidence (Styled) */}
      <Modal 
        open={sealModalOpen} 
        onCancel={() => setSealModalOpen(false)} 
        title={<span className="font-bold">Chụp ảnh Niêm phong chì</span>} 
        okText="Lưu (Offline)"
        okButtonProps={{ className: 'bg-blue-600 font-bold' }}
        onOk={() => { message.success('Đã lưu ảnh niêm chì!'); setSealModalOpen(false); }}
      >
        <p className="mb-4 text-slate-500 text-sm">Bắt buộc chụp 01 ảnh rõ số chì niêm phong kèm biển số xe tải.</p>
        <Upload listType="picture-card" maxCount={1} action="/api/upload">
          <div className="text-slate-400 flex flex-col items-center"><Camera className="mb-2"/><span>Chụp ảnh</span></div>
        </Upload>
        <Input placeholder="Nhập số chì niêm phong" className="mt-4 py-2 rounded-lg" />
      </Modal>

      <Modal 
        open={podModalOpen} 
        onCancel={() => setPodModalOpen(false)} 
        title={<span className="font-bold">Chụp ảnh Biên bản POD</span>} 
        okText="Lưu (Offline)"
        okButtonProps={{ className: 'bg-emerald-600 font-bold' }}
        onOk={() => { message.success('Đã lưu POD!'); setPodModalOpen(false); }}
      >
        <p className="mb-4 text-slate-500 text-sm">Chụp ảnh Biên bản bàn giao đã có đầy đủ chữ ký xác nhận của khách hàng.</p>
        <Upload listType="picture-card" maxCount={2} action="/api/upload">
          <div className="text-slate-400 flex flex-col items-center"><Camera className="mb-2"/><span>Chụp POD</span></div>
        </Upload>
        <Input placeholder="Nhập tên người nhận hàng" className="mt-4 py-2 rounded-lg" />
      </Modal>
      
      {/* Global override for Steps component text color to fit dark mode */}
      <style dangerouslySetInnerHTML={{__html: `
        .driver-steps-override .ant-steps-item-title,
        .driver-steps-override .ant-steps-item-description {
          color: #cbd5e1 !important;
        }
        .driver-steps-override .ant-steps-item-wait .ant-steps-item-icon {
          background-color: #1e293b;
          border-color: #475569;
        }
        .driver-steps-override .ant-steps-item-wait .ant-steps-icon {
          color: #94a3b8;
        }
        .driver-steps-override .ant-steps-item-process .ant-steps-item-icon {
          background-color: #2563eb;
          border-color: #2563eb;
        }
      `}} />
    </div>
  );
}
