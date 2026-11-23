const prisma = require('../config/prisma');
const crypto = require('crypto');
const cloudinaryService = require('./cloudinaryService');
const { toBigInt } = require('../utils/prismaHelper');

const META_NOTE_PREFIX = '[META_JSON]:';
const META_CHUNK_PREFIX = '[META_CHUNK_';
// Cột content của bảng order_notes là VARCHAR(500), giới hạn mỗi phần <= 450 ký tự để an toàn tuyệt đối
const MAX_NOTE_CHUNK_LEN = 450;

// Đẩy các tệp đính kèm Data URI lên Cloudinary thay vì lưu file tạm cục bộ
const uploadMetaAttachmentsToCloudinary = async (orderId, metaObj) => {
  if (!orderId || !metaObj) return metaObj;
  const clone = JSON.parse(JSON.stringify(metaObj));
  const folder = `nexlog/orders/${orderId}`;

  if (typeof clone.contract_file_data === 'string' && clone.contract_file_data.trim().startsWith('data:')) {
    clone.contract_file_data = await cloudinaryService.uploadDataUriIfNeeded(clone.contract_file_data, `${folder}/contract`);
  }

  if (
    typeof clone.web_workflow?.signed_contract?.signature_data === 'string' &&
    clone.web_workflow.signed_contract.signature_data.trim().startsWith('data:')
  ) {
    clone.web_workflow.signed_contract.signature_data = await cloudinaryService.uploadDataUriIfNeeded(
      clone.web_workflow.signed_contract.signature_data,
      `${folder}/contract`
    );
  }

  const processDocsArray = async (arr) => {
    if (!Array.isArray(arr)) return;
    for (const doc of arr) {
      if (!doc) continue;
      if (typeof doc.file_url === 'string' && doc.file_url.trim().startsWith('data:')) {
        const uploadedUrl = await cloudinaryService.uploadDataUriIfNeeded(doc.file_url, `${folder}/docs`);
        doc.file_url = uploadedUrl;
        doc.file_data = uploadedUrl;
      } else if (typeof doc.file_data === 'string' && doc.file_data.trim().startsWith('data:')) {
        const uploadedUrl = await cloudinaryService.uploadDataUriIfNeeded(doc.file_data, `${folder}/docs`);
        doc.file_data = uploadedUrl;
        if (!doc.file_url) doc.file_url = uploadedUrl;
      }
    }
  };

  await processDocsArray(clone.documents);
  await processDocsArray(clone.web_workflow?.documents);
  await processDocsArray(clone.web_workflow?.approved_documents);

  return clone;
};

