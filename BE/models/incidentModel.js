const supabase = require('../config/supabase');

const findAll = async () => {
  const { data, error } = await supabase
    .from('incidents')
    .select(`
      *,
      trip:trips(
        id,
        trip_code,
        trip_trucks(truck:trucks(plate_number)),
        trip_drivers(driver:driver_profiles(user:users(full_name, phone)))
      )
    `)
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
};

const findTripIdByCode = async (tripCode) => {
  const { data } = await supabase.from('trips').select('id').eq('trip_code', tripCode).limit(1);
  return data?.[0]?.id || null;
};

const create = async (incidentData) => {
  const { data, error } = await supabase
    .from('incidents')
    .insert([incidentData])
    .select();
  if (error) throw error;
  return data?.[0];
};

const update = async (id, updateData) => {
  const { data, error } = await supabase
    .from('incidents')
    .update(updateData)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data?.[0];
};

module.exports = {
  findAll,
  findTripIdByCode,
  create,
  update
};

