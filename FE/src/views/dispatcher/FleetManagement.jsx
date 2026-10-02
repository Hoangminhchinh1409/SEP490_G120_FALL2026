import { useState } from 'react';
import { Table, Tag, Button, Input, Row, Col, Modal, Form, Select, message, Alert } from 'antd';
import { Search, Plus, Truck, User, Activity, Map, DollarSign, Repeat } from 'lucide-react';

const { Option } = Select;

const mockFleet = [
  { key: '1', license_plate: '29C-123.45', type: 'Xe Tải 5T', driver: 'Nguyễn Văn A', phone: '0901234567', status: 'AVAILABLE', location: 'Kho Bãi Nội Bài' },
  { key: '2', license_plate: '29C-678.90', type: 'Container Lạnh', driver: 'Trần Văn B', phone: '0902345678', status: 'IN_TRANSIT', location: 'Quốc lộ 1A - Thanh Hóa' },
  { key: '3', license_plate: '15C-333.44', type: 'Xe Tải 10T', driver: 'Lê Văn C', phone: '0903456789', status: 'MAINTENANCE', location: 'Gara Hải Phòng' },
  { key: '4', license_plate: '51C-888.88', type: 'Đầu kéo', driver: 'Phạm Văn D', phone: '0904567890', status: 'AVAILABLE', location: 'Kho Bãi Cát Lái' },
];

const statusColors = {
  'AVAILABLE': 'green', 'IN_TRANSIT': 'blue', 'MAINTENANCE': 'red'
};

