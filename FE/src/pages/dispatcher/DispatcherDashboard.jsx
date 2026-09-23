import { useState } from 'react';
import { Table, Tag, Button, Input, Dropdown, Menu } from 'antd';
import { LayoutDashboard, Truck, Users, Settings, Plus, Search, FileText, MapPin, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import OrderFormModal from '../../components/dispatcher/OrderFormModal';

const { Search: AntSearch } = Input;

// Mock Data cho Bảng Đơn Hàng
const mockOrders = [
  {
    key: '1',
    order_id: 'NEX-827364',
    customer: 'VinFast LLC',
    route: 'Nội Bài -> Cửa khẩu Hữu Nghị',
    weight: '350.00',
    chargeable: '400.00',
    status: 'CREATED',
    date: '2026-09-23 08:30'
  },
  {
    key: '2',
    order_id: 'NEX-827365',
    customer: 'Samsung VN',
    route: 'KCN Yên Phong -> Nội Bài',
    weight: '1200.00',
    chargeable: '1200.00',
    status: 'VEHICLE_ASSIGNED',
    date: '2026-09-23 09:15'
  },
  {
    key: '3',
    order_id: 'NEX-827366',
    customer: 'Foxconn',
    route: 'Gia Lâm -> Hải Phòng',
    weight: '210.00',
    chargeable: '250.00',
    status: 'IN_TRANSIT',
    date: '2026-09-23 10:00'
  }
];

const DispatcherDashboard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState(mockOrders);

  const handleCreateOrder = (values) => {
    const newOrder = {
      key: Date.now().toString(),
      order_id: `NEX-${Math.floor(100000 + Math.random() * 900000)}`,
      customer: values.customer_name,
      route: 'TBD',
      weight: values.weight_kg,
      chargeable: values.chargeable_weight,
      status: 'CREATED',
      date: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    setData([newOrder, ...data]);
    setIsModalOpen(false);
  };

  const statusColors = {
    'CREATED': 'blue',
    'CONFIRMED': 'cyan',
    'VEHICLE_ASSIGNED': 'orange',
    'CARGO_PICKED_UP': 'magenta',
    'IN_TRANSIT': 'purple',
    'DELIVERED': 'green',
    'INCIDENT': 'red'
  };

  const columns = [
    {
      title: 'Mã Vận Đơn',
      dataIndex: 'order_id',
      key: 'order_id',
      render: (text) => <span className="font-bold text-[#0056a0]">{text}</span>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      key: 'customer',
    },
    {
      title: 'Tuyến đường',
      dataIndex: 'route',
      key: 'route',
    },
    {
      title: 'Chargeable (kg)',
      dataIndex: 'chargeable',
      key: 'chargeable',
      render: (text) => <span className="font-semibold">{text}</span>
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status] || 'default'} className="font-semibold">
          {status}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: () => (
        <div className="flex gap-2">
          <Button size="small" type="primary" ghost>Phân xe</Button>
          <Button size="small">Chi tiết</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#002b54] text-white flex flex-col hidden md:flex">
        <div className="p-6">
          <div className="flex flex-col items-start mb-2">
            <span className="font-black text-3xl tracking-tighter leading-none">NEXLOG</span>
            <span className="text-[10px] font-bold text-[#f2a900] tracking-widest mt-1">NEXLOG SYSTEM</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link to="#" className="flex items-center gap-3 px-4 py-3 bg-[#004282] rounded-lg font-semibold text-white">
            <LayoutDashboard size={20} /> Tổng quan
          </Link>
          <Link to="#" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-[#00386e] hover:text-white rounded-lg transition">
            <FileText size={20} /> Quản lý Đơn hàng
          </Link>
          <Link to="#" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-[#00386e] hover:text-white rounded-lg transition">
            <Truck size={20} /> Đội xe & Phân công
          </Link>
          <Link to="#" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-[#00386e] hover:text-white rounded-lg transition">
            <MapPin size={20} /> Bản đồ Theo dõi
          </Link>
          <Link to="#" className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-[#00386e] hover:text-white rounded-lg transition">
            <Users size={20} /> Đối tác thuê ngoài
          </Link>
        </nav>
        
        <div className="p-4 border-t border-[#00386e]">
          <Link to="#" className="flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-white transition">
            <Settings size={20} /> Cài đặt
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Topbar */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 z-10">
          <div className="text-xl font-bold text-gray-700">Điều phối viên (Dispatcher)</div>
          <div className="flex items-center gap-6">
            <button className="text-gray-500 hover:text-[#0056a0] relative">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold border-2 border-white">3</span>
            </button>
            <div className="flex items-center gap-3 border-l pl-6">
              <div className="w-8 h-8 rounded-full bg-[#f2a900] flex items-center justify-center text-white font-bold">
                D
              </div>
              <div className="text-sm">
                <p className="font-bold text-gray-700 leading-none">Dispatcher 01</p>
                <Link to="/" className="text-xs text-gray-500 hover:text-blue-500">Đăng xuất</Link>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-8">
          
          {/* Action Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Quản lý Đơn hàng</h1>
              <p className="text-gray-500 text-sm">Tiếp nhận, phân bổ và theo dõi đơn hàng vận tải</p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <AntSearch placeholder="Tìm mã vận đơn..." className="w-full md:w-64" />
              <Button 
                type="primary" 
                icon={<Plus size={16} />} 
                className="bg-[#0056a0] flex items-center h-8"
                onClick={() => setIsModalOpen(true)}
              >
                Tạo đơn hàng
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Chờ phân xe', value: '12', color: 'border-l-blue-500' },
              { label: 'Đang vận chuyển', value: '8', color: 'border-l-purple-500' },
              { label: 'Hoàn thành h.nay', value: '45', color: 'border-l-green-500' },
              { label: 'Báo cáo sự cố', value: '2', color: 'border-l-red-500' },
            ].map((stat, idx) => (
              <div key={idx} className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 ${stat.color}`}>
                <p className="text-gray-500 text-sm font-semibold mb-1">{stat.label}</p>
                <h3 className="text-3xl font-bold text-gray-800">{stat.value}</h3>
              </div>
            ))}
          </div>

          {/* Table Area */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <Table 
              columns={columns} 
              dataSource={data} 
              pagination={{ pageSize: 5 }} 
              className="ant-table-striped"
            />
          </div>

        </div>
      </main>

      <OrderFormModal 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        onSubmit={handleCreateOrder}
      />
    </div>
  );
};

export default DispatcherDashboard;
