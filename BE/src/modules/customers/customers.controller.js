const customerService = require('./customers.service');

class CustomerController {
  async getAllContracts(req, res) {
    try {
      const formattedContracts = await customerService.getAllContracts();
      return res.json({ contracts: formattedContracts });
    } catch (err) {
      console.error('getAllContracts error:', err);
      return res.status(500).json({ message: 'Lỗi tải danh sách hợp đồng', error: err.message });
    }
  }

  async createContract(req, res) {
    try {
      const newContract = await customerService.createContract(req.body);
      return res.status(201).json({ message: 'Tạo hợp đồng thành công', contract: newContract });
    } catch (err) {
      console.error('createContract error:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  async getAllCustomers(req, res) {
    try {
      const customers = await customerService.getAllCustomers();
      return res.json({ customers });
    } catch (err) {
      console.error('getAllCustomers error:', err);
      return res.status(500).json({ message: 'Lỗi tải danh sách khách hàng', error: err.message });
    }
  }
}

module.exports = new CustomerController();
