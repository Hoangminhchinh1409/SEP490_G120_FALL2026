const customerModel = require('../models/customerModel');

const formatContract = (c) => {
  const isVendor = !!c.vendor_id;
  const partnerName = isVendor
    ? (c.vendor?.company_name || 'Đối tác vận tải 3PL')
    : (c.customer?.company_name || 'Công ty TNHH ADTEK Việt Nam');
  const taxCode = isVendor 
    ? (c.vendor?.tax_code || '0304556677')
    : (c.customer?.tax_code || '0108992834');

  const freeWaiting = c.free_waiting_time !== undefined && c.free_waiting_time !== null
    ? c.free_waiting_time
    : (c.free_waiting_minutes !== undefined && c.free_waiting_minutes !== null ? c.free_waiting_minutes : 60);

  let cancellationTiers = 'Hủy trước 4h: Phạt 30% cước | Sau khi điều xe: Phạt 70% cước';
  if (Array.isArray(c.contract_cancellation_tiers) && c.contract_cancellation_tiers.length > 0) {
    cancellationTiers = c.contract_cancellation_tiers
      .map(t => `Hủy trước ${t.hours_before}h: Phạt ${t.penalty_percent}% cước`)
      .join(' | ');
  }

  const signer = c.users?.full_name || 'Hoàng Minh Chính - GĐ Vận hành';

  return {
    id: `HD-2026-${c.id}`,
    raw_id: c.id,
    contract_no: c.contract_number,
    party_type: isVendor ? 'VENDOR' : 'CUSTOMER',
    partner_name: partnerName,
    tax_code: taxCode,
    start_date: c.valid_from || '2026-01-01',
    end_date: c.valid_to || '2026-12-31',
    free_waiting_mins: freeWaiting,
    waiting_fee_per_hour: c.waiting_fee_rate || c.waiting_fee_per_hour || 150000,
    cancellation_tiers: cancellationTiers,
    liability_cap_vnd: c.liability_cap || 200000000,
    liability_cap_type: '100% giá trị khai báo có seal nguyên chì',
    status: c.status || 'ACTIVE',
    signed_by: signer
  };
};

const getAllContracts = async () => {
  let contracts = await customerModel.findAllContracts();
  if (!contracts || contracts.length === 0) {
    contracts = await customerModel.seedDefaultContracts();
  }
  return (contracts || []).map(c => formatContract(c));
};

const createContract = async (payload = {}) => {
  const isVendor = payload.party_type === 'VENDOR';

  if (!payload.partner_id) {
    const error = new Error('Thiếu thông tin đối tác ký kết (partner_id)');
    error.statusCode = 400;
    throw error;
  }

  // Validate dates
  if (payload.start_date && payload.end_date) {
    const startDate = new Date(payload.start_date);
    const endDate = new Date(payload.end_date);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      if (startDate > endDate) {
        const error = new Error('Thời gian hiệu lực bắt đầu không được sau ngày kết thúc');
        error.statusCode = 400;
        throw error;
      }
    }
  }

  // Validate waiting fee
  if (payload.waiting_fee_per_hour !== undefined && payload.waiting_fee_per_hour !== null) {
    const fee = parseInt(payload.waiting_fee_per_hour, 10);
    if (isNaN(fee) || fee < 0) {
      const error = new Error('Phí chờ không hợp lệ');
      error.statusCode = 400;
      throw error;
    }
  }

  const freeWaiting = payload.free_waiting_mins !== undefined && payload.free_waiting_mins !== null
    ? parseInt(payload.free_waiting_mins, 10)
    : 60;

  const waitingFee = payload.waiting_fee_per_hour !== undefined && payload.waiting_fee_per_hour !== null
    ? parseInt(payload.waiting_fee_per_hour, 10)
    : 150000;

  const contractData = {
    contract_number: payload.contract_no || `NEX/2026/HDVT-${Math.floor(100 + Math.random() * 900)}`,
    contract_type: isVendor ? 'Vendor' : 'Customer',
    customer_id: !isVendor ? parseInt(payload.partner_id, 10) : null,
    vendor_id: isVendor ? parseInt(payload.partner_id, 10) : null,
    terms_and_responsibilities: payload.terms || 'Hợp đồng vận chuyển tiêu chuẩn dịch vụ ALS Logistics',
    pricing_conditions: 'Bảng cước cố định năm 2026',
    compensation_terms: 'Bồi thường theo hạn mức trách nhiệm hợp đồng',
    free_waiting_time: isNaN(freeWaiting) ? 60 : freeWaiting,
    waiting_fee_rate: isNaN(waitingFee) ? 150000 : waitingFee,
    liability_cap: parseInt(payload.liability_cap_vnd, 10) || 200000000,
    valid_from: payload.start_date || '2026-01-01',
    valid_to: payload.end_date || '2026-12-31',
    status: payload.status || 'ACTIVE'
  };

  return await customerModel.createContract(contractData);
};

const getAllCustomers = async () => {
  return await customerModel.findAllCustomers();
};

module.exports = {
  formatContract,
  getAllContracts,
  createContract,
  getAllCustomers
};

