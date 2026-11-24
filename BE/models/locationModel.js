const prisma = require('../config/prisma');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapLocation = (loc) => {
  if (!loc) return null;
  const customer = loc.customers ? {
    id: toPlainNumber(loc.customers.id),
    company_name: loc.customers.company_name,
    tax_code: loc.customers.tax_code
  } : null;

  return {
    ...loc,
    id: toPlainNumber(loc.id),
    customer_id: toPlainNumber(loc.customer_id),
    latitude: loc.latitude !== null ? Number(loc.latitude) : null,
    longitude: loc.longitude !== null ? Number(loc.longitude) : null,
    created_by: toPlainNumber(loc.created_by),
    customer
  };
};

const findAll = async () => {
  const list = await prisma.locations.findMany({
    include: {
      customers: {
        select: {
          id: true,
          company_name: true,
          tax_code: true
        }
      }
    },
    orderBy: { id: 'desc' }
  });
  return list.map(mapLocation);
};

const create = async (locationData) => {
  const data = { ...locationData };
  delete data.id;
  if (data.customer_id) data.customer_id = BigInt(data.customer_id);
  if (data.created_by) data.created_by = BigInt(data.created_by);
  const created = await prisma.locations.create({
    data
  });
  return mapLocation(created);
};

const update = async (id, updateData) => {
  const numId = BigInt(id);
  const data = { ...updateData };
  delete data.id;
  if (data.customer_id) data.customer_id = BigInt(data.customer_id);
  if (data.created_by) data.created_by = BigInt(data.created_by);
  const updated = await prisma.locations.update({
    where: { id: numId },
    data
  });
  return mapLocation(updated);
};

const findRelatedOrders = async (locationId) => {
  const locId = BigInt(locationId);
  const orders = await prisma.orders.findMany({
    where: {
      OR: [
        { pickup_location_id: locId },
        { delivery_location_id: locId }
      ]
    },
    select: {
      id: true,
      order_code: true,
      status: true
    }
  });
  return orders.map(o => ({
    id: toPlainNumber(o.id),
    order_code: o.order_code,
    status: o.status
  }));
};

const reassignOrdersToDefaultLocation = async (locationId, defaultLocationId = 1) => {
  const locId = BigInt(locationId);
  const defId = BigInt(defaultLocationId);

  await prisma.orders.updateMany({
    where: { pickup_location_id: locId },
    data: { pickup_location_id: defId }
  });

  await prisma.orders.updateMany({
    where: { delivery_location_id: locId },
    data: { delivery_location_id: defId }
  });
};

const findRelatedTrips = async (locationId) => {
  const locId = BigInt(locationId);
  const tripStops = await prisma.trip_stops.findMany({
    where: {
      location_id: locId
    },
    select: {
      trips: {
        select: {
          id: true,
          trip_code: true,
          status: true
        }
      }
    }
  });

  // Gom nhóm các chuyến xe duy nhất
  const uniqueTripsMap = new Map();
  for (const ts of tripStops) {
    if (ts.trips && !uniqueTripsMap.has(ts.trips.id.toString())) {
      uniqueTripsMap.set(ts.trips.id.toString(), {
        id: toPlainNumber(ts.trips.id),
        trip_code: ts.trips.trip_code,
        status: ts.trips.status
      });
    }
  }

  return Array.from(uniqueTripsMap.values());
};

const deleteById = async (id, defaultLocationId = 1) => {
  const numId = BigInt(id);
  const defId = BigInt(defaultLocationId);
  await prisma.$transaction(async (tx) => {
    await tx.orders.updateMany({
      where: { pickup_location_id: numId },
      data: { pickup_location_id: defId }
    });
    await tx.orders.updateMany({
      where: { delivery_location_id: numId },
      data: { delivery_location_id: defId }
    });
    await tx.locations.delete({
      where: { id: numId }
    });
  });
};

const deleteLocationModel = async (id) => {
  return await deleteById(id);
};

module.exports = {
  findAll,
  create,
  update,
  findRelatedOrders,
  reassignOrdersToDefaultLocation,
  findRelatedTrips,
  deleteById,
  delete: deleteLocationModel
};
