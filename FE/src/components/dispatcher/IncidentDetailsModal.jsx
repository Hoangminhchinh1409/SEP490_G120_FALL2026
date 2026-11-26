import { useState, useEffect } from 'react';
import { Modal, Button, Input, InputNumber, Tag, Select, Checkbox, Upload, Image, message } from 'antd';
import { AlertTriangle, ArrowUpRight, RotateCcw, Camera, CheckCircle2, FilePlus2, Upload as UploadIcon } from 'lucide-react';
import { dispatcherApi } from '../../api/dispatcherApi';
import { uploadApi } from '../../api/uploadApi';

const { Option } = Select;

const IncidentDetailsModal = ({ open, incident, onCancel, onResolveSuccess, onClaimCreated, isReadOnly = false }) => {
  const [resolutionNote, setResolutionNote] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [cargoAffectedOnEscalate, setCargoAffectedOnEscalate] = useState(false);
  const [mode, setMode] = useState('RESOLVE'); // 'RESOLVE' | 'REPLACE' | 'ESCALATE' | 'CREATE_CLAIM'
  const [replacementTruck, setReplacementTruck] = useState('');
  const [replacementDriver, setReplacementDriver] = useState('');
  const [replacementReason, setReplacementReason] = useState('Hỏng xe giữa đường cần chuyển tải gấp');
  const [claimOrderId, setClaimOrderId] = useState(null);
  const [claimType, setClaimType] = useState('Damage');
  const [claimAmount, setClaimAmount] = useState(0);
  const [claimReason, setClaimReason] = useState('');
  const [customerInformed, setCustomerInformed] = useState(false);
  const [claimFileList, setClaimFileList] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !incident) return undefined;

    let active = true;
    Promise.all([
      dispatcherApi.getTrucks().catch(() => []),
      dispatcherApi.getDrivers().catch(() => [])
    ]).then(([tList, dList]) => {
      if (!active) return;
      setMode('RESOLVE');
      setCargoAffectedOnEscalate(false);
      setResolutionNote(incident.resolution_note || '');
      setEscalationReason(incident.escalation_reason || 'Sự cố nghiêm trọng vượt thẩm quyền Điều phối viên, đề xuất Quản lý phê duyệt phương án xử lý / bồi thường.');
      const firstTripOrder = Array.isArray(incident.trip_orders) && incident.trip_orders.length > 0 ? incident.trip_orders[0] : null;
      setClaimOrderId(firstTripOrder ? firstTripOrder.id : null);
      setClaimType('Damage');
      setClaimAmount(0);
      setClaimReason(incident.description || '');
      setCustomerInformed(false);
      setClaimFileList([]);
      if (Array.isArray(tList)) {
        const availableTrucks = tList.filter(
          t => t.plate !== incident.truck && ['AVAILABLE', 'READY', 'IDLE'].includes(String(t.status || '').toUpperCase())
        );
        setTrucks(availableTrucks);
        setReplacementTruck(availableTrucks[0]?.plate || '');
      }
      if (Array.isArray(dList)) {
        const availableDrivers = dList.filter(
          d => d.name !== incident.driver && !['ON_TRIP', 'BUSY', 'INACTIVE', 'OFF_DUTY'].includes(String(d.status || '').toUpperCase())
        );
        setDrivers(availableDrivers);
        setReplacementDriver(availableDrivers[0]?.name || '');
      }
    });
    return () => { active = false; };
  }, [open, incident]);

  if (!open || !incident) return null;

  const isAlreadyResolved = incident.status === 'RESOLVED';
  const normalizedRawType = String(incident.raw_type || '').trim().toUpperCase().replace(/\s+/g, '_');
  const canEscalateToManager =
    incident.can_escalate_to_manager !== undefined
      ? Boolean(incident.can_escalate_to_manager)
      : [
          'DAMAGED_LOST_CARGO',
          'DAMAGED_CARGO',
          'CARGO_DAMAGED',
          'CARGO_LOST',
          'ACCIDENT',
          'TRAFFIC_ACCIDENT',
          'CARGO_HELD',
          'HELD_BY_AUTHORITIES',
          'SEIZED_BY_AUTHORITY'
        ].includes(normalizedRawType);

  const handleDispatchReplacement = async () => {
    if (!replacementTruck) {
      message.error('Không có xe sẵn sàng hoặc chưa chọn xe thay thế!');
      return;
    }
    if (!replacementDriver) {
      message.error('Không có tài xế sẵn sàng hoặc chưa chọn tài xế thay thế!');
      return;
    }
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
      if (cargoAffectedOnEscalate) {
        await dispatcherApi.updateIncidentStatus(incident.raw_id || incident.id, payload);
        message.success('Đã chuyển tiếp sự cố lên Quản lý. Tiếp tục thông báo khách hàng và tạo yêu cầu bồi thường.');
        await onClaimCreated?.();
        setMode('CREATE_CLAIM');
      } else {
        await onResolveSuccess?.(incident.raw_id || incident.id, payload);
        onCancel();
      }
    } catch (err) {
      message.error(err.message || 'Lỗi khi chuyển tiếp sự cố lên Quản lý');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateClaim = async () => {
    if (!claimOrderId) {
      message.error('Vui lòng chọn đơn hàng bị ảnh hưởng!');
      return;
    }
    if (!customerInformed) {
      message.warning('Vui lòng xác nhận đã thông báo tình hình sự cố cho khách hàng.');
      return;
    }
    if (!claimReason.trim()) {
      message.error('Vui lòng nhập mô tả thiệt hại / lý do tạo yêu cầu bồi thường!');
      return;
    }
    setSubmitting(true);
    try {
      const evidencePhotos = claimFileList
        .map((f) => f.url || f.response?.url)
        .filter(Boolean);
      const res = await dispatcherApi.createClaim({
        incident_id: incident.raw_id || incident.id,
        order_id: claimOrderId,
        claim_type: claimType,
        amount: Number(claimAmount || 0),
        reason: claimReason.trim(),
        evidence_photos: evidencePhotos
      });
      message.success(res?.message || 'Đã tạo yêu cầu bồi thường và gửi cảnh báo cho Quản lý!');
      await onClaimCreated?.();
      onCancel();
    } catch (err) {
      message.error(err.message || 'Lỗi khi tạo yêu cầu bồi thường');
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
      footer={isReadOnly ? [
        <Button key="back" type="primary" onClick={onCancel}>Đóng</Button>
      ] : [
        <Button key="back" onClick={onCancel}>Đóng</Button>,
        !isAlreadyResolved && canEscalateToManager && mode !== 'ESCALATE' && (
          <Button
            key="escalateMode"
            danger
            icon={<ArrowUpRight size={14} />}
            onClick={() => setMode('ESCALATE')}
          >
            Chuyển tiếp Quản lý
          </Button>
        ),
        !isAlreadyResolved && canEscalateToManager && mode === 'ESCALATE' && (
          <Button
            key="confirmEscalate"
            type="primary"
            danger
            loading={submitting}
            icon={<ArrowUpRight size={14} />}
            onClick={handleEscalateToManager}
          >
            {cargoAffectedOnEscalate ? 'Chuyển Quản lý & Tạo Claim' : 'Xác nhận chuyển Quản lý'}
          </Button>
        ),
        !isAlreadyResolved && canEscalateToManager && mode !== 'CREATE_CLAIM' && (
          <Button
            key="createClaimMode"
            icon={<FilePlus2 size={14} />}
            className="border-orange-500 text-orange-600 hover:bg-orange-50"
            onClick={() => setMode('CREATE_CLAIM')}
          >
            Hàng ảnh hưởng → Tạo Claim
          </Button>
        ),
        !isAlreadyResolved && canEscalateToManager && mode === 'CREATE_CLAIM' && (
          <Button
            key="confirmCreateClaim"
            type="primary"
            loading={submitting}
            className="bg-orange-600 hover:bg-orange-700 font-bold"
            icon={<FilePlus2 size={14} />}
            onClick={handleCreateClaim}
          >
            Tạo yêu cầu bồi thường (Pending)
          </Button>
        ),
        !isAlreadyResolved && mode !== 'REPLACE' && (
          <Button
            key="replaceMode"
            type="primary"
            className="bg-amber-600 hover:bg-amber-700"
            onClick={() => setMode('REPLACE')}
          >
            Điều xe thay thế
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
            Xác nhận đã xử lý
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
            <span>Vị trí ghi nhận: <b>{incident.location || 'Chưa ghi nhận vị trí'}</b></span>
          </div>
          {Array.isArray(incident.photos) && incident.photos.length > 0 && (
            <div className="mt-3 pt-3 border-t border-red-200/70">
              <div className="text-[11px] font-bold text-red-900 mb-1.5">
                Ảnh hiện trường tài xế gửi ({incident.photos.length}):
              </div>
              <Image.PreviewGroup>
                <div className="flex flex-wrap gap-2">
                  {incident.photos.map((photoUrl, idx) => (
                    <Image
                      key={idx}
                      src={photoUrl}
                      alt={`Ảnh hiện trường ${idx + 1}`}
                      width={72}
                      height={72}
                      className="rounded-lg object-cover border border-red-200"
                    />
                  ))}
                </div>
              </Image.PreviewGroup>
            </div>
          )}
          {Array.isArray(incident.claims) && incident.claims.length > 0 && (
            <div className="mt-3 pt-2 border-t border-red-200/70 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-bold text-red-900">Claim đã tạo:</span>
              {incident.claims.map((cl) => (
                <Tag key={cl.id} color="orange" className="font-mono font-bold m-0">
                  {cl.claim_code} ({cl.status})
                </Tag>
              ))}
            </div>
          )}
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
        ) : isReadOnly ? (
          <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 text-xs space-y-2">
            <div className="font-bold text-blue-900 flex items-center gap-1.5">
              <AlertTriangle size={15} className="text-blue-600" />
              Chi tiết sự cố hiện trường (Chế độ Chỉ xem)
            </div>
            <p className="text-blue-800">
              Chuyến xe đang chờ Điều phối viên phát lệnh điều xe cứu hộ hoặc xử lý tại hiện trường. Quản lý có quyền theo dõi chi tiết diễn biến sự cố.
            </p>
          </div>
        ) : mode === 'REPLACE' ? (
          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-300 space-y-3">
            <div className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5">
              <RotateCcw size={16} /> Phương án điều xe &amp; tài xế thay thế:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Xe thay thế (Sẵn sàng):</label>
                <Select
                  className="w-full text-xs"
                  value={replacementTruck || undefined}
                  onChange={setReplacementTruck}
                  placeholder={trucks.length === 0 ? 'Không có xe sẵn sàng' : 'Chọn xe thay thế'}
                >
                  {trucks.map(t => (
                    <Option key={t.id} value={t.plate}>
                      {t.plate} ({t.model || 'Xe tải'} - {t.payload_kg || 0} kg)
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Tài xế thay thế:</label>
                <Select
                  className="w-full text-xs"
                  value={replacementDriver || undefined}
                  onChange={setReplacementDriver}
                  placeholder={drivers.length === 0 ? 'Không có tài xế sẵn sàng' : 'Chọn tài xế thay thế'}
                >
                  {drivers.map(d => (
                    <Option key={d.id} value={d.name}>
                      {d.name}{d.phone ? ` - ${d.phone}` : ''}
                    </Option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Lý do thay đổi xe / tài xế:</label>
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
          <div className="p-4 bg-red-50/50 rounded-xl border border-red-200 space-y-3">
            <div>
              <label className="text-xs font-bold text-red-800 block mb-1">
                Lý do chuyển tiếp sự cố nghiêm trọng lên Quản lý:
              </label>
              <Input.TextArea
                rows={3}
                placeholder="Mô tả mức độ thiệt hại / nguy cơ trễ toàn tuyến cần Quản lý phê duyệt..."
                value={escalationReason}
                onChange={e => setEscalationReason(e.target.value)}
                className="text-xs"
              />
            </div>
            <Checkbox
              checked={cargoAffectedOnEscalate}
              onChange={(e) => setCargoAffectedOnEscalate(e.target.checked)}
              className="text-xs font-semibold text-red-900"
            >
              Hàng của khách hàng bị ảnh hưởng (chuyển tiếp xong sẽ mở form thông báo khách &amp; tạo Claim)
            </Checkbox>
          </div>
        ) : mode === 'CREATE_CLAIM' ? (
          <div className="p-4 bg-orange-50/60 rounded-xl border border-orange-200 space-y-3 text-xs">
            <div className="font-bold text-orange-900 uppercase flex items-center gap-1.5">
              <FilePlus2 size={15} /> Thông báo khách hàng &amp; Tạo Yêu cầu Bồi thường (BF-04)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Đơn hàng bị ảnh hưởng *</label>
                <Select
                  className="w-full"
                  placeholder="Chọn đơn hàng trên chuyến..."
                  value={claimOrderId}
                  onChange={setClaimOrderId}
                >
                  {(incident.trip_orders || []).map((ord) => (
                    <Option key={ord.id} value={ord.id}>
                      {ord.order_code} · {ord.customer_name}{ord.contact_phone ? ` (${ord.contact_phone})` : ''}
                    </Option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Loại thiệt hại *</label>
                <Select className="w-full" value={claimType} onChange={setClaimType}>
                  <Option value="Damage">Hư hỏng hàng hóa (Damage)</Option>
                  <Option value="Shortage">Thiếu hụt hàng hóa (Shortage)</Option>
                  <Option value="Loss">Thất lạc / Mất hàng (Loss)</Option>
                </Select>
              </div>
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Số tiền bồi thường ước tính (VNĐ)</label>
              <InputNumber
                className="w-full"
                min={0}
                step={100000}
                value={claimAmount}
                onChange={(v) => setClaimAmount(v ?? 0)}
                formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '')}
                parser={(v) => (v ? v.replace(/,/g, '') : '')}
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Mô tả thiệt hại &amp; Lý do tạo Claim *</label>
              <Input.TextArea
                rows={3}
                value={claimReason}
                onChange={(e) => setClaimReason(e.target.value)}
                placeholder="Ghi rõ tình trạng hàng hóa bị ảnh hưởng và nội dung đã trao đổi với khách hàng..."
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Ảnh bằng chứng đính kèm (Tối đa 5 ảnh)</label>
              <Upload
                listType="picture-card"
                maxCount={5}
                multiple
                accept="image/*"
                fileList={claimFileList}
                onChange={({ fileList }) => setClaimFileList(fileList)}
                customRequest={async ({ file, onSuccess, onError }) => {
                  try {
                    const uploaded = await uploadApi.uploadToCloudinary(file, 'nexlog/claims');
                    onSuccess?.({ url: uploaded.url });
                    message.success('Đã tải ảnh bằng chứng lên Cloudinary.');
                  } catch (err) {
                    message.error(err?.message || 'Lỗi tải ảnh lên Cloudinary');
                    onError?.(err);
                  }
                }}
              >
                <div className="flex flex-col items-center text-gray-500">
                  <UploadIcon size={16} />
                  <span className="text-[11px] mt-1">Tải ảnh</span>
                </div>
              </Upload>
            </div>
            <Checkbox
              checked={customerInformed}
              onChange={(e) => setCustomerInformed(e.target.checked)}
              className="text-xs font-semibold text-orange-950"
            >
              Đã thông báo sự cố ảnh hưởng hàng hóa cho khách hàng liên quan
            </Checkbox>
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Phương án xử lý tại chỗ:</label>
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