const FleetManagement = () => {
  const [data] = useState(mockFleet);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [assignmentType, setAssignmentType] = useState('INTERNAL'); // INTERNAL or VENDOR

  const handlePlanSubmit = () => {
    form.validateFields().then(values => {
      message.success(`Kế hoạch chuyến xe đã được tạo và gán cho ${assignmentType === 'INTERNAL' ? 'Nội bộ' : 'Vendor'}!`);
      setIsPlanModalOpen(false);
      form.resetFields();
    });
  };

  const columns = [
    { title: 'Biển số xe', dataIndex: 'license_plate', key: 'license_plate', render: (text) => <span className="font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded border border-gray-300">{text}</span> },
    { title: 'Loại xe', dataIndex: 'type', key: 'type', render: text => <span className="font-medium text-gray-600">{text}</span> },
    { title: 'Tài xế', dataIndex: 'driver', key: 'driver', render: text => <div className="flex items-center gap-2"><User size={14} className="text-gray-400" /> <span>{text}</span></div> },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone' },
    { title: 'Vị trí hiện tại', dataIndex: 'location', key: 'location' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (status) => <Tag color={statusColors[status] || 'default'} className="font-medium rounded-md px-2 py-1">{status}</Tag> },
    { title: 'Hành động', key: 'action', render: () => (
      <div className="flex gap-2">
        <Button size="small" type="primary" className="bg-[#7367f0] hover:bg-[#5e50ee] border-none">Phân công</Button>
      </div>
    )}
  ];

  return (
    <div className="p-6 md:p-8 custom-scrollbar">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Lập Kế hoạch Chuyến xe & Gán Nguồn lực</h1>
            <p className="text-gray-500 text-sm">Gộp đơn, tính giá, gợi ý loại xe và gán xe nội bộ hoặc chuyển Vendor.</p>
          </div>
          <div className="flex gap-2">
            <Button type="primary" icon={<Map size={16} />} className="bg-green-600 hover:bg-green-700 h-10 px-4" onClick={() => setIsPlanModalOpen(true)}>
              Lập Kế hoạch Chuyến mới
            </Button>
            <Button type="primary" ghost icon={<Plus size={16} />} className="h-10 px-4">
              Thêm phương tiện
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <Row gutter={[24, 24]} className="mb-6">
          <Col xs={24} sm={8}>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Truck size={24} /></div>
              <div>
                <p className="text-gray-500 text-sm font-semibold mb-1">Tổng số xe</p>
                <h3 className="text-2xl font-bold text-gray-800">45</h3>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><Activity size={24} /></div>
              <div>
                <p className="text-gray-500 text-sm font-semibold mb-1">Đang sẵn sàng</p>
                <h3 className="text-2xl font-bold text-gray-800">24</h3>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center"><User size={24} /></div>
              <div>
                <p className="text-gray-500 text-sm font-semibold mb-1">Tổng tài xế</p>
                <h3 className="text-2xl font-bold text-gray-800">50</h3>
              </div>
            </div>
          </Col>
        </Row>

        {/* Table Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800">Danh sách Phương tiện</h3>
            <Input placeholder="Tìm kiếm biển số..." prefix={<Search size={16} className="text-gray-400" />} className="w-64" />
          </div>
          <Table 
            columns={columns} 
            dataSource={data} 
            pagination={{ pageSize: 10 }} 
            className="ant-table-striped custom-table"
          />
        </div>

      </div>

      <Modal
        title={<span className="text-lg font-bold text-[#0056a0]">Lập Kế hoạch & Phân công (Trip Planning)</span>}
        open={isPlanModalOpen}
        onCancel={() => setIsPlanModalOpen(false)}
        onOk={handlePlanSubmit}
        width={750}
        okText="Xác nhận Phân công"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" className="mt-4" initialValues={{ assignmentType: 'INTERNAL' }}>
          
          <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-2">Gộp đơn cùng tỉnh (Multi-drop Grouping)</h3>
            <Form.Item name="selected_orders" rules={[{ required: true, message: 'Chọn ít nhất 1 đơn hàng' }]} className="mb-0">
              <Select mode="multiple" placeholder="Chọn các đơn hàng chờ ghép chuyến...">
                <Option value="O1">NEX-827364 (Hà Nội, 500kg)</Option>
                <Option value="O2">NEX-827365 (Hà Nội, 300kg)</Option>
                <Option value="O3">NEX-827366 (Hải Phòng, 1200kg)</Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-500 text-sm mb-1">Tổng Trọng lượng Quy đổi</p>
              <p className="text-2xl font-bold text-gray-800">800 kg</p>
              <Alert title="Gợi ý: Dùng xe Thaco 1.25T" type="success" showIcon className="mt-2 text-left" />
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
              <p className="text-gray-500 text-sm mb-1">Giá Chuyến Tự động</p>
              <p className="text-2xl font-bold text-orange-600 flex justify-center items-center gap-1">
                <DollarSign size={20}/> 1,500,000 VNĐ
              </p>
              <p className="text-xs text-gray-400 mt-2">Bao gồm 300k/điểm phụ</p>
            </div>
          </div>

          <Form.Item name="assignmentType" label="Loại Phân công">
            <Select onChange={(val) => setAssignmentType(val)}>
              <Option value="INTERNAL"><Truck size={14} className="inline mr-2" />Gán xe & Tài xế Nội bộ</Option>
              <Option value="VENDOR"><Repeat size={14} className="inline mr-2" />Chuyển giao cho Nhà xe ngoài (Vendor)</Option>
            </Select>
          </Form.Item>

          {assignmentType === 'INTERNAL' ? (
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="truck_id" label="Chọn Xe Tải" rules={[{ required: true }]}>
                <Select placeholder="Chọn xe...">
                  <Option value="T1">29C-123.45 (Thaco 1.25T) - Sẵn sàng</Option>
                  <Option value="T2">29C-678.90 (Thaco 1.25T) - Đang chạy</Option>
                </Select>
              </Form.Item>
              <Form.Item name="driver_id" label="Chọn Tài xế" rules={[{ required: true }]}>
                <Select placeholder="Chọn tài xế...">
                  <Option value="D1">Nguyễn Văn A - Đã nghỉ đủ giờ</Option>
                  <Option value="D2">Lê Văn B - Đã nghỉ đủ giờ</Option>
                </Select>
              </Form.Item>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="vendor_id" label="Chọn Nhà xe (Vendor)" rules={[{ required: true }]}>
                <Select placeholder="Chọn đối tác...">
                  <Option value="V1">Nhà xe Phương Trang (HĐ: HD-PT-2026)</Option>
                  <Option value="V2">Vận tải Thành Bưởi</Option>
                </Select>
              </Form.Item>
              <Form.Item name="vendor_tracking" label="Mã Vận Đơn Vendor" rules={[{ required: true }]}>
                <Input placeholder="Nhập mã tracking do vendor cấp..." />
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>

    </div>
  );
};

export default FleetManagement;
