const supabase = require('../config/supabase');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapTripStop = (s) => {
  if (!s) return null;
  const orderCargo = Array.isArray(s.orders?.order_cargos)
    ? s.orders.order_cargos[0]
    : s.orders?.order_cargos;

  return {
    ...s,
    id: toPlainNumber(s.id),
    trip_id: toPlainNumber(s.trip_id),
    order_id: toPlainNumber(s.order_id),
    location_id: toPlainNumber(s.location_id),
    distance_from_previous_stop: s.distance_from_previous_stop !== null ? Number(s.distance_from_previous_stop) : null,
    loaded_weight: s.loaded_weight !== null && s.loaded_weight !== undefined ? Number(s.loaded_weight) : null,
    delivered_weight: s.delivered_weight !== null && s.delivered_weight !== undefined ? Number(s.delivered_weight) : null,
    location: s.locations ? {
      ...s.locations,
      id: toPlainNumber(s.locations.id),
      latitude: s.locations.latitude !== null ? Number(s.locations.latitude) : null,
      longitude: s.locations.longitude !== null ? Number(s.locations.longitude) : null
    } : null,
    order: s.orders ? {
      id: toPlainNumber(s.orders.id),
      order_code: s.orders.order_code,
      hawb_number: s.orders.hawb_number,
      status: s.orders.status,
      receiver_name: s.orders.receiver_name,
      receiver_phone: s.orders.receiver_phone,
      agreed_price: toPlainNumber(s.orders.agreed_price),
      vendor_tracking_code: s.orders.vendor_tracking_code,
      customer: s.orders.customers ? {
        id: toPlainNumber(s.orders.customers.id),
        company_name: s.orders.customers.company_name,
        phone: s.orders.customers.phone
      } : null,
      cargo: orderCargo ? {
        cargo_name: orderCargo.cargo_name,
        cargo_type: orderCargo.cargo_type,
        quantity: toPlainNumber(orderCargo.quantity),
        unit: orderCargo.unit,
        actual_weight_kg: orderCargo.actual_weight_kg !== null ? Number(orderCargo.actual_weight_kg) : null,
        chargeable_weight_kg: orderCargo.chargeable_weight_kg !== null ? Number(orderCargo.chargeable_weight_kg) : null,
        length_cm: orderCargo.length_cm !== null ? Number(orderCargo.length_cm) : null,
        width_cm: orderCargo.width_cm !== null ? Number(orderCargo.width_cm) : null,
        height_cm: orderCargo.height_cm !== null ? Number(orderCargo.height_cm) : null
      } : null
    } : null,
    evidences: (s.delivery_evidences || []).map(ev => ({
      ...ev,
      id: toPlainNumber(ev.id),
      trip_stop_id: toPlainNumber(ev.trip_stop_id),
      order_id: toPlainNumber(ev.order_id),
      latitude: ev.latitude !== null ? Number(ev.latitude) : null,
      longitude: ev.longitude !== null ? Number(ev.longitude) : null
    }))
  };
};

const mapTripTruck = (tt) => {
  if (!tt) return null;
  return {
    ...tt,
    id: toPlainNumber(tt.id),
    trip_id: toPlainNumber(tt.trip_id),
    truck_id: toPlainNumber(tt.truck_id),
    incident_id: toPlainNumber(tt.incident_id),
    truck: tt.trucks ? {
      ...tt.trucks,
      id: toPlainNumber(tt.trucks.id),
      allowed_payload: toPlainNumber(tt.trucks.allowed_payload),
      box_length: tt.trucks.box_length !== null && tt.trucks.box_length !== undefined ? Number(tt.trucks.box_length) : null,
      box_width: tt.trucks.box_width !== null && tt.trucks.box_width !== undefined ? Number(tt.trucks.box_width) : null,
      box_height: tt.trucks.box_height !== null && tt.trucks.box_height !== undefined ? Number(tt.trucks.box_height) : null,
      last_lat: tt.trucks.last_lat !== null && tt.trucks.last_lat !== undefined ? Number(tt.trucks.last_lat) : null,
      last_lng: tt.trucks.last_lng !== null && tt.trucks.last_lng !== undefined ? Number(tt.trucks.last_lng) : null
    } : null
  };
};

