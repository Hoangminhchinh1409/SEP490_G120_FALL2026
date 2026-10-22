/**
 * loadPlanAlgorithm.js
 * Thuật toán tính toán xếp hàng vào thùng xe 3D thông minh (3D Bin Packing with LIFO Shelf Algorithm).
 * 
 * Nguyên tắc trong Logistics:
 * 1. Phân loại Bulk Cargo: Kiện không có kích thước (L=0 hoặc W=0 hoặc ghi chú BULK) -> Hàng rời.
 * 2. LIFO (Last In First Out):
 *    - Các đơn giao ở điểm cuối cùng (Stop cuối) sẽ được xếp vào sâu nhất (sát Đầu xe / Vách trước - X thấp).
 *    - Các đơn giao ở điểm đầu tiên (Stop đầu) sẽ được xếp ngoài cùng (sát Cửa sau xe - X cao), thuận tiện bốc dỡ trước.
 * 3. Sắp xếp trọng tâm & tầng (Layering):
 *    - Kiện nặng, kiện đáy sàn được xếp ở tầng dưới (bottom).
 *    - Kiện nhẹ hơn, kiện carton cho phép xếp chồng đặt ở tầng trên.
 * 4. Quy đổi tọa độ sang tỷ lệ hiển thị % (left, bottom, width, height) phù hợp giao diện 3D thùng xe.
 */

export const DEFAULT_PALETTES = [
  { color: '#bbf7d0', strokeColor: '#22c55e', badgeColor: 'green' },
  { color: '#fed7aa', strokeColor: '#f97316', badgeColor: 'orange' },
  { color: '#bfdbfe', strokeColor: '#3b82f6', badgeColor: 'blue' },
  { color: '#fef08a', strokeColor: '#eab308', badgeColor: 'yellow' },
  { color: '#ddd6fe', strokeColor: '#8b5cf6', badgeColor: 'purple' },
  { color: '#fbcfe8', strokeColor: '#ec4899', badgeColor: 'pink' }
];

// Kích thước chuẩn mặc định thùng xe tải (cm)
export const DEFAULT_TRUCK_SPEC = {
  length_cm: 420, // 4.2m
  width_cm: 190,  // 1.9m
  height_cm: 190, // 1.9m
  max_payload: 2500, // 2500 kg
  model: 'Hyundai 2.5 t'
};

/**
 * Tự động tính toán kế hoạch xếp hàng 3D từ danh sách đơn hàng và thông số xe
 * @param {Array} orders - Danh sách đơn hàng trong chuyến xe
 * @param {Object} truckConfig - Kích thước & tải trọng thùng xe (kèm stops cấu hình)
 * @returns {Object} { stops, blocks, bulkCargos, summary }
 */
