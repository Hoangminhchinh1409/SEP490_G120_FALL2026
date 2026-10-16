"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Result, Tag, Spin, message, Alert, Table, Tooltip, Progress } from 'antd';
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  Clock, 
  ArrowLeft, 
  ShieldCheck, 
  AlertCircle,
  FileCheck,
  Send,
  Sparkles
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
          if (data.web_workflow?.stage === 'DOCS_UPLOADED' || data.web_workflow?.stage === 'DOCS_APPROVED' || data.web_workflow?.stage === 'CONTRACT_SIGNED') {
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
            status: 'PENDING_REVIEW'
          };
        }
        return d;
      }));

      message.success(`Đã đính kèm tệp: ${file.name}`);
      setUploadingDocKey(null);
    };

    reader.readAsDataURL(file);
  };

  const handleSubmitAllDocs = async () => {
    const missingDocs = documents.filter(d => d.file === 'Chờ tải lên' || d.status === 'WAITING_UPLOAD');
    if (missingDocs.length > 0) {
      message.warning(`Quý khách còn ${missingDocs.length} chứng từ chưa tải tệp lên. Vui lòng tải đầy đủ để điều phối viên có thể phê duyệt!`);
      return;
    }

    try {
      setSubmitting(true);
      await orderApi.customerUploadDocuments(token, documents);
      message.success('Đã gửi toàn bộ hồ sơ chứng từ thành công! Điều phối viên đang tiến hành kiểm duyệt.');
      setSubmitted(true);
    } catch (err) {
      console.error('Submit docs error:', err);
      message.error(err.message || 'Lỗi khi gửi hồ sơ chứng từ');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadedCount = documents.filter(d => d.file !== 'Chờ tải lên').length;
  const progressPercent = documents.length > 0 ? Math.round((uploadedCount / documents.length) * 100) : 0;

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
      render: (text, record) => (
        <div>
          <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
            <FileText size={14} className="text-indigo-600 shrink-0" />
            <span>{text}</span>
            {record.isBasic && (
              <Tag color="blue" className="text-[10px] px-1 py-0 rounded">Bắt buộc</Tag>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{record.description}</div>
        </div>
      )
    },
    {
      title: 'Tệp đã tải lên',
      dataIndex: 'file',
      key: 'file',
      width: '35%',
      render: (text, record) => (
        text === 'Chờ tải lên' || record.status === 'WAITING_UPLOAD' ? (
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
            {!submitted && (
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
        )
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: '20%',
      render: (st, record) => (
        record.file === 'Chờ tải lên' ? (
          <Tag color="default" className="text-[11px]">Chưa nộp</Tag>
        ) : st === 'APPROVED' ? (
          <Tag color="success" className="text-[11px] font-bold">ĐÃ HỢP LỆ</Tag>
        ) : st === 'REJECTED' ? (
          <Tag color="error" className="text-[11px] font-bold">YÊU CẦU LẠI</Tag>
        ) : (
          <Tag color="processing" className="text-[11px]">ĐÃ TẢI LÊN</Tag>
        )
      )
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
              Tiến độ nộp tệp: <b>{uploadedCount}/{documents.length}</b> chứng từ
            </span>
            <span className="font-bold text-indigo-600 font-mono text-sm">{progressPercent}%</span>
          </div>
          <Progress percent={progressPercent} strokeColor="#4f46e5" showInfo={false} />
        </div>

        {/* Thông báo nếu đã nộp */}
        {submitted && (
          <Alert
            message="Hồ sơ chứng từ đã được nộp thành công!"
            description={
              <div className="space-y-1 text-xs text-slate-700 mt-1">
                <p className="m-0">
                  Điều phối viên đang thẩm định tính hợp lệ của từng loại chứng từ.
                </p>
                <p className="m-0 text-emerald-700 font-semibold">
                  Ngay sau khi phê duyệt xong, hệ thống sẽ tự động gửi hợp đồng điện tử PDF kèm đường link chữ ký số tới email <b>{order?.customer_email}</b> của Quý khách!
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

          {!submitted ? (
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
                Gửi Hồ Sơ Cho Điều Phối Duyệt
              </Button>
            </div>
          ) : (
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <Tag color="cyan" className="py-1 px-4 text-xs font-semibold rounded-full">
                Trạng thái: Đang chờ Điều phối viên NEXLOG phê duyệt chứng từ
              </Tag>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
