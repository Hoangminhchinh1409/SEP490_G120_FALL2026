const prisma = require('../config/prisma');
const customerService = require('../services/customerService');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../utils/prismaHelper');

/**
 * Contract & Vendor Controller — Nhóm chức năng Quản lý Nhà xe đối tác (3PL) & Hợp đồng Vận tải
 */

// ==========================================
// A. DISPATCHER TRANSPORT CONTRACTS & CUSTOMERS
// ==========================================

const getAllContracts = async (req, res) => {
  try {
    const formattedContracts = await customerService.getAllContracts();
    return res.json({ contracts: formattedContracts, is_read_only: true });
  } catch (err) {
    console.error('getAllContracts error:', err);
    return res.status(500).json({ message: 'Lỗi tải danh sách hợp đồng', error: err.message });
  }
};

const getOrderDocumentsBundle = async (req, res) => {
  try {
    const { loadOrderMeta } = require('../services/orderHelperService');

    const orders = await prisma.orders.findMany({
      orderBy: { id: 'desc' },
      include: {
        customers: { select: { id: true, company_name: true, tax_code: true, phone: true } },
        locations_orders_pickup_location_idTolocations: true,
        locations_orders_delivery_location_idTolocations: true,
        trip_stops: {
          include: {
            trips: {
              include: {
                waybills: true,
                trip_drivers: {
                  include: {
                    driver_profiles: {
                      include: { users: true }
                    }
                  }
                },
                trip_trucks: {
                  include: { trucks: true }
                }
              }
            }
          }
        }
      }
    });

    const list = [];
    for (const o of orders) {
      const meta = await loadOrderMeta(o.id);
      const pickupLoc = o.locations_orders_pickup_location_idTolocations?.name || 'Điểm lấy hàng ALS';
      const deliveryLoc = o.locations_orders_delivery_location_idTolocations?.name || 'Điểm giao hàng';

      let trip = null;
      if (o.trip_stops && o.trip_stops.length > 0) {
        trip = o.trip_stops[0].trips;
      }

      const driverName = trip?.trip_drivers?.[0]?.driver_profiles?.users?.full_name || 'Đang phân công';
      const driverPhone = trip?.trip_drivers?.[0]?.driver_profiles?.users?.phone || '';
      const truckPlate = trip?.trip_trucks?.[0]?.trucks?.plate_number || 'Đang phân công';
      const waybill = trip?.waybills?.[0];

      const customerDocs = meta.web_workflow?.documents || [];
      const hasContract = meta.contract_uploaded || !!meta.contract_file || !!meta.web_workflow?.signed_contract;
      const contractFileName = meta.contract_file || meta.web_workflow?.signed_contract?.contract_file || (hasContract ? `HD-${o.order_code}-SIGNED.pdf` : null);

      list.push({
        order_id: o.id.toString(),
        order_code: o.order_code,
        status: o.status,
        customer_name: o.customers?.company_name || 'Khách hàng',
        tax_code: o.customers?.tax_code || '---',
        customer_phone: o.customers?.phone || '---',
        pickup_location: pickupLoc,
        delivery_location: deliveryLoc,
        created_at: o.created_at,
        has_contract: hasContract,
        contract_file: contractFileName,
        contract_file_data: meta.contract_file_data || meta.web_workflow?.signed_contract?.signature_data || null,
        contract_uploaded_at: meta.contract_uploaded_at || meta.web_workflow?.signed_contract?.signed_at || null,
        customer_docs_count: customerDocs.length,
        customer_docs: customerDocs,
        trip_code: trip?.trip_code || null,
        trip_status: trip?.status || null,
        truck_plate: truckPlate,
        driver_name: driverName,
        driver_phone: driverPhone,
        waybill_number: waybill?.waybill_number || (trip ? `WB-2026-${trip.trip_code || trip.id}` : null),
        has_waybill: !!trip,
        driver_handover_ready: !!trip
      });
    }

    return res.json({ documents_bundle: list, is_read_only: true });
  } catch (err) {
    console.error('getOrderDocumentsBundle error:', err);
    return res.status(500).json({ message: 'Lỗi tải bộ chứng từ và giấy tờ vận tải', error: err.message });
  }
};

