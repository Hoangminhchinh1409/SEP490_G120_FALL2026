const supabase = require('../../../config/supabase');

class FleetRepository {
  async findAllTrucks() {
    const { data, error } = await supabase
      .from('trucks')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return data;
  }

  async createTruck(truckData) {
    const { data, error } = await supabase
      .from('trucks')
      .insert([truckData])
      .select();
    if (error) throw error;
    return data?.[0];
  }

  async updateTruck(id, updateData) {
    const { data, error } = await supabase
      .from('trucks')
      .update(updateData)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data?.[0];
  }

  async findAllDrivers() {
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
  }

  async updateDriver(id, updateData) {
    const { data, error } = await supabase
      .from('driver_profiles')
      .update(updateData)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data?.[0];
  }

  async findAllVendors() {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return data;
  }
}

module.exports = new FleetRepository();
