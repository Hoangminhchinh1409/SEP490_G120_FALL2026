import { useState } from 'react';
import { Modal, Radio, Select, Button, Alert, Tag, Input, message } from 'antd';
import { Truck, FileText, Box } from 'lucide-react';

const { Option } = Select;

const INTERNAL_TRUCKS = [
  { plate: '29H-995.72', model: 'Thaco Frontier 1.25T', payload_kg: 1400, volume_m3: 9.5, status: 'AVAILABLE', location: 'Nội Bài' },
  { plate: '29H-767.99', model: 'Thaco Ollin 2.5T', payload_kg: 2490, volume_m3: 14.2, status: 'AVAILABLE', location: 'Nội Bài' },
  { plate: '29C-882.11', model: 'Thaco Auman 4.0T', payload_kg: 4200, volume_m3: 21.0, status: 'AVAILABLE', location: 'Yên Phong' },
  { plate: '29H-123.45', model: 'Thaco Frontier 1.25T', payload_kg: 1400, volume_m3: 9.5, status: 'BUSY', location: 'Hải Phòng' },
];

const INTERNAL_DRIVERS = [
  { id: 'D1', name: 'Hồ Chí Học', phone: '008093002529', id_card: '0385722949', shift_hours: 4.5, ready: true },
  { id: 'D2', name: 'Tạ Đức Hải', phone: '0977887918', id_card: '01082051578', shift_hours: 2.0, ready: true },
  { id: 'D3', name: 'Nguyễn Văn Đạt', phone: '0912345678', id_card: '00109928172', shift_hours: 3.5, ready: true },
  { id: 'D4', name: 'Lê Hoàng Long', phone: '0988776655', id_card: '03108876543', shift_hours: 7.5, ready: false }
];

const APPROVED_VENDORS = [
  { id: 'V1', name: 'Công ty Cổ phần Vận tải Á Châu', status: 'APPROVED', rating: 4.8 },
  { id: 'V2', name: 'Logistics Hữu Nghị Toàn Cầu', status: 'APPROVED', rating: 4.9 },
  { id: 'V3', name: 'Công ty TNHH Vận tải Hoàng Hà Express', status: 'APPROVED', rating: 4.6 }
];