const createContract = async (req, res) => {
  try {
    const newContract = await customerService.createContract(req.body);
    return res.status(201).json({ message: 'Tạo hợp đồng thành công', contract: newContract });
  } catch (err) {
    console.error('createContract error:', err);
    return res.status(err.statusCode || 400).json({ message: err.message || 'Lỗi tạo hợp đồng', error: err.message });
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
// B. MANAGER VENDORS & READ-ONLY CONTRACTS
// ==========================================

const getVendors = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && status !== 'ALL') {
      where.approval_status = status;
    }

    const vendorsList = await prisma.vendors.findMany({
      where,
      select: {
        id: true,
        company_name: true,
        approval_status: true,
        contact_person: true,
        phone: true,
        truck_types: true,
        created_at: true,
        updated_at: true,
        transport_contracts: {
          select: {
            id: true,
            contract_number: true,
            liability_cap: true,
            valid_to: true,
            status: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    const formatted = serializePrisma(vendorsList || []).map((v) => {
      const contracts = Array.isArray(v.transport_contracts)
        ? v.transport_contracts
        : v.transport_contracts
          ? [v.transport_contracts]
          : [];
      const activeContract = contracts.find((c) => c.status === 'ACTIVE') || contracts[0];

      return {
        id: toNum(v.id),
        company_name: v.company_name,
        name: v.company_name,
        approval_status: v.approval_status || 'PENDING',
        status: v.approval_status || 'PENDING',
        contact_person: v.contact_person || 'Chưa cập nhật',
        phone: v.phone || 'Chưa cập nhật',
        truck_types: v.truck_types || 'Xe tải 1.5T - 5T',
        contract_id: activeContract?.id ? toNum(activeContract.id) : null,
        contract_number: activeContract?.contract_number || null,
        liability_cap: activeContract?.liability_cap ? Number(activeContract.liability_cap) : null,
        contract_expiry: formatDateOnly(activeContract?.valid_to) || null,
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
    const bigId = toBigInt(req.params.id);
    if (bigId === null) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin nhà xe.' });
    }

    const vendor = await prisma.vendors.findUnique({
      where: { id: bigId },
      include: { transport_contracts: true }
    });

    if (!vendor) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin nhà xe.' });
    }

    return res.json({ vendor: serializePrisma(vendor) });
  } catch (error) {
    console.error('getVendorById Error:', error);
    return res.status(500).json({ message: 'Lỗi lấy chi tiết nhà xe', error: error.message });
  }
};

const createVendor = async (req, res) => {
  try {
    const { company_name, contact_person, phone, truck_types } = req.body;

    if (!company_name?.trim()) {
      return res.status(400).json({ message: 'Tên công ty nhà xe là bắt buộc.' });
    }

    const existing = await prisma.vendors.findFirst({
      where: { company_name: { equals: company_name.trim(), mode: 'insensitive' } },
      select: { id: true }
    });

    if (existing) {
      return res.status(400).json({ message: 'Tên công ty nhà xe đã tồn tại trong hệ thống.' });
    }

    const now = new Date();
    const newVendor = await prisma.vendors.create({
      data: {
        company_name: company_name.trim(),
        contact_person: contact_person?.trim() || null,
        phone: phone?.trim() || '',
        truck_types: truck_types?.trim() || 'Xe tải thùng kín',
        approval_status: 'PENDING',
        created_at: now,
        updated_at: now
      }
    });

    return res.status(201).json({
      message: 'Thêm mới nhà xe đối tác thành công (trạng thái Chờ duyệt).',
      vendor: serializePrisma(newVendor)
    });
  } catch (error) {
    console.error('createVendor Error:', error);
    return res.status(500).json({ message: 'Lỗi tạo nhà xe đối tác', error: error.message });
  }
};

const updateVendor = async (req, res) => {
  try {
    const bigId = toBigInt(req.params.id);
    const { company_name, contact_person, phone, truck_types } = req.body;

    const data = { updated_at: new Date() };
    if (company_name !== undefined) data.company_name = company_name?.trim();
    if (contact_person !== undefined) data.contact_person = contact_person?.trim();
    if (phone !== undefined) data.phone = phone?.trim();
    if (truck_types !== undefined) data.truck_types = truck_types?.trim();

    const updated = await prisma.vendors.update({
      where: { id: bigId },
      data
    });

    return res.json({ message: 'Cập nhật thông tin nhà xe thành công.', vendor: serializePrisma(updated) });
  } catch (error) {
    console.error('updateVendor Error:', error);
    return res.status(500).json({ message: 'Lỗi cập nhật nhà xe', error: error.message });
  }
};

const updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const managerId = req.user?.id ? toBigInt(req.user.id) : null;
    const bigId = toBigInt(id);

    if (!['APPROVED', 'SUSPENDED', 'PENDING'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }

    const now = new Date();
    const updatedVendor = await prisma.$transaction(async (tx) => {
      const upd = await tx.vendors.update({
        where: { id: bigId },
        data: { approval_status: status, updated_at: now }
      });

      if (status === 'APPROVED') {
        await tx.transport_contracts.updateMany({
          where: { vendor_id: bigId },
          data: { status: 'ACTIVE', updated_at: now }
        });
      } else if (status === 'SUSPENDED') {
        await tx.transport_contracts.updateMany({
          where: { vendor_id: bigId },
          data: { status: 'SUSPENDED', updated_at: now }
        });
      }

      return upd;
    });

    try {
      await prisma.activity_logs.create({
        data: {
          actor_id: managerId,
          actor_type: 'MANAGER',
          action: status === 'APPROVED' ? 'APPROVE_VENDOR' : 'SUSPEND_VENDOR',
          target_type: 'VENDOR',
          target_id: bigId,
          changes: { status },
          created_time: now
        }
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

    return res.json({ message: msg, vendor: serializePrisma(updatedVendor) });
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
    const contracts = await prisma.transport_contracts.findMany({
      select: {
        id: true,
        contract_number: true,
        contract_type: true,
        customer_id: true,
        vendor_id: true,
        terms_and_responsibilities: true,
        pricing_conditions: true,
        free_waiting_time: true,
        waiting_fee_rate: true,
        liability_cap: true,
        compensation_terms: true,
        valid_from: true,
        valid_to: true,
        attachment_link: true,
        status: true,
        vendors: { select: { id: true, company_name: true } },
        customers: { select: { id: true, company_name: true } }
      },
      orderBy: { id: 'desc' }
    });

    const formatted = serializePrisma(contracts || []).map((c, idx) => ({
      id: toNum(c.id),
      contract_number: c.contract_number,
      contract_type: c.contract_type || (c.vendor_id ? 'VENDOR' : 'CUSTOMER'),
      partner_name: c.vendors?.company_name || c.customers?.company_name || 'Khách hàng / Đối tác',
      partner_type: c.vendor_id ? 'VENDOR' : 'CUSTOMER',
      liability_cap: c.liability_cap ? Number(c.liability_cap) : 0,
      free_waiting_minutes: c.free_waiting_time || 60,
      waiting_fee_per_hour: c.waiting_fee_rate ? Number(c.waiting_fee_rate) : 0,
      terms: c.terms_and_responsibilities,
      pricing_conditions: c.pricing_conditions,
      compensation_rules: c.compensation_terms,
      attachment_link: c.attachment_link,
      valid_from: formatDateOnly(contracts[idx].valid_from),
      valid_to: formatDateOnly(contracts[idx].valid_to),
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
  getAllContracts,
  getOrderDocumentsBundle,
  createContract,
  getAllCustomers,
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus,
  approveVendor,
  getContracts
};
