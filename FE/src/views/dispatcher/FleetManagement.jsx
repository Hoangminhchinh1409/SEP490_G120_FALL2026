import { useState } from 'react';
import { Table, Tag, Button, Input, Row, Col, Modal, Form, Select, message, Alert } from 'antd';
import { Search, Truck, User, Activity, Map, AlertTriangle } from 'lucide-react';
import IncidentDetailsModal from '../../components/dispatcher/IncidentDetailsModal';

const { Option } = Select;

// Dữ liệu xe thực tế từ Adtek và đội xe ALS
const mockFleet = [
  { key: '1', license_plate: '29H-995.72', type: 'Thaco Frontier 1.25T', driver: 'Hồ Chí Học', phone: '008093002529', payload: '1,400 kg', status: 'AVAILABLE', location: 'Depot Cảng HKQT Nội Bài', insurance_exp: '2027-04-15' },
  { key: '2', license_plate: '29H-767.99', type: 'Thaco Ollin 2.5T', driver: 'Tạ Đức Hải', phone: '0977887918', payload: '2,490 kg', status: 'IN_TRANSIT', location: 'Cao tốc Nội Bài - Bắc Ninh (Km 18)', insurance_exp: '2027-02-10' },
  { key: '3', license_plate: '29C-882.11', type: 'Thaco Auman 4.0T', driver: 'Nguyễn Văn Đạt', phone: '0912345678', payload: '4,200 kg', status: 'AVAILABLE', location: 'Kho Ngoại Quan Yên Phong', insurance_exp: '2026-12-30' },
  { key: '4', license_plate: '29H-123.45', type: 'Thaco Frontier 1.25T', driver: 'Lê Hoàng Long', phone: '0988776655', payload: '1,400 kg', status: 'MAINTENANCE', location: 'Gara Bảo trì ALS Sóc Sơn', insurance_exp: '2027-01-20' },
  { key: '5', license_plate: '15C-333.44', type: 'Đầu kéo Container', driver: 'Trần Văn Mạnh', phone: '0933221100', payload: '30,000 kg', status: 'IN_TRANSIT', location: 'Cảng Hải Phòng', insurance_exp: '2026-11-15' }
];

const mockIncidents = [
  { 
    id: 'INC-2026-091', 
    trip_code: 'TRIP-8821', 
    truck: '29H-995.72', 
    driver: 'Hồ Chí Học', 
    phone: '008093002529',
    type: 'HỎNG XE GIỮA ĐƯỜNG', 
    severity: 'HIGH',
    description: 'Xe bị gãy trục truyền động tại Km 18 cao tốc Nội Bài - Bắc Ninh. Trên xe có 18 Pallet ADTEK cần xe cứu hộ chuyển tải gấp để kịp chuyến bay.' 
  }
];

const statusColors = {
  'AVAILABLE': 'green', 'IN_TRANSIT': 'blue', 'MAINTENANCE': 'red'
};

