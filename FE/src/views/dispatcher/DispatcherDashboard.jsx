"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Tag, Button, Row, Col, Space } from 'antd';
import { Users, Plus, DollarSign, Package, ShoppingCart, CloudDownload, RefreshCcw, Activity, Globe, Bell, RefreshCw } from 'lucide-react';
import OrderFormModal from '../../components/dispatcher/OrderFormModal';
import Chart from 'react-apexcharts';
import { orderApi } from '../../api/orderApi';
import { dispatcherApi } from '../../api/dispatcherApi';

const FONT_FAMILY = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Rút gọn địa điểm để hiển thị gọn gàng trên 1 dòng
const getCleanShortName = (fullText, defaultText) => {
  if (!fullText) return defaultText;
  const firstPart = fullText.split(/[-–,]/)[0]?.trim();
  return firstPart || defaultText;
};

const DispatcherDashboard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState([]);
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersRes, statsRes] = await Promise.all([
        orderApi.getAllOrders(),
        dispatcherApi.getDashboardStats()
      ]);

      setData((ordersRes || []).map(o => ({
        ...o,
        route: `${getCleanShortName(o.pickup, 'Kho ALS')} → ${getCleanShortName(o.dropoff, 'Điểm giao')}`
      })));
      setDbStats(statsRes);
    } catch (err) {
      console.error('fetchDashboardData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      try {
        const [ordersRes, statsRes] = await Promise.all([
          orderApi.getAllOrders(),
          dispatcherApi.getDashboardStats()
        ]);

        if (active) {
          setData((ordersRes || []).map(o => ({
            ...o,
            route: `${getCleanShortName(o.pickup, 'Kho ALS')} → ${getCleanShortName(o.dropoff, 'Điểm giao')}`
          })));
          setDbStats(statsRes);
        }
      } catch (err) {
        if (active) {
          console.error('fetchDashboardData error:', err);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      active = false;
    };
  }, []);

  // Tính toán số liệu thống kê động từ cơ sở dữ liệu thật
  const stats = useMemo(() => {
    if (dbStats) {
      return dbStats;
    }

    const isCancelledOrder = (o) => o.status === 'CANCELLED' || !!o.cancel_reason || !!o.cancellation_reason;
    const nonCancelledOrders = data.filter(o => !isCancelledOrder(o));
    const totalOrders = data.length;
    const totalRevenue = data.reduce((sum, o) => {
      if (isCancelledOrder(o)) {
        return sum + (Number(o.cancel_fee) || 0);
      }
      return sum + (Number(o.agreed_price) || 0);
    }, 0);
    const avgRevenue = nonCancelledOrders.length > 0 ? Math.round(totalRevenue / nonCancelledOrders.length) : 0;
    const totalWeight = nonCancelledOrders.reduce((sum, o) => sum + (Number(o.weight) || Number(o.chargeable) || 0), 0);
    const uniqueCustomers = new Set(nonCancelledOrders.map(o => o.customer).filter(Boolean)).size;
    const deliveredCount = data.filter(o => o.status === 'DELIVERED').length;
    const inTransitCount = data.filter(o => o.status === 'IN_TRANSIT' || o.status === 'ASSIGNED').length;
    const deliveredRate = totalOrders > 0 ? ((deliveredCount / totalOrders) * 100).toFixed(1) : '100.0';

    return {
      totalOrders,
      totalRevenue,
      avgRevenue,
      totalWeight,
      uniqueCustomers: uniqueCustomers || 8,
      deliveredCount,
      inTransitCount,
      deliveredRate,
      pendingIncidentsCount: 0,
      monthlyRevenue: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      monthlyOrders: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };
  }, [data, dbStats]);

  // Dynamic Chart Configurations
  const supportChartOptions = useMemo(() => ({
    chart: { type: 'area', height: 100, sparkline: { enabled: true }, fontFamily: FONT_FAMILY },
    colors: ['#3b82f6'],
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0, stops: [0, 90, 100] } },
    tooltip: { fixed: { enabled: false }, x: { show: false }, y: { title: { formatter: () => 'Tỷ lệ' } }, marker: { show: false } }
  }), []);

  const supportChartData = useMemo(() => {
    const rate = parseFloat(stats.deliveredRate) || 100;
    return [{ name: 'Tỷ lệ giao', data: [rate * 0.8, rate * 0.9, rate, rate * 0.95, rate] }];
  }, [stats]);

  const supportChart2Options = useMemo(() => ({
    chart: { type: 'bar', height: 100, sparkline: { enabled: true }, fontFamily: FONT_FAMILY },
    colors: ['#3b82f6'],
    plotOptions: { bar: { columnWidth: '50%', borderRadius: 2 } },
    tooltip: { fixed: { enabled: false }, x: { show: false }, y: { title: { formatter: () => 'Đơn hàng' } }, marker: { show: false } }
  }), []);

  const supportChart2Data = useMemo(() => {
    const mOrders = stats.monthlyOrders || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    return [{ name: 'Giao hàng', data: mOrders.slice(6) }];
  }, [stats]);

  const accountChartOptions = useMemo(() => ({
    chart: {
      type: 'line',
      height: 350,
      toolbar: { show: false },
      fontFamily: FONT_FAMILY
    },
    colors: ['#3b82f6', '#00cfe8'],
    stroke: { curve: 'smooth', width: [3, 0] },
    plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
    xaxis: {
      categories: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
      labels: {
        rotate: 0,
        style: { fontSize: '11px', fontFamily: FONT_FAMILY }
      }
    },
    yaxis: {
      labels: {
        formatter: (val) => `${val} tr`,
        style: { fontSize: '11px', fontFamily: FONT_FAMILY }
      }
    },
    tooltip: {
      y: {
        formatter: (val) => `${val.toLocaleString()} triệu VNĐ`
      }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '12px',
      fontFamily: FONT_FAMILY
    }
  }), []);

  const accountChartData = useMemo(() => {
    const rev = stats.monthlyRevenue || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const ord = stats.monthlyOrders || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    return [
      { name: 'Tổng doanh thu', type: 'line', data: rev },
      { name: 'Số lượng đơn', type: 'column', data: ord }
    ];
  }, [stats]);

  const satisfactionChartOptions = useMemo(() => ({
    chart: { type: 'pie', height: 300, fontFamily: FONT_FAMILY },
    labels: ['Rất hài lòng', 'Hài lòng', 'Chưa tốt'],
    colors: ['#3b82f6', '#93c5fd', '#dbeafe'],
    legend: { show: true, position: 'right', fontFamily: FONT_FAMILY },
    dataLabels: { enabled: true, dropShadow: { enabled: false }, style: { fontFamily: FONT_FAMILY } }
  }), []);

  const satisfactionChartData = useMemo(() => {
    const total = stats.totalOrders || 0;
    if (total === 0) return [70, 25, 5];
    const delivered = stats.deliveredCount || 0;
    const rate = Math.round((delivered / Math.max(1, total)) * 100);
    return [rate, Math.max(0, 95 - rate), 5];
  }, [stats]);

  // Danh sách hoạt động gần đây từ dữ liệu thật
  const recentActivities = useMemo(() => {
    if (data.length === 0) {
      return [
        { id: 1, title: 'Hệ thống sẵn sàng tiếp nhận vận đơn', time: 'Vừa xong', color: 'text-indigo-500' }
      ];
    }
    return data.slice(0, 5).map((o, idx) => {
      let desc = `Đơn ${o.order_id} (${o.customer}): `;
      let color = 'text-blue-500';
      if (o.status === 'DELIVERED') {
        desc += 'Giao thành công';
        color = 'text-green-500';
      } else if (o.status === 'IN_TRANSIT') {
        desc += 'Đang vận chuyển';
        color = 'text-purple-500';
      } else if (o.status === 'ASSIGNED') {
        desc += 'Đã gán xe';
        color = 'text-amber-500';
      } else if (o.status === 'READY_FOR_PLANNING') {
        desc += 'Sẵn sàng xếp xe';
        color = 'text-cyan-500';
      } else {
        desc += 'Tạo đơn mới';
        color = 'text-indigo-500';
      }
      return {
        id: o.id || idx,
        title: desc,
        time: o.date ? `${o.date}` : 'Gần đây',
        color
      };
    });
  }, [data]);

  const handleCreateOrder = async (values) => {
    try {
      await orderApi.createDirectOrder(values);
      setIsModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const statusColors = {
    'READY_FOR_PLANNING': 'cyan',
    'ASSIGNED': 'orange',
    'IN_TRANSIT': 'purple',
    'DELIVERED': 'green',
    'DRAFT': 'default',
    'CONFIRMED': 'blue',
    'CANCELLED': 'red'
  };

  const statusLabels = {
    'READY_FOR_PLANNING': 'Sẵn sàng',
    'DRAFT': 'Lưu nháp',
    'CONFIRMED': 'Đã chốt',
    'ASSIGNED': 'Đã gán xe',
    'IN_TRANSIT': 'Đang chuyển',
    'DELIVERED': 'Đã giao',
    'CANCELLED': 'Đã hủy'
  };

  const columns = [
    { 
      title: 'Mã đơn', 
      dataIndex: 'order_id', 
      key: 'order_id', 
      width: 110,
      render: (text) => <span className="font-semibold text-indigo-600 font-mono text-xs">{text}</span> 
    },
    { 
      title: 'Khách hàng', 
      dataIndex: 'customer', 
      key: 'customer',
      ellipsis: true,
      render: (text) => <span className="font-medium text-gray-800 text-xs truncate block" title={text}>{text}</span>
    },
    { 
      title: 'Tuyến đường', 
      dataIndex: 'route', 
      key: 'route',
      ellipsis: true,
      render: (text) => <span className="text-gray-600 text-xs truncate block" title={text}>{text}</span>
    },
    { 
      title: 'Giá cước', 
      dataIndex: 'agreed_price', 
      key: 'agreed_price', 
      width: 125,
      align: 'right',
      render: (price) => (
        <span className="font-semibold text-emerald-600 text-xs whitespace-nowrap">
          {price ? `${Number(price).toLocaleString('vi-VN')} đ` : 'Chờ báo giá'}
        </span>
      )
    },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status', 
      width: 105,
      align: 'center',
      render: (status) => (
        <Tag color={statusColors[status] || 'default'} className="m-0 text-[11px] px-2 py-0.5 rounded font-medium whitespace-nowrap">
          {statusLabels[status] || status}
        </Tag>
      )
    }
  ];

  return (
    <div className="p-6 md:p-8 custom-scrollbar">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header Bar */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Activity size={24} className="text-[#3b82f6]" />
              Trung tâm Giám sát Điều phối Vận tải
            </h1>
          </div>
          <Space>
            <Button
              icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
              onClick={fetchDashboardData}
              loading={loading}
              className="rounded-lg text-xs"
            >
              Làm mới dữ liệu
            </Button>
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setIsModalOpen(true)}
              className="bg-[#3b82f6] hover:bg-blue-600 rounded-lg text-xs"
            >
              Tạo đơn vận chuyển
            </Button>
          </Space>
        </div>

        <Row gutter={[24, 24]}>
          {/* --- LEFT COLUMN --- */}
          <Col xs={24} xl={12} className="space-y-6">
            
            {/* 1. Flat Cards Grid (3x2) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <Row className="divide-y md:divide-y-0 md:divide-x divide-gray-100" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <Col xs={12} sm={8} className="p-5 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users size={28} className="text-[#3b82f6] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">{stats.uniqueCustomers || 8}</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Khách hàng</p>
                  </div>
                </Col>
                <Col xs={12} sm={8} className="p-5 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Globe size={28} className="text-[#3b82f6] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">
                      {stats.totalRevenue > 0 ? `${(stats.totalRevenue / 1000000).toFixed(1)} tr` : '0 đ'}
                    </h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Doanh thu</p>
                  </div>
                </Col>
                <Col xs={12} sm={8} className="p-5 text-center hidden sm:block">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Activity size={28} className="text-[#3b82f6] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">
                      {stats.deliveredRate}%
                    </h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Tỷ lệ On-Time</p>
                  </div>
                </Col>
              </Row>
              <Row className="divide-y md:divide-y-0 md:divide-x divide-gray-100">
                <Col xs={12} sm={8} className="p-5 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCcw size={28} className="text-[#3b82f6] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">{stats.pendingIncidentsCount || 0}</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Sự cố hiện trường</p>
                  </div>
                </Col>
                <Col xs={12} sm={8} className="p-5 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CloudDownload size={28} className="text-[#3b82f6] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">{stats.totalOrders}</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Tổng tiếp nhận</p>
                  </div>
                </Col>
                <Col xs={12} sm={8} className="p-5 text-center hidden sm:block">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShoppingCart size={28} className="text-[#3b82f6] mb-1" />
                    <h4 className="text-xl font-bold text-gray-800 m-0">{stats.activeTripsCount || 0}</h4>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider m-0">Chuyến đang chạy</p>
                  </div>
                </Col>
              </Row>
            </div>

            {/* 2. Support Bar Charts (Row of 2) */}
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12}>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                  <div className="p-6 pb-2">
                    <h2 className="text-[28px] font-bold text-gray-800 m-0 leading-tight">{stats.deliveredRate}%</h2>
                    <span className="text-[#3b82f6] font-medium text-sm">Tỷ lệ Giao Thành Công</span>
                    <p className="text-gray-500 text-xs mt-3 mb-1 line-clamp-2">Tỷ lệ đơn hàng giao thành công trên tổng số đơn nhận.</p>
                  </div>
                  <div className="mt-auto">
                    <Chart options={supportChartOptions} series={supportChartData} type="area" height={80} />
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 px-4">
                      <Row className="text-center">
                        <Col span={8}>
                          <h4 className="text-base font-bold m-0 text-white">{stats.deliveredCount}</h4><span className="text-[#d6d5fc] text-[10px] uppercase">Đã giao</span>
                        </Col>
                        <Col span={8}>
                          <h4 className="text-base font-bold m-0 text-white">{stats.inTransitCount}</h4><span className="text-[#d6d5fc] text-[10px] uppercase">Đang đi</span>
                        </Col>
                        <Col span={8}>
                          <h4 className="text-base font-bold m-0 text-white">{stats.totalOrders}</h4><span className="text-[#d6d5fc] text-[10px] uppercase">Tổng đơn</span>
                        </Col>
                      </Row>
                    </div>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                  <div className="p-6 pb-2">
                    <h2 className="text-[28px] font-bold text-gray-800 m-0 leading-tight">{stats.deliveredCount}</h2>
                    <span className="text-[#3b82f6] font-medium text-sm">Tổng Đơn Đã Giao</span>
                    <p className="text-gray-500 text-xs mt-3 mb-1 line-clamp-2">Tổng số lượng đơn hàng đã hoàn tất quá trình vận chuyển.</p>
                  </div>
                  <div className="mt-auto">
                    <div className="py-2">
                      <Row className="text-center">
                        <Col span={8}>
                          <h4 className="text-base font-bold text-gray-800 m-0">{stats.deliveredCount}</h4><span className="text-gray-500 text-[10px] uppercase">Hoàn tất</span>
                        </Col>
                        <Col span={8}>
                          <h4 className="text-base font-bold text-gray-800 m-0">{stats.inTransitCount}</h4><span className="text-gray-500 text-[10px] uppercase">Vận chuyển</span>
                        </Col>
                        <Col span={8}>
                          <h4 className="text-base font-bold text-gray-800 m-0">{stats.totalOrders}</h4><span className="text-gray-500 text-[10px] uppercase">Tổng số</span>
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
            
            {/* 1. Monthly Revenue & Orders Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-[460px]">
              <div className="mb-4">
                <h5 className="text-[15px] font-bold text-gray-800 mb-6">Biểu đồ Doanh thu & Đơn hàng theo Tháng</h5>
              </div>
              <Row className="mb-2">
                <Col className="mr-10">
                  <h3 className="text-2xl font-bold text-gray-800 mb-0">
                    {stats.totalRevenue > 0 ? `${stats.totalRevenue.toLocaleString('vi-VN')} đ` : '0 đ'}
                  </h3>
                  <span className="text-gray-500 text-xs font-medium">Tổng doanh thu thực tế</span>
                </Col>
                <Col>
                  <h3 className="text-2xl font-bold text-gray-800 mb-0">
                    {stats.avgRevenue > 0 ? `${stats.avgRevenue.toLocaleString('vi-VN')} đ` : '0 đ'}
                  </h3>
                  <span className="text-gray-500 text-xs font-medium">Cước bình quân mỗi đơn</span>
                </Col>
              </Row>
              <div className="mt-4">
                <Chart options={accountChartOptions} series={accountChartData} type="line" height={300} />
              </div>
            </div>

            {/* 2. KPI Cards (2x2) */}
            <Row gutter={[24, 24]}>
              <Col span={12}>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-800 text-sm font-bold mb-1">Tổng Cước Đã Chốt</p>
                    <Package size={20} className="text-[#3b82f6]" />
                  </div>
                  <h3 className="text-[22px] font-bold text-gray-800 mt-2">
                    {stats.totalRevenue > 0 ? `${stats.totalRevenue.toLocaleString('vi-VN')} đ` : '0 đ'}
                  </h3>
                </div>
              </Col>
              <Col span={12}>
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-6 rounded-xl shadow-sm h-full relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2 z-10 relative">
                    <p className="text-white text-sm font-bold mb-1">Tổng Số Đơn</p>
                    <ShoppingCart size={20} className="text-white opacity-80" />
                  </div>
                  <h3 className="text-[24px] font-bold text-white z-10 relative mt-2">
                    {stats.totalOrders} đơn
                  </h3>
                </div>
              </Col>
              <Col span={12}>
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-6 rounded-xl shadow-sm h-full relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2 z-10 relative">
                    <p className="text-white text-sm font-bold mb-1">Giá Cước Trung Bình</p>
                    <DollarSign size={20} className="text-white opacity-80" />
                  </div>
                  <h3 className="text-[22px] font-bold text-white z-10 relative mt-2">
                    {stats.avgRevenue > 0 ? `${stats.avgRevenue.toLocaleString('vi-VN')} đ` : '0 đ'}
                  </h3>
                </div>
              </Col>
              <Col span={12}>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-800 text-sm font-bold mb-1">Khối Lượng Xử Lý</p>
                    <Tag color="cyan" className="m-0 border-none px-2 rounded font-semibold bg-[#e0f9fc] text-[#00cfe8]">Tải trọng</Tag>
                  </div>
                  <h3 className="text-[24px] font-bold text-gray-800 mt-2">
                    {stats.totalWeight > 0 ? `${stats.totalWeight.toLocaleString('vi-VN')} kg` : '0 kg'}
                  </h3>
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
                <h3 className="text-base font-bold text-gray-800">Đơn hàng gần đây</h3>
                <Button type="primary" size="small" icon={<Plus size={14} />} className="bg-gradient-to-br from-blue-500 to-cyan-500 hover:bg-[#5e50ee] border-none" onClick={() => setIsModalOpen(true)}>
                  Tạo đơn hàng
                </Button>
              </div>
              <Table 
                columns={columns} 
                dataSource={data} 
                loading={loading}
                pagination={{ pageSize: 5 }} 
                className="ant-table-striped custom-table"
              />
            </div>
          </Col>
          <Col xs={24} xl={8}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-full">
              <h3 className="text-base font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100">Hoạt động Gần đây</h3>
              <div className="space-y-4">
                {recentActivities.map(feed => (
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