const mapTripDriver = (td) => {
  if (!td) return null;
  const user = td.driver_profiles?.users ? {
    id: toPlainNumber(td.driver_profiles.users.id),
    full_name: td.driver_profiles.users.full_name,
    phone: td.driver_profiles.users.phone
  } : null;

  return {
    ...td,
    id: toPlainNumber(td.id),
    trip_id: toPlainNumber(td.trip_id),
    driver_id: toPlainNumber(td.driver_id),
    incident_id: toPlainNumber(td.incident_id),
    driver: {
      id: toPlainNumber(td.driver_id),
      user
    }
  };
};

const mapTrip = (t) => {
  if (!t) return null;
  return {
    ...t,
    id: toPlainNumber(t.id),
    created_by: toPlainNumber(t.created_by),
    planned_distance: t.planned_distance !== null ? Number(t.planned_distance) : null,
    actual_distance: t.actual_distance !== null ? Number(t.actual_distance) : null,
    trip_trucks: (t.trip_trucks || []).map(mapTripTruck),
    trip_drivers: (t.trip_drivers || []).map(mapTripDriver),
    stops: (t.trip_stops || []).map(mapTripStop),
    incidents: (t.incidents || []).map(i => ({
      ...i,
      id: toPlainNumber(i.id),
      trip_id: toPlainNumber(i.trip_id)
    })),
    waybills: (t.waybills || []).map(w => ({
      ...w,
      id: toPlainNumber(w.id),
      trip_id: toPlainNumber(w.trip_id),
      issued_by: toPlainNumber(w.issued_by)
    })),
    events: (t.trip_events || []).map(e => ({
      ...e,
      id: toPlainNumber(e.id),
      trip_id: toPlainNumber(e.trip_id),
      trip_stop_id: toPlainNumber(e.trip_stop_id),
      driver_id: toPlainNumber(e.driver_id),
      latitude: e.latitude !== null ? Number(e.latitude) : null,
      longitude: e.longitude !== null ? Number(e.longitude) : null
    }))
  };
};

