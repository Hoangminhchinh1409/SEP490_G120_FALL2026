const supabase = require('../config/supabase');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const META_NOTE_PREFIX = '[META_JSON]:';
const META_CHUNK_PREFIX = '[META_CHUNK_';
// Cột content của bảng order_notes là VARCHAR(500), giới hạn mỗi phần <= 450 ký tự để an toàn tuyệt đối
const MAX_NOTE_CHUNK_LEN = 450;

// Lưu tệp đính kèm base64 ở thư mục tạm hệ thống (.dat) để nodemon trong BE/ không bao giờ tự restart khi upload file
const ATTACHMENTS_FILE = path.join(os.tmpdir(), 'nexlog_order_attachments.dat');

const readAttachmentsStore = () => {
  try {
    if (fs.existsSync(ATTACHMENTS_FILE)) {
      return JSON.parse(fs.readFileSync(ATTACHMENTS_FILE, 'utf8'));
    }
  } catch (e) {
    // ignore
  }
  return {};
};

const writeAttachmentsStore = (store) => {
  try {
    fs.writeFileSync(ATTACHMENTS_FILE, JSON.stringify(store), 'utf8');
  } catch (e) {
    console.warn('writeAttachmentsStore warning:', e.message);
  }
};

// Tách dữ liệu base64 nặng ra file cục bộ để không làm tràn cột VARCHAR(500) của order_notes
const extractHeavyFields = (orderId, metaObj) => {
  if (!orderId || !metaObj) return metaObj;
  const clone = JSON.parse(JSON.stringify(metaObj));
  const store = readAttachmentsStore();
  const key = String(orderId);
  if (!store[key]) store[key] = { docs: {} };
  let changed = false;

  if (clone.contract_file_data && clone.contract_file_data.length > 200) {
    store[key].contract_file_data = clone.contract_file_data;
    clone.contract_file_data = '__STORED_LOCAL__';
    changed = true;
  }

  if (clone.web_workflow?.signed_contract?.signature_data && clone.web_workflow.signed_contract.signature_data.length > 200) {
    store[key].signature_data = clone.web_workflow.signed_contract.signature_data;
    clone.web_workflow.signed_contract.signature_data = '__STORED_LOCAL__';
    changed = true;
  }

  const processDocsArray = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((doc) => {
      if (doc && doc.key && typeof doc.file_data === 'string' && doc.file_data.length > 200 && doc.file_data !== '__STORED_LOCAL__') {
        store[key].docs[doc.key] = doc.file_data;
        doc.file_data = '__STORED_LOCAL__';
        changed = true;
      }
    });
  };

  processDocsArray(clone.documents);
  processDocsArray(clone.web_workflow?.documents);
  processDocsArray(clone.web_workflow?.approved_documents);

  if (changed) {
    writeAttachmentsStore(store);
  }
  return clone;
};

// Khôi phục dữ liệu base64 nặng khi đọc metadata
const hydrateHeavyFields = (orderId, metaObj) => {
  if (!orderId || !metaObj) return metaObj;
  const store = readAttachmentsStore();
  const saved = store[String(orderId)];
  if (!saved) return metaObj;

  if (metaObj.contract_file_data === '__STORED_LOCAL__' && saved.contract_file_data) {
    metaObj.contract_file_data = saved.contract_file_data;
  }

  if (metaObj.web_workflow?.signed_contract?.signature_data === '__STORED_LOCAL__' && saved.signature_data) {
    metaObj.web_workflow.signed_contract.signature_data = saved.signature_data;
  }

  const restoreDocsArray = (arr) => {
    if (!Array.isArray(arr) || !saved.docs) return;
    arr.forEach((doc) => {
      if (doc && doc.key && doc.file_data === '__STORED_LOCAL__' && saved.docs[doc.key]) {
        doc.file_data = saved.docs[doc.key];
      }
    });
  };

  restoreDocsArray(metaObj.documents);
  restoreDocsArray(metaObj.web_workflow?.documents);
  restoreDocsArray(metaObj.web_workflow?.approved_documents);

  return metaObj;
};

