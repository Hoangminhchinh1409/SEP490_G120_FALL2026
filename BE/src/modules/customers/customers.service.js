const customerRepository = require('./customers.repository');

class CustomerService {
  formatContract(c) {
    const isVendor = !!c.vendor_id;
    const partnerName = isVendor
      ? (c.vendor?.company_name || 'Đối tác vận tải 3PL')
      : (c.customer?.company_name || 'Công ty TNHH ADTEK Việt Nam');
    const taxCode = isVendor ? '0304556677' : (c.customer?.tax_code || '0108992834');

    return {
      id: `HD-2026-${c.id}`,
      raw_id: c.id,
      contract_no: c.contract_number,
      party_type: isVendor ? 'VENDOR' : 'CUSTOMER',
      partner_name: partnerName,
      tax_code: taxCode,
      start_date: c.valid_from || '2026-01-01',
      end_date: c.valid_to || '2026-12-31',
      free_waiting_mins: c.free_waiting_minutes || 60,
      waiting_fee_per_hour: c.waiting_fee_per_hour || 150000,
      cancellation_tiers: 'Hủy trước 4h: Phạt 30% cước | Sau khi điều xe: Phạt 70% cước',
      liability_cap_vnd: c.liability_cap || 200000000,
      liability_cap_type: '100% giá trị khai báo có seal nguyên chì',
      status: c.status || 'ACTIVE',
      signed_by: 'Hoàng Minh Chính - GĐ Vận hành'
    };
  }

  async getAllContracts() {
    let contracts = await customerRepository.findAllContracts();
    if (!contracts || contracts.length === 0) {
      contracts = await customerRepository.seedDefaultContracts();
    }
    return (contracts || []).map(c => this.formatContract(c));
  }

  async createContract(payload) {
    const isVendor = payload.party_type === 'VENDOR';

    const contractData = {
      contract_number: payload.contract_no || `NEX/2026/HDVT-${Math.floor(100 + Math.random() * 900)}`,
      customer_id: !isVendor ? (payload.partner_id || 1) : null,
      vendor_id: isVendor ? (payload.partner_id || 1) : null,
      terms: 'Hợp đồng vận chuyển tiêu chuẩn dịch vụ ALS Logistics',
      free_waiting_minutes: parseInt(payload.free_waiting_mins) || 60,
      waiting_fee_per_hour: parseInt(payload.waiting_fee_per_hour) || 150000,
      liability_cap: parseInt(payload.liability_cap_vnd) || 200000000,
      valid_from: payload.start_date || '2026-01-01',
      valid_to: payload.end_date || '2026-12-31',
      signed_on: payload.start_date || '2026-01-01',
      status: payload.status || 'ACTIVE'
    };

    return await customerRepository.createContract(contractData);
  }

  async getAllCustomers() {
    return await customerRepository.findAllCustomers();
  }
}

module.exports = new CustomerService();
