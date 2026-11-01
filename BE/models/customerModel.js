const prisma = require('../config/prisma');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapContract = (c) => {
  if (!c) return null;
  const customer = c.customers ? {
    id: toPlainNumber(c.customers.id),
    company_name: c.customers.company_name,
    tax_code: c.customers.tax_code,
    email: c.customers.email
  } : null;

  const vendor = c.vendors ? {
    id: toPlainNumber(c.vendors.id),
    company_name: c.vendors.company_name,
    phone: c.vendors.phone
  } : null;

  return {
    ...c,
    id: toPlainNumber(c.id),
    customer_id: toPlainNumber(c.customer_id),
    vendor_id: toPlainNumber(c.vendor_id),
    waiting_fee_per_hour: toPlainNumber(c.waiting_fee_per_hour),
    liability_cap: toPlainNumber(c.liability_cap),
    customer,
    vendor
  };
};

const mapCustomer = (c) => {
  if (!c) return null;
  return {
    ...c,
    id: toPlainNumber(c.id),
    created_by: toPlainNumber(c.created_by)
  };
};

const findAllContracts = async () => {
  const contracts = await prisma.transport_contracts.findMany({
    include: {
      customers: {
        select: { id: true, company_name: true, tax_code: true, email: true }
      },
      vendors: {
        select: { id: true, company_name: true, phone: true }
      }
    },
    orderBy: { id: 'desc' }
  });
  return contracts.map(mapContract);
};

const seedDefaultContracts = async () => {
  const customers = await prisma.customers.findMany({
    take: 3,
    select: { id: true, company_name: true, tax_code: true }
  });
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
      signed_on: new Date('2026-01-01'),
      valid_from: new Date('2026-01-01'),
      valid_to: new Date('2026-12-31'),
      status: 'ACTIVE'
    }));

    await prisma.transport_contracts.createMany({
      data: seedPayload,
      skipDuplicates: true
    });
    return await findAllContracts();
  }
  return [];
};

const createContract = async (contractData) => {
  const data = { ...contractData };
  delete data.id;
  if (data.customer_id) data.customer_id = BigInt(data.customer_id);
  if (data.vendor_id) data.vendor_id = BigInt(data.vendor_id);
  if (data.signed_on) data.signed_on = new Date(data.signed_on);
  if (data.valid_from) data.valid_from = new Date(data.valid_from);
  if (data.valid_to) data.valid_to = new Date(data.valid_to);

  const created = await prisma.transport_contracts.create({
    data
  });
  return mapContract(created);
};

const findAllCustomers = async () => {
  const customers = await prisma.customers.findMany({
    orderBy: { id: 'desc' }
  });
  return customers.map(mapCustomer);
};

module.exports = {
  findAllContracts,
  seedDefaultContracts,
  createContract,
  findAllCustomers
};
