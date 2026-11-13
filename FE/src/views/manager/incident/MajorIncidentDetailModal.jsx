"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Tag, Input, Radio, InputNumber, message, Spin, Image } from 'antd';
import { managerApi } from '../../../api/managerApi';

export default function MajorIncidentDetailModal({
  open,
  incident,
  onClose,
  onSuccess,
  isReadOnly = false
}) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  // Form decision state
  const [fault, setFault] = useState('COMPANY'); // 'COMPANY', 'CUSTOMER', 'THIRD_PARTY'
  const [resolutionNote, setResolutionNote] = useState('');
  const [compensationAmount, setCompensationAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Trip replay state
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayData, setReplayData] = useState(null);

  useEffect(() => {
    if (!open || !incident) {
      setDetail(null);
      return;
    }

    setFault('COMPANY');
    setResolutionNote(incident.resolution_note || '');
    setCompensationAmount(incident.claim_amount || 0);

    // Fetch full incident details if needed
    setLoading(true);
    managerApi.getIncidentById(incident.id || incident.raw_id)
      .then((res) => {
        setDetail(res || incident);
        if (res?.fault) setFault(res.fault);
        if (res?.resolution_note) setResolutionNote(res.resolution_note);
        if (res?.compensation_claims?.[0]?.amount) {
          setCompensationAmount(Number(res.compensation_claims[0].amount));
        }
      })
      .catch((err) => {
        console.warn('Lỗi lấy chi tiết sự cố, dùng data truyền vào:', err);
        setDetail(incident);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, incident]);

  const handleOpenTripReplay = async () => {
    const tripId = detail?.trip_id || incident?.trip_id;
    if (!tripId) {
      message.warning('Sự cố này không gắn với chuyến xe cụ thể.');
      return;
    }
    setIsReplayOpen(true);
    setReplayLoading(true);
    try {
      const data = await managerApi.getTripReplay(tripId);
      setReplayData(data);
    } catch (error) {
      console.error('Lỗi tải dữ liệu tua lại chuyến:', error);
      message.error('Không thể tải dữ liệu GPS tua lại chuyến.');
      setIsReplayOpen(false);
    } finally {
      setReplayLoading(false);
    }
  };

  const handleCloseIncident = async () => {
    if (!fault) {
      message.warning('Vui lòng chọn bên chịu trách nhiệm lỗi!');
      return;
    }
    if (!resolutionNote.trim()) {
      message.warning('Vui lòng nhập kết luận và phương án giải quyết (tối đa 500 ký tự)!');
      return;
    }

    try {
      setSubmitting(true);
      const incId = detail?.id || incident?.id || incident?.raw_id;
      const payload = {
        fault,
        resolution_note: resolutionNote.trim(),
        compensation_amount: Number(compensationAmount) || 0
      };

      const res = await managerApi.closeIncident(incId, payload);
      message.success(res?.message || 'Đã đóng và giải quyết sự cố lớn thành công!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Lỗi khi đóng sự cố:', error);
      message.error(error.message || 'Lỗi khi đóng sự cố');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !incident) return null;

  const currentData = detail || incident;
  const isResolved = currentData.status === 'RESOLVED' || currentData.raw_status === 'RESOLVED';
  const tripCode = currentData.trip_code || (currentData.trip_id ? `TRIP-${currentData.trip_id}` : 'Chưa có');
  const orderCode = currentData.order_code || currentData.order?.order_code || 'Chưa gắn đơn';
  const photos = currentData.photos || [];

  return (
    <>
      <Modal
        title={
          <div className="flex items-center justify-between pb-3 border-b border-surface-container pr-6">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-error text-[24px]">warning</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-primary tracking-tight font-mono">
                    {currentData.code || `INC-${currentData.id}`}
                  </h3>
                  <Tag color={isResolved ? 'green' : 'orange'} className="font-bold text-xs uppercase px-2 py-0.5 rounded-full">
                    {isResolved ? 'Đã xử lý' : 'Chờ Quản lý xử lý'}
                  </Tag>
                  {currentData.is_major && (
                    <Tag color="red" className="font-bold text-xs uppercase px-2 py-0.5 rounded-full">
                      Sự cố lớn (BR-16)
                    </Tag>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant font-normal mt-0.5">
                  Loại: <b className="text-primary">{currentData.type_display || currentData.type}</b> · Báo lúc: {currentData.reported_time ? new Date(currentData.reported_time).toLocaleString('vi-VN') : 'N/A'}
                </p>
              </div>
            </div>

            {/* Nút Xem lại chuyến (Replay) */}
            <button
              type="button"
              onClick={handleOpenTripReplay}
              className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-secondary text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border border-surface-container shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">play_circle</span>
              <span>Xem lại chuyến (Replay)</span>
            </button>
          </div>
        }
        open={open}
        onCancel={onClose}
        footer={null}
        width={820}
        centered
        className="major-incident-detail-modal"
      >
        {loading ? (
          <div className="py-12 flex justify-center"><Spin /></div>
        ) : (
          <div className="space-y-4 pt-3 text-xs">
            {/* Box 1: Thông tin vận hành (Chuyến xe, xe tải, tài xế, đơn hàng) */}
            <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-on-surface-variant text-[11px] block">Mã chuyến xe:</span>
                <strong className="font-mono text-primary text-xs font-bold">{tripCode}</strong>
              </div>
              <div>
                <span className="text-on-surface-variant text-[11px] block">Xe vận chuyển:</span>
                <strong className="font-mono text-primary text-xs font-bold">{currentData.truck_plate || '29C-246.80'}</strong>
              </div>
              <div>
                <span className="text-on-surface-variant text-[11px] block">Tài xế hiện trường:</span>
                <strong className="text-primary text-xs font-bold">
                  {currentData.driver_name || currentData.reporter_name || 'Tài xế'}
                </strong>
                <span className="text-[10px] text-outline block">{currentData.driver_phone || '0901234567'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant text-[11px] block">Đơn hàng bị ảnh hưởng:</span>
                <strong className="font-mono text-primary text-xs font-bold">{orderCode}</strong>
              </div>
            </div>

            {/* Box 2: Mô tả của tài xế & Bằng chứng ảnh Cloudinary */}
            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container space-y-3">
              <div>
                <span className="font-bold text-primary uppercase text-[11px] flex items-center gap-1 mb-1">
                  <span className="material-symbols-outlined text-[15px] text-secondary">campaign</span>
                  Mô tả sự cố từ tài xế hiện trường:
                </span>
                <p className="p-3 bg-surface-container-low/70 rounded-xl text-primary font-medium text-xs border border-surface-container leading-relaxed">
                  "{currentData.description || 'Không có mô tả chi tiết từ tài xế.'}"
                </p>
              </div>

              <div>
                <span className="font-bold text-primary uppercase text-[11px] flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-[15px] text-secondary">photo_library</span>
                  Ảnh hiện trường ({photos.length} ảnh):
                </span>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    <Image.PreviewGroup>
                      {photos.map((url, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden border border-surface-container h-24 bg-surface-container-low shadow-2xs">
                          <Image
                            src={url}
                            alt={`Ảnh hiện trường ${idx + 1}`}
                            className="w-full h-full object-cover cursor-pointer"
                          />
                        </div>
                      ))}
                    </Image.PreviewGroup>
                  </div>
                ) : (
                  <div className="p-3 bg-surface-container-low/40 rounded-xl text-center text-on-surface-variant text-[11px] border border-dashed border-surface-container">
                    Chưa có hình ảnh hiện trường được gửi kèm.
                  </div>
                )}
              </div>
            </div>

            {/* Box 3: Báo cáo & Lý do chuyển tiếp từ Điều phối viên */}
            <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 uppercase text-[11px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600 text-[16px]">forward</span>
                  Lý do Điều phối viên chuyển lên Quản lý (Escalated):
                </span>
                {currentData.escalated_time && (
                  <span className="text-[10px] text-amber-700/80 font-mono">
                    Lúc: {new Date(currentData.escalated_time).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>
              <p className="p-3 bg-white/80 rounded-xl text-amber-950 font-medium text-xs border border-amber-200/50 leading-relaxed">
                {currentData.escalation_reason || 'Sự cố thuộc danh mục nghiêm trọng (BR-16), cần Quản lý xác minh lỗi và duyệt hướng xử lý.'}
              </p>
            </div>

            {/* Box 4: Quyết định của Quản lý (Screen 14 Action Section) */}
            <div className="p-5 bg-surface-container-low rounded-2xl border border-surface-container space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                <h4 className="font-bold text-primary uppercase text-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-[18px]">gavel</span>
                  Quyết định của Quản lý (UC-25)
                </h4>
                {isResolved && (
                  <Tag color="green" className="font-bold text-xs">
                    Sự cố đã được giải quyết
                  </Tag>
                )}
              </div>

              {!isResolved ? (
                isReadOnly ? (
                  <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                      <span className="material-symbols-outlined text-blue-600 text-[18px]">info</span>
                      <span>Chế độ Xem thông tin (Read-only)</span>
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      Sự cố này đang ở trạng thái <b>Chờ Quản lý xử lý</b>. Tài khoản Điều phối viên được cấp quyền xem chéo chỉ có quyền theo dõi chi tiết hiện trường và lịch sử sự cố, không có thẩm quyền ban hành phán quyết.
                    </p>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold cursor-pointer hover:bg-blue-700 transition-colors text-xs"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chọn bên có lỗi */}
                    <div>
                      <label className="block font-bold text-primary text-xs mb-1.5">
                        Trách nhiệm lỗi thuộc về * :
                      </label>
                      <Radio.Group
                        value={fault}
                        onChange={(e) => setFault(e.target.value)}
                        className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2"
                      >
                        <Radio.Button value="COMPANY" className="text-center font-bold h-9 flex items-center justify-center rounded-xl">
                          Công ty / Đội xe (ALS)
                        </Radio.Button>
                        <Radio.Button value="CUSTOMER" className="text-center font-bold h-9 flex items-center justify-center rounded-xl">
                          Khách hàng
                        </Radio.Button>
                        <Radio.Button value="THIRD_PARTY" className="text-center font-bold h-9 flex items-center justify-center rounded-xl">
                          Bên thứ ba / Khách quan
                        </Radio.Button>
                      </Radio.Group>
                    </div>

                    {/* Kết luận & Phương án xử lý */}
                    <div>
                      <label className="block font-bold text-primary text-xs mb-1">
                        Kết luận &amp; Phương án giải quyết * (Tối đa 500 ký tự):
                      </label>
                      <Input.TextArea
                        rows={3}
                        maxLength={500}
                        showCount
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="Ghi nhận phương án xử lý (ví dụ: Miễn phí chuyến, thay xe giao trễ 1h, bồi thường thiệt hại hàng hóa...)"
                        className="rounded-xl text-xs"
                      />
                    </div>

                    {/* Tùy chọn sinh yêu cầu bồi thường nếu có thiệt hại */}
                    <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-primary text-xs block">Thiệt hại hàng hóa &amp; Bồi thường:</span>
                        <span className="text-[11px] text-on-surface-variant">
                          Nhập số tiền (&gt; 0) sẽ tự động tạo Yêu cầu bồi thường (Claim) ở trạng thái Chờ duyệt.
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <InputNumber
                          min={0}
                          step={100000}
                          value={compensationAmount}
                          onChange={(val) => setCompensationAmount(val || 0)}
                          formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                          parser={(val) => val.replace(/\./g, '')}
                          className="w-36 font-mono font-bold"
                          addonAfter="đ"
                        />
                      </div>
                    </div>

                    {/* Nút bấm Đóng sự cố */}
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl bg-surface-container text-primary font-bold hover:bg-surface-container-high transition-colors cursor-pointer text-xs"
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseIncident}
                        disabled={submitting}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer transition-colors shadow-sm inline-flex items-center gap-1.5 text-xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">task_alt</span>
                        <span>{submitting ? 'Đang xử lý...' : 'Đóng sự cố & Phán quyết'}</span>
                      </button>
                    </div>
                  </>
                )
              ) : (
                /* Đã xử lý (Read-only view) */
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-surface-container-lowest rounded-xl border border-surface-container">
                    <div>
                      <span className="text-on-surface-variant block text-[11px]">Trách nhiệm lỗi:</span>
                      <strong className={`font-bold text-xs ${currentData.fault === 'COMPANY' ? 'text-error' : 'text-primary'}`}>
                        {currentData.fault === 'COMPANY' ? 'Lỗi Công ty / Đội xe' : currentData.fault === 'CUSTOMER' ? 'Lỗi Khách hàng' : 'Bên thứ ba / Khách quan'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[11px]">Thời gian đóng sự cố:</span>
                      <strong className="text-primary text-xs font-mono">
                        {currentData.resolved_time ? new Date(currentData.resolved_time).toLocaleString('vi-VN') : 'N/A'}
                      </strong>
                    </div>
                  </div>

                  <div>
                    <span className="text-on-surface-variant block text-[11px] mb-1">Kết luận giải quyết:</span>
                    <p className="p-3 bg-surface-container-lowest rounded-xl text-primary font-medium text-xs border border-surface-container">
                      {currentData.resolution_note || 'Quản lý đã thẩm định và đóng sự cố.'}
                    </p>
                  </div>

                  {currentData.claim_amount > 0 && (
                    <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container flex items-center justify-between">
                      <span className="text-on-surface-variant text-[11px]">Yêu cầu bồi thường liên quan:</span>
                      <span className="font-mono font-bold text-error text-xs">
                        {Number(currentData.claim_amount).toLocaleString('vi-VN')} đ ({currentData.claim_status || 'Chờ duyệt'})
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2 rounded-xl bg-surface-container text-primary font-bold cursor-pointer hover:bg-surface-container-high transition-colors text-xs"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL TUA LẠI HÀNH TRÌNH GPS (TRIP REPLAY) */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">play_circle</span>
            <span className="font-bold text-base text-primary">
              Tua lại hành trình GPS – {tripCode}
            </span>
          </div>
        }
        open={isReplayOpen}
        onCancel={() => setIsReplayOpen(false)}
        footer={null}
        width={720}
        centered
      >
        {replayLoading ? (
          <div className="py-12 flex justify-center"><Spin /></div>
        ) : (
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-4 bg-surface-container-low rounded-xl text-on-surface-variant flex items-center justify-between">
              <div>
                <p className="font-bold text-primary">Mô phỏng lộ trình xe chạy qua định vị GPS hộp đen</p>
                <p className="text-[11px] text-outline mt-0.5">
                  Xác minh lộ trình, vận tốc và thời điểm xe dừng đỗ khi xảy ra sự cố.
                </p>
              </div>
              <Tag color="blue" className="font-bold font-mono">{tripCode}</Tag>
            </div>

            <div className="h-64 bg-surface-container rounded-2xl flex items-center justify-center text-on-surface-variant border border-surface-container-high">
              <div className="text-center space-y-1">
                <span className="material-symbols-outlined text-4xl text-secondary mb-1">map</span>
                <p className="font-bold text-primary text-xs">Bản đồ lộ trình GPS xe tại hiện trường</p>
                <p className="text-[11px] text-outline">
                  Tọa độ phát sinh sự cố: <b>{currentData.location || 'Km 12 QL18, Bắc Ninh'}</b>
                </p>
                <p className="text-[10px] text-secondary font-mono">
                  {replayData?.actual_distance ? `Quãng đường thực tế: ${replayData.actual_distance} km` : 'Dữ liệu GPS đã được đồng bộ với trạm giám sát.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

