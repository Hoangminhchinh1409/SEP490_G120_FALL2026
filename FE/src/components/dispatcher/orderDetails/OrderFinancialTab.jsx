import React, { useState } from 'react';
import { Select, InputNumber, Input, Button, Tag, message, Image } from 'antd';
import { Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { dispatcherApi } from '../../../api/dispatcherApi';

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
  const [reviewingId, setReviewingId] = useState(null);

  const handleReviewFee = async (feeId, action) => {
    try {
      setReviewingId(feeId);
      const res = await dispatcherApi.reviewExtraFee(feeId, action);
      message.success(res?.message || (action === 'CONFIRM' ? 'Đã xác nhận phụ phí' : 'Đã từ chối phụ phí'));
      const newStatus = action === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED';
      setExtraFees(extraFees.map(f => (Number(f.id) === Number(feeId) ? { ...f, status: newStatus } : f)));
    } catch (err) {
      message.error(err?.message || 'Không thể xử lý duyệt phụ phí');
    } finally {
      setReviewingId(null);
    }
  };

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
            {extraFees.map(fee => {
              const stUpper = String(fee.status || '').toUpperCase();
              const isProposed = stUpper === 'PROPOSED';
              const isRejected = stUpper === 'REJECTED';
              return (
                <div key={fee.id} className="p-3 flex justify-between items-center text-xs hover:bg-gray-50 gap-3">
                  <div className="flex items-start gap-2.5">
                    {fee.photo_url && (
                      <Image
                        src={fee.photo_url}
                        alt="Ảnh phụ phí"
                        width={42}
                        height={42}
                        className="rounded-lg object-cover border border-gray-200 shrink-0"
                      />
                    )}
                    <div>
                      <div className="font-bold text-gray-800 flex items-center gap-1.5 flex-wrap">
                        <span>{fee.fee_type || fee.type || 'Phụ phí'}</span>
                        {isProposed ? (
                          <Tag color="gold" className="text-[10px] m-0">Chờ xác nhận (Tài xế đề xuất)</Tag>
                        ) : isRejected ? (
                          <Tag color="red" className="text-[10px] m-0">Đã từ chối</Tag>
                        ) : (
                          <Tag color="green" className="text-[10px] m-0">Đã xác nhận</Tag>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {fee.reason || 'Phụ phí vận chuyển'} | Ghi nhận lúc: {fee.created_at ? new Date(fee.created_at).toLocaleString('vi-VN') : (fee.time || 'Vừa xong')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-bold font-mono text-sm ${isRejected ? 'line-through text-gray-400' : isProposed ? 'text-amber-600' : 'text-indigo-700'}`}>
                      {(Number(fee.amount) || 0).toLocaleString()} VNĐ
                    </span>
                    {isProposed ? (
                      <>
                        <Button
                          size="small"
                          type="primary"
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                          icon={<CheckCircle size={12} />}
                          loading={reviewingId === fee.id}
                          onClick={() => handleReviewFee(fee.id, 'CONFIRM')}
                        >
                          Xác nhận
                        </Button>
                        <Button
                          size="small"
                          danger
                          className="text-xs"
                          icon={<XCircle size={12} />}
                          loading={reviewingId === fee.id}
                          onClick={() => handleReviewFee(fee.id, 'REJECT')}
                        >
                          Từ chối
                        </Button>
                      </>
                    ) : (
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
