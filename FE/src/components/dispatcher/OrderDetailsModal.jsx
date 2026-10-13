import { useState, useMemo } from 'react';
import { Modal, Tabs, Tag, Button, Input, InputNumber, Space, Table, message } from 'antd';
import { FileText, AlertTriangle, Download, Upload, ShieldCheck, PhoneCall, MessageCircle, Mail, DollarSign } from 'lucide-react';
import { orderApi } from '../../api/orderApi';

const defaultDocumentList = [
  { key: '1', name: 'Tờ khai hải quan', file: 'Chờ tải lên', status: 'PENDING', size: '-', uploadDate: '-' },
  { key: '2', name: 'Lệnh giao hàng & Vận đơn', file: 'Chờ tải lên', status: 'PENDING', size: '-', uploadDate: '-' },
  { key: '3', name: 'Hóa đơn thương mại & Phiếu đóng gói', file: 'Chờ tải lên', status: 'PENDING', size: '-', uploadDate: '-' },
  { key: '4', name: 'Hợp đồng mua bán', file: 'Chờ tải lên', status: 'PENDING', size: '-', uploadDate: '-' }
];

const OrderDetailsModal = ({ open, order, onCancel, onUpdateOrder }) => {
  const [activeTab, setActiveTab] = useState('1');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFee, setCancelFee] = useState(0);
  const [savingPrice, setSavingPrice] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState(false);

  // Điều chỉnh state khi order prop thay đổi chuẩn React không dùng useEffect
  const [prevOrderKey, setPrevOrderKey] = useState(order?.key || order?.order_id);
  const [contractUploaded, setContractUploaded] = useState(order?.contract_uploaded || false);
  const [currentAgreedPrice, setCurrentAgreedPrice] = useState(order?.agreed_price || 0);

  if (order && (order.key || order.order_id) !== prevOrderKey) {
    setPrevOrderKey(order.key || order.order_id);
    setCurrentAgreedPrice(order.agreed_price || 0);
    setContractUploaded(order.contract_uploaded || false);
  }

  const [documents, setDocuments] = useState(
    order?.documents?.length ? order.documents : defaultDocumentList
  );

  if (!order) return null;

  const handleApproveDoc = (docKey) => {
    setDocuments(prev => prev.map(d => d.key === docKey ? { ...d, status: 'APPROVED' } : d));
    message.success('Đã duyệt chứng từ!');
  };

  const handleRejectDoc = (docKey) => {
    setDocuments(prev => prev.map(d => d.key === docKey ? { ...d, status: 'REJECTED' } : d));
    message.warning('Đã từ chối chứng từ.');
  };

  const handleConfirmAllDocuments = () => {
    const updatedDocs = documents.map(d => ({ ...d, status: 'APPROVED' }));
    setDocuments(updatedDocs);
    onUpdateOrder({
      ...order,
      documents: updatedDocs
    });
    message.success('Đã duyệt toàn bộ chứng từ!');
  };

  // Xác nhận giá cước thỏa thuận đã chốt với khách qua BE
  const handleSavePrice = async () => {
    if (!currentAgreedPrice || currentAgreedPrice <= 0) {
      message.error('Vui lòng nhập giá cước thỏa thuận lớn hơn 0!');
      return;
    }
    try {
      setSavingPrice(true);
      await orderApi.updateAgreedPrice(order.id || order.order_id, currentAgreedPrice);
      onUpdateOrder({
        ...order,
        agreed_price: currentAgreedPrice
      });
      message.success(`Đã cập nhật giá thỏa thuận: ${currentAgreedPrice.toLocaleString()} đ lên hệ thống BE`);
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Lỗi khi cập nhật giá cước lên máy chủ');
    } finally {
      setSavingPrice(false);
    }
  };

  // Xác nhận đơn hàng: Chuyển sang READY_FOR_PLANNING (Sẵn sàng xếp xe) qua BE
  const handleConfirmOrder = async () => {
    if (!currentAgreedPrice || currentAgreedPrice <= 0) {
      message.error('Vui lòng nhập giá cước thỏa thuận đã chốt với khách hàng trước khi xác nhận đơn!');
      return;
    }
    try {
      setConfirmingOrder(true);
      await orderApi.confirmOrder(order.id || order.order_id, currentAgreedPrice);
      
      const updatedDocs = documents.map(d => ({ ...d, status: 'APPROVED' }));
      setDocuments(updatedDocs);

      onUpdateOrder({
        ...order,
        status: 'READY_FOR_PLANNING',
        agreed_price: currentAgreedPrice,
        documents: updatedDocs,
        contract_uploaded: true
      });
      message.success('Xác nhận đơn thành công! Đơn hàng đã chuyển sang trạng thái Sẵn sàng xếp xe.');
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Lỗi khi xác nhận đơn hàng trên máy chủ');
    } finally {
      setConfirmingOrder(false);
    }
  };

  const handleExecuteCancel = () => {
    if (!cancelReason.trim()) {
      message.error('Vui lòng nhập lý do hủy đơn!');
      return;
    }
    onUpdateOrder({
      ...order,
      status: 'CANCELLED',
      cancellation_reason: cancelReason,
      cancellation_fee: cancelFee
    });
    setCancelModalOpen(false);
    message.warning(`Đã hủy đơn hàng! Phí phạt: ${cancelFee.toLocaleString()} VNĐ`);
  };

  const docColumns = [
    { 
      title: 'Tên chứng từ', 
      dataIndex: 'name', 
      key: 'name',
      render: (text) => <span className="font-semibold text-gray-800">{text}</span>
    },
    { 
      title: 'Tệp đính kèm', 
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
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      render: (st) => (
        st === 'APPROVED' ? <Tag color="success">ĐÃ HỢP LỆ</Tag> :
        st === 'REJECTED' ? <Tag color="error">TỪ CHỐI</Tag> :
        <Tag color="warning">CHỜ KIỂM TRA</Tag>
      )
    },
    { 
      title: 'Thao tác', 
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

  const cleanPhone = (order.customer_phone || '').replace(/[^0-9]/g, '');

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
                <h3 className="text-lg font-bold text-gray-800">Chi tiết đơn hàng</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {order.source === 'HOMEPAGE' ? (
                <Tag color="orange" className="font-semibold text-xs rounded-full px-3 py-0.5">
                  Nguồn: Website
                </Tag>
              ) : (
                <Tag color="blue" className="font-semibold text-xs rounded-full px-3 py-0.5">
                  Nguồn: Hotline / Trực tiếp
                </Tag>
              )}
              <Tag color={order.status === 'DELIVERED' ? 'green' : order.status === 'CANCELLED' ? 'red' : order.status === 'READY_FOR_PLANNING' ? 'cyan' : 'default'} className="px-3 py-1 font-semibold text-xs rounded-full">
                {order.status === 'DRAFT' ? 'ĐƠN NHÁP' : order.status === 'READY_FOR_PLANNING' ? 'SẴN SÀNG XẾP XE' : order.status}
              </Tag>
            </div>
          </div>
        }
        open={open}
        onCancel={onCancel}
        width={950}
        footer={[
          <Button key="close" onClick={onCancel}>Đóng</Button>,
          order.status === 'DRAFT' && (
            <Button 
              key="confirmOrder" 
              type="primary" 
              loading={confirmingOrder}
              className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold" 
              onClick={handleConfirmOrder}
            >
              Xác nhận đơn hàng
            </Button>
          ),
          (order.status === 'CONFIRMED' || order.status === 'READY_FOR_PLANNING') && (
            <Button key="confirmDocs" type="primary" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmAllDocuments}>
              Xác nhận chứng từ
            </Button>
          ),
          ['DRAFT', 'CONFIRMED', 'READY_FOR_PLANNING'].includes(order.status) && (
            <Button key="cancel" danger onClick={() => setCancelModalOpen(true)}>
              Hủy đơn
            </Button>
          )
        ]}
      >
        <div className="py-2">
          {/* Banner hướng dẫn luồng xử lý đối với đơn DRAFT */}
          {order.status === 'DRAFT' && (
            <div className="mb-4 p-3.5 bg-gradient-to-r from-amber-50 to-indigo-50 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-xs mb-1">
                <AlertTriangle size={15} className="text-amber-600" />
                <span>Quy trình xử lý đơn hàng nháp:</span>
              </div>
              <div className="text-xs text-gray-700 space-y-1">
                <p>1. <b>Liên hệ khách hàng:</b> Gọi điện hoặc nhắn Zalo để xác nhận nhu cầu vận chuyển.</p>
                <p>2. <b>Chốt giá cước:</b> Thống nhất giá cước thỏa thuận và cập nhật vào ô bên dưới.</p>
                <p>3. <b>Thu thập chứng từ:</b> Yêu cầu khách cung cấp hồ sơ, kiểm tra và duyệt tính hợp lệ.</p>
                <p>4. <b>Xác nhận đơn:</b> Bấm &quot;Xác nhận đơn hàng&quot; để chuyển sang trạng thái Sẵn sàng xếp xe (khi đó mới được gán xe và tài xế).</p>
              </div>
            </div>
          )}
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            items={[
              {
                key: '1',
                label: <span className="font-semibold text-xs">Tổng quan & Hàng hóa</span>,
                children: (
                  <div className="space-y-4">
                    {/* Box Liên hệ khách hàng & Chốt giá cước thỏa thuận */}
                    <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                            <PhoneCall size={14} className="text-indigo-600" /> Liên hệ khách hàng &amp; Chốt cước:
                          </span>
                          <span className="text-xs text-gray-500">
                            {order.customer || order.customer_name} - SĐT: <b className="text-gray-800">{order.customer_phone || 'Chưa có'}</b>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {cleanPhone && (
                            <>
                              <a 
                                href={`tel:${cleanPhone}`} 
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-xs shadow-sm"
                              >
                                <PhoneCall size={13} /> Gọi điện
                              </a>
                              <a 
                                href={`https://zalo.me/${cleanPhone}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold text-xs shadow-sm"
                              >
                                <MessageCircle size={13} /> Nhắn Zalo
                              </a>
                            </>
                          )}
                          {order.customer_email && (
                            <a 
                              href={`mailto:${order.customer_email}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium text-xs border border-gray-200"
                            >
                              <Mail size={13} /> Gửi Email
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Ô Chốt giá cước thỏa thuận */}
                      <div className="p-3 bg-white rounded-lg border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <DollarSign size={18} className="text-indigo-600" />
                          <div>
                            <div className="text-xs font-bold text-gray-800">Giá cước thỏa thuận:</div>
                            <div className="text-[11px] text-gray-400">Thống nhất với khách hàng sau khi tư vấn</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <InputNumber 
                            className="w-44 font-bold text-blue-700"
                            value={currentAgreedPrice}
                            onChange={val => setCurrentAgreedPrice(val || 0)}
                            formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={val => val.replace(/\$\s?|(,*)/g, '')}
                            placeholder="Nhập giá cước..."
                            min={0}
                          />
                          <span className="text-xs text-gray-500 font-medium">VNĐ</span>
                          <Button 
                            type="primary" 
                            size="middle" 
                            loading={savingPrice}
                            className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold text-xs"
                            onClick={handleSavePrice}
                          >
                            Lưu giá
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                      <div>
                        <div className="text-xs text-gray-500">Khách hàng:</div>
                        <div className="font-bold text-gray-800 text-sm mt-0.5">{order.customer || order.customer_name}</div>
                        <div className="text-xs text-gray-500 mt-1">Mã HAWB: <span className="font-mono font-semibold text-indigo-600">{order.hawb_code || order.order_id}</span></div>
                        <div className="text-xs text-gray-500 mt-1">SĐT: {order.customer_phone || 'Chưa cung cấp'} | Email: {order.customer_email || 'Chưa cung cấp'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Tuyến đường:</div>
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
                        <div className="text-[11px] text-gray-500">Số lượng</div>
                        <div className="font-bold text-gray-800 text-sm mt-0.5">{order.package_count || 1} {order.package_unit || 'Kiện'}</div>
                      </div>
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <div className="text-[11px] text-gray-500">Kích thước</div>
                        <div className="font-bold text-gray-800 text-sm mt-0.5">{order.length_cm || 0}x{order.width_cm || 0}x{order.height_cm || 0} cm</div>
                      </div>
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <div className="text-[11px] text-gray-500">Trọng lượng</div>
                        <div className="font-bold text-gray-800 text-sm mt-0.5">{order.weight || order.weight_kg || 0} kg</div>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="text-[11px] text-amber-800 font-medium">Tải trọng tính cước</div>
                        <div className="font-bold text-amber-600 text-base mt-0.5">{order.chargeable || order.chargeable_weight || 0} kg</div>
                      </div>
                    </div>

                    {order.order_notes && (
                      <div className="p-3 bg-yellow-50/80 rounded-xl border border-yellow-200 text-xs text-yellow-900">
                        <div className="font-bold flex items-center gap-1 mb-1">
                          <AlertTriangle size={14} /> Ghi chú:
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
                        <h4 className="text-sm font-bold text-gray-800">Danh mục chứng từ</h4>
                      </div>
                      <Space>
                        <Button size="small" icon={<Upload size={14} />} onClick={() => message.info('Mở cửa sổ tải lên chứng từ')}>
                          Tải lên chứng từ
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
                      <span className="text-xs text-gray-500">Đã duyệt: <b>{documents.filter(d => d.status === 'APPROVED').length}/{documents.length}</b> tệp</span>
                      <Button 
                        type="primary" 
                        size="small" 
                        icon={<ShieldCheck size={14} />}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleConfirmAllDocuments}
                      >
                        Xác nhận toàn bộ chứng từ
                      </Button>
                    </div>
                  </div>
                )
              },
              {
                key: '3',
                label: <span className="font-semibold text-xs">Hợp đồng</span>,
                children: (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <h4 className="font-bold text-gray-800 text-sm mb-3">Hợp đồng vận tải</h4>

                      <div className="flex flex-wrap gap-2">
                        <Button icon={<Download size={15} />} onClick={() => message.success('Đang tải về mẫu hợp đồng PDF...')}>
                          Tải mẫu hợp đồng PDF
                        </Button>
                        <Button 
                          type={contractUploaded ? "default" : "primary"}
                          icon={<Upload size={15} />} 
                          className={!contractUploaded ? "bg-[#7367f0]" : ""}
                          onClick={() => {
                            setContractUploaded(true);
                            message.success('Đã tải lên tệp hợp đồng!');
                          }}
                        >
                          {contractUploaded ? 'Đã tải lên hợp đồng đã ký' : 'Tải lên hợp đồng đã ký'}
                        </Button>
                      </div>

                      <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="text-xs font-bold text-gray-700 mb-1">Điều khoản áp dụng:</div>
                        <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                          <li>Thời gian chờ bốc dỡ miễn phí: <b>60 phút</b>.</li>
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
                label: <span className="font-semibold text-xs">Tài chính & Chi phí</span>,
                children: (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200">
                        <div className="text-xs text-gray-500">Giá thỏa thuận:</div>
                        <div className="text-xl font-bold text-blue-700 mt-1">
                          {(currentAgreedPrice || order.agreed_price || 0) > 0 
                            ? `${(currentAgreedPrice || order.agreed_price).toLocaleString()} VNĐ` 
                            : 'Chưa chốt giá'}
                        </div>
                      </div>

                      <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200">
                        <div className="text-xs text-indigo-700 font-semibold">Phí phụ trội:</div>
                        <div className="text-xl font-bold text-indigo-800 mt-1">
                          {(order.extra_fees_surcharge || 0).toLocaleString()} VNĐ
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200">
                        <div className="text-xs text-emerald-700 font-semibold">Phí thu hộ:</div>
                        <div className="text-xl font-bold text-emerald-800 mt-1">
                          {(order.extra_fees_collection || 0).toLocaleString()} VNĐ
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-amber-900 uppercase">Phí chờ bốc dỡ:</div>
                          <div className="text-xs text-amber-700 mt-0.5">Phí chờ phát sinh nếu thời gian chờ bốc xếp vượt định mức 60 phút:</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-amber-600">0 VNĐ</div>
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
        title={<span className="text-red-600 font-bold flex items-center gap-2"><AlertTriangle size={18} /> Hủy đơn hàng</span>}
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        onOk={handleExecuteCancel}
        okText="Xác nhận hủy đơn"
        okButtonProps={{ danger: true }}
      >
        <div className="py-2 space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-700">Lý do hủy đơn:</label>
            <Input.TextArea 
              rows={3} 
              className="mt-1" 
              placeholder="Nhập lý do hủy đơn..." 
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700">Phí phạt hủy đơn (VNĐ):</label>
            <InputNumber 
              className="w-full mt-1 font-bold text-red-600"
              value={cancelFee}
              onChange={val => setCancelFee(val || 0)}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
            <div className="flex gap-2 mt-2">
              <Button size="small" onClick={() => setCancelFee(0)}>Miễn phạt (0 VNĐ)</Button>
              <Button size="small" onClick={() => setCancelFee(1000000)}>1,000,000 VNĐ</Button>
              <Button size="small" onClick={() => setCancelFee(2000000)}>2,000,000 VNĐ</Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default OrderDetailsModal;