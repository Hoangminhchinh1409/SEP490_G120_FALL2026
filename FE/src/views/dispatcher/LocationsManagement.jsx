"use client";
import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Input, Modal, Form, Select, InputNumber, Row, Col, Space, Card, message, Popconfirm, Tooltip } from 'antd';
import { MapPin, Plus, Search, Edit3, Trash2, Phone, Clock, Shield, Building2, RefreshCw } from 'lucide-react';
import { dispatcherApi } from '../../api/dispatcherApi';

const { Option } = Select;

const locationTypeConfig = {
  'KHO_HANG_KHONG': { label: 'Kho Hàng không', color: 'blue' },
  'WAREHOUSE': { label: 'Kho Hàng không / Kho bãi', color: 'blue' },
  'NHA_MAY': { label: 'Nhà máy sản xuất', color: 'purple' },
  'KHO_NGOAI_QUAN': { label: 'Kho Ngoại quan', color: 'orange' },
  'DIEM_GIAO': { label: 'Điểm giao nhận', color: 'green' },
  'CUSTOMER_SITE': { label: 'Điểm khách hàng', color: 'green' },
  'CANG_BIEN': { label: 'Cảng biển / Cửa khẩu', color: 'cyan' },
  'CUSTOMS_CHECKPOINT': { label: 'Cảng biển / Hải quan', color: 'cyan' }
};

