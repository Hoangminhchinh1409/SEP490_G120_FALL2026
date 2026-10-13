"use client";
import { useState } from 'react';
import { Table, Tag, Button, Input, Modal, Form, Select, InputNumber, Row, Col, Space, Card, message, Popconfirm, Tooltip } from 'antd';
import { MapPin, Plus, Search, Edit3, Trash2, Phone, Clock, Shield, Navigation, Building2 } from 'lucide-react';

const { Option } = Select;

// Dữ liệu mẫu các địa điểm thực tế trong luồng vận hành logistics ALS / Bắc Ninh / Hải Phòng
const initialLocations = [
  {
    id: 'LOC-001',
    name: 'Kho ALS Cảng HKQT Nội Bài',
    type: 'KHO_HANG_KHONG',
    customer: 'Công ty Cổ phần ALS Logistics',
    address: 'Khu thương mại dịch vụ số 1, Cảng HKQT Nội Bài, Sóc Sơn, Hà Nội',
    province: 'Hà Nội',
    lat: 21.2187,
    lng: 105.8042,
    receiving_hours: '24/7 (Cả tuần)',
    contact_name: 'Nguyễn Văn Hùng',
    contact_phone: '0912.888.999',
    geofence_radius_m: 200,
    active: true
  },
  {
    id: 'LOC-002',
    name: 'Nhà máy ADTEK - KCN Tiên Sơn',
    type: 'NHA_MAY',
    customer: 'Công ty TNHH ADTEK Việt Nam',
    address: 'Lô B12, Đường TS5, KCN Tiên Sơn, Đồng Nguyên, Từ Sơn, Bắc Ninh',
    province: 'Bắc Ninh',
    lat: 21.1215,
    lng: 105.9754,
    receiving_hours: '08:00 - 17:30 (T2 - T7)',
    contact_name: 'Trần Thị Thu Trang',
    contact_phone: '0988.123.456',
    geofence_radius_m: 150,
    active: true
  },
  {
    id: 'LOC-003',
    name: 'Kho Ngoại quan Yên Phong',
    type: 'KHO_NGOAI_QUAN',
    customer: 'ALS Bắc Ninh Hub',
    address: 'Khu công nghiệp Yên Phong 1, Yên Trung, Yên Phong, Bắc Ninh',
    province: 'Bắc Ninh',
    lat: 21.1963,
    lng: 105.9525,
    receiving_hours: '07:30 - 21:00',
    contact_name: 'Lê Minh Tuấn',
    contact_phone: '0904.555.666',
    geofence_radius_m: 250,
    active: true
  },
  {
    id: 'LOC-004',
    name: 'Cụm Công nghiệp Lai Xá (Lô 2)',
    type: 'DIEM_GIAO',
    customer: 'Công ty Thiết bị Âm thanh Ánh sáng SLVN',
    address: 'Lô 2, Cụm Công nghiệp Lai Xá, Kim Chung, Hoài Đức, Hà Nội',
    province: 'Hà Nội',
    lat: 21.0621,
    lng: 105.7289,
    receiving_hours: '08:00 - 18:00',
    contact_name: 'Hồ Chí Đạt',
    contact_phone: '0977.888.111',
    geofence_radius_m: 100,
    active: true
  },
  {
    id: 'LOC-005',
    name: 'Cảng Tân Vũ - Hải Phòng',
    type: 'CANG_BIEN',
    customer: 'Cảng Hải Phòng Terminal',
    address: 'Đường Bến Cảng, Bán đảo Đình Vũ, Đông Hải 2, Hải An, Hải Phòng',
    province: 'Hải Phòng',
    lat: 20.8524,
    lng: 106.7588,
    receiving_hours: '24/7 (Cả tuần)',
    contact_name: 'Phạm Quang Minh',
    contact_phone: '0936.444.888',
    geofence_radius_m: 300,
    active: true
  }
];

const locationTypeConfig = {
  'KHO_HANG_KHONG': { label: 'Kho Hàng không', color: 'blue' },
  'NHA_MAY': { label: 'Nhà máy sản xuất', color: 'purple' },
  'KHO_NGOAI_QUAN': { label: 'Kho Ngoại quan', color: 'orange' },
  'DIEM_GIAO': { label: 'Điểm giao nhận', color: 'green' },
  'CANG_BIEN': { label: 'Cảng biển / Cửa khẩu', color: 'cyan' }
};

