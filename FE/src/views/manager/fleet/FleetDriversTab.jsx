import React from 'react';
import { Spin } from 'antd';

export default function FleetDriversTab({
  drivers,
  loading,
  handleOpenEditDriver
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Tài xế</th>
              <th className="py-3 px-4">Số điện thoại</th>
              <th className="py-3 px-4">Số GPLX</th>
              <th className="py-3 px-4">Hạng bằng</th>
              <th className="py-3 px-4">Hạn GPLX</th>
              <th className="py-3 px-4 text-center">Trạng thái hồ sơ</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <Spin size="large" />
                </td>
              </tr>
            ) : drivers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  Không tìm thấy hồ sơ tài xế
                </td>
              </tr>
            ) : (
              drivers.map((driver) => {
                const isExp = driver.is_license_expired;
                return (
                  <tr key={driver.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200">
                          {(driver.name || driver.full_name || 'D').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span>{driver.name || driver.full_name}</span>
                          <span className="block text-xs text-slate-400 font-mono">@{driver.username || `id_${driver.id}`}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-mono">{driver.phone || '—'}</td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {driver.license_number || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                        Hạng {driver.license_class || driver.license || 'C'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {driver.expiry || driver.license_expiry ? (
                        <span className={`text-xs font-mono ${isExp ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                          {new Date(driver.expiry || driver.license_expiry).toLocaleDateString('vi-VN')}
                        </span>
                      ) : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        driver.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {driver.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEditDriver(driver)}
                        className="px-3 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        <span>Chi tiết</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
