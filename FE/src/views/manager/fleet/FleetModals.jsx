import React from 'react';
import { Modal, Form, Input, Select, DatePicker } from 'antd';

export function FleetTruckModal({
  open,
  onCancel,
  editingTruck,
  form,
  onFinish,
  submitting
}) {
  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <span className="material-symbols-outlined text-blue-600">local_shipping</span>
          <span className="font-bold text-slate-900 text-base">
            {editingTruck ? `Cập nhật thông tin Xe tải ${editingTruck.plate_number}` : 'Khai báo thông số Xe tải mới'}
          </span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      forceRender
      width={680}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} className="mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Form.Item
            name="plate_number"
            label={<span className="font-semibold text-slate-700">Biển số xe (Plate number - Bắt buộc)</span>}
            rules={[{ required: true, message: 'Vui lòng nhập biển số xe' }]}
          >
            <Input placeholder="VD: 29H-889.99" className="h-10 rounded-lg uppercase font-mono font-bold" />
          </Form.Item>

          <Form.Item
            name="model"
            label={<span className="font-semibold text-slate-700">Model / Dòng xe</span>}
            rules={[{ required: true, message: 'Vui lòng nhập dòng xe' }]}
          >
            <Input placeholder="VD: Hino 500 Series, Isuzu FVR" className="h-10 rounded-lg" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Form.Item
            name="allowed_payload"
            label={<span className="font-semibold text-slate-700">Tải trọng tối đa (kg)</span>}
            rules={[{ required: true, message: 'Nhập tải trọng cho phép' }]}
            extra="Giới hạn tải trọng tối đa khi gán đơn hàng."
          >
            <Input type="number" placeholder="5000" className="h-10 rounded-lg font-mono font-bold" />
          </Form.Item>

          <Form.Item
            name="required_license_class"
            label={<span className="font-semibold text-slate-700">Hạng bằng lái yêu cầu</span>}
            rules={[{ required: true }]}
          >
            <Select
              className="h-10"
              options={[
                { value: 'B2', label: 'Hạng B2 (Xe tải dưới 3.5 tấn)' },
                { value: 'C', label: 'Hạng C (Xe tải từ 3.5 tấn trở lên)' },
                { value: 'FC', label: 'Hạng FC (Xe đầu kéo Container)' }
              ]}
            />
          </Form.Item>
        </div>

        {/* Kích thước thùng D x R x C */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
          <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider block mb-2">
            Kích thước thùng xe (cm)
          </span>
          <div className="grid grid-cols-3 gap-3">
            <Form.Item name="box_length" label="Chiều Dài (cm)" className="mb-0" rules={[{ required: true }]}>
              <Input type="number" placeholder="620" className="rounded-lg font-mono" />
            </Form.Item>
            <Form.Item name="box_width" label="Chiều Rộng (cm)" className="mb-0" rules={[{ required: true }]}>
              <Input type="number" placeholder="210" className="rounded-lg font-mono" />
            </Form.Item>
            <Form.Item name="box_height" label="Chiều Cao (cm)" className="mb-0" rules={[{ required: true }]}>
              <Input type="number" placeholder="220" className="rounded-lg font-mono" />
            </Form.Item>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Form.Item
            name="inspection_expiry"
            label={<span className="font-semibold text-slate-700">Hạn đăng kiểm</span>}
            extra="Nếu hết hạn, xe tự động bị khóa không thể bật Sẵn sàng."
          >
            <DatePicker className="w-full h-10 rounded-lg" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
          </Form.Item>

          <Form.Item
            name="insurance_expiry"
            label={<span className="font-semibold text-slate-700">Hạn bảo hiểm trách nhiệm</span>}
          >
            <DatePicker className="w-full h-10 rounded-lg" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Form.Item
            name="gps_device_id"
            label={<span className="font-semibold text-slate-700">Mã thiết bị định vị GPS (Hộp đen)</span>}
          >
            <Input placeholder="VD: GPS-ALS-09" className="h-10 rounded-lg font-mono" />
          </Form.Item>

          <Form.Item
            name="status"
            label={<span className="font-semibold text-slate-700">Trạng thái xe</span>}
            rules={[{ required: true }]}
          >
            <Select
              className="h-10"
              options={[
                { value: 'AVAILABLE', label: 'Sẵn sàng (Available)' },
                { value: 'MAINTENANCE', label: 'Bảo dưỡng (Maintenance)' },
                { value: 'INACTIVE', label: 'Ngưng hoạt động (Inactive)' }
              ]}
            />
          </Form.Item>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 cursor-pointer shadow-sm"
          >
            {submitting ? 'Đang lưu...' : 'Lưu thông số xe'}
          </button>
        </div>
      </Form>
    </Modal>
  );
}

export function FleetDriverModal({
  open,
  onCancel,
  editingDriver,
  form,
  onFinish,
  submitting
}) {
  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <span className="material-symbols-outlined text-emerald-600">badge</span>
          <span className="font-bold text-slate-900 text-base">
            {editingDriver ? `Hồ sơ Tài xế: ${editingDriver.name}` : 'Thêm mới Tài xế vào Đội xe'}
          </span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      forceRender
    >
      <Form form={form} layout="vertical" onFinish={onFinish} className="mt-4">
        <Form.Item
          name="full_name"
          label={<span className="font-semibold text-slate-700">Họ và tên tài xế</span>}
          rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
        >
          <Input placeholder="Nguyễn Văn A" className="h-10 rounded-lg" />
        </Form.Item>

        <Form.Item
          name="phone"
          label={<span className="font-semibold text-slate-700">Số điện thoại liên lạc</span>}
          rules={[{ required: true, message: 'Vui lòng nhập SĐT' }]}
        >
          <Input placeholder="0912345678" className="h-10 rounded-lg" />
        </Form.Item>

        <div className="grid grid-cols-2 gap-3">
          <Form.Item
            name="license_number"
            label={<span className="font-semibold text-slate-700">Số GPLX</span>}
            rules={[{ required: true, message: 'Nhập số bằng lái' }]}
          >
            <Input placeholder="GPLX-012345" className="h-10 rounded-lg font-mono font-bold" />
          </Form.Item>

          <Form.Item
            name="license_class"
            label={<span className="font-semibold text-slate-700">Hạng bằng lái</span>}
            rules={[{ required: true }]}
          >
            <Select
              className="h-10"
              options={[
                { value: 'B2', label: 'B2' },
                { value: 'C', label: 'C' },
                { value: 'FC', label: 'FC' }
              ]}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="expiry"
          label={<span className="font-semibold text-slate-700">Ngày hết hạn GPLX</span>}
        >
          <DatePicker className="w-full h-10 rounded-lg" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
        </Form.Item>

        {editingDriver && (
          <Form.Item
            name="status"
            label={<span className="font-semibold text-slate-700">Trạng thái hồ sơ</span>}
          >
            <Select
              className="h-10"
              options={[
                { value: 'ACTIVE', label: 'Hoạt động (Active)' },
                { value: 'INACTIVE', label: 'Tạm dừng (Inactive)' }
              ]}
            />
          </Form.Item>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 cursor-pointer shadow-sm"
          >
            {submitting ? 'Đang lưu...' : 'Lưu hồ sơ tài xế'}
          </button>
        </div>
      </Form>
    </Modal>
  );
}