const FleetManagement = () => {
  const [data, setData] = useState(mockFleet);
  const [activeIncident, setActiveIncident] = useState(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handlePlanSubmit = () => {
    form.validateFields().then(() => {
      message.success(`Kế hoạch chuyến gộp LTL đã được tạo và gán thành công!`);
      setIsPlanModalOpen(false);
      form.resetFields();
    });
  };

  const handleResolveIncident = (resolvedData) => {
    message.success(`Sự cố ${resolvedData.id} đã được xử lý thành công!`);
    if (resolvedData.new_truck) {
      // Cập nhật trạng thái xe cũ thành bảo trì, xe mới thành in transit
      setData(prev => prev.map(item => {
        if (item.license_plate === '29H-995.72') return { ...item, status: 'MAINTENANCE' };
        if (item.license_plate === resolvedData.new_truck) return { ...item, status: 'IN_TRANSIT' };
        return item;
      }));
    }
  };

  const columns = [
    { 
      title: 'Biển số xe', 
      dataIndex: 'license_plate', 
      key: 'license_plate', 
      render: (text) => (
        <span className="font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded border border-gray-300 font-mono">
          {text}
        </span>
      ) 
    },
    { title: 'Dòng xe & Tải trọng', dataIndex: 'type', key: 'type', render: (text, r) => <div><div className="font-medium text-gray-800 text-xs">{text}</div><div className="text-[11px] text-gray-400">Tải: {r.payload}</div></div> },
    { 
      title: 'Tài xế phụ trách', 
      dataIndex: 'driver', 
      key: 'driver', 
      render: (text, r) => (
        <div className="text-xs">
          <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <User size={13} className="text-gray-400" />
            <span>{text}</span>
          </div>
          <div className="text-gray-400 text-[11px] font-mono">{r.phone}</div>
        </div>
      ) 
    },
    { 
      title: 'Vị trí hiện tại', 
      dataIndex: 'location', 
      key: 'location',
      render: text => <span className="text-xs text-gray-600">{text}</span>
    },
    { 
      title: 'Hạn đăng kiểm/Bảo hiểm', 
      dataIndex: 'insurance_exp', 
      key: 'insurance_exp',
      render: text => <span className="text-xs font-mono text-gray-500">{text}</span>
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status', 
      render: (status) => (
        <Tag color={statusColors[status] || 'default'} className="font-semibold text-xs rounded-md px-2 py-0.5">
          {status}
        </Tag>
      ) 
    },
    { 
      title: 'Hành động', 
      key: 'action', 
      render: (_, record) => (
        <div className="flex gap-2">
          {record.status === 'IN_TRANSIT' && record.license_plate === '29H-767.99' ? (
            <Button 
              size="small" 
              danger 
              icon={<AlertTriangle size={13} />}
              onClick={() => setActiveIncident(mockIncidents[0])}
            >
              Xem Sự cố (Cấp cứu)
            </Button>
          ) : (
            <Button size="small" type="primary" className="bg-[#7367f0] hover:bg-[#5e50ee] border-none text-xs">
              Điều xe
            </Button>
          )}
        </div>
      ) 
    }
  ];

  return (
    <div className="p-6 md:p-8 custom-scrollbar">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Đội xe, Lập Kế hoạch Chuyến & Xử lý Sự cố</h1>
            <p className="text-gray-500 text-sm">Ưu tiên xe nội bộ ALS, kiểm tra giờ lái, điều xe thay thế và quản lý giấy vận tải</p>
          </div>
          <div className="flex gap-2">
            <Button 
              type="primary" 
              icon={<Map size={16} />} 
              className="bg-emerald-600 hover:bg-emerald-700 h-10 px-4 font-semibold" 
              onClick={() => setIsPlanModalOpen(true)}
            >
              Lập Kế hoạch Chuyến Gộp LTL
            </Button>
            {mockIncidents.length > 0 && (
              <Button 
                danger 
                icon={<AlertTriangle size={16} />} 
                className="h-10 px-4 font-semibold"
                onClick={() => setActiveIncident(mockIncidents[0])}
              >
                Cảnh báo Sự cố ({mockIncidents.length})
              </Button>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        <Row gutter={[20, 20]} className="mb-6">
          <Col xs={24} sm={6}>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Truck size={24} /></div>
              <div>
                <p className="text-gray-500 text-xs font-semibold mb-0.5 uppercase">Tổng Đội xe ALS</p>
                <h3 className="text-2xl font-bold text-gray-800">6 Xe Thaco</h3>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={6}>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><Activity size={24} /></div>
              <div>
                <p className="text-gray-500 text-xs font-semibold mb-0.5 uppercase">Xe Sẵn sàng Chạy</p>
                <h3 className="text-2xl font-bold text-gray-800">3 Xe</h3>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={6}>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center"><User size={24} /></div>
              <div>
                <p className="text-gray-500 text-xs font-semibold mb-0.5 uppercase">Tài xế Đủ Tiêu Chuẩn</p>
                <h3 className="text-2xl font-bold text-gray-800">8 Tài xế</h3>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={6}>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100 bg-red-50/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle size={24} /></div>
              <div>
                <p className="text-red-600 text-xs font-semibold mb-0.5 uppercase">Sự cố Cần Xử lý</p>
                <h3 className="text-2xl font-bold text-red-600">1 Sự cố</h3>
              </div>
            </div>
          </Col>
        </Row>

        {/* Bảng danh sách phương tiện */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Trạng thái Phương tiện & Tài xế Đội xe ALS</h3>
            <Input placeholder="Tìm kiếm biển số hoặc tài xế..." prefix={<Search size={16} className="text-gray-400" />} className="w-72" />
          </div>
          <Table 
            columns={columns} 
            dataSource={data} 
            pagination={{ pageSize: 8 }} 
            className="custom-table"
          />
        </div>

      </div>

      {/* Modal Lập Kế Hoạch Chuyến Gộp LTL */}
      <Modal
        title={<span className="text-base font-bold text-gray-800">Lập Kế hoạch Chuyến Gộp LTL</span>}
        open={isPlanModalOpen}
        onCancel={() => setIsPlanModalOpen(false)}
        onOk={handlePlanSubmit}
        width={720}
        okText="Khởi tạo Chuyến Gộp"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" className="mt-3">
          <Alert
            type="info"
            title="Công thức Tính Giá Chuyến Gộp:"
            description="Chuyến gộp của 1 Khách: Bảng giá theo km đến điểm xa nhất + 300.000 VNĐ cho mỗi điểm dừng phụ. Nếu chuyến gộp của nhiều Khách: giữ nguyên Giá đã chốt riêng (Agreed Price) của từng đơn."
            showIcon
            className="mb-4 text-xs"
          />

          <Form.Item label="Chọn các Đơn hàng LTL cần ghép chuyến" name="selected_orders" rules={[{ required: true }]}>
            <Select mode="multiple" placeholder="Chọn các đơn hàng chờ xếp xe...">
              <Option value="NEX-827364">NEX-827364 (ADTEK - 18 Pallet, Bắc Ninh -&gt; Nội Bài)</Option>
              <Option value="NEX-827365">NEX-827365 (SLVN Sound Light - 42 Kiện, Nội Bài -&gt; Lai Xá)</Option>
            </Select>
          </Form.Item>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Form.Item label="Xe Tải Phù Hợp" name="truck_id" rules={[{ required: true }]}>
              <Select placeholder="Chọn xe nội bộ...">
                <Option value="29H-767.99">29H-767.99 (Thaco Ollin 2.5T - Tải 2,490kg)</Option>
                <Option value="29C-882.11">29C-882.11 (Thaco Auman 4.0T - Tải 4,200kg)</Option>
              </Select>
            </Form.Item>
            <Form.Item label="Tài xế Vận hành" name="driver_id" rules={[{ required: true }]}>
              <Select placeholder="Chọn tài xế...">
                <Option value="Hồ Chí Học">Hồ Chí Học (008093002529)</Option>
                <Option value="Nguyễn Văn Đạt">Nguyễn Văn Đạt (0912345678)</Option>
              </Select>
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Modal Xử lý Sự cố Hiện Trường */}
      <IncidentDetailsModal
        open={Boolean(activeIncident)}
        incident={activeIncident}
        onCancel={() => setActiveIncident(null)}
        onResolveSuccess={handleResolveIncident}
      />
    </div>
  );
};

export default FleetManagement;
