export const DEFAULT_PALETTES = [
  { color: "#bbf7d0", strokeColor: "#16a34a", badgeColor: "green", topColor: "#dcfce7", sideColor: "#86efac" },
  { color: "#fed7aa", strokeColor: "#ea580c", badgeColor: "orange", topColor: "#ffedd5", sideColor: "#fdba74" },
  { color: "#bfdbfe", strokeColor: "#2563eb", badgeColor: "blue", topColor: "#dbeafe", sideColor: "#93c5fd" },
  { color: "#fef08a", strokeColor: "#ca8a04", badgeColor: "yellow", topColor: "#fef9c3", sideColor: "#fde047" },
  { color: "#ddd6fe", strokeColor: "#7c3aed", badgeColor: "purple", topColor: "#ede9fe", sideColor: "#c4b5fd" },
  { color: "#fbcfe8", strokeColor: "#db2777", badgeColor: "pink", topColor: "#fce7f3", sideColor: "#f9a8d4" },
];

// Kích thước chuẩn mặc định thùng xe tải (cm)
export const DEFAULT_TRUCK_SPEC = {
  length_cm: 500, // 5.0m
  width_cm: 205,  // 2.05m
  height_cm: 205, // 2.05m
  max_payload: 3500, // 3500 kg
  model: "Xe tải 3.5 tấn",
};

/**
 * Tìm bộ ước số (nx, ny, nz) sao cho nx * ny * nz >= count và gần count nhất
 * để chia một khối lô tổng (L x W x H) thành các kiện hàng thực tế cân đối
 */
function computeBestGridSubdivision(count, lotL, lotW, lotH) {
  if (count <= 1) return { nx: 1, ny: 1, nz: 1 };

  let best = { nx: count, ny: 1, nz: 1, score: Infinity };

  for (let nx = 1; nx <= count; nx++) {
    for (let ny = 1; ny <= count; ny++) {
      for (let nz = 1; nz <= count; nz++) {
        const capacity = nx * ny * nz;
        if (capacity < count) continue;
        if (capacity > count + Math.max(2, Math.ceil(count * 0.25))) continue;

        const pkgL = lotL / nx;
        const pkgW = lotW / ny;
        const pkgH = lotH / nz;

        // Ưu tiên kiện hàng có tỉ lệ các cạnh cân đối (gần thùng carton / pallet thực tế)
        const maxDim = Math.max(pkgL, pkgW, pkgH);
        const minDim = Math.max(1, Math.min(pkgL, pkgW, pkgH));
        const aspectPenalty = maxDim / minDim;
        const wastePenalty = (capacity - count) * 2.5;
        const score = aspectPenalty + wastePenalty;

        if (score < best.score) {
          best = { nx, ny, nz, score };
        }
      }
    }
  }

  return best;
}

/**
 * Kiểm tra 2 hình hộp 3D có giao nhau không
 */
function boxesOverlap3D(a, b) {
  const eps = 0.01;
  return (
    a.x < b.x + b.dx - eps &&
    a.x + a.dx > b.x + eps &&
    a.y < b.y + b.dy - eps &&
    a.y + a.dy > b.y + eps &&
    a.z < b.z + b.dz - eps &&
    a.z + a.dz > b.z + eps
  );
}

/**
 * Kiểm tra diện tích đỡ bên dưới khi xếp chồng (z > 0)
 * Đảm bảo kiện hàng tầng trên có ít nhất 65% diện tích đáy đặt trên các kiện hàng stackable bên dưới
 */
function hasAdequateFloorSupport(candidateBox, placedBoxes) {
  if (candidateBox.z <= 0.1) return true; // Đặt trực tiếp trên sàn thùng xe

  const eps = 1.5;
  let supportedArea = 0;
  const baseArea = candidateBox.dx * candidateBox.dy;
  if (baseArea <= 0) return false;

  for (const b of placedBoxes) {
    if (!b.stackable) continue;
    const topZ = b.z + b.dz;
    if (Math.abs(topZ - candidateBox.z) <= eps) {
      const overlapX = Math.max(
        0,
        Math.min(candidateBox.x + candidateBox.dx, b.x + b.dx) - Math.max(candidateBox.x, b.x)
      );
      const overlapY = Math.max(
        0,
        Math.min(candidateBox.y + candidateBox.dy, b.y + b.dy) - Math.max(candidateBox.y, b.y)
      );
      supportedArea += overlapX * overlapY;
    }
  }

  return supportedArea / baseArea >= 0.6;
}

