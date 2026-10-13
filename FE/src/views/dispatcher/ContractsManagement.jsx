"use client";
import { useState } from 'react';
import { Table, Tag, Button, Input, Modal, Form, Select, InputNumber, Row, Col, Space, Card, message, DatePicker, Tooltip } from 'antd';
import { ScrollText, Plus, Search, Edit3, Download, FileCheck, Building, DollarSign, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

// Dữ liệu mẫu các hợp đồng vận tải thực tế theo quy chuẩn của Report 3
const initialContracts = [
  {
    id: 'HD-2026-ADTEK',
    contract_no: 'NEX/2026/HDVT-ADTEK-01',
    party_type: 'CUSTOMER',
    partner_name: 'Công ty TNHH ADTEK Việt Nam',
    tax_code: '2300998877',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    free_waiting_mins: 60,
    waiting_fee_per_hour: 150000,
    cancellation_tiers: 'Hủy trước 4h: Phạt 30% cước | Sau khi điều xe: Phạt 70% cước',
    liability_cap_vnd: 200000000,
    liability_cap_type: '100% giá trị khai báo có seal nguyên chì',
    status: 'ACTIVE',
    signed_by: 'Hoàng Minh Chính - GĐ Vận hành'
  },
  {
    id: 'HD-2026-SLVN',
    contract_no: 'NEX/2026/HDVT-SLVN-02',
    party_type: 'CUSTOMER',
    partner_name: 'Công ty Thiết bị Âm thanh Ánh sáng SLVN',
    tax_code: '0108992233',
    start_date: '2026-03-01',
    end_date: '2027-02-28',
    free_waiting_mins: 60,
    waiting_fee_per_hour: 200000,
    cancellation_tiers: 'Hủy trước 6h: Miễn phí | Hủy dưới 6h: Phạt 50% cước',
    liability_cap_vnd: 500000000,
    liability_cap_type: 'Tối đa 500,000,000 VNĐ / chuyến',
    status: 'ACTIVE',
    signed_by: 'Hoàng Minh Chính - GĐ Vận hành'
  },
  {
    id: 'HD-2026-ACHAU',
    contract_no: 'NEX/2026/HDVT-ACHAU-3PL',
    party_type: 'VENDOR',
    partner_name: 'Công ty Cổ phần Vận tải Á Châu (3PL Vendor)',
    tax_code: '0304556677',
    start_date: '2026-01-15',
    end_date: '2026-12-31',
    free_waiting_mins: 90,
    waiting_fee_per_hour: 120000,
    cancellation_tiers: 'Nhà xe hủy chuyến đền bù 50% giá trị hợp đồng thuê ngoài',
    liability_cap_vnd: 1000000000,
    liability_cap_type: 'Bảo hiểm hàng hóa 100% theo bill',
    status: 'ACTIVE',
    signed_by: 'Trần Quỳnh Chi - Điều phối trưởng'
  }
];

export default function ContractsManagement() {
  const [contracts, setContracts] = useState(initialContracts);
  const [searchText, setSearchText] = useState('');
  const [filterPartyType, setFilterPartyType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [exportModalContract, setExportModalContract] = useState(null);
  const [form] = Form.useForm();

  const handleOpenCreate = () => {
    setEditingContract(null);
    form.resetFields();
    form.setFieldsValue({
      party_type: 'CUSTOMER',
      free_waiting_mins: 60,
      waiting_fee_per_hour: 150000,
      cancellation_tiers: 'Hủy trước 4h: Phạt 30% | Sau khi điều xe: Phạt 70%',
      liability_cap_vnd: 200000000,
      status: 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingContract(record);
    form.setFieldsValue({
      ...record,
      date_range: [dayjs(record.start_date), dayjs(record.end_date)]
    });
    setIsModalOpen(true);
  };

  const handleExportContract = (record) => {
    setExportModalContract(record);
  };

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const formattedValues = {
        ...values,
        start_date: values.date_range ? values.date_range[0].format('YYYY-MM-DD') : values.start_date,
        end_date: values.date_range ? values.date_range[1].format('YYYY-MM-DD') : values.end_date
      };
      delete formattedValues.date_range;

      if (editingContract) {
        setContracts(prev => prev.map(item => item.id === editingContract.id ? { ...item, ...formattedValues } : item));
        message.success(`Đã cập nhật hợp đồng [${values.contract_no}]!`);
      } else {
        const newId = `HD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        setContracts(prev => [{ id: newId, ...formattedValues }, ...prev]);
        message.success(`Đã tạo hợp đồng mới [${values.contract_no}]!`);
      }
      setIsModalOpen(false);
      form.resetFields();
    });
  };

  const filteredData = contracts.filter(item => {
    const matchSearch = searchText === '' ||
      item.contract_no.toLowerCase().includes(searchText.toLowerCase()) ||
      item.partner_name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.tax_code.includes(searchText);
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
            Phạt quá giờ: <b className="text-amber-600 font-mono">{(r.waiting_fee_per_hour || 0).toLocaleString()} đ/h</b>
          </div>
        </div>
      )
    },
    {
      title: 'Nấc phạt hủy & Bồi thường',
      key: 'compensation',
      width: '24%',
      render: (_, r) => (
        <div className="text-xs space-y-1">
          <div className="text-gray-600 text-[11px]">
            <AlertTriangle size={11} className="text-amber-500 inline mr-1" />
            {r.cancellation_tiers}
          </div>
          <div className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
            <ShieldCheck size={12} className="text-emerald-600" />
            <span>Hạn mức: {(r.liability_cap_vnd || 0).toLocaleString()} đ</span>
          </div>
        </div>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: '10%',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xuất file cho kế toán">
            <Button
              size="small"
              icon={<Download size={14} className="text-emerald-600" />}
              onClick={() => handleExportContract(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              size="small"
              icon={<Edit3 size={14} className="text-[#7367f0]" />}
              onClick={() => handleOpenEdit(record)}
            />
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
            Quản lý Hợp đồng Vận tải
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Quản lý biểu cước, thời gian chờ bốc dỡ miễn phí, nấc phạt hủy đơn và hồ sơ đối soát kế toán.
          </p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={handleOpenCreate}
          className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold text-xs h-9 shadow-sm"
        >
          Tạo hợp đồng mới
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-xs border-gray-100 rounded-xl" styles={{ body: { padding: '16px' } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={10} md={10}>
            <Input
              placeholder="Tìm theo số hợp đồng, tên đối tác, MST..."
              prefix={<Search size={15} className="text-gray-400" />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="rounded-lg text-xs"
            />
          </Col>
          <Col xs={12} sm={7} md={7}>
            <Select
              className="w-full text-xs"
              value={filterPartyType}
              onChange={setFilterPartyType}
            >
              <Option value="ALL">Tất cả đối tác</Option>
              <Option value="CUSTOMER">Khách hàng thuê vận chuyển</Option>
              <Option value="VENDOR">Nhà xe đối tác (3PL Vendor)</Option>
            </Select>
          </Col>
          <Col xs={12} sm={7} md={7}>
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
          pagination={{ pageSize: 8, showTotal: (total) => `Tổng số ${total} hợp đồng` }}
          size="middle"
        />
      </Card>

      {/* Modal Tạo / Cập nhật Hợp đồng (Screen 31) */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-lg">
              <ScrollText size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">
                {editingContract ? `Cập nhật hợp đồng: ${editingContract.contract_no}` : 'Tạo hợp đồng vận tải mới'}
              </h3>
              <p className="text-xs text-gray-500 font-normal">Điều khoản cước, hạn mức chờ bốc dỡ và nấc phạt hủy đơn</p>
            </div>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText={editingContract ? 'Lưu thay đổi' : 'Tạo hợp đồng'}
        cancelText="Hủy"
        width={800}
        okButtonProps={{ className: 'bg-[#7367f0] hover:bg-[#5e50ee]' }}
      >
        <Form form={form} layout="vertical" className="pt-3">
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="contract_no" label={<span className="text-xs font-bold text-gray-700">Số hiệu hợp đồng</span>} rules={[{ required: true, message: 'Nhập số hợp đồng' }]}>
                <Input placeholder="Ví dụ: NEX/2026/HDVT-ADTEK-01" className="text-xs font-mono font-bold" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="party_type" label={<span className="text-xs font-bold text-gray-700">Loại đối tác</span>} rules={[{ required: true }]}>
                <Select className="text-xs">
                  <Option value="CUSTOMER">Khách hàng</Option>
                  <Option value="VENDOR">Nhà xe đối tác</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="partner_name" label={<span className="text-xs font-bold text-gray-700">Tên pháp nhân đối tác</span>} rules={[{ required: true, message: 'Nhập tên đối tác' }]}>
                <Input placeholder="Tên công ty khách hàng hoặc nhà xe..." className="text-xs" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="tax_code" label={<span className="text-xs font-bold text-gray-700">Mã số thuế</span>} rules={[{ required: true, message: 'Nhập MST' }]}>
                <Input placeholder="Mã số thuế đối tác..." className="text-xs font-mono" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date_range" label={<span className="text-xs font-bold text-gray-700">Thời hạn hiệu lực hợp đồng</span>}>
                <RangePicker className="w-full text-xs" format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="free_waiting_mins" label={<span className="text-xs font-bold text-gray-700">Giờ chờ miễn phí (phút)</span>} rules={[{ required: true }]}>
                <InputNumber className="w-full text-xs font-mono" min={0} step={15} addonAfter="phút" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="waiting_fee_per_hour" label={<span className="text-xs font-bold text-gray-700">Phạt quá giờ (đ/h)</span>} rules={[{ required: true }]}>
                <InputNumber className="w-full text-xs font-mono" min={0} step={50000} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={val => val.replace(/\$\s?|(,*)/g, '')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="cancellation_tiers" label={<span className="text-xs font-bold text-gray-700">Các nấc phạt hủy đơn theo giờ</span>} rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Hủy trước 4h phạt 30% | Sau khi điều xe phạt 70% | Hủy tại kho phạt 100%..." className="text-xs" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="liability_cap_vnd" label={<span className="text-xs font-bold text-gray-700">Hạn mức đền bù tối đa (VNĐ)</span>} rules={[{ required: true }]}>
                <InputNumber className="w-full text-xs font-mono font-bold text-emerald-700" step={10000000} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={val => val.replace(/\$\s?|(,*)/g, '')} addonAfter="VNĐ" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="liability_cap_type" label={<span className="text-xs font-bold text-gray-700">Quy tắc đền bù thiệt hại</span>}>
                <Input placeholder="Ví dụ: 100% giá trị hàng có niêm phong chì..." className="text-xs" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal Xuất file Hợp đồng cho Kế toán */}
      <Modal
        title={<span className="font-bold text-base text-gray-800 flex items-center gap-2"><FileCheck size={18} className="text-emerald-600" /> Xuất hồ sơ hợp đồng vận tải cho Kế toán</span>}
        open={!!exportModalContract}
        onCancel={() => setExportModalContract(null)}
        footer={[
          <Button key="close" onClick={() => setExportModalContract(null)}>Đóng</Button>,
          <Button
            key="export"
            type="primary"
            icon={<Download size={15} />}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              message.success(`Đã xuất trích lục hợp đồng [${exportModalContract?.contract_no}] thành công!`);
              setExportModalContract(null);
            }}
          >
            Tải về tệp trích lục hợp đồng (.PDF)
          </Button>
        ]}
        width={650}
      >
        {exportModalContract && (
          <div className="py-2 space-y-3 text-xs">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Số hợp đồng:</span>
                <span className="font-bold text-gray-800 font-mono">{exportModalContract.contract_no}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Đối tác ký kết:</span>
                <span className="font-bold text-gray-800">{exportModalContract.partner_name}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Mã số thuế:</span>
                <span className="font-mono text-gray-800">{exportModalContract.tax_code}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Định mức chờ bốc dỡ miễn phí:</span>
                <span className="font-semibold text-indigo-600">{exportModalContract.free_waiting_mins} phút (Quá giờ: {exportModalContract.waiting_fee_per_hour?.toLocaleString()} đ/h)</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Nấc phạt hủy chuyến:</span>
                <span className="text-amber-800 font-medium">{exportModalContract.cancellation_tiers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hạn mức bồi thường:</span>
                <span className="font-bold text-emerald-700 font-mono">{exportModalContract.liability_cap_vnd?.toLocaleString()} VNĐ</span>
              </div>
            </div>
            <p className="text-gray-400 text-[11px] italic">
              * Tệp trích lục chứa đầy đủ các điều khoản cước phí, phụ thu và cam kết trách nhiệm để phòng Kế toán đối chiếu thanh toán cước hàng tháng.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
