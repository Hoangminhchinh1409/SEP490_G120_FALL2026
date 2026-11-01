const prisma = require('../config/prisma');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapIncident = (inc) => {
  if (!inc) return null;
  const trip = inc.trips ? {
    id: toPlainNumber(inc.trips.id),
    trip_code: inc.trips.trip_code,
    trip_trucks: (inc.trips.trip_trucks || []).map(tt => ({
      truck: tt.trucks ? { plate_number: tt.trucks.plate_number } : null
    })),
    trip_drivers: (inc.trips.trip_drivers || []).map(td => ({
      driver: td.driver_profiles && td.driver_profiles.users ? {
        user: {
          full_name: td.driver_profiles.users.full_name,
          phone: td.driver_profiles.users.phone
        }
      } : null
    }))
  } : null;

  return {
    ...inc,
    id: toPlainNumber(inc.id),
    trip_id: toPlainNumber(inc.trip_id),
    trip_stop_id: toPlainNumber(inc.trip_stop_id),
    reported_by: toPlainNumber(inc.reported_by),
    escalated_by: toPlainNumber(inc.escalated_by),
    resolved_by: toPlainNumber(inc.resolved_by),
    trip
  };
};

const findAll = async () => {
  const incidents = await prisma.incidents.findMany({
    include: {
      trips: {
        select: {
          id: true,
          trip_code: true,
          trip_trucks: {
            include: {
              trucks: { select: { plate_number: true } }
            }
          },
          trip_drivers: {
            include: {
              driver_profiles: {
                include: {
                  users: { select: { full_name: true, phone: true } }
                }
              }
            }
          }
        }
      }
    },
    orderBy: { id: 'desc' }
  });
  return incidents.map(mapIncident);
};

const findTripIdByCode = async (tripCode) => {
  const trip = await prisma.trips.findFirst({
    where: { trip_code: tripCode },
    select: { id: true }
  });
  return trip ? toPlainNumber(trip.id) : null;
};

const create = async (incidentData) => {
  const data = { ...incidentData };
  delete data.id;
  if (data.trip_id) data.trip_id = BigInt(data.trip_id);
  if (data.trip_stop_id) data.trip_stop_id = BigInt(data.trip_stop_id);
  if (data.reported_by) data.reported_by = BigInt(data.reported_by);
  if (data.escalated_by) data.escalated_by = BigInt(data.escalated_by);
  if (data.resolved_by) data.resolved_by = BigInt(data.resolved_by);

  const created = await prisma.incidents.create({
    data
  });
  return mapIncident(created);
};

const update = async (id, updateData) => {
  const numId = BigInt(id);
  const data = { ...updateData };
  delete data.id;
  if (data.trip_id) data.trip_id = BigInt(data.trip_id);
  if (data.trip_stop_id) data.trip_stop_id = BigInt(data.trip_stop_id);
  if (data.reported_by) data.reported_by = BigInt(data.reported_by);
  if (data.escalated_by) data.escalated_by = BigInt(data.escalated_by);
  if (data.resolved_by) data.resolved_by = BigInt(data.resolved_by);

  const updated = await prisma.incidents.update({
    where: { id: numId },
    data
  });
  return mapIncident(updated);
};

module.exports = {
  findAll,
  findTripIdByCode,
  create,
  update
};
