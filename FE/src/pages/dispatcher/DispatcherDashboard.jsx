import { useState } from 'react';
import { Table, Tag, Button, Row, Col } from 'antd';
import { Users, Plus, TrendingUp, DollarSign, Package, ShoppingCart, CloudDownload, RefreshCcw, Activity, Globe, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import OrderFormModal from '../../components/dispatcher/OrderFormModal';
import Chart from 'react-apexcharts';

// Mock Data
const mockOrders = [
  { key: '1', order_id: 'NEX-827364', customer: 'VinFast LLC', route: 'Nội Bài -> Hữu Nghị', weight: '350.00', chargeable: '400.00', status: 'CREATED', date: '2026-09-23 08:30' },
  { key: '2', order_id: 'NEX-827365', customer: 'Samsung VN', route: 'Yên Phong -> Nội Bài', weight: '1200.00', chargeable: '1200.00', status: 'VEHICLE_ASSIGNED', date: '2026-09-23 09:15' },
  { key: '3', order_id: 'NEX-827366', customer: 'Foxconn', route: 'Gia Lâm -> Hải Phòng', weight: '210.00', chargeable: '250.00', status: 'IN_TRANSIT', date: '2026-09-23 10:00' },
  { key: '4', order_id: 'NEX-827367', customer: 'LG Electronics', route: 'Hải Phòng -> Hà Nội', weight: '550.00', chargeable: '550.00', status: 'DELIVERED', date: '2026-09-22 14:00' },
];

const mockFeeds = [
  { id: 1, title: 'Tài xế Nguyễn Văn A đã nhận đơn', time: '10 phút trước', color: 'text-blue-500' },
  { id: 2, title: 'Xe 29C-12345 đang gặp sự cố', time: '1 giờ trước', color: 'text-red-500' },
  { id: 3, title: 'Đơn hàng NEX-827367 giao thành công', time: '2 giờ trước', color: 'text-green-500' },
  { id: 4, title: 'Tạo mới 5 đơn hàng từ Samsung', time: '5 giờ trước', color: 'text-indigo-500' },
];

// --- Chart Configurations ---
const supportChartOptions = {
  chart: { type: 'area', height: 100, sparkline: { enabled: true } },
  colors: ['#7367f0'],
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0, stops: [0, 90, 100] } },
  tooltip: { fixed: { enabled: false }, x: { show: false }, y: { title: { formatter: () => 'Tỷ lệ' } }, marker: { show: false } }
};
const supportChartData = [{ name: 'Tỷ lệ giao', data: [0, 20, 10, 45, 30, 55, 20, 30, 0] }];

const supportChart2Options = {
  chart: { type: 'bar', height: 100, sparkline: { enabled: true } },
  colors: ['#7367f0'],
  plotOptions: { bar: { columnWidth: '50%', borderRadius: 2 } },
  tooltip: { fixed: { enabled: false }, x: { show: false }, y: { title: { formatter: () => 'Đơn hàng' } }, marker: { show: false } }
};
const supportChart2Data = [{ name: 'Giao hàng', data: [25, 66, 41, 89, 63, 25, 44, 12, 36, 9, 54] }];

