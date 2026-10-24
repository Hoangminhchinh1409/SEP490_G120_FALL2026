const locationService = require('./locations.service');

class LocationController {
  async getAllLocations(req, res) {
    try {
      const formattedLocations = await locationService.getAllLocations();
      return res.json({ locations: formattedLocations });
    } catch (err) {
      console.error('getAllLocations error:', err);
      return res.status(500).json({ message: 'Lỗi tải danh sách địa điểm', error: err.message });
    }
  }

  async createLocation(req, res) {
    try {
      const userId = req.user?.id || 3;
      const newLoc = await locationService.createLocation(req.body, userId);
      return res.status(201).json({ message: 'Thêm địa điểm thành công', location: newLoc });
    } catch (err) {
      console.error('createLocation error:', err);
      const statusCode = err.message.includes('bắt buộc') ? 400 : 500;
      return res.status(statusCode).json({ message: err.message || 'Lỗi thêm địa điểm' });
    }
  }

  async updateLocation(req, res) {
    try {
      const { id } = req.params;
      const updated = await locationService.updateLocation(id, req.body);
      return res.json({ message: 'Cập nhật địa điểm thành công', location: updated });
    } catch (err) {
      console.error('updateLocation error:', err);
      return res.status(500).json({ message: 'Lỗi cập nhật địa điểm', error: err.message });
    }
  }

  async deleteLocation(req, res) {
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
  }
}

module.exports = new LocationController();
