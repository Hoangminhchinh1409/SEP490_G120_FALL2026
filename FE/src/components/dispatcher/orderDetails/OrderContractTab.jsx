import React, { useState } from 'react';
import { Button, Tag, Input, Alert, message, Modal, Divider, Checkbox } from 'antd';
import { 
  FileText, 
  Send, 
  Upload, 
  CheckCircle2, 
  Download, 
  Plus, 
  Trash2, 
  Clock, 
  Mail, 
  Package, 
  Truck, 
  FileCheck,
  Building2,
  ExternalLink
} from 'lucide-react';
import { orderApi } from '../../../api/orderApi';

export default function OrderContractTab({
  order,
  currentAgreedPrice,
  proposedVehicleType,
  currentProposedSpec,
  onUpdateOrder
}) {
  const isCancelled = order.status === 'CANCELLED' || order.status === 'CLOSED';
  // Chỉ khi khách gửi lại bản đã có chữ ký thật thì mới tính là hợp đồng xác nhận thành công và khóa
  const isSigned = Boolean(order.contract_file || order.contract_uploaded || order.signed_order_contract_file);
  const isHardcopyDone = Boolean(order.contract_hardcopy_received);
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
      carrier_name: saved.carrier_name || 'CÔNG TY TNHH VẬN TẢI & LOGISTICS HÀNG KHÔNG ALS (NEXLOG)',
      carrier_tax_code: saved.carrier_tax_code || '0102345678',
      carrier_address: saved.carrier_address || 'Cảng Hàng không Quốc tế Nội Bài, Xã Phú Minh, Huyện Sóc Sơn, TP. Hà Nội',
      carrier_phone: saved.carrier_phone || '1900 3133 / 0988 123 456',
      carrier_rep: saved.carrier_rep || order.dispatcher_name || 'Ban Điều phối Vận tải Hàng không ALS',
      carrier_cid: saved.carrier_cid || '001092008899',

      customer_name: saved.customer_name || order.customer || order.customer_name || '',
      customer_tax_code: saved.customer_tax_code || order.customer_tax_code || order.customer_cid || '',
      customer_address: saved.customer_address || order.customer_address || order.pickup || order.pickup_address || '',
      customer_phone: saved.customer_phone || order.customer_phone || '',
      customer_email: saved.customer_email || order.customer_email || '',

      pickup_time: saved.pickup_time || order.pickup_time || 'Theo thông báo điều vận của ALS',
      delivery_time: saved.delivery_time || 'Sau khi giao trả hàng hóa và hoàn tất ký nhận Biên bản giao nhận (POD)',
      pickup_address: saved.pickup_address || order.pickup || order.pickup_address || '',
      delivery_address: saved.delivery_address || order.dropoff || order.delivery_address || '',
      distance_km: saved.distance_km || order.estimated_distance_km || 35.5,

      cargo_name: saved.cargo_name || order.cargo_name || order.cargo_type || 'Hàng hóa thông thường',
      package_info: saved.package_info || `${order.package_count || 1} ${order.package_type || 'Kiện'} (${order.length_cm || 0}×${order.width_cm || 0}×${order.height_cm || 0} cm)`,
      weight: saved.weight || order.weight || 0,
      chargeable_weight: saved.chargeable_weight || order.chargeable || order.weight || 0,
      truck_model: saved.truck_model || currentProposedSpec?.label || 'Xe tải chuyên dụng ALS',

      price_amount: saved.price_amount !== undefined ? saved.price_amount : (currentAgreedPrice || 0),
      payment_method: saved.payment_method || 'Chuyển khoản ngân hàng hoặc tiền mặt',
      payment_term: saved.payment_term || 'Trong vòng 07 ngày làm việc kể từ ngày hoàn tất giao hàng kèm POD',
      waiting_fee_rule: saved.waiting_fee_rule || 'Miễn phí chờ bốc dỡ 60 phút tại mỗi điểm; vượt quá tính 100.000 VNĐ / block 30 phút theo hợp đồng nguyên tắc ALS'
    };
  });

  const [isEditingForm, setIsEditingForm] = useState(false);
  
  // Trạng thái bản cứng hợp đồng gốc qua bưu điện
  const [hardcopyReceived, setHardcopyReceived] = useState(order.contract_hardcopy_received || false);
  const [hardcopyNotes, setHardcopyNotes] = useState(order.contract_postal_code || order.contract_hardcopy_notes || '');
  const [verifyingHardcopy, setVerifyingHardcopy] = useState(false);

  // File upload state cho hợp đồng scan
  const [uploadingScan, setUploadingScan] = useState(false);
  const [contractFile, setContractFile] = useState(order.contract_file || order.signed_order_contract_file || null);
  const [contractFileData, setContractFileData] = useState(order.contract_file_data || null);
  const [contractUploadedAt, setContractUploadedAt] = useState(order.contract_uploaded_at || null);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Thêm điều khoản tùy biến
  const handleAddTerm = () => {
    if (isContractLocked) {
      message.warning('Hợp đồng đã có bản ký xác nhận thành công, không thể chỉnh sửa điều khoản nữa!');
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
      message.warning('Hợp đồng đã có bản ký xác nhận thành công, không thể chỉnh sửa điều khoản nữa!');
      return;
    }
    setCustomTerms(customTerms.filter((_, i) => i !== idx));
  };

  // Cập nhật thông tin chi tiết hợp đồng
  const handleUpdateContractField = (field, value) => {
    setContractDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Gửi hợp đồng qua Email cho khách hàng (kèm toàn bộ thông tin đã chỉnh sửa)
  const handleSendContractEmail = async () => {
    if (isContractLocked) {
      message.warning('Hợp đồng đã có bản ký xác nhận thành công hoặc đơn đã hủy, không thể gửi lại email!');
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
      message.success(res?.message || 'Đã gửi hợp đồng vận tải chính thức qua email cho khách hàng!');
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
      message.info('Bản cứng hợp đồng gốc đã được xác minh và lưu trữ pháp lý hoàn tất, không thể thay đổi nữa.');
      return;
    }

    const postalCode = hardcopyNotes.trim().toUpperCase().replace(/\s+/g, '');
    if (!postalCode) {
      message.error('Vui lòng nhập Mã vận đơn / Mã bưu điện chuyển phát nhanh trước khi xác nhận nhận bản cứng!');
      return;
    }

    const standardVnPostRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i;
    const generalPostalRegex = /^(VNPost|EMS|VT|VTP|SPX|GHN|J&T|JT)?[-_]?[A-Z0-9]{8,25}$/i;
    const isValidFormat = standardVnPostRegex.test(postalCode) || generalPostalRegex.test(postalCode) || /^[A-Z0-9]{8,25}$/.test(postalCode);

    if (!isValidFormat) {
      message.error(`Mã bưu cục/vận đơn "${postalCode}" không hợp lệ. Vui lòng nhập đúng mã bưu điện (VD: EM123456789VN, VTP98234812, EMS-VN88921...)`);
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
      message.success(res?.message || `Đã xác minh mã bưu điện [${postalCode}] và chốt lưu trữ bản cứng thành công!`);
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

    if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
      message.warning('Vui lòng chọn tệp hợp đồng định dạng PDF đã có chữ ký/dấu đỏ!');
      return;
    }

    try {
      setUploadingScan(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;
        const res = await orderApi.uploadContractFile(order.id || order.order_id, {
          file_name: file.name,
          file_data: base64Data,
          file_size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
        });

        const now = new Date().toISOString();
        setContractFile(file.name);
        setContractFileData(base64Data);
        setContractUploadedAt(now);

        message.success(res?.message || 'Đã tiếp nhận bản scan hợp đồng có chữ ký! Hợp đồng chính thức được xác nhận thành công.');
        onUpdateOrder?.({
          ...order,
          contract_uploaded: true,
          contract_file: file.name,
          contract_file_data: base64Data,
          contract_uploaded_at: now,
          status: 'READY_FOR_PLANNING',
          web_workflow: {
            ...(order.web_workflow || {}),
            stage: 'CONTRACT_SIGNED',
            contract_file: file.name
          }
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('uploadContractFile error:', err);
      message.error(err.message || 'Lỗi khi tải tệp hợp đồng');
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
              <Tag color={isSigned ? 'success' : isCancelled ? 'red' : contractSentAt ? 'processing' : 'warning'} className="font-semibold text-xs">
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
              Hệ thống tự động lập hợp đồng dựa trên thông tin hàng hóa, phương án xe <b>{currentProposedSpec?.label}</b> và cước phí đã thỏa thuận <b>{currentAgreedPrice?.toLocaleString('vi-VN')} VNĐ</b>.
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
              Đã gửi tới: <b>{order.customer_email || 'Email khách hàng'}</b> vào lúc {new Date(contractSentAt).toLocaleString('vi-VN')}
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
                Các điều khoản này sẽ được in trực tiếp vào <b>Điều 5 / Điều 7</b> của Hợp đồng gửi khách.
              </span>
            </div>
            {isContractLocked && (
              <Tag color="default" className="text-[10px] m-0">Đã khóa chỉnh sửa</Tag>
            )}
          </div>

          {/* Danh sách điều khoản */}
          <div className="space-y-2">
            {customTerms.map((term, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-start justify-between gap-2 text-xs">
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
                      <div className="font-bold text-xs text-emerald-950 truncate max-w-[200px]" title={contractFile || 'hop-dong-van-tai-als.pdf'}>
                        {contractFile || 'hop-dong-van-tai-als.pdf'}
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        Đã tải lên lúc: {contractUploadedAt ? new Date(contractUploadedAt).toLocaleString('vi-VN') : 'Gần đây'}
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
                <div className="text-xs font-semibold text-gray-700">Chưa có tệp scan hợp đồng đã ký</div>
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
              Theo quy định vận hành của ALS, khách hàng <b>bắt buộc phải gửi bản cứng hợp đồng gốc có dấu đỏ</b> qua đường bưu điện hoặc chuyển phát nhanh về cho Điều phối viên để lưu trữ hồ sơ pháp lý đối soát.
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
                    Mã vận đơn bưu chính: <b className="font-mono">{order.contract_postal_code || hardcopyNotes}</b>
                  </div>
                  <div className="text-[10px] text-emerald-600 italic">
                    Hệ thống đã khóa xác nhận, không thể chỉnh sửa hay hủy tick.
                  </div>
                </div>
              ) : (
                /* Trạng thái CHƯA CONFIRM: Nhập mã bưu điện chuẩn, hệ thống xác minh rồi mới tick & confirm */
                <div className="space-y-2">
                  <div className="text-[11px] text-gray-600">
                    Nhập mã bưu điện / mã vận đơn chuyển phát (VD: <b>EM123456789VN</b>, <b>VTP98234812</b>, <b>EMS-VN88921</b>):
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
                    * Sau khi xác minh chính xác mã bưu chính và xác nhận, hệ thống sẽ chốt cố định và khóa không cho phép sửa đổi nữa.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Preview & Soạn thảo Hợp đồng vận tải Chuẩn Nghị định 158/2024/NĐ-CP & Luật Đường bộ 2024 */}
      <Modal
        title={
          <div className="flex items-center justify-between w-full pr-8">
            <div className="flex items-center gap-2 text-indigo-900 text-sm font-bold">
              <FileText size={16} className="text-indigo-600" />
              <span>Hợp đồng Vận tải Đường bộ (NĐ 158/2024/NĐ-CP) — Đơn #{order.order_code || order.tracking_number || order.id}</span>
            </div>
            {!isContractLocked && (
              <Button
                size="small"
                type={isEditingForm ? 'primary' : 'default'}
                onClick={() => setIsEditingForm(!isEditingForm)}
                className={isEditingForm ? 'bg-amber-600 font-semibold text-xs' : 'text-xs font-semibold'}
              >
                {isEditingForm ? '✓ Xem bản xem trước (Preview)' : '✏️ Chỉnh sửa thông tin hợp đồng'}
              </Button>
            )}
          </div>
        }
        open={previewModalOpen}
        onCancel={() => setPreviewModalOpen(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setPreviewModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="send"
            type="primary"
            icon={<Send size={14} />}
            loading={sendingEmail}
            disabled={isContractLocked}
            onClick={() => {
              handleSendContractEmail();
              setPreviewModalOpen(false);
            }}
            className="bg-indigo-600 font-bold"
          >
            {contractSentAt ? 'Lưu & Gửi lại Email cho Khách' : 'Lưu & Gửi Email Hợp đồng cho Khách'}
          </Button>
        ]}
      >
        <div className="max-h-[72vh] overflow-y-auto p-5 bg-white rounded-xl border border-gray-200 text-xs text-gray-800 space-y-4 font-sans leading-relaxed">
          {/* Thông báo chế độ chỉnh sửa */}
          {isEditingForm && !isContractLocked && (
            <Alert
              type="info"
              showIcon
              title="Chế độ Chỉnh sửa Hợp đồng trực tiếp"
              description="Điều phối viên có thể chỉnh sửa mọi thông tin về chủ thể, hành trình, cước phí, hạn mức bồi thường và quy tắc giờ chờ theo đàm phán với khách hàng trước khi bấm gửi."
              className="rounded-lg mb-2"
            />
          )}

          {/* Quốc hiệu & Tiêu ngữ chuẩn */}
          <div className="text-center space-y-1">
            <div className="font-bold text-xs uppercase tracking-wider text-gray-800">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="font-semibold text-xs text-gray-800">Độc lập - Tự do - Hạnh phúc</div>
            <div className="text-gray-400 text-xs">---o0o---</div>
            <div className="font-bold text-base text-indigo-950 uppercase mt-2">HỢP ĐỒNG VẬN TẢI HÀNG HÓA ĐƯỜNG BỘ</div>
            <div className="text-gray-500 italic text-[11px]">
              Số: {order.order_code || order.tracking_number || order.id}/HĐVT-{new Date().getFullYear()}
            </div>
            <div className="text-[10px] text-gray-400 italic space-y-0.5 pt-1">
              <div>- Căn cứ Bộ luật Dân sự số 91/2015/QH13;</div>
              <div>- Căn cứ Luật Đường bộ số 35/2024/QH15;</div>
              <div>- Căn cứ Nghị định số 158/2024/NĐ-CP quy định về hoạt động vận tải đường bộ;</div>
              <div>- Hôm nay, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}, chúng tôi gồm có:</div>
            </div>
          </div>

          <Divider className="my-2" />

          {/* BÊN A: BÊN VẬN TẢI (ĐƠN VỊ KINH DOANH VẬN TẢI) */}
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-150 space-y-1.5">
            <div className="font-bold text-xs text-indigo-950 uppercase flex items-center justify-between">
              <span>BÊN VẬN TẢI (BÊN A): ĐƠN VỊ KINH DOANH VẬN TẢI</span>
              <Tag color="blue" className="m-0 text-[10px]">ALS LOGISTICS</Tag>
            </div>
            {isEditingForm ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-gray-500 block mb-0.5">Tên đơn vị vận tải:</span>
                  <Input
                    size="small"
                    value={contractDetails.carrier_name}
                    onChange={(e) => handleUpdateContractField('carrier_name', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Mã số thuế:</span>
                  <Input
                    size="small"
                    value={contractDetails.carrier_tax_code}
                    onChange={(e) => handleUpdateContractField('carrier_tax_code', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Địa chỉ trụ sở:</span>
                  <Input
                    size="small"
                    value={contractDetails.carrier_address}
                    onChange={(e) => handleUpdateContractField('carrier_address', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Hotline / Điện thoại:</span>
                  <Input
                    size="small"
                    value={contractDetails.carrier_phone}
                    onChange={(e) => handleUpdateContractField('carrier_phone', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Đại diện ký hợp đồng:</span>
                  <Input
                    size="small"
                    value={contractDetails.carrier_rep}
                    onChange={(e) => handleUpdateContractField('carrier_rep', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Số CCCD đại diện Bên A:</span>
                  <Input
                    size="small"
                    value={contractDetails.carrier_cid}
                    onChange={(e) => handleUpdateContractField('carrier_cid', e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>• Tên đơn vị vận tải: <b>{contractDetails.carrier_name}</b></div>
                <div>• Mã số thuế: <b>{contractDetails.carrier_tax_code}</b></div>
                <div>• Địa chỉ trụ sở: {contractDetails.carrier_address}</div>
                <div>• Điện thoại / Hotline: <b>{contractDetails.carrier_phone}</b></div>
                <div>• Đại diện theo pháp luật: <b>{contractDetails.carrier_rep}</b></div>
                <div>• Số định danh cá nhân / CCCD đại diện: <b>{contractDetails.carrier_cid}</b></div>
              </div>
            )}
          </div>

          {/* BÊN B: BÊN THUÊ VẬN TẢI (KHÁCH HÀNG) */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
            <div className="font-bold text-xs text-gray-900 uppercase flex items-center justify-between">
              <span>BÊN THUÊ VẬN TẢI (BÊN B): TỔ CHỨC / CÁ NHÂN THUÊ VẬN TẢI</span>
              <Tag color="cyan" className="m-0 text-[10px]">KHÁCH HÀNG</Tag>
            </div>
            {isEditingForm ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-gray-500 block mb-0.5">Tên tổ chức / cá nhân khách hàng:</span>
                  <Input
                    size="small"
                    value={contractDetails.customer_name}
                    onChange={(e) => handleUpdateContractField('customer_name', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Mã số thuế / Số CCCD khách hàng:</span>
                  <Input
                    size="small"
                    value={contractDetails.customer_tax_code}
                    onChange={(e) => handleUpdateContractField('customer_tax_code', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Địa chỉ khách hàng:</span>
                  <Input
                    size="small"
                    value={contractDetails.customer_address}
                    onChange={(e) => handleUpdateContractField('customer_address', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Số điện thoại liên hệ:</span>
                  <Input
                    size="small"
                    value={contractDetails.customer_phone}
                    onChange={(e) => handleUpdateContractField('customer_phone', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Email tiếp nhận hợp đồng:</span>
                  <Input
                    size="small"
                    value={contractDetails.customer_email}
                    onChange={(e) => handleUpdateContractField('customer_email', e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Mã HAWB / Đơn hàng:</span>
                  <span className="font-mono font-bold text-indigo-700">{order.hawb || order.order_code || order.tracking_number}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>• Tên tổ chức / cá nhân: <b>{contractDetails.customer_name}</b></div>
                <div>• Mã số thuế / Số CCCD: <b>{contractDetails.customer_tax_code || 'Chưa cung cấp'}</b></div>
                <div>• Địa chỉ: <b>{contractDetails.customer_address || 'Địa chỉ khách hàng'}</b></div>
                <div>• Số điện thoại liên hệ: <b>{contractDetails.customer_phone || 'Chưa cung cấp'}</b></div>
                <div>• Email tiếp nhận: <b>{contractDetails.customer_email || 'Chưa cung cấp'}</b></div>
                <div>• Mã HAWB / Đơn hàng: <b>{order.hawb || order.order_code || order.tracking_number}</b></div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-gray-600 italic">
            Hai bên cùng thỏa thuận và ký kết Hợp đồng vận tải với các điều khoản cụ thể sau đây:
          </div>

          {/* ĐIỀU 1 */}
          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900 uppercase text-xs">
              ĐIỀU 1. THÔNG TIN CHI TIẾT VỀ VIỆC THỰC HIỆN HỢP ĐỒNG
            </div>
            <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-2">
              <div>
                <b>1. Thời gian thực hiện:</b>
                {isEditingForm ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    <div>
                      <span className="text-gray-500 block mb-0.5">Thời gian bắt đầu (dự kiến):</span>
                      <Input
                        size="small"
                        value={contractDetails.pickup_time}
                        onChange={(e) => handleUpdateContractField('pickup_time', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-0.5">Thời gian kết thúc:</span>
                      <Input
                        size="small"
                        value={contractDetails.delivery_time}
                        onChange={(e) => handleUpdateContractField('delivery_time', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="pl-3 mt-0.5 space-y-0.5">
                    <div>- Thời gian bắt đầu thực hiện: <b>{contractDetails.pickup_time}</b></div>
                    <div>- Thời gian kết thúc hợp đồng: <b>{contractDetails.delivery_time}</b></div>
                  </div>
                )}
              </div>

              <div>
                <b>2. Hành trình vận chuyển:</b>
                {isEditingForm ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    <div>
                      <span className="text-gray-500 block mb-0.5">Điểm đầu (Điểm lấy hàng):</span>
                      <Input
                        size="small"
                        value={contractDetails.pickup_address}
                        onChange={(e) => handleUpdateContractField('pickup_address', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-0.5">Điểm cuối (Điểm trả hàng):</span>
                      <Input
                        size="small"
                        value={contractDetails.delivery_address}
                        onChange={(e) => handleUpdateContractField('delivery_address', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-0.5">Cự ly ước tính (km):</span>
                      <Input
                        size="small"
                        value={contractDetails.distance_km}
                        onChange={(e) => handleUpdateContractField('distance_km', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="pl-3 mt-0.5 space-y-0.5">
                    <div>- Địa chỉ điểm đầu (Điểm lấy hàng): <b>{contractDetails.pickup_address}</b></div>
                    <div>- Địa chỉ điểm cuối (Điểm trả hàng): <b>{contractDetails.delivery_address}</b></div>
                    <div>- Các điểm xếp, dỡ hàng hóa trên hành trình: <b>Theo lộ trình gán chuyến của Điều phối viên</b></div>
                    <div>- Cự ly hành trình vận chuyển ước tính: <b>{contractDetails.distance_km} km</b></div>
                  </div>
                )}
              </div>

              <div>
                <b>3. Số lượng &amp; Khối lượng hàng hóa vận chuyển:</b>
                {isEditingForm ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    <div>
                      <span className="text-gray-500 block mb-0.5">Tên loại hàng hóa:</span>
                      <Input
                        size="small"
                        value={contractDetails.cargo_name}
                        onChange={(e) => handleUpdateContractField('cargo_name', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-0.5">Quy cách đóng gói:</span>
                      <Input
                        size="small"
                        value={contractDetails.package_info}
                        onChange={(e) => handleUpdateContractField('package_info', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-0.5">Khối lượng thực tế (kg):</span>
                      <Input
                        size="small"
                        value={contractDetails.weight}
                        onChange={(e) => handleUpdateContractField('weight', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-0.5">Phương án xe Bên A bố trí:</span>
                      <Input
                        size="small"
                        value={contractDetails.truck_model}
                        onChange={(e) => handleUpdateContractField('truck_model', e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="pl-3 mt-0.5 space-y-0.5">
                    <div>- Tên hàng hóa: <b>{contractDetails.cargo_name}</b></div>
                    <div>- Quy cách đóng gói: <b>{contractDetails.package_info}</b></div>
                    <div>- Khối lượng hàng hóa thực tế: <b>{contractDetails.weight} kg</b> · Trọng lượng tính cước: <b>{contractDetails.chargeable_weight} kg</b></div>
                    <div>- Phương án phương tiện vận chuyển Bên A bố trí: <b>{contractDetails.truck_model}</b></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ĐIỀU 2 */}
          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900 uppercase text-xs">
              ĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN
            </div>
            <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1.5">
              {isEditingForm ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500 block mb-0.5">Tổng giá trị hợp đồng (VNĐ):</span>
                    <Input
                      size="small"
                      value={contractDetails.price_amount}
                      onChange={(e) => handleUpdateContractField('price_amount', Number(e.target.value) || 0)}
                      className="text-xs font-bold text-red-600"
                    />
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Phương thức thanh toán:</span>
                    <Input
                      size="small"
                      value={contractDetails.payment_method}
                      onChange={(e) => handleUpdateContractField('payment_method', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-500 block mb-0.5">Thời hạn thanh toán:</span>
                    <Input
                      size="small"
                      value={contractDetails.payment_term}
                      onChange={(e) => handleUpdateContractField('payment_term', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-500 block mb-0.5">Quy định giờ chờ bốc dỡ:</span>
                    <Input
                      size="small"
                      value={contractDetails.waiting_fee_rule}
                      onChange={(e) => handleUpdateContractField('waiting_fee_rule', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>• <b>Tổng giá trị hợp đồng:</b> <b className="text-red-700 font-mono text-xs">{Number(contractDetails.price_amount || 0).toLocaleString('vi-VN')} VNĐ</b> (Đã bao gồm chi phí nhiên liệu, phương tiện, lái xe và phí cầu đường cơ bản).</div>
                  <div>• <b>Phương thức thanh toán:</b> {contractDetails.payment_method}.</div>
                  <div>• <b>Thời hạn thanh toán:</b> {contractDetails.payment_term}.</div>
                  <div>• <b>Định mức thời gian chờ:</b> {contractDetails.waiting_fee_rule}.</div>
                </>
              )}
            </div>
          </div>

          {/* ĐIỀU 3 */}
          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900 uppercase text-xs">
              ĐIỀU 3. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A (BÊN VẬN TẢI)
            </div>
            <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1">
              <div>• Cung cấp phương tiện vận chuyển đúng chất lượng, đúng thời gian và địa điểm đã thỏa thuận tại Điều 1; đảm bảo phương tiện đáp ứng đầy đủ các điều kiện an toàn kỹ thuật theo quy định pháp luật.</div>
              <div>• Thực hiện nghiêm chỉnh các nghĩa vụ thuế đối với Nhà nước liên quan đến hoạt động cung cấp dịch vụ vận tải theo hợp đồng này.</div>
              <div>• Mua bảo hiểm trách nhiệm dân sự của chủ xe cơ giới đối với hàng hóa theo quy định pháp luật.</div>
              <div>• Có quyền yêu cầu Bên B thanh toán đầy đủ, đúng hạn giá trị hợp đồng; từ chối vận chuyển nếu Bên B vi phạm các quy định về an toàn, cấm vận chuyển hàng hóa nguy hiểm, chất cấm.</div>
              <div>• <b>Đường dây nóng tiếp nhận phản ánh, khiếu nại của khách hàng: 1900 3133 / 0988 123 456</b> (Ban Điều phối ALS).</div>
            </div>
          </div>

          {/* ĐIỀU 4 */}
          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900 uppercase text-xs">
              ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B (BÊN THUÊ VẬN TẢI)
            </div>
            <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1">
              <div>• Thanh toán đầy đủ giá trị hợp đồng cho Bên A theo đúng thời hạn và phương thức đã thỏa thuận.</div>
              <div>• Cung cấp chính xác, đầy đủ thông tin về hàng hóa và tạo điều kiện thuận lợi để Bên A thực hiện việc xếp dỡ hàng hóa đúng tiến độ.</div>
              <div>• Chấp hành nghiêm chỉnh các quy định về an toàn giao thông; không gửi vũ khí, chất cháy nổ, chất độc hại hoặc hàng hóa cấm lưu thông lên phương tiện.</div>
              <div>• Có quyền yêu cầu Bên A bồi thường thiệt hại nếu Bên A vi phạm cam kết trong hợp đồng gây thiệt hại về hàng hóa (hư hỏng, mất mát). Khách hàng có quyền tạo khiếu nại trong vòng <b>14 ngày</b> kể từ khi nhận hàng.</div>
            </div>
          </div>

          {/* ĐIỀU 5 */}
          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900 uppercase text-xs">
              ĐIỀU 5. CAM KẾT THỰC HIỆN VÀ ĐỀN BÙ THIỆT HẠI
            </div>
            <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1.5">
              <div>• Hai bên cam kết thực hiện nghiêm túc các điều khoản đã thỏa thuận trong hợp đồng này. Mọi sửa đổi, bổ sung phải được sự đồng ý bằng văn bản của cả hai bên.</div>
              <div>• <b>Quy định về đền bù thiệt hại:</b>
                <div className="pl-3 mt-0.5 space-y-0.5">
                  <div>- Trường hợp Bên A vi phạm cam kết dẫn đến việc chậm trễ thời gian, hủy chuyến hoặc làm hư hỏng, mất mát tài sản (hàng hóa) của Bên B do lỗi chủ quan của Bên A, Bên A chịu trách nhiệm đền bù thiệt hại thỏa đáng theo thỏa thuận hoặc theo quy định của pháp luật hiện hành.</div>
                  <div>- <b>Trường hợp miễn trách nhiệm cho Bên A:</b> Nếu Bên A đã chủ động liên hệ trước với Bên B để thông báo về lịch trình/thời gian di chuyển, nhưng khi phương tiện hoặc nhân sự của Bên A đến điểm giao nhận đúng theo thông báo mà đại diện hoặc người nhận của Bên B vắng mặt, không có người tiếp nhận, thì mọi gián đoạn, phát sinh hoặc thiệt hại liên quan được tính là <b>lỗi thuộc về Bên B</b>. Trong trường hợp này, Bên A được miễn toàn bộ trách nhiệm về việc chậm trễ các điểm tiếp theo và có quyền áp dụng chi phí chờ đợi, chi phí lưu kho/bãi hoặc chi phí vận chuyển phát sinh (nếu có) theo quy định của công ty.</div>
                  <div>- Trường hợp Bên B hủy hợp đồng hoặc vi phạm các nghĩa vụ gây thiệt hại cho Bên A, Bên B chịu trách nhiệm bồi thường chi phí phát sinh thực tế cho Bên A theo biểu phí hủy đơn đã công bố.</div>
                </div>
              </div>
            </div>
          </div>

          {/* ĐIỀU 6: ĐIỀU KHOẢN BỔ SUNG RIÊNG */}
          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900 uppercase text-xs flex items-center justify-between">
              <span>ĐIỀU 6. CÁC ĐIỀU KHOẢN BỔ SUNG THỎA THUẬN RIÊNG</span>
              <span className="text-[10px] text-gray-500 font-normal">({customTerms.length} điều khoản)</span>
            </div>
            <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-150 text-[11px] space-y-1.5">
              {customTerms.length > 0 ? (
                customTerms.map((term, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div>• {term}</div>
                    {isEditingForm && !isContractLocked && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTerm(i)}
                        className="text-red-500 hover:text-red-700 font-semibold cursor-pointer shrink-0"
                      >
                        [Xóa]
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-gray-400 italic">Chưa có điều khoản bổ sung riêng nào.</div>
              )}

              {isEditingForm && !isContractLocked && (
                <div className="pt-2 flex items-center gap-2">
                  <Input
                    size="small"
                    placeholder="Thêm điều khoản riêng mới..."
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    onPressEnter={handleAddTerm}
                    className="text-xs"
                  />
                  <Button size="small" type="primary" onClick={handleAddTerm} className="bg-indigo-600 text-xs shrink-0">
                    Thêm
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ĐIỀU 7 */}
          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900 uppercase text-xs">
              ĐIỀU 7. ĐIỀU KHOẢN THI HÀNH
            </div>
            <div className="p-3 bg-gray-50/70 rounded-lg border border-gray-200 text-[11px] space-y-1">
              <div>• Hợp đồng này có hiệu lực kể từ ngày ký.</div>
              <div>• Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để thực hiện. Khách hàng thực hiện tải lên bản scan có dấu đỏ lên hệ thống NEXLOG và có nghĩa vụ gửi bản cứng có dấu đỏ gốc qua đường bưu chính về cho Ban Điều phối ALS.</div>
            </div>
          </div>

          {/* Chữ ký 2 bên chuẩn form mẫu */}
          <div className="pt-6 grid grid-cols-2 text-center text-xs font-bold text-gray-800">
            <div>
              <div className="uppercase">ĐẠI DIỆN BÊN A (BÊN VẬN TẢI)</div>
              <div className="text-[10px] font-normal text-gray-500 italic mt-0.5">(Ký, đóng dấu và ghi rõ họ tên)</div>
              <div className="h-20"></div>
              <div className="text-indigo-800 font-bold">{contractDetails.carrier_name}</div>
            </div>
            <div>
              <div className="uppercase">ĐẠI DIỆN BÊN B (THUÊ VẬN TẢI)</div>
              <div className="text-[10px] font-normal text-gray-500 italic mt-0.5">(Ký, đóng dấu và ghi rõ họ tên)</div>
              <div className="h-20"></div>
              <div className="text-gray-400 font-normal">[{contractDetails.customer_name || 'Chữ ký & Con dấu bên thuê'}]</div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

