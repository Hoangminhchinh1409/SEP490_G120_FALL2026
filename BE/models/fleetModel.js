const supabase = require('../config/supabase');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapTruck = (t) => {
  if (!t) return null;
  return {
    ...t,
    id: toPlainNumber(t.id),
    allowed_payload: toPlainNumber(t.allowed_payload),
    box_length: toPlainNumber(t.box_length),
    box_width: toPlainNumber(t.box_width),
    box_height: toPlainNumber(t.box_height),
    last_lat: t.last_lat !== null ? Number(t.last_lat) : null,
    last_lng: t.last_lng !== null ? Number(t.last_lng) : null
  };
};

const mapDriver = (d) => {
  if (!d) return null;
  const user = d.users ? {
    ...d.users,
    id: toPlainNumber(d.users.id),
    role_id: toPlainNumber(d.users.role_id)
  } : null;

  return {
    ...d,
    id: toPlainNumber(d.id),
    user_account_id: toPlainNumber(d.user_account_id),
    user
  };
};

const findAllTrucks = async () => {
  const { data, error } = await supabase
    .from('trucks')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapTruck);
};

const createTruck = async (truckData) => {
  const data = { ...truckData };
  delete data.id;
  const { data: created, error } = await supabase
    .from('trucks')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return mapTruck(created);
};

const updateTruck = async (id, updateData) => {
  const data = { ...updateData };
  delete data.id;
  const { data: updated, error } = await supabase
    .from('trucks')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapTruck(updated);
};

const findAllDrivers = async () => {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('*, users:user_account_id(id, username, full_name, phone, email, status, role_id)')
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapDriver);
};

const updateDriver = async (id, updateData) => {
  const data = { ...updateData };
  delete data.id;
  const { data: updated, error } = await supabase
    .from('driver_profiles')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapDriver(updated);
};

const mapVendor = (v) => {
  if (!v) return null;
  return {
    ...v,
    id: toPlainNumber(v.id),
    approved_by: toPlainNumber(v.approved_by)
  };
};

const findAllVendors = async () => {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapVendor);
};

module.exports = {
  findAllTrucks,
  createTruck,
  updateTruck,
  findAllDrivers,
  updateDriver,
  findAllVendors
};