// Helper map status từ DB sang chuẩn trạng thái Figure 20 (không còn NEGOTIATING)
const mapDbStatusToFe = (dbStatus, order, meta = null) => {
  const upperStatus = (dbStatus || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

  if (upperStatus === 'CLOSED') {
    return 'CLOSED';
  }
  if (
    upperStatus === 'CANCELLED' ||
    upperStatus === 'CANCELED' ||
    upperStatus === 'CANCELLED_RETURNING' ||
    (order?.cancelled_at && order?.cancel_reason)
  ) {
    return order?.is_closed ? 'CLOSED' : 'CANCELLED';
  }
  if (
    upperStatus === 'DELIVERED_EXCEPTION' ||
    upperStatus === 'DELIVERED_EXCEPTION_'
  ) {
    return order?.is_closed ? 'CLOSED' : 'DELIVERED_EXCEPTION';
  }
  if (upperStatus === 'DELIVERED') {
    return order?.is_closed ? 'CLOSED' : 'DELIVERED';
  }
  if (upperStatus === 'HANDED_OVER_VENDOR' || upperStatus === 'HANDED_OVER_TO_VENDOR') {
    return 'HANDED_OVER_VENDOR';
  }
  if (upperStatus === 'IN_TRANSIT' || upperStatus === 'IN_PROGRESS') {
    return 'IN_TRANSIT';
  }
  if (upperStatus === 'PICKED_UP') {
    return 'PICKED_UP';
  }
  if (upperStatus === 'ACCEPTED') {
    return 'ACCEPTED';
  }
  if (upperStatus === 'PLANNED' || upperStatus === 'ASSIGNED' || upperStatus === 'DISPATCHED') {
    return 'ASSIGNED';
  }
  if (upperStatus === 'READY_FOR_PLANNING') {
    return 'READY_FOR_PLANNING';
  }

  const resolvedMeta = meta || parseOrderMeta(order);

  if (
    resolvedMeta?.web_workflow?.stage === 'CONTRACT_SIGNED' ||
    Boolean(order?.ready_for_planning_at)
  ) {
    return 'READY_FOR_PLANNING';
  }

  switch (upperStatus) {
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'WAITING_FOR_DOCUMENTS':
    case 'PENDING_DOCUMENTS':
      if (order?.source === 'HOMEPAGE' && (!order?.agreed_price || order.agreed_price === 0)) {
        return 'DRAFT';
      }
      return 'CONFIRMED';
    default:
      if (
        resolvedMeta?.web_workflow?.stage === 'CUSTOMER_CONFIRMED' ||
        resolvedMeta?.web_workflow?.stage === 'DOCS_UPLOADED' ||
        resolvedMeta?.web_workflow?.stage === 'DOCS_REJECTED' ||
        resolvedMeta?.web_workflow?.stage === 'DOCS_APPROVED' ||
        resolvedMeta?.web_workflow?.stage === 'CONTRACT_SENT' ||
        (Array.isArray(resolvedMeta?.web_workflow?.documents) &&
          resolvedMeta.web_workflow.documents.some((d) => d.file && d.file !== 'Chờ tải lên'))
      ) {
        return 'CONFIRMED';
      }
      return 'DRAFT';
  }
};

// Helper sinh tracking token 43 ký tự
const generateTrackingToken = () => {
  return crypto.randomBytes(32).toString('base64url').padEnd(43, 'x').slice(0, 43);
};

// Kiểm tra locationId có hợp lệ và thuộc hệ thống kho ALS thực tế hay không
const resolveAlsLocationIdIfValid = async (locationId) => {
  const numericId = Number(locationId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  try {
    const loc = await prisma.locations.findFirst({
      where: { id: BigInt(numericId), customer_id: null },
      select: { id: true, type: true, customer_id: true }
    });
    if (!loc) return null;
    const normalizedType = String(loc.type || '').trim().toUpperCase().replace(/\s+/g, '_');
    return normalizedType === 'ALS_WAREHOUSE' ? Number(loc.id) : null;
  } catch {
    return null;
  }
};

// Helper tìm hoặc tạo Location theo chuẩn schema mới (locations)
const getOrCreateLocation = async ({
  name,
  address,
  customerId,
  type = 'CUSTOMER_SITE',
  lat,
  lng,
  contactName,
  contactPhone,
  isNewCustomer = false
}) => {
  try {
    const cleanAddr = (address || '').trim();
    const bigCustomerId = customerId ? toBigInt(customerId) : null;

    // 1. Kiểm tra xem địa chỉ này có thuộc 6 kho thực tế của ALS hay không
    const cleanAddrLower = cleanAddr.toLowerCase();
    if (
      cleanAddrLower.includes('nhà ga hàng hóa als nội bài') ||
      cleanAddrLower.includes('ga hàng hóa als') ||
      cleanAddrLower.includes('als nội bài') ||
      cleanAddrLower.includes('cảng hkqt nội bài') ||
      cleanAddrLower.includes('cảng hàng không quốc tế nội bài') ||
      cleanAddrLower.includes('sân bay quốc tế nội bài') ||
      cleanAddrLower.includes('alsc')
    ) {
      const alsNb = await prisma.locations.findFirst({
        where: { id: 1n, type: 'ALS Warehouse', customer_id: null },
        select: { id: true }
      });
      if (alsNb) return Number(alsNb.id);
    }
    if (cleanAddrLower.includes('als bắc ninh') || cleanAddrLower.includes('alsb') || (cleanAddrLower.includes('yên phong') && cleanAddrLower.includes('als'))) {
      const alsBn = await prisma.locations.findFirst({
        where: { type: 'ALS Warehouse', customer_id: null, name: { contains: 'ALSB', mode: 'insensitive' } },
        select: { id: true }
      });
      if (alsBn) return Number(alsBn.id);
    }
    if (cleanAddrLower.includes('als đông hà nội') || cleanAddrLower.includes('alse') || (cleanAddrLower.includes('vsip') && cleanAddrLower.includes('als'))) {
      const alsDn = await prisma.locations.findFirst({
        where: { type: 'ALS Warehouse', customer_id: null, name: { contains: 'ALSE', mode: 'insensitive' } },
        select: { id: true }
      });
      if (alsDn) return Number(alsDn.id);
    }
    if (cleanAddrLower.includes('als thái nguyên') || cleanAddrLower.includes('alst') || (cleanAddrLower.includes('yên bình') && cleanAddrLower.includes('als'))) {
      const alsTn = await prisma.locations.findFirst({
        where: { type: 'ALS Warehouse', customer_id: null, name: { contains: 'ALST', mode: 'insensitive' } },
        select: { id: true }
      });
      if (alsTn) return Number(alsTn.id);
    }
    if (cleanAddrLower.includes('mỹ đình') && (cleanAddrLower.includes('icd') || cleanAddrLower.includes('als'))) {
      const alsMd = await prisma.locations.findFirst({
        where: { type: 'ALS Warehouse', customer_id: null, name: { contains: 'Mỹ Đình', mode: 'insensitive' } },
        select: { id: true }
      });
      if (alsMd) return Number(alsMd.id);
    }
    if ((cleanAddrLower.includes('gia lâm') && cleanAddrLower.includes('als')) || (cleanAddrLower.includes('nguyễn sơn') && cleanAddrLower.includes('als')) || cleanAddrLower.includes('als long biên')) {
      const alsGl = await prisma.locations.findFirst({
        where: { type: 'ALS Warehouse', customer_id: null, name: { contains: 'Gia Lâm', mode: 'insensitive' } },
        select: { id: true }
      });
      if (alsGl) return Number(alsGl.id);
    }

    // 2. Tự động bóc tách Tỉnh/Thành từ địa chỉ nếu có
    let detectedProvince = 'Hà Nội';
    if (cleanAddrLower.includes('bắc ninh')) detectedProvince = 'Bắc Ninh';
    else if (cleanAddrLower.includes('hải phòng')) detectedProvince = 'Hải Phòng';
    else if (cleanAddrLower.includes('thái nguyên')) detectedProvince = 'Thái Nguyên';
    else if (cleanAddrLower.includes('hưng yên')) detectedProvince = 'Hưng Yên';
    else if (cleanAddrLower.includes('hà nam')) detectedProvince = 'Hà Nam';
    else if (cleanAddrLower.includes('hải dương')) detectedProvince = 'Hải Dương';
    else if (cleanAddrLower.includes('vĩnh phúc')) detectedProvince = 'Vĩnh Phúc';
    else if (cleanAddrLower.includes('phú thọ')) detectedProvince = 'Phú Thọ';
    else if (cleanAddrLower.includes('lạng sơn')) detectedProvince = 'Lạng Sơn';
    else if (cleanAddrLower.includes('lào cai')) detectedProvince = 'Lào Cai';
    else if (cleanAddrLower.includes('quảng ninh')) detectedProvince = 'Quảng Ninh';
    else if (cleanAddrLower.includes('bắc giang')) detectedProvince = 'Bắc Giang';

    // 3. Kiểm tra xem địa chỉ này đã tồn tại trong database chưa (với cùng khách hàng hoặc chung)
    if (cleanAddr) {
      const matchedLoc = await prisma.locations.findFirst({
        where: {
          address: cleanAddr,
          ...(bigCustomerId !== null
            ? { OR: [{ customer_id: bigCustomerId }, { customer_id: null }] }
            : {})
        },
        select: { id: true, name: true, customer_id: true, latitude: true, longitude: true, province: true }
      });

      if (matchedLoc) {
        const updateFields = {};
        if (lat && lng && (!matchedLoc.latitude || !matchedLoc.longitude)) {
          updateFields.latitude = parseFloat(lat);
          updateFields.longitude = parseFloat(lng);
        }
        if (detectedProvince && matchedLoc.province !== detectedProvince) {
          updateFields.province = detectedProvince;
        }
        if (Object.keys(updateFields).length > 0) {
          await prisma.locations.update({
            where: { id: matchedLoc.id },
            data: updateFields
          });
        }
        return Number(matchedLoc.id);
      }
    }

    let cleanName = (name || '').trim();
    cleanName = cleanName
      .replace(/^Điểm (lấy|giao)\s*-\s*/i, '')
      .replace(/\s*\((Điểm gửi|Điểm nhận|Điểm lấy|Điểm giao)\)/gi, '')
      .trim();

    const fallbackName = cleanName || (cleanAddr || 'Địa chỉ khách hàng');

    const newLoc = await prisma.locations.create({
      data: {
        name: fallbackName,
        type: 'Customer Site',
        customer_id: bigCustomerId,
        address: cleanAddr || 'Hà Nội',
        province: detectedProvince,
        latitude: lat ? parseFloat(lat) : 21.0285,
        longitude: lng ? parseFloat(lng) : 105.8542,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        created_by: 1n
      },
      select: { id: true }
    });

    if (newLoc) {
      return Number(newLoc.id);
    }

    return 1;
  } catch (err) {
    console.error('getOrCreateLocation error:', err);
    return 1;
  }
};

// Ghép các mảnh [META_CHUNK_i]: hoặc [META_JSON]: từ danh sách order_notes
const assembleMetaFromNotes = (notesList) => {
  if (!Array.isArray(notesList) || notesList.length === 0) return {};

  // Kiểm tra các mảnh [META_CHUNK_0]:, [META_CHUNK_1]:...
  const chunkNotes = notesList
    .filter((n) => typeof n?.content === 'string' && n.content.startsWith(META_CHUNK_PREFIX))
    .map((n) => {
      const match = n.content.match(/^\[META_CHUNK_(\d+)\]:(.*)$/s);
      if (!match) return null;
      return { index: parseInt(match[1], 10), body: match[2], id: n.id || 0 };
    })
    .filter(Boolean);

  if (chunkNotes.length > 0) {
    // Lấy bộ chunk mới nhất theo index tăng dần
    const byIndex = new Map();
    chunkNotes.sort((a, b) => Number(a.id) - Number(b.id));
    chunkNotes.forEach((c) => byIndex.set(c.index, c.body));
    const sortedIndices = [...byIndex.keys()].sort((a, b) => a - b);
    const fullJson = sortedIndices.map((idx) => byIndex.get(idx)).join('');
    try {
      return JSON.parse(fullJson);
    } catch (e) {
      // fallback bên dưới
    }
  }

  // Fallback [META_JSON]: đơn lẻ
  const metaNote = [...notesList]
    .reverse()
    .find((n) => typeof n?.content === 'string' && n.content.startsWith(META_NOTE_PREFIX));

  if (metaNote) {
    try {
      return JSON.parse(metaNote.content.slice(META_NOTE_PREFIX.length));
    } catch (e) {
      // ignore
    }
  }

  return {};
};

// Đọc metadata từ order (ưu tiên ai_input_text nếu có, hoặc ghép từ order_notes)
const parseOrderMeta = (order) => {
  if (!order) return {};
  let meta = {};

  if (order.ai_input_text) {
    try {
      meta = JSON.parse(order.ai_input_text);
    } catch (e) {
      meta = {};
    }
  } else if (Array.isArray(order.order_notes)) {
    meta = assembleMetaFromNotes(order.order_notes);
  }

  return meta;
};

// Tải metadata từ DB theo orderId
const loadOrderMeta = async (orderId, orderObj = null) => {
  if (orderObj && Array.isArray(orderObj.order_notes) && orderObj.order_notes.length > 0) {
    return parseOrderMeta(orderObj);
  }

  if (!orderId) return {};
  try {
    const notes = await prisma.order_notes.findMany({
      where: { order_id: toBigInt(orderId) },
      select: { id: true, content: true, created_at: true },
      orderBy: { id: 'asc' }
    });

    if (notes && notes.length > 0) {
      return parseOrderMeta({ id: orderId, order_notes: notes });
    }
  } catch (e) {
    // ignore
  }
  return {};
};

// Lưu metadata vào order_notes (tự động chia nhỏ <= 450 ký tự/dòng để tương thích cột VARCHAR(500))
const saveOrderMeta = async (orderId, meta) => {
  if (!orderId || !meta) return;
  try {
    const bigOrderId = toBigInt(orderId);
    const allNotes = await prisma.order_notes.findMany({
      where: { order_id: bigOrderId },
      select: { id: true, content: true, created_at: true },
      orderBy: { id: 'asc' }
    });

    const existingMeta = parseOrderMeta({ id: orderId, order_notes: allNotes || [] });
    const mergedMeta = {
      ...existingMeta,
      ...meta,
      web_workflow: {
        ...(existingMeta.web_workflow || {}),
        ...(meta.web_workflow || {})
      }
    };

    const lightweightMeta = await uploadMetaAttachmentsToCloudinary(orderId, mergedMeta);
    const jsonStr = JSON.stringify(lightweightMeta);

    const oldMetaIds = (allNotes || [])
      .filter(
        (n) =>
          typeof n?.content === 'string' &&
          (n.content.startsWith(META_NOTE_PREFIX) || n.content.startsWith(META_CHUNK_PREFIX))
      )
      .map((n) => n.id);

    await prisma.$transaction(async (tx) => {
      if (oldMetaIds.length > 0) {
        await tx.order_notes.deleteMany({
          where: { id: { in: oldMetaIds } }
        });
      }

      if (META_NOTE_PREFIX.length + jsonStr.length <= 490) {
        await tx.order_notes.create({
          data: {
            order_id: bigOrderId,
            content: `${META_NOTE_PREFIX}${jsonStr}`,
            created_by: 1n
          }
        });
      } else {
        const chunks = [];
        for (let i = 0, idx = 0; i < jsonStr.length; i += MAX_NOTE_CHUNK_LEN, idx++) {
          const piece = jsonStr.slice(i, i + MAX_NOTE_CHUNK_LEN);
          chunks.push({
            order_id: bigOrderId,
            content: `[META_CHUNK_${idx}]:${piece}`,
            created_by: 1n
          });
        }
        await tx.order_notes.createMany({ data: chunks });
      }
    });
  } catch (err) {
    if (err?.statusCode) {
      throw err;
    }
    console.warn('saveOrderMeta warning:', err.message);
  }
};

/**
 * Thuật toán Phân bổ Đơn Web Xoay vòng (Least Loaded Round-Robin):
 * 1. Lọc tất cả Điều phối viên đang ACTIVE (role_id = 3).
 * 2. Đếm số đơn đang hoạt động (Draft, Confirmed, Ready for Planning, Assigned, In Transit).
 * 3. Tìm nhóm Điều phối viên có ít đơn nhất (Least Loaded).
 * 4. Nếu có nhiều người cùng có số đơn ít nhất bằng nhau, thực hiện Xoay vòng (Round-Robin)
 *    dựa trên người phụ trách đơn Web gần nhất để đảm bảo phân bổ đều đặn, công bằng.
 */
const getNextDispatcherForWebOrder = async () => {
  try {
    const prisma = require('../config/prisma');
    const activeDispatchers = await prisma.users.findMany({
      where: { role_id: 3n, status: 'ACTIVE' },
      select: { id: true, full_name: true, username: true }
    });

    if (!activeDispatchers || activeDispatchers.length === 0) {
      return 1; // Fallback dispatcher ID mặc định nếu chưa có tài khoản nào
    }

    const dispIds = activeDispatchers.map((d) => d.id);
    const activeStatuses = [
      'DRAFT',
      'Draft',
      'CONFIRMED',
      'Confirmed',
      'READY_FOR_PLANNING',
      'Ready for Planning',
      'ASSIGNED',
      'Assigned',
      'IN_TRANSIT',
      'In Transit'
    ];

    const activeOrders = await prisma.orders.findMany({
      where: {
        responsible_dispatcher_id: { in: dispIds },
        status: { in: activeStatuses }
      },
      select: { id: true, responsible_dispatcher_id: true }
    });

    const counts = {};
    dispIds.forEach((id) => {
      counts[id.toString()] = 0;
    });
    activeOrders.forEach((o) => {
      if (o.responsible_dispatcher_id) {
        const k = o.responsible_dispatcher_id.toString();
        counts[k] = (counts[k] || 0) + 1;
      }
    });

    const minCount = Math.min(...dispIds.map((id) => counts[id.toString()]));
    const candidateDispatchers = activeDispatchers.filter(
      (d) => counts[d.id.toString()] === minCount
    );

    if (candidateDispatchers.length === 1) {
      return Number(candidateDispatchers[0].id);
    }

    // Nếu nhiều điều phối viên có cùng số đơn ít nhất, xoay vòng theo đơn Web gần nhất
    const lastAssignedOrder = await prisma.orders.findFirst({
      where: {
        source: 'Web',
        responsible_dispatcher_id: { in: candidateDispatchers.map((d) => d.id) }
      },
      orderBy: { id: 'desc' },
      select: { id: true, responsible_dispatcher_id: true }
    });

    if (!lastAssignedOrder || !lastAssignedOrder.responsible_dispatcher_id) {
      return Number(candidateDispatchers[0].id);
    }

    const lastId = lastAssignedOrder.responsible_dispatcher_id;
    const lastIndex = candidateDispatchers.findIndex((d) => d.id === lastId);
    const nextIndex = (lastIndex + 1) % candidateDispatchers.length;
    return Number(candidateDispatchers[nextIndex].id);
  } catch (err) {
    console.error('Error in getNextDispatcherForWebOrder (fallback to 1):', err.message);
    return 1;
  }
};

module.exports = {
  META_NOTE_PREFIX,
  META_CHUNK_PREFIX,
  mapDbStatusToFe,
  generateTrackingToken,
  resolveAlsLocationIdIfValid,
  getOrCreateLocation,
  parseOrderMeta,
  loadOrderMeta,
  saveOrderMeta,
  getNextDispatcherForWebOrder
};
