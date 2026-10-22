import React from 'react';
import { Card, Table, Tag, Button } from 'antd';
import { AlertTriangle, Clock, Truck, ShieldAlert } from 'lucide-react';

export default function TripIncidentsTab({
  incidents,
  setActiveIncidentModal
}) {
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
            <Tag color={r.status === 'RESOLVED' ? 'green' : 'red'} className="font-bold text-xs py-0.5 px-2">
              {r.status === 'RESOLVED' ? 'ĐÃ ĐIỀU XE THAY THẾ' : 'CHỜ ĐIỀU PHỐI XỬ LÝ'}
            </Tag>
          </div>
          {r.status === 'PENDING' ? (
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
          ) : (
            <Button
              size="small"
              className="text-xs text-gray-600"
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
      <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-sm text-gray-800">Quản lý &amp; Xử lý Sự cố Hiện trường</h3>
          <p className="text-xs text-gray-500 mt-0.5">Tiếp nhận thông tin hỏng xe, tai nạn hoặc ùn tắc, phát lệnh điều xe thay thế và cấp lại vận đơn</p>
        </div>
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
    </div>
  );
}
