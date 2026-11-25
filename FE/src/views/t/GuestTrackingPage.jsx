"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Steps, Card, Upload, Button, Alert, Modal, message, Tag, Input, InputNumber, Select, Image } from 'antd';
import { Upload as LucideUpload, Phone, MessageCircle, Image as ImageIcon, Clock, ShieldCheck, Package, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { fetchWithoutAuth } from '../../api/apiClient';
import { orderApi } from '../../api/orderApi';
import { uploadApi } from '../../api/uploadApi';

const DEMO_FALLBACK_ORDER = {
  id: 'ALS260930-0001',
  customer: 'VinFast LLC',
  status: 2,
  pickup: 'Kho ALS Cảng Nội Bài, Sóc Sơn, Hà Nội',
  dropoff: 'Nhà máy VinFast, KCN Đình Vũ, Hải Phòng',
  eta: '2026-09-30 22:30:00',
  dispatcher: { name: 'Nguyễn Văn A (Dispatcher 01)', phone: '0901234567', zalo: 'https://zalo.me/0901234567' },
  isVendor: false,
  vendorName: '',
  vendorTracking: '',
  sealImage: 'https://images.unsplash.com/photo-1586528116311-ad8ed7c50a41?q=80&w=2070',
  podImage: 'https://images.unsplash.com/photo-1620023412351-96860000d6cb?q=80&w=2070',
  incident: {
    has_incident: true,
    code: 'INC-042',
    type_display: 'Hàng hư hỏng do va chạm',
    status: 'APPROVED',
    compensation_amount: 15000000,
    clause_ref: 'Điều 8.2 - Bồi thường thiệt hại hàng hóa (HĐVC-2026/01)',
    resolution_note: null,
    rejection_reason: null,
    hotline: '1900 1234',
    payment_proof_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=800',
    transaction_code: null,
    payment_date: null,
  },
};

function mapOrderStatusToStep(rawStatus) {
  if (typeof rawStatus === 'number' && Number.isFinite(rawStatus)) {
    return Math.max(0, Math.min(3, rawStatus));
  }
  const normalized = String(rawStatus || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (['DELIVERED', 'DELIVERED_EXCEPTION', 'CLOSED', 'COMPLETED'].includes(normalized)) return 3;
  if (['IN_TRANSIT', 'PICKED_UP', 'IN_PROGRESS', 'HANDED_OVER_VENDOR', 'HANDED_OVER_TO_VENDOR', 'INCIDENT'].includes(normalized)) return 2;
  if (['READY_FOR_PLANNING', 'ASSIGNED', 'PLANNED', 'ACCEPTED', 'DISPATCHED'].includes(normalized)) return 1;
  return 0;
}

function mapApiOrderToViewModel(apiOrder) {
  const phoneDigits = String(apiOrder.dispatcher_phone || '0988123456').replace(/[^0-9]/g, '');
  const upperStatus = String(apiOrder.status || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const rawUpperStatus = String(apiOrder.raw_status || apiOrder.status || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const isRefused =
    upperStatus === 'DELIVERED_EXCEPTION' ||
    rawUpperStatus === 'DELIVERED_EXCEPTION' ||
    Boolean(apiOrder.refusal_reason);
  return {
    id: apiOrder.order_code || String(apiOrder.id || ''),
    customer: apiOrder.customer_name || 'Quý khách hàng',
    status: mapOrderStatusToStep(apiOrder.status),
    rawStatus: rawUpperStatus,
    isClosed: Boolean(apiOrder.is_closed),
    orderType: apiOrder.order_type || 'Import',
    isRefused,
    refusalReason: apiOrder.refusal_reason || null,
    warehouseName: apiOrder.warehouse_name || null,
    pickup: apiOrder.pickup_address || 'Đang cập nhật điểm lấy hàng',
    dropoff: apiOrder.delivery_address || 'Đang cập nhật điểm giao hàng',
    eta: apiOrder.eta || 'Đang cập nhật',
    dispatcher: {
      name: apiOrder.dispatcher_name || 'Điều phối viên NEXLOG',
      phone: apiOrder.dispatcher_phone || '0988 123 456',
      zalo: apiOrder.dispatcher_zalo || `https://zalo.me/${phoneDigits || '0988123456'}`,
    },
    isVendor: ['HANDED_OVER_VENDOR', 'HANDED_OVER_TO_VENDOR'].includes(upperStatus),
    vendorName: apiOrder.vendor_name || '',
    vendorTracking: apiOrder.vendor_tracking || '',
    sealImage: apiOrder.seal_image || null,
    podImage: apiOrder.pod_image || null,
    incident: apiOrder.incident || null,
    claims: Array.isArray(apiOrder.claims) ? apiOrder.claims : [],
    canSubmitClaim: Boolean(apiOrder.can_submit_claim),
    claimWindowDays: Number(apiOrder.claim_window_days || 14),
    claimWindowDeadline: apiOrder.claim_window_deadline || null,
    claimWindowExpired: Boolean(apiOrder.claim_window_expired),
  };
}

const CLAIM_STATUS_CONFIG = {
  PENDING: { color: 'orange', label: 'Chờ Quản lý thẩm định' },
  APPROVED: { color: 'blue', label: 'Đã duyệt bồi thường (Chờ chi trả)' },
  REJECTED: { color: 'red', label: 'Từ chối bồi thường (Chờ liên hệ)' },
  PAID: { color: 'cyan', label: 'Đã chuyển tiền (Chờ xác nhận)' },
  CLOSED_COMPENSATED: { color: 'green', label: 'Đã bồi thường (Hoàn tất)' },
  CLOSED_REJECTED: { color: 'red', label: 'Đã đóng (Từ chối)' },
  CLOSED: { color: 'default', label: 'Đã đóng' },
};

const CLAIM_TYPE_LABELS = {
  Damage: 'Hư hỏng hàng hóa',
  Shortage: 'Thiếu hụt hàng hóa',
  Loss: 'Thất lạc / Mất hàng',
};

export default function GuestTrackingPage() {
  const params = useParams();
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token;

  const [order, setOrder] = useState(null);
  const [isPODOpen, setIsPODOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimType, setClaimType] = useState('Damage');
  const [claimAmount, setClaimAmount] = useState(null);
  const [claimReason, setClaimReason] = useState('');
  const [claimContactName, setClaimContactName] = useState('');
  const [claimContactPhone, setClaimContactPhone] = useState('');
  const [claimFileList, setClaimFileList] = useState([]);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [confirmingClaimId, setConfirmingClaimId] = useState(null);

  const loadOrder = useCallback(async () => {
    if (!token) {
      setOrder(DEMO_FALLBACK_ORDER);
      return;
    }

    try {
      const res = await fetchWithoutAuth(`/orders/customer-view/${encodeURIComponent(token)}`);
      if (res?.order) {
        setOrder(mapApiOrderToViewModel(res.order));
        return;
      }
    } catch (err) {
      console.warn('Không tải được dữ liệu thực qua tracking token, dùng dữ liệu mẫu dự phòng:', err?.message);
    }

    setOrder(DEMO_FALLBACK_ORDER);
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrder();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOrder]);

  const handleOpenClaimModal = () => {
    setClaimType('Damage');
    setClaimAmount(null);
    setClaimReason('');
    setClaimContactName(order?.customer || '');
    setClaimContactPhone('');
    setClaimFileList([]);
    setIsClaimModalOpen(true);
  };

  const handleSubmitGuestClaim = async () => {
    if (!claimReason.trim()) {
      message.warning('Vui lòng nhập mô tả thiệt hại / lý do khiếu nại.');
      return;
    }
    try {
      setSubmittingClaim(true);
      const evidencePhotos = claimFileList
        .map((f) => f.url || f.response?.url)
        .filter(Boolean);
      const res = await orderApi.submitGuestClaim(token, {
        claim_type: claimType,
        amount: claimAmount !== null && claimAmount !== undefined ? Number(claimAmount) : 0,
        reason: claimReason.trim(),
        submitted_by_name: claimContactName.trim() || undefined,
        submitted_by_phone: claimContactPhone.trim() || undefined,
        evidence_photos: evidencePhotos,
      });
      message.success(res?.message || 'Đã gửi yêu cầu bồi thường thành công!');
      setIsClaimModalOpen(false);
      await loadOrder();
    } catch (err) {
      message.error(err?.message || 'Không thể gửi yêu cầu bồi thường');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleConfirmMoneyReceived = (claim) => {
    if (!token || !claim?.id) return;
    Modal.confirm({
      title: `Xác nhận đã nhận tiền bồi thường (${claim.claim_code})`,
      content: `Quý khách xác nhận đã nhận đủ số tiền ${Number(claim.approved_amount || claim.amount || 0).toLocaleString('vi-VN')} đ (Mã GD: ${claim.transaction_code || 'N/A'}) và đồng ý đóng hồ sơ bồi thường?`,
      okText: 'Xác nhận đã nhận tiền',
      cancelText: 'Hủy',
      okButtonProps: { className: 'bg-emerald-600 hover:bg-emerald-700' },
      onOk: async () => {
        try {
          setConfirmingClaimId(claim.id);
          const res = await orderApi.confirmGuestClaimPayment(token, claim.id);
          message.success(res?.message || 'Cảm ơn Quý khách! Hồ sơ bồi thường đã được đóng.');
          await loadOrder();
        } catch (err) {
          message.error(err?.message || 'Không thể xác nhận đã nhận tiền');
        } finally {
          setConfirmingClaimId(null);
        }
      }
    });
  };

  if (!order) return <div className="p-10 text-center">Đang tải dữ liệu tra cứu...</div>;

  const inc = order.incident;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0056a0] opacity-5 rounded-bl-full pointer-events-none"></div>
        <h1 className="text-2xl font-bold text-[#0056a0] mb-1 flex items-center gap-2">
          <Package className="text-[#e59f1f]" /> Chi tiết Đơn hàng: {order.id}
        </h1>
        {order.customer && (
          <p className="text-sm text-gray-600 mb-2">
            Khách hàng: <strong>{order.customer}</strong>
          </p>
        )}
        <p className="text-gray-500 mb-6 flex items-center gap-2">
          <Clock size={16} /> Thời gian dự kiến đến (ETA): <strong className="text-green-600">{order.eta}</strong>
        </p>

        <Steps
          current={order.status}
          status={order.isRefused ? 'error' : undefined}
          items={[
            { title: 'Chờ chứng từ', content: 'Đã tạo đơn' },
            { title: 'Lấy hàng', content: order.pickup },
            { title: 'Đang giao', content: 'Đang di chuyển' },
            {
              title: order.isRefused
                ? 'Từ chối nhận (Lưu kho ALS)'
                : 'Hoàn thành',
              content: order.isRefused
                ? order.warehouseName || 'Hoàn về Kho ALS lưu giữ'
                : order.dropoff,
            },
          ]}
          className="mb-8"
        />

        {/* THÔNG BÁO NGOẠI LỆ KHÁCH TỪ CHỐI NHẬN HÀNG & LƯU KHO ALS */}
        {order.isRefused && (
          <div className="mb-6">
            <Alert
              title={
                <span className="font-bold text-red-900">
                  Giao hàng ngoại lệ (Delivered - Exception): Người nhận từ chối nhận hàng
                </span>
              }
              description={
                <div className="space-y-1.5 mt-1 text-sm text-red-950">
                  <p>
                    • Lý do ghi nhận tại điểm giao:{' '}
                    <b>{order.refusalReason || 'Người nhận từ chối nhận hàng'}</b>
                  </p>
                  <p>
                    • Kho ALS lưu giữ hàng hóa:{' '}
                    <b className="text-amber-800">
                      {order.warehouseName || 'Đang điều xe chở hàng hoàn về Kho ALS'}
                    </b>
                  </p>
                  <p>
                    • Trạng thái đơn hàng:{' '}
                    <b>
                      {order.isClosed
                        ? 'Đã hạ hàng lưu giữ an toàn tại Kho ALS & Đóng đơn vận chuyển'
                        : 'Tài xế đang trên đường hoàn hàng về Kho ALS'}
                    </b>
                  </p>
                  <p className="text-xs text-gray-600 italic mt-1">
                    * Lưu ý: Lô hàng được bảo quản tại Kho ALS. Phí lưu kho phát sinh (nếu có) sẽ được tính theo số ngày lưu kho thực tế theo hợp đồng dịch vụ của ALS.
                  </p>
                </div>
              }
              type="warning"
              showIcon
              className="rounded-xl border border-amber-300 bg-amber-50"
            />
          </div>
        )}

        {/* THÔNG BÁO XỬ LÝ SỰ CỐ & BỒI THƯỜNG MINH BẠCH CHO KHÁCH HÀNG */}
        {inc?.has_incident && (
          <div className="mb-6">
            {inc.status === 'PENDING_APPROVAL' && (
              <Alert
                title={<span className="font-bold text-amber-900">Đơn hàng đang phát sinh sự cố: {inc.type_display} ({inc.code})</span>}
                description="Bộ phận Quản lý của NEXLOG / ALS đang tiến hành thẩm định bằng chứng hiện trường và xem xét hồ sơ bồi thường theo hợp đồng. Chúng tôi sẽ cập nhật kết quả trong thời gian sớm nhất."
                type="warning"
                showIcon
                className="rounded-xl border border-amber-300 bg-amber-50"
              />
            )}

            {inc.status === 'APPROVED' && (
              <Alert
                title={<span className="font-bold text-blue-900">Thông báo Phê duyệt Bồi thường thiệt hại</span>}
                description={
                  <div className="space-y-1 mt-1 text-sm text-blue-950">
                    <p>• Mã sự cố: <b>{inc.code}</b> ({inc.type_display})</p>
                    <p>• Căn cứ: <b>{inc.clause_ref}</b></p>
                    <p>• Số tiền được phê duyệt bồi thường: <b className="text-red-600 font-mono text-base">{Number(inc.compensation_amount || 0).toLocaleString('vi-VN')} đ</b></p>
                    {inc.resolution_note && (
                      <p>• Ghi chú xử lý: {inc.resolution_note}</p>
                    )}
                    <p className="text-xs text-gray-500 italic mt-1">* Bộ phận Tài chính đang thực hiện thủ tục chi trả/chuyển khoản đến tài khoản của Quý khách trong thời gian sớm nhất.</p>
                  </div>
                }
                type="info"
                showIcon
                className="rounded-xl border border-blue-300 bg-blue-50"
              />
            )}

            {inc.status === 'REJECTED' && (
              <Alert
                title={<span className="font-bold text-red-900">Thông báo Kết quả Thẩm định Sự cố ({inc.code}): Từ chối Bồi thường</span>}
                description={
                  <div className="space-y-1 mt-1 text-sm text-red-950">
                    <p>• Viện dẫn hợp đồng: <b>{inc.clause_ref}</b></p>
                    <p>• Lý do: {inc.rejection_reason || 'Không đủ điều kiện bồi thường theo hợp đồng vận chuyển.'}</p>
                    {inc.resolution_note && inc.resolution_note !== inc.rejection_reason && (
                      <p>• Ghi chú thẩm định: {inc.resolution_note}</p>
                    )}
                    <p>• Nếu Quý khách cần hỗ trợ thêm, vui lòng liên hệ Hotline Giải quyết Khiếu nại: <b className="font-mono">{inc.hotline || '1900 1234'}</b></p>
                  </div>
                }
                type="error"
                showIcon
                className="rounded-xl border border-red-300 bg-red-50"
              />
            )}

            {inc.status === 'DONE' && (
              <Alert
                title={<span className="font-bold text-green-900">Đã Hoàn tất Bồi thường &amp; Đóng hồ sơ ({inc.code})</span>}
                description={
                  <div className="space-y-1 mt-1 text-sm text-green-950">
                    <p>Đơn hàng đã được bồi thường số tiền: <b className="font-mono text-green-700">{Number(inc.compensation_amount || 0).toLocaleString('vi-VN')} đ</b>.</p>
                    {inc.transaction_code && (
                      <p>• Mã giao dịch ngân hàng (UNC): <b className="font-mono">{inc.transaction_code}</b>{inc.payment_date ? ` (Ngày ${inc.payment_date})` : ''}</p>
                    )}
                    {inc.resolution_note && (
                      <p>• Nội dung giải quyết: {inc.resolution_note}</p>
                    )}
                    {inc.payment_proof_url && (
                      <div className="pt-2">
                        <a
                          href={inc.payment_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold text-xs shadow-xs"
                        >
                          <ImageIcon size={14} />
                          <span>Xem Biên lai Chuyển khoản Ngân hàng</span>
                        </a>
                      </div>
                    )}
                  </div>
                }
                type="success"
                showIcon
                className="rounded-xl border border-green-300 bg-green-50"
              />
            )}
          </div>
        )}

        {order.status === 0 && (
          <Alert
            title="Yêu cầu Chứng từ Xuất Nhập Khẩu"
            description={
              <div className="mt-2">
                <p className="mb-2 text-sm">Vui lòng tải lên các chứng từ hàng hóa (Hóa đơn, Packing List, Vận đơn...) để tiến hành thủ tục và lấy hàng. Tờ khai hải quan sẽ do điều phối viên chuẩn bị. (Tối đa 10MB/tệp)</p>
                <Upload action="/api/upload" multiple>
                  <Button icon={<LucideUpload size={14} />}>Tải lên Chứng từ (PDF/JPG)</Button>
                </Upload>
                <p className="text-xs text-gray-400 mt-2">* Tệp sẽ tự động hủy sau 60 ngày theo Nghị định 13/2023/NĐ-CP.</p>
              </div>
            }
            type="warning"
            showIcon
            className="mb-6 rounded-xl"
          />
        )}

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title={<span className="flex items-center gap-2"><ShieldCheck className="text-blue-600"/> Minh chứng Giao nhận (POD)</span>} className="shadow-sm rounded-xl">
          {order.status >= 1 ? (
            <div className="space-y-4">
              {order.sealImage && (
                <div>
                  <p className="font-semibold text-gray-700 mb-2">Ảnh Niêm chì (Lấy hàng):</p>
                  <img src={order.sealImage} alt="Seal Evidence" className="w-full h-40 object-cover rounded-lg border border-gray-200" />
                </div>
              )}
              {order.status === 3 && order.podImage ? (
                <div>
                  <p className="font-semibold text-gray-700 mb-2">Biên bản Bàn giao (POD):</p>
                  <Button type="primary" ghost icon={<ImageIcon size={16} />} onClick={() => setIsPODOpen(true)} className="w-full">Xem &amp; Tải POD</Button>
                </div>
              ) : (
                <Alert title="Biên bản bàn giao (POD) sẽ được hiển thị sau khi hoàn tất giao hàng." type="info" className="text-sm" />
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">Minh chứng giao nhận sẽ được cập nhật khi xe bắt đầu lấy hàng và bàn giao.</p>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><Phone className="text-green-600"/> Hỗ trợ Khách hàng</span>} className="shadow-sm rounded-xl">
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 text-2xl font-bold">
              {order.dispatcher.name.charAt(0)}
            </div>
            <h3 className="font-bold text-lg">{order.dispatcher.name}</h3>
            <p className="text-gray-500 text-sm mb-4">Điều phối viên Phụ trách</p>

            <div className="w-full space-y-2">
              <Button type="primary" icon={<Phone size={16}/>} className="w-full bg-[#0056a0] hover:bg-blue-800" href={`tel:${order.dispatcher.phone}`}>
                Gọi Hotline: {order.dispatcher.phone}
              </Button>
              <Button icon={<MessageCircle size={16}/>} className="w-full border-blue-500 text-blue-600 hover:bg-blue-50" href={order.dispatcher.zalo} target="_blank">
                Chat qua Zalo
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <FileText className="text-[#0056a0]" size={18} />
              <span>Khiếu nại &amp; Yêu cầu Bồi thường (Claims)</span>
            </span>
            {order.canSubmitClaim && token && (
              <Button
                type="primary"
                danger
                size="small"
                icon={<AlertTriangle size={14} />}
                onClick={handleOpenClaimModal}
              >
                Gửi yêu cầu bồi thường
              </Button>
            )}
          </div>
        }
        className="shadow-sm rounded-xl"
      >
        <div className="space-y-4">
          {order.canSubmitClaim && (
            <Alert
              type="info"
              showIcon
              title={
                <span className="text-xs font-semibold">
                  Quý khách có quyền gửi yêu cầu bồi thường trong vòng {order.claimWindowDays} ngày sau khi nhận hàng (BR-59)
                  {order.claimWindowDeadline ? ` — Hạn cuối: ${new Date(order.claimWindowDeadline).toLocaleDateString('vi-VN')}` : ''}.
                </span>
              }
              className="rounded-lg"
            />
          )}

          {order.claimWindowExpired && (
            <Alert
              type="warning"
              showIcon
              title={`Đã quá thời hạn ${order.claimWindowDays} ngày kể từ khi giao hàng để gửi khiếu nại mới theo quy định hợp đồng & Điều 237 Luật Thương mại.`}
              className="rounded-lg"
            />
          )}

          {(!order.claims || order.claims.length === 0) ? (
            <p className="text-sm text-gray-500 italic">
              Chưa có yêu cầu bồi thường nào được ghi nhận cho đơn hàng này.
            </p>
          ) : (
            <div className="space-y-3">
              {order.claims.map((cl) => {
                const stKey = String(cl.status || 'PENDING').toUpperCase();
                const stCfg = CLAIM_STATUS_CONFIG[stKey] || { color: 'default', label: cl.status };
                const displayAmount = Number(cl.approved_amount || cl.amount || 0);
                return (
                  <div key={cl.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#0056a0]">{cl.claim_code}</span>
                        <Tag>{CLAIM_TYPE_LABELS[cl.claim_type] || cl.claim_type || 'Damage'}</Tag>
                        <Tag color="geekblue">
                          {cl.source === 'CUSTOMER_CLAIM' ? 'Khách hàng gửi' : 'Từ sự cố vận chuyển'}
                        </Tag>
                      </div>
                      <Tag color={stCfg.color} className="font-bold m-0">{stCfg.label}</Tag>
                    </div>

                    <p className="text-gray-700">
                      <b>Nội dung / Lý do:</b> {cl.reason}
                    </p>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                      <span>
                        Số tiền yêu cầu: <b className="font-mono text-gray-900">{Number(cl.amount || 0).toLocaleString('vi-VN')} đ</b>
                      </span>
                      {displayAmount > 0 && stKey !== 'PENDING' && stKey !== 'REJECTED' && stKey !== 'CLOSED_REJECTED' && (
                        <span>
                          Số tiền duyệt chi: <b className="font-mono text-red-600">{displayAmount.toLocaleString('vi-VN')} đ</b>
                        </span>
                      )}
                      {cl.created_time && (
                        <span>Ngày gửi: <b>{new Date(cl.created_time).toLocaleString('vi-VN')}</b></span>
                      )}
                    </div>

                    {cl.rejection_reason && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                        <b>Lý do từ chối:</b> {cl.rejection_reason}
                        {cl.contract_clause_ref ? ` (${cl.contract_clause_ref})` : ''}
                      </p>
                    )}

                    {Array.isArray(cl.evidence_photos) && cl.evidence_photos.length > 0 && (
                      <div className="pt-1">
                        <span className="text-xs font-semibold text-gray-600 block mb-1">Ảnh minh chứng đã gửi:</span>
                        <Image.PreviewGroup>
                          <div className="flex flex-wrap gap-2">
                            {cl.evidence_photos.map((url, idx) => (
                              <Image
                                key={idx}
                                src={url}
                                alt={`Bằng chứng ${idx + 1}`}
                                width={64}
                                height={64}
                                className="rounded-lg object-cover border border-gray-200"
                              />
                            ))}
                          </div>
                        </Image.PreviewGroup>
                      </div>
                    )}

                    {cl.payment_proof_url && (
                      <div className="pt-1">
                        <a
                          href={cl.payment_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-green-700 hover:underline"
                        >
                          <ImageIcon size={14} /> Xem chứng từ chuyển khoản {cl.transaction_code ? `(Mã GD: ${cl.transaction_code})` : ''}
                        </a>
                      </div>
                    )}

                    {stKey === 'PAID' && (
                      <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
                        <div className="font-bold text-emerald-900">
                          ALS đã hoàn tất chuyển khoản bồi thường {Number(cl.approved_amount || cl.amount || 0).toLocaleString('vi-VN')} đ
                        </div>
                        <div className="text-emerald-950 flex flex-wrap gap-x-4 gap-y-1">
                          {cl.payment_date && <span>Ngày chi: <b>{cl.payment_date}</b></span>}
                          {cl.transaction_code && <span>Mã GD: <b className="font-mono">{cl.transaction_code}</b></span>}
                          {cl.auto_close_deadline && (
                            <span>Tự động đóng nếu không phản hồi sau: <b>{new Date(cl.auto_close_deadline).toLocaleDateString('vi-VN')}</b></span>
                          )}
                        </div>
                        {token && (
                          <Button
                            type="primary"
                            size="small"
                            loading={confirmingClaimId === cl.id}
                            icon={<CheckCircle2 size={14} />}
                            onClick={() => handleConfirmMoneyReceived(cl)}
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                          >
                            Xác nhận đã nhận tiền bồi thường
                          </Button>
                        )}
                      </div>
                    )}

                    {(stKey === 'CLOSED_COMPENSATED' || stKey === 'CLOSED_REJECTED') && (
                      <div className={`mt-2 p-2.5 rounded-lg border text-xs ${
                        stKey === 'CLOSED_COMPENSATED'
                          ? 'bg-green-50 border-green-200 text-green-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}>
                        <div className="font-bold">
                          Hồ sơ Kết thúc (Final Record): {stKey === 'CLOSED_COMPENSATED' ? 'Đã bồi thường' : 'Đã từ chối'}
                        </div>
                        <div className="mt-0.5">
                          {cl.close_method === 'CUSTOMER_CONFIRMED'
                            ? 'Khách hàng đã xác nhận nhận đủ tiền bồi thường.'
                            : cl.close_method === 'AUTO_7_DAYS'
                              ? 'Hệ thống tự động đóng sau 7 ngày không có phản hồi khác.'
                              : 'Điều phối viên đã gọi điện thông báo kết quả từ chối cho khách hàng.'}
                          {cl.closed_at ? ` (${new Date(cl.closed_at).toLocaleString('vi-VN')})` : ''}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Modal open={isPODOpen} footer={null} onCancel={() => setIsPODOpen(false)} width={600} title="Biên bản Bàn giao Hàng hóa (POD)">
        {order.podImage && <img src={order.podImage} alt="POD" className="w-full rounded-lg mb-4" />}
        <Button type="primary" icon={<LucideUpload size={14} />} block onClick={() => message.success('Đang tải xuống...')}>Tải xuống PDF/JPG</Button>
      </Modal>

      <Modal
        open={isClaimModalOpen}
        onCancel={() => setIsClaimModalOpen(false)}
        onOk={handleSubmitGuestClaim}
        confirmLoading={submittingClaim}
        okText="Gửi yêu cầu bồi thường"
        cancelText="Hủy"
        title={`Gửi yêu cầu bồi thường — Đơn ${order.id}`}
        width={600}
      >
        <div className="space-y-3 py-2 text-xs">
          <div>
            <label className="font-bold text-gray-700 block mb-1">Loại khiếu nại *</label>
            <Select className="w-full" value={claimType} onChange={setClaimType}>
              <Select.Option value="Damage">Hư hỏng hàng hóa (Damage)</Select.Option>
              <Select.Option value="Shortage">Thiếu hụt số lượng (Shortage)</Select.Option>
              <Select.Option value="Loss">Thất lạc / Mất hàng (Loss)</Select.Option>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Người liên hệ</label>
              <Input
                value={claimContactName}
                onChange={(e) => setClaimContactName(e.target.value)}
                placeholder="Họ tên người gửi khiếu nại"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Số điện thoại liên hệ</label>
              <Input
                value={claimContactPhone}
                onChange={(e) => setClaimContactPhone(e.target.value)}
                placeholder="Số điện thoại nhận thông báo"
              />
            </div>
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1">Số tiền đề nghị bồi thường (VNĐ)</label>
            <InputNumber
              className="w-full"
              min={0}
              step={100000}
              value={claimAmount}
              onChange={setClaimAmount}
              formatter={(v) => (v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '')}
              parser={(v) => (v ? v.replace(/,/g, '') : '')}
              placeholder="Nhập số tiền ước tính (nếu có)"
            />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1">Mô tả thiệt hại &amp; Lý do *</label>
            <Input.TextArea
              rows={3}
              value={claimReason}
              onChange={(e) => setClaimReason(e.target.value)}
              placeholder="Mô tả chi tiết tình trạng hàng hóa bị hư hỏng, thiếu hụt hoặc thất lạc..."
            />
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1">Ảnh minh chứng (Tối đa 5 ảnh)</label>
            <Upload
              listType="picture-card"
              maxCount={5}
              multiple
              accept="image/*"
              fileList={claimFileList}
              onChange={({ fileList }) => setClaimFileList(fileList)}
              customRequest={async ({ file, onSuccess, onError }) => {
                try {
                  const uploaded = await uploadApi.uploadToCloudinary(file, 'nexlog/claims', { requireAuthCookie: false });
                  onSuccess?.({ url: uploaded.url });
                  message.success('Đã tải ảnh minh chứng lên thành công.');
                } catch (err) {
                  message.error(err?.message || 'Lỗi tải ảnh minh chứng');
                  onError?.(err);
                }
              }}
            >
              <div className="flex flex-col items-center text-gray-500">
                <LucideUpload size={16} />
                <span className="text-[11px] mt-1">Tải ảnh</span>
              </div>
            </Upload>
          </div>
        </div>
      </Modal>
    </div>
  );
}
