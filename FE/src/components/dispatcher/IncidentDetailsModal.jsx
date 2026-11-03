import { useState, useEffect } from 'react';
import { Modal, Button, Input, Tag, Select, message } from 'antd';
import { AlertTriangle, ArrowUpRight, RotateCcw, Camera, CheckCircle2 } from 'lucide-react';
import { dispatcherApi } from '../../api/dispatcherApi';

const { Option } = Select;

const IncidentDetailsModal = ({ open, incident, onCancel, onResolveSuccess }) => {
  const [resolutionNote, setResolutionNote] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [mode, setMode] = useState('RESOLVE'); // 'RESOLVE' | 'REPLACE' | 'ESCALATE'
  const [replacementTruck, setReplacementTruck] = useState('29H-767.99');
  const [replacementDriver, setReplacementDriver] = useState('Nguyễn Tấn Tài');
  const [replacementReason, setReplacementReason] = useState('Hỏng xe giữa đường cần chuyển tải gấp');
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !incident) return;
    setMode('RESOLVE');
    setResolutionNote(incident.resolution_note || '');
    setEscalationReason(incident.escalation_reason || 'Sự cố nghiêm trọng vượt thẩm quyền Điều phối viên, đề xuất Quản lý phê duyệt phương án xử lý / bồi thường.');

    let active = true;
    Promise.all([
      dispatcherApi.getTrucks().catch(() => []),
      dispatcherApi.getDrivers().catch(() => [])
    ]).then(([tList, dList]) => {
      if (!active) return;
      if (Array.isArray(tList) && tList.length > 0) {
        setTrucks(tList);
        const availTruck = tList.find(t => t.plate !== incident.truck && (t.status === 'AVAILABLE' || t.status === 'Available'));
        if (availTruck?.plate) setReplacementTruck(availTruck.plate);
      }
      if (Array.isArray(dList) && dList.length > 0) {
        setDrivers(dList);
        const availDriver = dList.find(d => d.name !== incident.driver);
        if (availDriver?.name) setReplacementDriver(availDriver.name);
      }
    });
    return () => { active = false; };
  }, [open, incident]);

  if (!open || !incident) return null;

  const isAlreadyResolved = incident.status === 'RESOLVED';

  const handleDispatchReplacement = async () => {
    if (!replacementReason.trim()) {
      message.error('Vui lòng nhập lý do thay đổi xe!');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        status: 'RESOLVED_REPLACED',
        new_truck: replacementTruck,
        new_driver: replacementDriver,
        replacement_reason: replacementReason.trim()
      };
      await onResolveSuccess?.(incident.raw_id || incident.id, payload);
      onCancel();
    } catch (err) {
      message.error(err.message || 'Lỗi khi phát lệnh điều xe thay thế');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalateToManager = async () => {
    if (!escalationReason.trim()) {
      message.error('Vui lòng nhập lý do chuyển tiếp lên Quản lý!');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        status: 'ESCALATED',
        escalation_reason: escalationReason.trim()
      };
      await onResolveSuccess?.(incident.raw_id || incident.id, payload);
      onCancel();
    } catch (err) {
      message.error(err.message || 'Lỗi khi chuyển tiếp sự cố lên Quản lý');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!resolutionNote.trim()) {
      message.error('Vui lòng nhập phương án xử lý!');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        status: 'RESOLVED',
        resolution_note: resolutionNote.trim()
      };
      await onResolveSuccess?.(incident.raw_id || incident.id, payload);
      onCancel();
    } catch (err) {
      message.error(err.message || 'Lỗi khi xác nhận xử lý sự cố');
    } finally {
      setSubmitting(false);
    }
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
            <p className="text-xs text-gray-500 font-normal">
              Mã sự cố: <b className="text-red-600 font-mono">{incident.id || 'INC-2026-091'}</b> | Chuyến xe: <b className="font-mono text-[#7367f0]">{incident.trip_code || 'TRIP-8821'}</b>
            </p>
          </div>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={780}
      footer={[
        <Button key="back" onClick={onCancel}>Đóng</Button>,
        !isAlreadyResolved && mode !== 'ESCALATE' && (
          <Button
            key="escalateMode"
            danger
            icon={<ArrowUpRight size={14} />}
            onClick={() => setMode('ESCALATE')}
          >
            Chuyển tiếp Quản lý (UC-16)
          </Button>
        ),
        !isAlreadyResolved && mode === 'ESCALATE' && (
          <Button
            key="confirmEscalate"
            type="primary"
            danger
            loading={submitting}
            icon={<ArrowUpRight size={14} />}
            onClick={handleEscalateToManager}
          >
            Xác nhận chuyển Quản lý
          </Button>
        ),
        !isAlreadyResolved && mode !== 'REPLACE' && (
          <Button
            key="replaceMode"
            type="primary"
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => setMode('REPLACE')}
          >
            Điều xe thay thế (UC-15)
          </Button>
        ),
        !isAlreadyResolved && mode === 'REPLACE' && (
          <Button
            key="confirmReplace"
            type="primary"
            loading={submitting}
            className="bg-red-600 hover:bg-red-700 font-bold"
            onClick={handleDispatchReplacement}
          >
            Phát lệnh điều xe mới &amp; Cấp lại Vận đơn V2
          </Button>
        ),
        !isAlreadyResolved && mode !== 'RESOLVE' && (
          <Button key="backResolve" onClick={() => setMode('RESOLVE')}>
            Xử lý tại chỗ
          </Button>
        ),
        !isAlreadyResolved && mode === 'RESOLVE' && (
          <Button
            key="resolve"
            type="primary"
            loading={submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleMarkResolved}
          >
            Xác nhận đã xử lý (UC-14)
          </Button>
        )
      ].filter(Boolean)}
    >
      <div className="py-2 space-y-4">
        {/* Thông tin sự cố */}
        <div className="p-4 bg-red-50/60 rounded-xl border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Tag color="red" className="font-bold text-xs">{incident.type || 'HỎNG XE'}</Tag>
              <span className="text-xs font-semibold text-gray-700">
                Xe: <b className="font-mono">{incident.truck}</b> · Tài xế: <b>{incident.driver || 'Nguyễn Văn Lái'}</b> - {incident.phone || '0901234567'}
              </span>
            </div>
            <span className="text-[11px] text-gray-400">Báo lúc: {incident.reported_at || '09:15'}</span>
          </div>
          <div className="text-xs text-red-900 font-medium">
            {incident.description || 'Xe gặp sự cố trên cao tốc Nội Bài - Bắc Ninh. Cần phương án điều phối gấp.'}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <Camera size={14} className="text-gray-400" />
            <span>Vị trí ghi nhận: <b>{incident.location || 'Km 18 cao tốc Nội Bài - Bắc Ninh'}</b></span>
          </div>
        </div>

        {isAlreadyResolved ? (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2 text-xs">
            <div className="font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Sự cố này đã được giải quyết hoàn tất
            </div>
            <div className="text-emerald-900">
              <b>Biên bản / Phương án xử lý:</b> {incident.resolution_note || 'Đã điều xe thay thế và cấp lại Vận đơn phiên bản mới.'}
            </div>
          </div>
        ) : mode === 'REPLACE' ? (
          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-300 space-y-3">
            <div className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5">
              <RotateCcw size={16} /> Phương án điều xe &amp; tài xế thay thế (UC-15, BR-09):
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Xe thay thế (Sẵn sàng):</label>
                <Select className="w-full text-xs" value={replacementTruck} onChange={setReplacementTruck}>
                  <Option value="29H-767.99">29H-767.99 (Xe tải 5T - Kho ALS Nội Bài)</Option>
                  <Option value="29C-456.78">29C-456.78 (Xe tải 2.5T - Sẵn sàng)</Option>
                  <Option value="29A-112.34">29A-112.34 (Xe tải 1.25T - Sẵn sàng)</Option>
                  {trucks
                    .filter(t => !['29H-767.99', '29C-456.78', '29A-112.34'].includes(t.plate))
                    .map(t => (
                      <Option key={t.id} value={t.plate}>
                        {t.plate} ({t.model} - {t.payload_kg} kg)
                      </Option>
                    ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tài xế thay thế:</label>
                <Select className="w-full text-xs" value={replacementDriver} onChange={setReplacementDriver}>
                  <Option value="Nguyễn Tấn Tài">Nguyễn Tấn Tài - 0912345678</Option>
                  <Option value="Đỗ Duy Hải">Đỗ Duy Hải - 0988776655</Option>
                  <Option value="Nguyễn Văn Lái">Nguyễn Văn Lái - 0901234567</Option>
                  {drivers
                    .filter(d => !['Nguyễn Tấn Tài', 'Đỗ Duy Hải', 'Nguyễn Văn Lái'].includes(d.name))
                    .map(d => (
                      <Option key={d.id} value={d.name}>
                        {d.name} - {d.phone}
                      </Option>
                    ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Lý do thay đổi xe / tài xế (Bắt buộc theo BR-09):</label>
              <Input.TextArea
                rows={2}
                className="text-xs"
                value={replacementReason}
                onChange={e => setReplacementReason(e.target.value)}
                placeholder="Nhập lý do điều xe cứu hộ chuyển tải..."
              />
            </div>
          </div>
        ) : mode === 'ESCALATE' ? (
          <div className="p-4 bg-red-50/50 rounded-xl border border-red-200 space-y-2">
            <label className="text-xs font-bold text-red-800 block">
              Lý do chuyển tiếp sự cố nghiêm trọng lên Quản lý (UC-16):
            </label>
            <Input.TextArea
              rows={3}
              placeholder="Mô tả mức độ thiệt hại / nguy cơ trễ toàn tuyến cần Quản lý phê duyệt..."
              value={escalationReason}
              onChange={e => setEscalationReason(e.target.value)}
              className="text-xs"
            />
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Phương án xử lý tại chỗ (UC-14):</label>
            <Input.TextArea
              rows={3}
              placeholder="Nhập hướng dẫn cho tài xế khắc phục sự cố hoặc phương án cứu hộ tại chỗ..."
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
