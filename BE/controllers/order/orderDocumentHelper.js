const prisma = require('../../config/prisma');
const { serializePrisma, formatDateOnly } = require('../../utils/prismaHelper');
const cloudinaryService = require('../../services/cloudinaryService');

const isExternalPlaceholderDomain = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'nexlog.vn' || parsed.hostname.endsWith('.nexlog.vn');
  } catch {
    return false;
  }
};

const resolveFrontendBaseUrl = (req) => {
  const candidates = [
    req?.headers?.origin,
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    'http://localhost:3000'
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!trimmed || isExternalPlaceholderDomain(trimmed)) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // ignore invalid URL
    }
  }
  return 'http://localhost:3000';
};

const serializeOrderWithAliases = (row) => {
  if (!row) return null;
  const serialized = serializePrisma(row);
  if (row.requested_pickup_date) {
    serialized.requested_pickup_date = formatDateOnly(row.requested_pickup_date);
  }
  return {
    ...serialized,
    customer: serialized.customers || null,
    pickup_location: serialized.locations_orders_pickup_location_idTolocations || null,
    delivery_location: serialized.locations_orders_delivery_location_idTolocations || null,
    responsible_dispatcher: serialized.users_orders_responsible_dispatcher_idTousers || null
  };
};

const normalizeOrderDocAttachments = async (docs, folder) => {
  if (!Array.isArray(docs)) return [];
  return Promise.all(
    docs.map(async (doc) => {
      if (!doc) return doc;
      const nextDoc = { ...doc };
      if (typeof nextDoc.file_url === 'string' && nextDoc.file_url.trim().startsWith('data:')) {
        const uploadedUrl = await cloudinaryService.uploadDataUriIfNeeded(nextDoc.file_url, folder);
        nextDoc.file_url = uploadedUrl;
        nextDoc.file_data = uploadedUrl;
      } else if (typeof nextDoc.file_data === 'string' && nextDoc.file_data.trim().startsWith('data:')) {
        const uploadedUrl = await cloudinaryService.uploadDataUriIfNeeded(nextDoc.file_data, folder);
        nextDoc.file_data = uploadedUrl;
        if (!nextDoc.file_url) nextDoc.file_url = uploadedUrl;
      }
      return nextDoc;
    })
  );
};

// Helper tìm đơn hàng theo id hoặc order_code hoặc tracking_token
const findOrderByIdentifier = async (identifier, includeRelations = false) => {
  const cleanId = (identifier || '').toString().trim();
  if (!cleanId) return null;

  let whereFilter;
  if (/^\d+$/.test(cleanId)) {
    whereFilter = { id: BigInt(cleanId) };
  } else if (cleanId.startsWith('NEX-') || cleanId.startsWith('ORD-')) {
    whereFilter = { order_code: cleanId };
  } else {
    const sanitizedToken = cleanId.replace(/[^a-zA-Z0-9_\-]/g, '');
    whereFilter = {
      OR: [{ tracking_token: sanitizedToken }, { order_code: sanitizedToken }]
    };
  }

  const includeClause = includeRelations
    ? {
        customers: { select: { company_name: true, email: true, tax_code: true } },
        locations_orders_pickup_location_idTolocations: { select: { name: true, address: true } },
        locations_orders_delivery_location_idTolocations: { select: { name: true, address: true } },
        users_orders_responsible_dispatcher_idTousers: {
          select: { id: true, username: true, full_name: true, phone: true, zalo_link: true }
        },
        order_cargos: true,
        order_notes: true
      }
    : {
        customers: { select: { company_name: true, email: true, tax_code: true } },
        users_orders_responsible_dispatcher_idTousers: {
          select: { id: true, username: true, full_name: true, phone: true, zalo_link: true }
        },
        order_notes: true
      };

  try {
    const row = await prisma.orders.findFirst({
      where: whereFilter,
      include: includeClause
    });
    return serializeOrderWithAliases(row);
  } catch (error) {
    console.error('[orderDocumentController] findOrderByIdentifier error:', error.message);
    return null;
  }
};

module.exports = {
  isExternalPlaceholderDomain,
  resolveFrontendBaseUrl,
  serializeOrderWithAliases,
  normalizeOrderDocAttachments,
  findOrderByIdentifier
};
