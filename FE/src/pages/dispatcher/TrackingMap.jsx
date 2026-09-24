import { useState, useEffect } from 'react';
import { Row, Col, Input, List, Tag, Badge } from 'antd';
import { Search, MapPin, Truck } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const { Search: AntSearch } = Input;

// Mock GPS Data for trucks
const activeTrucks = [
  { id: '29C-123.45', route: 'Nội Bài -> Hữu Nghị', status: 'Đang di chuyển', time: 'Cập nhật 2 phút trước', progress: 45, lat: 21.2187, lng: 105.8042, speed: '45km/h' },
  { id: '29C-678.90', route: 'Yên Phong -> Nội Bài', status: 'Dừng nghỉ', time: 'Cập nhật 15 phút trước', progress: 80, lat: 21.1963, lng: 106.0125, speed: '0km/h' },
  { id: '15C-333.44', route: 'Gia Lâm -> Hải Phòng', status: 'Sắp đến', time: 'Cập nhật 1 phút trước', progress: 95, lat: 20.8449, lng: 106.6881, speed: '60km/h' },
  { id: '51C-888.88', route: 'Hải Phòng -> Hà Nội', status: 'Đang bốc dỡ', time: 'Cập nhật 5 phút trước', progress: 10, lat: 21.0285, lng: 105.8542, speed: '0km/h' },
];

// Custom Truck Marker Icon using DivIcon
const createCustomIcon = (truck) => {
  const isMoving = truck.status === 'Đang di chuyển';
  const colorClass = isMoving ? 'bg-green-500' : truck.status === 'Dừng nghỉ' ? 'bg-orange-500' : truck.status === 'Sắp đến' ? 'bg-blue-500' : 'bg-red-500';
  
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

  return (
    <div className="p-0 h-full flex flex-col md:flex-row overflow-hidden relative">
      
      {/* Sidebar - Danh sách Xe */}
      <div className="w-full md:w-80 bg-white border-r border-gray-200 h-[30%] md:h-full flex flex-col flex-shrink-0 z-[1000] shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Theo dõi trực tuyến</h2>
          <Input placeholder="Tìm biển số xe, mã đơn..." prefix={<Search size={16} className="text-gray-400" />} className="w-full" />
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar p-2">
          <List
            itemLayout="horizontal"
            dataSource={activeTrucks}
            renderItem={item => (
              <List.Item 
                className="p-3 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors border-b-0 mb-1"
                onClick={() => setMapCenter([item.lat, item.lng])}
              >
                <List.Item.Meta
                  avatar={<div className="w-10 h-10 rounded-full bg-[#e0f9fc] text-[#00cfe8] flex items-center justify-center"><Truck size={20} /></div>}
                  title={<div className="flex justify-between items-center"><span className="font-bold text-gray-800">{item.id}</span> <Badge status={item.status === 'Đang di chuyển' ? 'success' : item.status === 'Dừng nghỉ' ? 'warning' : 'processing'} /></div>}
                  description={
                    <div className="mt-1">
                      <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><MapPin size={12} /> {item.route}</p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div className="bg-[#7367f0] h-1.5 rounded-full" style={{ width: `${item.progress}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-gray-400">{item.time}</span>
                        <span className="text-[10px] font-semibold text-[#7367f0]">{item.progress}%</span>
                      </div>
                    </div>
                  }
                />
              </List.Item>
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

    </div>
  );
};

export default TrackingMap;
