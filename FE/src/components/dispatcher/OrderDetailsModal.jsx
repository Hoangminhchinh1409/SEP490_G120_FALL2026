import { useState } from 'react';
import { Modal, Tabs, Tag, Button, Input, InputNumber, Alert, Space, Table, message } from 'antd';
import { FileText, AlertTriangle, Download, Upload, ShieldCheck } from 'lucide-react';

const OrderDetailsModal = ({ open, order, onCancel, onUpdateOrder }) => {
  const [activeTab, setActiveTab] = useState('1');
  const [contractUploaded, setContractUploaded] = useState(order?.contract_uploaded || false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFee, setCancelFee] = useState(0);

  // Danh sách chứng từ hải quan của đơn hàng
  const [documents, setDocuments] = useState(
    order?.documents || [
      { key: '1', name: 'Tờ khai Hải quan thông quan (ToKhaiHQ)', file: 'ToKhaiHQ7N_QDTQ_108187779340.xlsx', status: 'SUBMITTED', size: '74.2 KB', uploadDate: '2026-10-12 10:15' },
      { key: '2', name: 'Lệnh giao hàng & Vận đơn (Bill/D/O)', file: 'Bill.pdf', status: 'SUBMITTED', size: '286.4 KB', uploadDate: '2026-10-12 10:20' },
      { key: '3', name: 'Hóa đơn & Phiếu đóng gói (CI/PL)', file: 'CI PL SOUND LIGHT.pdf', status: 'SUBMITTED', size: '119.7 KB', uploadDate: '2026-10-12 10:22' },
      { key: '4', name: 'Hợp đồng mua bán ngoại thương', file: 'HDMB SLVN TT.pdf', status: 'APPROVED', size: '1.3 MB', uploadDate: '2026-10-12 09:40' },
      { key: '5', name: 'Giấy nộp tiền thuế / Bankslip', file: 'Bankslip YEL 29952.jpg', status: 'SUBMITTED', size: '638.8 KB', uploadDate: '2026-10-12 10:30' }
    ]
  );

  if (!order) return null;

  // Xử lý duyệt chứng từ đơn lẻ
  const handleApproveDoc = (docKey) => {
    setDocuments(prev => prev.map(d => d.key === docKey ? { ...d, status: 'APPROVED' } : d));
    message.success('Đã xác nhận tính hợp lệ của chứng từ!');
  };

  // Xử lý từ chối / xóa file lỗi
  const handleRejectDoc = (docKey) => {
    setDocuments(prev => prev.map(d => d.key === docKey ? { ...d, status: 'REJECTED' } : d));
    message.warning('Đã từ chối tệp chứng từ và yêu cầu khách hàng gửi lại.');
  };

  // Xác nhận toàn bộ chứng từ (UC-06 -> Ready for Planning)
  const handleConfirmAllDocuments = () => {
    const updatedDocs = documents.map(d => ({ ...d, status: 'APPROVED' }));
    setDocuments(updatedDocs);
    onUpdateOrder({
      ...order,
      status: 'READY_FOR_PLANNING',
      documents: updatedDocs
    });
    message.success('Toàn bộ hồ sơ hải quan đã được duyệt! Đơn hàng sẵn sàng xếp xe (Ready for Planning).');
  };

  // Xác nhận đơn nháp sang Confirmed (UC-04 / BR-45)
  const handleConfirmOrder = () => {
    if (!contractUploaded) {
      message.error('Bắt buộc: Cần khởi tạo và tải lên tệp Hợp đồng đơn hàng (Order Contract) đã ký trước khi Xác nhận đơn!');
      return;
    }
    onUpdateOrder({
      ...order,
      status: 'CONFIRMED',
      contract_uploaded: true
    });
    message.success('Đơn hàng đã được xác nhận (CONFIRMED) và kích hoạt điều khoản hợp đồng!');
  };

  // Xử lý Hủy đơn theo nấc phạt (UC-05 / BR-18)
  const handleExecuteCancel = () => {
    if (!cancelReason.trim()) {
      message.error('Bắt buộc nhập lý do hủy đơn!');
      return;
    }
    onUpdateOrder({
      ...order,
      status: 'CANCELLED',
      cancellation_reason: cancelReason,
      cancellation_fee: cancelFee
    });
    setCancelModalOpen(false);
    message.warning(`Đã hủy đơn hàng! Phí phạt hủy ghi nhận: ${cancelFee.toLocaleString()} VNĐ`);
  };

  const docColumns = [
    { 
      title: 'Loại chứng từ hải quan', 
      dataIndex: 'name', 
      key: 'name',
      render: (text) => <span className="font-semibold text-gray-800">{text}</span>
    },
    { 
      title: 'Tệp đính kèm (Lô 2)', 
      dataIndex: 'file', 
      key: 'file',
      render: (text, record) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-blue-600 hover:underline cursor-pointer">
          <FileText size={14} />
          <span>{text}</span>
          <span className="text-gray-400 font-sans">({record.size})</span>
        </div>
      )
    },
    { 
      title: 'Trạng thái duyệt', 
      dataIndex: 'status', 
      key: 'status',
      render: (st) => (
        st === 'APPROVED' ? <Tag color="success" className="font-medium">ĐÃ HỢP LỆ</Tag> :
        st === 'REJECTED' ? <Tag color="error" className="font-medium">TỪ CHỐI</Tag> :
        <Tag color="warning" className="font-medium">CHỜ KIỂM TRA</Tag>
      )
    },
    { 
      title: 'Thao tác kiểm duyệt', 
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            type="primary" 
            ghost 
            className="text-xs"
            onClick={() => handleApproveDoc(record.key)}
            disabled={record.status === 'APPROVED'}
          >
            Duyệt
          </Button>
          <Button 
            size="small" 
            danger 
            ghost 
            className="text-xs"
            onClick={() => handleRejectDoc(record.key)}
            disabled={record.status === 'REJECTED'}
          >
            Từ chối
          </Button>
        </Space>
      )
    }
  ];

  return (
    <>
      <Modal
        title={
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 pr-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-xl font-bold">
                {order.order_id}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Chi tiết Hồ sơ Đơn hàng (Order Details)</h3>
                <p className="text-xs text-gray-500 font-normal">Quản lý vòng đời đơn, duyệt chứng từ hải quan, hợp đồng và chi phí phát sinh</p>
              </div>
            </div>
            <Tag color={order.status === 'DELIVERED' ? 'green' : order.status === 'CANCELLED' ? 'red' : 'blue'} className="px-3 py-1 font-semibold text-xs rounded-full">
              {order.status}
            </Tag>
          </div>
        }
        open={open}
        onCancel={onCancel}
        width={950}
        footer={[
          <Button key="close" onClick={onCancel}>Đóng</Button>,
          order.status === 'DRAFT' && (
            <Button key="confirmOrder" type="primary" className="bg-[#7367f0]" onClick={handleConfirmOrder}>
              Xác nhận Đơn hàng (Confirm Order)
            </Button>
          ),
          (order.status === 'CONFIRMED' || order.status === 'READY_FOR_PLANNING') && (
            <Button key="confirmDocs" type="primary" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmAllDocuments}>
              Xác nhận Bộ Chứng từ (Confirm Docs)
            </Button>
          ),
          ['DRAFT', 'CONFIRMED', 'READY_FOR_PLANNING'].includes(order.status) && (
            <Button key="cancel" danger onClick={() => setCancelModalOpen(true)}>
              Hủy đơn (Cancel Order)
            </Button>
          )
        ]}
      >
        <div className="py-2">
          {/* Cảnh báo quy định lưu trữ */}
          <Alert
            title="Quy định Lưu trữ & Pháp lý:"
            description="Tệp chứng từ hải quan sẽ tự động purge sau 60-90 ngày kể từ khi đóng đơn (Nghị định 13/2023/NĐ-CP). Bắt buộc lưu trữ ảnh niêm chì, ảnh POD và nhật ký trong 2 năm (Luật Thương mại 2005)."
            type="info"
            showIcon
            className="mb-4 text-xs"
          />

          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            items={[
              {
                key: '1',
                label: <span className="font-semibold text-xs">Tổng quan & Hàng hóa</span>,
                children: (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                      <div>
                        <div className="text-xs text-gray-500">Khách hàng / Doanh nghiệp:</div>
                        <div className="font-bold text-gray-800 text-sm mt-0.5">{order.customer || order.customer_name}</div>
                        <div className="text-xs text-gray-500 mt-1">Mã HAWB: <span className="font-mono font-semibold text-indigo-600">{order.hawb_code || 'HNAE25090222'}</span></div>
                        <div className="text-xs text-gray-500 mt-1">SĐT: {order.customer_phone || '0977887918'} | Email: {order.customer_email || 'adtek@logistics.com'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Tuyến đường di chuyển:</div>
                        <div className="font-medium text-gray-700 text-xs mt-1">
                          <span className="font-bold text-blue-600">Lấy:</span> {order.pickup || order.pickup_address}
                        </div>
                        <div className="font-medium text-gray-700 text-xs mt-1">
                          <span className="font-bold text-emerald-600">Giao:</span> {order.dropoff || order.delivery_address}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <div className="text-[11px] text-gray-500">Số lượng & Đơn vị</div>
                        <div className="font-bold text-gray-800 text-sm mt-0.5">{order.package_count || 18} {order.package_unit || 'Pallet'}</div>
                      </div>
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <div className="text-[11px] text-gray-500">Kích thước (D x R x C)</div>
                        <div className="font-bold text-gray-800 text-sm mt-0.5">{order.length_cm || 120}x{order.width_cm || 100}x{order.height_cm || 160} cm</div>
                      </div>
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <div className="text-[11px] text-gray-500">Trọng lượng thực tế</div>
                        <div className="font-bold text-gray-800 text-sm mt-0.5">{order.weight || order.weight_kg || '2,850'} kg</div>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="text-[11px] text-amber-800 font-medium">Tải trọng tính cước</div>
                        <div className="font-bold text-amber-600 text-base mt-0.5">{order.chargeable || order.chargeable_weight || '2,850'} kg</div>
                      </div>
                    </div>

                    {order.order_notes && (
                      <div className="p-3 bg-yellow-50/80 rounded-xl border border-yellow-200 text-xs text-yellow-900">
                        <div className="font-bold flex items-center gap-1 mb-1">
                          <AlertTriangle size={14} /> Ghi chú nghiệp vụ / SOP hiện trường:
                        </div>
                        {order.order_notes}
                      </div>
                    )}
                  </div>
                )
              },
              {
                key: '2',
                label: <span className="font-semibold text-xs">Kiểm duyệt Chứng từ</span>,
                children: (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-gray-800">Danh mục Hồ sơ Hải quan Đính kèm</h4>
                        <p className="text-xs text-gray-500">Đối chiếu dữ liệu với tài liệu scan thực tế</p>
                      </div>
                      <Space>
                        <Button size="small" icon={<Upload size={14} />} onClick={() => message.info('Mở cửa sổ tải lên chứng từ thay khách hàng (Upload on behalf)')}>
                          Tải lên thay khách (Upload on behalf)
                        </Button>
                      </Space>
                    </div>

                    <Table 
                      columns={docColumns} 
                      dataSource={documents} 
                      pagination={false} 
                      size="small"
                      className="border border-gray-100 rounded-lg"
                    />

                    <div className="mt-3 p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                      <span className="text-xs text-gray-500">Trạng thái hồ sơ: Đã duyệt <b>{documents.filter(d => d.status === 'APPROVED').length}/{documents.length}</b> tệp</span>
                      <Button 
                        type="primary" 
                        size="small" 
                        icon={<ShieldCheck size={14} />}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleConfirmAllDocuments}
                      >
                        Xác nhận Toàn bộ Chứng từ
                      </Button>
                    </div>
                  </div>
                )
              },
              {
                key: '3',
                label: <span className="font-semibold text-xs">Hợp đồng Đơn hàng</span>,
                children: (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <h4 className="font-bold text-gray-800 text-sm mb-1">Hợp đồng Vận tải Đơn hàng (Order Contract)</h4>
                      <p className="text-xs text-gray-500 mb-3">
                        Hệ thống tự động liên kết với Hợp đồng khung đang có hiệu lực và sinh file PDF Hợp đồng chi tiết cho mã vận đơn <b>{order.order_id}</b>.
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Button icon={<Download size={15} />} onClick={() => message.success('Đang tạo và tải về mẫu HĐ Vận tải PDF...')}>
                          Sinh file Hợp đồng mẫu PDF (HDMB_SLVN.pdf)
                        </Button>
                        <Button 
                          type={contractUploaded ? "default" : "primary"}
                          icon={<Upload size={15} />} 
                          className={!contractUploaded ? "bg-[#7367f0]" : ""}
                          onClick={() => {
                            setContractUploaded(true);
                            message.success('Đã tải lên tệp Hợp đồng đơn hàng có chữ ký số của Khách hàng!');
                          }}
                        >
                          {contractUploaded ? 'Đã tải lên tệp hợp đồng có chữ ký (HĐMB_Signed.pdf)' : 'Tải lên Hợp đồng đã ký (Kích hoạt Confirm)'}
                        </Button>
                      </div>

                      <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="text-xs font-bold text-gray-700 mb-1">Điều khoản Hợp đồng khung đang áp dụng:</div>
                        <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                          <li>Thời gian chờ bốc dỡ miễn phí: <b>60 phút</b> (Vượt quá tính 150.000 VNĐ/giờ).</li>
                          <li>Nấc phạt hủy đơn: Hủy trước 4h phạt <b>30%</b>, hủy sau khi điều xe phạt <b>70%</b> giá trị cước.</li>
                          <li>Hạn mức đền bù tối đa: <b>100% giá trị khai báo</b> đối với hàng niêm phong nguyên chì.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                key: '4',
                label: <span className="font-semibold text-xs">Tài chính & Phí Phát sinh</span>,
                children: (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200">
                        <div className="text-xs text-gray-500">Giá chốt thỏa thuận (Agreed Price):</div>
                        <div className="text-xl font-bold text-blue-700 mt-1">
                          {(order.agreed_price || 6500000).toLocaleString()} VNĐ
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1">Thỏa thuận trực tiếp Zalo/Hotline</div>
                      </div>

                      <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200">
                        <div className="text-xs text-indigo-700 font-semibold">Phí phụ trội Surcharge (Có VAT):</div>
                        <div className="text-xl font-bold text-indigo-800 mt-1">
                          {(order.extra_fees_surcharge || 450000).toLocaleString()} VNĐ
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">Phí lưu ca, bốc xếp đêm (Doanh thu ALS)</div>
                      </div>

                      <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200">
                        <div className="text-xs text-emerald-700 font-semibold">Phí Thu hộ / Off-book (Cô lập VAT):</div>
                        <div className="text-xl font-bold text-emerald-800 mt-1">
                          {(order.extra_fees_collection || 1200000).toLocaleString()} VNĐ
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">Nộp thuế HQ & Hạ bãi cảng theo Bankslip</div>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-amber-900 uppercase">Phí Chờ Tự Động (Waiting Fee):</div>
                          <div className="text-xs text-amber-700 mt-0.5">Xe đã có mặt tại kho 140 phút (vượt thời gian miễn phí 80 phút). Hệ thống đề xuất:</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-amber-600">200,000 VNĐ</div>
                          <Button size="small" type="primary" className="bg-amber-600 mt-1" onClick={() => message.success('Đã xác nhận Phí chờ vào tài chính đơn hàng!')}>
                            Xác nhận Phí Chờ
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
            ]}
          />
        </div>
      </Modal>

      {/* Modal Hủy Đơn Hàng */}
      <Modal
        title={<span className="text-red-600 font-bold flex items-center gap-2"><AlertTriangle size={18} /> Hủy Đơn Hàng & Tính Phí Phạt</span>}
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        onOk={handleExecuteCancel}
        okText="Xác nhận Hủy Đơn"
        okButtonProps={{ danger: true }}
      >
        <div className="py-2 space-y-3">
          <Alert 
            type="warning" 
            title="Chính sách Phạt Hủy Đơn:"
            description="Áp dụng mức phạt hủy theo Hợp đồng khung. Hủy trước khi bốc hàng lên xe được tính theo nấc giờ quy định."
            showIcon 
          />
          <div>
            <label className="text-xs font-bold text-gray-700">Lý do hủy đơn (Bắt buộc):</label>
            <Input.TextArea 
              rows={3} 
              className="mt-1" 
              placeholder="Nhập lý do chi tiết từ khách hàng..." 
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700">Phí phạt hủy đơn (Cancellation Fee - VNĐ):</label>
            <InputNumber 
              className="w-full mt-1 font-bold text-red-600"
              value={cancelFee}
              onChange={val => setCancelFee(val || 0)}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
            <div className="flex gap-2 mt-2">
              <Button size="small" onClick={() => setCancelFee(0)}>Miễn phạt (0 VNĐ)</Button>
              <Button size="small" onClick={() => setCancelFee(1000000)}>Nấc 1: 1,000,000 VNĐ</Button>
              <Button size="small" onClick={() => setCancelFee(2000000)}>Nấc 2: 2,000,000 VNĐ</Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default OrderDetailsModal;
