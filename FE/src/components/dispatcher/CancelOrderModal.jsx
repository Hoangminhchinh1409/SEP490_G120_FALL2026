import { useState } from 'react';
import { Modal, Button, Input, InputNumber, Alert, Tag, Radio, message } from 'antd';
import { DollarSign, XCircle, ShieldCheck, Truck } from 'lucide-react';

const COMMON_CANCEL_REASONS = [
  'Khách hàng thay đổi kế hoạch sản xuất / dời ngày xuất hàng',
  'Khách hàng chưa hoàn thiện kịp chứng từ hải quan bắt buộc',
  'Khách hàng tự thu xếp phương tiện vận chuyển nội bộ',
  'Thời gian điều xe không đáp ứng khung giờ hẹn khẩn cấp',
  'Khách hàng hủy kế hoạch giao nhận vì lý do bất khả kháng'
];

export default function CancelOrderModal({ open, order, onCancel, onConfirmCancel }) {
  if (!open || !order) return null;

  return (
    <CancelOrderModalContent
      key={order.id || order.order_id}
      open={open}
      order={order}
      onCancel={onCancel}
      onConfirmCancel={onConfirmCancel}
    />
  );
}

function CancelOrderModalContent({ open, order, onCancel, onConfirmCancel }) {
  const agreedPrice = order?.agreed_price || 0;
  
  // 1. Phân loại theo quy định nghiệp vụ BR-18 / MSG23 / MSG24
  // - Đơn nháp hoặc đang xác nhận chưa xong chứng từ -> MIỄN PHÍ HỦY (0 VNĐ)
  const isFreeCancel = order?.status === 'DRAFT' || order?.status === 'CONFIRMED';
  
  // - Đơn xe đã lăn bánh hoặc đã giao/đóng -> KHÔNG THỂ HỦY
  const isLoadedOrDelivered = ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CLOSED'].includes(order?.status);

  // - Đơn đã xếp xe / xe đã đến kho lấy hàng nhưng chưa bốc -> Tính tiền công tài xế / công đoạn
  const isAssigned = order?.status === 'ASSIGNED' || order?.status === 'READY_FOR_PLANNING';

  const defaultDriverFee = 500000; // Tiền công điều xe & tài xế đến lấy hàng

  const [selectedTier, setSelectedTier] = useState(
    isFreeCancel ? 'TIER_0' : 'DRIVER_LABOR'
  );
  const [customFee, setCustomFee] = useState(
    isFreeCancel ? 0 : defaultDriverFee
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleTierChange = (e) => {
    const tier = e.target.value;
    setSelectedTier(tier);
    if (tier === 'TIER_0') setCustomFee(0);
    else if (tier === 'DRIVER_LABOR') setCustomFee(defaultDriverFee);
    else if (tier === 'CUSTOM') {
      // Giữ nguyên số tiền hiện tại hoặc cho phép tự do nhập
    }
  };

  const handleExecute = async () => {
    if (isLoadedOrDelivered) {
      message.error('Xe đã lăn bánh vận chuyển hàng, không thể hủy đơn theo quy định!');
      return;
    }

    if (!reason.trim()) {
      message.error('Vui lòng nhập lý do hủy đơn hàng.');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirmCancel({
        id: order.id,
        order_id: order.order_id,
        cancellation_reason: reason.trim(),
        cancellation_fee: isFreeCancel ? 0 : customFee,
        cancelled_at: new Date().toISOString()
      });
      onCancel();
    } catch (err) {
      console.error(err);
      message.error('Có lỗi xảy ra khi thực hiện hủy đơn hàng.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <div className="p-2 bg-red-50 text-red-600 rounded-lg">
            <XCircle size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">Xác nhận Hủy Đơn hàng</h3>
            <p className="text-xs text-gray-500 font-normal">
              Mã đơn: <b className="font-mono text-red-600">{order.order_id}</b> | Khách hàng: {order.customer}
            </p>
          </div>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={680}
      footer={[
        <Button key="back" onClick={onCancel} disabled={submitting}>
          Đóng
        </Button>,
        <Button
          key="submit"
          type="primary"
          danger
          disabled={isLoadedOrDelivered}
          loading={submitting}
          className="font-bold bg-red-600 hover:bg-red-700"
          onClick={handleExecute}
        >
          Xác nhận Hủy Đơn hàng
        </Button>
      ]}
    >
      <div className="py-2 space-y-4 text-xs">
        {/* Trường hợp 1: Xe đã lăn bánh hoặc hàng đã bốc lên xe */}
        {isLoadedOrDelivered ? (
          <Alert
            type="error"
            showIcon
            title={<span className="font-bold text-sm">Không thể hủy đơn hàng này</span>}
            description="Xe đã lăn bánh trên đường hoặc hàng hóa đã được bốc lên phương tiện và niêm phong chì. Theo quy định vận tải, không thể hủy đơn khi xe đã xuất phát."
            className="text-xs"
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            title={<span className="font-bold">Xác nhận hủy đơn {order.order_id}?</span>}
            description="Đơn hàng sẽ chuyển sang trạng thái ĐÃ HỦY và tự động giải phóng phương tiện, tài xế liên quan."
            className="text-xs"
          />
        )}

        {!isLoadedOrDelivered && (
          <>
            {/* Box Tóm tắt giá trị đơn hàng & Trạng thái */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
              <div>
                <span className="text-gray-500 block">Giá cước thỏa thuận của đơn:</span>
                <span className="text-base font-bold text-gray-800 font-mono">
                  {agreedPrice > 0 ? `${agreedPrice.toLocaleString()} VNĐ` : 'Chưa chốt cước (Đơn nháp)'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Trạng thái hiện tại:</span>
                <Tag color={order.status === 'DRAFT' ? 'default' : order.status === 'CONFIRMED' ? 'blue' : 'cyan'} className="font-semibold text-xs mt-0.5">
                  {order.status === 'DRAFT' ? 'ĐƠN NHÁP' : order.status === 'CONFIRMED' ? 'CẦN XÁC NHẬN CHỨNG TỪ' : order.status}
                </Tag>
              </div>
            </div>

            {/* Trường hợp 2: Đơn nháp hoặc đang xác nhận chứng từ -> AUTO MIỄN PHÍ PHẠT 0 VNĐ */}
            {isFreeCancel ? (
              <div className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                    <ShieldCheck size={18} className="text-emerald-600" />
                    Miễn phí phạt hủy đơn (0 VNĐ)
                  </div>
                  <p className="text-xs text-emerald-700 m-0 mt-1">
                    Đơn hàng đang ở trạng thái <b>{order.status === 'DRAFT' ? 'Đơn nháp' : 'Đang xác nhận chứng từ'}</b>, chưa phát lệnh điều xe thực tế nên khách hàng được hủy miễn phí hoàn toàn.
                  </p>
                </div>
                <div className="text-right pl-4">
                  <span className="font-mono font-bold text-emerald-700 text-xl block">0 VNĐ</span>
                  <span className="text-[11px] text-emerald-600 font-medium">Miễn phí 100%</span>
                </div>
              </div>
            ) : isAssigned ? (
              /* Trường hợp 3: Đã xác nhận xếp xe / xe đã đến lấy hàng -> Tính tiền công tài xế / công đoạn */
              <div className="space-y-2">
                <label className="font-bold text-gray-800 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-amber-600" />
                  Mức phí hủy &amp; Tiền công phát sinh (Xe đã được phân bổ):
                </label>

                <Radio.Group 
                  className="w-full space-y-2.5" 
                  value={selectedTier} 
                  onChange={handleTierChange}
                >
                  <div 
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${selectedTier === 'DRIVER_LABOR' ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => handleTierChange({ target: { value: 'DRIVER_LABOR' } })}
                  >
                    <Radio value="DRIVER_LABOR" className="w-full">
                      <div className="flex justify-between items-center w-full pr-4 text-xs">
                        <div>
                          <span className="font-bold text-gray-800 flex items-center gap-1.5">
                            <Truck size={15} className="text-amber-600" /> Tiền công điều xe &amp; tài xế đến lấy hàng
                          </span>
                          <p className="text-[11px] text-gray-500 m-0 mt-0.5">Xe đã xuất phát đến kho lấy hàng nhưng chưa bốc xếp lên xe</p>
                        </div>
                        <span className="font-mono font-bold text-amber-600 text-sm whitespace-nowrap">{defaultDriverFee.toLocaleString()} VNĐ</span>
                      </div>
                    </Radio>
                  </div>

                  <div 
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${selectedTier === 'CUSTOM' ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => handleTierChange({ target: { value: 'CUSTOM' } })}
                  >
                    <Radio value="CUSTOM" className="w-full">
                      <div className="flex justify-between items-center w-full pr-4 text-xs">
                        <div>
                          <span className="font-bold text-gray-800 flex items-center gap-1.5">
                            <DollarSign size={15} className="text-indigo-600" /> Mức tiền công / phí phạt thỏa thuận riêng:
                          </span>
                          <p className="text-[11px] text-gray-500 m-0 mt-0.5">Nhập số tiền thực tế cần chi trả sau khi trao đổi với khách &amp; tài xế</p>
                        </div>
                      </div>
                    </Radio>
                  </div>
                </Radio.Group>

                {/* Ô nhập số tiền áp dụng thực tế */}
                <div className="pt-2">
                  <span className="text-[11px] text-gray-600 block mb-1 font-semibold">Số tiền phí phạt / tiền công áp dụng thực tế (VNĐ):</span>
                  <InputNumber
                    className="w-full font-bold text-red-600 font-mono text-sm"
                    size="large"
                    value={customFee}
                    onChange={val => {
                      setCustomFee(val || 0);
                      setSelectedTier('CUSTOM');
                    }}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value.replace(/\$\s?|(,*)/g, '')}
                    min={0}
                  />
                </div>
              </div>
            ) : null}

            {/* Lý do hủy đơn (Bắt buộc) */}
            <div className="space-y-2 pt-1">
              <label className="font-bold text-gray-800 flex items-center justify-between">
                <span>Lý do hủy đơn hàng: <b className="text-red-500">*</b></span>
                <span className="text-[11px] text-gray-400 font-normal">Bắt buộc nhập</span>
              </label>

              {/* Gợi ý lý do nhanh */}
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {COMMON_CANCEL_REASONS.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReason(r)}
                    className="text-[11px] px-2 py-1 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-md border border-gray-200 text-gray-600 text-left transition-colors"
                  >
                    + {r}
                  </button>
                ))}
              </div>

              <Input.TextArea
                rows={3}
                placeholder="Nhập chi tiết lý do khách hàng yêu cầu hủy đơn..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="text-xs rounded-lg"
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
