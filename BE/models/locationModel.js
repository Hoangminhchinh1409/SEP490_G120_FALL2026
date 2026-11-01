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
    geofence_radius: toPlainNumber(loc.geofence_radius),
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

const deleteById = async (id) => {
  const numId = BigInt(id);
  await reassignOrdersToDefaultLocation(id);
  await prisma.locations.delete({
    where: { id: numId }
  });
};

module.exports = {
  findAll,
  create,
  update,
  findRelatedOrders,
  reassignOrdersToDefaultLocation,
  deleteById
};
