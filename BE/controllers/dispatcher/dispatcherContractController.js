const supabase = require('../../config/supabase');
const crypto = require('crypto');


// Lấy danh sách hợp đồng
const getAllContracts = async (req, res) => {
  try {
    let { data: contracts, error } = await supabase
      .from('transport_contracts')
      .select(`
        *,
        customer:customers(id, company_name, tax_code, email),
        vendor:vendors(id, company_name, phone)
      `)
      .order('id', { ascending: false });

    if (error) {
      console.error('getAllContracts error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách hợp đồng', error });
    }

    // Nếu bảng chưa có hợp đồng nào, tự động seed hợp đồng mẫu cho khách hàng thật trong DB
    if (!contracts || contracts.length === 0) {
      const { data: customers } = await supabase.from('customers').select('id, company_name, tax_code').limit(3);
      if (customers && customers.length > 0) {
        const seedPayload = customers.map((c, i) => ({
          contract_number: `NEX/2026/HDVT-${c.company_name.slice(0, 5).toUpperCase().replace(/[^A-Z]/g, '')}-0${i + 1}`,
          customer_id: c.id,
          terms: 'Vận chuyển hàng hóa nguyên chuyến có bảo hiểm và kẹp chì điện tử',
          pricing_conditions: 'Bảng cước cố định năm 2026',
          compensation_rules: 'Bồi thường 100% giá trị hàng hóa nếu hư hỏng hoặc mất niêm phong',
          free_waiting_minutes: 60,
          waiting_fee_per_hour: 150000,
          cancellation_fee_tiers: { before_4h: 30, after_dispatch: 70 },
          liability_cap: 200000000,
          signed_on: '2026-01-01',
          valid_from: '2026-01-01',
          valid_to: '2026-12-31',
          status: 'ACTIVE'
        }));

        await supabase.from('transport_contracts').insert(seedPayload);
        const { data: reloaded } = await supabase
          .from('transport_contracts')
          .select(`
            *,
            customer:customers(id, company_name, tax_code, email),
            vendor:vendors(id, company_name, phone)
          `)
          .order('id', { ascending: false });
        contracts = reloaded || [];
      }
    }

    const formattedContracts = (contracts || []).map(c => {
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
    });

    return res.json({ contracts: formattedContracts });
  } catch (err) {
    console.error('getAllContracts exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Tạo hợp đồng mới
const createContract = async (req, res) => {
  try {
    const {
      contract_no,
      party_type,
      partner_id,
      start_date,
      end_date,
      free_waiting_mins,
      waiting_fee_per_hour,
      liability_cap_vnd,
      status
    } = req.body;

    const isVendor = party_type === 'VENDOR';

    const { data: newContract, error } = await supabase
      .from('transport_contracts')
      .insert([{
        contract_number: contract_no || `NEX/2026/HDVT-${Math.floor(100 + Math.random() * 900)}`,
        customer_id: !isVendor ? (partner_id || 1) : null,
        vendor_id: isVendor ? (partner_id || 1) : null,
        terms: 'Hợp đồng vận chuyển tiêu chuẩn dịch vụ ALS Logistics',
        free_waiting_minutes: parseInt(free_waiting_mins) || 60,
        waiting_fee_per_hour: parseInt(waiting_fee_per_hour) || 150000,
        liability_cap: parseInt(liability_cap_vnd) || 200000000,
        valid_from: start_date || '2026-01-01',
        valid_to: end_date || '2026-12-31',
        signed_on: start_date || '2026-01-01',
        status: status || 'ACTIVE'
      }])
      .select();

    if (error) {
      console.error('createContract error:', error);
      return res.status(500).json({ message: 'Lỗi thêm hợp đồng', error });
    }

    return res.status(201).json({ message: 'Tạo hợp đồng thành công', contract: newContract[0] });
  } catch (err) {
    console.error('createContract exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Lấy danh sách khách hàng để chọn trong dropdown
const getAllCustomers = async (req, res) => {
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, company_name, tax_code, email')
      .order('id', { ascending: true });

    if (error) {
      console.error('getAllCustomers error:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách khách hàng', error });
    }

    return res.json({ customers });
  } catch (err) {
    console.error('getAllCustomers exception:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


// ==========================================
// 4. TRIP PLANNING & MONITORING (LẬP CHUYẾN & GIÁM SÁT)
// ==========================================


module.exports = {
  getAllContracts,
  createContract,
  getAllCustomers
};