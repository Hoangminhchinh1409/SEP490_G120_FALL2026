import React, { useState } from 'react';
import { Button, Tag, Input, Alert, message } from 'antd';
import {
  FileText,
  Send,
  Upload,
  CheckCircle2,
  Download,
  Plus,
  Trash2,
  Clock,
  Package,
  FileCheck,
  Building2
} from 'lucide-react';
import { orderApi } from '../../../api/orderApi';
import { uploadApi } from '../../../api/uploadApi';
import OrderContractDocumentView from './OrderContractDocumentView';

export default function OrderContractTab({
  order,
  currentAgreedPrice,
  proposedVehicleType,
  currentProposedSpec,
  onUpdateOrder
}) {
  const isCancelled = order.status === 'CANCELLED' || order.status === 'CLOSED';
  // Chỉ khi khách gửi lại bản đã có chữ ký thật thì mới tính là hợp đồng xác nhận thành công và khóa
  const isSigned = Boolean(
    order.contract_file || order.contract_uploaded || order.signed_order_contract_file
  );
  // Khi đơn đã hoàn tất ký nhận hoặc đã hủy thì mới khóa
  const isContractLocked = isCancelled || isSigned;

  const [customTerms, setCustomTerms] = useState(() => {
    if (Array.isArray(order.contract_custom_terms) && order.contract_custom_terms.length > 0) {
      return order.contract_custom_terms;
    }
    return [
      'Phương tiện vận tải đảm bảo 100% bạt che kín hoặc thùng kín chuyên dụng bảo vệ hàng hóa khỏi mưa nắng.',
      'Tài xế và phương tiện tuân thủ nghiêm ngặt giờ cut-off tại cửa nhận/giao hàng của khách.',
      'Khách hàng có trách nhiệm gửi trả lại bản cứng hợp đồng gốc có dấu đỏ qua bưu điện/chuyển phát trong vòng 03 ngày làm việc.'
    ];
  });
  const [newTerm, setNewTerm] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [contractSentAt, setContractSentAt] = useState(order.contract_sent_email_at || null);

  // Cho phép điều phối chỉnh sửa linh hoạt mọi trường thông tin trong hợp đồng trước và sau khi gửi
  const [contractDetails, setContractDetails] = useState(() => {
    const saved = order.contract_details || order.web_workflow?.contract_details || {};
    return {
      carrier_name:
        saved.carrier_name || 'CÔNG TY TNHH VẬN TẢI & LOGISTICS HÀNG KHÔNG ALS (NEXLOG)',
      carrier_tax_code: saved.carrier_tax_code || '0102345678',
      carrier_address:
        saved.carrier_address ||
        'Cảng Hàng không Quốc tế Nội Bài, Xã Phú Minh, Huyện Sóc Sơn, TP. Hà Nội',
      carrier_phone: saved.carrier_phone || '1900 3133 / 0988 123 456',
      carrier_rep:
        saved.carrier_rep || order.dispatcher_name || 'Ban Điều phối Vận tải Hàng không ALS',
      carrier_cid: saved.carrier_cid || '001092008899',

      customer_name: saved.customer_name || order.customer || order.customer_name || '',
      customer_tax_code:
        saved.customer_tax_code || order.customer_tax_code || order.customer_cid || '',
      customer_address:
        saved.customer_address ||
        order.customer_address ||
        (order.shipping_direction === 'IMPORT'
          ? order.dropoff || order.delivery_address
          : order.pickup || order.pickup_address) ||
        order.customer?.registered_address ||
        '',
      customer_phone: saved.customer_phone || order.customer_phone || '',
      customer_email: saved.customer_email || order.customer_email || '',

      pickup_time:
        saved.pickup_time || order.pickup_time || 'Theo thông báo điều vận của ALS',
      delivery_time:
        saved.delivery_time ||
        'Sau khi giao trả hàng hóa và hoàn tất ký nhận Biên bản giao nhận (POD)',
      pickup_address: saved.pickup_address || order.pickup || order.pickup_address || '',
      delivery_address: saved.delivery_address || order.dropoff || order.delivery_address || '',
      distance_km: saved.distance_km || order.estimated_distance_km || 35.5,

      cargo_name: saved.cargo_name || order.cargo_name || order.cargo_type || 'Hàng hóa thông thường',
      package_info:
        saved.package_info ||
        `${order.package_count || 1} ${order.package_type || 'Kiện'} (${order.length_cm || 0}×${order.width_cm || 0}×${order.height_cm || 0} cm)`,
      weight: saved.weight || order.weight || 0,
      chargeable_weight: saved.chargeable_weight || order.chargeable || order.weight || 0,
      truck_model:
        saved.truck_model || currentProposedSpec?.label || 'Xe tải chuyên dụng ALS',

      price_amount:
        saved.price_amount !== undefined ? saved.price_amount : currentAgreedPrice || 0,
      payment_method: saved.payment_method || 'Chuyển khoản ngân hàng hoặc tiền mặt',
      payment_term:
        saved.payment_term ||
        'Trong vòng 07 ngày làm việc kể từ ngày hoàn tất giao hàng kèm POD',
      waiting_fee_rule:
        saved.waiting_fee_rule ||
        'Miễn phí chờ bốc dỡ 60 phút tại mỗi điểm; vượt quá tính 100.000 VNĐ / block 30 phút theo hợp đồng nguyên tắc ALS'
    };
  });

  const [isEditingForm, setIsEditingForm] = useState(false);

  // Trạng thái bản cứng hợp đồng gốc qua bưu điện
  const [hardcopyReceived, setHardcopyReceived] = useState(
    order.contract_hardcopy_received || false
  );
  const [hardcopyNotes, setHardcopyNotes] = useState(
    order.contract_postal_code || order.contract_hardcopy_notes || ''
  );
  const [verifyingHardcopy, setVerifyingHardcopy] = useState(false);

  // File upload state cho hợp đồng scan
  const [uploadingScan, setUploadingScan] = useState(false);
  const [contractFile, setContractFile] = useState(
    order.contract_file || order.signed_order_contract_file || null
  );
  const [contractFileData, setContractFileData] = useState(order.contract_file_data || null);
  const [contractUploadedAt, setContractUploadedAt] = useState(
    order.contract_uploaded_at || null
  );

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Thêm điều khoản tùy biến
  const handleAddTerm = () => {
    if (isContractLocked) {
      message.warning(
        'Hợp đồng đã có bản ký xác nhận thành công, không thể chỉnh sửa điều khoản nữa!'
      );
      return;
    }
    if (!newTerm.trim()) {
      message.warning('Vui lòng nhập nội dung điều khoản bổ sung');
      return;
    }
    setCustomTerms([...customTerms, newTerm.trim()]);
    setNewTerm('');
  };

  const handleRemoveTerm = (idx) => {
    if (isContractLocked) {
      message.warning(
        'Hợp đồng đã có bản ký xác nhận thành công, không thể chỉnh sửa điều khoản nữa!'
      );
      return;
    }
    setCustomTerms(customTerms.filter((_, i) => i !== idx));
  };

  // Cập nhật thông tin chi tiết hợp đồng
  const handleUpdateContractField = (field, value) => {
    setContractDetails((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Gửi hợp đồng qua Email cho khách hàng (kèm toàn bộ thông tin đã chỉnh sửa)
  const handleSendContractEmail = async () => {
    if (isContractLocked) {
      message.warning(
        'Hợp đồng đã có bản ký xác nhận thành công hoặc đơn đã hủy, không thể gửi lại email!'
      );
      return;
    }
    try {
      setSendingEmail(true);
      const res = await orderApi.sendContractToCustomer(order.id || order.order_id, {
        custom_terms: customTerms,
        contract_details: contractDetails
      });

      const now = new Date().toISOString();
      setContractSentAt(now);
      message.success(
        res?.message || 'Đã gửi hợp đồng vận tải chính thức qua email cho khách hàng!'
      );
      onUpdateOrder?.({
        ...order,
        contract_sent_email_at: now,
        contract_custom_terms: customTerms,
        contract_details: contractDetails
      });
    } catch (err) {
      console.error('sendContractToCustomer error:', err);
      message.error(err.message || 'Lỗi khi gửi email hợp đồng cho khách hàng');
    } finally {
      setSendingEmail(false);
    }
  };

  // Xác minh và tick nhận bản cứng gốc có dấu đỏ qua bưu điện
  const handleVerifyAndConfirmHardcopy = async () => {
    if (hardcopyReceived) {
      message.info(
        'Bản cứng hợp đồng gốc đã được xác minh và lưu trữ pháp lý hoàn tất, không thể thay đổi nữa.'
      );
      return;
    }

    const postalCode = hardcopyNotes.trim().toUpperCase().replace(/\s+/g, '');
    if (!postalCode) {
      message.error(
        'Vui lòng nhập Mã vận đơn / Mã bưu điện chuyển phát nhanh trước khi xác nhận nhận bản cứng!'
      );
      return;
    }

    const standardVnPostRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i;
    const generalPostalRegex = /^(VNPost|EMS|VT|VTP|SPX|GHN|J&T|JT)?[-_]?[A-Z0-9]{8,25}$/i;
    const isValidFormat =
      standardVnPostRegex.test(postalCode) ||
      generalPostalRegex.test(postalCode) ||
      /^[A-Z0-9]{8,25}$/.test(postalCode);

    if (!isValidFormat) {
      message.error(
        `Mã bưu cục/vận đơn "${postalCode}" không hợp lệ. Vui lòng nhập đúng mã bưu điện (VD: EM123456789VN, VTP98234812, EMS-VN88921...)`
      );
      return;
    }

    try {
      setVerifyingHardcopy(true);
      const res = await orderApi.confirmHardcopyContractReceived(order.id || order.order_id, {
        received: true,
        notes: `[BƯU ĐIỆN ĐÃ XÁC MINH] Mã vận đơn: ${postalCode}`,
        postal_code: postalCode
      });

      setHardcopyReceived(true);
      setHardcopyNotes(postalCode);
      message.success(
        res?.message ||
          `Đã xác minh mã bưu điện [${postalCode}] và chốt lưu trữ bản cứng thành công!`
      );
      onUpdateOrder?.({
        ...order,
        contract_hardcopy_received: true,
        contract_hardcopy_received_at: new Date().toISOString(),
        contract_hardcopy_notes: `[BƯU ĐIỆN ĐÃ XÁC MINH] Mã vận đơn: ${postalCode}`,
        contract_postal_code: postalCode
      });
    } catch (err) {
      console.error('confirmHardcopyContractReceived error:', err);
      message.error(err.message || 'Lỗi khi xác minh mã bưu điện');
    } finally {
      setVerifyingHardcopy(false);
    }
  };

  // Tải lên tệp hợp đồng đã scan (PDF) - Điểm xác nhận hợp đồng chính thức
  const handleFileUpload = async (e) => {
    if (isCancelled) {
      message.warning('Đơn hàng đã kết thúc/hủy, không thể tải tệp mới!');
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      message.error('Tệp hợp đồng tải lên bắt buộc phải là định dạng PDF (.pdf)!');
      e.target.value = '';
      return;
    }

    try {
      setUploadingScan(true);
      const orderId = order.id || order.order_id;
      const uploaded = await uploadApi.uploadToCloudinary(file, `nexlog/orders/${orderId}/contract`);
      const contractUrl = uploaded.url;
      const res = await orderApi.uploadContractFile(orderId, {
        file_name: file.name,
        file_data: contractUrl,
        file_url: contractUrl,
        file_size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      });

      const now = new Date().toISOString();
      setContractFile(file.name);
      setContractFileData(contractUrl);
      setContractUploadedAt(now);

      message.success(
        res?.message ||
          'Đã tiếp nhận bản scan hợp đồng có chữ ký! Hợp đồng chính thức được xác nhận thành công.'
      );
      onUpdateOrder?.({
        ...order,
        contract_uploaded: true,
        contract_file: file.name,
        contract_file_data: contractUrl,
        contract_uploaded_at: now,
        status: 'READY_FOR_PLANNING',
        web_workflow: {
          ...(order.web_workflow || {}),
          stage: 'CONTRACT_SIGNED',
          contract_file: file.name
        }
      });
    } catch (err) {
      console.error('uploadContractFile error:', err);
      message.error(err.message || 'Lỗi khi tải tệp hợp đồng lên Cloudinary');
    } finally {
      setUploadingScan(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cảnh báo khi đơn đã ký xong hoặc đã hủy */}
      {isCancelled && (
        <Alert
          type="error"
          showIcon
          title="Đơn hàng đã bị HỦY hoặc ĐÓNG"
          description="Hồ sơ hợp đồng của đơn hàng này đã đóng lại và không được phép chỉnh sửa hoặc thao tác thêm."
          className="rounded-xl"
        />
      )}
      {isSigned && !isCancelled && (
        <Alert
          type="success"
          showIcon
          title="Hợp đồng vận tải đã được ký kết và lưu trữ"
          description="Bản scan PDF có chữ ký/dấu đỏ đã được tiếp nhận thành công. Toàn bộ điều khoản và nội dung hợp đồng đã được chốt và khóa tương tác."
          className="rounded-xl"
        />
      )}

      {/* Banner Trạng thái Hợp đồng */}
      <div className="p-4 rounded-xl border bg-gradient-to-r from-blue-50/70 via-indigo-50/60 to-purple-50/60 border-indigo-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                <FileText size={17} className="text-indigo-600" />
                Hợp đồng Vận chuyển Hàng hóa Nội địa (Chuẩn ALS &amp; Trường Thành Logistics)
              </span>
              <Tag
                color={
                  isSigned
                    ? 'success'
                    : isCancelled
                      ? 'red'
                      : contractSentAt
                        ? 'processing'
                        : 'warning'
                }
                className="font-semibold text-xs"
              >
                {isSigned
                  ? '✓ ĐÃ LƯU BẢN SCAN ĐÃ KÝ (ĐÃ KHÓA)'
                  : isCancelled
                    ? 'ĐƠN ĐÃ HỦY (ĐÃ KHÓA)'
                    : contractSentAt
                      ? 'ĐÃ GỬI EMAIL CHỜ KHÁCH KÝ'
                      : 'CHƯA GỬI HỢP ĐỒNG'}
              </Tag>
            </div>
            <div className="text-xs text-indigo-800 mt-1">
              Hệ thống tự động lập hợp đồng dựa trên thông tin hàng hóa, phương án xe{' '}
              <b>{currentProposedSpec?.label}</b> và cước phí đã thỏa thuận{' '}
              <b>{currentAgreedPrice?.toLocaleString('vi-VN')} VNĐ</b>.
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              icon={<FileCheck size={14} />}
              onClick={() => setPreviewModalOpen(true)}
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs"
            >
              Xem &amp; Soạn thảo hợp đồng
            </Button>
            <Button
              type="primary"
              icon={<Send size={14} />}
              loading={sendingEmail}
              disabled={isContractLocked}
              onClick={handleSendContractEmail}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm disabled:opacity-50"
            >
              {contractSentAt ? 'Gửi lại Email Hợp đồng' : 'Gửi Email Hợp đồng cho Khách'}
            </Button>
          </div>
        </div>

        {contractSentAt && (
          <div className="mt-2.5 pt-2 border-t border-indigo-150 flex items-center justify-between text-[11px] text-indigo-700">
            <span>
              <Clock size={12} className="inline mr-1" />
              Đã gửi tới: <b>{order.customer_email || 'Email khách hàng'}</b> vào lúc{' '}
              {new Date(contractSentAt).toLocaleString('vi-VN')}
            </span>
            <span className="font-medium text-emerald-700">
              Khách có thể xem/in PDF từ link bảo mật hoặc hộp thư Gmail
            </span>
          </div>
        )}
      </div>

      {/* 2 Khối chính: Bổ sung điều khoản & Quản lý bản cứng / Bản scan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Cột trái: Điều khoản bổ sung tùy biến của đơn */}
        <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-150 pb-2">
            <div>
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 size={14} className="text-indigo-600" />
                Điều khoản bổ sung riêng cho đơn này (Đàm phán với khách):
              </span>
              <span className="text-[11px] text-gray-500 mt-0.5 block">
                Các điều khoản này sẽ được in trực tiếp vào <b>Điều 5 / Điều 7</b> của Hợp đồng gửi
                khách.
              </span>
            </div>
            {isContractLocked && (
              <Tag color="default" className="text-[10px] m-0">
                Đã khóa chỉnh sửa
              </Tag>
            )}
          </div>

          {/* Danh sách điều khoản */}
          <div className="space-y-2">
            {customTerms.map((term, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-start justify-between gap-2 text-xs"
              >
                <div className="flex items-start gap-2 text-gray-700">
                  <span className="font-bold text-indigo-600 shrink-0">{idx + 1}.</span>
                  <span className="leading-relaxed">{term}</span>
                </div>
                {!isContractLocked && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTerm(idx)}
                    className="text-gray-400 hover:text-red-600 transition-colors shrink-0 p-0.5"
                    title="Xóa điều khoản này"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Ô thêm điều khoản mới (Chỉ hiển thị khi chưa khóa) */}
          {!isContractLocked && (
            <div className="pt-2 flex items-center gap-2">
              <Input
                size="small"
                placeholder="Nhập điều khoản bổ sung (VD: Bạt che kín 100%, bảo quản nhiệt độ, hỗ trợ cẩu hàng...)"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                onPressEnter={handleAddTerm}
                className="text-xs"
              />
              <Button
                size="small"
                type="primary"
                icon={<Plus size={13} />}
                onClick={handleAddTerm}
                className="bg-indigo-600 text-xs shrink-0"
              >
                Thêm
              </Button>
            </div>
          )}
        </div>

        {/* Cột phải: Quản lý Bản scan và Bản cứng qua bưu điện */}
        <div className="lg:col-span-5 space-y-4">
          {/* Box 1: Tệp Scan hợp đồng đã ký */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
              <Upload size={14} className="text-emerald-600" />
              1. Tệp Scan hợp đồng có chữ ký / dấu đỏ (PDF):
            </span>

            {contractFileData || contractFile ? (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-emerald-700" />
                    <div>
                      <div
                        className="font-bold text-xs text-emerald-950 truncate max-w-[200px]"
                        title={contractFile || 'hop-dong-van-tai-als.pdf'}
                      >
                        {contractFile || 'hop-dong-van-tai-als.pdf'}
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        Đã tải lên lúc:{' '}
                        {contractUploadedAt
                          ? new Date(contractUploadedAt).toLocaleString('vi-VN')
                          : 'Gần đây'}
                      </div>
                    </div>
                  </div>
                  {contractFileData && (
                    <a
                      href={contractFileData}
                      download={contractFile || 'hop-dong-van-tai-als.pdf'}
                      className="px-2.5 py-1 bg-white border border-emerald-300 rounded text-xs font-semibold text-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                    >
                      <Download size={12} /> Tải về
                    </a>
                  )}
                </div>

                <div className="pt-1.5 border-t border-emerald-200 text-right">
                  <span className="text-[10px] text-emerald-800 font-semibold">
                    ✓ Bản ký đã được xác nhận vào hồ sơ (Đã khóa, không cho phép sửa đổi)
                  </span>
                </div>
              </div>
            ) : isContractLocked ? (
              <div className="p-4 border border-gray-200 rounded-lg text-center bg-gray-50 text-gray-500 text-xs">
                Đơn hàng đã kết thúc/hủy, không thể tải lên bản scan hợp đồng.
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center bg-gray-50/60 hover:bg-indigo-50/30 transition-colors">
                <FileText size={28} className="mx-auto text-gray-400 mb-1.5" />
                <div className="text-xs font-semibold text-gray-700">
                  Chưa có tệp scan hợp đồng đã ký
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5 mb-2.5">
                  Khách hàng có thể tự tải lên từ màn hình tra cứu, hoặc Điều phối tải lên tại đây.
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs">
                  <Upload size={13} />
                  <span>{uploadingScan ? 'Đang tải lên...' : 'Tải lên bản Scan (PDF)'}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingScan}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Box 2: Quy trình nhận bản cứng gốc qua bưu điện */}
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/90 shadow-2xs space-y-2.5">
            <span className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
              <Package size={14} className="text-amber-700" />
              2. Theo dõi Bản cứng hợp đồng gốc (Bưu điện / Chuyển phát):
            </span>
            <div className="text-[11px] text-amber-900 leading-relaxed">
              Theo quy định vận hành của ALS, khách hàng{' '}
              <b>bắt buộc phải gửi bản cứng hợp đồng gốc có dấu đỏ</b> qua đường bưu điện hoặc
              chuyển phát nhanh về cho Điều phối viên để lưu trữ hồ sơ pháp lý đối soát.
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-2.5">
              {hardcopyReceived ? (
                /* Trạng thái ĐÃ CONFIRM: Khóa vĩnh viễn không cho hủy hay sửa */
                <div className="space-y-1.5 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      Đã xác nhận &amp; Lưu trữ bản cứng có dấu đỏ
                    </span>
                    <Tag color="success" className="m-0 text-[10px] font-bold">
                      ✓ ĐÃ LƯU TRỮ PHÁP LÝ
                    </Tag>
                  </div>
                  <div className="text-xs text-emerald-800">
                    Mã vận đơn bưu chính:{' '}
                    <b className="font-mono">{order.contract_postal_code || hardcopyNotes}</b>
                  </div>
                  <div className="text-[10px] text-emerald-600 italic">
                    Hệ thống đã khóa xác nhận, không thể chỉnh sửa hay hủy tick.
                  </div>
                </div>
              ) : (
                /* Trạng thái CHƯA CONFIRM: Nhập mã bưu điện chuẩn, hệ thống xác minh rồi mới tick & confirm */
                <div className="space-y-2">
                  <div className="text-[11px] text-gray-600">
                    Nhập mã bưu điện / mã vận đơn chuyển phát (VD: <b>EM123456789VN</b>,{' '}
                    <b>VTP98234812</b>, <b>EMS-VN88921</b>):
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      size="small"
                      placeholder="Nhập mã vận đơn bưu điện..."
                      value={hardcopyNotes}
                      disabled={isCancelled || verifyingHardcopy}
                      onChange={(e) => setHardcopyNotes(e.target.value)}
                      onPressEnter={handleVerifyAndConfirmHardcopy}
                      className="text-xs font-mono font-semibold uppercase"
                    />
                    <Button
                      size="small"
                      type="primary"
                      loading={verifyingHardcopy}
                      disabled={isCancelled || !hardcopyNotes.trim()}
                      onClick={handleVerifyAndConfirmHardcopy}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0"
                    >
                      Xác minh &amp; Chốt nhận
                    </Button>
                  </div>
                  <div className="text-[10px] text-gray-400 italic">
                    * Sau khi xác minh chính xác mã bưu chính và xác nhận, hệ thống sẽ chốt cố định
                    và khóa không cho phép sửa đổi nữa.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Preview & Soạn thảo Hợp đồng vận tải Chuẩn Nghị định 158/2024/NĐ-CP & Luật Đường bộ 2024 */}
      <OrderContractDocumentView
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        order={order}
        isContractLocked={isContractLocked}
        isEditingForm={isEditingForm}
        setIsEditingForm={setIsEditingForm}
        sendingEmail={sendingEmail}
        contractSentAt={contractSentAt}
        handleSendContractEmail={handleSendContractEmail}
        contractDetails={contractDetails}
        handleUpdateContractField={handleUpdateContractField}
        customTerms={customTerms}
        newTerm={newTerm}
        setNewTerm={setNewTerm}
        handleAddTerm={handleAddTerm}
        handleRemoveTerm={handleRemoveTerm}
      />
    </div>
  );
}
