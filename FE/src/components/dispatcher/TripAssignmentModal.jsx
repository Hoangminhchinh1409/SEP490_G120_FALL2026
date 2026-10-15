import { useState, useEffect } from 'react';
import { Modal, Radio, Select, Button, Alert, Tag, Input, message } from 'antd';
import { Truck, FileText, Box } from 'lucide-react';
import { dispatcherApi } from '../../api/dispatcherApi';

const { Option } = Select;

const TripAssignmentModal = ({ open, order, onCancel, onAssignSuccess }) => {
  const [allocationType, setAllocationType] = useState('INTERNAL');
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedDriver1, setSelectedDriver1] = useState('');
  const [selectedDriver2, setSelectedDriver2] = useState('');
  const [isTwoDrivers, setIsTwoDrivers] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendorTrackingCode, setVendorTrackingCode] = useState('');
  const [showLoadPlan3D, setShowLoadPlan3D] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const [loadingResources, setLoadingResources] = useState(true);

  if (open && !prevOpen) {
    setPrevOpen(true);
    setLoadingResources(true);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    let isSubscribed = true;

    Promise.all([
      dispatcherApi.getTrucks(),
      dispatcherApi.getDrivers(),
      dispatcherApi.getVendors()
    ])
      .then(([trucksData, driversData, vendorsData]) => {
        if (!isSubscribed) return;
        setTrucks(trucksData || []);
        setDrivers(driversData || []);
        setVendors(vendorsData || []);

        const availableTruck = (trucksData || []).find(t => t.status === 'AVAILABLE') || trucksData?.[0];
        if (availableTruck) setSelectedTruck(availableTruck.plate);

        const availableDriver = (driversData || []).find(d => d.status === 'AVAILABLE') || driversData?.[0];
        if (availableDriver) setSelectedDriver1(availableDriver.id.toString());

        if (driversData?.length > 1) {
          setSelectedDriver2(driversData[1].id.toString());
        }

        if (vendorsData?.length > 0) {
          setSelectedVendor(vendorsData[0].id.toString());
        }
      })
      .catch(err => {
        console.error('TripAssignmentModal load resources error:', err);
      })
      .finally(() => {
        if (isSubscribed) setLoadingResources(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [open]);

  if (!order) return null;

  const currentWeight = order.chargeable || order.weight || 1500;
  const tripEstimatedHours = 4.5;

  const handleConfirmAssignment = () => {
    if (allocationType === 'INTERNAL') {
      if (!selectedTruck || !selectedDriver1) {
        message.error('Vui lòng chọn xe và tài xế chính!');
        return;
      }
      const truckObj = trucks.find(t => t.plate === selectedTruck);
      if (truckObj && currentWeight > truckObj.payload_kg * 1.5) {
        message.warning('Cảnh báo quá tải trọng xe!');
      }

      const driver1Obj = drivers.find(d => d.id.toString() === selectedDriver1.toString());
      const driver2Obj = isTwoDrivers ? drivers.find(d => d.id.toString() === selectedDriver2.toString()) : null;

      // Sinh mã vận đơn thống nhất của hệ thống: NEX - XXXXXX
      const generatedWaybill = `NEX-${Math.floor(100000 + Math.random() * 900000)}`;

      onAssignSuccess({
        ...order,
        status: 'ASSIGNED',
        allocationType: 'INTERNAL',
        truck: selectedTruck,
        driver1: driver1Obj?.name || 'Tài xế nội bộ',
        driver2: driver2Obj?.name || null,
        waybill_no: generatedWaybill,
        waybill_version: 1
      });
    } else {
      if (!vendorTrackingCode.trim()) {
        message.error('Vui lòng nhập mã vận đơn của nhà xe đối tác!');
        return;
      }
      const vendorObj = vendors.find(v => v.id.toString() === selectedVendor.toString());
      onAssignSuccess({
        ...order,
        status: 'HANDED_OVER_VENDOR',
        allocationType: 'VENDOR',
        vendor: vendorObj?.name || 'Đối tác vận tải',
        vendor_tracking_code: vendorTrackingCode.trim(),
        waybill_no: vendorTrackingCode.trim()
      });
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Truck size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Gán xe & Điều phối chuyến</h3>
            <p className="text-xs text-gray-500 font-normal">Mã đơn: <b className="text-indigo-600 font-mono">{order.order_id}</b> | Khách hàng: {order.customer || order.customer_name}</p>
          </div>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={850}
      footer={[
        <Button key="back" onClick={onCancel}>Hủy</Button>,
        <Button 
          key="3d" 
          icon={<Box size={14} />} 
          className="border-indigo-400 text-indigo-600"
          onClick={() => setShowLoadPlan3D(!showLoadPlan3D)}
        >
          {showLoadPlan3D ? 'Ẩn mô hình xếp hàng' : 'Mô hình xếp hàng'}
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          className="bg-[#7367f0] hover:bg-[#5e50ee]" 
          onClick={handleConfirmAssignment}
          loading={loadingResources}
        >
          Xác nhận gán chuyến
        </Button>
      ]}
    >
      <div className="py-2 space-y-4">
        {/* Lựa chọn Hình thức Gán */}
        <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase">Phương thức vận chuyển:</span>
          <Radio.Group value={allocationType} onChange={e => setAllocationType(e.target.value)}>
            <Radio.Button value="INTERNAL" className="font-semibold text-xs">
              Đội xe nội bộ ({trucks.length} xe)
            </Radio.Button>
            <Radio.Button value="VENDOR" className="font-semibold text-xs">
              Nhà xe đối tác ({vendors.length} đối tác)
            </Radio.Button>
          </Radio.Group>
        </div>

        {/* Trực quan hóa Mô hình Xếp hàng */}
        {showLoadPlan3D && (
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Box size={16} /> Mô phỏng thùng xe
              </span>
              <Tag color="cyan">Sắp xếp theo thứ tự dỡ</Tag>
            </div>
            
            <div className="h-32 border-2 border-dashed border-indigo-400/50 rounded-lg p-2 flex items-center justify-center bg-slate-800/80 relative overflow-hidden">
              <div className="absolute top-2 left-2 text-[10px] text-gray-400 font-mono">ĐẦU XE</div>
              <div className="absolute top-2 right-2 text-[10px] text-gray-400 font-mono">CỬA THÙNG</div>
              
              <div className="grid grid-cols-6 gap-2 w-full px-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gradient-to-t from-indigo-600 to-indigo-500 rounded border border-indigo-300 flex flex-col items-center justify-center text-center p-1">
                    <span className="text-[10px] font-bold">Kiện #{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-gray-300">
              <span>Trọng lượng hàng: <b>{currentWeight.toLocaleString()} kg</b></span>
              <span>Xếp chồng: <b>Cho phép</b></span>
              <span>Dỡ hàng: <b>Cửa sau</b></span>
            </div>
          </div>
        )}

        {allocationType === 'INTERNAL' ? (
          <div className="space-y-4">
            <Alert
              type="info"
              showIcon
              title={
                <span className="font-bold text-xs">
                  Hệ thống đề xuất xe nội bộ khả dụng phù hợp với tải trọng và lộ trình
                </span>
              }
              className="text-xs"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Chọn Xe Nội Bộ */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <label className="text-xs font-bold text-gray-700 block">Chọn xe tải khả dụng:</label>
                <Select 
                  className="w-full text-xs" 
                  value={selectedTruck} 
                  onChange={setSelectedTruck}
                  loading={loadingResources}
                >
                  {trucks.map(t => (
                    <Option key={t.plate} value={t.plate} disabled={t.status === 'MAINTENANCE' || t.status === 'ON_TRIP'}>
                      <div className="flex justify-between items-center text-xs">
                        <b>{t.plate}</b> ({t.model}) - {t.payload_kg} kg
                        <Tag color={t.status === 'AVAILABLE' ? 'green' : 'red'}>{t.status}</Tag>
                      </div>
                    </Option>
                  ))}
                </Select>
              </div>

              {/* Số lượng Tài xế */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700">Số lượng tài xế:</label>
                  <Radio.Group size="small" value={isTwoDrivers} onChange={e => setIsTwoDrivers(e.target.value)}>
                    <Radio.Button value={false}>1 Tài xế</Radio.Button>
                    <Radio.Button value={true}>2 Tài xế</Radio.Button>
                  </Radio.Group>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-gray-500 block mb-0.5">Tài xế chính:</span>
                    <Select 
                      className="w-full text-xs" 
                      value={selectedDriver1} 
                      onChange={setSelectedDriver1}
                      loading={loadingResources}
                    >
                      {drivers.map(d => (
                        <Option key={d.id} value={d.id.toString()}>
                          {d.name} - {d.phone} ({d.license_type})
                        </Option>
                      ))}
                    </Select>
                  </div>

                  {isTwoDrivers && (
                    <div>
                      <span className="text-[11px] text-gray-500 block mb-0.5">Tài xế phụ:</span>
                      <Select 
                        className="w-full text-xs" 
                        value={selectedDriver2} 
                        onChange={setSelectedDriver2}
                        loading={loadingResources}
                      >
                        {drivers.filter(d => d.id.toString() !== selectedDriver1.toString()).map(d => (
                          <Option key={d.id} value={d.id.toString()}>
                            {d.name} - {d.phone} ({d.license_type})
                          </Option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Giấy vận tải */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <div>
                  <span className="font-bold text-blue-900">Mã vận đơn hệ thống (NEX - XXXXXX):</span>
                  <div className="text-gray-500">Mã vận đơn thống nhất được tự động sinh sau khi phân bổ xe nội bộ</div>
                </div>
              </div>
              <Tag color="processing" className="font-mono font-semibold">Tự động sinh: NEX-XXXXXX</Tag>
            </div>
          </div>
        ) : (
          /* Chuyển giao Vendor */
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Đối tác vận tải:</label>
                <Select 
                  className="w-full text-xs" 
                  value={selectedVendor} 
                  onChange={setSelectedVendor}
                  loading={loadingResources}
                >
                  {vendors.map(v => (
                    <Option key={v.id} value={v.id.toString()}>
                      {v.name} ({v.truck_types || 'Đa dạng tải trọng'})
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Mã vận đơn đối tác:</label>
                <Input 
                  placeholder="Nhập mã vận đơn do đối tác cung cấp..." 
                  value={vendorTrackingCode}
                  onChange={e => setVendorTrackingCode(e.target.value)}
                  className="font-mono font-semibold text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TripAssignmentModal;