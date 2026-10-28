const supabase = require('../config/supabase');

const findAllTrucks = async () => {
  const { data, error } = await supabase
    .from('trucks')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
};

const createTruck = async (truckData) => {
  const { data, error } = await supabase
    .from('trucks')
    .insert([truckData])
    .select();
  if (error) throw error;
  return data?.[0];
};

const updateTruck = async (id, updateData) => {
  const { data, error } = await supabase
    .from('trucks')
    .update(updateData)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data?.[0];
};

const findAllDrivers = async () => {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select(`
      id,
      user_account_id,
      license_number,
      license_class,
      license_expiry,
      status,
      last_trip_ended_at,
      user:users(id, username, full_name, phone, email, status)
    `)
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
};

const updateDriver = async (id, updateData) => {
  const { data, error } = await supabase
    .from('driver_profiles')
    .update(updateData)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data?.[0];
};

const findAllVendors = async () => {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
};

module.exports = {
  findAllTrucks,
  createTruck,
  updateTruck,
  findAllDrivers,
  updateDriver,
  findAllVendors
};

