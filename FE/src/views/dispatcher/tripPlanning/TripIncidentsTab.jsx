import React, { useState } from 'react';
import { Card, Table, Tag, Button, Modal, Select, Input, message } from 'antd';
import { AlertTriangle, Truck, PlusCircle, Eye } from 'lucide-react';

const { Option } = Select;

export default function TripIncidentsTab({
  incidents,
  trips = [],
  setActiveIncidentModal,
  onReportIncident,
  isReadOnly = false
}) {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedTripCode, setSelectedTripCode] = useState('');
  const [incidentType, setIncidentType] = useState('BREAKDOWN');
  const [incidentDesc, setIncidentDesc] = useState('');

  const activeTrips = (trips || []).filter(t => t.status === 'IN_TRANSIT');

  const handleOpenReport = () => {
    const defaultTrip = activeTrips[0]?.id || trips[0]?.id || 'TRIP-9993';
    setSelectedTripCode(defaultTrip);
    setIncidentType('BREAKDOWN');
    setIncidentDesc('Xe gặp sự cố kỹ thuật trên cao tốc Nội Bài - Bắc Ninh, đề xuất điều xe cứu hộ chuyển tải.');
    setReportModalOpen(true);
  };

  const handleConfirmReport = async () => {
    if (!selectedTripCode) {
      message.error('Vui lòng chọn chuyến xe gặp sự cố!');
      return;
    }
    if (!incidentDesc.trim()) {
      message.error('Vui lòng nhập mô tả hiện trường sự cố!');
      return;
    }
    await onReportIncident?.({
      trip_id: selectedTripCode,
      type: incidentType,
      description: incidentDesc.trim()
    });
    setReportModalOpen(false);
  };

  const incidentColumns = [
    {
      title: 'Mã sự cố & Thời gian',
      key: 'id_time',
      width: '18%',
      render: (_, r) => (
        <div>
          <span className="font-mono font-bold text-red-600 text-xs">{r.id}</span>
          <div className="text-[11px] text-gray-500 mt-0.5">Báo cáo lúc: <b className="font-mono">{r.reported_at}</b></div>
          <Tag color="error" className="font-bold text-[10px] mt-1">{r.severity === 'HIGH' ? 'MỨC ĐỘ CAO' : 'TRUNG BÌNH'}</Tag>
        </div>
      )
    },
    {
      title: 'Chuyến xe & Phương tiện',
      key: 'trip_vehicle',
      width: '24%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="font-bold text-[#7367f0] font-mono">{r.trip_code}</div>
          <div className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1">
            <Truck size={13} className="text-gray-500" />
            <span className="font-mono">{r.truck}</span>
          </div>
          <div className="text-gray-500 text-[11px]">Tài xế: <b>{r.driver}</b></div>
        </div>
      )
    },
    {
      title: 'Loại sự cố & Chi tiết hiện trường',
      key: 'type_desc',
      width: '32%',
      render: (_, r) => (
        <div className="text-xs">
          <div className="font-bold text-gray-800 flex items-center gap-1">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <span>{r.type}</span>
          </div>
          <div className="text-gray-600 mt-1 line-clamp-2 text-[11px]">{r.description}</div>
          <div className="text-gray-400 text-[10px] mt-0.5">Vị trí: {r.location}</div>
        </div>
      )
    },
    {
      title: 'Trạng thái & Xử lý',
      key: 'status_action',
      width: '26%',
      render: (_, r) => (
        <div className="text-xs space-y-1.5">
          <div>
            <Tag
              color={r.status === 'RESOLVED' ? 'green' : r.status === 'ESCALATED' ? 'orange' : 'red'}
              className="font-bold text-xs py-0.5 px-2"
            >
              {r.status === 'RESOLVED'
                ? 'ĐÃ XỬ LÝ / ĐỔI XE'
                : r.status === 'ESCALATED'
                  ? 'ĐÃ CHUYỂN QUẢN LÝ'
                  : 'CHỜ ĐIỀU PHỐI XỬ LÝ'}
            </Tag>
          </div>
          {r.status !== 'RESOLVED' ? (
            isReadOnly ? (
              <Button
                size="small"
                className="text-xs font-semibold text-gray-700 bg-white"
                icon={<Eye size={13} />}
                onClick={() => setActiveIncidentModal(r)}
              >
                Xem chi tiết sự cố
              </Button>
            ) : (
              <Button
                type="primary"
                danger
                size="small"
                className="font-bold text-xs shadow-sm"
                icon={<AlertTriangle size={13} />}
                onClick={() => setActiveIncidentModal(r)}
              >
                Phát lệnh Đổi xe &amp; Cấp lại Vận đơn
              </Button>
            )
          ) : (
            <Button
              size="small"
              className="text-xs text-gray-600"
              icon={<Eye size={13} />}
              onClick={() => setActiveIncidentModal(r)}
            >
              Xem biên bản giải quyết
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5 pt-2">
      <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h3 className="font-bold text-sm text-gray-800">Quản lý &amp; Xử lý Sự cố Hiện trường</h3>
          <p className="text-xs text-gray-500 mt-0.5">Tiếp nhận thông tin hỏng xe, tai nạn hoặc ùn tắc, phát lệnh điều xe thay thế và cấp lại vận đơn</p>
        </div>
        {!isReadOnly && (
          <Button
            danger
            type="primary"
            size="small"
            icon={<PlusCircle size={14} />}
            className="font-semibold text-xs"
            onClick={handleOpenReport}
          >
            Ghi nhận sự cố hiện trường mới
          </Button>
        )}
      </div>

      <Card className="shadow-xs border-gray-100 rounded-xl overflow-hidden" styles={{ body: { padding: 0 } }}>
        <Table
          columns={incidentColumns}
          dataSource={incidents}
          rowKey="id"
          pagination={{ pageSize: 6 }}
          size="middle"
        />
      </Card>

      <Modal
        title="Ghi nhận sự cố hiện trường từ Tài xế / GPS"
        open={reportModalOpen}
        onCancel={() => setReportModalOpen(false)}
        onOk={handleConfirmReport}
        okText="Báo cáo sự cố"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <div className="space-y-3 py-2 text-xs">
          <div>
            <label className="font-bold text-gray-700 block mb-1">Chuyến xe gặp sự cố *</label>
            <Select
              className="w-full text-xs"
              value={selectedTripCode}
              onChange={setSelectedTripCode}
            >
              {(trips || []).map(t => (
                <Option key={t.id} value={t.id}>
                  {t.id} · Xe {t.plate} · Tài xế {t.driver_name} ({t.customer})
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1">Phân loại sự cố *</label>
            <Select className="w-full text-xs" value={incidentType} onChange={setIncidentType}>
              <Option value="BREAKDOWN">Hỏng xe giữa đường (BREAKDOWN)</Option>
              <Option value="ACCIDENT">Va chạm giao thông (ACCIDENT)</Option>
              <Option value="CARGO_DAMAGED">Hư hỏng hàng hóa (CARGO_DAMAGED)</Option>
              <Option value="ROAD_BAN">Cấm đường / Kẹt xe nghiêm trọng (ROAD_BAN)</Option>
              <Option value="HELD_BY_AUTHORITIES">Kiểm tra Hải quan / CSGT (HELD_BY_AUTHORITIES)</Option>
            </Select>
          </div>
          <div>
            <label className="font-bold text-gray-700 block mb-1">Mô tả chi tiết hiện trường *</label>
            <Input.TextArea
              rows={3}
              value={incidentDesc}
              onChange={e => setIncidentDesc(e.target.value)}
              placeholder="Nhập chi tiết tình trạng phương tiện, hàng hóa và vị trí..."
              className="text-xs"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
