"use client";
import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Input, Modal, Form, Select, InputNumber, Row, Col, Space, Card, message, DatePicker, Tooltip } from 'antd';
import { ScrollText, Plus, Search, Edit3, Download, Building, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';
import { dispatcherApi } from '../../api/dispatcherApi';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function ContractsManagement() {
  const [contracts, setContracts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterPartyType, setFilterPartyType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [exportModalContract, setExportModalContract] = useState(null);
  const [form] = Form.useForm();

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const [contractsData, customersData] = await Promise.all([
        dispatcherApi.getContracts(),
        dispatcherApi.getCustomers()
      ]);
      setContracts(contractsData || []);
      setCustomers(customersData || []);
    } catch (err) {
      console.error('fetchContracts error:', err);
      message.error('Không thể kết nối đến máy chủ để tải danh sách hợp đồng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadInitialContracts = async () => {
      try {
        const [contractsData, customersData] = await Promise.all([
          dispatcherApi.getContracts(),
          dispatcherApi.getCustomers()
        ]);
        if (active) {
          setContracts(contractsData || []);
          setCustomers(customersData || []);
        }
      } catch (err) {
        if (active) {
          console.error('fetchContracts error:', err);
          message.error('Không thể kết nối đến máy chủ để tải danh sách hợp đồng');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInitialContracts();

    return () => {
      active = false;
    };
  }, []);

  const handleOpenCreate = () => {
    setEditingContract(null);
    setIsModalOpen(true);
    setTimeout(() => {
      form.resetFields();
      form.setFieldsValue({
        party_type: 'CUSTOMER',
        partner_id: customers[0]?.id || 1,
        free_waiting_mins: 60,
        waiting_fee_per_hour: 150000,
        cancellation_tiers: 'Hủy trước 4h: Phạt 30% | Sau khi điều xe: Phạt 70%',
        liability_cap_vnd: 200000000,
        status: 'ACTIVE',
        date_range: [dayjs('2026-01-01'), dayjs('2026-12-31')]
      });
    }, 0);
  };

  const handleOpenEdit = (record) => {
    setEditingContract(record);
    setIsModalOpen(true);
    setTimeout(() => {
      form.setFieldsValue({
        ...record,
        date_range: [dayjs(record.start_date || '2026-01-01'), dayjs(record.end_date || '2026-12-31')]
      });
    }, 0);
  };

  const handleExportContract = (record) => {
    setExportModalContract(record);
  };

  const handleSubmit = () => {
    form.validateFields().then(async (values) => {
      try {
        setLoading(true);
        const startDate = values.date_range ? values.date_range[0].format('YYYY-MM-DD') : (values.start_date || '2026-01-01');
        const endDate = values.date_range ? values.date_range[1].format('YYYY-MM-DD') : (values.end_date || '2026-12-31');

        const payload = {
          contract_no: values.contract_no,
          party_type: values.party_type,
          partner_id: values.partner_id,
          start_date: startDate,
          end_date: endDate,
          free_waiting_mins: values.free_waiting_mins,
          waiting_fee_per_hour: values.waiting_fee_per_hour,
          liability_cap_vnd: values.liability_cap_vnd,
          status: values.status || 'ACTIVE'
        };

        await dispatcherApi.createContract(payload);
        message.success(`Đã lưu hợp đồng [${values.contract_no || 'mới'}] vào cơ sở dữ liệu!`);
        setIsModalOpen(false);
        form.resetFields();
        await fetchContracts();
      } catch (err) {
        console.error('Submit contract error:', err);
        message.error(err.message || 'Lỗi khi lưu hợp đồng');
        setLoading(false);
      }
    });
  };

  const filteredData = contracts.filter(item => {
    const matchSearch = searchText === '' ||
      (item.contract_no && item.contract_no.toLowerCase().includes(searchText.toLowerCase())) ||
      (item.partner_name && item.partner_name.toLowerCase().includes(searchText.toLowerCase())) ||
      (item.tax_code && item.tax_code.includes(searchText));
    const matchParty = filterPartyType === 'ALL' || item.party_type === filterPartyType;
    const matchStatus = filterStatus === 'ALL' || item.status === filterStatus;
    return matchSearch && matchParty && matchStatus;
  });

  const columns = [
    {
      title: 'Số hiệu & Đối tác hợp đồng',
      key: 'contract_partner',
      width: '28%',
      render: (_, r) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 text-xs hover:text-[#7367f0] cursor-pointer font-mono" onClick={() => handleOpenEdit(r)}>
              {r.contract_no}
            </span>
            <Tag color={r.party_type === 'CUSTOMER' ? 'blue' : 'orange'} className="text-[10px] m-0 px-1.5 py-0.2">
              {r.party_type === 'CUSTOMER' ? 'Khách hàng' : 'Nhà xe phụ 3PL'}
            </Tag>
          </div>
          <div className="text-xs font-medium text-gray-700 mt-1 flex items-center gap-1">
            <Building size={12} className="text-gray-400" />
            <span>{r.partner_name}</span>
          </div>
          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
            MST: {r.tax_code}
          </div>
        </div>
      )
    },
    {
      title: 'Thời hạn hiệu lực',
      key: 'dates',
      width: '18%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="text-gray-600 font-mono">Từ: {r.start_date}</div>
          <div className="text-gray-600 font-mono">Đến: {r.end_date}</div>
          <Tag color="green" className="mt-1 text-[10px] m-0 px-1.5 py-0.2">Đang hiệu lực</Tag>
        </div>
      )
    },
    {
      title: 'Quy định Thời gian chờ',
      key: 'waiting',
      width: '20%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="flex items-center gap-1 text-gray-700 font-medium">
            <Clock size={12} className="text-indigo-500" />
            <span>Chờ miễn phí: <b>{r.free_waiting_mins} phút</b></span>
          </div>
          <div className="text-gray-500 text-[11px] mt-0.5">
            Quá giờ: <b>{(r.waiting_fee_per_hour || 150000).toLocaleString()} đ/giờ</b>
          </div>
        </div>
      )
    },
    {
      title: 'Hạn mức Bồi thường / Trách nhiệm',
      key: 'liability',
      width: '22%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="flex items-center gap-1 font-semibold text-emerald-600">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>Tối đa: {(r.liability_cap_vnd || 200000000).toLocaleString()} đ</span>
          </div>
          <div className="text-gray-400 text-[11px] mt-0.5 truncate max-w-[220px]" title={r.liability_cap_type}>
            {r.liability_cap_type || '100% giá trị khai báo có seal nguyên chì'}
          </div>
        </div>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: '12%',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xuất file / In Hợp đồng">
            <Button size="small" type="text" icon={<Download size={14} className="text-emerald-600" />} onClick={() => handleExportContract(record)} />
          </Tooltip>
          <Tooltip title="Xem chi tiết & Điều khoản">
            <Button size="small" type="text" icon={<Edit3 size={14} className="text-[#7367f0]" />} onClick={() => handleOpenEdit(record)} />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ScrollText size={22} className="text-[#7367f0]" />
            Hợp đồng Vận tải & SLA Khách hàng
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Quản lý hợp đồng vận chuyển, thời gian chờ miễn phí, quy định hủy chuyến và hạn mức bồi thường bảo hiểm.
          </p>
        </div>
        <Space>
          <Button 
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />} 
            onClick={fetchContracts}
            loading={loading}
            className="rounded-lg text-xs"
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleOpenCreate}
            className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold text-xs h-9 shadow-sm"
          >
            Tạo hợp đồng mới
          </Button>
        </Space>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-xs border-gray-100 rounded-xl" styles={{ body: { padding: '16px' } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={12}>
            <Input
              placeholder="Tìm theo số hiệu HĐ, tên đối tác, mã số thuế..."
              prefix={<Search size={15} className="text-gray-400" />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="rounded-lg text-xs"
            />
          </Col>
          <Col xs={12} sm={6} md={6}>
            <Select
              className="w-full text-xs"
              value={filterPartyType}
              onChange={setFilterPartyType}
            >
              <Option value="ALL">Tất cả đối tác</Option>
              <Option value="CUSTOMER">Khách hàng thuê vận tải</Option>
              <Option value="VENDOR">Nhà xe phụ (3PL Vendor)</Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={6}>
            <Select
              className="w-full text-xs"
              value={filterStatus}
              onChange={setFilterStatus}
            >
              <Option value="ALL">Tất cả trạng thái</Option>
              <Option value="ACTIVE">Đang hiệu lực</Option>
              <Option value="EXPIRED">Đã hết hạn</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card className="shadow-xs border-gray-100 rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8, showTotal: (total) => `Tổng số ${total} hợp đồng` }}
          size="middle"
        />
      </Card>

      {/* Modal Tạo / Chỉnh sửa Hợp đồng */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-lg">
              <ScrollText size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">
                {editingContract ? `Chi tiết HĐ: ${editingContract.contract_no}` : 'Soạn thảo Hợp đồng Vận tải Mới'}
              </h3>
              <p className="text-xs text-gray-500 font-normal">Thiết lập điều khoản SLA, thời gian chờ bốc dỡ và hạn mức trách nhiệm</p>
            </div>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText={editingContract ? 'Lưu thay đổi' : 'Ký & Lưu Hợp đồng'}
        cancelText="Hủy"
        width={750}
        okButtonProps={{ className: 'bg-[#7367f0] hover:bg-[#5e50ee]', loading }}
      >
        <Form form={form} layout="vertical" className="pt-3">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contract_no" label={<span className="text-xs font-bold text-gray-700">Số hiệu hợp đồng</span>} rules={[{ required: true, message: 'Nhập số hiệu HĐ' }]}>
                <Input placeholder="Ví dụ: NEX/2026/HDVT-ADTEK-01" className="text-xs font-mono" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="party_type" label={<span className="text-xs font-bold text-gray-700">Loại đối tác</span>} rules={[{ required: true }]}>
                <Select className="text-xs">
                  <Option value="CUSTOMER">Khách hàng gửi hàng</Option>
                  <Option value="VENDOR">Nhà xe đối tác (3PL Vendor)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="partner_id" label={<span className="text-xs font-bold text-gray-700">Doanh nghiệp ký kết</span>} rules={[{ required: true, message: 'Chọn doanh nghiệp' }]}>
                <Select placeholder="Chọn doanh nghiệp từ cơ sở dữ liệu" className="text-xs">
                  {customers.map(c => (
                    <Option key={c.id} value={c.id}>{c.company_name} (MST: {c.tax_code})</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="date_range" label={<span className="text-xs font-bold text-gray-700">Thời hạn hợp đồng</span>} rules={[{ required: true, message: 'Chọn thời hạn' }]}>
                <RangePicker className="w-full text-xs" format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span className="text-xs font-bold text-gray-700">Thời gian chờ bốc dỡ miễn phí</span>}>
                <Space.Compact className="w-full">
                  <Form.Item name="free_waiting_mins" noStyle rules={[{ required: true, message: 'Nhập số phút' }]}>
                    <InputNumber className="w-full text-xs" min={0} max={240} step={15} />
                  </Form.Item>
                  <Button disabled className="!bg-gray-50 !text-gray-500 !border-[#d9d9d9] text-xs cursor-default pointer-events-none">
                    phút
                  </Button>
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span className="text-xs font-bold text-gray-700">Đơn giá phạt chờ quá giờ</span>}>
                <Space.Compact className="w-full">
                  <Form.Item name="waiting_fee_per_hour" noStyle rules={[{ required: true, message: 'Nhập đơn giá' }]}>
                    <InputNumber 
                      className="w-full text-xs" 
                      step={50000} 
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                  <Button disabled className="!bg-gray-50 !text-gray-500 !border-[#d9d9d9] text-xs cursor-default pointer-events-none">
                    VNĐ / giờ
                  </Button>
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="cancellation_tiers" label={<span className="text-xs font-bold text-gray-700">Quy định mức phạt hủy chuyến (Cancellation Tiers)</span>}>
            <Input.TextArea rows={2} placeholder="Ví dụ: Hủy trước 4h: Phạt 30% cước | Sau khi điều xe: Phạt 70% cước" className="text-xs" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span className="text-xs font-bold text-gray-700">Hạn mức bồi thường tối đa</span>}>
                <Space.Compact className="w-full">
                  <Form.Item name="liability_cap_vnd" noStyle rules={[{ required: true, message: 'Nhập hạn mức bồi thường' }]}>
                    <InputNumber 
                      className="w-full text-xs font-bold text-emerald-600" 
                      step={50000000} 
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                  <Button disabled className="!bg-gray-50 !text-gray-500 !border-[#d9d9d9] text-xs cursor-default pointer-events-none">
                    VNĐ
                  </Button>
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label={<span className="text-xs font-bold text-gray-700">Trạng thái hợp đồng</span>}>
                <Select className="text-xs">
                  <Option value="ACTIVE">Đang hiệu lực (Active)</Option>
                  <Option value="EXPIRED">Đã hết hạn</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal Xuất Hợp đồng PDF */}
      <Modal
        title="Bản xem trước & In Hợp đồng Vận tải"
        open={!!exportModalContract}
        onCancel={() => setExportModalContract(null)}
        footer={[
          <Button key="close" onClick={() => setExportModalContract(null)}>Đóng</Button>,
          <Button key="print" type="primary" icon={<Download size={14} />} onClick={() => { message.success('Đã tải xuống bản PDF hợp đồng ký kết!'); setExportModalContract(null); }} className="bg-[#7367f0]">
            Tải PDF có dấu mộc điện tử
          </Button>
        ]}
        width={700}
      >
        {exportModalContract && (
          <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-4 font-serif">
            <div className="text-center pb-3 border-b border-gray-300">
              <h2 className="text-base font-bold uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h2>
              <p className="italic text-gray-600">Độc lập - Tự do - Hạnh phúc</p>
              <h3 className="text-sm font-bold uppercase mt-3">HỢP ĐỒNG NGUYÊN TẮC DỊCH VỤ VẬN TẢI HÀNG HÓA</h3>
              <p className="font-mono text-gray-500">Số: {exportModalContract.contract_no}</p>
            </div>

            <div className="space-y-1">
              <p><b>BÊN A (ĐƠN VỊ VẬN CHUYỂN):</b> CÔNG TY CỔ PHẦN LOGISTICS THÔNG MINH NEXLOG</p>
              <p><b>BÊN B (ĐỐI TÁC):</b> {exportModalContract.partner_name}</p>
              <p><b>Mã số thuế Bên B:</b> {exportModalContract.tax_code}</p>
            </div>

            <div className="space-y-1 bg-white p-3 border border-gray-200 rounded">
              <p className="font-bold text-gray-800">ĐIỀU KHOẢN VẬN HÀNH & CAM KẾT SLA:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Thời gian bốc dỡ và kiểm tra chứng từ miễn phí: <b>{exportModalContract.free_waiting_mins} phút</b>.</li>
                <li>Phí phát sinh thời gian chờ quá hạn: <b>{(exportModalContract.waiting_fee_per_hour || 150000).toLocaleString()} VNĐ/giờ</b>.</li>
                <li>Hạn mức bảo hiểm trách nhiệm bồi thường tối đa: <b>{(exportModalContract.liability_cap_vnd || 200000000).toLocaleString()} VNĐ</b>.</li>
                <li>Thời hạn hợp đồng có hiệu lực từ: <b>{exportModalContract.start_date}</b> đến <b>{exportModalContract.end_date}</b>.</li>
              </ul>
            </div>

            <div className="flex justify-between pt-4">
              <div className="text-center w-40">
                <p className="font-bold">ĐẠI DIỆN BÊN A</p>
                <div className="h-14 flex items-center justify-center text-emerald-600 font-mono text-[10px] border border-dashed border-emerald-400 rounded bg-emerald-50 my-1">
                  [Đã ký số điện tử NEXLOG]
                </div>
                <p className="font-medium text-gray-700">{exportModalContract.signed_by}</p>
              </div>
              <div className="text-center w-40">
                <p className="font-bold">ĐẠI DIỆN BÊN B</p>
                <div className="h-14 flex items-center justify-center text-blue-600 font-mono text-[10px] border border-dashed border-blue-400 rounded bg-blue-50 my-1">
                  [Đã ký nhận số điện tử]
                </div>
                <p className="font-medium text-gray-700">Giám đốc Chuỗi cung ứng</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
