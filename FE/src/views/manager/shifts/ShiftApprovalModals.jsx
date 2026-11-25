"use client";
import React from "react";
import {
  Form,
  DatePicker,
  TimePicker,
  Input,
  Button,
  Tag,
  Modal,
  Popconfirm,
  Select
} from "antd";
import {
  Calendar as CalendarIcon,
  Clock,
  Check,
  X,
  Edit3,
  Trash2
} from "lucide-react";
import dayjs from "dayjs";

export default function ShiftApprovalModals({
  isReadOnly,
  drivers,
  leaveDecisionModal,
  setLeaveDecisionModal,
  submittingLeaveDecision,
  onConfirmLeaveDecision,
  isShiftModalOpen,
  setIsShiftModalOpen,
  editingShift,
  shiftForm,
  submittingShift,
  onSaveShift,
  onApplyShiftTemplate,
  detailModal,
  setDetailModal,
  onApproveShift,
  onOpenRejectModal,
  onOpenEditShift,
  onDeleteShift,
  rejectModal,
  setRejectModal,
  submittingReject,
  onConfirmReject
}) {
  return (
    <>
      {/* MODAL XỬ LÝ ĐƠN BÁO NGHỈ ĐỘT XUẤT */}
      <Modal
        centered
        open={leaveDecisionModal.open}
        onCancel={() => setLeaveDecisionModal({ open: false, request: null, decision: "APPROVED", comment: "" })}
        onOk={onConfirmLeaveDecision}
        confirmLoading={submittingLeaveDecision}
        okText={leaveDecisionModal.decision === "APPROVED" ? "Xác nhận duyệt cho nghỉ" : "Xác nhận từ chối"}
        okButtonProps={{
          danger: leaveDecisionModal.decision === "REJECTED",
          className: leaveDecisionModal.decision === "APPROVED" ? "bg-emerald-600 font-bold" : "font-bold",
        }}
        cancelText="Quay lại"
        title={
          <span className="font-bold text-sm">
            {leaveDecisionModal.decision === "APPROVED"
              ? "Duyệt đơn báo nghỉ đột xuất"
              : "Từ chối đơn báo nghỉ đột xuất"}
          </span>
        }
      >
        {leaveDecisionModal.request && (
          <div className="space-y-3 text-xs pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div>
                <span className="text-slate-500">Tài xế:</span>{" "}
                <strong className="text-slate-800">{leaveDecisionModal.request.driver_name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Ngày nghỉ:</span>{" "}
                <strong className="font-mono text-slate-800">
                  {(leaveDecisionModal.request.leave_dates || [])
                    .map((d) => dayjs(d).format("DD/MM/YYYY"))
                    .join(", ")}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Lý do tài xế gửi:</span>{" "}
                <span className="text-slate-700">{leaveDecisionModal.request.reason}</span>
              </div>
              {(leaveDecisionModal.request.affected_trips || []).length > 0 && (
                <div className="pt-1 text-amber-700 font-semibold">
                  ⚠️ Có {leaveDecisionModal.request.affected_trips.length} chuyến xe bị ảnh hưởng (
                  {leaveDecisionModal.request.affected_trips.map((t) => t.trip_code).join(", ")}) sẽ tự động chuyển cho Điều phối viên đổi tài xế khác!
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-xs mb-1">
                {leaveDecisionModal.decision === "APPROVED"
                  ? "Ghi chú phản hồi (tùy chọn):"
                  : "Lý do từ chối (*):"}
              </label>
              <Input.TextArea
                rows={3}
                value={leaveDecisionModal.comment}
                onChange={(e) => setLeaveDecisionModal((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder={
                  leaveDecisionModal.decision === "APPROVED"
                    ? "Nhập ghi chú gửi tài xế & điều phối viên..."
                    : "Nhập lý do từ chối để tài xế nắm rõ..."
                }
              />
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 1: XẾP CA MỚI / CHỈNH SỬA CA LÀM VIỆC */}
      <Modal
        forceRender
        title={
          <div className="flex items-center gap-2 text-primary font-black text-base">
            <CalendarIcon size={20} className="text-primary" />
            <span>{editingShift ? "Chỉnh sửa ca làm việc" : "Xếp ca làm việc mới cho tài xế"}</span>
          </div>
        }
        open={!isReadOnly && isShiftModalOpen}
        onCancel={() => setIsShiftModalOpen(false)}
        footer={null}
        destroyOnHidden
        className="rounded-3xl"
      >
        <Form
          form={shiftForm}
          layout="vertical"
          onFinish={onSaveShift}
          className="mt-4 space-y-3"
        >
          <Form.Item
            name="driver_id"
            label={<span className="font-bold text-xs">Tài xế nhận ca (*)</span>}
            rules={[{ required: true, message: "Vui lòng chọn tài xế" }]}
          >
            <Select
              placeholder="Chọn tài xế"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={drivers.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.license_class || "C"}) - ${d.phone || ""}`
              }))}
              className="w-full rounded-xl"
            />
          </Form.Item>

          <Form.Item
            name="date"
            label={<span className="font-bold text-xs">Ngày làm việc (*)</span>}
            rules={[{ required: true, message: "Vui lòng chọn ngày" }]}
          >
            <DatePicker className="w-full py-1.5 rounded-xl" format="DD/MM/YYYY" />
          </Form.Item>

          {/* Khung giờ & Templates */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-xs">Khung giờ ca trực (*)</span>
              <span className="text-[11px] text-on-surface-variant font-medium">Mẫu ca nhanh:</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2.5">
              <button
                type="button"
                onClick={() => onApplyShiftTemplate(6, 0, 14, 0)}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                Sáng (06:00 - 14:00)
              </button>
              <button
                type="button"
                onClick={() => onApplyShiftTemplate(14, 0, 22, 0)}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                Chiều (14:00 - 22:00)
              </button>
              <button
                type="button"
                onClick={() => onApplyShiftTemplate(8, 0, 17, 0)}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                Hành chính (08:00 - 17:00)
              </button>
              <button
                type="button"
                onClick={() => onApplyShiftTemplate(17, 0, 8, 0)}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                Ca Đêm (17:00 - 08:00)
              </button>
            </div>

            <Form.Item
              name="time_range"
              noStyle
              rules={[{ required: true, message: "Vui lòng chọn giờ bắt đầu và kết thúc" }]}
            >
              <TimePicker.RangePicker
                order={false}
                format="HH:mm"
                minuteStep={15}
                className="w-full py-1.5 rounded-xl font-mono"
                placeholder={["Giờ bắt đầu", "Giờ kết thúc"]}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="note"
            label={<span className="font-bold text-xs">Ghi chú ca trực</span>}
          >
            <Input.TextArea
              rows={2}
              maxLength={200}
              placeholder="Ghi chú phân công tuyến hoặc lưu ý an toàn..."
              className="rounded-xl"
            />
          </Form.Item>

          {/* Cảnh báo */}
          <div className="p-3 bg-amber-500/10 border border-amber-300 rounded-xl text-amber-900 text-xs">
            ⚠️ <strong>Quy chuẩn an toàn:</strong> Ca trực do Quản lý tạo sẽ tự động được phê duyệt (`Approved`). Hệ thống sẽ tự động chặn việc tạo 2 ca chồng lấn thời gian của cùng một tài xế. Ca dài quá 10 giờ sẽ kích hoạt cảnh báo an toàn.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container">
            <Button onClick={() => setIsShiftModalOpen(false)} className="rounded-xl">
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submittingShift}
              className="bg-primary hover:bg-primary/90 font-bold rounded-xl"
            >
              {editingShift ? "Lưu thay đổi" : "Lưu ca làm việc"}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL 2: CHI TIẾT & THAO TÁC CA LÀM VIỆC */}
      <Modal
        forceRender
        title={
          <div className="flex items-center gap-2 text-primary font-black text-base">
            <Clock size={20} className="text-primary" />
            <span>Chi tiết ca làm việc #{detailModal.shift?.id}</span>
          </div>
        }
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, shift: null })}
        footer={null}
        className="rounded-3xl"
      >
        {detailModal.shift && (
          <div className="space-y-4 text-xs mt-3">
            <div className="p-4 bg-surface-container-low rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Tài xế:</span>
                <span className="font-black text-primary text-sm">
                  {detailModal.shift.driver_name} (Hạng {detailModal.shift.license_class})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Ngày làm việc:</span>
                <span className="font-mono font-bold">
                  {dayjs(detailModal.shift.date).format("dddd, DD/MM/YYYY")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Khung giờ ca:</span>
                <span className="font-mono font-black text-primary text-sm">
                  {dayjs(detailModal.shift.start_time).format("HH:mm")} – {dayjs(detailModal.shift.end_time).format("HH:mm")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Thời lượng:</span>
                <span className="font-mono font-bold">
                  {detailModal.shift.duration_hours} giờ
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Trạng thái:</span>
                <div>
                  {detailModal.shift.status === "Approved" && (
                    <Tag color="success" className="font-bold">Đã phê duyệt</Tag>
                  )}
                  {detailModal.shift.status === "Requested" && (
                    <Tag color="warning" className="font-bold">Chờ duyệt ⏳</Tag>
                  )}
                  {detailModal.shift.status === "Rejected" && (
                    <Tag color="error" className="font-bold">Đã từ chối</Tag>
                  )}
                </div>
              </div>

              {detailModal.shift.note && (
                <div className="pt-2 border-t border-surface-container/60">
                  <span className="text-on-surface-variant block mb-1">Ghi chú:</span>
                  <div className="italic text-on-surface bg-surface-container-lowest p-2 rounded-lg">
                    &ldquo;{detailModal.shift.note}&rdquo;
                  </div>
                </div>
              )}

              {detailModal.shift.rejection_reason && (
                <div className="pt-2 border-t border-surface-container/60">
                  <span className="text-error block mb-1 font-bold">Lý do từ chối:</span>
                  <div className="italic text-error bg-error/10 p-2 rounded-lg">
                    &ldquo;{detailModal.shift.rejection_reason}&rdquo;
                  </div>
                </div>
              )}
            </div>

            {/* Các hành động thao tác */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-surface-container">
              {!isReadOnly && detailModal.shift.status === "Requested" && (
                <>
                  <Button
                    type="primary"
                    icon={<Check size={14} />}
                    onClick={() => onApproveShift(detailModal.shift)}
                    className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl"
                  >
                    Duyệt ca
                  </Button>
                  <Button
                    danger
                    icon={<X size={14} />}
                    onClick={() => onOpenRejectModal(detailModal.shift)}
                    className="font-bold rounded-xl"
                  >
                    Từ chối
                  </Button>
                </>
              )}

              {!isReadOnly && (
                <>
                  <Button
                    icon={<Edit3 size={14} />}
                    onClick={() => onOpenEditShift(detailModal.shift)}
                    className="font-medium rounded-xl"
                  >
                    Chỉnh sửa
                  </Button>

                  <Popconfirm
                    title="Xóa ca làm việc này?"
                    description="Bạn có chắc chắn muốn xóa ca làm việc này không?"
                    onConfirm={() => onDeleteShift(detailModal.shift.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<Trash2 size={14} />} className="rounded-xl">
                      Xóa ca
                    </Button>
                  </Popconfirm>
                </>
              )}

              <Button onClick={() => setDetailModal({ open: false, shift: null })} className="rounded-xl">
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: TỪ CHỐI CA LÀM VIỆC */}
      <Modal
        forceRender
        title={<span className="font-black text-error text-base">Từ chối ca làm việc</span>}
        open={rejectModal.open}
        onCancel={() => setRejectModal({ open: false, shiftId: null, shiftInfo: null, reason: "" })}
        onOk={onConfirmReject}
        confirmLoading={submittingReject}
        okText="Xác nhận từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        className="rounded-3xl"
      >
        <div className="space-y-3 mt-3 text-xs">
          {rejectModal.shiftInfo && (
            <p className="text-on-surface-variant">
              Bạn đang từ chối ca làm việc của tài xế{" "}
              <strong>{rejectModal.shiftInfo.driver_name}</strong> vào ngày{" "}
              <strong>{dayjs(rejectModal.shiftInfo.date).format("DD/MM/YYYY")}</strong> (
              {dayjs(rejectModal.shiftInfo.start_time).format("HH:mm")} – {dayjs(rejectModal.shiftInfo.end_time).format("HH:mm")}).
            </p>
          )}

          <div>
            <label className="block font-bold text-xs mb-1">
              Lý do từ chối (*)
            </label>
            <Input.TextArea
              rows={3}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Nhập lý do từ chối để tài xế được thông báo (ví dụ: Không đủ tài xế dự phòng, lịch trùng ca xe...)"
              className="rounded-xl"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
