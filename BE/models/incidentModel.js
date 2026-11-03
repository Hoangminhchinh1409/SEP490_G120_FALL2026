const prisma = require('../config/prisma');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapIncident = (inc) => {
  if (!inc) return null;
  const trip = inc.trips ? {
    id: toPlainNumber(inc.trips.id),
    trip_code: inc.trips.trip_code,
    trip_trucks: (inc.trips.trip_trucks || []).map(tt => ({
      id: toPlainNumber(tt.id),
      truck_id: toPlainNumber(tt.truck_id),
      released_time: tt.released_time,
      replacement_reason: tt.replacement_reason,
      truck: tt.trucks ? {
        id: toPlainNumber(tt.trucks.id),
        plate_number: tt.trucks.plate_number
      } : null
    })),
    trip_drivers: (inc.trips.trip_drivers || []).map(td => ({
      id: toPlainNumber(td.id),
      driver_id: toPlainNumber(td.driver_id),
      released_time: td.released_time,
      replacement_reason: td.replacement_reason,
      driver: td.driver_profiles && td.driver_profiles.users ? {
        id: toPlainNumber(td.driver_profiles.id),
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
              trucks: { select: { id: true, plate_number: true } }
            },
            orderBy: { id: 'desc' }
          },
          trip_drivers: {
            include: {
              driver_profiles: {
                include: {
                  users: { select: { full_name: true, phone: true } }
                }
              }
            },
            orderBy: { id: 'desc' }
          }
        }
      }
    },
    orderBy: { id: 'desc' }
  });
  return incidents.map(mapIncident);
};

const findTripIdByCode = async (tripCode) => {
  if (!tripCode) return null;
  const trip = await prisma.trips.findFirst({
    where: { trip_code: String(tripCode).trim() },
    select: { id: true }
  });
  return trip ? toPlainNumber(trip.id) : null;
};

const findFirstTripId = async () => {
  const trip = await prisma.trips.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true }
  });
  return trip ? toPlainNumber(trip.id) : 9;
};

const create = async (incidentData) => {
  const data = {
    trip_id: BigInt(incidentData.trip_id),
    trip_stop_id: incidentData.trip_stop_id ? BigInt(incidentData.trip_stop_id) : null,
    type: incidentData.type || 'BREAKDOWN',
    description: String(incidentData.description || 'Sự cố phát sinh trên đường vận chuyển').slice(0, 500),
    photos: Array.isArray(incidentData.photos) ? incidentData.photos : [],
    fault: incidentData.fault || null,
    status: incidentData.status || 'Reported',
    reported_time: incidentData.reported_time ? new Date(incidentData.reported_time) : new Date()
  };

  // Kiểm tra reported_by có phải là driver_profiles.id hợp lệ không (FK incidents_reported_by_fkey)
  if (incidentData.reported_by) {
    const dp = await prisma.driver_profiles.findFirst({
      where: {
        OR: [
          { id: BigInt(incidentData.reported_by) },
          { user_account_id: BigInt(incidentData.reported_by) }
        ]
      },
      select: { id: true }
    });
    if (dp) {
      data.reported_by = dp.id;
    }
  }

  const created = await prisma.incidents.create({
    data,
    include: {
      trips: {
        select: {
          id: true,
          trip_code: true,
          trip_trucks: { include: { trucks: { select: { id: true, plate_number: true } } } },
          trip_drivers: {
            include: {
              driver_profiles: { include: { users: { select: { full_name: true, phone: true } } } }
            }
          }
        }
      }
    }
  });
  return mapIncident(created);
};

const update = async (id, updateData) => {
  const numId = BigInt(id);
  const allowedFields = [
    'type',
    'description',
    'photos',
    'fault',
    'status',
    'escalated_by',
    'escalated_time',
    'escalation_reason',
    'resolution_note',
    'resolved_by',
    'resolved_time',
    'updated_at'
  ];

  const data = { updated_at: new Date() };
  for (const key of allowedFields) {
    if (updateData[key] !== undefined) {
      if ((key === 'escalated_by' || key === 'resolved_by') && updateData[key] !== null) {
        data[key] = BigInt(updateData[key]);
      } else {
        data[key] = updateData[key];
      }
    }
  }

  const updated = await prisma.incidents.update({
    where: { id: numId },
    data,
    include: {
      trips: {
        select: {
          id: true,
          trip_code: true,
          trip_trucks: { include: { trucks: { select: { id: true, plate_number: true } } } },
          trip_drivers: {
            include: {
              driver_profiles: { include: { users: { select: { full_name: true, phone: true } } } }
            }
          }
        }
      }
    }
  });
  return mapIncident(updated);
};

/**
 * Điều xe & tài xế thay thế khi có sự cố hiện trường (UC-15, BR-09, UC-41)
 */