export function calculate3DLoadPlan(orders = [], truckConfig = {}) {
  const truck = {
    length_cm: truckConfig.length_cm || truckConfig.truck_length || 420,
    width_cm: truckConfig.width_cm || truckConfig.truck_width || 190,
    height_cm: truckConfig.height_cm || truckConfig.truck_height || 190,
    max_payload: truckConfig.max_payload || 2500
  };

  const truckVolumeM3 = Number(((truck.length_cm * truck.width_cm * truck.height_cm) / 1000000).toFixed(1));

  // Kiểm tra nếu có cấu hình các điểm trả (assignment_stops từ modal chọn xe)
  const isMultiDrop = truckConfig.is_multi_drop === true;
  const assignmentDropoffs = Array.isArray(truckConfig.assignment_stops)
    ? truckConfig.assignment_stops.filter(s => s.type === 'DROPOFF')
    : [];

  const rawOrders = Array.isArray(orders) && orders.length > 0
    ? orders
    : (truckConfig.order ? [truckConfig.order] : []);

  if (rawOrders.length === 0) {
    return {
      stops: [],
      blocks: [],
      bulkCargos: [],
      summary: {
        totalWeight: 0,
        maxPayload: truck.max_payload,
        weightPercent: 0,
        totalVolume: 0,
        maxVolume: truckVolumeM3,
        volumePercent: 0,
        ordersCount: 0,
        stopsCount: 0
      }
    };
  }

  // 1. Xác định Danh sách các Điểm giao (Stops):
  // - Nếu là Chuyến ghép nhiều điểm trả (MULTI_POINTS) & có assignmentDropoffs:
  //   Mỗi điểm trả là một stop riêng biệt có thứ tự giao rõ ràng.
  // - Nếu là Chuyến thẳng 1 điểm trả (STANDALONE) hoặc đơn giao 1 nơi:
  //   Chỉ có 1 điểm giao chính duy nhất.
  let stops = [];

  if (isMultiDrop && assignmentDropoffs.length > 1) {
    // Nhiều điểm trả khác nhau trên cùng chuyến
    stops = assignmentDropoffs.map((drop, idx) => {
      const palette = DEFAULT_PALETTES[idx % DEFAULT_PALETTES.length];
      const letter = String.fromCharCode(65 + idx);
      return {
        id: letter,
        key: drop.id || letter,
        name: `${letter} - ${drop.name.replace(/Điểm trả \d+:?\s*/i, '').trim()}`,
        orders: rawOrders, // Hàng phân bổ
        ordersCount: Math.max(1, Math.round((rawOrders[0]?.package_count || 3) / assignmentDropoffs.length)),
        weight: Math.round((rawOrders.reduce((sum, o) => sum + (Number(o.weight || o.chargeable) || 100), 0)) / assignmentDropoffs.length),
        color: palette.color,
        strokeColor: palette.strokeColor,
        badgeColor: palette.badgeColor,
        visible: true
      };
    });
  } else {
    // 1 ĐIỂM TRẢ HÀNG DUY NHẤT (Chuyến thẳng)
    const singleDropName = assignmentDropoffs[0]?.name 
      || rawOrders[0]?.dropoff 
      || rawOrders[0]?.delivery_address 
      || rawOrders[0]?.customer 
      || 'Kho khách hàng';

    const palette = DEFAULT_PALETTES[0];
    stops = [
      {
        id: 'A',
        key: 'A',
        name: singleDropName.replace(/Điểm trả \d+:?\s*/i, '').trim(),
        orders: rawOrders,
        ordersCount: rawOrders.reduce((sum, o) => sum + (parseInt(o.package_count) || 1), 0),
        weight: rawOrders.reduce((sum, o) => sum + (Number(o.weight || o.chargeable) || 200), 0),
        color: palette.color,
        strokeColor: palette.strokeColor,
        badgeColor: palette.badgeColor,
        visible: true
      }
    ];
  }

  // 2. Phân loại Kiện hàng 3D và Hàng rời
  const bulkCargos = [];
  const dimensionalItems = [];

  let totalWeight = 0;
  let totalVolumeCm3 = 0;

  stops.forEach((stop, stopIndex) => {
    stop.orders.forEach((ord, ordIdx) => {
      const pkgCount = Math.max(1, parseInt(ord.package_count) || 1);
      const totalPkgWeight = Number(ord.weight || ord.chargeable || 200);
      const pkgWeight = Math.round(totalPkgWeight / (stops.length > 1 ? stops.length : 1));
      totalWeight += pkgWeight;

      const note = (ord.order_notes || ord.user_note || '').toUpperCase();
      const isExplicitBulk = note.includes('BULK') || note.includes('HÀNG RỜI') || ord.cargo_type === 'BULK';

      let l = parseFloat(ord.length_cm) || 0;
      let w = parseFloat(ord.width_cm) || 0;
      let h = parseFloat(ord.height_cm) || 0;

      // Nếu đơn có items chi tiết bên trong
      if (Array.isArray(ord.items) && ord.items.length > 0) {
        l = parseFloat(ord.items[0].length_cm) || l;
        w = parseFloat(ord.items[0].width_cm) || w;
        h = parseFloat(ord.items[0].height_cm) || h;
      }

      // Nếu đơn chưa nhập kích thước chi tiết nhưng có package_count / volume, tự tạo kích thước chuẩn Pallet/Carton thực tế
      if (!l || !w || !h) {
        if (!isExplicitBulk) {
          l = 100;
          w = 80;
          h = 85;
        }
      }

      if (isExplicitBulk) {
        bulkCargos.push({
          id: ord.hawb_code || ord.order_id || `BULK-${ordIdx + 1}`,
          customer: ord.customer || 'Khách hàng',
          weight: `${pkgWeight} kg`,
          spec: `${pkgCount} ${ord.package_unit || 'bao / kiện rời'}`,
          stopName: stop.name
        });
      } else {
        // Tạo các khối kiện hàng tương ứng theo số lượng kiện (tối đa 6 khối để hiển thị mô hình đẹp mắt)
        const itemsToGenerate = Math.min(pkgCount, stops.length > 1 ? 2 : 5);
        for (let k = 0; k < itemsToGenerate; k++) {
          const itemL = l;
          const itemW = w;
          const itemH = h;
          totalVolumeCm3 += (itemL * itemW * itemH);

          dimensionalItems.push({
            order: ord,
            itemCode: `${ord.hawb_code || ord.order_id || '00' + (k + 1)}${itemsToGenerate > 1 ? `-${k + 1}` : ''}`,
            stopId: stop.id,
            stopIndex,
            length_cm: itemL,
            width_cm: itemW,
            height_cm: itemH,
            weight_kg: Math.round(pkgWeight / itemsToGenerate),
            customer: ord.customer || 'ADTEK (VIET NAM) CO., LTD',
            type: ord.cargo_name || (itemH >= 80 ? 'Pallet' : 'Kiện thùng carton'),
            stackable: itemH <= 90
          });
        }
      }
    });
  });

  // 3. Quy tắc LIFO (Last In First Out) - CHỈ ÁP DỤNG KHI CÓ NHIỀU ĐIỂM GIAO:
  // Nếu chỉ có 1 điểm giao duy nhất: Xếp tuần tự từ trong ra ngoài (sàn trước, chồng sau).
  // Nếu có nhiều điểm giao: Stop giao sau cùng (stopIndex lớn) xếp sát Đầu xe trước (X thấp).
  if (stops.length > 1) {
    dimensionalItems.sort((a, b) => {
      if (a.stopIndex !== b.stopIndex) {
        return b.stopIndex - a.stopIndex; // Stop giao sau xếp sát đầu xe
      }
      return b.weight_kg - a.weight_kg; // Kiện nặng dưới sàn
    });
  } else {
    // 1 điểm trả: Kiện nặng dưới sàn, kiện nhẹ xếp chồng
    dimensionalItems.sort((a, b) => b.weight_kg - a.weight_kg);
  }

  // 4. Thuật toán phân bổ khối hàng lên không gian thùng xe (Left, Bottom, Width, Height)
  const blocks = [];
  const startLeftPct = 8;
  const availableWidthPct = 82;
  const totalItemsCount = dimensionalItems.length;

  if (totalItemsCount > 0) {
    const columns = [];
    dimensionalItems.forEach((item) => {
      const lastCol = columns[columns.length - 1];
      const canStackOnLastCol = lastCol &&
        lastCol.items.length === 1 &&
        lastCol.stopId === item.stopId &&
        lastCol.items[0].stackable &&
        item.stackable;

      if (canStackOnLastCol) {
        lastCol.items.push(item);
      } else {
        columns.push({
          stopId: item.stopId,
          items: [item]
        });
      }
    });

    const numCols = columns.length;
    const colWidthPct = Math.min(26, Math.max(16, Math.floor(availableWidthPct / Math.max(1, numCols))));

    columns.forEach((col, cIdx) => {
      const leftPct = startLeftPct + (cIdx * (colWidthPct + 3));

      col.items.forEach((item, rowIdx) => {
        const isUpperTier = rowIdx > 0;
        const heightPct = isUpperTier ? 24 : (col.items.length > 1 ? 40 : 48);
        const bottomPct = isUpperTier ? 54 : 12;

        blocks.push({
          id: `${item.itemCode}-${cIdx}-${rowIdx}`,
          palletCode: item.itemCode,
          stopId: item.stopId,
          customer: item.customer,
          type: item.type,
          dimensions: `${item.length_cm} × ${item.width_cm} × ${item.height_cm} cm`,
          weight: `${item.weight_kg} kg`,
          stackable: isUpperTier ? 'Có (Tầng trên)' : (item.stackable ? 'Có' : 'Không'),
          left: `${leftPct}%`,
          bottom: `${bottomPct}%`,
          width: `${colWidthPct}%`,
          height: `${heightPct}%`,
          topFaceHeight: 18,
          rightFaceWidth: 22
        });
      });
    });
  }

  const totalVolumeM3 = Number((totalVolumeCm3 / 1000000).toFixed(1));

  return {
    stops,
    blocks,
    bulkCargos,
    summary: {
      totalWeight,
      maxPayload: truck.max_payload,
      weightPercent: truck.max_payload > 0 ? Math.round((totalWeight / truck.max_payload) * 100) : 0,
      totalVolume: totalVolumeM3,
      maxVolume: truckVolumeM3,
      volumePercent: truckVolumeM3 > 0 ? Math.round((totalVolumeM3 / truckVolumeM3) * 100) : 0,
      ordersCount: orders.length,
      stopsCount: stops.length
    }
  };
}
