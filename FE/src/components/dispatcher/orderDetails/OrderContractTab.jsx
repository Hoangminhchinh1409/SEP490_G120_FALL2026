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
  
  // Trạng thái bản cứng hợp đồng gốc qua bưu điện
  const [hardcopyReceived, setHardcopyReceived] = useState(order.contract_hardcopy_received || false);
  const [hardcopyNotes, setHardcopyNotes] = useState(order.contract_hardcopy_notes || '');
  const [savingHardcopy, setSavingHardcopy] = useState(false);

  // File upload state cho hợp đồng scan
  const [uploadingScan, setUploadingScan] = useState(false);
  const [contractFile, setContractFile] = useState(order.contract_file || null);
  const [contractFileData, setContractFileData] = useState(order.contract_file_data || null);
  const [contractUploadedAt, setContractUploadedAt] = useState(order.contract_uploaded_at || null);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Thêm điều khoản tùy biến
  const handleAddTerm = () => {
    if (!newTerm.trim()) {
      message.warning('Vui lòng nhập nội dung điều khoản bổ sung');
      return;
    }
    setCustomTerms([...customTerms, newTerm.trim()]);
    setNewTerm('');
  };

  const handleRemoveTerm = (idx) => {
    setCustomTerms(customTerms.filter((_, i) => i !== idx));
  };

  // Gửi hợp đồng qua Email cho khách hàng
  const handleSendContractEmail = async () => {
    try {
      setSendingEmail(true);
      const res = await orderApi.sendContractToCustomer(order.id || order.order_id, {
        custom_terms: customTerms
      });

      const now = new Date().toISOString();
      setContractSentAt(now);
      message.success(res?.message || 'Đã gửi hợp đồng vận tải chính thức qua email cho khách hàng!');
      onUpdateOrder?.({
        ...order,
        contract_sent_email_at: now,
        contract_custom_terms: customTerms
      });
    } catch (err) {
      console.error('sendContractToCustomer error:', err);
      message.error(err.message || 'Lỗi khi gửi email hợp đồng cho khách hàng');
    } finally {
      setSendingEmail(false);
    }
  };

  // Xác nhận đã nhận bản cứng có dấu đỏ
  const handleToggleHardcopy = async (checked) => {
    try {
      setSavingHardcopy(true);
      const res = await orderApi.confirmHardcopyContractReceived(order.id || order.order_id, {
        received: checked,
        notes: hardcopyNotes
      });

      setHardcopyReceived(checked);
      message.success(res?.message || (checked ? 'Đã xác nhận nhận bản cứng hợp đồng gốc có dấu đỏ!' : 'Đã cập nhật trạng thái bản cứng.'));
      onUpdateOrder?.({
        ...order,
        contract_hardcopy_received: checked,
        contract_hardcopy_received_at: checked ? new Date().toISOString() : null,
        contract_hardcopy_notes: hardcopyNotes
      });
    } catch (err) {
      console.error('confirmHardcopyContractReceived error:', err);
      message.error(err.message || 'Lỗi khi cập nhật trạng thái bản cứng hợp đồng');
    } finally {
      setSavingHardcopy(false);
    }
  };

  // Tải lên tệp hợp đồng đã scan (PDF)
  const handleFileUpload = async (e) => {
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

        message.success(res?.message || 'Đã lưu tệp scan hợp đồng vào hồ sơ đơn hàng!');
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
      {/* Banner Trạng thái Hợp đồng */}
      <div className="p-4 rounded-xl border bg-gradient-to-r from-blue-50/70 via-indigo-50/60 to-purple-50/60 border-indigo-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                <FileText size={17} className="text-indigo-600" />
                Hợp đồng Vận chuyển Hàng hóa Nội địa (Chuẩn ALS &amp; Trường Thành Logistics)
              </span>
              <Tag color={contractFileData || contractFile ? 'success' : contractSentAt ? 'processing' : 'warning'} className="font-semibold text-xs">
                {contractFileData || contractFile 
                  ? '✓ ĐÃ LƯU BẢN SCAN ĐÃ KÝ' 
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
              Xem mẫu hợp đồng
            </Button>
            <Button
              type="primary"
              icon={<Send size={14} />}
              loading={sendingEmail}
              onClick={handleSendContractEmail}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
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
          </div>

          {/* Danh sách điều khoản */}
          <div className="space-y-2">
            {customTerms.map((term, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-start justify-between gap-2 text-xs">
                <div className="flex items-start gap-2 text-gray-700">
                  <span className="font-bold text-indigo-600 shrink-0">{idx + 1}.</span>
                  <span className="leading-relaxed">{term}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveTerm(idx)}
                  className="text-gray-400 hover:text-red-600 transition-colors shrink-0 p-0.5"
                  title="Xóa điều khoản này"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Ô thêm điều khoản mới */}
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
                  <label className="text-[11px] text-indigo-700 hover:underline cursor-pointer font-medium">
                    Tải lên bản thay thế (PDF)
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingScan}
                    />
                  </label>
                </div>
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

            <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <Checkbox
                  checked={hardcopyReceived}
                  disabled={savingHardcopy}
                  onChange={(e) => handleToggleHardcopy(e.target.checked)}
                  className="font-bold text-xs text-gray-800"
                >
                  Đã nhận được bản cứng gốc có dấu đỏ
                </Checkbox>
                {hardcopyReceived && (
                  <Tag color="success" className="m-0 text-[10px] font-bold">
                    ✓ ĐÃ NHẬN BẢN GỐC
                  </Tag>
                )}
              </div>

              <Input
                size="small"
                placeholder="Ghi chú mã vận đơn bưu điện (VD: EMS - VN123456789...)"
                value={hardcopyNotes}
                onChange={(e) => setHardcopyNotes(e.target.value)}
                onBlur={() => {
                  if (hardcopyNotes !== (order.contract_hardcopy_notes || '')) {
                    handleToggleHardcopy(hardcopyReceived);
                  }
                }}
                className="text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Preview Mẫu Hợp đồng vận tải */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-indigo-900 text-sm font-bold">
            <FileText size={16} className="text-indigo-600" />
            <span>Mẫu Hợp đồng Vận chuyển Hàng hóa Nội địa — Đơn hàng #{order.tracking_number || order.id}</span>
          </div>
        }
        open={previewModalOpen}
        onCancel={() => setPreviewModalOpen(false)}
        width={820}
        footer={[
          <Button key="close" onClick={() => setPreviewModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="send"
            type="primary"
            icon={<Send size={14} />}
            loading={sendingEmail}
            onClick={() => {
              handleSendContractEmail();
              setPreviewModalOpen(false);
            }}
            className="bg-indigo-600 font-bold"
          >
            Gửi Email bản hợp đồng này
          </Button>
        ]}
      >
        <div className="max-h-[68vh] overflow-y-auto p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-800 space-y-4 font-sans leading-relaxed">
          <div className="text-center space-y-1">
            <div className="font-bold text-xs uppercase tracking-wider text-gray-600">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="font-semibold text-xs text-gray-600">Độc lập – Tự do – Hạnh phúc</div>
            <div className="w-24 h-0.5 bg-gray-300 mx-auto my-1"></div>
            <div className="font-bold text-base text-indigo-950 uppercase mt-2">HỢP ĐỒNG VẬN CHUYỂN HÀNG HÓA NỘI ĐỊA</div>
            <div className="text-gray-500 italic text-[11px]">Số: HDVC/ALS-{order.tracking_number || order.id}-{new Date().getFullYear()}</div>
          </div>

          <Divider className="my-2" />

          <div>
            <div className="font-bold text-indigo-900 mb-1">BÊN A (BÊN THUÊ VẬN CHUYỂN / KHÁCH HÀNG):</div>
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-white rounded-lg border border-gray-200 text-[11px]">
              <div>Tên công ty/Khách: <b>{order.customer || order.customer_name}</b></div>
              <div>Số điện thoại: <b>{order.customer_phone || 'Chưa cung cấp'}</b></div>
              <div>Email: <b>{order.customer_email || 'Chưa cung cấp'}</b></div>
              <div>Mã HAWB / Đơn hàng: <b>{order.hawb || order.tracking_number}</b></div>
            </div>
          </div>

          <div>
            <div className="font-bold text-indigo-900 mb-1">BÊN B (BÊN VẬN CHUYỂN):</div>
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-white rounded-lg border border-gray-200 text-[11px]">
              <div>Đơn vị: <b>CÔNG TY TNHH VẬN TẢI &amp; LOGISTICS HÀNG KHÔNG ALS (NEXLOG)</b></div>
              <div>Địa chỉ: Cảng Hàng không Quốc tế Nội Bài, Phú Minh, Sóc Sơn, Hà Nội</div>
              <div>Hotline / Điều phối: <b>1900 3133 / 0988 123 456</b></div>
              <div>Điều phối viên phụ trách: <b>{order.dispatcher_name || 'Ban Điều phối Vận tải ALS'}</b></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900">ĐIỀU 1: ĐỐI TƯỢNG VẬN CHUYỂN &amp; PHƯƠNG ÁN XE</div>
            <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-[11px] space-y-1">
              <div>• Lô hàng: <b>{order.cargo_name || order.cargo_type || 'Hàng hóa thông thường'}</b></div>
              <div>• Quy cách đóng gói: <b>{order.package_count || 1} {order.package_type || 'Kiện'}</b> (D×R×C: {order.length_cm || 0}×{order.width_cm || 0}×{order.height_cm || 0} cm)</div>
              <div>• Trọng lượng thực: <b>{order.weight || 0} kg</b> · Trọng lượng tính cước: <b>{order.chargeable || order.weight || 0} kg</b></div>
              <div>• Phương án xe vận chuyển: <b>{currentProposedSpec?.label || 'Xe tải chuyên dụng ALS'}</b></div>
              <div>• Điểm nhận hàng: <b>{order.pickup || order.pickup_address}</b></div>
              <div>• Điểm trả hàng: <b>{order.dropoff || order.delivery_address}</b></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900">ĐIỀU 2: CƯỚC PHÍ VẬN CHUYỂN &amp; PHƯƠNG THỨC THANH TOÁN</div>
            <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-[11px] space-y-1">
              <div>• Cước phí trọn gói thỏa thuận: <b className="text-indigo-700 text-xs font-mono">{currentAgreedPrice?.toLocaleString('vi-VN')} VNĐ</b> (Đã bao gồm lái xe, nhiên liệu, phí cầu đường tiêu chuẩn).</div>
              <div>• Thời gian miễn phí chờ bốc dỡ tại mỗi đầu kho: <b>60 phút</b>. Vượt quá 60 phút tính phí lưu xe 100.000 VNĐ / 30 phút.</div>
              <div>• Thời hạn thanh toán: Trong vòng 07 ngày làm việc kể từ ngày hoàn tất giao hàng kèm biên bản giao nhận có chữ ký (POD).</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900">ĐIỀU 3: ĐIỀU KHOẢN BỔ SUNG &amp; YÊU CẦU ĐẶC THÙ</div>
            <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-[11px] space-y-1">
              {customTerms.map((term, i) => (
                <div key={i}>• {term}</div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-indigo-900">ĐIỀU 4: TRÁCH NHIỆM BỒI THƯỜNG &amp; KHIẾU NẠI</div>
            <div className="p-2.5 bg-white rounded-lg border border-gray-200 text-[11px] space-y-1 text-gray-600">
              <div>• Bên B chịu trách nhiệm bồi thường thiệt hại hàng hóa hư hỏng, mất mát do lỗi của lái xe theo đúng giá trị thực tế của hàng hóa có hóa đơn chứng từ hợp lệ, tối đa theo hạn mức bảo hiểm vận tải của ALS.</div>
              <div>• Bên A có quyền gửi khiếu nại bồi thường trong vòng <b>14 ngày</b> kể từ khi nhận hàng.</div>
            </div>
          </div>

          <div className="pt-4 grid grid-cols-2 text-center text-[11px] font-bold text-gray-700">
            <div>
              <div>ĐẠI DIỆN BÊN A</div>
              <div className="text-[10px] font-normal text-gray-500 italic mt-0.5">(Ký, ghi rõ họ tên và đóng dấu)</div>
              <div className="h-16"></div>
              <div className="text-gray-400 font-normal">[Chữ ký &amp; Con dấu bên thuê]</div>
            </div>
            <div>
              <div>ĐẠI DIỆN BÊN B</div>
              <div className="text-[10px] font-normal text-gray-500 italic mt-0.5">(Ký, ghi rõ họ tên và đóng dấu)</div>
              <div className="h-16"></div>
              <div className="text-indigo-700 font-bold">CÔNG TY TNHH VẬN TẢI ALS</div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