export default function LocationsManagement() {
  const [locations, setLocations] = useState(initialLocations);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterProvince, setFilterProvince] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [form] = Form.useForm();

  const handleOpenCreate = () => {
    setEditingLocation(null);
    form.resetFields();
    form.setFieldsValue({
      geofence_radius_m: 150,
      active: true,
      receiving_hours: '08:00 - 17:30 (T2 - T7)'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingLocation(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setLocations(prev => prev.filter(item => item.id !== id));
    message.success('Đã xóa địa điểm thành công!');
  };

  const handleSubmit = () => {
    form.validateFields().then(values => {
      if (editingLocation) {
        setLocations(prev => prev.map(item => item.id === editingLocation.id ? { ...item, ...values } : item));
        message.success(`Cập nhật địa điểm [${values.name}] thành công!`);
      } else {
        const newId = `LOC-${String(locations.length + 1).padStart(3, '0')}`;
        const newLocation = { id: newId, ...values };
        setLocations(prev => [newLocation, ...prev]);
        message.success(`Đã thêm địa điểm mới [${values.name}]!`);
      }
      setIsModalOpen(false);
      form.resetFields();
    });
  };

  const filteredData = locations.filter(item => {
    const matchSearch = searchText === '' ||
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.address.toLowerCase().includes(searchText.toLowerCase()) ||
      item.customer.toLowerCase().includes(searchText.toLowerCase());
    const matchType = filterType === 'ALL' || item.type === filterType;
    const matchProvince = filterProvince === 'ALL' || item.province === filterProvince;
    return matchSearch && matchType && matchProvince;
  });

  const columns = [
    {
      title: 'Mã & Tên địa điểm',
      key: 'name',
      width: '26%',
      render: (_, r) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 text-xs hover:text-[#7367f0] cursor-pointer" onClick={() => handleOpenEdit(r)}>
              {r.name}
            </span>
            <Tag color={locationTypeConfig[r.type]?.color || 'default'} className="text-[10px] m-0 px-1.5 py-0.2">
              {locationTypeConfig[r.type]?.label || r.type}
            </Tag>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 font-mono">
            <Building2 size={11} className="text-gray-400" />
            <span>{r.customer} ({r.id})</span>
          </div>
        </div>
      )
    },
    {
      title: 'Địa chỉ cụ thể',
      dataIndex: 'address',
      key: 'address',
      width: '28%',
      render: (text, r) => (
        <div>
          <div className="text-xs text-gray-700 flex items-start gap-1">
            <MapPin size={13} className="text-[#7367f0] mt-0.5 shrink-0" />
            <span>{text}</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1 pl-4 font-mono">
            Tọa độ: {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}
          </div>
        </div>
      )
    },
    {
      title: 'Khung giờ tiếp nhận',
      dataIndex: 'receiving_hours',
      key: 'receiving_hours',
      width: '16%',
      render: text => (
        <div className="text-xs text-gray-600 flex items-center gap-1">
          <Clock size={13} className="text-amber-500 shrink-0" />
          <span>{text}</span>
        </div>
      )
    },
    {
      title: 'Liên hệ tại kho',
      key: 'contact',
      width: '16%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="font-medium text-gray-700">{r.contact_name}</div>
          <div className="text-gray-400 text-[11px] font-mono flex items-center gap-1 mt-0.5">
            <Phone size={11} className="text-emerald-500" />
            <span>{r.contact_phone}</span>
          </div>
        </div>
      )
    },
    {
      title: 'Bán kính Geofence',
      dataIndex: 'geofence_radius_m',
      key: 'geofence',
      width: '14%',
      render: val => (
        <div className="flex items-center gap-1">
          <Shield size={13} className="text-indigo-500" />
          <span className="font-semibold text-xs text-gray-700 font-mono">{val} m</span>
        </div>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: '10%',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa">
            <Button size="small" type="text" icon={<Edit3 size={15} className="text-[#7367f0]" />} onClick={() => handleOpenEdit(record)} />
          </Tooltip>
          <Popconfirm title="Xóa địa điểm này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
            <Button size="small" type="text" danger icon={<Trash2 size={15} />} />
          </Popconfirm>
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
            <MapPin size={22} className="text-[#7367f0]" />
            Quản lý Điểm giao nhận
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Danh mục kho bãi, điểm tiếp nhận hàng hóa, tọa độ GPS và thiết lập bán kính nhận diện tự động.
          </p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={handleOpenCreate}
          className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold text-xs h-9 shadow-sm"
        >
          Thêm địa điểm mới
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-xs border-gray-100 rounded-xl" styles={{ body: { padding: '16px' } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={10} md={10}>
            <Input
              placeholder="Tìm theo tên điểm, địa chỉ, khách hàng..."
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
              value={filterType}
              onChange={setFilterType}
            >
              <Option value="ALL">Tất cả loại địa điểm</Option>
              <Option value="KHO_HANG_KHONG">Kho Hàng không</Option>
              <Option value="NHA_MAY">Nhà máy sản xuất</Option>
              <Option value="KHO_NGOAI_QUAN">Kho Ngoại quan</Option>
              <Option value="DIEM_GIAO">Điểm giao nhận</Option>
              <Option value="CANG_BIEN">Cảng biển / Cửa khẩu</Option>
            </Select>
          </Col>
          <Col xs={12} sm={7} md={7}>
            <Select
              className="w-full text-xs"
              value={filterProvince}
              onChange={setFilterProvince}
            >
              <Option value="ALL">Tất cả tỉnh / thành</Option>
              <Option value="Hà Nội">Hà Nội</Option>
              <Option value="Bắc Ninh">Bắc Ninh</Option>
              <Option value="Hải Phòng">Hải Phòng</Option>
              <Option value="Vĩnh Phúc">Vĩnh Phúc</Option>
              <Option value="Thái Nguyên">Thái Nguyên</Option>
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
          pagination={{ pageSize: 8, showTotal: (total) => `Tổng số ${total} địa điểm` }}
          size="middle"
        />
      </Card>

      {/* Modal Thêm / Chỉnh sửa Địa điểm (Screen 38) */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-lg">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">
                {editingLocation ? `Cập nhật địa điểm: ${editingLocation.name}` : 'Thêm địa điểm tiếp nhận mới'}
              </h3>
              <p className="text-xs text-gray-500 font-normal">Thiết lập thông tin vị trí, giờ tiếp nhận và bán kính Geofence</p>
            </div>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText={editingLocation ? 'Lưu thay đổi' : 'Thêm địa điểm'}
        cancelText="Hủy"
        width={750}
        okButtonProps={{ className: 'bg-[#7367f0] hover:bg-[#5e50ee]' }}
      >
        <Form form={form} layout="vertical" className="pt-3">
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="name" label={<span className="text-xs font-bold text-gray-700">Tên địa điểm / Kho bãi</span>} rules={[{ required: true, message: 'Vui lòng nhập tên địa điểm' }]}>
                <Input placeholder="Ví dụ: Kho ALS Nội Bài, Nhà máy ADTEK..." className="text-xs" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="type" label={<span className="text-xs font-bold text-gray-700">Loại địa điểm</span>} rules={[{ required: true, message: 'Vui lòng chọn loại địa điểm' }]}>
                <Select className="text-xs">
                  <Option value="KHO_HANG_KHONG">Kho Hàng không</Option>
                  <Option value="NHA_MAY">Nhà máy sản xuất</Option>
                  <Option value="KHO_NGOAI_QUAN">Kho Ngoại quan</Option>
                  <Option value="DIEM_GIAO">Điểm giao nhận</Option>
                  <Option value="CANG_BIEN">Cảng biển / Cửa khẩu</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="customer" label={<span className="text-xs font-bold text-gray-700">Khách hàng sở hữu / Quản lý</span>} rules={[{ required: true, message: 'Vui lòng nhập đơn vị quản lý' }]}>
                <Input placeholder="Tên công ty hoặc kho nội bộ..." className="text-xs" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="province" label={<span className="text-xs font-bold text-gray-700">Tỉnh / Thành phố</span>} rules={[{ required: true, message: 'Vui lòng chọn tỉnh/thành' }]}>
                <Select className="text-xs">
                  <Option value="Hà Nội">Hà Nội</Option>
                  <Option value="Bắc Ninh">Bắc Ninh</Option>
                  <Option value="Hải Phòng">Hải Phòng</Option>
                  <Option value="Vĩnh Phúc">Vĩnh Phúc</Option>
                  <Option value="Thái Nguyên">Thái Nguyên</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label={<span className="text-xs font-bold text-gray-700">Địa chỉ chi tiết</span>} rules={[{ required: true, message: 'Vui lòng nhập địa chỉ' }]}>
            <Input placeholder="Số nhà, đường, khu công nghiệp, phường/xã..." className="text-xs" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="lat" label={<span className="text-xs font-bold text-gray-700">Tọa độ Vĩ độ (Lat)</span>} rules={[{ required: true, message: 'Nhập Lat' }]}>
                <InputNumber className="w-full text-xs font-mono" step={0.0001} placeholder="21.0285" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="lng" label={<span className="text-xs font-bold text-gray-700">Tọa độ Kinh độ (Lng)</span>} rules={[{ required: true, message: 'Nhập Lng' }]}>
                <InputNumber className="w-full text-xs font-mono" step={0.0001} placeholder="105.8542" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="geofence_radius_m" label={<span className="text-xs font-bold text-gray-700">Bán kính Geofence (mét)</span>} rules={[{ required: true, message: 'Nhập bán kính' }]}>
                <InputNumber className="w-full text-xs font-mono" min={50} max={1000} step={50} placeholder="150" addonAfter="m" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="receiving_hours" label={<span className="text-xs font-bold text-gray-700">Khung giờ tiếp nhận hàng</span>} rules={[{ required: true, message: 'Nhập khung giờ tiếp nhận' }]}>
                <Input placeholder="08:00 - 17:30 (T2 - T7)" className="text-xs" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="contact_name" label={<span className="text-xs font-bold text-gray-700">Người liên hệ kho</span>}>
                <Input placeholder="Họ và tên..." className="text-xs" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="contact_phone" label={<span className="text-xs font-bold text-gray-700">SĐT người liên hệ</span>}>
                <Input placeholder="09xx..." className="text-xs font-mono" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
