const supabase = require('../config/supabase');
const customerService = require('../services/customerService');

/**
 * Contract & Vendor Controller — Nhóm chức năng Quản lý Nhà xe đối tác (3PL) & Hợp đồng Vận tải
 * (UC-23, UC-24 — Screen 28, 29, 30, 31)
 */

// ==========================================
// A. DISPATCHER TRANSPORT CONTRACTS & CUSTOMERS (UC-24 - Screen 30, 31)
// ==========================================

const getAllContracts = async (req, res) => {
  try {
    const formattedContracts = await customerService.getAllContracts();
    return res.json({ contracts: formattedContracts });
  } catch (err) {
    console.error('getAllContracts error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách hợp đồng', error: err.message });
  }
};

const createContract = async (req, res) => {
  try {
    const newContract = await customerService.createContract(req.body);
    return res.status(201).json({ message: 'Tạo hợp đồng thành công', contract: newContract });
  } catch (err) {
    console.error('createContract error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const customers = await customerService.getAllCustomers();
    return res.json({ customers });
  } catch (err) {
    console.error('getAllCustomers error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách khách hàng', error: err.message });
  }
};

// ==========================================
// B. MANAGER VENDORS & READ-ONLY CONTRACTS (UC-23 - Screen 28, 29, 30, 31)
// ==========================================

const getVendors = async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('vendors')
      .select(`
        id,
        company_name,
        approval_status,
        contact_person,
        phone,
        truck_types,
        created_at,
        updated_at,
        transport_contracts(id, contract_number, liability_cap, valid_to, status)
      `)
      .order('id', { ascending: false });

    if (status && status !== 'ALL') {
      query = query.eq('approval_status', status);
    }

    const { data: vendorsList, error } = await query;
    if (error) throw error;

    const formatted = (vendorsList || []).map((v) => {
      const contracts = Array.isArray(v.transport_contracts)
        ? v.transport_contracts
        : v.transport_contracts
        ? [v.transport_contracts]
        : [];
      const activeContract = contracts.find((c) => c.status === 'ACTIVE') || contracts[0];

      return {
        id: v.id,
        company_name: v.company_name,
        name: v.company_name,
        approval_status: v.approval_status || 'PENDING',
        status: v.approval_status || 'PENDING',
        contact_person: v.contact_person || 'Chưa cập nhật',
        phone: v.phone || 'Chưa cập nhật',
        truck_types: v.truck_types || 'Xe tải 1.5T - 5T',
        contract_id: activeContract?.id || null,
        contract_number: activeContract?.contract_number || null,
        liability_cap: activeContract?.liability_cap ? Number(activeContract.liability_cap) : null,
        contract_expiry: activeContract?.valid_to || null,
        contract_status: activeContract?.status || 'NO_CONTRACT',
        created_at: v.created_at
      };
    });

    return res.json({
      vendors: formatted,
      summary: {
        total: formatted.length,
        approved: formatted.filter((v) => v.approval_status === 'APPROVED').length,
        pending: formatted.filter((v) => v.approval_status === 'PENDING').length,
        suspended: formatted.filter((v) => v.approval_status === 'SUSPENDED').length
      }
    });
  } catch (error) {
    console.error('getVendors Error:', error);
    return res.status(500).json({ message: 'Lỗi tải danh sách nhà xe', error: error.message });
  }
};

const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: vendor, error } = await supabase
      .from('vendors')
      .select(`
        *,
        transport_contracts(*)
      `)
      .eq('id', id)
      .single();

    if (error || !vendor) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin nhà xe.' });
    }

    return res.json({ vendor });
  } catch (error) {
    console.error('getVendorById Error:', error);
    return res.status(500).json({ message: 'Lỗi lấy chi tiết nhà xe', error: error.message });
  }
};

const createVendor = async (req, res) => {
  try {
    const { company_name, contact_person, phone, truck_types } = req.body;

    if (!company_name?.trim()) {
      return res.status(400).json({ message: 'Tên công ty nhà xe là bắt buộc (MSG02).' });
    }

    const { data: existing } = await supabase
      .from('vendors')
      .select('id')
      .ilike('company_name', company_name.trim())
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ message: 'Tên công ty nhà xe đã tồn tại trong hệ thống (MSG04).' });
    }

    const { data: newVendor, error } = await supabase
      .from('vendors')
      .insert({
        company_name: company_name.trim(),
        contact_person: contact_person?.trim() || null,
        phone: phone?.trim() || null,
        truck_types: truck_types?.trim() || 'Xe tải thùng kín',
        approval_status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: 'Thêm mới nhà xe đối tác thành công (trạng thái Chờ duyệt).',
      vendor: newVendor
    });
  } catch (error) {
    console.error('createVendor Error:', error);
    return res.status(500).json({ message: 'Lỗi tạo nhà xe đối tác', error: error.message });
  }
};

