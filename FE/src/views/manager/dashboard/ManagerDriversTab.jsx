"use client";
import React from 'react';
import { Spin, Tag, Tooltip, Modal } from 'antd';

export function ManagerDriverTripsModal({ selectedDriverModal, onClose }) {
  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">route</span>
          <span className="font-bold text-base text-primary">
            Danh sách chuyến xe: {selectedDriverModal?.name}
          </span>
        </div>
      }
      open={Boolean(selectedDriverModal)}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {selectedDriverModal && (
        <div className="space-y-4 pt-2">
          <div className="bg-surface-container-low p-3 rounded-xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Số điện thoại:</span>
              <span className="font-bold text-primary">{selectedDriverModal.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Số bằng lái:</span>
              <span className="font-bold text-primary">{selectedDriverModal.license_number} (Hạng {selectedDriverModal.license_class})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Trạng thái:</span>
              <Tag color={selectedDriverModal.status === 'Active' ? 'green' : 'orange'}>
                {selectedDriverModal.status}
              </Tag>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase text-on-surface-variant mb-2">
              Các chuyến xe được phân công:
            </h4>
            {selectedDriverModal.trips && selectedDriverModal.trips.length > 0 ? (
              <div className="border border-surface-container rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low text-on-surface-variant font-bold border-b border-surface-container">
                    <tr>
                      <th className="py-2.5 px-3">Mã chuyến</th>
                      <th className="py-2.5 px-3">Lộ trình</th>
                      <th className="py-2.5 px-3">Thời gian</th>
                      <th className="py-2.5 px-3">Quãng đường</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {selectedDriverModal.trips.map((t, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-low/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-primary">{t.code}</td>
                        <td className="py-2.5 px-3">{t.route}</td>
                        <td className="py-2.5 px-3 text-on-surface-variant">{t.time}</td>
                        <td className="py-2.5 px-3">{t.distance}</td>
                        <td className="py-2.5 px-3">
                          <Tag color={t.status === 'Completed' ? 'green' : t.status === 'Assigned' ? 'blue' : 'orange'}>
                            {t.status}
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-on-surface-variant text-xs italic bg-surface-container-low rounded-xl">
                Chưa có chuyến xe nào được ghi nhận cho tài xế này.
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ManagerDriversTab({
  loading,
  loadError,
  onRetry,
  driverSummary,
  driverSearch,
  setDriverSearch,
  filteredDrivers,
  onSelectDriver
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 border border-outline-variant/30 space-y-4">
      {/* Header & Tìm kiếm tài xế */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-container pb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xl font-black text-primary tracking-tight">
              Bảng đánh giá hiệu suất tài xế
            </h3>
            <Tag color="blue" className="font-bold">
              Tổng tài xế: {driverSummary.total_drivers}
            </Tag>
            <Tag color="cyan" className="font-bold">
              Tổng chuyến: {driverSummary.total_completed_trips}
            </Tag>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Giờ lái tính từ GPS xe. Bấm tên tài xế để xem danh sách chuyến xe được phân công.
          </p>
        </div>

        <div className="w-full sm:w-72 relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px] pointer-events-none">
            search
          </span>
          <input
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary border border-surface-container"
            placeholder="Tìm tên, SĐT, số bằng lái..."
            type="text"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Spin size="large" /></div>
      ) : loadError ? (
        <div className="py-10 px-6 rounded-xl bg-error-container/20 border border-error/30 text-center space-y-2">
          <div className="font-bold text-error text-sm">{loadError}</div>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold cursor-pointer"
          >
            Thử tải lại
          </button>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="py-12 text-center text-on-surface-variant text-sm">
          Không tìm thấy hồ sơ tài xế nào trong cơ sở dữ liệu.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[11px] font-extrabold tracking-wider border-b border-surface-container">
                <th className="py-3 px-4">Tài xế</th>
                <th className="py-3 px-4 text-center">Số chuyến</th>
                <th className="py-3 px-4 text-center">Đúng giờ</th>
                <th className="py-3 px-4 text-center">Giờ lái (GPS)</th>
                <th className="py-3 px-4 text-center">Chạm giới hạn lái</th>
                <th className="py-3 px-4 text-center">Ngoài bán kính</th>
                <th className="py-3 px-4 text-center">Ở điểm (TB)</th>
                <th className="py-3 px-4 text-center">Sự cố · khiếu nại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-xs">
              {filteredDrivers.map((d) => (
                <tr key={d.id} className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => onSelectDriver(d)}
                      className="flex items-center gap-3 text-left group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs group-hover:bg-primary group-hover:text-on-primary transition-colors">
                        {d.name?.charAt(0) || 'TX'}
                      </div>
                      <div>
                        <div className="font-bold text-primary group-hover:underline flex items-center gap-1.5">
                          <span>{d.name}</span>
                          <span className="material-symbols-outlined text-[13px] text-secondary opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                        </div>
                        <div className="text-[11px] text-on-surface-variant font-mono flex items-center gap-2 mt-0.5">
                          <span>{d.phone}</span>
                          <span>·</span>
                          <span>GPLX: {d.license_number}</span>
                          <Tag color="blue" className="text-[10px] px-1 py-0 m-0">Hạng {d.license_class}</Tag>
                        </div>
                      </div>
                    </button>
                  </td>

                  <td className="py-3.5 px-4 text-center font-bold text-primary">
                    {d.completed_trips}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono font-bold text-secondary">
                    {d.on_time_rate != null ? `${d.on_time_rate}%` : '—'}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-primary">
                    {d.gps_driving_hours}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    {d.limit_driving_count > 0 ? (
                      <Tooltip title="Tài xế lái quá 4h liên tục không nghỉ ngơi">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-error/10 text-error font-extrabold">
                          {d.limit_driving_count}
                        </span>
                      </Tooltip>
                    ) : (
                      <span className="text-on-surface-variant">0</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    {(d.outside_radius_count || 0) > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 font-extrabold">
                        {d.outside_radius_count}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">0</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-center font-medium text-primary">
                    {d.avg_dwell_time}
                  </td>

                  <td className="py-3.5 px-4 text-center font-bold">
                    <span className={d.incident_claim_text !== '0 · 0' ? 'text-error font-black' : 'text-on-surface-variant'}>
                      {d.incident_claim_text}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pt-4 text-xs italic text-on-surface-variant">
            Giờ lái tính từ GPS xe. Bấm tên tài xế để xem danh sách chuyến của tài xế đó.
          </div>
        </div>
      )}
    </div>
  );
}