const accountChartOptions = {
  chart: { type: 'line', height: 350, toolbar: { show: false } },
  colors: ['#7367f0', '#00cfe8'],
  stroke: { curve: 'smooth', width: [3, 0] },
  plotOptions: { bar: { columnWidth: '50%', borderRadius: 2 } },
  xaxis: { categories: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'] },
  legend: { position: 'bottom', horizontalAlign: 'center' }
};
const accountChartData = [
  { name: 'Tổng doanh thu', type: 'line', data: [31, 25, 35, 28, 51, 35, 65, 45, 59, 36, 38, 50] },
  { name: 'Trung bình', type: 'column', data: [22, 11, 21, 26, 12, 21, 36, 20, 44, 21, 30, 40] }
];

const satisfactionChartOptions = {
  chart: { type: 'pie', height: 300 },
  labels: ['Rất hài lòng', 'Hài lòng', 'Chưa tốt'],
  colors: ['#7367f0', '#a8a5f8', '#d6d5fc'],
  legend: { show: true, position: 'right' },
  dataLabels: { enabled: true, dropShadow: { enabled: false } }
};
const satisfactionChartData = [66, 26, 8];

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
    'CREATED': 'blue', 'CONFIRMED': 'cyan', 'VEHICLE_ASSIGNED': 'orange',
    'CARGO_PICKED_UP': 'magenta', 'IN_TRANSIT': 'purple', 'DELIVERED': 'green', 'INCIDENT': 'red'
  };

  const columns = [
    { title: 'Mã Vận Đơn', dataIndex: 'order_id', key: 'order_id', render: (text) => <span className="font-semibold text-indigo-600">{text}</span> },
    { title: 'Khách hàng', dataIndex: 'customer', key: 'customer' },
    { title: 'Tuyến đường', dataIndex: 'route', key: 'route' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (status) => <Tag color={statusColors[status] || 'default'} className="font-medium rounded-md px-2 py-1">{status}</Tag> },
    { title: 'Hành động', key: 'action', render: () => (
      <div className="flex gap-2">
        <Button size="small" type="primary" className="bg-[#7367f0] hover:bg-[#5e50ee] border-none">Phân xe</Button>
      </div>
    )}
  ];

  return (
    <div className="p-6 md:p-8 custom-scrollbar">
      <div className="max-w-[1600px] mx-auto">
        
        <Row gutter={[24, 24]}>
          {/* --- LEFT COLUMN --- */}
          <Col xs={24} xl={12} className="space-y-6">
            
            {/* 1. Flat Cards Grid (3x2) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <Row className="divide-y md:divide-y-0 md:divide-x divide-gray-100 border-b border-gray-100">
                <Col xs={12} sm={8} className="p-5 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users size={28} className="text-[#7367f0] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">1000</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Khách hàng</p>
                  </div>
                </Col>
                <Col xs={12} sm={8} className="p-5 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Globe size={28} className="text-[#7367f0] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">1252</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Doanh thu</p>
                  </div>
                </Col>
                <Col xs={12} sm={8} className="p-5 text-center hidden sm:block">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Activity size={28} className="text-[#7367f0] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">600%</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Tăng trưởng</p>
                  </div>
                </Col>
              </Row>
              <Row className="divide-y md:divide-y-0 md:divide-x divide-gray-100">
                <Col xs={12} sm={8} className="p-5 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCcw size={28} className="text-[#7367f0] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">35</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Sự cố/Hoàn</p>
                  </div>
                </Col>
                <Col xs={12} sm={8} className="p-5 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CloudDownload size={28} className="text-[#7367f0] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">3550</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Lượt tải App</p>
                  </div>
                </Col>
                <Col xs={12} sm={8} className="p-5 text-center hidden sm:block">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShoppingCart size={28} className="text-[#7367f0] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">94.5%</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Tỷ lệ On-Time</p>
                  </div>
                </Col>
              </Row>
            </div>

            {/* 2. Support Bar Charts (Row of 2) */}
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12}>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                  <div className="p-6 pb-2">
                    <h2 className="text-[28px] font-bold text-gray-800 m-0 leading-tight">53.94%</h2>
                    <span className="text-[#7367f0] font-medium text-sm">Tỷ lệ Giao Thành Công</span>
                    <p className="text-gray-500 text-xs mt-3 mb-1 line-clamp-2">Tỷ lệ đơn hàng giao thành công trên tổng số đơn nhận.</p>
                  </div>
                  <div className="mt-auto">
                    <Chart options={supportChartOptions} series={supportChartData} type="area" height={80} />
                    <div className="bg-[#7367f0] text-white py-3 px-4">
                      <Row className="text-center">
                        <Col span={8}>
                          <h4 className="text-base font-bold m-0 text-white">10</h4><span className="text-[#d6d5fc] text-[10px] uppercase">Tháng 10</span>
                        </Col>
                        <Col span={8}>
                          <h4 className="text-base font-bold m-0 text-white">15</h4><span className="text-[#d6d5fc] text-[10px] uppercase">Tháng 9</span>
                        </Col>
                        <Col span={8}>
                          <h4 className="text-base font-bold m-0 text-white">13</h4><span className="text-[#d6d5fc] text-[10px] uppercase">Tháng 8</span>
                        </Col>
                      </Row>
                    </div>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                  <div className="p-6 pb-2">
                    <h2 className="text-[28px] font-bold text-gray-800 m-0 leading-tight">1432</h2>
                    <span className="text-[#7367f0] font-medium text-sm">Tổng Đơn Đã Giao</span>
                    <p className="text-gray-500 text-xs mt-3 mb-1 line-clamp-2">Tổng số lượng đơn hàng đã hoàn tất quá trình vận chuyển.</p>
                  </div>
                  <div className="mt-auto">
                    <div className="py-2">
                      <Row className="text-center">
                        <Col span={8}>
                          <h4 className="text-base font-bold text-gray-800 m-0">130</h4><span className="text-gray-500 text-[10px] uppercase">T5</span>
                        </Col>
                        <Col span={8}>
                          <h4 className="text-base font-bold text-gray-800 m-0">251</h4><span className="text-gray-500 text-[10px] uppercase">T6</span>
                        </Col>
                        <Col span={8}>
                          <h4 className="text-base font-bold text-gray-800 m-0">235</h4><span className="text-gray-500 text-[10px] uppercase">T7</span>
                        </Col>
                      </Row>
                    </div>
                    <div className="px-2 pb-2"><Chart options={supportChart2Options} series={supportChart2Data} type="bar" height={80} /></div>
                  </div>
                </div>
              </Col>
            </Row>

            {/* 3. Customer Satisfaction */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-[340px]">
              <h6 className="text-base font-bold text-gray-800 mb-1">Mức độ Hài lòng Dịch vụ</h6>
              <p className="text-gray-500 text-xs mb-6">Đánh giá chất lượng vận tải từ khách hàng và đối tác.</p>
              <div className="flex justify-center items-center">
                <Chart options={satisfactionChartOptions} series={satisfactionChartData} type="pie" height={220} width="100%" />
              </div>
            </div>

          </Col>


          {/* --- RIGHT COLUMN --- */}
          <Col xs={24} xl={12} className="space-y-6">
            
            {/* 1. Department wise monthly sales report */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-[460px]">
              <div className="mb-4">
                <h5 className="text-[15px] font-bold text-gray-800 mb-6">Báo cáo Doanh thu theo Tuyến đường</h5>
              </div>
              <Row className="mb-2">
                <Col className="mr-10">
                  <h3 className="text-2xl font-bold text-gray-800 mb-0">$21,356.46</h3>
                  <span className="text-gray-500 text-xs font-medium">Tổng doanh thu</span>
                </Col>
                <Col>
                  <h3 className="text-2xl font-bold text-gray-800 mb-0">$1935.6</h3>
                  <span className="text-gray-500 text-xs font-medium">Trung bình</span>
                </Col>
              </Row>
              <div className="mt-4">
                <Chart options={accountChartOptions} series={accountChartData} type="line" height={300} />
              </div>
            </div>

            {/* 2. Product Cards (2x2) */}
            <Row gutter={[24, 24]}>
              <Col span={12}>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-800 text-sm font-bold mb-1">Tổng Cước Nội Địa</p>
                    <Package size={20} className="text-[#7367f0]" />
                  </div>
                  <h3 className="text-[26px] font-bold text-gray-800 mt-2">$1,783</h3>
                </div>
              </Col>
              <Col span={12}>
                <div className="bg-[#7367f0] p-6 rounded-xl shadow-sm h-full relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2 z-10 relative">
                    <p className="text-white text-sm font-bold mb-1">Tổng Số Đơn</p>
                    <ShoppingCart size={20} className="text-white opacity-80" />
                  </div>
                  <h3 className="text-[26px] font-bold text-white z-10 relative mt-2">15,830</h3>
                </div>
              </Col>
              <Col span={12}>
                <div className="bg-[#7367f0] p-6 rounded-xl shadow-sm h-full relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2 z-10 relative">
                    <p className="text-white text-sm font-bold mb-1">Giá Cước Trung Bình</p>
                    <DollarSign size={20} className="text-white opacity-80" />
                  </div>
                  <h3 className="text-[26px] font-bold text-white z-10 relative mt-2">$6,780</h3>
                </div>
              </Col>
              <Col span={12}>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-800 text-sm font-bold mb-1">Khối Lượng Xử Lý</p>
                    <Tag color="cyan" className="m-0 border-none px-2 rounded font-semibold bg-[#e0f9fc] text-[#00cfe8]">Logs</Tag>
                  </div>
                  <h3 className="text-[26px] font-bold text-gray-800 mt-2">6,784</h3>
                </div>
              </Col>
            </Row>

          </Col>
        </Row>

        {/* Tables Area */}
        <Row gutter={[24, 24]} className="mt-6">
          <Col xs={24} xl={16}>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="mb-4 pb-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-800">Danh sách Đơn hàng Gần đây</h3>
                <Button type="primary" size="small" icon={<Plus size={14} />} className="bg-[#7367f0] hover:bg-[#5e50ee] border-none" onClick={() => setIsModalOpen(true)}>
                  Tạo đơn hàng
                </Button>
              </div>
              <Table 
                columns={columns} 
                dataSource={data} 
                pagination={{ pageSize: 4 }} 
                className="ant-table-striped custom-table"
              />
            </div>
          </Col>
          <Col xs={24} xl={8}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
              <h3 className="text-base font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100">Hoạt động Gần đây</h3>
              <div className="space-y-4">
                {mockFeeds.map(feed => (
                  <div key={feed.id} className="flex gap-4 items-start">
                    <div className={`mt-1 ${feed.color}`}><Bell size={16} /></div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{feed.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{feed.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Col>
        </Row>

      </div>
      <OrderFormModal open={isModalOpen} onCancel={() => setIsModalOpen(false)} onSubmit={handleCreateOrder} />
    </div>
  );
};

export default DispatcherDashboard;