/**
 * THUẬT TOÁN XẾP HÀNG 3D TỐI ƯU:
 * 3D Extreme-Point + LIFO Multi-Stop + Gravity/Stability Layer Bin Packing
 *
 * @param {Array} orders - Danh sách đơn hàng trong chuyến xe
 * @param {Object} truckConfig - Kích thước & tải trọng thùng xe + stops + packingMode
 *   packingMode:
 *     - 'AUTO' (mặc định): Tự động nhận diện nếu khách nhập kích thước tổng cả lô (VD: 20 thùng, 200x200x200cm)
 *       thì chia thành 20 kiện thùng carton để xếp 3D trực quan đủ 20 kiện.
 *     - 'LOT_SUBDIVIDED': Chia kích thước lô cho số lượng kiện (hiển thị đủ N kiện).
 *     - 'SINGLE_LOT_BLOCK': Giữ nguyên 1 khối lô tổng đúng số đo DxRxC.
 *     - 'PER_PACKAGE': Xem DxRxC là kích thước của từng kiện riêng lẻ (N kiện x DxRxC).
 * @returns {Object} { stops, blocks, overflowBlocks, bulkCargos, summary, cargoSpecSummary }
 */
export function calculate3DLoadPlan(orders = [], truckConfig = {}) {
  const truck = {
    length_cm: Number(truckConfig.length_cm || truckConfig.truck_length) || 500,
    width_cm: Number(truckConfig.width_cm || truckConfig.truck_width) || 205,
    height_cm: Number(truckConfig.height_cm || truckConfig.truck_height) || 205,
    max_payload: Number(truckConfig.max_payload) || 3500,
  };

  const packingMode = truckConfig.packingMode || "AUTO";

  const truckVolumeM3 = Number(
    ((truck.length_cm * truck.width_cm * truck.height_cm) / 1000000).toFixed(2)
  );

  // 1. Xác định danh sách Điểm trả hàng (Stops)
  // Mặc định luôn là 1 điểm trả duy nhất theo đúng đơn hàng, trừ khi điều phối chọn Ghép nhiều điểm trả
  const isMultiDrop = truckConfig.is_multi_drop === true;
  const assignmentDropoffs = Array.isArray(truckConfig.assignment_stops)
    ? truckConfig.assignment_stops.filter((s) => s.type === "DROPOFF")
    : [];

  const rawOrders =
    Array.isArray(orders) && orders.length > 0
      ? orders
      : truckConfig.order
        ? [truckConfig.order]
        : [];

  if (rawOrders.length === 0) {
    return {
      stops: [],
      blocks: [],
      overflowBlocks: [],
      bulkCargos: [],
      truck,
      summary: {
        totalWeight: 0,
        packedWeight: 0,
        maxPayload: truck.max_payload,
        weightPercent: 0,
        totalVolume: 0,
        packedVolume: 0,
        maxVolume: truckVolumeM3,
        volumePercent: 0,
        ordersCount: 0,
        stopsCount: 0,
        totalPackagesCount: 0,
        packedPackagesCount: 0,
        overflowPackagesCount: 0,
        isOverloaded: false,
      },
    };
  }

  let stops = [];

  if (isMultiDrop && assignmentDropoffs.length > 1) {
    stops = assignmentDropoffs.map((drop, idx) => {
      const palette = DEFAULT_PALETTES[idx % DEFAULT_PALETTES.length];
      const letter = String.fromCharCode(65 + idx);
      const cleanName = (drop.rawAddress || drop.name || "")
        .replace(/^Điểm trả(\s+\d+)?:?\s*/i, "")
        .trim();
      return {
        id: letter,
        key: drop.id || letter,
        stopSequence: idx + 1,
        name: `${letter} - ${cleanName}`,
        rawAddress: cleanName,
        orders: rawOrders,
        ordersCount: rawOrders.length,
        packageCount: 0,
        weight: 0,
        color: palette.color,
        strokeColor: palette.strokeColor,
        badgeColor: palette.badgeColor,
        topColor: palette.topColor,
        sideColor: palette.sideColor,
        visible: true,
      };
    });
  } else {
    const singleDropName =
      assignmentDropoffs[0]?.rawAddress ||
      assignmentDropoffs[0]?.name ||
      rawOrders[0]?.delivery_address ||
      rawOrders[0]?.dropoff ||
      rawOrders[0]?.customer ||
      "Kho khách hàng";

    const cleanName = singleDropName.replace(/^Điểm trả(\s+\d+)?:?\s*/i, "").trim();
    const palette = DEFAULT_PALETTES[0];
    stops = [
      {
        id: "A",
        key: "A",
        stopSequence: 1,
        name: `A - ${cleanName}`,
        rawAddress: cleanName,
        orders: rawOrders,
        ordersCount: rawOrders.length,
        packageCount: 0,
        weight: 0,
        color: palette.color,
        strokeColor: palette.strokeColor,
        badgeColor: palette.badgeColor,
        topColor: palette.topColor,
        sideColor: palette.sideColor,
        visible: true,
      },
    ];
  }

  // 2. Thu thập danh sách kiện hàng thực tế từ dữ liệu khách cung cấp
  const bulkCargos = [];
  const dimensionalItems = [];
  const cargoSpecDetails = [];

  let totalCustomerWeightKg = 0;
  let totalCustomerVolumeCm3 = 0;
  let totalRequestedPackages = 0;

  rawOrders.forEach((ord, ordIdx) => {
    const orderCode = ord.order_id || ord.id || `ORD-${ordIdx + 1}`;
    const customerName = ord.customer || ord.customer_name || "Khách hàng";

    // Lấy danh sách loại hàng trong đơn (nếu có mảng items), hoặc lấy trực tiếp từ order
    const rawItems =
      Array.isArray(ord.items) && ord.items.length > 0
        ? ord.items.map((it) => ({
            cargo_name: it.cargo_name || ord.cargo_name || "Hàng hóa",
            cargo_type: it.cargo_type || ord.cargo_type || "GENERAL",
            package_count: Math.max(1, parseInt(it.package_count) || parseInt(ord.package_count) || 1),
            package_unit: it.package_unit || ord.package_unit || "Thùng Carton",
            length_cm: parseFloat(it.length_cm) || parseFloat(ord.length_cm) || 0,
            width_cm: parseFloat(it.width_cm) || parseFloat(ord.width_cm) || 0,
            height_cm: parseFloat(it.height_cm) || parseFloat(ord.height_cm) || 0,
            weight_kg: Number(it.weight) || Number(ord.weight || ord.actual_weight_kg || ord.chargeable) || 200,
          }))
        : [
            {
              cargo_name: ord.cargo_name || "Hàng hóa",
              cargo_type: ord.cargo_type || "GENERAL",
              package_count: Math.max(1, parseInt(ord.package_count) || 1),
              package_unit: ord.package_unit || "Thùng Carton",
              length_cm: parseFloat(ord.length_cm) || 0,
              width_cm: parseFloat(ord.width_cm) || 0,
              height_cm: parseFloat(ord.height_cm) || 0,
              weight_kg: Number(ord.weight || ord.actual_weight_kg || ord.chargeable) || 200,
            },
          ];

    rawItems.forEach((cargoItem, itemIdx) => {
      const pkgCount = Math.max(1, cargoItem.package_count);
      const totalItemWeight = Math.max(1, cargoItem.weight_kg);
      totalCustomerWeightKg += totalItemWeight;
      totalRequestedPackages += pkgCount;

      const note = (ord.order_notes || ord.user_note || "").toUpperCase();
      const isExplicitBulk =
        note.includes("BULK") ||
        note.includes("HÀNG RỜI") ||
        cargoItem.cargo_type === "BULK";

      let inputL = cargoItem.length_cm;
      let inputW = cargoItem.width_cm;
      let inputH = cargoItem.height_cm;

      if (!inputL || !inputW || !inputH) {
        if (!isExplicitBulk) {
          inputL = 100;
          inputW = 80;
          inputH = 80;
        }
      }

      if (isExplicitBulk) {
        bulkCargos.push({
          id: orderCode,
          customer: customerName,
          weight: `${totalItemWeight} kg`,
          spec: `${pkgCount} ${cargoItem.package_unit}`,
          stopName: stops[0]?.name || "Kho khách hàng",
        });
        return;
      }

      // Quyết định quy cách kích thước kiện hàng dựa trên packingMode:
      // Khi khách khai báo VD: 20 Thùng Carton, kích thước 200x200x200 cm, nặng 2000 kg:
      // - Nếu 'AUTO' và pkgCount > 1 và thể tích (inputL*inputW*inputH) >= 1.2 m³:
      //   200x200x200 cm (8 m³) là kích thước tổng của lô 20 thùng. Chia lưới (grid subdivision) để hiển thị đủ 20 kiện thùng carton!
      const singleVolumeM3 = (inputL * inputW * inputH) / 1000000;
      let effectiveMode = packingMode;
      if (effectiveMode === "AUTO") {
        if (pkgCount > 1 && singleVolumeM3 >= 1.2) {
          effectiveMode = "LOT_SUBDIVIDED";
        } else {
          effectiveMode = "PER_PACKAGE";
        }
      }

      let unitL = inputL;
      let unitW = inputW;
      let unitH = inputH;
      let boxesToCreate = pkgCount;
      let unitWeightKg = Number((totalItemWeight / pkgCount).toFixed(1));

      if (effectiveMode === "LOT_SUBDIVIDED" && pkgCount > 1) {
        const grid = computeBestGridSubdivision(pkgCount, inputL, inputW, inputH);
        unitL = Math.max(20, Math.round(inputL / grid.nx));
        unitW = Math.max(20, Math.round(inputW / grid.ny));
        unitH = Math.max(20, Math.round(inputH / grid.nz));
        boxesToCreate = pkgCount;
        totalCustomerVolumeCm3 += inputL * inputW * inputH;
      } else if (effectiveMode === "SINGLE_LOT_BLOCK") {
        unitL = inputL;
        unitW = inputW;
        unitH = inputH;
        boxesToCreate = stops.length;
        unitWeightKg = Number((totalItemWeight / boxesToCreate).toFixed(1));
        totalCustomerVolumeCm3 += inputL * inputW * inputH;
      } else {
        // PER_PACKAGE: mỗi kiện có kích thước inputL x inputW x inputH
        unitL = inputL;
        unitW = inputW;
        unitH = inputH;
        boxesToCreate = pkgCount;
        totalCustomerVolumeCm3 += inputL * inputW * inputH * pkgCount;
      }

      cargoSpecDetails.push({
        orderCode,
        cargoName: cargoItem.cargo_name,
        cargoType: cargoItem.cargo_type,
        packageCount: pkgCount,
        packageUnit: cargoItem.package_unit,
        inputDimensionsCm: `${inputL} × ${inputW} × ${inputH} cm`,
        unitDimensionsCm: `${unitL} × ${unitW} × ${unitH} cm`,
        totalWeightKg: totalItemWeight,
        unitWeightKg,
        effectiveMode,
      });

      const isFragile = cargoItem.cargo_type === "FRAGILE";
      const isStackable = !isFragile && unitH <= truck.height_cm * 0.75;

      for (let k = 0; k < boxesToCreate; k++) {
        // Phân bổ kiện hàng vào các điểm dừng (nếu có nhiều điểm trả thì chia đều theo stop)
        const assignedStopIdx = stops.length > 1 ? k % stops.length : 0;
        const assignedStop = stops[assignedStopIdx];

        assignedStop.packageCount += effectiveMode === "SINGLE_LOT_BLOCK" ? Math.round(pkgCount / stops.length) : 1;
        assignedStop.weight = Math.round(assignedStop.weight + unitWeightKg);

        const codeSuffix = boxesToCreate > 1 ? `#${String(k + 1).padStart(2, "0")}` : "";

        dimensionalItems.push({
          id: `${orderCode}-${itemIdx + 1}-${k + 1}`,
          orderCode,
          palletCode: `${orderCode}${codeSuffix ? ` (${codeSuffix})` : ""}`,
          shortLabel: boxesToCreate > 1 ? `${cargoItem.package_unit} ${codeSuffix}` : orderCode,
          packageIndex: k + 1,
          totalPackagesInLot: pkgCount,
          packageUnit: cargoItem.package_unit,
          stopId: assignedStop.id,
          stopIndex: assignedStopIdx,
          stopName: assignedStop.name,
          customer: customerName,
          cargoName: cargoItem.cargo_name,
          cargoType: cargoItem.cargo_type,
          length_cm: unitL,
          width_cm: unitW,
          height_cm: unitH,
          inputDimensionsCm: `${inputL} × ${inputW} × ${inputH} cm`,
          weight_kg: unitWeightKg,
          stackable: isStackable,
          effectiveMode,
        });
      }
    });
  });

  // 3. Sắp xếp kiện hàng theo quy tắc LIFO (BR-43) + Độ ổn định trọng tâm (Nặng dưới sàn, lớn xếp trước)
  // - Điểm dừng giao sau cùng (stopIndex lớn hơn) được xếp vào trước (sát vách đầu xe X = 0)
  // - Trong cùng điểm dừng: Kiện nặng hơn và diện tích đáy lớn hơn xếp trước xuống sàn
  dimensionalItems.sort((a, b) => {
    if (stops.length > 1 && a.stopIndex !== b.stopIndex) {
      return b.stopIndex - a.stopIndex; // LIFO: Giao sau xếp trong (X nhỏ), giao trước xếp ngoài (X lớn)
    }
    if (a.stackable !== b.stackable) {
      return a.stackable ? -1 : 1; // Kiện chịu lực (stackable) đặt dưới sàn trước
    }
    if (Math.abs(b.weight_kg - a.weight_kg) > 0.5) {
      return b.weight_kg - a.weight_kg; // Kiện nặng ở dưới
    }
    const volA = a.length_cm * a.width_cm * a.height_cm;
    const volB = b.length_cm * b.width_cm * b.height_cm;
    return volB - volA;
  });

  // 4. THUẬT TOÁN 3D EXTREME-POINT BIN PACKING TRONG HỆ TỌA ĐỘ THÙNG XE (X: Dài, Y: Rộng, Z: Cao)
  // Gốc tọa độ (0, 0, 0): Vách trước Đầu xe (x=0), Vách trái (y=0), Sàn xe (z=0)
  const placedBoxes = [];
  const overflowBlocks = [];
  let candidatePoints = [{ x: 0, y: 0, z: 0 }];
  let cumulativeWeightKg = 0;
  let packedVolumeCm3 = 0;

  for (const item of dimensionalItems) {
    // Kiểm tra tải trọng cho phép (BR-25 / MSG66)
    const exceedsPayload = cumulativeWeightKg + item.weight_kg > truck.max_payload + 0.01;

    // 2 hướng xoay ngang trên mặt sàn (giữ nguyên trục đứng Z = height_cm)
    const orientations = [
      { dx: item.length_cm, dy: item.width_cm, dz: item.height_cm, rotated: false },
    ];
    if (item.length_cm !== item.width_cm) {
      orientations.push({
        dx: item.width_cm,
        dy: item.length_cm,
        dz: item.height_cm,
        rotated: true,
      });
    }

    // Sắp xếp các điểm Extreme Point ứng viên:
    // Ưu tiên: 1. Sát đầu xe (x nhỏ) -> 2. Sát sàn xe (z nhỏ) -> 3. Từ trái qua phải (y nhỏ)
    candidatePoints.sort((p1, p2) => {
      if (Math.abs(p1.x - p2.x) > 1) return p1.x - p2.x;
      if (Math.abs(p1.z - p2.z) > 1) return p1.z - p2.z;
      return p1.y - p2.y;
    });

    let bestPlacement = null;

    for (const pt of candidatePoints) {
      for (const orient of orientations) {
        // Kiểm tra vừa lòng thùng xe
        if (
          pt.x + orient.dx > truck.length_cm + 0.1 ||
          pt.y + orient.dy > truck.width_cm + 0.1 ||
          pt.z + orient.dz > truck.height_cm + 0.1
        ) {
          continue;
        }

        const candidateBox = {
          x: pt.x,
          y: pt.y,
          z: pt.z,
          dx: orient.dx,
          dy: orient.dy,
          dz: orient.dz,
        };

        // Kiểm tra va chạm với các kiện đã xếp
        let hasCollision = false;
        for (const placed of placedBoxes) {
          if (boxesOverlap3D(candidateBox, placed)) {
            hasCollision = true;
            break;
          }
        }
        if (hasCollision) continue;

        // Kiểm tra độ vững chắc khi xếp chồng (z > 0)
        if (!hasAdequateFloorSupport(candidateBox, placedBoxes)) {
          continue;
        }

        bestPlacement = {
          ...candidateBox,
          rotated: orient.rotated,
        };
        break;
      }
      if (bestPlacement) break;
    }

    if (bestPlacement && !exceedsPayload) {
      const tierLevel = bestPlacement.z > 0.5 ? Math.floor(bestPlacement.z / Math.max(1, item.height_cm)) + 1 : 1;
      const placedRecord = {
        ...item,
        x: Math.round(bestPlacement.x),
        y: Math.round(bestPlacement.y),
        z: Math.round(bestPlacement.z),
        dx: Math.round(bestPlacement.dx),
        dy: Math.round(bestPlacement.dy),
        dz: Math.round(bestPlacement.dz),
        rotated: bestPlacement.rotated,
        tierLevel,
        dimensions: `${Math.round(bestPlacement.dx)} × ${Math.round(bestPlacement.dy)} × ${Math.round(bestPlacement.dz)} cm`,
        weight: `${item.weight_kg} kg`,
        positionText: `Dài X: ${Math.round(bestPlacement.x)}–${Math.round(bestPlacement.x + bestPlacement.dx)}cm · Rộng Y: ${Math.round(bestPlacement.y)}–${Math.round(bestPlacement.y + bestPlacement.dy)}cm · Cao Z: ${Math.round(bestPlacement.z)}–${Math.round(bestPlacement.z + bestPlacement.dz)}cm (Tầng ${tierLevel})`,
        stackableText:
          tierLevel > 1
            ? `Có (Đang xếp Tầng ${tierLevel})`
            : item.stackable
              ? "Có (Chịu lực tầng dưới)"
              : "Không (Hàng không xếp chồng)",
      };

      placedBoxes.push(placedRecord);
      cumulativeWeightKg += item.weight_kg;
      packedVolumeCm3 += bestPlacement.dx * bestPlacement.dy * bestPlacement.dz;

      // Sinh thêm 3 Extreme Points mới từ góc của kiện vừa đặt
      const newPts = [
        { x: bestPlacement.x + bestPlacement.dx, y: bestPlacement.y, z: bestPlacement.z },
        { x: bestPlacement.x, y: bestPlacement.y + bestPlacement.dy, z: bestPlacement.z },
        { x: bestPlacement.x, y: bestPlacement.y, z: bestPlacement.z + bestPlacement.dz },
      ];

      for (const np of newPts) {
        if (
          np.x < truck.length_cm &&
          np.y < truck.width_cm &&
          np.z < truck.height_cm &&
          !candidatePoints.some(
            (ep) =>
              Math.abs(ep.x - np.x) < 1 &&
              Math.abs(ep.y - np.y) < 1 &&
              Math.abs(ep.z - np.z) < 1
          )
        ) {
          candidatePoints.push(np);
        }
      }
    } else {
      // Kiện hàng bị tràn kích thước hoặc vượt tải trọng (MSG66)
      let reason = "Hết không gian thể tích thùng xe (MSG66)";
      if (
        item.length_cm > truck.length_cm ||
        item.width_cm > truck.width_cm ||
        item.height_cm > truck.height_cm
      ) {
        reason = `Kích thước kiện (${item.length_cm}×${item.width_cm}×${item.height_cm} cm) vượt lòng thùng xe (${truck.length_cm}×${truck.width_cm}×${truck.height_cm} cm) (MSG66)`;
      } else if (exceedsPayload) {
        reason = `Vượt tải trọng cho phép của xe (${truck.max_payload.toLocaleString()} kg) (MSG66)`;
      }

      overflowBlocks.push({
        ...item,
        dimensions: `${item.length_cm} × ${item.width_cm} × ${item.height_cm} cm`,
        weight: `${item.weight_kg} kg`,
        overflowReason: reason,
      });
    }
  }

  const totalVolumeM3 = Number((totalCustomerVolumeCm3 / 1000000).toFixed(2));
  const packedVolumeM3 = Number((packedVolumeCm3 / 1000000).toFixed(2));

  return {
    stops,
    blocks: placedBoxes,
    overflowBlocks,
    bulkCargos,
    cargoSpecDetails,
    truck,
    summary: {
      totalWeight: Math.round(totalCustomerWeightKg),
      packedWeight: Math.round(cumulativeWeightKg),
      maxPayload: truck.max_payload,
      weightPercent:
        truck.max_payload > 0
          ? Math.round((totalCustomerWeightKg / truck.max_payload) * 100)
          : 0,
      totalVolume: totalVolumeM3,
      packedVolume: packedVolumeM3,
      maxVolume: truckVolumeM3,
      volumePercent:
        truckVolumeM3 > 0
          ? Math.round((totalVolumeM3 / truckVolumeM3) * 100)
          : 0,
      ordersCount: rawOrders.length,
      stopsCount: stops.length,
      totalPackagesCount: totalRequestedPackages,
      packedPackagesCount:
        placedBoxes.length === 1 && placedBoxes[0]?.effectiveMode === "SINGLE_LOT_BLOCK"
          ? totalRequestedPackages
          : placedBoxes.length,
      overflowPackagesCount: overflowBlocks.length,
      isOverloaded:
        overflowBlocks.length > 0 ||
        totalCustomerWeightKg > truck.max_payload ||
        totalVolumeM3 > truckVolumeM3,
    },
  };
}
