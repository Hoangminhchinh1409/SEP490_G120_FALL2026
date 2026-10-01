import { useState, useEffect } from 'react';
import { Input, Listy, Badge, Modal, Form, Select, Button, message } from 'antd';
import { Search, MapPin, Truck } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';



// Mock GPS Data for trucks
const activeTrucks = [
  { id: '29C-123.45', route: 'Nội Bài -> Hữu Nghị', status: 'Đang di chuyển', time: 'Cập nhật 2 phút trước', progress: 45, lat: 21.2187, lng: 105.8042, speed: '45km/h' },
  { id: '29C-678.90', route: 'Yên Phong -> Nội Bài', status: 'Sự cố (Hỏng xe)', time: 'Cập nhật 15 phút trước', progress: 80, lat: 21.1963, lng: 106.0125, speed: '0km/h' },
  { id: '15C-333.44', route: 'Gia Lâm -> Hải Phòng', status: 'Sắp đến', time: 'Cập nhật 1 phút trước', progress: 95, lat: 20.8449, lng: 106.6881, speed: '60km/h' },
  { id: '51C-888.88', route: 'Hải Phòng -> Hà Nội', status: 'Đang bốc dỡ', time: 'Cập nhật 5 phút trước', progress: 10, lat: 21.0285, lng: 105.8542, speed: '0km/h' },
];

// Custom Truck Marker Icon using DivIcon
const createCustomIcon = (truck) => {
  const isMoving = truck.status === 'Đang di chuyển';
  const colorClass = isMoving ? 'bg-green-500' : truck.status.includes('Sự cố') ? 'bg-red-600' : truck.status === 'Sắp đến' ? 'bg-blue-500' : 'bg-orange-500';
  
  return L.divIcon({
    className: 'custom-truck-marker',
    html: `
      <div class="relative flex flex-col items-center">
        <div class="w-4 h-4 ${colorClass} rounded-full border-2 border-white shadow-md z-10 ${isMoving ? 'animate-pulse' : ''}"></div>
        <div class="absolute top-5 bg-white px-2 py-0.5 rounded shadow-lg border border-gray-100 whitespace-nowrap text-[10px] font-bold text-gray-700 pointer-events-none">
          ${truck.id}
        </div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
};

// Map Controller to change view dynamically when clicking a truck
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 13, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

const TrackingMap = () => {
  const [mapCenter, setMapCenter] = useState([21.0285, 105.8542]); // Default: Hanoi
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [form] = Form.useForm();

  const handleResolveIncident = () => {
    form.validateFields().then(values => {
      message.success(`Đã xử lý sự cố cho xe ${selectedTruck.id}: ${values.resolution}`);
      setIncidentModalOpen(false);
    });
  };

  return (
    <div className="p-0 h-full flex flex-col md:flex-row overflow-hidden relative">
      
      {/* Sidebar - Danh sách Xe */}
      <div className="w-full md:w-80 bg-white border-r border-gray-200 h-[30%] md:h-full flex flex-col flex-shrink-0 z-[1000] shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Theo dõi trực tuyến</h2>
          <Input placeholder="Tìm biển số xe, mã đơn..." prefix={<Search size={16} className="text-gray-400" />} className="w-full" />
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar p-2">
          <Listy
            items={activeTrucks}
            rowKey="id"
            itemRender={(item) => (
              <div
                key={item.id}
                className="p-3 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors border-b-0 mb-1 flex flex-col items-start gap-1 w-full"
                onClick={() => setMapCenter([item.lat, item.lng])}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="w-10 h-10 rounded-full bg-[#e0f9fc] text-[#00cfe8] flex items-center justify-center flex-shrink-0">
                    <Truck size={20} />
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex justify-between items-center w-full">
                      <span className="font-bold text-gray-800">{item.id}</span>
                      <Badge status={item.status === 'Đang di chuyển' ? 'success' : item.status.includes('Sự cố') ? 'error' : 'processing'} text={item.status} className="text-xs" />
                    </div>
                    <div className="mt-1">
                      <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><MapPin size={12} /> {item.route}</p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div className={`h-1.5 rounded-full ${item.status.includes('Sự cố') ? 'bg-red-500' : 'bg-[#7367f0]'}`} style={{ width: `${item.progress}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-gray-400">{item.time}</span>
                        <span className="text-[10px] font-semibold text-[#7367f0]">{item.progress}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                {item.status.includes('Sự cố') && (
                  <Button 
                    size="small" 
                    danger 
                    className="mt-2 w-full"
                    onClick={(e) => { e.stopPropagation(); setSelectedTruck(item); setIncidentModalOpen(true); }}
                  >
                    Xử lý Sự cố
                  </Button>
                )}
              </div>
            )}
          />
        </div>
      </div>

      {/* Leaflet Map Integration */}
      <div className="flex-1 h-[70%] md:h-full relative z-[1]">
        <MapContainer center={mapCenter} zoom={9} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; Google Maps'
            url="https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}"
          />
          
          <MapController center={mapCenter} />

          {activeTrucks.map((truck) => (
            <Marker key={truck.id} position={[truck.lat, truck.lng]} icon={createCustomIcon(truck)}>
              <Popup className="custom-popup">
                <div className="font-sans">
                  <h3 className="font-bold text-gray-800 text-sm mb-1">{truck.id}</h3>
                  <p className="text-xs text-gray-600 mb-1"><b>Tuyến:</b> {truck.route}</p>
                  <p className="text-xs text-gray-600 mb-1"><b>Tốc độ:</b> <span className="text-green-600 font-semibold">{truck.speed}</span></p>
                  <p className="text-xs text-gray-600"><b>Trạng thái:</b> {truck.status}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <Modal
        title={`Xu ly Su co - Xe ${selectedTruck?.id}`}
        open={incidentModalOpen}
        onCancel={() => setIncidentModalOpen(false)}
        onOk={handleResolveIncident}
      >
        <Form form={form} layout="vertical">
          <p className="mb-4 text-red-600">Sự cố: {selectedTruck?.status}</p>
          <Form.Item name="resolution" label="Phương án xử lý" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="MARK_RESOLVED">Đánh dấu Đã giải quyết (Mark Resolved)</Select.Option>
              <Select.Option value="REPLACEMENT_TRUCK">Điều xe thay thế (Dispatch Replacement Truck)</Select.Option>
              <Select.Option value="ESCALATE">Chuyển sự cố lên Quản lý (Escalate to Manager)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.resolution !== currentValues.resolution}>
            {({ getFieldValue }) =>
              getFieldValue('resolution') === 'REPLACEMENT_TRUCK' ? (
                <Form.Item name="new_truck" label="Chọn xe thay thế" rules={[{ required: true }]}>
                  <Select placeholder="Chọn xe rảnh...">
                    <Select.Option value="T3">29C-999.99 (Thaco 1.25T)</Select.Option>
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};

export default TrackingMap;
