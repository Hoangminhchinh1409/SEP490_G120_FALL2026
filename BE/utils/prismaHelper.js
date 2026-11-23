/**
 * Chuyển đổi an toàn dữ liệu Prisma (BigInt, Decimal, Date) về JSON/JS thuần
 * để tương thích hoàn toàn với tầng Service / Controller / API response.
 */

const toNum = (val) => {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
};

const toBigInt = (val) => {
  if (val === null || val === undefined || val === '') return null;
  try {
    return BigInt(val);
  } catch {
    return null;
  }
};

const formatDateOnly = (val) => {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val.toISOString().split('T')[0];
  }
  return String(val).split('T')[0];
};

const formatIso = (val) => {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val.toISOString();
  }
  return val;
};

const isPrismaDecimal = (val) => {
  return (
    val !== null &&
    typeof val === 'object' &&
    typeof val.toNumber === 'function' &&
    ('d' in val || val.constructor?.name === 'Decimal')
  );
};

const serializePrisma = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (isPrismaDecimal(value)) {
    return Number(value.toString());
  }
  if (Array.isArray(value)) {
    return value.map(serializePrisma);
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializePrisma(v);
    }
    return out;
  }
  return value;
};

module.exports = {
  toNum,
  toBigInt,
  formatDateOnly,
  formatIso,
  serializePrisma
};
