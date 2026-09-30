"use client";
import React, { useState, useEffect } from 'react';
import { Card, Tag, Button, Steps, Modal, Upload, Input, message, Badge } from 'antd';
import { MapPin, Camera, CheckCircle, AlertTriangle, CloudOff, Cloud, UploadOutlined } from 'lucide-react';

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
      // Thực tế sẽ trigger Service Worker Sync ở đây
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
    // Thực tế sẽ lưu DexieDB nếu offline, hoặc call API nếu online
    setActiveTrip({ ...trip, status: newStatus });
  };



  if (!activeTrip) return <div className="p-4 text-center">Chưa có chuyến xe nào được phân công.</div>;

  return (
    <div className="p-4 pb-20 max-w-lg mx-auto bg-gray-50 min-h-screen">
      
      {/* PWA Connection Status Bar */}
      <div className={`fixed top-0 left-0 w-full z-50 px-4 py-2 text-center text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 ${isOffline ? 'bg-red-500' : 'bg-green-500'}`}>
        {isOffline ? <><CloudOff size={14}/> ĐANG NGOẠI TUYẾN - CHẾ ĐỘ LƯU TẠM (OFFLINE FIRST)</> : <><Cloud size={14}/> KẾT NỐI ỔN ĐỊNH - ĐÃ ĐỒNG BỘ</>}
      </div>

      <div className="mt-8 mb-6">
        <h1 className="text-xl font-bold text-gray-800 flex justify-between items-center">
          Chuyến xe hiện tại
          <Tag color="processing" className="m-0">ĐANG CHẠY</Tag>
        </h1>
      </div>

      <Card className="shadow-md rounded-xl border-0 overflow-hidden mb-6" styles={{ body: { padding: '16px' } }}>
        <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Mã Chuyến</p>
            <h2 className="text-lg font-bold text-[#0056a0]">{activeTrip.id}</h2>
          </div>
          <Badge count={activeTrip.orders.length} style={{ backgroundColor: '#7367f0' }} showZero />
        </div>

        <div className="space-y-4 relative">
          <div className="absolute left-[11px] top-6 bottom-4 w-0.5 bg-gray-200 z-0"></div>
          
          <div className="flex gap-4 relative z-10">
            <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-500 flex-shrink-0 mt-0.5"></div>
            <div>
              <p className="text-xs text-gray-500 font-semibold">ĐIỂM LẤY HÀNG (PICKUP)</p>
              <p className="font-medium text-gray-800 leading-tight mt-1">{activeTrip.pickup}</p>
            </div>
          </div>
          
          <div className="flex gap-4 relative z-10 pt-2">
            <div className="w-6 h-6 rounded-full bg-orange-100 border-2 border-orange-500 flex-shrink-0 mt-0.5"></div>
            <div>
              <p className="text-xs text-gray-500 font-semibold">ĐIỂM GIAO HÀNG (DROPOFF)</p>
              <p className="font-medium text-gray-800 leading-tight mt-1">{activeTrip.dropoff}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card title={<span className="text-sm">Cập nhật Tiến độ (Multi-leg)</span>} className="shadow-md rounded-xl border-0 mb-6" size="small">
        <Steps
          orientation="vertical"
          size="small"
          current={activeTrip.status}
          items={[
            { title: 'Đã nhận chuyến' },
            { title: 'Đã đến kho bãi', description: activeTrip.status === 0 ? <Button size="small" type="primary" className="mt-2 bg-[#0056a0]" onClick={() => handleUpdateStatus(activeTrip, 1)}>Cập nhật</Button> : null },
            { 
              title: 'Đã bốc hàng (Niêm chì)', 
              description: activeTrip.status === 1 ? (
                <div className="mt-2 space-y-2">
                  <Button size="small" type="primary" className="bg-[#0056a0] w-full text-left" onClick={() => handleUpdateStatus(activeTrip, 2)}>Cập nhật Đã Bốc</Button>
                  <Button size="small" type="dashed" className="w-full text-left flex justify-between" onClick={() => setSealModalOpen(true)}>
                    <span>Chụp ảnh Niêm chì</span> <Camera size={14}/>
                  </Button>
                </div>
              ) : activeTrip.status > 1 ? <Tag color="success" className="mt-1"><CheckCircle size={12} className="inline mr-1"/> Đã chụp chì</Tag> : null
            },
            { title: 'Đang di chuyển', description: activeTrip.status === 2 ? <Button size="small" type="primary" className="mt-2 bg-[#0056a0]" onClick={() => handleUpdateStatus(activeTrip, 3)}>Cập nhật</Button> : null },
            { 
              title: 'Đã giao hàng (Hoàn thành)', 
              description: activeTrip.status === 3 ? (
                <div className="mt-2 space-y-2">
                  <Button size="small" type="primary" className="bg-green-600 w-full text-left" onClick={() => handleUpdateStatus(activeTrip, 4)}>Cập nhật Hoàn Thành</Button>
                  <Button size="small" type="dashed" className="w-full text-left flex justify-between" onClick={() => setPodModalOpen(true)}>
                    <span>Chụp POD (Có chữ ký)</span> <Camera size={14}/>
                  </Button>
                </div>
              ) : null
            },
          ]}
        />
      </Card>

      {/* Action Buttons for Mobile */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-3 pb-6 flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
        <Button href="/driver/incidents" danger icon={<AlertTriangle size={18}/>} size="large" className="flex-1 flex flex-col h-auto py-2 items-center justify-center text-xs font-semibold rounded-xl">
          Báo Sự cố
        </Button>
        <Button type="primary" className="flex-1 bg-[#0056a0] flex flex-col h-auto py-2 items-center justify-center text-xs font-semibold rounded-xl" size="large">
          <MapPin size={18}/>
          Dẫn đường
        </Button>
      </div>

      {/* Modals for Evidence */}
      <Modal open={sealModalOpen} onCancel={() => setSealModalOpen(false)} title="Chụp ảnh Niêm phong chì" okText="Lưu (Offline)" onOk={() => { message.success('Đã lưu ảnh niêm chì!'); setSealModalOpen(false); }}>
        <p className="mb-4 text-gray-600 text-sm">Bắt buộc chụp 01 ảnh rõ số chì niêm phong kèm biển số xe tải.</p>
        <Upload listType="picture-card" maxCount={1} action="/api/upload"><div className="text-gray-500"><Camera className="mx-auto mb-2"/>Chụp ảnh</div></Upload>
        <Input placeholder="Nhập số chì niêm phong" className="mt-4" />
      </Modal>

      <Modal open={podModalOpen} onCancel={() => setPodModalOpen(false)} title="Chụp ảnh Biên bản POD" okText="Lưu (Offline)" onOk={() => { message.success('Đã lưu POD!'); setPodModalOpen(false); }}>
        <p className="mb-4 text-gray-600 text-sm">Chụp ảnh Biên bản bàn giao đã có đầy đủ chữ ký xác nhận của khách hàng.</p>
        <Upload listType="picture-card" maxCount={2} action="/api/upload"><div className="text-gray-500"><Camera className="mx-auto mb-2"/>Chụp POD</div></Upload>
        <Input placeholder="Nhập tên người nhận hàng" className="mt-4" />
      </Modal>

    </div>
  );
}
