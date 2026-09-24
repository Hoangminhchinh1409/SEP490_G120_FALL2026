import { useState } from 'react';
import { Table, Tag, Button, Input, Row, Col, Card } from 'antd';
import { Search, Plus, Truck, User, Activity } from 'lucide-react';

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
  const [data, setData] = useState(mockFleet);

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
            <h1 className="text-2xl font-bold text-gray-800">Đội xe & Phân công</h1>
            <p className="text-gray-500 text-sm">Quản lý phương tiện, tài xế và điều phối chuyến đi</p>
          </div>
          <Button type="primary" icon={<Plus size={16} />} className="bg-[#7367f0] hover:bg-[#5e50ee] h-10 px-4">
            Thêm phương tiện
          </Button>
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
    </div>
  );
};

export default FleetManagement;
