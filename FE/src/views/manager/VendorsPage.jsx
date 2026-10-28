"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Input, message, Spin, Tag } from 'antd';
import { managerApi } from '../../api/managerApi';

export default function VendorsPage() {
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState('VENDORS'); // 'VENDORS', 'CONTRACTS', 'LOCATIONS'

  // Vendors state (Screen 28 & 29)
  const [vendors, setVendors] = useState([]);
  const [vendorSummary, setVendorSummary] = useState({ total: 0, approved: 0, pending: 0, suspended: 0 });
  const [vendorFilter, setVendorFilter] = useState('ALL'); // 'ALL', 'APPROVED', 'PENDING', 'SUSPENDED'
  const [vendorSearch, setVendorSearch] = useState('');

  // Modal Screen 29 (Add / Edit Vendor)
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [vendorForm, setVendorForm] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    truck_types: 'Xe tải 1.5T - 5T (Thùng kín)'
  });
  const [savingVendor, setSavingVendor] = useState(false);

  // Contracts state (Screen 30, 31 Read-only)
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractSearch, setContractSearch] = useState('');

  // Locations state (Screen 37 Read-only)
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  const fetchVendorsData = async () => {
    setLoading(true);
    try {
      const res = await managerApi.getVendors();
      setVendors(res.vendors || []);
      setVendorSummary(res.summary || {
        total: (res.vendors || []).length,
        approved: (res.vendors || []).filter((v) => v.approval_status === 'APPROVED').length,
        pending: (res.vendors || []).filter((v) => v.approval_status === 'PENDING').length,
        suspended: (res.vendors || []).filter((v) => v.approval_status === 'SUSPENDED').length
      });
    } catch (error) {
      console.error('Lỗi khi tải nhà xe đối tác:', error);
      message.error('Không thể kết nối Backend để lấy danh sách đối tác.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadVendors() {
      try {
        const res = await managerApi.getVendors();
        if (!ignore) {
          setVendors(res.vendors || []);
          setVendorSummary(res.summary || {
            total: (res.vendors || []).length,
            approved: (res.vendors || []).filter((v) => v.approval_status === 'APPROVED').length,
            pending: (res.vendors || []).filter((v) => v.approval_status === 'PENDING').length,
            suspended: (res.vendors || []).filter((v) => v.approval_status === 'SUSPENDED').length
          });
        }
      } catch (error) {
        console.error('Lỗi khi tải nhà xe đối tác:', error);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadVendors();
    return () => { ignore = true; };
  }, []);

  // Fetch contracts when tab switched
  const fetchContracts = async () => {
    setContractsLoading(true);
    try {
      const res = await managerApi.getContracts();
      setContracts(res.contracts || []);
    } catch (error) {
      console.error('Lỗi khi tải hợp đồng:', error);
      message.error('Không thể tải danh sách hợp đồng vận tải.');
    } finally {
      setContractsLoading(false);
    }
  };

  // Fetch locations when tab switched
  const fetchLocations = async () => {
    setLocationsLoading(true);
    try {
      const res = await managerApi.getLocations();
      setLocations(res.locations || []);
    } catch (error) {
      console.error('Lỗi khi tải địa điểm:', error);
      message.error('Không thể tải danh sách địa điểm kho bãi.');
    } finally {
      setLocationsLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveMainTab(tab);
    if (tab === 'CONTRACTS' && contracts.length === 0) fetchContracts();
    if (tab === 'LOCATIONS' && locations.length === 0) fetchLocations();
  };

  // Open Add Vendor Modal
  const handleOpenAddModal = () => {
    setEditingVendor(null);
    setVendorForm({
      company_name: '',
      contact_person: '',
      phone: '',
      truck_types: 'Xe tải 1.5T - 5T (Thùng kín)'
    });
    setIsVendorModalOpen(true);
  };

  // Open Edit Vendor Modal
  const handleOpenEditModal = (vendor) => {
    setEditingVendor(vendor);
    setVendorForm({
      company_name: vendor.company_name || vendor.name || '',
      contact_person: vendor.contact_person || '',
      phone: vendor.phone || '',
      truck_types: vendor.truck_types || 'Xe tải 1.5T - 5T (Thùng kín)'
    });
    setIsVendorModalOpen(true);
  };

  // Save Vendor (Create or Update)
  const handleSaveVendor = async () => {
    if (!vendorForm.company_name?.trim()) {
      message.warning('Vui lòng nhập tên công ty nhà xe đối tác (MSG02).');
      return;
    }

    try {
      setSavingVendor(true);
      if (editingVendor) {
        await managerApi.updateVendor(editingVendor.id, vendorForm);
        message.success('Cập nhật thông tin nhà xe đối tác thành công!');
      } else {
        await managerApi.createVendor(vendorForm);
        message.success('Thêm mới nhà xe đối tác thành công (trạng thái Chờ duyệt)!');
      }
      setIsVendorModalOpen(false);
      fetchVendorsData();
    } catch (error) {
      console.error('Lỗi lưu nhà xe:', error);
      message.error(error.message || 'Lỗi khi lưu nhà xe đối tác');
    } finally {
      setSavingVendor(false);
    }
  };

  // Change Vendor Status (Approve or Suspend)
  const handleUpdateStatus = async (vendorId, newStatus) => {
    try {
      const res = await managerApi.updateVendorStatus(vendorId, newStatus);
      message.success(res.message || 'Cập nhật trạng thái nhà xe thành công!');
      fetchVendorsData();
    } catch (error) {
      console.error('Lỗi đổi trạng thái nhà xe:', error);
      message.error(error.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  // Filtered Vendors
  const filteredVendors = vendors.filter((v) => {
    const matchSearch =
      !vendorSearch ||
      v.company_name?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      v.contact_person?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      v.phone?.includes(vendorSearch);

    const matchFilter = vendorFilter === 'ALL' || v.approval_status === vendorFilter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex flex-col w-full space-y-space-lg">
      {/* Top Hero Panel */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="flex flex-col space-y-1 z-10">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-primary tracking-tight">
              Quản Lý Nhà Xe Đối Tác & Hợp Đồng
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              {vendorSummary.approved} Nhà xe đang hoạt động
            </span>
          </div>
          <p className="font-body-md text-sm text-on-surface-variant max-w-3xl">
            Thẩm định, phê duyệt và đình chỉ nhà xe vận chuyển ngoài (Vendor), tra cứu điều khoản hợp đồng vận tải và mạng lưới kho bãi hàng không ALS.
          </p>
        </div>

        <div className="flex items-center gap-space-sm shrink-0 z-10">
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-xl bg-secondary text-on-secondary font-label-lg text-sm font-bold hover:bg-secondary-container transition-all cursor-pointer shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>+ Thêm Nhà Xe Mới</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-outline uppercase font-semibold">Tổng nhà xe</span>
            <span className="material-symbols-outlined text-primary text-[22px]">domain</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-primary">{vendorSummary.total}</div>
            <div className="text-xs text-on-surface-variant">Tổng số đối tác trong hệ thống</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-secondary uppercase font-semibold">Đã phê duyệt (Approved)</span>
            <span className="material-symbols-outlined text-secondary text-[22px]">verified</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-secondary">{vendorSummary.approved}</div>
            <div className="text-xs text-on-surface-variant">Được phép gán đơn vận chuyển</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full"
              style={{ width: `${vendorSummary.total ? (vendorSummary.approved / vendorSummary.total) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-amber-600 uppercase font-semibold">Chờ duyệt (Pending)</span>
            <span className="material-symbols-outlined text-amber-600 text-[22px]">hourglass_top</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-amber-600">{vendorSummary.pending}</div>
            <div className="text-xs text-on-surface-variant">Cần Manager xem xét hồ sơ</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-600 h-full rounded-full"
              style={{ width: `${vendorSummary.total ? (vendorSummary.pending / vendorSummary.total) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-error uppercase font-semibold">Bị đình chỉ (Suspended)</span>
            <span className="material-symbols-outlined text-error text-[22px]">block</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-error">{vendorSummary.suspended}</div>
            <div className="text-xs text-on-surface-variant">Chặn phân chuyến do vi phạm/hết hạn</div>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-error h-full rounded-full"
              style={{ width: `${vendorSummary.total ? (vendorSummary.suspended / vendorSummary.total) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-surface-container pb-2">
        <button
          onClick={() => handleTabChange('VENDORS')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'VENDORS'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">local_shipping</span>
          <span>Danh Sách Nhà Xe Đối Tác ({vendors.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('CONTRACTS')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'CONTRACTS'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">description</span>
          <span>Hợp Đồng Vận Tải</span>
        </button>

        <button
          onClick={() => handleTabChange('LOCATIONS')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'LOCATIONS'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">location_on</span>
          <span>Kho Bãi & Địa Điểm</span>
        </button>
      </div>

      {/* SUB-MODULE 1: VENDORS LIST & MANAGEMENT (SCREEN 28 & 29) */}
      {activeMainTab === 'VENDORS' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md border border-outline-variant/20 space-y-space-md">
          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-outline">Lọc trạng thái:</span>
              <button
                onClick={() => setVendorFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  vendorFilter === 'ALL' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Tất cả ({vendors.length})
              </button>
              <button
                onClick={() => setVendorFilter('APPROVED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  vendorFilter === 'APPROVED' ? 'bg-secondary text-white' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Đã duyệt ({vendorSummary.approved})
              </button>
              <button
                onClick={() => setVendorFilter('PENDING')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  vendorFilter === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Chờ duyệt ({vendorSummary.pending})
              </button>
              <button
                onClick={() => setVendorFilter('SUSPENDED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  vendorFilter === 'SUSPENDED' ? 'bg-error text-white' : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                Bị đình chỉ ({vendorSummary.suspended})
              </button>
            </div>

            <div className="w-full sm:w-72 relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px] pointer-events-none">
                search
              </span>
              <input
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-space-md bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
                placeholder="Tìm tên nhà xe, người liên hệ, SĐT..."
                type="text"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center"><Spin size="large" /></div>
          ) : filteredVendors.length === 0 ? (
            <div className="py-12 text-center text-outline">Không tìm thấy nhà xe đối tác nào phù hợp.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider">
                    <th className="py-3 px-space-md">TÊN NHÀ XE ĐỐI TÁC</th>
                    <th className="py-3 px-space-md">NGƯỜI ĐẠI DIỆN</th>
                    <th className="py-3 px-space-md">SỐ ĐIỆN THOẠI</th>
                    <th className="py-3 px-space-md">LOẠI ĐỘI XE</th>
                    <th className="py-3 px-space-md">HỢP ĐỒNG LIÊN KẾT</th>
                    <th className="py-3 px-space-md">TRẠNG THÁI</th>
                    <th className="py-3 px-space-md text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-sm">
                  {filteredVendors.map((v) => (
                    <tr key={v.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-space-md font-bold text-primary">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-secondary text-[20px]">local_shipping</span>
                          <span>{v.company_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md font-medium text-on-surface">
                        {v.contact_person}
                      </td>
                      <td className="py-3.5 px-space-md font-mono text-outline">
                        {v.phone}
                      </td>
                      <td className="py-3.5 px-space-md text-xs text-on-surface-variant">
                        {v.truck_types}
                      </td>
                      <td className="py-3.5 px-space-md">
                        {v.contract_number ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-bold text-primary">{v.contract_number}</span>
                            <span className="text-[10px] text-outline">
                              Trần: {v.liability_cap ? `${v.liability_cap.toLocaleString('vi-VN')} đ` : 'N/A'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-outline italic">Chưa liên kết HĐ</span>
                        )}
                      </td>
                      <td className="py-3.5 px-space-md">
                        <Tag color={
                          v.approval_status === 'APPROVED' ? 'green' :
                          v.approval_status === 'SUSPENDED' ? 'red' : 'gold'
                        }>
                          {v.approval_status === 'APPROVED' ? 'ĐÃ DUYỆT' :
                           v.approval_status === 'SUSPENDED' ? 'ĐÌNH CHỈ' : 'CHỜ DUYỆT'}
                        </Tag>
                      </td>
                      <td className="py-3.5 px-space-md text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(v)}
                            className="px-2.5 py-1 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container text-xs font-semibold cursor-pointer"
                          >
                            Sửa
                          </button>
                          {v.approval_status !== 'APPROVED' ? (
                            <button
                              onClick={() => handleUpdateStatus(v.id, 'APPROVED')}
                              className="px-3 py-1 rounded-lg bg-secondary text-on-secondary hover:bg-secondary-container text-xs font-bold transition-all cursor-pointer shadow-sm"
                            >
                              Phê duyệt
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(v.id, 'SUSPENDED')}
                              className="px-3 py-1 rounded-lg bg-error-container text-on-error-container hover:bg-error hover:text-white text-xs font-bold transition-all cursor-pointer"
                            >
                              Đình chỉ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-MODULE 2: TRANSPORT CONTRACTS READ-ONLY (SCREEN 30 & 31) */}
      {activeMainTab === 'CONTRACTS' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md border border-outline-variant/20 space-y-space-md">
          <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-surface-container pb-space-sm">
            <div>
              <h3 className="text-lg font-bold text-primary">
                Hợp Đồng Vận Tải (Chế Độ Chỉ Đọc)
              </h3>
              <p className="text-xs text-outline">
                Tra cứu các điều khoản trần bồi thường, phí chờ và thời hạn hợp đồng để đối chiếu nghiệp vụ
              </p>
            </div>

            <div className="w-full sm:w-72 relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px] pointer-events-none">
                search
              </span>
              <input
                value={contractSearch}
                onChange={(e) => setContractSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-space-md bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
                placeholder="Tìm số hợp đồng, đối tác..."
                type="text"
              />
            </div>
          </div>

          {contractsLoading ? (
            <div className="py-16 flex justify-center"><Spin size="large" /></div>
          ) : contracts.length === 0 ? (
            <div className="py-12 text-center text-outline">Chưa có hợp đồng vận tải nào trong cơ sở dữ liệu.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider">
                    <th className="py-3 px-space-md">SỐ HỢP ĐỒNG</th>
                    <th className="py-3 px-space-md">ĐỐI TÁC / KHÁCH HÀNG</th>
                    <th className="py-3 px-space-md">LOẠI ĐỐI TÁC</th>
                    <th className="py-3 px-space-md">TRẦN TRÁCH NHIỆM</th>
                    <th className="py-3 px-space-md">PHÍ CHỜ / GIỜ</th>
                    <th className="py-3 px-space-md">HIỆU LỰC</th>
                    <th className="py-3 px-space-md">TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-xs">
                  {contracts
                    .filter((c) => !contractSearch || c.contract_number?.toLowerCase().includes(contractSearch.toLowerCase()) || c.partner_name?.toLowerCase().includes(contractSearch.toLowerCase()))
                    .map((c) => (
                      <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3 px-space-md font-mono font-bold text-primary">
                          {c.contract_number}
                        </td>
                        <td className="py-3 px-space-md font-semibold text-primary">
                          {c.partner_name}
                        </td>
                        <td className="py-3 px-space-md">
                          <Tag color={c.partner_type === 'VENDOR' ? 'blue' : 'purple'}>
                            {c.partner_type}
                          </Tag>
                        </td>
                        <td className="py-3 px-space-md font-mono font-bold text-error">
                          {c.liability_cap ? `${c.liability_cap.toLocaleString('vi-VN')} đ` : '500.000.000 đ (Luật định)'}
                        </td>
                        <td className="py-3 px-space-md font-mono text-outline">
                          {c.waiting_fee_per_hour ? `${c.waiting_fee_per_hour.toLocaleString('vi-VN')} đ/h` : 'Miễn phí 60p'}
                        </td>
                        <td className="py-3 px-space-md text-outline">
                          {c.valid_from ? `${new Date(c.valid_from).toLocaleDateString('vi-VN')} ➔ ${new Date(c.valid_to).toLocaleDateString('vi-VN')}` : 'Vô thời hạn'}
                        </td>
                        <td className="py-3 px-space-md">
                          <Tag color={c.status === 'ACTIVE' ? 'green' : 'default'}>
                            {c.status}
                          </Tag>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-MODULE 3: LOCATIONS READ-ONLY (SCREEN 37) */}
      {activeMainTab === 'LOCATIONS' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md border border-outline-variant/20 space-y-space-md">
          <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-surface-container pb-space-sm">
            <div>
              <h3 className="text-lg font-bold text-primary">
                Mạng Lưới Địa Điểm & Kho Bãi Ga Hàng (Chế Độ Chỉ Đọc)
              </h3>
              <p className="text-xs text-outline">
                Danh sách các điểm dừng, ga hàng không ALS và ICD phục vụ trung chuyển hàng hóa
              </p>
            </div>

            <div className="w-full sm:w-72 relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px] pointer-events-none">
                search
              </span>
              <input
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-space-md bg-surface-container-low rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
                placeholder="Tìm mã hoặc tên địa điểm..."
                type="text"
              />
            </div>
          </div>

          {locationsLoading ? (
            <div className="py-16 flex justify-center"><Spin size="large" /></div>
          ) : locations.length === 0 ? (
            <div className="py-12 text-center text-outline">Chưa có dữ liệu địa điểm trong hệ thống.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant uppercase text-xs font-bold tracking-wider">
                    <th className="py-3 px-space-md">MÃ ĐỊA ĐIỂM</th>
                    <th className="py-3 px-space-md">TÊN ĐIỂM DỪNG / KHO</th>
                    <th className="py-3 px-space-md">ĐỊA CHỈ</th>
                    <th className="py-3 px-space-md">TỌA ĐỘ GPS (LAT / LNG)</th>
                    <th className="py-3 px-space-md">PHÂN LOẠI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-xs">
                  {locations
                    .filter((l) => !locationSearch || l.code?.toLowerCase().includes(locationSearch.toLowerCase()) || l.name?.toLowerCase().includes(locationSearch.toLowerCase()))
                    .map((loc) => (
                      <tr key={loc.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3 px-space-md font-mono font-bold text-primary">
                          {loc.code || `LOC-${loc.id}`}
                        </td>
                        <td className="py-3 px-space-md font-bold text-primary">
                          {loc.name}
                        </td>
                        <td className="py-3 px-space-md text-on-surface-variant">
                          {loc.address}
                        </td>
                        <td className="py-3 px-space-md font-mono text-outline">
                          {loc.latitude}, {loc.longitude}
                        </td>
                        <td className="py-3 px-space-md">
                          <Tag color="cyan">{loc.type || 'WAREHOUSE'}</Tag>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL SCREEN 29: THÊM / SỬA NHÀ XE ĐỐI TÁC (UC-23) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary font-headline-sm font-bold">
            <span className="material-symbols-outlined text-secondary">domain</span>
            <span>{editingVendor ? 'Cập Nhật Nhà Xe Đối Tác' : 'Khai Báo Nhà Xe Đối Tác Mới'}</span>
          </div>
        }
        open={isVendorModalOpen}
        onCancel={() => setIsVendorModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-bold uppercase text-outline mb-1">
              Tên Công Ty Nhà Xe (Company Name): *
            </label>
            <Input
              value={vendorForm.company_name}
              onChange={(e) => setVendorForm({ ...vendorForm, company_name: e.target.value })}
              placeholder="VD: Công ty Vận tải Quốc tế ALS Logistics"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-outline mb-1">
                Người Đại Diện / Liên Hệ:
              </label>
              <Input
                value={vendorForm.contact_person}
                onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                placeholder="VD: Nguyễn Văn Nam"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-outline mb-1">
                Số Điện Thoại Liên Hệ:
              </label>
              <Input
                value={vendorForm.phone}
                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                placeholder="VD: 0988776655"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-outline mb-1">
              Chủng Loại Xe Tải Cung Cấp:
            </label>
            <Input
              value={vendorForm.truck_types}
              onChange={(e) => setVendorForm({ ...vendorForm, truck_types: e.target.value })}
              placeholder="VD: Xe tải 1.5T - 8T thùng kín, xe đông lạnh"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-container">
            <button
              onClick={() => setIsVendorModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-surface-container-low text-on-surface hover:bg-surface-container text-xs font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleSaveVendor}
              disabled={savingVendor}
              className="px-5 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container transition-all cursor-pointer shadow-sm"
            >
              {savingVendor ? 'Đang lưu...' : 'Lưu thông tin nhà xe'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
