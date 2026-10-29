import React from 'react';
import { Table, Button, Tag, Space, Select, Input, Tooltip, Alert } from 'antd';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  Clock, 
  CheckCircle2, 
  Info,
  AlertTriangle
} from 'lucide-react';
import { SPECIALIZED_CARGO_CATEGORIES } from '../../../data/dispatcherPresets';

const { Option, OptGroup } = Select;

export default function OrderDocumentsTab({
  order,
  isWebOrder,
  documents,
  selectedSpecializedDoc,
  setSelectedSpecializedDoc,
  newDocName,
  setNewDocName,
  setAssistantDrawerOpen,
  handleAddCustomDoc,
  handleDeleteCustomDoc,
  handleApproveDoc,
  handleRejectDoc,
  triggerUploadDoc,
  handleConfirmAllDocuments,
  confirmingDocs
}) {
  const rejectedDocs = documents.filter(d => d.status === 'REJECTED');
  const hasRejectedDocs = rejectedDocs.length > 0;
  const isDocsApprovedStage =
    !hasRejectedDocs &&
    (order.web_workflow?.stage === 'DOCS_APPROVED' || order.web_workflow?.stage === 'CONTRACT_SIGNED');
  const isClosed = order.status === 'CANCELLED' || order.status === 'CLOSED';

  const docColumns = [
    { 
      title: 'Tên chứng từ', 
      dataIndex: 'name', 
      key: 'name',
      width: '38%',
      render: (text, record) => {
        const isCustomsDeclaration = record.preparedBy === 'DISPATCHER' || record.key === 'doc-basic-1' || record.name?.toLowerCase().includes('tờ khai hải quan');
        return (
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-800 text-xs">{text}</span>
              {record.isBasic ? (
                <Tag color="blue" className="text-[10px] m-0 py-0 px-1 font-semibold">Cơ bản</Tag>
              ) : (
                <Tag color="purple" className="text-[10px] m-0 py-0 px-1 font-semibold">Chuyên ngành</Tag>
              )}
              {isCustomsDeclaration && (
                <Tag color="cyan" className="text-[10px] m-0 py-0 px-1 font-semibold">Điều phối chuẩn bị</Tag>
              )}
            </div>
            {record.status === 'REJECTED' && record.reject_reason && (
              <div className="text-[11px] text-red-600 font-medium mt-1">
                Lý do từ chối: <span className="italic">{record.reject_reason}</span>
              </div>
            )}
          </div>
        );
      }
    },
    { 
      title: 'Tệp đính kèm', 
      dataIndex: 'file', 
      key: 'file',
      width: '28%',
      render: (text, record) => {
        const isCustomsDeclaration = record.preparedBy === 'DISPATCHER' || record.key === 'doc-basic-1' || record.name?.toLowerCase().includes('tờ khai hải quan');

        if (record.file === 'Chờ tải lên' || record.status === 'WAITING_UPLOAD') {
          if (isCustomsDeclaration) {
            return (
              <Button 
                size="small" 
                icon={<Upload size={13} />} 
                className="text-xs bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-medium"
                onClick={() => triggerUploadDoc(record.key)}
              >
                Đính kèm Tờ khai
              </Button>
            );
          }

          if (isWebOrder) {
            return (
              <span className="text-xs text-gray-400 italic flex items-center gap-1">
                <Clock size={12} className="text-amber-500" /> Chờ khách nộp qua link Web
              </span>
            );
          }

          return (
            <Button 
              size="small" 
              icon={<Upload size={13} />} 
              className="text-xs border-dashed border-indigo-300 text-indigo-700 hover:border-indigo-500 hover:text-indigo-800"
              onClick={() => triggerUploadDoc(record.key)}
            >
              Tải lên tệp
            </Button>
          );
        }

        return (
          <div className="flex items-center gap-1.5 font-mono text-xs text-blue-600">
            <FileText size={14} className="shrink-0" />
            <span 
              className={`truncate max-w-[130px] font-semibold underline cursor-pointer hover:text-blue-800 ${
                record.status === 'REJECTED' ? 'text-red-500 line-through' : ''
              }`}
              title="Bấm để tải về / xem tệp"
              onClick={() => {
                if (record.file_data) {
                  const a = document.createElement('a');
                  a.href = record.file_data;
                  a.download = record.file;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }}
            >
              {text}
            </span>
            <span className="text-gray-400 font-sans text-[11px] shrink-0">({record.size})</span>
            {(!isWebOrder || isCustomsDeclaration) && (
              <Tooltip title="Tải lại tệp khác">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<Upload size={11} />} 
                  className="p-0.5 text-gray-400 hover:text-indigo-600"
                  onClick={() => triggerUploadDoc(record.key)}
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
      width: '18%',
      render: (st) => (
        st === 'APPROVED' ? <Tag color="success" className="font-semibold text-[11px]">ĐÃ HỢP LỆ</Tag> :
        st === 'REJECTED' ? <Tag color="error" className="font-semibold text-[11px]">TỪ CHỐI (CHỜ GỬI LẠI)</Tag> :
        st === 'PENDING_REVIEW' ? <Tag color="warning" className="font-semibold text-[11px]">CHỜ KIỂM TRA</Tag> :
        <Tag color="default" className="text-[11px]">CHỜ TẢI LÊN</Tag>
      )
    },
    { 
      title: 'Thao tác', 
      key: 'action',
      width: '16%',
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            type="primary" 
            ghost 
            className="text-xs"
            onClick={() => handleApproveDoc(record.key)}
            disabled={isClosed || record.status === 'APPROVED' || record.file === 'Chờ tải lên'}
          >
            Duyệt
          </Button>
          <Button 
            size="small" 
            danger 
            ghost 
            className="text-xs"
            onClick={() => handleRejectDoc(record.key)}
            disabled={isClosed || record.status === 'REJECTED' || record.file === 'Chờ tải lên'}
          >
            Từ chối
          </Button>
          {record.isCustom && !isClosed && (
            <Tooltip title="Xóa chứng từ bổ sung">
              <Button 
                size="small" 
                type="text" 
                danger 
                icon={<Trash2 size={13} />} 
                onClick={() => handleDeleteCustomDoc(record.key)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const renderWebWorkflowTag = () => {
    if (order.web_workflow?.stage === 'CONTRACT_SIGNED') {
      return <Tag color="success" className="font-bold text-xs">Khách đã ký hợp đồng điện tử</Tag>;
    }
    if (isDocsApprovedStage) {
      return <Tag color="success" className="font-bold text-xs">Đã duyệt chứng từ &amp; Đã gửi hợp đồng ký số</Tag>;
    }
    if (hasRejectedDocs || order.web_workflow?.stage === 'DOCS_REJECTED') {
      return <Tag color="error" className="font-bold text-xs">Có chứng từ bị từ chối - Chờ khách upload lại</Tag>;
    }
    if (order.web_workflow?.stage === 'DOCS_UPLOADED' || documents.some(d => d.file !== 'Chờ tải lên')) {
      return <Tag color="processing" className="font-bold text-xs">Khách đã tải chứng từ - Chờ kiểm duyệt</Tag>;
    }
    return <Tag color="default" className="font-bold text-xs">Chờ nộp chứng từ</Tag>;
  };

  return (
    <div className="space-y-4">
      {/* Header danh mục chứng từ */}
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center gap-3">
        <div>
          <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide m-0">
            Danh mục chứng từ hồ sơ xuất nhập khẩu
          </h4>
          <p className="text-[11px] text-gray-500 m-0">
            {isWebOrder 
              ? 'Khách hàng tải lên trực tiếp qua liên kết web. Điều phối viên kiểm tra và phê duyệt tính hợp lệ trước khi xếp chuyến.' 
              : 'Tải lên và kiểm duyệt tính hợp lệ của từng loại chứng từ trước khi xếp chuyến.'}
          </p>
        </div>
      </div>

      {/* Thông tin đơn Web nếu có */}
      {isWebOrder && (
        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-600 shrink-0" />
            <div>
              <span>Đơn hàng Web: Khách hàng truy cập link để gửi tệp. Trạng thái hiện tại: </span>
              {renderWebWorkflowTag()}
            </div>
          </div>
          {order.tracking_token && (
            <Button 
              size="small" 
              type="link" 
              onClick={() =>
                window.open(
                  isDocsApprovedStage
                    ? `/customer/contract-sign/${order.tracking_token}`
                    : `/customer/order-documents/${order.tracking_token}`,
                  '_blank'
                )
              }
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 p-0"
            >
              {isDocsApprovedStage ? 'Mở link ký hợp đồng của khách →' : 'Mở link nộp chứng từ của khách →'}
            </Button>
          )}
        </div>
      )}

      {/* Cảnh báo nếu đang có chứng từ bị từ chối */}
      {hasRejectedDocs && (
        <Alert
          type="error"
          showIcon
          icon={<AlertTriangle size={16} />}
          className="rounded-xl text-xs"
          title={
            <span className="font-bold text-red-900">
              Đang có {rejectedDocs.length} chứng từ bị TỪ CHỐI ({rejectedDocs.map(d => d.name).join(', ')})
            </span>
          }
          description={
            <span className="text-xs text-red-800">
              Hệ thống đã gửi email yêu cầu khách hàng tải lại tệp mới. Bạn không thể bấm &ldquo;Duyệt chứng từ &amp; Gửi hợp đồng ký số&rdquo; cho đến khi khách hàng tải lại tệp hợp lệ và được nhấn <b>Duyệt</b>.
            </span>
          }
        />
      )}

      {/* Bảng chứng từ */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
        <Table 
          columns={docColumns} 
          dataSource={documents} 
          pagination={false} 
          size="small"
          rowKey="key"
        />
      </div>

      {/* Box bổ sung chứng từ chuyên ngành / tùy biến */}
      {!isClosed && (
        <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-200 space-y-2.5">
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
            <Plus size={14} className="text-indigo-600" /> Bổ sung thêm loại chứng từ cho đơn hàng này:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-6">
              <Select
                placeholder="-- Chọn chứng từ chuyên ngành có sẵn trong hệ thống --"
                value={selectedSpecializedDoc || undefined}
                onChange={val => {
                  setSelectedSpecializedDoc(val);
                  setNewDocName('');
                }}
                allowClear
                className="w-full text-xs"
              >
                {SPECIALIZED_CARGO_CATEGORIES.map(cat => (
                  <OptGroup key={cat.categoryKey} label={cat.categoryName}>
                    {cat.specializedDocs.map(doc => (
                      <Option key={doc.name} value={doc.name}>
                        {doc.name} ({doc.shortCode})
                      </Option>
                    ))}
                  </OptGroup>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-4">
              <Input 
                placeholder="Hoặc tự gõ tên chứng từ khác..."
                value={newDocName}
                onChange={e => {
                  setNewDocName(e.target.value);
                  setSelectedSpecializedDoc('');
                }}
                className="text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <Button
                type="primary"
                icon={<Plus size={13} />}
                className="w-full bg-[#7367f0] text-xs font-semibold"
                onClick={() => handleAddCustomDoc()}
              >
                Thêm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer thông tin tệp tải lên */}
      {!isClosed && (
        <div className="pt-2 flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs text-gray-500">
            Đã nộp tệp: <b>{documents.filter(d => d.file !== 'Chờ tải lên').length}/{documents.length}</b> tệp
            {hasRejectedDocs && (
              <span className="text-red-600 font-semibold ml-2">
                • Bị từ chối: {rejectedDocs.length} tệp (chờ khách upload lại)
              </span>
            )}
          </span>

          {isDocsApprovedStage && (
            <Tag color="success" className="py-1.5 px-3 text-xs font-bold rounded-lg flex items-center gap-1.5 m-0">
              <CheckCircle2 size={14} /> Đã duyệt toàn bộ chứng từ &amp; Đã gửi Hợp đồng cho khách ký số
            </Tag>
          )}
        </div>
      )}
    </div>
  );
}
