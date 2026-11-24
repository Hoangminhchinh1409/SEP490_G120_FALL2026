"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Input, Modal, Form, Select, InputNumber, Row, Col, Space, Card, message, Popconfirm, Tooltip } from 'antd';
import { MapPin, Plus, Search, Edit3, Trash2, Phone, User, RefreshCw, Lock } from 'lucide-react';
import { dispatcherApi } from '../../api/dispatcherApi';
import LocationSearchInput, { VIETNAM_PROVINCES_2026 } from '../../components/common/LocationSearchInput';

const { Option } = Select;

const normalizeShortProvince = (rawName = '') => {
  return String(rawName || '')
    .replace(/^(Thành phố|Tỉnh)\s+/i, '')
    .trim();
};

const PROVINCE_SHORT_OPTIONS = VIETNAM_PROVINCES_2026.map((p) => normalizeShortProvince(p.name));

export default function LocationsManagement() {
  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
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
        province: 'Hà Nội'
      });
    }, 0);
  };

  const handleOpenEdit = (record) => {
    setEditingLocation(record);
    setIsModalOpen(true);
    setTimeout(() => {
      form.setFieldsValue({
        name: record.name,
        province: normalizeShortProvince(record.province) || 'Hà Nội',
        contact_name: record.contact_name && record.contact_name !== 'Người liên hệ' ? record.contact_name : '',
        contact_phone: record.contact_phone && record.contact_phone !== '---' ? record.contact_phone : '',
        address: record.address,
        lat: record.lat != null ? Number(record.lat) : undefined,
        lng: record.lng != null ? Number(record.lng) : undefined,
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

  const provinceFilterOptions = useMemo(() => {
    const dynamicProvinces = new Set(PROVINCE_SHORT_OPTIONS);
    locations.forEach((loc) => {
      const clean = normalizeShortProvince(loc.province);
      if (clean) dynamicProvinces.add(clean);
    });
    return Array.from(dynamicProvinces);
  }, [locations]);

  const handleSubmit = () => {
    form.validateFields().then(async (values) => {
      if (values.lat == null || values.lng == null) {
        message.error('Vui lòng chọn địa chỉ từ gợi ý VietMap để tự động xác định tọa độ!');
        return;
      }
      const cleanPayload = {
        name: values.name,
        province: normalizeShortProvince(values.province) || 'Hà Nội',
        contact_name: values.contact_name?.trim() || null,
        contact_phone: values.contact_phone?.trim() || null,
        address: values.address,
        lat: Number(values.lat),
        lng: Number(values.lng)
      };
      try {
        setLoading(true);
        if (editingLocation) {
          await dispatcherApi.updateLocation(editingLocation.raw_id || editingLocation.id, cleanPayload);
          message.success(`Cập nhật địa điểm [${values.name}] thành công!`);
        } else {
          await dispatcherApi.createLocation(cleanPayload);
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
      (item.contact_name && item.contact_name.toLowerCase().includes(searchText.toLowerCase())) ||
      (item.contact_phone && item.contact_phone.includes(searchText));
    const matchProvince = filterProvince === 'ALL' || normalizeShortProvince(item.province) === normalizeShortProvince(filterProvince);
    return matchSearch && matchProvince;
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
      title: 'Địa chỉ',
      dataIndex: 'address',
      key: 'address',
      width: '32%',
      render: (text) => (
        <div className="text-xs text-gray-700 flex items-start gap-1.5">
          <MapPin size={13} className="text-[#7367f0] mt-0.5 shrink-0" />
          <span>{text}</span>
        </div>
      )
    },
    {
      title: 'Người liên hệ',
      key: 'contact_name',
      width: '16%',
      render: (_, r) => {
        const displayContact = (r.contact_name && r.contact_name !== 'Người liên hệ')
          ? r.contact_name
          : (r.customer || '—');
        return (
          <div className="text-xs flex items-center gap-1.5 text-gray-700 font-medium">
            <User size={13} className="text-indigo-500 shrink-0" />
            <span>{displayContact}</span>
          </div>
        );
      }
    },
    {
      title: 'Số điện thoại',
      key: 'contact_phone',
      width: '14%',
      render: (_, r) => (
        <div className="text-xs text-gray-700 flex items-center gap-1 font-mono">
          <Phone size={12} className="text-emerald-600 shrink-0" />
          <span>{r.contact_phone && r.contact_phone !== '---' ? r.contact_phone : '—'}</span>
        </div>
      )
    },
    {
      title: 'Tọa độ',
      key: 'coords',
      width: '14%',
      render: (_, r) => (
        <div className="text-xs font-mono text-gray-600 bg-gray-50/80 px-2 py-1 rounded border border-gray-100 inline-block">
          {r.lat != null ? Number(r.lat).toFixed(4) : '--'}, {r.lng != null ? Number(r.lng).toFixed(4) : '--'}
        </div>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: '8%',
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
          <Col xs={24} sm={16} md={16}>
            <Input
              placeholder="Tìm theo tên địa điểm, địa chỉ, người liên hệ, số điện thoại..."
              prefix={<Search size={15} className="text-gray-400" />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="rounded-lg text-xs"
            />
          </Col>
          <Col xs={24} sm={8} md={8}>
            <Select
              showSearch
              className="w-full text-xs"
              value={filterProvince}
              onChange={setFilterProvince}
              optionFilterProp="children"
            >
              <Option value="ALL">Tất cả tỉnh / thành</Option>
              {provinceFilterOptions.map((prov) => (
                <Option key={prov} value={prov}>{prov}</Option>
              ))}
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
                {editingLocation ? `Cập nhật địa điểm: ${editingLocation.name}` : 'Thêm địa điểm mới'}
              </h3>
              <p className="text-xs text-gray-500 font-normal">Thông tin địa chỉ, người liên hệ và tọa độ</p>
            </div>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSubmit}
        okText={editingLocation ? 'Lưu thay đổi' : 'Thêm địa điểm'}
        cancelText="Hủy"
        width={700}
        okButtonProps={{ className: 'bg-[#7367f0] hover:bg-[#5e50ee]', loading }}
      >
        <Form form={form} layout="vertical" className="pt-3">
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="name" label={<span className="text-xs font-bold text-gray-700">Tên địa điểm</span>} rules={[{ required: true, message: 'Vui lòng nhập tên địa điểm' }]}>
                <Input placeholder="Ví dụ: Kho ALS Nội Bài, Công ty TNHH ADTEK..." className="text-xs" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="province" label={<span className="text-xs font-bold text-gray-700">Tỉnh / Thành phố</span>} rules={[{ required: true, message: 'Vui lòng chọn tỉnh/thành' }]}>
                <Select showSearch className="text-xs" optionFilterProp="children">
                  {provinceFilterOptions.map((prov) => (
                    <Option key={prov} value={prov}>{prov}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_name" label={<span className="text-xs font-bold text-gray-700">Người liên hệ</span>}>
                <Input placeholder="Họ và tên người liên hệ (tùy chọn)..." className="text-xs" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contact_phone" label={<span className="text-xs font-bold text-gray-700">Số điện thoại</span>}>
                <Input placeholder="09xx... (tùy chọn)" className="text-xs font-mono" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label={<span className="text-xs font-bold text-gray-700">Tìm kiếm &amp; Chọn địa chỉ (VietMap v4)</span>}
            rules={[{ required: true, message: 'Vui lòng tìm và chọn địa chỉ hợp lệ từ VietMap' }]}
            extra={<span className="text-[11px] text-gray-500">Chọn gợi ý từ VietMap hoặc điền Địa chỉ + Phường/Xã + Tỉnh/TP để hệ thống tự động lấy Tọa độ.</span>}
          >
            <LocationSearchInput
              placeholder="Gõ tên đường, khu công nghiệp, tòa nhà để tìm kiếm..."
              onSelectLocation={(locData) => {
                if (locData?.lat != null && locData?.lng != null) {
                  const nextProv = normalizeShortProvince(locData.province);
                  form.setFieldsValue({
                    address: locData.address,
                    ...(nextProv ? { province: nextProv } : {}),
                    lat: Number(Number(locData.lat).toFixed(6)),
                    lng: Number(Number(locData.lng).toFixed(6))
                  });
                } else {
                  form.setFieldsValue({ lat: undefined, lng: undefined });
                }
              }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="lat"
                label={
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Lock size={11} className="text-emerald-600" /> Vĩ độ tự động (Lat)
                  </span>
                }
                rules={[{ required: true, message: 'Chọn địa chỉ VietMap để lấy Vĩ độ' }]}
              >
                <InputNumber className="w-full text-xs font-mono bg-gray-50" readOnly disabled placeholder="Tự động điền từ VietMap" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lng"
                label={
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Lock size={11} className="text-emerald-600" /> Kinh độ tự động (Lng)
                  </span>
                }
                rules={[{ required: true, message: 'Chọn địa chỉ VietMap để lấy Kinh độ' }]}
              >
                <InputNumber className="w-full text-xs font-mono bg-gray-50" readOnly disabled placeholder="Tự động điền từ VietMap" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
