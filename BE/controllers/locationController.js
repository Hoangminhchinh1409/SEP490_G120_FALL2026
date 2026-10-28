const supabase = require('../config/supabase');
const locationService = require('../services/locationService');

/**
 * Location Controller — Nhóm chức năng Quản lý Địa điểm / Kho bãi (UC-40 - Screen 37 & Screen 38)
 * - Dispatcher: Xem danh sách, Thêm mới, Cập nhật, Xóa địa điểm (Geofence, tọa độ).
 * - Manager: Tra cứu danh sách địa điểm ở chế độ Chỉ đọc (Read-only).
 */

const getAllLocations = async (req, res) => {
  try {
    const formattedLocations = await locationService.getAllLocations();
    return res.json({ locations: formattedLocations });
  } catch (err) {
    console.error('getAllLocations error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách địa điểm', error: err.message });
  }
};

const createLocation = async (req, res) => {
  try {
    const userId = req.user?.id || 3;
    const newLoc = await locationService.createLocation(req.body, userId);
    return res.status(201).json({ message: 'Thêm địa điểm thành công', location: newLoc });
  } catch (err) {
    console.error('createLocation error:', err);
    const statusCode = err.message.includes('bắt buộc') ? 400 : 500;
    return res.status(statusCode).json({ message: err.message || 'Lỗi thêm địa điểm' });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await locationService.updateLocation(id, req.body);
    return res.json({ message: 'Cập nhật địa điểm thành công', location: updated });
  } catch (err) {
    console.error('updateLocation error:', err);
    return res.status(500).json({ message: 'Lỗi cập nhật địa điểm', error: err.message });
  }
};

const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;
    await locationService.deleteLocation(id);
    return res.json({ message: 'Đã xóa địa điểm thành công' });
  } catch (err) {
    console.error('deleteLocation error:', err);
    const statusCode = err.statusCode || (err.code === '23503' ? 400 : 500);
    return res.status(statusCode).json({
      message: err.message || 'Lỗi xóa địa điểm',
      error: err
    });
  }
};

// Tra cứu Danh sách Địa điểm / Kho bãi Read-only cho Manager (Screen 37)
const getLocations = async (req, res) => {
  try {
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    return res.json({
      locations: locations || [],
      is_read_only: true
    });
  } catch (error) {
    console.error('getLocations Error:', error);
    return res.status(500).json({ message: 'Lỗi tra cứu địa điểm', error: error.message });
  }
};

module.exports = {
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocations
};

