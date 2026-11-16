'use client';
import React, { useState, useMemo } from 'react';
import { Modal, Button, Select, InputNumber, Input, Tag, Alert, message, Table, Divider } from 'antd';
import { Split, Truck, AlertTriangle, CheckCircle2, Plus, Trash2, ArrowRight } from 'lucide-react';
import { VEHICLE_SPECS, getVehicleSpecByKey } from '../../data/dispatcherPresets';
import { orderApi } from '../../api/orderApi';

const { Option } = Select;

export default function SplitOrderModal({ open, order, onCancel, onSuccess }) {
  if (!open || !order) return null;

  const totalWeight = Number(order.weight) || 0;
  const totalPackages = Number(order.package_count) || 1;
  const totalPrice = Number(order.agreed_price) || 0;

  // Mặc định ban đầu: Gợi ý chia làm 2 xe 2.5T nếu đơn gốc >= 3.5T hoặc 5T
  const [vehicleTarget, setVehicleTarget] = useState('TRUCK_2.5T');
  const [splitCount, setSplitCount] = useState(2);
  const [reason, setReason] = useState('Khách hàng yêu cầu chia xe nhỏ do cung đường vào kho hẹp / cấm xe tải trọng lớn');
  const [submitting, setSubmitting] = useState(false);

  // Tạo cấu hình phân bổ
  const [splits, setSplits] = useState(() => {
    const halfWeight = Math.round(totalWeight / 2);
    const halfPackages = Math.max(1, Math.round(totalPackages / 2));
    const halfPrice = Math.round(totalPrice / 2);

    return [
      {
        id: 1,
        vehicle_type: 'TRUCK_2.5T',
        weight_kg: halfWeight,
        package_count: halfPackages,
        agreed_price: halfPrice
      },
      {
        id: 2,
        vehicle_type: 'TRUCK_2.5T',
        weight_kg: totalWeight - halfWeight,
        package_count: Math.max(1, totalPackages - halfPackages),
        agreed_price: totalPrice - halfPrice
      }
    ];
  });

  // Tự động phân bổ lại đều khi người dùng đổi số lượng xe
  const handleRecalculateEqually = (newCount, newVehicleType = vehicleTarget) => {
    const count = Math.max(2, Math.min(5, newCount));
    setSplitCount(count);

    const perWeight = Math.round(totalWeight / count);
    const perPackages = Math.max(1, Math.round(totalPackages / count));
    const perPrice = Math.round(totalPrice / count);

    const newSplits = [];
    let remWeight = totalWeight;
    let remPackages = totalPackages;
    let remPrice = totalPrice;

    for (let i = 1; i <= count; i++) {
      const isLast = i === count;
      const w = isLast ? remWeight : perWeight;
      const p = isLast ? Math.max(1, remPackages) : perPackages;
      const pr = isLast ? remPrice : perPrice;

      newSplits.push({
        id: i,
        vehicle_type: newVehicleType,
        weight_kg: w,
        package_count: p,
        agreed_price: pr
      });

      remWeight -= w;
      remPackages -= p;
      remPrice -= pr;
    }
    setSplits(newSplits);
  };

  const handleUpdateSplitField = (id, field, val) => {
    setSplits(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  };

  // Tính tổng phân bổ kiểm tra
  const sumAllocatedWeight = splits.reduce((acc, cur) => acc + (Number(cur.weight_kg) || 0), 0);
  const sumAllocatedPackages = splits.reduce((acc, cur) => acc + (Number(cur.package_count) || 0), 0);
  const sumAllocatedPrice = splits.reduce((acc, cur) => acc + (Number(cur.agreed_price) || 0), 0);

  const isWeightMatch = Math.abs(sumAllocatedWeight - totalWeight) <= 1;
  const isPackagesMatch = sumAllocatedPackages === totalPackages;

  // Kiểm tra tải trọng của từng xe
  const payloadOverloads = useMemo(() => {
    return splits.map(s => {
      const spec = getVehicleSpecByKey(s.vehicle_type);
      const isOver = (Number(s.weight_kg) || 0) > spec.maxPayloadKg;
      return { id: s.id, isOver, maxPayloadKg: spec.maxPayloadKg, specLabel: spec.label };
    });
  }, [splits]);

  const hasAnyOverload = payloadOverloads.some(p => p.isOver);

  const handleConfirmSplit = async () => {
    if (splits.length < 2) {
      message.error('Vui lòng chia thành ít nhất 2 xe!');
      return;
    }
    if (hasAnyOverload) {
      message.error('Có xe con bị vượt quá tải trọng cho phép. Vui lòng điều chỉnh số kg hoặc chọn xe lớn hơn!');
      return;
    }
    if (!reason.trim()) {
      message.error('Vui lòng ghi rõ lý do tách đơn!');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        splits: splits.map(s => ({
          vehicle_type: s.vehicle_type,
          weight_kg: Number(s.weight_kg) || 0,
          package_count: Number(s.package_count) || 1,
          agreed_price: Number(s.agreed_price) || 0
        })),
        reason: reason.trim()
      };

      const res = await orderApi.splitOrder(order.id || order.order_id, payload);
      message.success(res?.message || 'Đã tách đơn hàng sang nhiều xe nhỏ thành công!');
      onSuccess?.(res);
      onCancel();
    } catch (err) {
      console.error('Split order error:', err);
      message.error(err.message || 'Không thể tách đơn hàng trên máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Xe con',
      dataIndex: 'id',
      key: 'id',
      width: '12%',
      render: (id) => (
        <span className="font-bold text-xs text-indigo-700 flex items-center gap-1">
          <Truck size={14} /> Xe #{id}
        </span>
      )
    },
    {
      title: 'Loại xe gán',
      dataIndex: 'vehicle_type',
      key: 'vehicle_type',
      width: '32%',
      render: (val, record) => (
        <div>
          <Select
            size="small"
            value={val}
            onChange={(newVal) => handleUpdateSplitField(record.id, 'vehicle_type', newVal)}
            className="w-full text-xs"
          >
            {VEHICLE_SPECS.filter(v => v.maxPayloadKg <= 5000).map(v => (
              <Option key={v.key} value={v.key}>
                {v.label} (Max {v.maxPayloadKg.toLocaleString()} kg)
              </Option>
            ))}
          </Select>
          {payloadOverloads.find(p => p.id === record.id)?.isOver && (
            <span className="text-[10px] text-red-600 block mt-0.5 font-bold">
              ⚠️ Quá tải xe {payloadOverloads.find(p => p.id === record.id)?.maxPayloadKg.toLocaleString()} kg
            </span>
          )}
        </div>
      )
    },
    {
      title: 'Trọng lượng (kg)',
      dataIndex: 'weight_kg',
      key: 'weight_kg',
      width: '20%',
      render: (val, record) => (
        <InputNumber
          size="small"
          min={1}
          value={val}
          onChange={(v) => handleUpdateSplitField(record.id, 'weight_kg', v)}
          className="w-full text-xs font-semibold"
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      )
    },
    {
      title: 'Số kiện',
      dataIndex: 'package_count',
      key: 'package_count',
      width: '16%',
      render: (val, record) => (
        <InputNumber
          size="small"
          min={1}
          value={val}
          onChange={(v) => handleUpdateSplitField(record.id, 'package_count', v)}
          className="w-full text-xs font-semibold"
        />
      )
    },
    {
      title: 'Cước thỏa thuận',
      dataIndex: 'agreed_price',
      key: 'agreed_price',
      width: '20%',
      render: (val, record) => (
        <InputNumber
          size="small"
          min={0}
          value={val}
          onChange={(v) => handleUpdateSplitField(record.id, 'agreed_price', v)}
          className="w-full text-xs font-semibold text-emerald-700"
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          addonAfter="đ"
        />
      )
    }
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-150">
          <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
            <Split size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800 m-0">
              Tách đơn hàng sang nhiều xe tải nhỏ (Theo chuẩn BR-29)
            </h3>
            <span className="text-[11px] text-gray-500 font-normal">
              Đơn gốc #{order.order_id} ({totalWeight.toLocaleString()} kg, {totalPackages} kiện) ➔ Đi trọn vẹn từng xe nhỏ độc lập
            </span>
          </div>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={780}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Hủy bỏ
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={submitting}
          icon={<Split size={14} />}
          onClick={handleConfirmSplit}
          className="bg-indigo-600 hover:bg-indigo-700 font-bold"
        >
          Xác nhận tách thành {splits.length} đơn con
        </Button>
      ]}
    >
      <div className="space-y-4 py-2">
        {/* Banner tóm tắt đơn gốc */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Mã đơn gốc:</span>
            <b className="font-mono text-indigo-600">{order.order_id}</b>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Tổng trọng lượng:</span>
            <b className="text-slate-900">{totalWeight.toLocaleString()} kg</b>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Tổng số kiện:</span>
            <b className="text-slate-900">{totalPackages} kiện</b>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Tổng cước gốc:</span>
            <b className="text-emerald-700">{totalPrice.toLocaleString()} VNĐ</b>
          </div>
        </div>

        {/* Cấu hình chọn phương án xe nhỏ */}
        <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/80 space-y-2">
          <div className="font-bold text-xs text-indigo-950 flex items-center justify-between">
            <span>⚙️ Chọn phương án chia xe:</span>
            <Button
              size="small"
              type="link"
              onClick={() => handleRecalculateEqually(splitCount, vehicleTarget)}
              className="text-xs p-0 text-indigo-600 font-semibold"
            >
              Chia đều tải trọng &amp; cước
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[11px] text-gray-600 block mb-1">Loại xe nhỏ cần đi:</span>
              <Select
                size="small"
                value={vehicleTarget}
                onChange={(val) => {
                  setVehicleTarget(val);
                  handleRecalculateEqually(splitCount, val);
                }}
                className="w-full text-xs font-semibold"
              >
                <Option value="TRUCK_1.25T">Xe tải 1.25 tấn (Max 1,250 kg)</Option>
                <Option value="TRUCK_2.5T">Xe tải 2.5 tấn (Max 2,500 kg)</Option>
                <Option value="TRUCK_3.5T">Xe tải 3.5 tấn (Max 3,500 kg)</Option>
              </Select>
            </div>
            <div>
              <span className="text-[11px] text-gray-600 block mb-1">Số lượng xe phân bổ:</span>
              <Select
                size="small"
                value={splitCount}
                onChange={(val) => handleRecalculateEqually(val, vehicleTarget)}
                className="w-full text-xs font-semibold"
              >
                <Option value={2}>Chia làm 2 xe con</Option>
                <Option value={3}>Chia làm 3 xe con</Option>
                <Option value={4}>Chia làm 4 xe con</Option>
              </Select>
            </div>
            <div>
              <span className="text-[11px] text-gray-600 block mb-1">Quy tắc tuân thủ:</span>
              <Tag color="blue" className="text-[10px] w-full text-center py-1 rounded">
                1 Đơn = 1 Xe trọn vẹn (BR-29)
              </Tag>
            </div>
          </div>
        </div>

        {/* Bảng chi tiết từng xe con */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">
              Danh sách đơn con &amp; Tải trọng từng xe:
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className={isWeightMatch ? 'text-emerald-700 font-semibold' : 'text-red-600 font-bold'}>
                Đã phân bổ: {sumAllocatedWeight.toLocaleString()}/{totalWeight.toLocaleString()} kg
              </span>
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={splits}
            rowKey="id"
            pagination={false}
            size="small"
            className="rounded-xl border border-gray-200 overflow-hidden"
          />
        </div>

        {/* Lý do tách đơn */}
        <div>
          <span className="text-xs font-bold text-gray-700 block mb-1">
            Lý do chia đơn sang nhiều xe nhỏ (Lưu hồ sơ kiểm toán):
          </span>
          <Input.TextArea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do tách đơn (VD: Đường vào kho hẹp, cầu hạn chế tải trọng, khách yêu cầu chia lô...)"
            className="text-xs"
          />
        </div>

        {/* Cảnh báo quy trình */}
        <Alert
          type="info"
          showIcon
          className="rounded-xl text-xs py-2"
          description={
            <div className="text-[11px] space-y-0.5 text-slate-700">
              <p className="m-0 font-semibold text-indigo-900">
                • Sau khi bấm tách: Đơn gốc #{order.order_id} sẽ tự động đóng và sinh ra {splits.length} đơn con ({order.order_id}-1, {order.order_id}-2...).
              </p>
              <p className="m-0 text-slate-600">
                • Mỗi đơn con kế thừa toàn bộ hồ sơ chứng từ của khách hàng và được gán độc lập 1 xe tải, 1 tài xế, 1 giấy vận tải Waybill và 1 biên bản giao nhận POD riêng biệt.
              </p>
            </div>
          }
        />
      </div>
    </Modal>
  );
}