export default function LocationsManagement() {
  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterProvince, setFilterProvince] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [form] = Form.useForm();

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const [locsData, custsData] = await Promise.all([
        dispatcherApi.getLocations(),
        dispatcherApi.getCustomers()
      ]);
      setLocations(locsData || []);
      setCustomers(custsData || []);
    } catch (err) {
      console.error('fetchLocations error:', err);
      message.error('Không thể kết nối đến máy chủ để tải danh sách địa điểm');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadInitialLocations = async () => {
      try {
        const [locsData, custsData] = await Promise.all([
          dispatcherApi.getLocations(),
          dispatcherApi.getCustomers()
        ]);
        if (active) {
          setLocations(locsData || []);
          setCustomers(custsData || []);
        }
      } catch (err) {
        if (active) {
          console.error('fetchLocations error:', err);
          message.error('Không thể kết nối đến máy chủ để tải danh sách địa điểm');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInitialLocations();

    return () => {
      active = false;
    };
  }, []);

  const handleOpenCreate = () => {
    setEditingLocation(null);
    setIsModalOpen(true);
    setTimeout(() => {
      form.resetFields();
      form.setFieldsValue({
        type: 'DIEM_GIAO',
        province: 'Hà Nội',
        geofence_radius_m: 150,
        receiving_hours: '08:00 - 17:30 (T2 - T7)'
      });
    }, 0);
  };

  const handleOpenEdit = (record) => {
    setEditingLocation(record);
    setIsModalOpen(true);
    setTimeout(() => {
      form.setFieldsValue({
        ...record,
        customer_id: record.customer_id
      });
    }, 0);
  };

  const handleDelete = async (record) => {
    try {
      setLoading(true);
      await dispatcherApi.deleteLocation(record.raw_id || record.id);
      message.success(`Đã xóa địa điểm [${record.name}] khỏi cơ sở dữ liệu!`);
      await fetchLocations();
    } catch (err) {
      console.error('Delete location error:', err);
      message.error(err.message || 'Lỗi khi xóa địa điểm trên cơ sở dữ liệu');
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    form.validateFields().then(async (values) => {
      try {
        setLoading(true);
        if (editingLocation) {
          await dispatcherApi.updateLocation(editingLocation.raw_id || editingLocation.id, values);
          message.success(`Cập nhật địa điểm [${values.name}] thành công!`);
        } else {
          await dispatcherApi.createLocation(values);
          message.success(`Đã lưu địa điểm mới [${values.name}] vào cơ sở dữ liệu!`);
        }
        setIsModalOpen(false);
        form.resetFields();
        await fetchLocations();
      } catch (err) {
        console.error('Submit location error:', err);
        message.error(err.message || 'Lỗi khi lưu địa điểm');
        setLoading(false);
      }
    });
  };

  const filteredData = locations.filter(item => {
    const matchSearch = searchText === '' ||
      (item.name && item.name.toLowerCase().includes(searchText.toLowerCase())) ||
      (item.address && item.address.toLowerCase().includes(searchText.toLowerCase())) ||
      (item.customer && item.customer.toLowerCase().includes(searchText.toLowerCase()));
    const matchType = filterType === 'ALL' || item.type === filterType;
    const matchProvince = filterProvince === 'ALL' || item.province === filterProvince;
    return matchSearch && matchType && matchProvince;
  });

  const columns = [
    {
      title: 'Tên địa điểm',
      dataIndex: 'name',
      key: 'name',
      width: '24%',
      render: (text, r) => (
        <div>
          <span className="font-bold text-gray-800 text-xs hover:text-[#7367f0] cursor-pointer" onClick={() => handleOpenEdit(r)}>
            {text}
          </span>
          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
            Mã: {r.id}
          </div>
        </div>
      )
    },
    {
      title: 'Loại địa điểm',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      render: (type) => (
        <Tag color={locationTypeConfig[type]?.color || 'default'} className="text-[11px] font-medium m-0 px-2 py-0.5">
          {locationTypeConfig[type]?.label || type}
        </Tag>
      )
    },
    {
      title: 'Địa chỉ',
      dataIndex: 'address',
      key: 'address',
      width: '28%',
      render: (text) => (
        <div className="text-xs text-gray-700 flex items-start gap-1.5">
          <MapPin size={13} className="text-[#7367f0] mt-0.5 shrink-0" />
          <span>{text}</span>
        </div>
      )
    },
    {
      title: 'Chủ sở hữu',
      key: 'owner',
      width: '18%',
      render: (_, r) => (
        <div className="text-xs">
          {r.customer_id ? (
            <div className="flex items-center gap-1.5 text-gray-700 font-medium">
              <Building2 size={13} className="text-indigo-500 shrink-0" />
              <span>{r.customer}</span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px]">
              Hệ thống ALS / Nội bộ
            </span>
          )}
        </div>
      )
    },
    {
      title: 'Tọa độ',
      key: 'coords',
      width: '15%',
      render: (_, r) => (
        <div className="text-xs font-mono text-gray-600 bg-gray-50/80 px-2 py-1 rounded border border-gray-100 inline-block">
          {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}
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
          <Popconfirm title="Xóa địa điểm này khỏi cơ sở dữ liệu?" onConfirm={() => handleDelete(record)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
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
        </div>
        <Space>
          <Button 
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />} 
            onClick={fetchLocations}
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
            Thêm địa điểm mới
          </Button>
        </Space>
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
          loading={loading}
          pagination={{ pageSize: 8, showTotal: (total) => `Tổng số ${total} địa điểm` }}
          size="middle"
        />
      </Card>

      {/* Modal Thêm / Chỉnh sửa Địa điểm */}
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
              <p className="text-xs text-gray-500 font-normal">Thiết lập thông tin vị trí, giờ tiếp nhận và bán kính Geofence lưu vào cơ sở dữ liệu</p>
            </div>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText={editingLocation ? 'Lưu thay đổi' : 'Thêm địa điểm'}
        cancelText="Hủy"
        width={750}
        okButtonProps={{ className: 'bg-[#7367f0] hover:bg-[#5e50ee]', loading }}
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
              <Form.Item name="customer_id" label={<span className="text-xs font-bold text-gray-700">Khách hàng / Doanh nghiệp</span>}>
                <Select placeholder="Chọn doanh nghiệp liên kết" allowClear className="text-xs">
                  {customers.map(c => (
                    <Option key={c.id} value={c.id}>{c.company_name}</Option>
                  ))}
                </Select>
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
              <Form.Item label={<span className="text-xs font-bold text-gray-700">Bán kính Geofence (mét)</span>}>
                <Space.Compact className="w-full">
                  <Form.Item name="geofence_radius_m" noStyle rules={[{ required: true, message: 'Nhập bán kính' }]}>
                    <InputNumber className="w-full text-xs font-mono" min={50} max={1000} step={50} placeholder="150" />
                  </Form.Item>
                  <Button disabled className="!bg-gray-50 !text-gray-500 !border-[#d9d9d9] text-xs font-mono cursor-default pointer-events-none">
                    m
                  </Button>
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="receiving_hours" label={<span className="text-xs font-bold text-gray-700">Khung giờ tiếp nhận hàng</span>}>
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
