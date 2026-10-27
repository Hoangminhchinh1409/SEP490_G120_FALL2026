const supabase = require('../config/supabase');

const findAll = async () => {
  const { data, error } = await supabase
    .from('locations')
    .select(`
      *,
      customer:customers(id, company_name, tax_code)
    `)
    .order('id', { ascending: false });
  if (error) throw error;
  return data;
};

const create = async (locationData) => {
  const { data, error } = await supabase
    .from('locations')
    .insert([locationData])
    .select();
  if (error) throw error;
  return data?.[0];
};

const update = async (id, updateData) => {
  const { data, error } = await supabase
    .from('locations')
    .update(updateData)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data?.[0];
};

const findRelatedOrders = async (locationId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_code, status')
    .or(`pickup_location_id.eq.${locationId},delivery_location_id.eq.${locationId}`);
  if (error) throw error;
  return data || [];
};

const reassignOrdersToDefaultLocation = async (locationId, defaultLocationId = 1) => {
  await supabase
    .from('orders')
    .update({ pickup_location_id: defaultLocationId })
    .eq('pickup_location_id', locationId);

  await supabase
    .from('orders')
    .update({ delivery_location_id: defaultLocationId })
    .eq('delivery_location_id', locationId);
};

const findRelatedTrips = async (locationId) => {
  const { data, error } = await supabase
    .from('trips')
    .select('id, trip_code')
    .or(`origin_location_id.eq.${locationId},destination_location_id.eq.${locationId}`);
  if (error) throw error;
  return data || [];
};

const remove = async (id) => {
  const { data, error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return data;
};

module.exports = {
  findAll,
  create,
  update,
  findRelatedOrders,
  reassignOrdersToDefaultLocation,
  findRelatedTrips,
  delete: remove
};

