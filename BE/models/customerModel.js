const supabase = require('../config/supabase');

const findAllContracts = async () => {
  const { data, error } = await supabase
    .from('transport_contracts')
    .select(`
      *,
      customer:customers(id, company_name, tax_code, email),
      vendor:vendors(id, company_name, phone)
    `)
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
};

const seedDefaultContracts = async () => {
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
    return await findAllContracts();
  }
  return [];
};

const createContract = async (contractData) => {
  const { data, error } = await supabase
    .from('transport_contracts')
    .insert([contractData])
    .select();
  if (error) throw error;
  return data?.[0];
};

const findAllCustomers = async () => {
  const { data, error } = await supabase
    .from('customers')
    .select('id, company_name, tax_code, email')
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
};

module.exports = {
  findAllContracts,
  seedDefaultContracts,
  createContract,
  findAllCustomers
};

