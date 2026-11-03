import React from 'react';
import { Modal, Input } from 'antd';
import { AlertTriangle } from 'lucide-react';

const { TextArea } = Input;

export function RejectDocModal({
  open,
  onCancel,
  rejectingDocObj,
  rejectDocReason,
  setRejectDocReason,
  onConfirm,
  confirmLoading
}) {
  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-sm font-bold text-red-700">
          <AlertTriangle size={17} className="text-red-600" />
          Từ chối chứng từ &amp; Gửi Email yêu cầu khách tải lại
        </div>
      }
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      confirmLoading={confirmLoading}
      okText="Xác nhận Từ chối & Gửi Email"
      cancelText="Hủy"
      okButtonProps={{ danger: true, className: 'font-semibold' }}
      destroyOnHidden
      centered
    >
      <div className="py-2 space-y-3 text-xs">
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-900">
          Chứng từ từ chối: <b>{rejectingDocObj?.name || 'Chứng từ vận tải'}</b>
        </div>
        <div>
          <label className="font-semibold text-gray-700 block mb-1">
            Lý do từ chối / Hướng dẫn khách tải lại (*)
          </label>
          <TextArea
            rows={3}
            value={rejectDocReason}
            onChange={(e) => setRejectDocReason(e.target.value)}
            placeholder="Nhập lý do tại sao chứng từ này chưa đạt để gửi qua email cho khách hàng..."
            className="text-xs"
          />
        </div>
        <p className="text-[11px] text-gray-500 m-0">
          * Hệ thống sẽ chuyển mục này sang trạng thái <b>Cần upload lại</b> trên trang của khách hàng và tự động gửi Email thông báo kèm link tải lại.
        </p>
      </div>
    </Modal>
  );
}

