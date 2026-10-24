const fleetService = require('./fleet.service');

class FleetController {
  async getFleetTrucks(req, res) {
    try {
      const formattedTrucks = await fleetService.getAllTrucks();
      return res.json({ trucks: formattedTrucks });
    } catch (err) {
      console.error('getFleetTrucks error:', err);
      return res.status(500).json({ message: 'Lỗi tải danh sách xe', error: err.message });
    }
  }

  async createFleetTruck(req, res) {
    try {
      const newTruck = await fleetService.createTruck(req.body);
      return res.status(201).json({ message: 'Thêm xe thành công', truck: newTruck });
    } catch (err) {
      console.error('createFleetTruck error:', err);
      const statusCode = err.message === 'Biển số xe là bắt buộc' ? 400 : 500;
      return res.status(statusCode).json({ message: err.message || 'Không thể thêm phương tiện' });
    }
  }

  async updateFleetTruck(req, res) {
    try {
      const { id } = req.params;
      const updated = await fleetService.updateTruck(id, req.body);
      return res.json({ message: 'Cập nhật thành công', truck: updated });
    } catch (err) {
      console.error('updateFleetTruck error:', err);
      return res.status(500).json({ message: 'Lỗi cập nhật phương tiện', error: err.message });
    }
  }

  async getFleetDrivers(req, res) {
    try {
      const formattedDrivers = await fleetService.getAllDrivers();
      return res.json({ drivers: formattedDrivers });
    } catch (err) {
      console.error('getFleetDrivers error:', err);
      return res.status(500).json({ message: 'Lỗi tải danh sách tài xế', error: err.message });
    }
  }

  async updateFleetDriver(req, res) {
    try {
      const { id } = req.params;
      const updated = await fleetService.updateDriver(id, req.body);
      return res.json({ message: 'Cập nhật thành công', driver: updated });
    } catch (err) {
      console.error('updateFleetDriver error:', err);
      return res.status(500).json({ message: 'Lỗi cập nhật tài xế', error: err.message });
    }
  }

  async getFleetVendors(req, res) {
    try {
      const formattedVendors = await fleetService.getAllVendors();
      return res.json({ vendors: formattedVendors });
    } catch (err) {
      console.error('getFleetVendors error:', err);
      return res.status(500).json({ message: 'Lỗi tải danh sách đối tác', error: err.message });
    }
  }
}

module.exports = new FleetController();
