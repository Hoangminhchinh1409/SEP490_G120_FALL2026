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
  handleDeleteTruck,
  isReadOnly = false
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
                <th className="py-3 px-4">Tải trọng &amp; Thùng</th>
                <th className="py-3 px-4">Hạn đăng kiểm (TT 02/2023)</th>
                <th className="py-3 px-4">Bảo dưỡng định kỳ (PM)</th>
                <th className="py-3 px-4 text-center">Trạng thái &amp; Downtime</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Spin size="large" />
                  </td>
                </tr>
              ): filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Không tìm thấy xe tải phù hợp
                  </td>
                </tr>
              ): (
                filteredTrucks.map((truck) => {
                  const alertLevel = truck.inspection_alert_level;
                  const daysLeft = truck.days_until_inspection;
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
                        <div>
                          {((truck.payload_kg || truck.allowed_payload || 0) / 1000).toFixed(1)} tấn ({Number(truck.payload_kg || truck.allowed_payload || 0).toLocaleString('vi-VN')} kg)
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">
                          Thùng: {truck.box_length || truck.box_length_cm || 0}×{truck.box_width || truck.box_width_cm || 0}×{truck.box_height || truck.box_height_cm || 0} cm · Hạng {truck.required_license_class || 'C'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {truck.inspection_expiry ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 font-mono text-xs text-slate-700">
                              <span>{new Date(truck.inspection_expiry).toLocaleDateString('vi-VN')}</span>
                            </div>
                            {alertLevel === 'EXPIRED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-bold text-[10px] border border-red-300">
                                <span className="material-symbols-outlined text-[13px]">block</span>
                                Hết hạn (Khóa xe)
                              </span>
                            ): alertLevel === 'URGENT' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 font-bold text-[10px] border border-orange-300">
                                <span className="material-symbols-outlined text-[13px]">alarm</span>
                                Còn {daysLeft} ngày (Khẩn)
                              </span>
                            ): alertLevel === 'WARNING' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-300">
                                Còn {daysLeft} ngày
                              </span>
                            ): (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[10px]">
                                ✓ An toàn ({daysLeft} ngày)
                              </span>
                            )}
                          </div>
                        ): (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Cột 4: Bảo dưỡng định kỳ (PM) */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 min-w-[150px]">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-600 font-semibold">{truck.current_odometer_km?.toLocaleString('vi-VN') || 25000} km</span>
                            {truck.maintenance_status === 'OVERDUE' ? (
                              <span className="text-[10px] text-red-600 font-bold">Quá hạn BD</span>
                            ): truck.maintenance_status === 'DUE_SOON' ? (
                              <span className="text-[10px] text-orange-600 font-bold">Cần BD</span>
                            ): (
                              <span className="text-[10px] text-emerald-600 font-bold">Đạt chuẩn</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Kỳ kế: {truck.next_maintenance_km?.toLocaleString('vi-VN')} km
                            {truck.km_until_maintenance > 0 && ` (còn ${truck.km_until_maintenance?.toLocaleString('vi-VN')} km)`}
                          </div>
                        </div>
                      </td>

                      {/* Cột 5: Trạng thái xe & Giờ gián đoạn sửa chữa (Downtime) */}
                      <td className="py-3.5 px-4 text-center">
                        {truck.status === 'ON_TRIP' ? (
                          <Tooltip title="Xe đang thực hiện chuyến đi, không thể chuyển đổi trạng thái thủ công">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 cursor-not-allowed">
                              🚚 Đang chạy
                            </span>
                          </Tooltip>
                        ): (
                          <div className="inline-flex flex-col items-center gap-1">
                            <Select
                              value={truck.status}
                              size="small"
                              disabled={isReadOnly}
                              className="w-36 text-xs font-semibold"
                              onChange={(val) => handleQuickStatusChange(truck.id, val)}
                              options={[
                                { value: 'AVAILABLE', label: '🟢 Sẵn sàng' },
                                { value: 'MAINTENANCE', label: '🛠 Bảo dưỡng/Sửa' },
                                { value: 'INACTIVE', label: '⚪ Ngưng HĐ' }
                              ]}
                            />
                            {truck.status === 'MAINTENANCE' && (
                              <Tooltip title={`Xưởng: ${truck.service_garage || 'Xưởng bảo dưỡng đối tác'}`}>
                                <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                                  Downtime: {truck.downtime_hours || 18}h
                                </div>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isReadOnly ? (
                          <span className="text-[11px] font-semibold text-slate-400 italic">Chỉ xem</span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <Tooltip title="Cập nhật chi tiết xe">
                              <button
                                onClick={() => handleOpenEditTruck(truck)}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                              </button>
                            </Tooltip>

                            <Popconfirm
                              title="Ngưng hoạt động xe này?"
                              description={`Chuyển xe ${truck.plate_number} sang trạng thái Inactive.`}
                              onConfirm={() => handleDeleteTruck(truck.id)}
                            >
                              <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </Popconfirm>
                          </div>
                        )}
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
