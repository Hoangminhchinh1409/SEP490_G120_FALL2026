const prisma = require('../config/prisma');

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
  const trucks = await prisma.trucks.findMany({
    orderBy: { id: 'asc' }
  });
  return trucks.map(mapTruck);
};

const createTruck = async (truckData) => {
  const data = { ...truckData };
  delete data.id;
  const created = await prisma.trucks.create({
    data
  });
  return mapTruck(created);
};

const updateTruck = async (id, updateData) => {
  const numId = BigInt(id);
  const data = { ...updateData };
  delete data.id;
  const updated = await prisma.trucks.update({
    where: { id: numId },
    data
  });
  return mapTruck(updated);
};

const findAllDrivers = async () => {
  const drivers = await prisma.driver_profiles.findMany({
    include: {
      users: {
        select: {
          id: true,
          username: true,
          full_name: true,
          phone: true,
          email: true,
          status: true,
          role_id: true
        }
      }
    },
    orderBy: { id: 'asc' }
  });
  return drivers.map(mapDriver);
};

const updateDriver = async (id, updateData) => {
  const numId = BigInt(id);
  const data = { ...updateData };
  delete data.id;
  const updated = await prisma.driver_profiles.update({
    where: { id: numId },
    data
  });
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
  const vendors = await prisma.vendors.findMany({
    orderBy: { id: 'asc' }
  });
  return vendors.map(mapVendor);
};

module.exports = {
  findAllTrucks,
  createTruck,
  updateTruck,
  findAllDrivers,
  updateDriver,
  findAllVendors
};
