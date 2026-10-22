"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select, DatePicker, TimePicker, message, Spin, Badge, Tooltip, Popconfirm, Alert } from 'antd';
import dayjs from 'dayjs';
import { managerApi } from '../../api/managerApi';

export default function FleetPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TRUCKS'); // 'TRUCKS' | 'DRIVERS' | 'SHIFTS'

  // Data states
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [shiftLoading, setShiftLoading] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [selectedTruckStatus, setSelectedTruckStatus] = useState('ALL');
  const [currentWeekStart, setCurrentWeekStart] = useState(dayjs().startOf('week').add(1, 'day')); // Thứ 2

  // Modals
  // 1. Truck Modal (Screen 22 - UC-18)
  const [isTruckModalOpen, setIsTruckModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);
  const [truckForm] = Form.useForm();
  const [submittingTruck, setSubmittingTruck] = useState(false);

  // 2. Driver Modal (Screen 24 - UC-19)
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [driverForm] = Form.useForm();
  const [submittingDriver, setSubmittingDriver] = useState(false);

  // 3. Shift Modal (Screen 25 - UC-20 V2)
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftForm] = Form.useForm();
  const [submittingShift, setSubmittingShift] = useState(false);
  const [rejectModal, setRejectModal] = useState({ open: false, shiftId: null, reason: '' });

  // Load Đội xe & Tài xế
  const fetchFleetData = async () => {
    setLoading(true);
    try {
      const data = await managerApi.getVehicles();
      setTrucks(data.trucks || []);
      setDrivers(data.drivers || []);
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu đội xe:', error);
      message.error('Không thể kết nối Backend để lấy danh sách đội xe.');
    } finally {
      setLoading(false);
    }
  };

  // Load Ca làm việc (Shifts)
  const fetchShifts = async () => {
    setShiftLoading(true);
    try {
      const weekStartStr = currentWeekStart.format('YYYY-MM-DD');
      const weekEndStr = currentWeekStart.add(6, 'day').format('YYYY-MM-DD');
      const data = await managerApi.getShifts({ from: weekStartStr, to: weekEndStr });
      setShifts(data.shifts || []);
    } catch (error) {
      console.error('Lỗi khi tải lịch ca trực:', error);
      message.error('Lỗi khi lấy dữ liệu ca trực tài xế.');
    } finally {
      setShiftLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadFleet() {
      try {
        const data = await managerApi.getVehicles();
        if (!ignore) {
          setTrucks(data.trucks || []);
          setDrivers(data.drivers || []);
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu đội xe:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadFleet();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    if (activeTab === 'SHIFTS') {
      async function loadWeeklyShifts() {
        try {
          const weekStartStr = currentWeekStart.format('YYYY-MM-DD');
          const weekEndStr = currentWeekStart.add(6, 'day').format('YYYY-MM-DD');
          const data = await managerApi.getShifts({ from: weekStartStr, to: weekEndStr });
          if (!ignore) {
            setShifts(data.shifts || []);
          }
        } catch (err) {
          console.error('Lỗi khi tải lịch ca trực:', err);
        } finally {
          if (!ignore) setShiftLoading(false);
        }
      }
      loadWeeklyShifts();
    }
    return () => { ignore = true; };
  }, [activeTab, currentWeekStart]);

  // ==========================================
  // XỬ LÝ XE TẢI (UC-18 - Screen 21 & 22)
  // ==========================================
  const handleOpenCreateTruck = () => {
    setEditingTruck(null);
    truckForm.resetFields();
    truckForm.setFieldsValue({
      status: 'AVAILABLE',
      required_license_class: 'C',
      allowed_payload: 5000,
      box_length: 620,
      box_width: 210,
      box_height: 220
    });
    setIsTruckModalOpen(true);
  };

  const handleOpenEditTruck = (truck) => {
    setEditingTruck(truck);
    truckForm.resetFields();
    truckForm.setFieldsValue({
      plate_number: truck.plate_number,
      model: truck.model,
      allowed_payload: truck.payload_kg || truck.allowed_payload,
      box_length: truck.box_length || truck.box_length_cm,
      box_width: truck.box_width || truck.box_width_cm,
      box_height: truck.box_height || truck.box_height_cm,
      required_license_class: truck.required_license_class,
      gps_device_id: truck.gps_device_id,
      inspection_expiry: truck.inspection_expiry ? dayjs(truck.inspection_expiry) : null,
      insurance_expiry: truck.insurance_expiry ? dayjs(truck.insurance_expiry) : null,
      status: truck.status
    });
    setIsTruckModalOpen(true);
  };

  const handleSaveTruck = async (values) => {
    try {
      setSubmittingTruck(true);
      const payload = {
        plate_number: values.plate_number,
        model: values.model,
        allowed_payload: Number(values.allowed_payload),
        payload_kg: Number(values.allowed_payload),
        box_length: Number(values.box_length),
        box_width: Number(values.box_width),
        box_height: Number(values.box_height),
        required_license_class: values.required_license_class,
        gps_device_id: values.gps_device_id,
        inspection_expiry: values.inspection_expiry ? values.inspection_expiry.format('YYYY-MM-DD') : null,
        insurance_expiry: values.insurance_expiry ? values.insurance_expiry.format('YYYY-MM-DD') : null,
        status: values.status
      };

      if (editingTruck) {
        await managerApi.updateTruck(editingTruck.id, payload);
        message.success(`Cập nhật thông tin xe ${values.plate_number} thành công (MSG07).`);
      } else {
        await managerApi.createTruck(payload);
        message.success(`Thêm mới xe tải ${values.plate_number} thành công (MSG07).`);
      }

      setIsTruckModalOpen(false);
      fetchFleetData();
    } catch (error) {
      console.error('Lỗi khi lưu xe tải:', error);
      message.error(error.message || 'Lỗi khi lưu thông tin xe tải.');
    } finally {
      setSubmittingTruck(false);
    }
  };

  const handleQuickStatusChange = async (truckId, newStatus) => {
    try {
      await managerApi.updateTruckStatus(truckId, newStatus);
      message.success(`Đã cập nhật trạng thái xe thành ${newStatus}.`);
      fetchFleetData();
    } catch (error) {
      console.error('Lỗi khi đổi trạng thái xe:', error);
      message.error(error.message || 'Không thể đổi trạng thái xe.');
    }
  };

  const handleDeleteTruck = async (truckId) => {
    try {
      await managerApi.deleteTruck(truckId);
      message.success('Đã chuyển xe sang trạng thái Ngưng hoạt động (Inactive).');
      fetchFleetData();
    } catch (error) {
      console.error('Lỗi khi xóa xe:', error);
      message.error(error.message || 'Không thể thao tác.');
    }
  };

  // ==========================================
  // XỬ LÝ HỒ SƠ TÀI XẾ (UC-19 - Screen 23 & 24)
  // ==========================================
  const handleOpenCreateDriver = () => {
    setEditingDriver(null);
    driverForm.resetFields();
    driverForm.setFieldsValue({
      license_class: 'C',
      status: 'ACTIVE'
    });
    setIsDriverModalOpen(true);
  };

  const handleOpenEditDriver = (driver) => {
    setEditingDriver(driver);
    driverForm.resetFields();
    driverForm.setFieldsValue({
      full_name: driver.name || driver.full_name,
      phone: driver.phone,
      license_number: driver.license_number,
      license_class: driver.license_class || driver.license,
      expiry: driver.expiry || driver.license_expiry ? dayjs(driver.expiry || driver.license_expiry) : null,
      status: driver.status || 'ACTIVE'
    });
    setIsDriverModalOpen(true);
  };

  const handleSaveDriver = async (values) => {
    try {
      setSubmittingDriver(true);
      const payload = {
        name: values.full_name,
        full_name: values.full_name,
        phone: values.phone,
        license_number: values.license_number,
        license_class: values.license_class,
        expiry: values.expiry ? values.expiry.format('YYYY-MM-DD') : null,
        status: values.status
      };

      if (editingDriver) {
        await managerApi.updateDriverProfile(editingDriver.id, payload);
        message.success('Cập nhật hồ sơ tài xế thành công (MSG07).');
      } else {
        await managerApi.createDriver(payload);
        message.success('Đăng ký tài xế mới thành công (MSG07).');
      }

      setIsDriverModalOpen(false);
      fetchFleetData();
    } catch (error) {
      console.error('Lỗi khi lưu tài xế:', error);
      message.error(error.message || 'Lỗi khi lưu hồ sơ tài xế.');
    } finally {
      setSubmittingDriver(false);
    }
  };

  // ==========================================
  // XỬ LÝ CA TRỰC TÀI XẾ (UC-20 V2 - Screen 25)
  // ==========================================
  const handleApproveShift = async (shift) => {
    try {
      const res = await managerApi.approveShift(shift.id);
      message.success(res.message || 'Đã duyệt ca làm việc thành công (MSG80).');
      if (res.warning) {
        message.warning(res.warning, 6);
      }
      fetchShifts();
    } catch (error) {
      console.error('Lỗi khi duyệt ca:', error);
      message.error(error.message || 'Lỗi khi duyệt ca.');
    }
  };

  const handleConfirmRejectShift = async () => {
    try {
      await managerApi.rejectShift(rejectModal.shiftId, rejectModal.reason);
      message.success('Đã từ chối ca làm việc (MSG80).');
      setRejectModal({ open: false, shiftId: null, reason: '' });
      fetchShifts();
    } catch (error) {
      console.error('Lỗi khi từ chối ca:', error);
      message.error(error.message || 'Lỗi khi từ chối ca.');
    }
  };

  const handleCreateManagerShift = async (values) => {
    try {
      setSubmittingShift(true);
      const dateStr = values.date.format('YYYY-MM-DD');
      const startStr = values.time_range[0].format('HH:mm');
      const endStr = values.time_range[1].format('HH:mm');

      const payload = {
        driver_id: values.driver_id,
        date: dateStr,
        start_time: `${dateStr}T${startStr}:00+07:00`,
        end_time: `${dateStr}T${endStr}:00+07:00`,
        note: values.note || 'Ca trực do Quản lý xếp'
      };

      const res = await managerApi.createShift(payload);
      message.success(res.message || 'Xếp ca làm việc cho tài xế thành công.');
      if (res.warning) {
        message.warning(res.warning, 6);
      }
      setIsShiftModalOpen(false);
      shiftForm.resetFields();
      fetchShifts();
    } catch (error) {
      console.error('Lỗi khi tạo ca trực:', error);
      message.error(error.message || 'Lỗi khi tạo ca trực.');
    } finally {
      setSubmittingShift(false);
    }
  };

  // KPIs
  const totalTrucks = trucks.length;
  const activeTrucks = trucks.filter((t) => t.status === 'ON_TRIP').length;
  const expiredTrucks = trucks.filter((t) => t.is_inspection_expired).length;

  const pendingShifts = useMemo(() => {
    return shifts.filter(s => s.status === 'Requested');
  }, [shifts]);

  // Lọc xe tải
  const filteredTrucks = useMemo(() => {
    return trucks.filter((truck) => {
      const matchSearch =
        !searchText ||
        truck.plate_number?.toLowerCase().includes(searchText.toLowerCase()) ||
        truck.model?.toLowerCase().includes(searchText.toLowerCase());

      const matchStatus =
        selectedTruckStatus === 'ALL' || truck.status === selectedTruckStatus;

      return matchSearch && matchStatus;
    });
  }, [trucks, searchText, selectedTruckStatus]);

  // Tuần làm việc (7 ngày từ Thứ 2 đến Chủ Nhật)
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = currentWeekStart.add(i, 'day');
      days.push({
        dateStr: d.format('YYYY-MM-DD'),
        dayName: i === 6 ? 'Chủ Nhật' : `Thứ ${i + 2}`,
        displayDate: d.format('DD/MM'),
        isToday: d.isSame(dayjs(), 'day'),
        dayMoment: d
      });
    }
    return days;
  }, [currentWeekStart]);

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Quản lý Đội xe &amp; Ca trực Tài xế
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              Đang vận hành: {activeTrucks}/{totalTrucks} Xe
            </span>
            {expiredTrucks > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 font-semibold text-xs border border-red-200">
                <span className="material-symbols-outlined text-sm">warning</span>
                {expiredTrucks} xe hết hạn đăng kiểm (BR-24)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Khai báo thông số kỹ thuật xe tải, giám sát hạn kiểm định (BR-24), quản lý hồ sơ tài xế và phê duyệt ca làm việc tuần (UC-20 V2).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'TRUCKS' && (
            <button
              onClick={handleOpenCreateTruck}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>+ Khai báo xe mới</span>
            </button>
          )}

          {activeTab === 'DRIVERS' && (
            <button
              onClick={handleOpenCreateDriver}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>+ Thêm hồ sơ tài xế</span>
            </button>
          )}

          {activeTab === 'SHIFTS' && (
            <button
              onClick={() => {
                shiftForm.resetFields();
                shiftForm.setFieldsValue({
                  date: dayjs(),
                  time_range: [dayjs().hour(8).minute(0), dayjs().hour(17).minute(0)]
                });
                setIsShiftModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">more_time</span>
              <span>+ Xếp ca mới (Manager)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Chuyển đổi Modules */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('TRUCKS')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === 'TRUCKS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[19px]">local_shipping</span>
            <span>Đội xe tải (Screen 21 &amp; 22)</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-mono">
              {trucks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DRIVERS')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === 'DRIVERS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[19px]">badge</span>
            <span>Hồ sơ tài xế (Screen 23 &amp; 24)</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-mono">
              {drivers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('SHIFTS')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer relative ${
              activeTab === 'SHIFTS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[19px]">calendar_month</span>
            <span>Lịch ca trực &amp; Phê duyệt (Screen 25 V2)</span>
            {pendingShifts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500 text-white font-bold animate-bounce">
                {pendingShifts.length} chờ duyệt
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: QUẢN LÝ ĐỘI XE TẢI (SCREEN 21 & 22) */}
      {/* ========================================================= */}
      {activeTab === 'TRUCKS' && (
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
                    <th className="py-3 px-4">Tải trọng (BR-33)</th>
                    <th className="py-3 px-4">Kích thước Thùng (D×R×C)</th>
                    <th className="py-3 px-4">Hạng bằng yêu cầu</th>
                    <th className="py-3 px-4">Hạn đăng kiểm (BR-24)</th>
                    <th className="py-3 px-4">Hạn bảo hiểm</th>
                    <th className="py-3 px-4 text-center">Trạng thái (BR-24)</th>
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
                              <span className="material-symbols-outlined text-blue-600 text-[20px]">local_shipping</span>
                              <div>
                                <span className="font-bold text-slate-900 block font-mono">{truck.plate_number}</span>
                                <span className="text-xs text-slate-500">{truck.model}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                            {Number(truck.payload_kg || truck.allowed_payload).toLocaleString('vi-VN')} kg
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                            {truck.box_length || 620} × {truck.box_width || 210} × {truck.box_height || 220} cm
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-xs">
                              Hạng {truck.required_license_class || 'C'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {truck.inspection_expiry ? (
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-mono ${isExpired ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                                  {new Date(truck.inspection_expiry).toLocaleDateString('vi-VN')}
                                </span>
                                {isExpired && (
                                  <Tooltip title="Đăng kiểm đã hết hạn! Hệ thống chặn trạng thái Sẵn sàng theo BR-24">
                                    <span className="material-symbols-outlined text-red-500 text-[16px]">error</span>
                                  </Tooltip>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                            {truck.insurance_expiry ? new Date(truck.insurance_expiry).toLocaleDateString('vi-VN') : '—'}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <Select
                              value={truck.status}
                              size="small"
                              className="w-36 text-xs font-semibold"
                              onChange={(val) => handleQuickStatusChange(truck.id, val)}
                              options={[
                                { value: 'AVAILABLE', label: '🟢 Sẵn sàng' },
                                { value: 'ON_TRIP', label: '🔵 Đang chạy' },
                                { value: 'MAINTENANCE', label: '🟠 Bảo dưỡng' },
                                { value: 'INACTIVE', label: '⚪ Ngưng HĐ' }
                              ]}
                            />
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Tooltip title="Cập nhật chi tiết xe (Screen 22)">
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
      )}

      {/* ========================================================= */}
      {/* TAB 2: HỒ SƠ TÀI XẾ (SCREEN 23 & 24) */}
      {/* ========================================================= */}
      {activeTab === 'DRIVERS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">Danh Sách Hồ Sơ Tài Xế ({drivers.length})</h2>
            <span className="text-xs text-slate-500">Liên kết tài khoản và chứng chỉ lái xe an toàn</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tài xế</th>
                  <th className="py-3 px-4">Số điện thoại</th>
                  <th className="py-3 px-4">Số GPLX</th>
                  <th className="py-3 px-4">Hạng bằng</th>
                  <th className="py-3 px-4">Hạn GPLX</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map((driver) => {
                  const isExp = driver.is_license_expired;
                  return (
                    <tr key={driver.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200">
                            {(driver.name || 'D').charAt(0).toUpperCase()}
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
                          <span>Chi tiết (Screen 24)</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LỊCH PHÂN CA & PHÊ DUYỆT CA (SCREEN 25 V2) */}
      {/* ========================================================= */}
      {activeTab === 'SHIFTS' && (
        <div className="space-y-6">
          {/* Cụm Ca Chờ Duyệt (Pending Shifts - PWA Submitted) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[22px]">pending_actions</span>
                <h2 className="font-bold text-slate-900 text-base">
                  Yêu Cầu Đăng Ký Ca Trực Chờ Quản Lý Duyệt (UC-20 V2)
                </h2>
                <Badge count={pendingShifts.length} overflowCount={99} className="ml-2" />
              </div>
              <span className="text-xs text-amber-800">
                Tài xế chủ động đăng ký ca qua Driver PWA. Duyệt hoặc Từ chối sẽ tự động gửi thông báo <strong>MSG80</strong>.
              </span>
            </div>

            {pendingShifts.length === 0 ? (
              <div className="bg-white/80 p-6 rounded-xl text-center text-slate-400 text-sm">
                Hiện không có ca trực nào đang chờ duyệt trong tuần này.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingShifts.map((shift) => (
                  <div key={shift.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">{shift.driver_name}</span>
                          <span className="text-xs text-slate-500 font-mono">{shift.driver_phone} • Hạng {shift.license_class}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-xs">
                          Chờ duyệt
                        </span>
                      </div>

                      <div className="mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1">
                        <div className="flex justify-between text-slate-700">
                          <span className="text-slate-400">Ngày trực:</span>
                          <span className="font-semibold font-mono">{shift.date}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span className="text-slate-400">Thời gian:</span>
                          <span className="font-bold text-blue-700 font-mono">
                            {dayjs(shift.start_time).format('HH:mm')} - {dayjs(shift.end_time).format('HH:mm')} ({shift.duration_hours}h)
                          </span>
                        </div>
                        {shift.note && (
                          <div className="text-slate-500 italic pt-1 border-t border-slate-200">
                            &quot;{shift.note}&quot;
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => setRejectModal({ open: true, shiftId: shift.id, reason: '' })}
                        className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Từ chối
                      </button>
                      <button
                        onClick={() => handleApproveShift(shift)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                      >
                        Duyệt ca (MSG80)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lưới Tuần Phân Ca (Screen 25 - Weekly Grid T2 -> CN) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            {/* Header Tuần */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">Bảng Lưới Ca Trực Tuần</span>
                <span className="text-xs text-slate-500 font-mono">
                  ({weekDays[0].displayDate} - {weekDays[6].displayDate})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentWeekStart(currentWeekStart.subtract(1, 'week'))}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  title="Tuần trước"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button
                  onClick={() => setCurrentWeekStart(dayjs().startOf('week').add(1, 'day'))}
                  className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Tuần hiện tại
                </button>
                <button
                  onClick={() => setCurrentWeekStart(currentWeekStart.add(1, 'week'))}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  title="Tuần sau"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Cột 7 Ngày trong Tuần */}
            {shiftLoading ? (
              <div className="py-16 text-center">
                <Spin size="large" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {weekDays.map((day) => {
                  const dayShifts = shifts.filter(s => s.date === day.dateStr);
                  return (
                    <div
                      key={day.dateStr}
                      className={`rounded-xl border p-3 min-h-[280px] flex flex-col justify-between ${
                        day.isToday ? 'bg-blue-50/40 border-blue-300' : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <div>
                        {/* Day Header */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                          <div>
                            <span className={`font-bold text-xs ${day.isToday ? 'text-blue-700' : 'text-slate-800'}`}>
                              {day.dayName}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-mono">{day.displayDate}</span>
                          </div>
                          {day.isToday && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-600 text-white font-bold">
                              Hôm nay
                            </span>
                          )}
                        </div>

                        {/* List Shifts in Day */}
                        <div className="space-y-2">
                          {dayShifts.length === 0 ? (
                            <span className="text-[11px] text-slate-400 italic block py-4 text-center">Không có ca</span>
                          ) : (
                            dayShifts.map((sh) => (
                              <div
                                key={sh.id}
                                className={`p-2 rounded-lg text-xs border shadow-2xs ${
                                  sh.status === 'Approved'
                                    ? 'bg-white border-emerald-200 text-slate-800'
                                    : sh.status === 'Requested'
                                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                                    : 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                                }`}
                              >
                                <div className="font-bold truncate">{sh.driver_name}</div>
                                <div className="font-mono text-[11px] font-semibold text-blue-700 mt-0.5">
                                  {dayjs(sh.start_time).format('HH:mm')} - {dayjs(sh.end_time).format('HH:mm')}
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[10px]">
                                  <span className="text-slate-500">{sh.duration_hours} giờ</span>
                                  <span className={`font-semibold ${
                                    sh.status === 'Approved' ? 'text-emerald-600' : 'text-amber-600'
                                  }`}>
                                    {sh.status === 'Approved' ? 'Đã duyệt' : sh.status === 'Requested' ? 'Chờ duyệt' : 'Từ chối'}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Nút xếp nhanh ca vào ngày này */}
                      <button
                        onClick={() => {
                          shiftForm.resetFields();
                          shiftForm.setFieldsValue({
                            date: day.dayMoment,
                            time_range: [day.dayMoment.hour(8).minute(0), day.dayMoment.hour(17).minute(0)]
                          });
                          setIsShiftModalOpen(true);
                        }}
                        className="w-full mt-2 py-1 text-[11px] rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-medium cursor-pointer transition-colors"
                      >
                        + Xếp ca
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: KHAI BÁO / CHI TIẾT XE TẢI (SCREEN 22) */}
      {/* ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="material-symbols-outlined text-blue-600">local_shipping</span>
            <span className="font-bold text-slate-900 text-base">
              {editingTruck ? `Cập nhật thông tin Xe tải ${editingTruck.plate_number}` : 'Khai báo thông số Xe tải mới (Screen 22)'}
            </span>
          </div>
        }
        open={isTruckModalOpen}
        onCancel={() => setIsTruckModalOpen(false)}
        footer={null}
        destroyOnHidden
        width={680}
      >
        <Form form={truckForm} layout="vertical" onFinish={handleSaveTruck} className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item
              name="plate_number"
              label={<span className="font-semibold text-slate-700">Biển số xe (Plate number - Bắt buộc)</span>}
              rules={[{ required: true, message: 'Vui lòng nhập biển số xe (MSG02)' }]}
            >
              <Input placeholder="VD: 29H-889.99" className="h-10 rounded-lg uppercase font-mono font-bold" />
            </Form.Item>

            <Form.Item
              name="model"
              label={<span className="font-semibold text-slate-700">Model / Dòng xe</span>}
              rules={[{ required: true, message: 'Vui lòng nhập dòng xe' }]}
            >
              <Input placeholder="VD: Hino 500 Series, Isuzu FVR" className="h-10 rounded-lg" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item
              name="allowed_payload"
              label={<span className="font-semibold text-slate-700">Tải trọng tối đa (kg) - BR-33</span>}
              rules={[{ required: true, message: 'Nhập tải trọng cho phép' }]}
              extra="Chặn quá tải khi gán đơn hàng (BR-33)."
            >
              <Input type="number" placeholder="5000" className="h-10 rounded-lg font-mono font-bold" />
            </Form.Item>

            <Form.Item
              name="required_license_class"
              label={<span className="font-semibold text-slate-700">Hạng bằng lái yêu cầu</span>}
              rules={[{ required: true }]}
            >
              <Select
                className="h-10"
                options={[
                  { value: 'B2', label: 'Hạng B2 (Xe tải dưới 3.5 tấn)' },
                  { value: 'C', label: 'Hạng C (Xe tải từ 3.5 tấn trở lên)' },
                  { value: 'FC', label: 'Hạng FC (Xe đầu kéo Container)' }
                ]}
              />
            </Form.Item>
          </div>

          {/* Kích thước thùng D x R x C */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
            <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider block mb-2">
              Kích thước thùng xe (cm) - Phục vụ mô phỏng 3D Load Plan (BR-43)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <Form.Item name="box_length" label="Chiều Dài (cm)" className="mb-0" rules={[{ required: true }]}>
                <Input type="number" placeholder="620" className="rounded-lg font-mono" />
              </Form.Item>
              <Form.Item name="box_width" label="Chiều Rộng (cm)" className="mb-0" rules={[{ required: true }]}>
                <Input type="number" placeholder="210" className="rounded-lg font-mono" />
              </Form.Item>
              <Form.Item name="box_height" label="Chiều Cao (cm)" className="mb-0" rules={[{ required: true }]}>
                <Input type="number" placeholder="220" className="rounded-lg font-mono" />
              </Form.Item>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item
              name="inspection_expiry"
              label={<span className="font-semibold text-slate-700">Hạn đăng kiểm (BR-24)</span>}
              extra="Nếu hết hạn, xe tự động bị khóa không thể bật Available."
            >
              <DatePicker className="w-full h-10 rounded-lg" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
            </Form.Item>

            <Form.Item
              name="insurance_expiry"
              label={<span className="font-semibold text-slate-700">Hạn bảo hiểm trách nhiệm</span>}
            >
              <DatePicker className="w-full h-10 rounded-lg" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item
              name="gps_device_id"
              label={<span className="font-semibold text-slate-700">Mã thiết bị định vị GPS (Hộp đen)</span>}
            >
              <Input placeholder="VD: GPS-ALS-09" className="h-10 rounded-lg font-mono" />
            </Form.Item>

            <Form.Item
              name="status"
              label={<span className="font-semibold text-slate-700">Trạng thái xe</span>}
              rules={[{ required: true }]}
            >
              <Select
                className="h-10"
                options={[
                  { value: 'AVAILABLE', label: 'Sẵn sàng (Available)' },
                  { value: 'MAINTENANCE', label: 'Bảo dưỡng (Maintenance)' },
                  { value: 'INACTIVE', label: 'Ngưng hoạt động (Inactive)' }
                ]}
              />
            </Form.Item>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsTruckModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submittingTruck}
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 cursor-pointer shadow-sm"
            >
              {submittingTruck ? 'Đang lưu...' : 'Lưu thông số xe (MSG07)'}
            </button>
          </div>
        </Form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: CHI TIẾT HỒ SƠ TÀI XẾ (SCREEN 24) */}
      {/* ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="material-symbols-outlined text-emerald-600">badge</span>
            <span className="font-bold text-slate-900 text-base">
              {editingDriver ? `Hồ sơ Tài xế: ${editingDriver.name}` : 'Thêm mới Tài xế vào Đội xe'}
            </span>
          </div>
        }
        open={isDriverModalOpen}
        onCancel={() => setIsDriverModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={driverForm} layout="vertical" onFinish={handleSaveDriver} className="mt-4">
          <Form.Item
            name="full_name"
            label={<span className="font-semibold text-slate-700">Họ và tên tài xế</span>}
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="Nguyễn Văn A" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="phone"
            label={<span className="font-semibold text-slate-700">Số điện thoại liên lạc</span>}
            rules={[{ required: true, message: 'Vui lòng nhập SĐT' }]}
          >
            <Input placeholder="0912345678" className="h-10 rounded-lg" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="license_number"
              label={<span className="font-semibold text-slate-700">Số GPLX</span>}
              rules={[{ required: true, message: 'Nhập số bằng lái' }]}
            >
              <Input placeholder="GPLX-012345" className="h-10 rounded-lg font-mono font-bold" />
            </Form.Item>

            <Form.Item
              name="license_class"
              label={<span className="font-semibold text-slate-700">Hạng bằng lái</span>}
              rules={[{ required: true }]}
            >
              <Select
                className="h-10"
                options={[
                  { value: 'B2', label: 'B2' },
                  { value: 'C', label: 'C' },
                  { value: 'FC', label: 'FC' }
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="expiry"
            label={<span className="font-semibold text-slate-700">Ngày hết hạn GPLX (BR-08)</span>}
          >
            <DatePicker className="w-full h-10 rounded-lg" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
          </Form.Item>

          {editingDriver && (
            <Form.Item
              name="status"
              label={<span className="font-semibold text-slate-700">Trạng thái hồ sơ</span>}
            >
              <Select
                className="h-10"
                options={[
                  { value: 'ACTIVE', label: 'Hoạt động (Active)' },
                  { value: 'INACTIVE', label: 'Tạm dừng (Inactive)' }
                ]}
              />
            </Form.Item>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDriverModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submittingDriver}
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 cursor-pointer shadow-sm"
            >
              {submittingDriver ? 'Đang lưu...' : 'Lưu hồ sơ tài xế'}
            </button>
          </div>
        </Form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: XẾP CA MỚI CHO TÀI XẾ (SCREEN 25 V2) */}
      {/* ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="material-symbols-outlined text-indigo-600">more_time</span>
            <span className="font-bold text-slate-900 text-base">
              Xếp Ca Làm Việc Mới Cho Tài Xế (Screen 25 - Manager)
            </span>
          </div>
        }
        open={isShiftModalOpen}
        onCancel={() => setIsShiftModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={shiftForm} layout="vertical" onFinish={handleCreateManagerShift} className="mt-4">
          <Alert
            message="Ràng buộc ATGT (BR-34):"
            description="Tổng giờ lái trong ngày không được vượt quá 10 giờ và 48 giờ/tuần. Hệ thống sẽ cảnh báo vàng nếu xếp ca vượt mức."
            type="info"
            showIcon
            className="mb-4 text-xs rounded-xl"
          />

          <Form.Item
            name="driver_id"
            label={<span className="font-semibold text-slate-700">Chọn tài xế</span>}
            rules={[{ required: true, message: 'Vui lòng chọn tài xế' }]}
          >
            <Select
              className="h-10"
              placeholder="Chọn tài xế nhận ca..."
              options={drivers.map(d => ({
                value: d.id,
                label: `${d.name || d.full_name} (${d.phone || 'SĐT'} - Hạng ${d.license_class || 'C'})`
              }))}
            />
          </Form.Item>

          <Form.Item
            name="date"
            label={<span className="font-semibold text-slate-700">Ngày làm việc</span>}
            rules={[{ required: true, message: 'Chọn ngày trực' }]}
          >
            <DatePicker className="w-full h-10 rounded-lg" format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item
            name="time_range"
            label={<span className="font-semibold text-slate-700">Khung giờ ca trực (Start - End)</span>}
            rules={[{ required: true, message: 'Chọn giờ bắt đầu và kết thúc' }]}
            extra="Quy định BR-08: Hệ thống sẽ từ chối nếu có 2 ca chồng lấn giờ của cùng 1 tài xế."
          >
            <TimePicker.RangePicker className="w-full h-10 rounded-lg" format="HH:mm" />
          </Form.Item>

          <Form.Item
            name="note"
            label={<span className="font-semibold text-slate-700">Ghi chú phân ca</span>}
          >
            <Input.TextArea rows={2} placeholder="Tuyến bay gấp HAN-SGN, ca sáng..." className="rounded-lg" />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submittingShift}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 cursor-pointer shadow-sm"
            >
              {submittingShift ? 'Đang lưu...' : 'Lưu ca làm việc'}
            </button>
          </div>
        </Form>
      </Modal>

      {/* Modal Nhập lý do từ chối ca trực */}
      <Modal
        title="Lý do từ chối ca trực của tài xế"
        open={rejectModal.open}
        onCancel={() => setRejectModal({ open: false, shiftId: null, reason: '' })}
        onOk={handleConfirmRejectShift}
        okText="Xác nhận từ chối (MSG80)"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p className="text-xs text-slate-500 mb-2">
          Hệ thống sẽ gửi thông báo đến tài xế kèm lý do từ chối của bạn:
        </p>
        <Input.TextArea
          rows={3}
          value={rejectModal.reason}
          onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
          placeholder="VD: Trùng lịch bảo dưỡng xe, cần nghỉ ngơi theo luật ATGT..."
          className="rounded-lg"
        />
      </Modal>
    </div>
  );
}
