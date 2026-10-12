import { useState } from 'react';
import { Modal, Button, Input, Tag, Select, message } from 'antd';
import { AlertTriangle, ArrowUpRight, RotateCcw, Camera } from 'lucide-react';

const { Option } = Select;

const IncidentDetailsModal = ({ open, incident, onCancel, onResolveSuccess }) => {
  const [resolutionNote, setResolutionNote] = useState('');
  const [isDispatchReplacement, setIsDispatchReplacement] = useState(false);
  const [replacementTruck, setReplacementTruck] = useState('29H-767.99');
  const [replacementDriver, setReplacementDriver] = useState('Nguyễn Văn Đạt');
  const [replacementReason, setReplacementReason] = useState('Hỏng xe giữa đường (sự cố động cơ) cần chuyển tải gấp');

  if (!incident) return null;

  // Điều xe thay thế cấp cứu (UC-17 / BR-10 / BR-41)
  const handleDispatchReplacement = () => {
    if (!replacementReason.trim()) {
      message.error('Bắt buộc: Phải nhập lý do thay đổi xe/tài xế để lưu vào nhật ký vận hành!');
      return;
    }
    onResolveSuccess({
      ...incident,
      status: 'RESOLVED_REPLACED',
      new_truck: replacementTruck,
      new_driver: replacementDriver,
      replacement_reason: replacementReason,
      new_waybill_version: 2
    });
    message.success('Đã kích hoạt Điều xe Thay thế! Giấy vận tải cấp mới (Waybill Version + 1). Xe cũ chuyển sang trạng thái MAINTENANCE.');
    onCancel();
  };

  // Escalate sự cố lớn lên Manager (UC-18 / BR-16)
  const handleEscalateToManager = () => {
    onResolveSuccess({
      ...incident,
      status: 'ESCALATED_TO_MANAGER',
      escalated_at: new Date().toISOString()
    });
    message.warning('Đã chuyển tiếp sự cố lên Quản lý cấp cao (Manager) xử lý phương án đền bù / pháp lý!');
    onCancel();
  };

  // Đánh dấu đã giải quyết thông thường (UC-16)
  const handleMarkResolved = () => {
    if (!resolutionNote.trim()) {
      message.error('Vui lòng nhập ghi chú phương án xử lý!');
      return;
    }
    onResolveSuccess({
      ...incident,
      status: 'RESOLVED',
      resolution_note: resolutionNote
    });
    message.success('Đã đánh dấu xử lý xong sự cố hiện trường!');
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <div className="p-2 bg-red-50 text-red-600 rounded-lg">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Xử lý Sự cố Hiện trường (Incident Management)</h3>
            <p className="text-xs text-gray-500 font-normal">Mã sự cố: <b className="text-red-600 font-mono">{incident.id || 'INC-2026-091'}</b> | Chuyến xe: {incident.trip_code || 'TRIP-8821'}</p>
          </div>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={780}
      footer={[
        <Button key="back" onClick={onCancel}>Đóng</Button>,
        <Button 
          key="escalate" 
          danger 
          icon={<ArrowUpRight size={14} />}
          onClick={handleEscalateToManager}
        >
          Chuyển tiếp Lên Quản lý (Escalate Manager)
        </Button>,
        !isDispatchReplacement ? (
          <Button 
            key="replace" 
            type="primary" 
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => setIsDispatchReplacement(true)}
          >
            Điều Xe Thay Thế Cấp Cứu
          </Button>
        ) : (
          <Button 
            key="confirmReplace" 
            type="primary" 
            className="bg-red-600 hover:bg-red-700 font-bold"
            onClick={handleDispatchReplacement}
          >
            Phát Lệnh Điều Xe Mới (Waybill v+1)
          </Button>
        ),
        !isDispatchReplacement && (
          <Button key="resolve" type="primary" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleMarkResolved}>
            Đánh dấu Đã xử lý (Mark Resolved)
          </Button>
        )
      ]}
    >
      <div className="py-2 space-y-4">
        {/* Thông tin sự cố */}
        <div className="p-4 bg-red-50/60 rounded-xl border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Tag color="red" className="font-bold text-xs">{incident.type || 'HỎNG XE GIỮA ĐƯỜNG'}</Tag>
              <span className="text-xs font-semibold text-gray-700">Tài xế báo về từ PWA: <b>{incident.driver || 'Hồ Chí Học'}</b> ({incident.phone || '008093002529'})</span>
            </div>
            <span className="text-[11px] text-gray-400">15 phút trước</span>
          </div>
          <div className="text-xs text-red-900 font-medium">
            {incident.description || 'Xe 29H-995.72 bị xịt lốp & gãy trục thứ cấp trên cao tốc Nội Bài - Bắc Ninh (Km 18). Hàng gồm 18 Pallet ADTEK cần xe cứu hộ chuyển tải gấp để kịp giờ chuyến bay tại Nội Bài.'}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <Camera size={14} className="text-gray-400" />
            <span>Ảnh hiện trường đính kèm từ App tài xế: </span>
            <span className="font-semibold text-blue-600 underline cursor-pointer">Hien_Truong_Xe_99572.jpg</span>
          </div>
        </div>

        {/* Khung nhập phương án điều xe thay thế */}
        {isDispatchReplacement ? (
          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-300 space-y-3">
            <div className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5">
              <RotateCcw size={16} /> Quy trình Điều Xe Thay Thế Cấp Cứu:
            </div>
            <p className="text-xs text-amber-800">
              Hệ thống sẽ tự động hủy Giấy vận tải hiện tại, cấp Giấy vận tải phiên bản mới (Waybill Version + 1), chuyển xe hỏng về trạng thái Bảo trì (MAINTENANCE) và yêu cầu tài xế mới chụp ảnh niêm chì tại vị trí chuyển tải.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Xe Thay Thế Cấp Cứu (Depot gần nhất):</label>
                <Select className="w-full text-xs" value={replacementTruck} onChange={setReplacementTruck}>
                  <Option value="29H-767.99">29H-767.99 (Thaco 2.5T - Kho ALS Nội Bài)</Option>
                  <Option value="29C-882.11">29C-882.11 (Thaco 4.0T - Yên Phong)</Option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tài xế Cấp Cứu:</label>
                <Select className="w-full text-xs" value={replacementDriver} onChange={setReplacementDriver}>
                  <Option value="Nguyễn Văn Đạt">Nguyễn Văn Đạt (0912345678 - Ca rảnh)</Option>
                  <Option value="Lê Hoàng Long">Lê Hoàng Long (0988776655)</Option>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Lý do thay đổi xe (Bắt buộc ghi vào nhật ký):</label>
              <Input.TextArea 
                rows={2} 
                className="text-xs"
                value={replacementReason}
                onChange={e => setReplacementReason(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Phương án Xử lý Sự cố Hiện trường:</label>
            <Input.TextArea 
              rows={3} 
              placeholder="Nhập hướng dẫn cho tài xế hoặc phương án liên hệ bên nhận/đơn vị cứu hộ..."
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value)}
              className="text-xs"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default IncidentDetailsModal;
