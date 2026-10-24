const tripService = require('./trips.service');

class TripController {
  async getAllTrips(req, res) {
    try {
      const formattedTrips = await tripService.getAllTrips();
      return res.json({ trips: formattedTrips });
    } catch (err) {
      console.error('getAllTrips error:', err);
      return res.status(500).json({ message: 'Lỗi tải danh sách chuyến xe', error: err.message });
    }
  }

  async createTrip(req, res) {
    try {
      const userId = req.user?.id || 3;
      const result = await tripService.createTrip(req.body, userId);
      return res.status(201).json({
        message: 'Lập chuyến và phân bổ xe thành công!',
        trip: result
      });
    } catch (err) {
      console.error('createTrip error:', err);
      return res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
  }

  async updateTripStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await tripService.updateTripStatus(id, status);
      return res.json({ message: 'Cập nhật trạng thái chuyến thành công', trip: updated });
    } catch (err) {
      console.error('updateTripStatus error:', err);
      return res.status(500).json({ message: 'Lỗi cập nhật trạng thái chuyến', error: err.message });
    }
  }
}

module.exports = new TripController();
