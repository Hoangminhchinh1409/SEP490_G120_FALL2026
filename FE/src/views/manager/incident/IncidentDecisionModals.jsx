"use client";
import React from 'react';
import { Modal, Input, Alert } from 'antd';

export default function IncidentDecisionModals({
  isRejectModalOpen,
  setIsRejectModalOpen,
  handleConfirmReject,
  submitting,
  rejectionClause,
  setRejectionClause,
  rejectionReason,
  setRejectionReason,
  contactHotline,
  setContactHotline,
  onPreviewRejectionEmail,
  isRequestInfoModalOpen,
  setIsRequestInfoModalOpen,
  handleConfirmRequestMoreInfo,
  requestInfoNote,
  setRequestInfoNote
}) {
  return (
    <>
      {/* MODAL 15: TỪ CHỐI BỒI THƯỜNG */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-error">
            <span className="material-symbols-outlined text-[22px]">gavel</span>
            <span className="font-bold text-sm">Xác nhận Từ chối Bồi thường (Close Case)</span>
          </div>
        }
        open={isRejectModalOpen}
        onCancel={() => setIsRejectModalOpen(false)}
        onOk={handleConfirmReject}
        confirmLoading={submitting}
        okText="Xác nhận Từ chối & Đóng hồ sơ"
        okButtonProps={{ danger: true, className: "font-bold text-xs h-10 px-5 rounded-xl shadow-xs" }}
        cancelButtonProps={{ className: "text-xs h-10 px-4 rounded-xl" }}
        width={580}
        centered
      >
        <div className="space-y-4 pt-2 text-xs">
          <Alert
            type="warning"
            showIcon
            title={<b className="text-xs">Lưu ý quyết định từ chối</b>}
            description="Quyết định từ chối bồi thường dựa trên căn cứ Hợp đồng sẽ tự động gửi email thông báo cho Khách hàng và chuyển sang trạng thái ĐÃ TỪ CHỐI (REJECTED) để Điều phối viên gọi điện thông báo trước khi đóng hồ sơ."
            className="rounded-xl p-3 border border-amber-200"
          />

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Điều khoản Hợp đồng miễn trừ trách nhiệm * :
            </label>
            <Input
              value={rejectionClause}
              onChange={(e) => setRejectionClause(e.target.value)}
              placeholder="VD: Điều 4.2 - Miễn trừ trách nhiệm đối với lỗi do khâu đóng gói của chủ hàng"
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Lý do từ chối chi tiết gửi khách hàng * :
            </label>
            <Input.TextArea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..."
              className="rounded-xl text-xs p-3 leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Hotline giải quyết khiếu nại * :
            </label>
            <Input
              value={contactHotline}
              onChange={(e) => setContactHotline(e.target.value)}
              className="h-10 rounded-xl text-xs font-mono font-bold"
            />
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={onPreviewRejectionEmail}
              className="h-8.5 px-3.5 rounded-xl bg-red-50 hover:bg-red-100 text-error font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer border border-red-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">mail</span>
              <span>Xem trước bản Email Từ chối sẽ gửi khách</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 16: YÊU CẦU BỔ SUNG HỒ SƠ */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-secondary">
            <span className="material-symbols-outlined text-[22px]">contact_support</span>
            <span className="font-bold text-sm">Yêu cầu Bổ sung Hồ sơ &amp; Minh chứng</span>
          </div>
        }
        open={isRequestInfoModalOpen}
        onCancel={() => setIsRequestInfoModalOpen(false)}
        onOk={handleConfirmRequestMoreInfo}
        confirmLoading={submitting}
        okText="Gửi yêu cầu bổ sung"
        okButtonProps={{ className: "bg-secondary text-white font-bold text-xs h-10 px-5 rounded-xl shadow-xs" }}
        cancelButtonProps={{ className: "text-xs h-10 px-4 rounded-xl" }}
        width={580}
        centered
      >
        <div className="space-y-4 pt-2 text-xs">
          <Alert
            type="info"
            showIcon
            title={<b className="text-xs">Chuyển trạng thái xử lý chờ thông tin</b>}
            description="Hệ thống sẽ giữ hồ sơ ở trạng thái Đang xử lý (IN_PROGRESS) và gửi thông báo cho Điều phối viên, Tài xế và Khách hàng yêu cầu nộp thêm tài liệu."
            className="rounded-xl p-3 border border-blue-200"
          />

          <div className="space-y-1.5">
            <label className="block font-bold text-primary text-xs">
              Nội dung hồ sơ / Minh chứng cần bổ sung * :
            </label>
            <Input.TextArea
              rows={4}
              value={requestInfoNote}
              onChange={(e) => setRequestInfoNote(e.target.value)}
              placeholder="Ví dụ: Cần bổ sung biên bản giám định của bên thứ ba độc lập và ảnh chụp lại tem seal chì cận cảnh..."
              className="rounded-xl text-xs p-3 leading-relaxed"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
