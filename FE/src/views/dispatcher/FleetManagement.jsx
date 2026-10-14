"use client";
import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Input, Row, Col, Card, Select, Progress, Tabs, Button, message } from 'antd';
import { Search, Truck, User, CheckCircle2, AlertCircle, Clock, MapPin, Gauge, RefreshCw } from 'lucide-react';
import { dispatcherApi } from '../../api/dispatcherApi';

const { Option } = Select;

const vehicleStatusMap = {
  'AVAILABLE': { color: 'green', text: 'Sẵn sàng hoạt động' },
  'ON_TRIP': { color: 'blue', text: 'Đang chạy chuyến' },
  'IN_TRANSIT': { color: 'blue', text: 'Đang chạy chuyến' },
  'MAINTENANCE': { color: 'red', text: 'Đang bảo dưỡng / sửa chữa' },
  'INACTIVE': { color: 'default', text: 'Tạm ngưng hoạt động' }
};

const driverStatusMap = {
  'AVAILABLE': { color: 'green', text: 'Sẵn sàng nhận chuyến' },
  'ACTIVE': { color: 'green', text: 'Sẵn sàng nhận chuyến' },
  'ON_DUTY': { color: 'blue', text: 'Đang chạy trên đường' },
  'ON_TRIP': { color: 'blue', text: 'Đang chạy trên đường' },
  'RESTING': { color: 'orange', text: 'Đang nghỉ ngơi (gần hết ca)' }
};