const findAllTrips = async () => {
  const { data: trips, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_trucks(id, trip_id, truck_id, incident_id, assignment_type, trucks(*)),
      trip_drivers(id, trip_id, driver_id, incident_id, driver_role, assignment_type, driver_profiles(*, users:user_account_id(id, full_name, phone))),
      trip_stops(*, locations(*), orders(*, customers(*), order_cargos(*)), delivery_evidences(*)),
      incidents(id, type, status, description, reported_time, resolution_note),
      waybills(*),
      trip_events(*)
    `)
    .order('id', { ascending: false });

  if (error) {
    console.error('tripModel.findAllTrips error:', error);
    throw error;
  }
  return (trips || []).map(mapTrip);
};

const findTruckByPlate = async (plate) => {
  if (!plate) return null;
  const cleanPlate = String(plate).split(' ')[0].trim();
  const truck = await prisma.trucks.findFirst({
    where: {
      deleted_at: null,
      plate_number: { contains: cleanPlate, mode: 'insensitive' }
    },
    select: { id: true }
  });
  return truck ? toPlainNumber(truck.id) : null;
};

const findFirstTruck = async () => {
  const truck = await prisma.trucks.findFirst({
    where: {
      deleted_at: null,
      status: { in: ['Available', 'AVAILABLE'] }
    },
    select: { id: true }
  });
  if (truck) return toPlainNumber(truck.id);
  const anyTruck = await prisma.trucks.findFirst({
    where: { deleted_at: null },
    select: { id: true }
  });
  return anyTruck ? toPlainNumber(anyTruck.id) : 14;
};

const findDriverByName = async (name) => {
  if (!name) return null;
  const cleanName = String(name).split('·')[0].split('-')[0].trim();
  const profile = await prisma.driver_profiles.findFirst({
    where: {
      users: {
        full_name: { contains: cleanName, mode: 'insensitive' }
      }
    },
    select: { id: true }
  });
  return profile ? toPlainNumber(profile.id) : null;
};

const findFirstDriver = async () => {
  const driver = await prisma.driver_profiles.findFirst({
    select: { id: true }
  });
  return driver ? toPlainNumber(driver.id) : 6;
};

const findOrderByCodeOrId = async (orderIdOrCode) => {
  if (!orderIdOrCode) return null;
  const strVal = String(orderIdOrCode).trim();
  const where = /^\d+$/.test(strVal)
    ? { id: BigInt(strVal) }
    : { order_code: strVal };

  const order = await prisma.orders.findFirst({
    where,
    include: {
      customers: true,
      order_cargos: true,
      locations_orders_pickup_location_idTolocations: true,
      locations_orders_delivery_location_idTolocations: true
    }
  });
  if (!order) return null;
  return {
    ...order,
    id: toPlainNumber(order.id),
    customer_id: toPlainNumber(order.customer_id),
    pickup_location_id: toPlainNumber(order.pickup_location_id),
    delivery_location_id: toPlainNumber(order.delivery_location_id)
  };
};

const findVendorByNameOrId = async (vendorNameOrId) => {
  if (!vendorNameOrId) return null;
  const strVal = String(vendorNameOrId).trim();
  if (/^\d+$/.test(strVal)) {
    const v = await prisma.vendors.findUnique({ where: { id: BigInt(strVal) } });
    if (v) return { ...v, id: toPlainNumber(v.id) };
  }
  const v = await prisma.vendors.findFirst({
    where: { company_name: { contains: strVal, mode: 'insensitive' } }
  });
  if (v) return { ...v, id: toPlainNumber(v.id) };
  const firstVendor = await prisma.vendors.findFirst();
  return firstVendor ? { ...firstVendor, id: toPlainNumber(firstVendor.id) } : null;
};

const createTripWithRelations = async ({
  tripData,
  truckId,
  driverId,
  secondaryDriverId = null,
  stopsData,
  orderId,
  waybillSnapshot = {}
}) => {
  const numOrderId = orderId ? BigInt(orderId) : null;
  const numTruckId = BigInt(truckId);
  const numDriverId = BigInt(driverId);
  const numDriver2Id = secondaryDriverId ? BigInt(secondaryDriverId) : null;

  return await prisma.$transaction(async (tx) => {
    // 1. Tạo Trip
    const newTrip = await tx.trips.create({
      data: {
        trip_code: tripData.trip_code,
        status: tripData.status || 'Assigned',
        planned_start: tripData.planned_start ? new Date(tripData.planned_start) : new Date(),
        planned_distance: tripData.planned_distance ? parseFloat(tripData.planned_distance) : 50.0,
        planned_duration: tripData.planned_duration ? parseInt(tripData.planned_duration, 10) : 60,
        created_by: tripData.created_by ? BigInt(tripData.created_by) : BigInt(1)
      }
    });

    const tripId = newTrip.id;

    // 2. Gán xe (trip_trucks)
    await tx.trip_trucks.create({
      data: {
        trip_id: tripId,
        truck_id: numTruckId,
        assignment_type: 'Original'
      }
    });

    // 3. Gán tài xế chính (trip_drivers)
    await tx.trip_drivers.create({
      data: {
        trip_id: tripId,
        driver_id: numDriverId,
        driver_role: 'Primary',
        assignment_type: 'Original'
      }
    });

    // 3b. Gán tài xế phụ nếu có (2 tài xế)
    if (numDriver2Id && numDriver2Id !== numDriverId) {
      await tx.trip_drivers.create({
        data: {
          trip_id: tripId,
          driver_id: numDriver2Id,
          driver_role: 'Secondary',
          assignment_type: 'Original'
        }
      });
    }

    // 4. Tạo các trạm dừng (trip_stops) với stop_type chuẩn Driver PWA ("Pickup", "Drop-off", "Rest")
    if (Array.isArray(stopsData) && stopsData.length > 0) {
      for (let i = 0; i < stopsData.length; i++) {
        const s = stopsData[i];
        let normalizedStopType = 'Drop-off';
        const rawType = String(s.type || s.stop_type || '').toUpperCase();
        if (rawType === 'PICKUP') normalizedStopType = 'Pickup';
        else if (rawType === 'REST') normalizedStopType = 'Rest';
        else if (rawType === 'TRANSIT') normalizedStopType = 'Transit';
        else normalizedStopType = 'Drop-off';

        await tx.trip_stops.create({
          data: {
            trip_id: tripId,
            order_id: s.order_id ? BigInt(s.order_id) : numOrderId,
            sequence: i + 1,
            stop_type: normalizedStopType,
            location_id: s.location_id ? BigInt(s.location_id) : BigInt(1),
            planned_arrival: s.planned_arrival ? new Date(s.planned_arrival) : null,
            distance_from_previous_stop: s.distance_from_previous_stop ? parseFloat(s.distance_from_previous_stop) : null,
            status: s.status || 'Pending'
          }
        });
      }
    }

    // 5. Tạo Vận đơn (Waybill V1)
    const waybillNum = `WB-${tripData.trip_code.replace(/^TRIP-/i, '')}-V1`.slice(0, 20);
    await tx.waybills.create({
      data: {
        trip_id: tripId,
        waybill_number: waybillNum,
        issued_by: tripData.created_by ? BigInt(tripData.created_by) : BigInt(1),
        status: 'Valid',
        trip_data_snapshot: {
          version: 1,
          trip_code: tripData.trip_code,
          ...waybillSnapshot
        }
      }
    });

    // 6. Ghi lịch sử trạng thái chuyến (trip_status_history)
    await tx.trip_status_history.create({
      data: {
        trip_id: tripId,
        status: 'Assigned',
        changed_by: tripData.created_by ? BigInt(tripData.created_by) : BigInt(1)
      }
    });

    // 7. Cập nhật trạng thái xe thành 'On Trip'
    await tx.trucks.update({
      where: { id: numTruckId },
      data: { status: 'On Trip', updated_at: new Date() }
    });

    // 8. Cập nhật đơn hàng thành ASSIGNED & ghi order_status_history
    if (numOrderId) {
      await tx.orders.update({
        where: { id: numOrderId },
        data: {
          status: 'ASSIGNED',
          updated_at: new Date()
        }
      });

      await tx.order_status_history.create({
        data: {
          order_id: numOrderId,
          status: 'Assigned',
          changed_by: tripData.created_by ? BigInt(tripData.created_by) : BigInt(1)
        }
      });
    }

    // 9. Gửi thông báo cho tài xế
    const driverProfile = await tx.driver_profiles.findUnique({
      where: { id: numDriverId },
      select: { user_account_id: true }
    });
    if (driverProfile?.user_account_id) {
      await tx.notifications.create({
        data: {
          user_account_id: driverProfile.user_account_id,
          target_type: 'TRIP',
          target_id: tripId,
          message: `Bạn vừa được phân công chuyến xe mới ${tripData.trip_code}. Vui lòng kiểm tra lộ trình và nhận chuyến.`
        }
      });
    }

    return mapTrip(newTrip);
  });
};

const assignOrderToVendor = async ({
  orderId,
  vendorId,
  vendorName,
  vendorTrackingCode,
  vendorCost,
  vendorVehicleCount,
  userId = 1
}) => {
  const numOrderId = BigInt(orderId);
  const numVendorId = vendorId ? BigInt(vendorId) : null;
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.orders.update({
      where: { id: numOrderId },
      data: {
        vendor_id: numVendorId,
        vendor_tracking_code: vendorTrackingCode ? String(vendorTrackingCode).slice(0, 50) : null,
        status: 'HANDED_OVER_TO_VENDOR',
        is_closed: true,
        updated_at: now
      }
    });

    await tx.order_status_history.create({
      data: {
        order_id: numOrderId,
        status: 'Handed Over to Vendor',
        changed_by: userId ? BigInt(userId) : BigInt(1)
      }
    });

    await tx.order_notes.create({
      data: {
        order_id: numOrderId,
        created_by: userId ? BigInt(userId) : BigInt(1),
        content: `[Bàn giao Nhà xe 3PL]: ${vendorName || 'Đối tác'} - Mã vận đơn: ${vendorTrackingCode} - Số xe: ${vendorVehicleCount || 1} - Chi phí: ${vendorCost || 'Theo HĐ'}`
      }
    });

    return {
      ...updatedOrder,
      id: toPlainNumber(updatedOrder.id)
    };
  });
};

const updateTripStatus = async (id, status, userId = 1) => {
  const strId = String(id).trim();
  const existingTrip = /^\d+$/.test(strId)
    ? await prisma.trips.findUnique({
        where: { id: BigInt(strId) },
        include: { trip_trucks: true, trip_drivers: true, trip_stops: true }
      })
    : await prisma.trips.findFirst({
        where: { trip_code: strId },
        include: { trip_trucks: true, trip_drivers: true, trip_stops: true }
      });

  if (!existingTrip) {
    throw new Error('Không tìm thấy chuyến xe');
  }

  const tripId = existingTrip.id;
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.trips.update({
      where: { id: tripId },
      data: {
        status,
        updated_at: now,
        ...(status === 'Completed' ? {
          actual_distance: existingTrip.planned_distance || 50,
          actual_duration: existingTrip.planned_duration || 60
        } : {})
      }
    });

    await tx.trip_status_history.create({
      data: {
        trip_id: tripId,
        status,
        changed_by: userId ? BigInt(userId) : BigInt(1)
      }
    });

    // Nếu Hoàn thành hoặc Hủy chuyến -> giải phóng xe & tài xế, đồng bộ trạng thái đơn hàng
    if (status === 'Completed' || status === 'Cancelled') {
      // Giải phóng trip_trucks & đặt lại trucks.status = 'AVAILABLE'
      const activeTrucks = (existingTrip.trip_trucks || []).filter(tt => !tt.released_time);
      for (const tt of activeTrucks) {
        await tx.trip_trucks.update({
          where: { id: tt.id },
          data: { released_time: now }
        });
        await tx.trucks.update({
          where: { id: tt.truck_id },
          data: { status: 'AVAILABLE', updated_at: now }
        });
      }

      // Giải phóng trip_drivers & đặt lại driver_profiles.status = 'Active'
      const activeDrivers = (existingTrip.trip_drivers || []).filter(td => !td.released_time);
      for (const td of activeDrivers) {
        await tx.trip_drivers.update({
          where: { id: td.id },
          data: { released_time: now }
        });
        await tx.driver_profiles.update({
          where: { id: td.driver_id },
          data: {
            status: 'Active',
            ...(status === 'Completed' ? { last_trip_ended_at: now } : {}),
            updated_at: now
          }
        });
      }

      // Cập nhật các điểm dừng & đơn hàng liên kết
      const orderIds = [...new Set((existingTrip.trip_stops || []).map(s => s.order_id).filter(Boolean))];

      if (status === 'Completed') {
        await tx.trip_stops.updateMany({
          where: { trip_id: tripId },
          data: { status: 'Done', actual_arrival: now }
        });

        for (const ordId of orderIds) {
          await tx.orders.update({
            where: { id: ordId },
            data: { status: 'DELIVERED', is_closed: true, updated_at: now }
          });
          await tx.order_status_history.create({
            data: {
              order_id: ordId,
              status: 'Delivered',
              changed_by: userId ? BigInt(userId) : BigInt(1)
            }
          });
        }
      } else if (status === 'Cancelled') {
        await tx.trip_stops.updateMany({
          where: { trip_id: tripId },
          data: { status: 'Skipped' }
        });

        // Trả đơn hàng về trạng thái READY_FOR_PLANNING để Điều phối có thể phân bổ xe lại
        for (const ordId of orderIds) {
          await tx.orders.update({
            where: { id: ordId },
            data: { status: 'READY_FOR_PLANNING', updated_at: now }
          });
          await tx.order_status_history.create({
            data: {
              order_id: ordId,
              status: 'Ready for Planning',
              changed_by: userId ? BigInt(userId) : BigInt(1)
            }
          });
        }
      }
    }

    return mapTrip(updated);
  });
};

module.exports = {
  findAllTrips,
  findTruckByPlate,
  findFirstTruck,
  findDriverByName,
  findFirstDriver,
  findOrderByCodeOrId,
  findVendorByNameOrId,
  createTripWithRelations,
  assignOrderToVendor,
  updateTripStatus
};
