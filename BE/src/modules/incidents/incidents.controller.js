const incidentService = require('./incidents.service');

class IncidentController {
  async getAllIncidents(req, res) {
    try {
      const formatted = await incidentService.getAllIncidents();
      return res.json({ incidents: formatted });
    } catch (err) {
      console.error('getAllIncidents error:', err);
      return res.status(500).json({ message: 'Lỗi tải danh sách sự cố', error: err.message });
    }
  }

  async createIncident(req, res) {
    try {
      const userId = req.user?.id || 3;
      const newInc = await incidentService.createIncident(req.body, userId);
      return res.status(201).json({ message: 'Đã báo cáo sự cố thành công', incident: newInc });
    } catch (err) {
      console.error('createIncident error:', err);
      return res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
  }

  async updateIncidentStatus(req, res) {
    try {
      const { id } = req.params;
      const updated = await incidentService.updateIncidentStatus(id, req.body);
      return res.json({ message: 'Đã cập nhật sự cố thành công', incident: updated });
    } catch (err) {
      console.error('updateIncidentStatus error:', err);
      return res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
  }
}

module.exports = new IncidentController();