const TripAssignmentModal = ({ open, order, onCancel, onAssignSuccess }) => {
  const [allocationType, setAllocationType] = useState('INTERNAL');
  const [selectedTruck, setSelectedTruck] = useState('29H-995.72');
  const [selectedDriver1, setSelectedDriver1] = useState('D1');
  const [selectedDriver2, setSelectedDriver2] = useState('D2');
  const [isTwoDrivers, setIsTwoDrivers] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState('V1');
  const [vendorTrackingCode, setVendorTrackingCode] = useState('');
  const [showLoadPlan3D, setShowLoadPlan3D] = useState(false);

  if (!order) return null;

  const currentWeight = order.chargeable || order.weight || 2850;
  const tripEstimatedHours = 9.5;

  const handleConfirmAssignment = () => {
    if (allocationType === 'INTERNAL') {
      if (!selectedTruck || !selectedDriver1) {
        message.error('Vui lòng chọn xe và tài xế chính!');
        return;
      }
      const truckObj = INTERNAL_TRUCKS.find(t => t.plate === selectedTruck);
      if (truckObj && currentWeight > truckObj.payload_kg * 1.5) {
        message.warning('Cảnh báo quá tải trọng xe!');
      }
      onAssignSuccess({
        ...order,
        status: 'ASSIGNED',
        allocationType: 'INTERNAL',
        truck: selectedTruck,
        driver1: INTERNAL_DRIVERS.find(d => d.id === selectedDriver1)?.name,
        driver2: isTwoDrivers ? INTERNAL_DRIVERS.find(d => d.id === selectedDriver2)?.name : null,
        waybill_no: `WB-${Math.floor(100000 + Math.random() * 900000)}`,
        waybill_version: 1
      });
      message.success('Đã gán xe và phát lệnh điều xe thành công!');
    } else {
      if (!vendorTrackingCode.trim()) {
        message.error('Vui lòng nhập mã vận đơn của nhà xe đối tác!');
        return;
      }
      onAssignSuccess({
        ...order,
        status: 'HANDED_OVER_VENDOR',
        allocationType: 'VENDOR',
        vendor: APPROVED_VENDORS.find(v => v.id === selectedVendor)?.name,
        vendor_tracking_code: vendorTrackingCode
      });
      message.success('Đã bàn giao đơn hàng cho đối tác vận chuyển!');
    }
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Truck size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Gán xe & Điều phối chuyến</h3>
            <p className="text-xs text-gray-500 font-normal">Mã đơn: <b className="text-indigo-600 font-mono">{order.order_id}</b> | Khách hàng: {order.customer || order.customer_name}</p>
          </div>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={850}
      footer={[
        <Button key="back" onClick={onCancel}>Hủy</Button>,
        <Button 
          key="3d" 
          icon={<Box size={14} />} 
          className="border-indigo-400 text-indigo-600"
          onClick={() => setShowLoadPlan3D(!showLoadPlan3D)}
        >
          {showLoadPlan3D ? 'Ẩn mô hình xếp hàng' : 'Mô hình xếp hàng'}
        </Button>,
        <Button key="submit" type="primary" className="bg-[#7367f0] hover:bg-[#5e50ee]" onClick={handleConfirmAssignment}>
          Xác nhận gán chuyến
        </Button>
      ]}
    >
      <div className="py-2 space-y-4">
        {/* Lựa chọn Hình thức Gán */}
        <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase">Phương thức vận chuyển:</span>
          <Radio.Group value={allocationType} onChange={e => setAllocationType(e.target.value)}>
            <Radio.Button value="INTERNAL" className="font-semibold text-xs">
              Đội xe nội bộ
            </Radio.Button>
            <Radio.Button value="VENDOR" className="font-semibold text-xs">
              Nhà xe đối tác
            </Radio.Button>
          </Radio.Group>
        </div>

        {/* Trực quan hóa Mô hình Xếp hàng */}
        {showLoadPlan3D && (
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Box size={16} /> Mô phỏng thùng xe
              </span>
              <Tag color="cyan">Sắp xếp theo thứ tự dỡ</Tag>
            </div>
            
            <div className="h-32 border-2 border-dashed border-indigo-400/50 rounded-lg p-2 flex items-center justify-center bg-slate-800/80 relative overflow-hidden">
              <div className="absolute top-2 left-2 text-[10px] text-gray-400 font-mono">ĐẦU XE</div>
              <div className="absolute top-2 right-2 text-[10px] text-gray-400 font-mono">CỬA THÙNG</div>
              
              <div className="grid grid-cols-6 gap-2 w-full px-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gradient-to-t from-indigo-600 to-indigo-500 rounded border border-indigo-300 flex flex-col items-center justify-center text-center p-1">
                    <span className="text-[10px] font-bold">Pallet #{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-gray-300">
              <span>Thể tích sử dụng: <b>12.8 / 14.2 m³</b></span>
              <span>Xếp chồng: <b>Cho phép</b></span>
              <span>Dỡ hàng: <b>Cửa sau</b></span>
            </div>
          </div>
        )}

        {allocationType === 'INTERNAL' ? (
          <div className="space-y-4">
            <Alert
              type="warning"
              showIcon
              title={
                <span className="font-bold text-xs">
                  Thời gian chạy dự kiến {tripEstimatedHours} giờ — Đề xuất bố trí 2 tài xế luân chuyển
                </span>
              }
              className="text-xs"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Chọn Xe Nội Bộ */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <label className="text-xs font-bold text-gray-700 block">Chọn xe tải:</label>
                <Select className="w-full" value={selectedTruck} onChange={setSelectedTruck}>
                  {INTERNAL_TRUCKS.map(t => (
                    <Option key={t.plate} value={t.plate} disabled={t.status === 'BUSY'}>
                      <div className="flex justify-between items-center text-xs">
                        <b>{t.plate}</b> - Tải trọng {t.payload_kg} kg
                        <Tag color={t.status === 'AVAILABLE' ? 'green' : 'red'}>{t.status}</Tag>
                      </div>
                    </Option>
                  ))}
                </Select>
              </div>

              {/* Số lượng Tài xế */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700">Số lượng tài xế:</label>
                  <Radio.Group size="small" value={isTwoDrivers} onChange={e => setIsTwoDrivers(e.target.value)}>
                    <Radio.Button value={false}>1 Tài xế</Radio.Button>
                    <Radio.Button value={true}>2 Tài xế</Radio.Button>
                  </Radio.Group>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-gray-500 block mb-0.5">Tài xế chính:</span>
                    <Select className="w-full text-xs" value={selectedDriver1} onChange={setSelectedDriver1}>
                      {INTERNAL_DRIVERS.map(d => (
                        <Option key={d.id} value={d.id} disabled={!d.ready}>
                          {d.name} - {d.phone} (Đã lái {d.shift_hours}h)
                        </Option>
                      ))}
                    </Select>
                  </div>

                  {isTwoDrivers && (
                    <div>
                      <span className="text-[11px] text-gray-500 block mb-0.5">Tài xế phụ:</span>
                      <Select className="w-full text-xs" value={selectedDriver2} onChange={setSelectedDriver2}>
                        {INTERNAL_DRIVERS.filter(d => d.id !== selectedDriver1).map(d => (
                          <Option key={d.id} value={d.id} disabled={!d.ready}>
                            {d.name} - {d.phone} (Đã lái {d.shift_hours}h)
                          </Option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Giấy vận tải */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <div>
                  <span className="font-bold text-blue-900">Giấy vận tải điện tử:</span>
                  <div className="text-gray-500">Mã lệnh điều động được tự động sinh và gửi tới tài xế</div>
                </div>
              </div>
              <Tag color="processing" className="font-mono font-semibold">Tự động</Tag>
            </div>
          </div>
        ) : (
          /* Chuyển giao Vendor */
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Đối tác vận tải:</label>
                <Select className="w-full" value={selectedVendor} onChange={setSelectedVendor}>
                  {APPROVED_VENDORS.map(v => (
                    <Option key={v.id} value={v.id}>
                      {v.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Mã vận đơn đối tác:</label>
                <Input 
                  placeholder="Nhập mã vận đơn do đối tác cung cấp..." 
                  value={vendorTrackingCode}
                  onChange={e => setVendorTrackingCode(e.target.value)}
                  className="font-mono font-semibold"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TripAssignmentModal;