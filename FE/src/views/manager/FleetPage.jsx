"use client";
import React, { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import dayjs from 'dayjs';
import { managerApi } from '../../api/managerApi';
import DriverShiftsPage from './DriverShiftsPage';
import FleetTrucksTab from './fleet/FleetTrucksTab';
import FleetDriversTab from './fleet/FleetDriversTab';
import { FleetTruckModal, FleetDriverModal } from './fleet/FleetModals';

export default function FleetPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TRUCKS'); // 'TRUCKS' | 'DRIVERS' | 'SHIFTS'

  // Data states
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [selectedTruckStatus, setSelectedTruckStatus] = useState('ALL');

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

  // ==========================================
  // XỬ LÝ XE TẢI (UC-18 - Screen 21 & 22)
  // ==========================================
  const handleOpenCreateTruck = () => {
    setEditingTruck(null);
    setIsTruckModalOpen(true);
    setTimeout(() => {
      truckForm.resetFields();
      truckForm.setFieldsValue({
        status: 'AVAILABLE',
        required_license_class: 'C',
        allowed_payload: 5000,
        box_length: 620,
        box_width: 210,
        box_height: 220
      });
    }, 0);
  };

  const handleOpenEditTruck = (truck) => {
    setEditingTruck(truck);
    setIsTruckModalOpen(true);
    setTimeout(() => {
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
    }, 0);
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
        message.success(`Cập nhật thông tin xe ${values.plate_number} thành công.`);
      } else {
        await managerApi.createTruck(payload);
        message.success(`Thêm mới xe tải ${values.plate_number} thành công.`);
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
    setIsDriverModalOpen(true);
    setTimeout(() => {
      driverForm.resetFields();
      driverForm.setFieldsValue({
        license_class: 'C',
        status: 'ACTIVE'
      });
    }, 0);
  };

  const handleOpenEditDriver = (driver) => {
    setEditingDriver(driver);
    setIsDriverModalOpen(true);
    setTimeout(() => {
      driverForm.resetFields();
      driverForm.setFieldsValue({
        full_name: driver.name || driver.full_name,
        phone: driver.phone,
        license_number: driver.license_number,
        license_class: driver.license_class || driver.license,
        expiry: driver.expiry || driver.license_expiry ? dayjs(driver.expiry || driver.license_expiry) : null,
        status: driver.status || 'ACTIVE'
      });
    }, 0);
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
        message.success('Cập nhật hồ sơ tài xế thành công.');
      } else {
        await managerApi.createDriver(payload);
        message.success('Đăng ký tài xế mới thành công.');
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

  // KPIs
  const totalTrucks = trucks.length;
  const activeTrucks = trucks.filter((t) => t.status === 'ON_TRIP').length;
  const expiredTrucks = trucks.filter((t) => t.is_inspection_expired).length;

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
                {expiredTrucks} xe hết hạn đăng kiểm
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Khai báo thông số kỹ thuật xe tải, giám sát hạn kiểm định, quản lý hồ sơ tài xế và phê duyệt ca làm việc tuần.
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
            <span>Đội xe tải</span>
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
            <span>Hồ sơ tài xế</span>
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
            <span>Lịch ca trực &amp; Phê duyệt</span>
          </button>
        </div>
      </div>

      {/* TAB 1: QUẢN LÝ ĐỘI XE TẢI */}
      {activeTab === 'TRUCKS' && (
        <FleetTrucksTab
          trucks={trucks}
          loading={loading}
          searchText={searchText}
          setSearchText={setSearchText}
          selectedTruckStatus={selectedTruckStatus}
          setSelectedTruckStatus={setSelectedTruckStatus}
          handleOpenEditTruck={handleOpenEditTruck}
          handleQuickStatusChange={handleQuickStatusChange}
          handleDeleteTruck={handleDeleteTruck}
        />
      )}

      {/* TAB 2: HỒ SƠ TÀI XẾ */}
      {activeTab === 'DRIVERS' && (
        <FleetDriversTab
          drivers={drivers}
          loading={loading}
          handleOpenEditDriver={handleOpenEditDriver}
        />
      )}

      {/* TAB 3: LỊCH PHÂN CA & PHÊ DUYỆT CA */}
      {activeTab === 'SHIFTS' && (
        <DriverShiftsPage />
      )}

      {/* MODAL 1: KHAI BÁO / CHI TIẾT XE TẢI */}
      <FleetTruckModal
        open={isTruckModalOpen}
        onCancel={() => setIsTruckModalOpen(false)}
        editingTruck={editingTruck}
        form={truckForm}
        onFinish={handleSaveTruck}
        submitting={submittingTruck}
      />

      {/* MODAL 2: CHI TIẾT HỒ SƠ TÀI XẾ */}
      <FleetDriverModal
        open={isDriverModalOpen}
        onCancel={() => setIsDriverModalOpen(false)}
        editingDriver={editingDriver}
        form={driverForm}
        onFinish={handleSaveDriver}
        submitting={submittingDriver}
      />
    </div>
  );
}