// Helper map status từ DB sang FE
const mapDbStatusToFe = (dbStatus, order, meta = null) => {
  if (dbStatus === 'CANCELLED' || dbStatus === 'CANCELLED_RETURNING' || (order?.cancelled_at && order?.cancel_reason)) {
    return 'CANCELLED';
  }

  const resolvedMeta = meta || parseOrderMeta(order);
  if (resolvedMeta?.web_workflow?.stage === 'CUSTOMER_NEGOTIATING') {
    return 'NEGOTIATING';
  }

  if (
    resolvedMeta?.web_workflow?.stage === 'CONTRACT_SIGNED' ||
    Boolean(order?.ready_for_planning_at)
  ) {
    return 'READY_FOR_PLANNING';
  }

  switch (dbStatus) {
    case 'WAITING_FOR_DOCUMENTS':
      if (order?.source === 'HOMEPAGE' && (!order?.agreed_price || order.agreed_price === 0)) {
        return 'DRAFT';
      }
      return 'CONFIRMED';
    case 'READY_FOR_PLANNING':
      return 'READY_FOR_PLANNING';
    case 'PLANNED':
    case 'ASSIGNED':
    case 'ACCEPTED':
      return 'ASSIGNED';
    case 'HANDED_OVER_TO_VENDOR':
    case 'PICKED_UP':
    case 'IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'CLOSED':
      return 'CLOSED';
    case 'CANCELLED':
    case 'CANCELLED_RETURNING':
      return 'CANCELLED';
    default:
      if (resolvedMeta?.web_workflow?.stage === 'PRICE_AGREED_BY_DISPATCHER' && order?.agreed_price > 0) {
        return 'DRAFT';
      }
      if (
        resolvedMeta?.web_workflow?.stage === 'CUSTOMER_CONFIRMED' ||
        resolvedMeta?.web_workflow?.stage === 'DOCS_UPLOADED' ||
        resolvedMeta?.web_workflow?.stage === 'DOCS_REJECTED' ||
        resolvedMeta?.web_workflow?.stage === 'DOCS_APPROVED'
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

    // 1. Kiểm tra xem địa chỉ này có thuộc kho / ga ALS có sẵn không
    const cleanAddrLower = cleanAddr.toLowerCase();
    if (
      cleanAddrLower.includes('nhà ga hàng hóa als nội bài') ||
      cleanAddrLower.includes('ga hàng hóa als') ||
      cleanAddrLower.includes('kho hàng không kéo dài als') ||
      cleanAddrLower.includes('als nội bài') ||
      cleanAddrLower.includes('cảng hkqt nội bài')
    ) {
      const { data: alsNb } = await supabase.from('locations').select('id').eq('id', 1).limit(1);
      if (alsNb && alsNb.length > 0) return alsNb[0].id;
    }
    if (cleanAddrLower.includes('als bắc ninh') || (cleanAddrLower.includes('yên phong') && cleanAddrLower.includes('als'))) {
      const { data: alsBn } = await supabase.from('locations').select('id').eq('id', 2).limit(1);
      if (alsBn && alsBn.length > 0) return alsBn[0].id;
    }
    if (cleanAddrLower.includes('als thái nguyên') || (cleanAddrLower.includes('yên bình') && cleanAddrLower.includes('als'))) {
      const { data: alsTn } = await supabase.from('locations').select('id').eq('id', 3).limit(1);
      if (alsTn && alsTn.length > 0) return alsTn[0].id;
    }
    if (cleanAddrLower.includes('als hải phòng') || (cleanAddrLower.includes('nam cầu kiền') && cleanAddrLower.includes('als'))) {
      const { data: alsHp } = await supabase.from('locations').select('id').eq('id', 4).limit(1);
      if (alsHp && alsHp.length > 0) return alsHp[0].id;
    }

    // 2. Kiểm tra xem địa chỉ này đã tồn tại trong database chưa
    if (cleanAddr) {
      let query = supabase.from('locations').select('id, name, customer_id, latitude, longitude').eq('address', cleanAddr);
      if (customerId) {
        query = query.or(`customer_id.eq.${customerId},customer_id.is.null`);
      }
      const { data: existing } = await query.limit(1);

      if (existing && existing.length > 0) {
        const matchedLoc = existing[0];
        if (lat && lng && (!matchedLoc.latitude || !matchedLoc.longitude)) {
          await supabase
            .from('locations')
            .update({ latitude: parseFloat(lat), longitude: parseFloat(lng) })
            .eq('id', matchedLoc.id);
        }
        return matchedLoc.id;
      }
    }

    let cleanName = (name || '').trim();
    cleanName = cleanName
      .replace(/^Điểm (lấy|giao)\s*-\s*/i, '')
      .replace(/\s*\((Điểm gửi|Điểm nhận|Điểm lấy|Điểm giao)\)/gi, '')
      .trim();

    const fallbackName = cleanName || (cleanAddr || 'Địa chỉ khách hàng');

    const { data: newLoc } = await supabase
      .from('locations')
      .insert([{
        name: fallbackName,
        type: customerId ? 'Customer Site' : 'Warehouse',
        customer_id: customerId || null,
        address: cleanAddr || 'Hà Nội',
        province: 'Hà Nội',
        latitude: lat ? parseFloat(lat) : 21.0285,
        longitude: lng ? parseFloat(lng) : 105.8542,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        geofence_radius: 200,
        created_by: 1
      }])
      .select();

    if (newLoc && newLoc.length > 0) {
      return newLoc[0].id;
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
    chunkNotes.sort((a, b) => a.id - b.id);
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

  // Khôi phục thông tin đàm phán nếu trước đó chỉ lưu vào note [Khách hàng phản hồi đàm phán]
  if (Array.isArray(order.order_notes)) {
    const negotiateNotes = order.order_notes.filter(
      (n) => typeof n?.content === 'string' && n.content.startsWith('[Khách hàng phản hồi đàm phán]')
    );
    if (negotiateNotes.length > 0 && !meta.web_workflow?.stage) {
      const latestNote = negotiateNotes[negotiateNotes.length - 1];
      const text = latestNote.content || '';
      const reasonMatch = text.match(/Lý do:\s*([^.]+)\./);
      const priceMatch = text.match(/Giá khách đề xuất:\s*([\d.,]+)\s*đ/);
      const noteMatch = text.match(/Ghi chú:\s*(.+)$/);

      if (!meta.web_workflow) meta.web_workflow = {};
      meta.web_workflow.stage = 'CUSTOMER_NEGOTIATING';
      meta.web_workflow.negotiation = {
        feedback_reason: reasonMatch ? reasonMatch[1].trim() : 'Giá cước vượt ngân sách',
        proposed_price: priceMatch ? parseInt(priceMatch[1].replace(/[.,]/g, ''), 10) : null,
        customer_note: noteMatch ? noteMatch[1].trim() : '',
        submitted_at: latestNote.created_at || new Date().toISOString()
      };
    }
  }

  return hydrateHeavyFields(order.id, meta);
};

// Tải metadata từ DB theo orderId
const loadOrderMeta = async (orderId, orderObj = null) => {
  if (orderObj && Array.isArray(orderObj.order_notes) && orderObj.order_notes.length > 0) {
    return parseOrderMeta(orderObj);
  }

  if (!orderId) return {};
  try {
    const { data: notes } = await supabase
      .from('order_notes')
      .select('id, content, created_at')
      .eq('order_id', orderId)
      .order('id', { ascending: true });

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
    const { data: allNotes } = await supabase
      .from('order_notes')
      .select('id, content, created_at')
      .eq('order_id', orderId)
      .order('id', { ascending: true });

    const existingMeta = parseOrderMeta({ id: orderId, order_notes: allNotes || [] });
    const mergedMeta = {
      ...existingMeta,
      ...meta,
      web_workflow: {
        ...(existingMeta.web_workflow || {}),
        ...(meta.web_workflow || {})
      }
    };

    const lightweightMeta = extractHeavyFields(orderId, mergedMeta);
    const jsonStr = JSON.stringify(lightweightMeta);

    // Xóa các dòng meta cũ của đơn hàng này trước khi ghi bộ mới
    const oldMetaIds = (allNotes || [])
      .filter(
        (n) =>
          typeof n?.content === 'string' &&
          (n.content.startsWith(META_NOTE_PREFIX) || n.content.startsWith(META_CHUNK_PREFIX))
      )
      .map((n) => n.id);

    if (oldMetaIds.length > 0) {
      await supabase.from('order_notes').delete().in('id', oldMetaIds);
    }

    if (META_NOTE_PREFIX.length + jsonStr.length <= 490) {
      await supabase.from('order_notes').insert([
        {
          order_id: orderId,
          content: `${META_NOTE_PREFIX}${jsonStr}`,
          created_by: 1
        }
      ]);
    } else {
      const chunks = [];
      for (let i = 0, idx = 0; i < jsonStr.length; i += MAX_NOTE_CHUNK_LEN, idx++) {
        const piece = jsonStr.slice(i, i + MAX_NOTE_CHUNK_LEN);
        chunks.push({
          order_id: orderId,
          content: `[META_CHUNK_${idx}]:${piece}`,
          created_by: 1
        });
      }
      await supabase.from('order_notes').insert(chunks);
    }
  } catch (err) {
    console.warn('saveOrderMeta warning:', err.message);
  }
};

module.exports = {
  META_NOTE_PREFIX,
  META_CHUNK_PREFIX,
  mapDbStatusToFe,
  generateTrackingToken,
  getOrCreateLocation,
  parseOrderMeta,
  loadOrderMeta,
  saveOrderMeta
};