const dispatchReplacementWithTransaction = async ({
  incidentId,
  newTruckPlate,
  newDriverName,
  replacementReason,
  userId = 1
}) => {
  const numIncId = BigInt(incidentId);
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const incident = await tx.incidents.findUnique({
      where: { id: numIncId },
      include: {
        trips: {
          include: {
            trip_trucks: true,
            trip_drivers: true,
            waybills: { orderBy: { id: 'desc' } }
          }
        }
      }
    });

    if (!incident) {
      throw new Error('Không tìm thấy sự cố cần xử lý');
    }

    const trip = incident.trips;
    const tripId = incident.trip_id;
    const reasonText = String(replacementReason || 'Điều xe thay thế do sự cố hiện trường').slice(0, 255);

    // 1. Tìm xe thay thế trong DB
    let newTruck = null;
    if (newTruckPlate) {
      const cleanPlate = String(newTruckPlate).split(' ')[0].trim();
      newTruck = await tx.trucks.findFirst({
        where: {
          deleted_at: null,
          plate_number: { contains: cleanPlate, mode: 'insensitive' }
        }
      });
    }
    if (!newTruck) {
      newTruck = await tx.trucks.findFirst({
        where: { deleted_at: null, status: { in: ['Available', 'AVAILABLE'] } }
      });
    }
    if (!newTruck) {
      newTruck = await tx.trucks.findFirst({ where: { deleted_at: null } });
    }

    // 2. Tìm tài xế thay thế trong DB
    let newDriver = null;
    if (newDriverName) {
      const cleanDriver = String(newDriverName).split('-')[0].split('·')[0].trim();
      newDriver = await tx.driver_profiles.findFirst({
        where: {
          users: { full_name: { contains: cleanDriver, mode: 'insensitive' } }
        },
        include: { users: true }
      });
    }
    if (!newDriver) {
      newDriver = await tx.driver_profiles.findFirst({ include: { users: true } });
    }

    // 3. Giải phóng xe cũ & gán xe thay thế mới (trip_trucks)
    if (newTruck && tripId) {
      const activeTrucks = (trip?.trip_trucks || []).filter(tt => !tt.released_time);
      for (const tt of activeTrucks) {
        await tx.trip_trucks.update({
          where: { id: tt.id },
          data: {
            released_time: now,
            replacement_reason: reasonText
          }
        });
        await tx.trucks.update({
          where: { id: tt.truck_id },
          data: { status: 'MAINTENANCE', updated_at: now }
        });
      }

      await tx.trip_trucks.create({
        data: {
          trip_id: tripId,
          truck_id: newTruck.id,
          assignment_type: 'Replacement',
          incident_id: numIncId,
          assigned_time: now,
          replacement_reason: reasonText
        }
      });

      await tx.trucks.update({
        where: { id: newTruck.id },
        data: { status: 'On Trip', updated_at: now }
      });
    }

    // 4. Giải phóng tài xế cũ & gán tài xế thay thế mới (trip_drivers)
    if (newDriver && tripId) {
      const activeDrivers = (trip?.trip_drivers || []).filter(td => !td.released_time);
      for (const td of activeDrivers) {
        await tx.trip_drivers.update({
          where: { id: td.id },
          data: {
            released_time: now,
            replacement_reason: reasonText
          }
        });
      }

      await tx.trip_drivers.create({
        data: {
          trip_id: tripId,
          driver_id: newDriver.id,
          driver_role: 'Primary',
          assignment_type: 'Replacement',
          incident_id: numIncId,
          assigned_time: now,
          replacement_reason: reasonText
        }
      });
    }

    // 5. Đánh dấu Vận đơn cũ là Superseded và cấp lại Vận đơn phiên bản mới (Waybill V2+)
    const prevWaybills = trip?.waybills || [];
    const nextVersion = prevWaybills.length + 1;
    if (prevWaybills.length > 0) {
      await tx.waybills.updateMany({
        where: { trip_id: tripId, status: 'Valid' },
        data: { status: 'Superseded' }
      });
    }

    const tripCodeShort = (trip?.trip_code || `T${tripId}`).replace(/^TRIP-/i, '');
    const newWaybillNo = `WB-${tripCodeShort}-V${nextVersion}`.slice(0, 20);
    await tx.waybills.create({
      data: {
        trip_id: tripId,
        waybill_number: newWaybillNo,
        issued_by: userId ? BigInt(userId) : BigInt(1),
        status: 'Valid',
        trip_data_snapshot: {
          version: nextVersion,
          trip_code: trip?.trip_code,
          replaced_due_to_incident: Number(numIncId),
          new_truck_plate: newTruck?.plate_number || newTruckPlate,
          new_driver_name: newDriver?.users?.full_name || newDriverName,
          replacement_reason: reasonText
        }
      }
    });

    // 6. Cập nhật trạng thái sự cố thành RESOLVED
    const updatedIncident = await tx.incidents.update({
      where: { id: numIncId },
      data: {
        status: 'RESOLVED',
        resolution_note: `[Điều xe thay thế ${newTruck?.plate_number || newTruckPlate} - Tài xế ${newDriver?.users?.full_name || newDriverName}]: ${reasonText}`.slice(0, 500),
        resolved_time: now,
        updated_at: now
      },
      include: {
        trips: {
          select: {
            id: true,
            trip_code: true,
            trip_trucks: { include: { trucks: { select: { id: true, plate_number: true } } }, orderBy: { id: 'desc' } },
            trip_drivers: {
              include: {
                driver_profiles: { include: { users: { select: { full_name: true, phone: true } } } }
              },
              orderBy: { id: 'desc' }
            }
          }
        }
      }
    });

    return {
      ...mapIncident(updatedIncident),
      new_waybill_version: nextVersion,
      new_waybill_number: newWaybillNo,
      new_truck_plate: newTruck?.plate_number || newTruckPlate,
      new_driver_name: newDriver?.users?.full_name || newDriverName
    };
  });
};

module.exports = {
  findAll,
  findTripIdByCode,
  findFirstTripId,
  create,
  update,
  dispatchReplacementWithTransaction
};
