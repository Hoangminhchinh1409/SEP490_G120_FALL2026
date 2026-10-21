import React from 'react';
import { Table, Button, Tag, Space, Select, Input, Popconfirm, Tooltip } from 'antd';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Info 
} from 'lucide-react';
import { SPECIALIZED_CARGO_CATEGORIES } from '../../../data/dispatcherPresets';

const { Option, OptGroup } = Select;

export default function OrderDocumentsTab({
  order,
  isWebOrder,
  documents,
  setDocuments,
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
  const docColumns = [
    { 
      title: 'Tên chứng từ', 
      dataIndex: 'name', 
      key: 'name',
      width: '40%',
      render: (text, record) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-gray-800 text-xs">{text}</span>
          {record.isBasic ? (
            <Tag color="blue" className="text-[10px] m-0 py-0 px-1 font-semibold">Cơ bản</Tag>
          ) : (
            <Tag color="purple" className="text-[10px] m-0 py-0 px-1 font-semibold">Chuyên ngành</Tag>
          )}
        </div>
      )
    },
    { 
      title: 'Tệp đính kèm', 
      dataIndex: 'file', 
      key: 'file',
      width: '28%',
      render: (text, record) => (
        record.file === 'Chờ tải lên' || record.status === 'WAITING_UPLOAD' ? (
          isWebOrder ? (
            <span className="text-xs text-gray-400 italic flex items-center gap-1">
              <Clock size={12} className="text-amber-500" /> Chờ khách nộp qua link Web
            </span>
          ) : (
            <Button 
              size="small" 
              icon={<Upload size={13} />} 
              className="text-xs border-dashed border-indigo-300 text-indigo-700 hover:border-indigo-500 hover:text-indigo-800"
              onClick={() => triggerUploadDoc(record.key)}
            >
              Tải lên tệp
            </Button>
          )
        ) : (
          <div className="flex items-center gap-1.5 font-mono text-xs text-blue-600">
            <FileText size={14} className="shrink-0" />
            <span 
              className="truncate max-w-[130px] font-semibold underline cursor-pointer hover:text-blue-800" 
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
            {!isWebOrder && (
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
        )
      )
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      width: '18%',
      render: (st) => (
        st === 'APPROVED' ? <Tag color="success" className="font-semibold text-[11px]">ĐÃ HỢP LỆ</Tag> :
        st === 'REJECTED' ? <Tag color="error" className="font-semibold text-[11px]">TỪ CHỐI</Tag> :
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
            disabled={record.status === 'APPROVED' || record.file === 'Chờ tải lên'}
          >
            Duyệt
          </Button>
          <Button 
            size="small" 
            danger 
            ghost 
            className="text-xs"
            onClick={() => handleRejectDoc(record.key)}
            disabled={record.status === 'REJECTED' || record.file === 'Chờ tải lên'}
          >
            Từ chối
          </Button>
          {record.isCustom && (
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
        <Button
          icon={<Sparkles size={14} className="text-purple-600" />}
          className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 text-xs font-semibold shrink-0"
          onClick={() => setAssistantDrawerOpen(true)}
        >
          Trợ lý AI gợi ý
        </Button>
      </div>

      {/* Thông tin đơn Web nếu có */}
      {isWebOrder && (
        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-600 shrink-0" />
            <div>
              <span>Đơn hàng Web: Khách hàng truy cập link tra cứu để gửi tệp. Trạng thái hiện tại: </span>
              <Tag color="processing" className="font-bold text-xs">
                {order.web_workflow?.stage === 'DOCS_UPLOADED' ? 'Khách đã tải chứng từ' : 'Chờ nộp chứng từ'}
              </Tag>
            </div>
          </div>
          {order.tracking_token && (
            <Button 
              size="small" 
              type="link" 
              onClick={() => window.open(`/tracking/${order.tracking_token}`, '_blank')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 p-0"
            >
              Mở link khách hàng &rarr;
            </Button>
          )}
        </div>
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

      {/* Footer kiểm duyệt toàn bộ */}
      <div className="pt-2 flex justify-between items-center">
        <span className="text-xs text-gray-500">
          Đã nộp tệp: <b>{documents.filter(d => d.file !== 'Chờ tải lên').length}/{documents.length}</b> tệp
        </span>
        <Button 
          type="primary" 
          loading={confirmingDocs}
          className="bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs" 
          onClick={handleConfirmAllDocuments}
        >
          {isWebOrder ? 'Duyệt chứng từ & Gửi hợp đồng ký số' : 'Xác nhận toàn bộ & Xếp chuyến'}
        </Button>
      </div>
    </div>
  );
}
