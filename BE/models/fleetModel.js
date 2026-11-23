const prisma = require('../config/prisma');
const { serializePrisma, toBigInt, toNum, formatDateOnly } = require('../utils/prismaHelper');

const toDateObj = (val) => {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  const s = String(val).split('T')[0].trim();
  return new Date(`${s}T00:00:00.000Z`);
};

const mapTruck = (t) => {
  if (!t) return null;
  const s = serializePrisma(t);
  return {
    ...s,
    id: toNum(t.id),
    allowed_payload: toNum(t.allowed_payload),
    box_length: toNum(t.box_length),
    box_width: toNum(t.box_width),
    box_height: toNum(t.box_height),
    last_lat: t.last_lat !== null && t.last_lat !== undefined ? Number(t.last_lat) : null,
    last_lng: t.last_lng !== null && t.last_lng !== undefined ? Number(t.last_lng) : null,
    inspection_expiry: formatDateOnly(t.inspection_expiry),
    insurance_expiry: formatDateOnly(t.insurance_expiry)
  };
};

const mapDriver = (d) => {
  if (!d) return null;
  const s = serializePrisma(d);
  const { users: userRow, ...rest } = s;
  const user = userRow
    ? {
        ...userRow,
        id: toNum(userRow.id),
        role_id: toNum(userRow.role_id)
      }
    : null;

  return {
    ...rest,
    id: toNum(d.id),
    user_account_id: toNum(d.user_account_id),
    license_expiry: formatDateOnly(d.license_expiry),
    user
  };
};

const mapVendor = (v) => {
  if (!v) return null;
  const s = serializePrisma(v);
  return {
    ...s,
    id: toNum(v.id),
    approved_by: toNum(v.approved_by)
  };
};

const findAllTrucks = async () => {
  const rows = await prisma.trucks.findMany({
    orderBy: { id: 'asc' }
  });
  return (rows || []).map(mapTruck);
};

const createTruck = async (truckData) => {
  const data = { ...truckData };
  delete data.id;
  if (data.inspection_expiry) data.inspection_expiry = toDateObj(data.inspection_expiry);
  if (data.insurance_expiry) data.insurance_expiry = toDateObj(data.insurance_expiry);
  if (data.last_located_at) data.last_located_at = new Date(data.last_located_at);
  if (data.created_at) data.created_at = new Date(data.created_at);
  if (data.updated_at) data.updated_at = new Date(data.updated_at);

  const created = await prisma.trucks.create({ data });
  return mapTruck(created);
};

const updateTruck = async (id, updateData) => {
  const data = { ...updateData };
  delete data.id;
  if (data.inspection_expiry !== undefined) {
    data.inspection_expiry = toDateObj(data.inspection_expiry);
  }
  if (data.insurance_expiry !== undefined) {
    data.insurance_expiry = toDateObj(data.insurance_expiry);
  }
  if (data.last_located_at !== undefined) {
    data.last_located_at = data.last_located_at ? new Date(data.last_located_at) : null;
  }
  if (data.deleted_at !== undefined) {
    data.deleted_at = data.deleted_at ? new Date(data.deleted_at) : null;
  }
  data.updated_at = new Date();

  const updated = await prisma.trucks.update({
    where: { id: toBigInt(id) },
    data
  });
  return mapTruck(updated);
};

const findAllDrivers = async () => {
  const rows = await prisma.driver_profiles.findMany({
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
  return (rows || []).map(mapDriver);
};

const updateDriver = async (id, updateData) => {
  const data = { ...updateData };
  delete data.id;
  if (data.user_account_id !== undefined) {
    data.user_account_id = toBigInt(data.user_account_id);
  }
  if (data.license_expiry !== undefined) {
    data.license_expiry = toDateObj(data.license_expiry);
  }
  if (data.last_trip_ended_at !== undefined) {
    data.last_trip_ended_at = data.last_trip_ended_at ? new Date(data.last_trip_ended_at) : null;
  }
  data.updated_at = new Date();

  const updated = await prisma.driver_profiles.update({
    where: { id: toBigInt(id) },
    data
  });
  return mapDriver(updated);
};

const findAllVendors = async () => {
  const rows = await prisma.vendors.findMany({
    orderBy: { id: 'asc' }
  });
  return (rows || []).map(mapVendor);
};

module.exports = {
  findAllTrucks,
  createTruck,
  updateTruck,
  findAllDrivers,
  updateDriver,
  findAllVendors
};
