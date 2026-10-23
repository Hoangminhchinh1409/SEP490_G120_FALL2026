"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Result, Tag, Spin, message, Alert, Input, Divider } from 'antd';
import { 
  FileCheck, 
  PenTool, 
  CheckCircle2, 
  RotateCcw, 
  ShieldCheck, 
  Download, 
  Building, 
  DollarSign, 
  Calendar,
  Lock
} from 'lucide-react';
import { orderApi } from '../../../src/api/orderApi';

export default function ContractSignView() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [signedData, setSignedData] = useState(null);

  // Canvas chữ ký số
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!token) return;
    const loadOrder = async () => {
      try {
        setLoading(true);
        const data = await orderApi.getOrderByToken(token);
        setOrder(data);
        setSignerName(data.customer_name || '');

        if (data.web_workflow?.stage === 'CONTRACT_SIGNED' || data.web_workflow?.signed_contract) {
          setIsSigned(true);
          setSignedData(data.web_workflow.signed_contract);
        }
      } catch (err) {
        console.error('Load contract error:', err);
        message.error('Không tìm thấy thông tin hợp đồng hoặc liên kết đã hết hạn.');
      } finally {
        setLoading(false);
      }
    };
    loadOrder();
  }, [token]);

  // Thiết lập Canvas nét vẽ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e1b4b'; // Mực xanh đen chuẩn chữ ký
  }, [loading, isSigned]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSubmitSignature = async () => {
    if (!hasDrawn) {
      message.error('Quý khách vui lòng vẽ chữ ký số lên khung ký trước khi xác nhận!');
      return;
    }
    if (!signerName || !signerName.trim()) {
      message.error('Vui lòng nhập họ tên người đại diện ký hợp đồng!');
      return;
    }

    const canvas = canvasRef.current;
    const signatureDataUrl = canvas.toDataURL('image/png');

    try {
      setSigning(true);
      const res = await orderApi.customerSignContract(token, {
        signature_data: signatureDataUrl,
        signer_name: signerName.trim()
      });

      message.success('Ký chữ ký số thành công! Hợp đồng đã được lưu trực tiếp vào hồ sơ đơn hàng của điều phối.');
      setIsSigned(true);
      setSignedData({
        signer_name: signerName.trim(),
        signed_at: new Date().toISOString(),
        signature_data: signatureDataUrl,
        contract_file: `HD-${order.order_code}-SIGNED.pdf`
      });
    } catch (err) {
      console.error('Sign contract error:', err);
      message.error(err.message || 'Lỗi khi ký số hợp đồng');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Spin size="large" />
        <p className="mt-4 text-sm text-slate-500 font-medium">Đang khởi tạo Hợp đồng Điện tử &amp; Khung Ký số...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wide">
            <Lock size={14} /> Chữ Ký Số Điện Tử Hợp Pháp
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hợp Đồng Vận Chuyển Hàng Hóa Điện Tử
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            Hồ sơ chứng từ của Quý khách đã được Bộ phận Điều phối duyệt hợp lệ. Vui lòng kiểm tra các điều khoản và thực hiện ký số trực tuyến bên dưới.
          </p>
        </div>

        {/* Thông báo trạng thái đã ký */}
        {isSigned && (
          <Alert
            title="Hợp đồng vận chuyển đã được ký số thành công!"
            description={
              <div className="space-y-1 text-xs text-slate-700 mt-1">
                <p className="m-0">
                  Bản hợp đồng có chữ ký số của Quý khách đã được <b>lưu trực tiếp vào hồ sơ đơn hàng</b> của bộ phận điều phối NEXLOG.
                </p>
                <p className="m-0 text-emerald-700 font-semibold">
                  ✓ Trạng thái đơn hàng: <b>SẴN SÀNG XẾP XE (READY FOR PLANNING)</b>. Đội ngũ điều phối đang tiến hành phân bổ phương tiện và tài xế vận chuyển ngay lập tức!
                </p>
              </div>
            }
            type="success"
            showIcon
            className="rounded-2xl border border-emerald-300 bg-emerald-50/90"
          />
        )}

        {/* Khung Mô Phỏng Hợp Đồng PDF Chuẩn Doanh Nghiệp */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200 space-y-6">
          
          {/* Header Quốc hiệu Hợp đồng */}
          <div className="text-center border-b border-slate-200 pb-6 space-y-1">
            <div className="text-xs font-bold uppercase text-slate-700 tracking-wider">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div className="text-[11px] text-slate-500 font-semibold">
              Độc lập - Tự do - Hạnh phúc
            </div>
            <div className="pt-3">
              <h2 className="text-lg sm:text-xl font-extrabold text-indigo-900 m-0 uppercase tracking-tight">
                HỢP ĐỒNG DỊCH VỤ VẬN TẢI HÀNG HÓA
              </h2>
              <div className="text-xs font-mono text-slate-500 mt-1">
                Số HĐ: <b className="text-indigo-600">NEX/2026/HDVT-{order?.order_code}</b>
              </div>
            </div>
          </div>

          {/* Hai bên ký kết */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <span className="font-bold text-slate-800 uppercase block text-[11px]">BÊN A (BÊN VẬN CHUYỂN):</span>
              <div className="font-bold text-indigo-700">CÔNG TY CỔ PHẦN LOGISTICS NEXLOG</div>
              <div className="text-slate-600">ĐKKD / MST: 0109988776</div>
              <div className="text-slate-600">Địa chỉ: Tầng 6, ALS Building, Cảng HKQT Nội Bài, Hà Nội</div>
              <div className="text-slate-600">Đại diện: Ban Điều phối Vận tải Hàng không &amp; Đường bộ</div>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-800 uppercase block text-[11px]">BÊN B (KHÁCH HÀNG):</span>
              <div className="font-bold text-slate-800">{order?.customer_name}</div>
              <div className="text-slate-600">Mã số thuế: <b>{order?.customer_tax_code || 'Chưa cung cấp'}</b></div>
              <div className="text-slate-600">Số điện thoại: {order?.customer_phone}</div>
              <div className="text-slate-600">Email giao dịch: {order?.customer_email}</div>
            </div>
          </div>

          {/* Điều khoản chính */}
          <div className="space-y-3 text-xs text-slate-700">
            <div>
              <span className="font-bold text-slate-900">ĐIỀU 1: ĐỐI TƯỢNG VÀ NỘI DUNG VẬN TẢI</span>
              <div className="mt-1 pl-3 space-y-1 border-l-2 border-indigo-200">
                <div>• Hàng hóa: <b>{order?.cargo_description}</b> (Tổng số lượng: <b>{order?.package_count}</b> kiện/mặt hàng).</div>
                <div>• Tuyến vận chuyển: Từ <b>{order?.pickup_address}</b> đến <b>{order?.delivery_address}</b>.</div>
                <div>• Trọng tải tính cước: <b>{order?.chargeable_weight_kg} kg</b>.</div>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-900">ĐIỀU 2: CƯỚC PHÍ VÀ HÓA ĐƠN CHỨNG TỪ</span>
              <div className="mt-1 pl-3 space-y-1 border-l-2 border-indigo-200">
                <div>• Tổng giá cước thỏa thuận cố định: <b className="text-indigo-700 font-mono text-sm">{(order?.agreed_price || 0).toLocaleString()} VNĐ</b> (Đã bao gồm chi phí phương tiện và tài xế).</div>
                <div>• Phương thức thanh toán: Khách hàng (Bên B) ủy quyền cho ngân hàng trung gian thanh toán theo Hóa đơn GTGT và Bảng kê do Bên A phát hành bàn giao cho bộ phận Kế toán Bên B theo dõi và thu hồi công nợ. Không thu tiền mặt tại hiện trường.</div>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-900">ĐIỀU 3: TRÁCH NHIỆM BẢO QUẢN &amp; THỜI GIAN</span>
              <div className="mt-1 pl-3 space-y-1 border-l-2 border-indigo-200">
                <div>• Bên A đảm bảo an toàn nguyên vẹn kẹp chì seal thùng xe trong suốt quá trình trung chuyển.</div>
                <div>• Hạn mức bồi thường hàng hóa: 100% giá trị khai báo khi có biên bản mất mát, hư hỏng do lỗi vận chuyển.</div>
              </div>
            </div>
          </div>

          <Divider className="my-4" />

          {/* Khu Vực Ký Chữ Ký Số */}
          <div className="pt-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
              <PenTool size={16} className="text-indigo-600" /> Xác Nhận &amp; Chữ Ký Điện Tử Đại Diện Hai Bên
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Bên A: Đã ký số tự động */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase block">ĐẠI DIỆN BÊN A (NEXLOG)</span>
                <div className="h-32 flex flex-col items-center justify-center border border-dashed border-emerald-300 rounded-xl bg-emerald-50/60 p-2">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck size={16} /> ĐÃ KÝ SỐ ĐIỆN TỬ
                  </span>
                  <span className="text-[11px] font-mono text-emerald-800 mt-1 font-semibold">CÔNG TY CỔ PHẦN LOGISTICS NEXLOG</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Chứng thư số: CA-VN-00998822</span>
                </div>
              </div>

              {/* Bên B: Khung Ký Số Web Canvas */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">ĐẠI DIỆN BÊN B (KHÁCH HÀNG)</span>
                  {!isSigned && (
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<RotateCcw size={12} />} 
                      onClick={handleClearSignature}
                      className="text-slate-500 text-xs"
                    >
                      Ký lại
                    </Button>
                  )}
                </div>

                {!isSigned ? (
                  <>
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 font-medium">Họ tên người ký:</span>
                      <Input 
                        placeholder="Nhập họ tên người đại diện..." 
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        className="text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 font-medium block mb-1">
                        Dùng chuột hoặc ngón tay để vẽ chữ ký số vào khung dưới:
                      </span>
                      <div className="border-2 border-dashed border-indigo-300 rounded-xl overflow-hidden bg-white shadow-inner cursor-crosshair">
                        <canvas
                          ref={canvasRef}
                          width={360}
                          height={140}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-[140px] block"
                        />
                      </div>
                    </div>

                    <Button
                      type="primary"
                      size="large"
                      loading={signing}
                      onClick={handleSubmitSignature}
                      icon={<FileCheck size={16} />}
                      className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold h-11 rounded-xl shadow-lg shadow-indigo-600/25 mt-2"
                    >
                      Ký Số &amp; Xác Nhận Hợp Đồng
                    </Button>
                  </>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center border border-dashed border-emerald-300 rounded-xl bg-emerald-50/60 p-3 space-y-2 text-center">
                    <span className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1">
                      <CheckCircle2 size={16} className="text-emerald-600" /> ĐÃ KÝ CHỮ KÝ SỐ THÀNH CÔNG
                    </span>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 min-w-[200px] min-h-[64px] flex items-center justify-center">
                      {signedData?.signature_data?.startsWith('data:image') ? (
                        <img 
                          src={signedData.signature_data} 
                          alt="Chữ ký điện tử của khách hàng" 
                          className="max-h-16 max-w-[240px] object-contain"
                        />
                      ) : (
                        <div className="font-serif italic text-indigo-800 text-lg font-bold py-2 px-4 border-b border-indigo-400">
                          {signedData?.signer_name || 'Đã ký điện tử'}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-800">{signedData?.signer_name}</span>
                    <span className="text-[10px] text-slate-400">
                      Thời gian ký: {signedData?.signed_at ? new Date(signedData.signed_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')}
                    </span>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
