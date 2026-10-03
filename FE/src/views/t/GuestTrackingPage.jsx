"use client";
import React, { useState, useEffect } from 'react';
import { Steps, Card, Upload, Button, Tag, Alert, Divider, Modal, message } from 'antd';
import { UploadOutlined, Phone, MessageCircle, FileText, Image as ImageIcon, MapPin, Package, Clock, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function GuestTrackingPage() {
  const params = useParams();
  const token = params.token;

  // Mock data based on Token
  const [order, setOrder] = useState(null);
  const [isPODOpen, setIsPODOpen] = useState(false);

  useEffect(() => {
    // Giả lập API trả về data dựa trên token
    const fetchOrder = async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setOrder({
        id: 'ALS260930-0001',
        customer: 'VinFast LLC',
        status: 2, // 0: Chờ chứng từ, 1: Lấy hàng, 2: Đang giao, 3: Đã giao
        pickup: 'Kho ALS Cảng Nội Bài, Sóc Sơn, Hà Nội',
        dropoff: 'Nhà máy VinFast, KCN Đình Vũ, Hải Phòng',
        eta: '2026-09-30 22:30:00',
        dispatcher: { name: 'Nguyễn Văn A (Dispatcher 01)', phone: '0901234567', zalo: 'https://zalo.me/0901234567' },
        isVendor: false,
        vendorName: '',
        vendorTracking: '',
        sealImage: 'https://images.unsplash.com/photo-1586528116311-ad8ed7c50a41?q=80&w=2070',
        podImage: 'https://images.unsplash.com/photo-1620023412351-96860000d6cb?q=80&w=2070'
      });
    };

    fetchOrder();
  }, [token]);

  if (!order) return <div className="p-10 text-center">Đang tải dữ liệu tra cứu...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0056a0] opacity-5 rounded-bl-full pointer-events-none"></div>
        <h1 className="text-2xl font-bold text-[#0056a0] mb-2 flex items-center gap-2">
          <Package className="text-[#e59f1f]" /> Chi tiết Đơn hàng: {order.id}
        </h1>
        <p className="text-gray-500 mb-6 flex items-center gap-2"><Clock size={16}/> Thời gian dự kiến đến (ETA): <strong className="text-green-600">{order.eta}</strong></p>

        <Steps
          current={order.status}
          items={[
            { title: 'Chờ chứng từ', description: 'Đã tạo đơn' },
            { title: 'Lấy hàng', description: order.pickup },
            { title: 'Đang giao', description: 'Đang di chuyển' },
            { title: 'Hoàn thành', description: order.dropoff },
          ]}
          className="mb-8"
        />

        {order.status === 0 && (
          <Alert
            message="Yêu cầu Chứng từ Hải quan"
            description={
              <div className="mt-2">
                <p className="mb-2 text-sm">Vui lòng tải lên Tờ khai hải quan và Giấy ủy quyền để ALS có thể tiến hành lấy hàng. (Tối đa 10MB/tệp)</p>
                <Upload action="/api/upload" multiple>
                  <Button icon={<UploadOutlined />}>Tải lên Chứng từ (PDF/JPG)</Button>
                </Upload>
                <p className="text-xs text-gray-400 mt-2">* Tệp sẽ tự động hủy sau 60 ngày theo Nghị định 13/2023/NĐ-CP.</p>
              </div>
            }
            type="warning"
            showIcon
            className="mb-6 rounded-xl"
          />
        )}

        {order.isVendor && (
          <Alert
            message="Chuyến đi được thực hiện bởi Đối tác (Vendor)"
            description={
              <div className="mt-1">
                <p>Đối tác: <strong>{order.vendorName}</strong></p>
                <p>Mã vận đơn đối tác: <strong>{order.vendorTracking}</strong></p>
              </div>
            }
            type="info"
            showIcon
            className="mb-6 rounded-xl"
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title={<span className="flex items-center gap-2"><ShieldCheck className="text-blue-600"/> Minh chứng Giao nhận (POD)</span>} className="shadow-sm rounded-xl">
          {!order.isVendor && order.status >= 1 ? (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-700 mb-2">Ảnh Niêm chì (Lấy hàng):</p>
                <img src={order.sealImage} alt="Seal Evidence" className="w-full h-40 object-cover rounded-lg border border-gray-200" />
              </div>
              {order.status === 3 ? (
                <div>
                  <p className="font-semibold text-gray-700 mb-2">Biên bản Bàn giao (POD):</p>
                  <Button type="primary" ghost icon={<ImageIcon size={16} />} onClick={() => setIsPODOpen(true)} className="w-full">Xem & Tải POD</Button>
                </div>
              ) : (
                <Alert title="POD sẽ hiển thị sau khi hoàn tất giao hàng." type="info" className="text-sm" />
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">Không có minh chứng cho đơn vị vận chuyển ngoài hoặc xe chưa lấy hàng.</p>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><Phone className="text-green-600"/> Hỗ trợ Khách hàng</span>} className="shadow-sm rounded-xl">
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 text-2xl font-bold">
              {order.dispatcher.name.charAt(0)}
            </div>
            <h3 className="font-bold text-lg">{order.dispatcher.name}</h3>
            <p className="text-gray-500 text-sm mb-4">Điều phối viên Phụ trách</p>
            
            <div className="w-full space-y-2">
              <Button type="primary" icon={<Phone size={16}/>} className="w-full bg-[#0056a0] hover:bg-blue-800" href={`tel:${order.dispatcher.phone}`}>
                Gọi Hotline: {order.dispatcher.phone}
              </Button>
              <Button icon={<MessageCircle size={16}/>} className="w-full border-blue-500 text-blue-600 hover:bg-blue-50" href={order.dispatcher.zalo} target="_blank">
                Chat qua Zalo
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal open={isPODOpen} footer={null} onCancel={() => setIsPODOpen(false)} width={600} title="Biên bản Bàn giao Hàng hóa (POD)">
        <img src={order.podImage} alt="POD" className="w-full rounded-lg mb-4" />
        <Button type="primary" icon={<UploadOutlined />} block onClick={() => message.success('Đang tải xuống...')}>Tải xuống PDF/JPG</Button>
      </Modal>
    </div>
  );
}