const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, contact_person, phone, truck_types } = req.body;

    const { data: updated, error } = await supabase
      .from('vendors')
      .update({
        company_name: company_name?.trim(),
        contact_person: contact_person?.trim(),
        phone: phone?.trim(),
        truck_types: truck_types?.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ message: 'Cập nhật thông tin nhà xe thành công.', vendor: updated });
  } catch (error) {
    console.error('updateVendor Error:', error);
    return res.status(500).json({ message: 'Lỗi cập nhật nhà xe', error: error.message });
  }
};

const updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const managerId = req.user?.id || null;

    if (!['APPROVED', 'SUSPENDED', 'PENDING'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }

    const { data: updatedVendor, error } = await supabase
      .from('vendors')
      .update({
        approval_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (status === 'APPROVED') {
      await supabase
        .from('transport_contracts')
        .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
        .eq('vendor_id', id);
    } else if (status === 'SUSPENDED') {
      await supabase
        .from('transport_contracts')
        .update({ status: 'SUSPENDED', updated_at: new Date().toISOString() })
        .eq('vendor_id', id);
    }

    try {
      await supabase.from('activity_logs').insert({
        actor_id: managerId,
        actor_type: 'MANAGER',
        action: status === 'APPROVED' ? 'APPROVE_VENDOR' : 'SUSPEND_VENDOR',
        target_type: 'VENDOR',
        target_id: String(id),
        changes: { status },
        created_time: new Date().toISOString()
      });
    } catch (logErr) {
      console.warn('activity_logs warning:', logErr.message);
    }

    const msg =
      status === 'APPROVED'
        ? 'Đã phê duyệt nhà xe đối tác thành công (Có thể nhận chuyến).'
        : status === 'SUSPENDED'
        ? 'Đã đình chỉ nhà xe đối tác (Dispatcher sẽ không thể gán đơn).'
        : 'Đã chuyển trạng thái nhà xe về Chờ duyệt.';

    return res.json({ message: msg, vendor: updatedVendor });
  } catch (error) {
    console.error('updateVendorStatus Error:', error);
    return res.status(500).json({ message: 'Lỗi cập nhật trạng thái nhà xe', error: error.message });
  }
};

const approveVendor = (req, res) => {
  req.body = { ...req.body, status: 'APPROVED' };
  return updateVendorStatus(req, res);
};

const getContracts = async (req, res) => {
  try {
    const { data: contracts, error } = await supabase
      .from('transport_contracts')
      .select(`
        id,
        contract_number,
        contract_type,
        customer_id,
        vendor_id,
        terms_and_responsibilities,
        pricing_conditions,
        free_waiting_time,
        waiting_fee_rate,
        liability_cap,
        compensation_terms,
        valid_from,
        valid_to,
        attachment_link,
        status,
        vendor:vendors(id, company_name),
        customer:customers(id, company_name)
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    const formatted = (contracts || []).map((c) => ({
      id: c.id,
      contract_number: c.contract_number,
      contract_type: c.contract_type || (c.vendor_id ? 'VENDOR' : 'CUSTOMER'),
      partner_name: c.vendor?.company_name || c.customer?.company_name || 'Khách hàng / Đối tác',
      partner_type: c.vendor_id ? 'VENDOR' : 'CUSTOMER',
      liability_cap: c.liability_cap ? Number(c.liability_cap) : 0,
      free_waiting_minutes: c.free_waiting_time || 60,
      waiting_fee_per_hour: c.waiting_fee_rate ? Number(c.waiting_fee_rate) : 0,
      terms: c.terms_and_responsibilities,
      pricing_conditions: c.pricing_conditions,
      compensation_rules: c.compensation_terms,
      attachment_link: c.attachment_link,
      valid_from: c.valid_from,
      valid_to: c.valid_to,
      status: c.status || 'ACTIVE'
    }));

    return res.json({
      contracts: formatted,
      is_read_only: true
    });
  } catch (error) {
    console.error('getContracts Error:', error);
    return res.status(500).json({ message: 'Lỗi tra cứu hợp đồng vận tải', error: error.message });
  }
};

module.exports = {
  // Dispatcher Contracts & Customers
  getAllContracts,
  createContract,
  getAllCustomers,

  // Manager Vendors & Read-only Contracts
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus,
  approveVendor,
  getContracts
};

