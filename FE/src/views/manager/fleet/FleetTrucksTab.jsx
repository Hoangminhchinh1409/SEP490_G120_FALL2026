import React from 'react';
import { Select, Spin, Popconfirm, Tooltip } from 'antd';

export default function FleetTrucksTab({
  trucks,
  loading,
  searchText,
  setSearchText,
  selectedTruckStatus,
  setSelectedTruckStatus,
  handleOpenEditTruck,
  handleQuickStatusChange,
  handleDeleteTruck
}) {
  const filteredTrucks = trucks.filter((truck) => {
    const matchSearch =
      !searchText ||
      truck.plate_number?.toLowerCase().includes(searchText.toLowerCase()) ||
      truck.model?.toLowerCase().includes(searchText.toLowerCase());

    const matchStatus =
      selectedTruckStatus === 'ALL' || truck.status === selectedTruckStatus;

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* Controls: Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Tìm biển số, model xe..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Trạng thái:</span>
          <Select
            value={selectedTruckStatus}
            onChange={setSelectedTruckStatus}
            className="w-44"
            options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'AVAILABLE', label: 'Sẵn sàng (Available)' },
              { value: 'ON_TRIP', label: 'Đang chạy chuyến (On Trip)' },
              { value: 'MAINTENANCE', label: 'Bảo dưỡng (Maintenance)' },
              { value: 'INACTIVE', label: 'Ngưng hoạt động (Inactive)' }
            ]}
          />
        </div>
      </div>

      {/* Truck Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Biển số &amp; Model</th>
                <th className="py-3 px-4">Tải trọng</th>
                <th className="py-3 px-4">Kích thước Thùng (D×R×C)</th>
                <th className="py-3 px-4">Hạng bằng yêu cầu</th>
                <th className="py-3 px-4">Hạn đăng kiểm</th>
                <th className="py-3 px-4">Hạn bảo hiểm</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Spin size="large" />
                  </td>
                </tr>
              ) : filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Không tìm thấy xe tải phù hợp
                  </td>
                </tr>
              ) : (
                filteredTrucks.map((truck) => {
                  const isExpired = truck.is_inspection_expired;
                  return (
                    <tr key={truck.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200">
                            <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                          </div>
                          <div>
                            <div className="font-mono font-bold text-slate-900">{truck.plate_number}</div>
                            <div className="text-xs text-slate-500">{truck.model || 'Tiêu chuẩn'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {((truck.payload_kg || truck.allowed_payload || 0) / 1000).toFixed(1)} tấn
                        <span className="block text-[11px] text-slate-400 font-normal">
                          ({Number(truck.payload_kg || truck.allowed_payload || 0).toLocaleString('vi-VN')} kg)
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        {truck.box_length || truck.box_length_cm || 0} × {truck.box_width || truck.box_width_cm || 0} × {truck.box_height || truck.box_height_cm || 0} cm
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-xs">
                          Hạng {truck.required_license_class || 'C'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {truck.inspection_expiry ? (
                          <span className={`text-xs font-mono inline-flex items-center gap-1 ${
                            isExpired ? 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200' : 'text-slate-700'
                          }`}>
                            {isExpired && <span className="material-symbols-outlined text-[14px]">warning</span>}
                            {new Date(truck.inspection_expiry).toLocaleDateString('vi-VN')}
                          </span>
                        ) : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                        {truck.insurance_expiry ? new Date(truck.insurance_expiry).toLocaleDateString('vi-VN') : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Select
                          size="small"
                          value={truck.status}
                          onChange={(val) => handleQuickStatusChange(truck.id, val)}
                          disabled={isExpired && truck.status !== 'AVAILABLE'}
                          className="w-36 text-xs font-semibold"
                          options={[
                            { value: 'AVAILABLE', label: '🟢 Sẵn sàng' },
                            { value: 'ON_TRIP', label: '🚚 Đang chạy' },
                            { value: 'MAINTENANCE', label: '🔧 Bảo dưỡng' },
                            { value: 'INACTIVE', label: '⚪ Tạm ngưng' }
                          ]}
                        />
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditTruck(truck)}
                            className="px-2.5 py-1 rounded-lg text-blue-600 hover:bg-blue-50 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            <span>Sửa</span>
                          </button>

                          <Popconfirm
                            title="Xóa xe khỏi danh sách?"
                            description="Xe sẽ được chuyển sang trạng thái Ngưng hoạt động (Inactive)."
                            onConfirm={() => handleDeleteTruck(truck.id)}
                            okText="Đồng ý"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                          >
                            <button className="px-2 py-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs cursor-pointer transition-colors">
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </Popconfirm>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
