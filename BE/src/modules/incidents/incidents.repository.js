const supabase = require('../../../config/supabase');
const crypto = require('crypto');

class IncidentRepository {
  async findAll() {
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
  }

  async findTripIdByCode(tripCode) {
    const { data } = await supabase.from('trips').select('id').eq('trip_code', tripCode).limit(1);
    return data?.[0]?.id || null;
  }

  async create(incidentData) {
    const { data, error } = await supabase
      .from('incidents')
      .insert([incidentData])
      .select();
    if (error) throw error;
    return data?.[0];
  }

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('incidents')
      .update(updateData)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data?.[0];
  }
}

module.exports = new IncidentRepository();
