import React from 'react';
import { Select, InputNumber, Input, Button } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

const { Option } = Select;

export default function OrderFinancialTab({
  order,
  currentAgreedPrice,
  totalExtraFees,
  extraFees,
  setExtraFees,
  newFeeType,
  setNewFeeType,
  newFeeAmount,
  setNewFeeAmount,
  newFeeReason,
  setNewFeeReason,
  extraFeeTypes,
  handleAddExtraFee
}) {
  return (
    <div className="space-y-4">
      {/* Tóm tắt tài chính */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
          <div className="text-xs text-gray-500">Giá cước thỏa thuận:</div>
          <div className="text-lg font-bold text-blue-700 mt-1 font-mono">
            {currentAgreedPrice > 0 ? `${currentAgreedPrice.toLocaleString()} VNĐ` : 'Chưa chốt giá'}
          </div>
        </div>

        <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200">
          <div className="text-xs text-indigo-700 font-semibold">Tổng phụ phí phát sinh:</div>
          <div className="text-lg font-bold text-indigo-800 mt-1 font-mono">
            {totalExtraFees.toLocaleString()} VNĐ
          </div>
        </div>

        <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
          <div className="text-xs text-emerald-700 font-semibold">Tổng thanh toán dự kiến:</div>
          <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">
            {(currentAgreedPrice + totalExtraFees).toLocaleString()} VNĐ
          </div>
        </div>
      </div>

      {/* Form thêm phụ phí phát sinh */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
        <div className="font-bold text-xs text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
          <Plus size={14} className="text-indigo-600" /> Thêm phụ phí phát sinh (Sau khi chốt đơn &amp; ký hợp đồng):
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select 
            value={newFeeType} 
            onChange={setNewFeeType} 
            className="w-full text-xs"
          >
            {extraFeeTypes.map((t, idx) => (
              <Option key={idx} value={t}>{t}</Option>
            ))}
          </Select>
          <InputNumber
            placeholder="Nhập số tiền phát sinh..."
            value={newFeeAmount}
            onChange={val => setNewFeeAmount(val || 0)}
            formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={val => val.replace(/\$\s?|(,*)/g, '')}
            min={0}
            className="w-full font-bold text-indigo-700 text-xs"
          />
          <Input
            placeholder="Lý do / Biên bản ghi nhận phát sinh..."
            value={newFeeReason}
            onChange={e => setNewFeeReason(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex justify-end">
          <Button 
            type="primary" 
            size="small" 
            icon={<Plus size={13} />} 
            className="bg-[#7367f0] text-xs font-semibold"
            onClick={handleAddExtraFee}
          >
            Ghi nhận phụ phí
          </Button>
        </div>
      </div>

      {/* Danh sách các phụ phí đã thêm */}
      {extraFees.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="bg-gray-100/70 px-4 py-2 text-xs font-bold text-gray-700 border-b border-gray-200">
            Các khoản phụ phí đã ghi nhận ({extraFees.length}):
          </div>
          <div className="divide-y divide-gray-100">
            {extraFees.map(fee => (
              <div key={fee.id} className="p-3 flex justify-between items-center text-xs hover:bg-gray-50">
                <div>
                  <div className="font-bold text-gray-800">{fee.type}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{fee.reason} | Ghi nhận lúc: {fee.time}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold font-mono text-indigo-700 text-sm">{fee.amount.toLocaleString()} VNĐ</span>
                  <Button 
                    type="text" 
                    danger 
                    size="small" 
                    icon={<Trash2 size={13} />} 
                    onClick={() => {
                      const updated = extraFees.filter(f => f.id !== fee.id);
                      setExtraFees(updated);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