export default function FleetManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleFilterStatus, setVehicleFilterStatus] = useState('ALL');
  const [driverSearch, setDriverSearch] = useState('');
  const [driverFilterStatus, setDriverFilterStatus] = useState('ALL');

  const fetchFleetData = useCallback(async () => {
    try {
      setLoading(true);
      const [trucksData, driversData] = await Promise.all([
        dispatcherApi.getTrucks(),
        dispatcherApi.getDrivers()
      ]);
      setVehicles(trucksData || []);
      setDrivers(driversData || []);
    } catch (err) {
      console.error('fetchFleetData error:', err);
      message.error('Không thể kết nối đến máy chủ để tải dữ liệu đội xe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadInitialFleetData = async () => {
      try {
        const [trucksData, driversData] = await Promise.all([
          dispatcherApi.getTrucks(),
          dispatcherApi.getDrivers()
        ]);
        if (active) {
          setVehicles(trucksData || []);
          setDrivers(driversData || []);
        }
      } catch (err) {
        if (active) {
          console.error('fetchFleetData error:', err);
          message.error('Không thể kết nối đến máy chủ để tải dữ liệu đội xe');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInitialFleetData();

    return () => {
      active = false;
    };
  }, []);

  // Lọc phương tiện
  const filteredVehicles = vehicles.filter(v => {
    const matchSearch = vehicleSearch === '' ||
      (v.plate && v.plate.toLowerCase().includes(vehicleSearch.toLowerCase())) ||
      (v.model && v.model.toLowerCase().includes(vehicleSearch.toLowerCase())) ||
      (v.assigned_driver && v.assigned_driver.toLowerCase().includes(vehicleSearch.toLowerCase())) ||
      (v.location && v.location.toLowerCase().includes(vehicleSearch.toLowerCase()));
    const matchStatus = vehicleFilterStatus === 'ALL' || v.status === vehicleFilterStatus;
    return matchSearch && matchStatus;
  });

  // Lọc tài xế
  const filteredDrivers = drivers.filter(d => {
    const matchSearch = driverSearch === '' ||
      (d.name && d.name.toLowerCase().includes(driverSearch.toLowerCase())) ||
      (d.phone && d.phone.includes(driverSearch)) ||
      (d.assigned_truck && d.assigned_truck.toLowerCase().includes(driverSearch.toLowerCase()));
    const matchStatus = driverFilterStatus === 'ALL' || d.status === driverFilterStatus;
    return matchSearch && matchStatus;
  });

  // Bảng Cột Phương tiện
  const vehicleColumns = [
    {
      title: 'Biển số & Dòng xe',
      key: 'plate_model',
      width: '22%',
      render: (_, r) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-300 font-mono text-xs">
              {r.plate}
            </span>
            <span className="text-[11px] text-gray-500 font-medium">({r.category})</span>
          </div>
          <div className="font-semibold text-gray-800 text-xs mt-1">{r.model}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{r.cargo_type}</div>
        </div>
      )
    },
    {
      title: 'Tải trọng & Thể tích',
      key: 'capacity',
      width: '18%',
      render: (_, r) => (
        <div className="text-xs space-y-0.5">
          <div>Tải trọng: <b className="text-indigo-600 font-mono">{(r.payload_kg || 0).toLocaleString()} kg</b></div>
          <div className="text-gray-500">Thể tích thùng: <b className="text-gray-700 font-mono">{r.volume_m3 || 9.5} m³</b></div>
        </div>
      )
    },
    {
      title: 'Trang bị kỹ thuật',
      dataIndex: 'equipment',
      key: 'equipment',
      width: '20%',
      render: text => <span className="text-xs text-gray-600 leading-snug block">{text || 'GPS, Giám sát hành trình'}</span>
    },
    {
      title: 'Vị trí hiện tại',
      dataIndex: 'location',
      key: 'location',
      width: '18%',
      render: text => (
        <div className="text-xs text-gray-700 flex items-start gap-1">
          <MapPin size={13} className="text-blue-500 shrink-0 mt-0.5" />
          <span className="leading-snug">{text || 'Depot Cảng HKQT Nội Bài'}</span>
        </div>
      )
    },
    {
      title: 'Hạn kiểm định & Bảo hiểm',
      key: 'docs_exp',
      width: '12%',
      render: (_, r) => (
        <div className="text-[11px] font-mono space-y-0.5">
          <div className="text-gray-600">Đăng kiểm: <b>{r.registration_exp}</b></div>
          <div className="text-gray-500">Bảo hiểm: <b>{r.insurance_exp}</b></div>
        </div>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: '10%',
      render: status => {
        const item = vehicleStatusMap[status] || { color: 'default', text: status };
        return (
          <Tag color={item.color} className="font-semibold text-xs px-2 py-0.5 rounded-md whitespace-nowrap">
            {item.text}
          </Tag>
        );
      }
    }
  ];

  // Bảng Cột Tài xế
  const driverColumns = [
    {
      title: 'Họ tên & Số điện thoại',
      key: 'name_phone',
      width: '22%',
      render: (_, r) => (
        <div>
          <div className="flex items-center gap-1.5 font-bold text-gray-800 text-xs">
            <User size={13} className="text-[#7367f0]" />
            <span>{r.name}</span>
          </div>
          <div className="text-xs text-gray-500 font-mono mt-0.5">{r.phone}</div>
          <div className="text-[11px] text-gray-400 font-mono">CCCD / Mã: {r.id_card}</div>
        </div>
      )
    },
    {
      title: 'Hạng GPLX & Kinh nghiệm',
      key: 'license_exp',
      width: '18%',
      render: (_, r) => (
        <div className="text-xs space-y-0.5">
          <Tag color="cyan" className="font-bold text-[11px]">{r.license_type}</Tag>
          <div className="text-gray-500 text-[11px] mt-1">{r.experience_years}</div>
        </div>
      )
    },
    {
      title: 'Thời gian lái xe trong ca',
      key: 'shift_hours',
      width: '24%',
      render: (_, r) => {
        const shiftToday = Number(r.shift_hours_today) || 2.0;
        const maxShift = Number(r.max_shift_hours) || 8.0;
        const percent = Math.min(100, Math.round((shiftToday / maxShift) * 100));
        const isNearLimit = percent >= 85;
        return (
          <div className="text-xs space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-500 flex items-center gap-1">
                <Clock size={11} className={isNearLimit ? "text-amber-500" : "text-gray-400"} />
                Đã lái: <b className="font-mono text-gray-800">{shiftToday}h</b> / {maxShift}h
              </span>
              <span className={`font-mono font-bold ${isNearLimit ? 'text-amber-600' : 'text-indigo-600'}`}>
                {percent}%
              </span>
            </div>
            <Progress 
              percent={percent} 
              size="small" 
              status={isNearLimit ? 'exception' : 'active'}
              strokeColor={isNearLimit ? '#fa8c16' : '#7367f0'} 
            />
            {isNearLimit && (
              <span className="text-[10px] text-amber-600 font-medium block">
                Cảnh báo: Cần bố trí nghỉ ngơi hoặc đổi tài xế phụ
              </span>
            )}
          </div>
        );
      }
    },
    {
      title: 'Xe phụ trách & Chuyến hiện tại',
      key: 'assigned',
      width: '20%',
      render: (_, r) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1">
            <Truck size={12} className="text-gray-400" />
            <span className="font-mono font-semibold text-gray-800">{r.assigned_truck || 'Chưa gán xe cố định'}</span>
          </div>
          {r.current_trip ? (
            <div className="text-indigo-600 font-mono text-[11px] font-medium">
              Chuyến: {r.current_trip}
            </div>
          ) : (
            <div className="text-gray-400 text-[11px]">Chưa gán chuyến</div>
          )}
        </div>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: '16%',
      render: status => {
        const item = driverStatusMap[status] || { color: 'default', text: status };
        return (
          <Tag color={item.color} className="font-semibold text-xs px-2 py-0.5 rounded-md whitespace-nowrap">
            {item.text}
          </Tag>
        );
      }
    }
  ];

  return (
    <div className="p-6 space-y-6 custom-scrollbar">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2.5">
              <Truck size={24} className="text-[#7367f0]" />
              Tình trạng Đội xe & Tài xế
            </h1>
            <p className="text-gray-500 text-xs mt-1">
              Dữ liệu phương tiện và tài xế kết nối trực tiếp cơ sở dữ liệu Supabase.
            </p>
          </div>
          <Button 
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />} 
            onClick={fetchFleetData}
            loading={loading}
            className="rounded-lg"
          >
            Làm mới
          </Button>
        </div>

        {/* Overview KPI Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
              <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                <Truck size={14} className="text-indigo-600" /> Tổng số xe
              </div>
              <div className="text-2xl font-bold text-gray-800 mt-1 font-mono">
                {vehicles.length} xe
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
              <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" /> Xe sẵn sàng hoạt động
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                {vehicles.filter(v => v.status === 'AVAILABLE').length} xe
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
              <div className="text-xs text-blue-600 font-medium flex items-center gap-1.5">
                <Gauge size={14} className="text-blue-600" /> Xe đang chạy chuyến
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1 font-mono">
                {vehicles.filter(v => v.status === 'ON_TRIP' || v.status === 'IN_TRANSIT').length} xe
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="rounded-xl border-gray-100 shadow-xs" styles={{ body: { padding: '16px' } }}>
              <div className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                <AlertCircle size={14} className="text-red-500" /> Xe bảo dưỡng / sửa chữa
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1 font-mono">
                {vehicles.filter(v => v.status === 'MAINTENANCE').length} xe
              </div>
            </Card>
          </Col>
        </Row>

        {/* Nội dung dạng Tabs */}
        <Tabs
          defaultActiveKey="vehicles"
          size="large"
          className="custom-tabs"
          items={[
            {
              key: 'vehicles',
              label: (
                <span className="flex items-center gap-2 font-semibold text-sm">
                  <Truck size={16} className="text-[#7367f0]" />
                  Danh mục Phương tiện ({vehicles.length})
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <Card className="shadow-xs border-gray-100 rounded-xl" styles={{ body: { padding: '14px' } }}>
                    <Row gutter={[12, 12]} align="middle">
                      <Col xs={24} sm={14} md={12}>
                        <Input
                          placeholder="Tìm theo biển số, dòng xe, tài xế phụ trách, vị trí..."
                          prefix={<Search size={15} className="text-gray-400" />}
                          value={vehicleSearch}
                          onChange={e => setVehicleSearch(e.target.value)}
                          allowClear
                          className="rounded-lg text-xs"
                        />
                      </Col>
                      <Col xs={12} sm={10} md={6}>
                        <Select
                          className="w-full text-xs"
                          value={vehicleFilterStatus}
                          onChange={setVehicleFilterStatus}
                        >
                          <Option value="ALL">Tất cả trạng thái xe</Option>
                          <Option value="AVAILABLE">Sẵn sàng hoạt động</Option>
                          <Option value="ON_TRIP">Đang chạy chuyến</Option>
                          <Option value="MAINTENANCE">Đang bảo dưỡng / sửa chữa</Option>
                        </Select>
                      </Col>
                    </Row>
                  </Card>

                  <Card className="shadow-xs border-gray-100 rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
                    <Table
                      columns={vehicleColumns}
                      dataSource={filteredVehicles}
                      rowKey="key"
                      loading={loading}
                      pagination={{ pageSize: 8 }}
                      size="middle"
                    />
                  </Card>
                </div>
              )
            },
            {
              key: 'drivers',
              label: (
                <span className="flex items-center gap-2 font-semibold text-sm">
                  <User size={16} className="text-blue-600" />
                  Danh mục Tài xế ({drivers.length})
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <Card className="shadow-xs border-gray-100 rounded-xl" styles={{ body: { padding: '14px' } }}>
                    <Row gutter={[12, 12]} align="middle">
                      <Col xs={24} sm={14} md={12}>
                        <Input
                          placeholder="Tìm theo họ tên, số điện thoại, biển số xe phụ trách..."
                          prefix={<Search size={15} className="text-gray-400" />}
                          value={driverSearch}
                          onChange={e => setDriverSearch(e.target.value)}
                          allowClear
                          className="rounded-lg text-xs"
                        />
                      </Col>
                      <Col xs={12} sm={10} md={6}>
                        <Select
                          className="w-full text-xs"
                          value={driverFilterStatus}
                          onChange={setDriverFilterStatus}
                        >
                          <Option value="ALL">Tất cả trạng thái tài xế</Option>
                          <Option value="AVAILABLE">Sẵn sàng nhận chuyến</Option>
                          <Option value="ON_DUTY">Đang chạy trên đường</Option>
                          <Option value="RESTING">Đang nghỉ ngơi</Option>
                        </Select>
                      </Col>
                    </Row>
                  </Card>

                  <Card className="shadow-xs border-gray-100 rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
                    <Table
                      columns={driverColumns}
                      dataSource={filteredDrivers}
                      rowKey="key"
                      loading={loading}
                      pagination={{ pageSize: 8 }}
                      size="middle"
                    />
                  </Card>
                </div>
              )
            }
          ]}
        />

      </div>
    </div>
  );
}
