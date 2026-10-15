"use client";
import React, { useState, useEffect } from 'react';
import { message, Spin } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function VendorsPage() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL');
  const [approvingId, setApprovingId] = useState(null);

  const fetchVendors = () => {
    setLoading(true);
    managerApi.getVendors()
      .then(res => {
        const vendorList = Array.isArray(res) ? res : (res?.vendors || []);
        setVendors(vendorList);
      })
      .catch(error => {
        console.error('Lỗi khi tải nhà xe & hợp đồng:', error);
        message.error('Không thể kết nối Backend để lấy danh sách đối tác.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    managerApi.getVendors()
      .then(res => {
        const vendorList = Array.isArray(res) ? res : (res?.vendors || []);
        if (isMounted) setVendors(vendorList);
      })
      .catch(error => {
        console.error('Lỗi khi tải nhà xe & hợp đồng:', error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const handleApprove = async (vendor) => {
    try {
      setApprovingId(vendor.id);
      await managerApi.approveVendor(vendor.id);
      message.success(`Đã phê duyệt đối tác & hợp đồng vận chuyển cho "${vendor.name}" thành công!`);
      fetchVendors();
    } catch (error) {
      console.error('Lỗi khi duyệt nhà xe:', error);
      message.error(error.message || 'Lỗi khi phê duyệt đối tác');
    } finally {
      setApprovingId(null);
    }
  };

  const totalVendors = vendors.length;
  const approvedVendors = vendors.filter(v => (v.status || v.approval_status) === 'APPROVED').length;
  const pendingVendors = vendors.filter(v => (v.status || v.approval_status) === 'PENDING').length;
  const activeContracts = vendors.filter(v => v.contract_status === 'ACTIVE').length;
  const approvalRate = totalVendors > 0 ? Math.round((approvedVendors / totalVendors) * 100) : 0;

  const filteredVendors = vendors.filter((v) => {
    if (activeTab === 'AIRLINES') return v.name?.toLowerCase().includes('airline') || v.name?.toLowerCase().includes('cargo');
    if (activeTab === 'FORWARDERS') return v.name?.toLowerCase().includes('dhl') || v.name?.toLowerCase().includes('chuyển');
    return true;
  });

  return (
    <div className="flex flex-col w-full">
      {/* Top Executive Header Panel */}
      <div className="relative bg-surface-container-lowest p-space-xl rounded-xl shadow-sm mb-space-lg overflow-hidden">
        <div className="absolute -right-16 -top-24 w-96 h-96 rounded-full bg-surface-container-high/40 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg">
          <div className="flex flex-col max-w-3xl">
            <div className="flex items-center gap-space-sm mb-space-xs flex-wrap">
              <span className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
                Quản lý Đối tác &amp; Hãng Hàng Không
              </span>
              <span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                Tổng đối tác: {totalVendors}
              </span>
              <span className="px-space-sm py-0.5 rounded-full bg-surface-container font-data-mono text-body-sm text-outline font-medium">
                HỆ THỐNG QUẢN LÝ ĐỐI TÁC VẬN TẢI
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Quản lý liên minh đối tác vận tải, các đại lý giao nhận hàng không, hợp đồng tải xe và hạn mức công nợ theo số liệu thực tế từ hệ thống cơ sở dữ liệu.
            </p>
          </div>
          <div className="flex items-center gap-space-md flex-shrink-0">
            <button
              onClick={() => message.info('Đang mở mô-đun Đối soát công nợ...')}
              className="inline-flex items-center justify-center gap-space-xs px-space-lg h-11 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-primary font-label-lg text-label-lg transition-all shadow-sm cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[19px] text-secondary">account_balance_wallet</span>
              <span>Đối soát công nợ</span>
            </button>
            <button
              onClick={() => message.info('Mở form Thêm đối tác vận tải mới')}
              className="inline-flex items-center justify-center gap-space-xs px-space-lg h-11 rounded-lg bg-on-tertiary-container hover:bg-tertiary text-on-tertiary font-label-lg text-label-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>+ Thêm đối tác mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics / KPI Bento Quad */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">
        {/* KPI 1 */}
        <div className="relative bg-surface-container-lowest p-space-lg rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-secondary"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider block mb-1">
                Đối tác đã phê duyệt
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-xl text-headline-xl text-primary font-bold">{approvedVendors}</span>
                <span className="font-label-md text-label-md text-secondary font-semibold">Đối tác</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[22px]">verified</span>
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between pt-space-xs">
            <span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              Đủ điều kiện vận hành
            </span>
            <span className="font-data-mono text-body-sm text-secondary font-semibold">{totalVendors > 0 ? `${Math.round((approvedVendors / totalVendors) * 100)}%` : '0%'}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative bg-surface-container-lowest p-space-lg rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-container"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider block mb-1">
                Hồ sơ chờ phê duyệt
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-xl text-headline-xl text-primary font-bold">{pendingVendors}</span>
                <span className="font-label-md text-label-md text-on-primary-container font-semibold">Hồ sơ</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary-container">
              <span className="material-symbols-outlined text-[22px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between pt-space-xs">
            <span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
              Cần thẩm định năng lực
            </span>
            <span className="font-data-mono text-body-sm text-on-primary-fixed-variant font-semibold">{pendingVendors > 0 ? 'Cần duyệt' : 'Đã duyệt hết'}</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative bg-surface-container-lowest p-space-lg rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-on-tertiary-container"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider block mb-1">
                Hợp đồng vận tải Active
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-xl text-headline-xl text-primary font-bold">{activeContracts}</span>
                <span className="font-label-md text-label-md text-on-tertiary-container font-semibold">Hợp đồng</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary-container">
              <span className="material-symbols-outlined text-[22px]">description</span>
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between pt-space-xs">
            <span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
              Hiệu lực pháp lý
            </span>
            <span className="font-data-mono text-body-sm text-on-tertiary-container font-semibold">{activeContracts} Đang chạy</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative bg-surface-container-lowest p-space-lg rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-secondary"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider block mb-1">
                Tỷ lệ duyệt đối tác
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-xl text-headline-xl text-primary font-bold">{approvalRate}%</span>
                <span className="font-label-md text-label-md text-secondary font-semibold">Đạt chuẩn</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[22px]">task_alt</span>
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between pt-space-xs">
            <div className="w-full flex items-center gap-2">
              <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: `${approvalRate}%` }}></div>
              </div>
              <span className="font-data-mono text-body-sm text-outline">{approvedVendors}/{totalVendors}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Context Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md mb-space-lg">
        <div className="lg:col-span-2 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Cổng kết nối Air Freight Quốc tế</h2>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Giám sát tải thực tế theo HUB Nội Bài (HAN) &amp; Tân Sơn Nhất (SGN)
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-secondary bg-surface-container-low px-space-md py-1 rounded-full font-semibold">
              Đang vận hành Realtime
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            <div className="p-space-md bg-surface-container-low rounded-xl flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-secondary shadow-sm">
                <span className="material-symbols-outlined text-[20px]">airlines</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-label-sm text-outline">Slot bay đặt trước</span>
                <span className="font-headline-sm text-headline-sm text-primary font-bold truncate">1,840 Tấn</span>
                <span className="font-body-sm text-body-sm text-secondary">Tháng 11/2026</span>
              </div>
            </div>
            <div className="p-space-md bg-surface-container-low rounded-xl flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-tertiary-container shadow-sm">
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-label-sm text-outline">Công nợ IATA CASS</span>
                <span className="font-headline-sm text-headline-sm text-primary font-bold truncate">64.5 Tỷ đ</span>
                <span className="font-body-sm text-body-sm text-outline">Kỳ thanh toán ngày 15</span>
              </div>
            </div>
            <div className="p-space-md bg-surface-container-low rounded-xl flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined text-[20px]">alarm_on</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-label-sm text-outline">Chỉ số On-Time (OTP)</span>
                <span className="font-headline-sm text-headline-sm text-primary font-bold truncate">99.4%</span>
                <span className="font-body-sm text-body-sm text-secondary">Đạt chuẩn AWB Master</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Announcement */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-space-xs">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Thông tri biểu cước hàng không</span>
            <span className="material-symbols-outlined text-outline text-[18px]">info</span>
          </div>
          <div className="space-y-space-sm my-space-xs">
            <div className="flex items-start gap-space-sm">
              <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">campaign</span>
              <p className="font-body-sm text-body-sm text-on-surface leading-snug">
                Cập nhật phụ phí nhiên liệu FSC &amp; An ninh hàng không SSC từ Vietnam Airlines Cargo và SQ Cargo.
              </p>
            </div>
            <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface font-semibold">Tỷ giá đối soát IATA</span>
              <span className="font-data-mono text-label-md text-primary font-bold">1 USD = 25,410 VND</span>
            </div>
          </div>
          <button
            onClick={() => message.info('Đang tải danh sách thông cáo CASS mới nhất...')}
            className="w-full py-2 bg-surface-container text-secondary hover:bg-surface-container-high rounded-lg font-label-md text-label-md font-semibold transition-colors cursor-pointer"
            type="button"
          >
            Xem tất cả thông báo CASS
          </button>
        </div>
      </div>

      {/* Partner Filtering Tabs & Actions Bar */}
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm mb-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xs overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-space-md py-2 rounded-lg font-label-md text-label-md font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
            type="button"
          >
            Tất cả đối tác ({vendors.length})
          </button>
          <button
            onClick={() => setActiveTab('AIRLINES')}
            className={`px-space-md py-2 rounded-lg font-label-md text-label-md font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'AIRLINES'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
            type="button"
          >
            Hãng hàng không / Airlines
          </button>
          <button
            onClick={() => setActiveTab('FORWARDERS')}
            className={`px-space-md py-2 rounded-lg font-label-md text-label-md font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'FORWARDERS'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
            type="button"
          >
            Freight Forwarders
          </button>
        </div>

        <div className="flex items-center gap-space-sm flex-wrap">
          <button
            onClick={() => message.info('Đang xuất báo cáo danh mục đối tác ra file Excel...')}
            className="h-9 px-space-md rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center gap-1 font-label-md text-label-md transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Deep Partner Management Enterprise Data Grid */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden mb-space-lg">
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Spin size="large" description="Đang tải danh sách nhà xe &amp; hợp đồng..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-outline font-label-sm text-label-sm uppercase tracking-wider">
                <tr>
                  <th className="py-space-md px-space-lg font-semibold">MÃ &amp; TÊN ĐỐI TÁC</th>
                  <th className="py-space-md px-space-md font-semibold">LOẠI ĐỐI TÁC</th>
                  <th className="py-space-md px-space-md font-semibold">HỢP ĐỒNG / CASS</th>
                  <th className="py-space-md px-space-md font-semibold text-right">KỲ HẠN TT</th>
                  <th className="py-space-md px-space-md font-semibold text-center">TRẠNG THÁI</th>
                  <th className="py-space-md px-space-lg font-semibold text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container font-body-md text-body-md text-on-surface">
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-outline">
                      Chưa có dữ liệu đối tác nào.
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor, idx) => {
                    const initial = (vendor.name || 'V').substring(0, 2).toUpperCase();
                    const isApproved = vendor.status === 'APPROVED' || vendor.approval_status === 'APPROVED';

                    return (
                      <tr key={vendor.id || idx} className="hover:bg-surface-container-low/70 transition-colors group">
                        {/* Mã & Tên đối tác */}
                        <td className="py-space-md px-space-lg">
                          <div className="flex items-center gap-space-md">
                            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center font-headline-sm text-headline-sm font-bold text-secondary flex-shrink-0">
                              {initial}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-space-xs">
                                <span className="font-headline-sm text-headline-sm font-bold text-primary truncate">
                                  {vendor.name}
                                </span>
                                {isApproved && (
                                  <span className="material-symbols-outlined text-secondary text-[16px]" title="Đối tác xác minh">
                                    verified
                                  </span>
                                )}
                              </div>
                              <span className="font-body-sm text-body-sm text-outline">
                                MST: {vendor.tax_code || 'Đã kiểm tra'} • LH: {vendor.contact_person || vendor.contact_name || 'Đại diện'} ({vendor.phone || 'Chưa có SĐT'})
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Loại đối tác */}
                        <td className="py-space-md px-space-md">
                          <div className="flex flex-col">
                            <span className="font-label-md text-label-md text-primary font-semibold">
                              Đối tác Vận tải Đường bộ &amp; Hub
                            </span>
                            <span className="font-body-sm text-body-sm text-outline">
                              Đơn vị vận tải ủy thác
                            </span>
                          </div>
                        </td>

                        {/* Hợp đồng */}
                        <td className="py-space-md px-space-md">
                          <span className="inline-flex items-center gap-1 font-data-mono text-body-sm bg-surface-container-low px-2 py-0.5 rounded text-primary font-semibold">
                            {vendor.contractId || vendor.contract_code || (vendor.contract_id ? `HD-${vendor.contract_id}-2026` : 'Chưa ký HĐ')}
                          </span>
                        </td>

                        {/* Kỳ hạn TT */}
                        <td className="py-space-md px-space-md text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-data-mono text-headline-sm text-headline-sm font-bold text-primary">
                              {vendor.payment_terms_days || 30} ngày
                            </span>
                            <span className="font-body-sm text-body-sm text-secondary">Thanh toán định kỳ</span>
                          </div>
                        </td>

                        {/* Trạng thái */}
                        <td className="py-space-md px-space-md text-center">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1.5 px-space-md py-1 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm font-semibold">
                              <span className="w-2 h-2 rounded-full bg-secondary"></span>
                              Đang hợp tác
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-space-md py-1 rounded-full bg-tertiary-fixed text-on-tertiary-container font-label-sm text-label-sm font-semibold">
                              <span className="w-2 h-2 rounded-full bg-on-tertiary-container"></span>
                              Chờ phê duyệt
                            </span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="py-space-md px-space-lg text-right">
                          <div className="flex items-center justify-end gap-space-xs">
                            {!isApproved && (
                              <button
                                onClick={() => handleApprove(vendor)}
                                disabled={approvingId === vendor.id}
                                className="px-space-md py-1.5 rounded-lg bg-on-tertiary-container text-on-tertiary hover:brightness-110 font-label-md text-label-md font-semibold transition-all cursor-pointer shadow-sm"
                                type="button"
                              >
                                {approvingId === vendor.id ? 'Đang duyệt...' : 'Phê duyệt HĐ'}
                              </button>
                            )}
                            <button
                              onClick={() => message.info(`Xem chi tiết hợp đồng của ${vendor.name}`)}
                              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                              title="Xem hợp đồng"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">description</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
