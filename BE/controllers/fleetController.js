/**
 * Fleet Controller Barrel Export — Quản lý Đội xe, Hồ sơ Tài xế, Lịch Phân ca & Tài khoản Nhân viên Vận hành
 * Phân chia trách nhiệm:
 * - Validation & Error Helpers: BE/controllers/fleet/fleetValidationHelper.js
 * - Trucks & Vehicles Overview: BE/controllers/fleet/fleetTruckController.js
 * - Drivers, Vendors & Staff Accounts: BE/controllers/fleet/fleetDriverVendorController.js
 * - Driver Shifts & Leave Requests: BE/controllers/fleet/fleetShiftController.js
 */

const fleetService = require('../services/fleetService');
const {
  getFleetTrucks,
  createFleetTruck,
  updateFleetTruck,
  getVehicles,
  createTruck,
  updateTruck,
  updateTruckStatus,
  deleteTruck
} = require('./fleet/fleetTruckController');
const {
  getFleetDrivers,
  updateFleetDriver,
  getFleetVendors,
  getStaffAccounts,
  getStaffAccountDetail,
  createStaffAccount,
  updateStaffAccount,
  updateAccountStatus,
  createDriver,
  updateDriverProfile
} = require('./fleet/fleetDriverVendorController');
const {
  getShifts,
  autoAssignNextWeekShifts,
  sendShiftReminders,
  approveDriverWeekShifts,
  switchDriverWeekShiftType,
  createShift,
  updateShift,
  approveShift,
  rejectShift,
  deleteShift,
  getLeaveRequests,
  decideLeaveRequest
} = require('./fleet/fleetShiftController');

module.exports = {
  // Dispatcher Fleet & Drivers
  getTruckModelName: fleetService.getTruckModelName,
  getTruckCategory: fleetService.getTruckCategory,
  getFleetTrucks,
  createFleetTruck,
  updateFleetTruck,
  getFleetDrivers,
  updateFleetDriver,
  getFleetVendors,

  // Manager Staff Accounts
  getStaffAccounts,
  getStaffAccountDetail,
  createStaffAccount,
  updateStaffAccount,
  updateAccountStatus,

  // Manager Trucks & Driver Profiles
  getVehicles,
  createTruck,
  updateTruck,
  updateTruckStatus,
  deleteTruck,
  createDriver,
  updateDriverProfile,

  // Manager Driver Shifts
  getShifts,
  autoAssignNextWeekShifts,
  sendShiftReminders,
  approveDriverWeekShifts,
  switchDriverWeekShiftType,
  createShift,
  updateShift,
  approveShift,
  rejectShift,
  deleteShift,
  getLeaveRequests,
  decideLeaveRequest
};
