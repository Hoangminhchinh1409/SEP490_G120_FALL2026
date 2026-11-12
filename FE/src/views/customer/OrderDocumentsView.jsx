"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Tag, Spin, message, Alert, Table, Tooltip, Progress } from 'antd';
import { 
  FileText, 
  Upload, 
  Clock, 
  ArrowLeft, 
  ShieldCheck, 
  AlertCircle,
  FileCheck,
  Send,
  ArrowRight,
  RefreshCw,
  PhoneCall,
  MessageSquare
} from 'lucide-react';
import { orderApi } from '../../../src/api/orderApi';
import { getRecommendedDocsByCargo } from '../../../src/data/dispatcherPresets';

export default function OrderDocumentsView() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [uploadingDocKey, setUploadingDocKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // State upload file scan hợp đồng
  const [uploadingContractScan, setUploadingContractScan] = useState(false);
  const contractInputRef = useRef(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    const loadOrder = async () => {
      try {
        setLoading(true);
        const data = await orderApi.getOrderByToken(token);
        setOrder(data);

        // Khởi tạo danh mục chứng từ theo đúng loại hàng hóa khách đã tạo lúc đầu
        const existingDocs = data.web_workflow?.documents;
        if (existingDocs && existingDocs.length > 0) {
          setDocuments(existingDocs);
          const hasAnyRejected = existingDocs.some(d => d.status === 'REJECTED') || data.web_workflow?.stage === 'DOCS_REJECTED';
          if (hasAnyRejected) {
            // Nếu có chứng từ bị từ chối -> Mở khóa để khách hàng upload lại
            setSubmitted(false);
          } else if (
            data.web_workflow?.stage === 'DOCS_UPLOADED' ||
            data.web_workflow?.stage === 'DOCS_APPROVED' ||
            data.web_workflow?.stage === 'CONTRACT_SIGNED'
          ) {
            setSubmitted(true);
          }
        } else {
          const recDocs = getRecommendedDocsByCargo(
            data.cargo_description || '',
            data.cargo_type || 'GENERAL',
            data.user_note || ''
          );
          setDocuments(recDocs);
        }
      } catch (err) {
        console.error('Failed to load order docs:', err);
        message.error('Không tìm thấy thông tin đơn hàng hoặc link đã hết hạn.');
      } finally {
        setLoading(false);
      }
    };
    loadOrder();

    // Polling mỗi 4 giây để tự động cập nhật khi Điều phối viên duyệt hoặc từ chối giấy tờ
    const interval = setInterval(async () => {
      try {
        const latestData = await orderApi.getOrderByToken(token);
        if (!latestData) return;

        setOrder(prev => {
          const prevStage = prev?.web_workflow?.stage;
          const nextStage = latestData.web_workflow?.stage;
          const latestDocs = latestData.web_workflow?.documents || [];
          const hasAnyRejected = latestDocs.some(d => d.status === 'REJECTED') || nextStage === 'DOCS_REJECTED';

          // Nếu điều phối vừa từ chối 1 chứng từ
          if (hasAnyRejected && prevStage !== 'DOCS_REJECTED') {
            setDocuments(latestDocs);
            setSubmitted(false);
            message.warning('Điều phối viên vừa yêu cầu tải lại một số chứng từ chưa hợp lệ!');
          } else if (nextStage === 'DOCS_APPROVED' && prevStage !== 'DOCS_APPROVED') {
            setDocuments(latestDocs);
            setSubmitted(true);
            message.success('Hồ sơ chứng từ đã được chấp nhận! Điều phối viên sẽ sớm liên hệ với Quý khách để tiến hành ký kết hợp đồng.');
          }
          return latestData;
        });
      } catch (e) {
        // ignore polling error
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [token]);

  const triggerUpload = (docKey) => {
    setUploadingDocKey(docKey);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocKey) return;

    const sizeFormatted = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;

    const nowFormatted = new Date().toLocaleString('vi-VN', { 
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target?.result;

      setDocuments(prev => prev.map(d => {
        if (d.key === uploadingDocKey) {
          return {
            ...d,
            file: file.name,
            file_data: base64Data,
            size: sizeFormatted,
            uploadDate: nowFormatted,
            status: 'PENDING_REVIEW',
            reuploaded: d.status === 'REJECTED' ? true : d.reuploaded
          };
        }
        return d;
      }));

      message.success(`Đã cập nhật tệp mới: ${file.name}`);
      setUploadingDocKey(null);
    };

    reader.readAsDataURL(file);
  };

  const handleSubmitAllDocs = async () => {
    // 1. Kiểm tra xem còn chứng từ nào đang ở trạng thái REJECTED chưa được khách chọn tệp mới không
    const stillRejectedDocs = documents.filter(d => d.status === 'REJECTED');
    if (stillRejectedDocs.length > 0) {
      message.error(
        `Quý khách còn ${stillRejectedDocs.length} chứng từ bị từ chối (${stillRejectedDocs.map(d => d.name).join(', ')}) chưa được tải tệp mới lên. Vui lòng bấm "Upload lại tệp mới" trước khi gửi!`
      );
      return;
    }

    // 2. Khách hàng không cần nộp Tờ khai hải quan (do điều phối chuẩn bị)
    const missingDocs = documents.filter(d => {
      const isCustomsDeclaration = d.preparedBy === 'DISPATCHER' || d.key === 'doc-basic-1' || d.name?.toLowerCase().includes('tờ khai hải quan');
      if (isCustomsDeclaration) return false;
      return d.file === 'Chờ tải lên' || d.status === 'WAITING_UPLOAD';
    });

    if (missingDocs.length > 0) {
      message.warning(`Quý khách còn ${missingDocs.length} chứng từ chưa tải tệp lên. Vui lòng tải đầy đủ để điều phối viên có thể phê duyệt!`);
      return;
    }

    try {
      setSubmitting(true);
      await orderApi.customerUploadDocuments(token, documents);
      message.success('Đã gửi hồ sơ chứng từ thành công! Điều phối viên đang tiến hành kiểm duyệt.');
      setSubmitted(true);
      const latest = await orderApi.getOrderByToken(token);
      if (latest) setOrder(latest);
    } catch (err) {
      console.error('Submit docs error:', err);
      message.error(err.message || 'Lỗi khi gửi hồ sơ chứng từ');
    } finally {
      setSubmitting(false);
    }
  };

  const customerRequiredDocs = documents.filter(d => !(d.preparedBy === 'DISPATCHER' || d.key === 'doc-basic-1' || d.name?.toLowerCase().includes('tờ khai hải quan')));
  const uploadedCount = customerRequiredDocs.filter(d => d.file !== 'Chờ tải lên' && d.status !== 'REJECTED').length;
  const progressPercent = customerRequiredDocs.length > 0 ? Math.round((uploadedCount / customerRequiredDocs.length) * 100) : 100;
  const rejectedDocs = documents.filter(d => d.status === 'REJECTED');
  const isDocsApproved =
    rejectedDocs.length === 0 &&
    (order?.web_workflow?.stage === 'DOCS_APPROVED' || order?.web_workflow?.stage === 'CONTRACT_SIGNED');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Spin size="large" />
        <p className="mt-4 text-sm text-slate-500 font-medium">Đang tải danh mục hồ sơ chứng từ cần thiết...</p>
      </div>
    );
  }

  const columns = [
    {
      title: 'Tên loại chứng từ',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const isCustomsDeclaration = record.preparedBy === 'DISPATCHER' || record.key === 'doc-basic-1' || record.name?.toLowerCase().includes('tờ khai hải quan');
        return (
          <div>
            <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5 flex-wrap">
              <FileText size={14} className="text-indigo-600 shrink-0" />
              <span>{text}</span>
              {isCustomsDeclaration ? (
                <Tag color="cyan" className="text-[10px] px-1 py-0 rounded font-semibold">NEXLOG chuẩn bị</Tag>
              ) : record.isBasic ? (
                <Tag color="blue" className="text-[10px] px-1 py-0 rounded">Bắt buộc</Tag>
              ) : null}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {isCustomsDeclaration ? 'Điều phối viên NEXLOG sẽ chuẩn bị tờ khai hải quan cho quý khách.' : record.description}
            </div>
            {record.status === 'REJECTED' && record.reject_reason && (
              <div className="mt-1.5 p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 font-medium flex items-start gap-1.5">
                <AlertCircle size={13} className="text-red-600 shrink-0 mt-0.5" />
                <span><b>Lý do từ chối:</b> {record.reject_reason}</span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Tệp đã tải lên',
      dataIndex: 'file',
      key: 'file',
      width: '36%',
      render: (text, record) => {
        const isCustomsDeclaration = record.preparedBy === 'DISPATCHER' || record.key === 'doc-basic-1' || record.name?.toLowerCase().includes('tờ khai hải quan');
        
        if (isCustomsDeclaration) {
          if (record.file && record.file !== 'Chờ tải lên') {
            return (
              <div 
                className="flex items-center gap-1.5 text-xs font-mono text-indigo-700 truncate max-w-[200px] cursor-pointer hover:underline bg-slate-50 p-1.5 px-2.5 rounded-lg border border-slate-200" 
                title="Bấm để tải về / xem tệp"
                onClick={() => {
                  if (record.file_data) {
                    const a = document.createElement('a');
                    a.href = record.file_data;
                    a.download = record.file;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    message.success(`Đang mở / tải xuống: ${record.file}`);
                  }
                }}
              >
                <FileCheck size={14} className="text-emerald-600 shrink-0" />
                <span className="truncate font-semibold">{text}</span>
              </div>
            );
          }
          return (
            <span className="text-xs text-indigo-600 bg-indigo-50/70 border border-indigo-100 rounded-lg px-2.5 py-1 inline-flex items-center gap-1">
              <Clock size={12} className="text-indigo-500" /> Điều phối NEXLOG chuẩn bị
            </span>
          );
        }

        // Nếu chứng từ bị TỪ CHỐI -> Hiển thị nút đỏ yêu cầu Upload lại tệp mới
        if (record.status === 'REJECTED') {
          return (
            <div className="space-y-1.5">
              {text && text !== 'Chờ tải lên' && (
                <div className="text-[11px] text-red-500 line-through font-mono truncate max-w-[200px]">
                  {text} (Bị từ chối)
                </div>
              )}
              <Button
                size="small"
                type="primary"
                danger
                icon={<RefreshCw size={12} />}
                onClick={() => triggerUpload(record.key)}
                className="text-xs font-semibold rounded-lg"
              >
                Upload lại tệp mới
              </Button>
            </div>
          );
        }

        return text === 'Chờ tải lên' || record.status === 'WAITING_UPLOAD' ? (
          <Button
            size="small"
            icon={<Upload size={12} />}
            onClick={() => triggerUpload(record.key)}
            className="text-xs border-dashed border-indigo-300 text-indigo-700 hover:border-indigo-500 hover:text-indigo-800"
          >
            Tải lên tệp (PDF/JPG)
          </Button>
        ) : (
          <div className="flex items-center justify-between bg-slate-50 p-1.5 px-2.5 rounded-lg border border-slate-200">
            <div 
              className="flex items-center gap-1.5 text-xs font-mono text-indigo-700 truncate max-w-[170px] cursor-pointer hover:underline" 
              title="Bấm để tải về / xem tệp"
              onClick={() => {
                if (record.file_data) {
                  const a = document.createElement('a');
                  a.href = record.file_data;
                  a.download = record.file;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  message.success(`Đang mở / tải xuống: ${record.file}`);
                }
              }}
            >
              <FileCheck size={14} className="text-emerald-600 shrink-0" />
              <span className="truncate font-semibold">{text}</span>
            </div>
            {!submitted && record.status !== 'APPROVED' && (
              <Tooltip title="Chọn tệp khác">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<Upload size={12} />} 
                  className="p-1 text-slate-400 hover:text-indigo-600"
                  onClick={() => triggerUpload(record.key)}
                />
              </Tooltip>
            )}
          </div>
        );
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: '20%',
      render: (st, record) => {
        const isCustomsDeclaration = record.preparedBy === 'DISPATCHER' || record.key === 'doc-basic-1' || record.name?.toLowerCase().includes('tờ khai hải quan');
        if (isCustomsDeclaration) {
          return record.file !== 'Chờ tải lên' ? (
            <Tag color="success" className="text-[11px] font-bold">ĐÃ CÓ TỆP</Tag>
          ) : (
            <Tag color="cyan" className="text-[11px] font-medium">ĐIỀU PHỐI TỰ LẬP</Tag>
          );
        }

        return record.file === 'Chờ tải lên' ? (
          <Tag color="default" className="text-[11px]">Chưa nộp</Tag>
        ) : st === 'APPROVED' ? (
          <Tag color="success" className="text-[11px] font-bold">ĐÃ HỢP LỆ</Tag>
        ) : st === 'REJECTED' ? (
          <Tag color="error" className="text-[11px] font-bold">CẦN UPLOAD LẠI</Tag>
        ) : record.reuploaded ? (
          <Tag color="processing" className="text-[11px] font-bold">ĐÃ TẢI LẠI TỆP MỚI</Tag>
        ) : (
          <Tag color="processing" className="text-[11px]">ĐÃ TẢI LÊN</Tag>
        );
      }
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
      />

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Button 
            icon={<ArrowLeft size={14} />} 
            onClick={() => router.push(`/customer/order-confirmation/${token}`)}
            className="text-xs text-slate-600"
          >
            Quay lại Xem đơn hàng
          </Button>
          <div className="text-xs font-mono text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
            Mã đơn: <b>{order?.order_code}</b>
          </div>
        </div>

        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wide">
            <ShieldCheck size={14} /> Bước 2: Nộp Chứng Từ Vận Tải Theo Loại Hàng
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hồ Sơ Chứng Từ Xuất Nhập Khẩu
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            Dựa trên thông tin loại hàng <b>{order?.cargo_description}</b> mà Quý khách đã tạo, hệ thống đề xuất danh mục các chứng từ pháp lý cần hoàn thiện dưới đây:
          </p>
        </div>

        {/* Thanh tiến độ tải hồ sơ */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">
              Tiến độ hoàn thiện chứng từ hợp lệ: <b>{uploadedCount}/{customerRequiredDocs.length}</b> chứng từ khách nộp
            </span>
            <span className="font-bold text-indigo-600 font-mono text-sm">{progressPercent}%</span>
          </div>
          <Progress percent={progressPercent} strokeColor={rejectedDocs.length > 0 ? '#dc2626' : '#4f46e5'} showInfo={false} />
        </div>

        {/* Cảnh báo nếu có chứng từ bị Điều phối viên từ chối yêu cầu tải lại */}
        {(rejectedDocs.length > 0 || order?.web_workflow?.stage === 'DOCS_REJECTED') && !isDocsApproved && (
          <Alert
            title={
              <span className="font-bold text-red-900">
                Yêu cầu cập nhật lại chứng từ: Có {rejectedDocs.length} chứng từ bị từ chối cần Upload lại!
              </span>
            }
            description={
              <div className="text-xs text-red-800 space-y-1 mt-1">
                {rejectedDocs.map((d) => (
                  <div key={d.key}>
                    • <b>{d.name}:</b> {d.reject_reason || 'Tệp chưa hợp lệ, vui lòng tải lại tệp mới.'}
                  </div>
                ))}
                <div className="pt-1 font-semibold">
                  Vui lòng bấm nút &ldquo;Upload lại tệp mới&rdquo; ở dòng tương ứng bên dưới, sau đó nhấn &ldquo;Gửi Lại Hồ Sơ Cho Điều Phối Duyệt&rdquo;.
                </div>
              </div>
            }
            type="error"
            showIcon
            className="rounded-2xl border border-red-300 bg-red-50/90"
          />
        )}

        {/* Thông báo nếu đã được duyệt toàn bộ chứng từ */}
        {isDocsApproved && (
          <Alert
            title="Hồ sơ chứng từ đã được chấp nhận hợp lệ!"
            description={
              <div className="space-y-2 text-xs text-slate-700 mt-1">
                <p className="m-0">
                  Bộ phận Điều phối NEXLOG đã kiểm tra và xác nhận chấp nhận toàn bộ hồ sơ chứng từ, giấy tờ của Quý khách.
                </p>
                <p className="m-0 font-semibold text-emerald-700">
                  ✓ Điều phối viên phụ trách ({order?.dispatcher_name || 'Ban Điều phối NEXLOG'}) sẽ sớm liên lạc trực tiếp với Quý khách để tiến hành ký kết hợp đồng vận chuyển và sắp xếp phương tiện theo đúng lộ trình!
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${(order?.dispatcher_phone || '0988 123 456').replace(/[^0-9]/g, '')}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <PhoneCall size={13} /> Liên hệ Điều phối: {order?.dispatcher_phone || '0988 123 456'}
                  </a>
                  <a
                    href={order?.dispatcher_zalo || `https://zalo.me/${(order?.dispatcher_phone || '0988123456').replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <MessageSquare size={13} /> Nhắn Zalo Điều phối
                  </a>
                </div>
              </div>
            }
            type="success"
            showIcon
            className="rounded-2xl border border-emerald-300 bg-emerald-50/90"
          />
        )}

        {/* Thông báo nếu đã nộp và đang chờ duyệt */}
        {submitted && !isDocsApproved && rejectedDocs.length === 0 && (
          <Alert
            title="Hồ sơ chứng từ đã được nộp thành công!"
            description={
              <div className="space-y-1 text-xs text-slate-700 mt-1">
                <p className="m-0">
                  Điều phối viên đang thẩm định tính hợp lệ của từng loại chứng từ, giấy tờ.
                </p>
                <p className="m-0 text-emerald-700 font-semibold">
                  Ngay sau khi giấy tờ được chấp nhận, Điều phối viên sẽ liên lạc sớm với Quý khách để tiến hành ký hợp đồng vận chuyển!
                </p>
              </div>
            }
            type="success"
            showIcon
            className="rounded-2xl border border-emerald-300 bg-emerald-50/90"
          />
        )}

        {/* Bảng chứng từ */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 overflow-hidden">
          <Table 
            columns={columns}
            dataSource={documents}
            pagination={false}
            rowKey="key"
            size="middle"
            className="rounded-xl overflow-hidden"
          />

          {!submitted && !isDocsApproved ? (
            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Chấp nhận định dạng: PDF, JPG, PNG, DOC (Tối đa 15MB/tệp).
              </span>
              <Button
                type="primary"
                size="large"
                loading={submitting}
                onClick={handleSubmitAllDocs}
                icon={<Send size={16} />}
                className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-indigo-600/25 w-full sm:w-auto"
              >
                {order?.web_workflow?.stage === 'DOCS_REJECTED'
                  ? 'Gửi Lại Hồ Sơ Cho Điều Phối Duyệt'
                  : 'Gửi Hồ Sơ Cho Điều Phối Duyệt'}
              </Button>
            </div>
          ) : isDocsApproved ? (
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <Tag color="success" className="py-1.5 px-4 text-xs font-bold rounded-full">
                Trạng thái: Giấy tờ đã được chấp nhận — Vui lòng ký hợp đồng bên dưới
              </Tag>
            </div>
          ) : (
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <Tag color="cyan" className="py-1 px-4 text-xs font-semibold rounded-full">
                Trạng thái: Đang chờ Điều phối viên NEXLOG phê duyệt chứng từ
              </Tag>
            </div>
          )}
        </div>

        {/* Khối Hợp đồng Vận chuyển: In, Ký, Scan nộp và Hướng dẫn gửi bản cứng */}
        {isDocsApproved && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-150 pb-3">
              <div>
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="text-indigo-600" size={18} />
                  Ký kết Hợp đồng Vận chuyển Hàng hóa Nội địa (ALS)
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Quý khách vui lòng tải tệp hợp đồng đã được hệ thống tạo sẵn, in ra giấy, ký tên đóng dấu, sau đó scan/chụp ảnh tải lên hệ thống.
                </span>
              </div>
              <Tag color={order?.contract_file || order?.contract_uploaded ? 'success' : 'processing'} className="text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto">
                {order?.contract_file || order?.contract_uploaded ? '✓ ĐÃ TẢI LÊN BẢN SCAN' : 'CHỜ TẢI BẢN SCAN ĐÃ KÝ'}
              </Tag>
            </div>

            {/* Điều khoản bổ sung riêng */}
            {Array.isArray(order?.contract_custom_terms) && order.contract_custom_terms.length > 0 && (
              <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-1.5">
                <span className="text-xs font-bold text-indigo-950 block">
                  📋 Các điều khoản bổ sung đã thống nhất với Điều phối viên:
                </span>
                <div className="space-y-1 text-xs text-indigo-900">
                  {order.contract_custom_terms.map((term, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="font-bold">•</span>
                      <span>{term}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2 Bước thực hiện: Online Scan & Offline Bưu điện */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Bước 1: Scan và upload online */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                    Ký &amp; Tải lên bản Scan (PDF / Ảnh)
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed m-0">
                    In bản hợp đồng mẫu gửi qua email hoặc tải bên dưới, ký đóng dấu tròn công ty và scan tải lại tại đây để Điều phối viên xác nhận xếp xe ngay.
                  </p>
                </div>

                <div className="pt-2">
                  {order?.contract_file || order?.contract_uploaded ? (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck size={18} className="text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-emerald-950 truncate max-w-[180px]">
                            {order.contract_file || 'hop-dong-da-ky.pdf'}
                          </div>
                          <div className="text-[10px] text-emerald-700">Đã tiếp nhận vào hồ sơ</div>
                        </div>
                      </div>
                      <label className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer">
                        Đổi tệp khác
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              setUploadingContractScan(true);
                              const reader = new FileReader();
                              reader.onload = async () => {
                                await orderApi.uploadContractFile(order.id || order.order_id, {
                                  file_name: file.name,
                                  file_data: reader.result,
                                  file_size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
                                });
                                message.success('Đã tải lên bản scan hợp đồng đã ký!');
                                const latest = await orderApi.getOrderByToken(token);
                                if (latest) setOrder(latest);
                              };
                              reader.readAsDataURL(file);
                            } catch (err) {
                              message.error(err.message || 'Lỗi khi tải tệp');
                            } finally {
                              setUploadingContractScan(false);
                            }
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-sm transition-all">
                      <Upload size={14} />
                      <span>{uploadingContractScan ? 'Đang tải lên...' : 'Tải lên Bản Scan Hợp đồng đã ký (PDF)'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            setUploadingContractScan(true);
                            const reader = new FileReader();
                            reader.onload = async () => {
                              await orderApi.uploadContractFile(order.id || order.order_id, {
                                file_name: file.name,
                                file_data: reader.result,
                                file_size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
                              });
                              message.success('Đã tải lên bản scan hợp đồng đã ký thành công!');
                              const latest = await orderApi.getOrderByToken(token);
                              if (latest) setOrder(latest);
                            };
                            reader.readAsDataURL(file);
                          } catch (err) {
                            message.error(err.message || 'Lỗi khi tải tệp');
                          } finally {
                            setUploadingContractScan(false);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Bước 2: Gửi bản cứng bưu điện (Bắt buộc) */}
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-xs text-amber-950 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">2</span>
                    Gửi bản cứng gốc qua bưu điện (Bắt buộc)
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed m-0">
                    Theo quy chuẩn vận hành của ALS, <b>Quý khách có nghĩa vụ gửi bản cứng hợp đồng gốc có dấu đỏ</b> qua đường bưu điện/chuyển phát nhanh về cho Ban Điều phối ALS trong vòng 03 ngày làm việc để lưu trữ hồ sơ pháp lý đối soát.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-[11px] text-amber-950 space-y-1">
                  <div>📍 <b>Địa chỉ nhận hợp đồng:</b> Cảng Hàng không Quốc tế Nội Bài, Phú Minh, Sóc Sơn, Hà Nội</div>
                  <div>👤 <b>Người nhận:</b> Ban Điều phối Vận tải Hàng không ALS (NEXLOG)</div>
                  <div>📞 <b>Hotline tiếp nhận:</b> 1900 3133 / {order?.dispatcher_phone || '0988 123 456'}</div>
                  {order?.contract_hardcopy_received && (
                    <div className="pt-1 text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} /> Điều phối viên đã xác nhận nhận đủ bản cứng gốc có dấu đỏ!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
