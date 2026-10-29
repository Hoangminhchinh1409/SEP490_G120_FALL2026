import { useState } from 'react';
import { Modal, Button, Input, Tag, Select, message } from 'antd';
import { AlertTriangle, ArrowUpRight, RotateCcw, Camera } from 'lucide-react';

const { Option } = Select;

const IncidentDetailsModal = ({ open, incident, onCancel, onResolveSuccess }) => {
  const [resolutionNote, setResolutionNote] = useState('');
  const [isDispatchReplacement, setIsDispatchReplacement] = useState(false);
  const [replacementTruck, setReplacementTruck] = useState('29H-767.99');
  const [replacementDriver, setReplacementDriver] = useState('Nguyễn Văn Đạt');
  const [replacementReason, setReplacementReason] = useState('Hỏng xe giữa đường cần chuyển tải gấp');

  if (!open || !incident) return null;

  const handleDispatchReplacement = () => {
    if (!replacementReason.trim()) {
      message.error('Vui lòng nhập lý do thay đổi xe!');
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
    message.success('Đã điều xe thay thế thành công!');
    onCancel();
  };

  const handleEscalateToManager = () => {
    onResolveSuccess({
      ...incident,
      status: 'ESCALATED_TO_MANAGER',
      escalated_at: new Date().toISOString()
    });
    message.warning('Đã chuyển tiếp sự cố lên quản lý!');
    onCancel();
  };

  const handleMarkResolved = () => {
    if (!resolutionNote.trim()) {
      message.error('Vui lòng nhập phương án xử lý!');
      return;
    }
    onResolveSuccess({
      ...incident,
      status: 'RESOLVED',
      resolution_note: resolutionNote
    });
    message.success('Đã xử lý xong sự cố!');
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
            <h3 className="text-lg font-bold text-gray-800">Xử lý sự cố hiện trường</h3>
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
          Chuyển tiếp quản lý
        </Button>,
        !isDispatchReplacement ? (
          <Button 
            key="replace" 
            type="primary" 
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => setIsDispatchReplacement(true)}
          >
            Điều xe thay thế
          </Button>
        ) : (
          <Button 
            key="confirmReplace" 
            type="primary" 
            className="bg-red-600 hover:bg-red-700 font-bold"
            onClick={handleDispatchReplacement}
          >
            Phát lệnh điều xe mới
          </Button>
        ),
        !isDispatchReplacement && (
          <Button key="resolve" type="primary" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleMarkResolved}>
            Xác nhận đã xử lý
          </Button>
        )
      ]}
    >
      <div className="py-2 space-y-4">
        {/* Thông tin sự cố */}
        <div className="p-4 bg-red-50/60 rounded-xl border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Tag color="red" className="font-bold text-xs">{incident.type || 'HỎNG XE'}</Tag>
              <span className="text-xs font-semibold text-gray-700">Tài xế: <b>{incident.driver || 'Hồ Chí Học'}</b> - {incident.phone || '008093002529'}</span>
            </div>
            <span className="text-[11px] text-gray-400">15 phút trước</span>
          </div>
          <div className="text-xs text-red-900 font-medium">
            {incident.description || 'Xe 29H-995.72 gặp sự cố trên cao tốc Nội Bài - Bắc Ninh. Cần xe chuyển tải gấp.'}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <Camera size={14} className="text-gray-400" />
            <span>Ảnh hiện trường: </span>
            <span className="font-semibold text-blue-600 underline cursor-pointer">Hien_Truong_Xe_99572.jpg</span>
          </div>
        </div>

        {/* Khung nhập phương án điều xe thay thế */}
        {isDispatchReplacement ? (
          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-300 space-y-3">
            <div className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5">
              <RotateCcw size={16} /> Phương án điều xe thay thế:
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Xe thay thế:</label>
                <Select className="w-full text-xs" value={replacementTruck} onChange={setReplacementTruck}>
                  <Option value="29H-767.99">29H-767.99 (Thaco 2.5T - Kho ALS Nội Bài)</Option>
                  <Option value="29C-882.11">29C-882.11 (Thaco 4.0T - Yên Phong)</Option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tài xế thay thế:</label>
                <Select className="w-full text-xs" value={replacementDriver} onChange={setReplacementDriver}>
                  <Option value="Nguyễn Văn Đạt">Nguyễn Văn Đạt - 0912345678</Option>
                  <Option value="Lê Hoàng Long">Lê Hoàng Long - 0988776655</Option>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Lý do thay đổi xe:</label>
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
            <label className="text-xs font-bold text-gray-700 block mb-1">Phương án xử lý:</label>
            <Input.TextArea 
              rows={3} 
              placeholder="Nhập hướng dẫn cho tài xế hoặc phương án cứu hộ..."
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