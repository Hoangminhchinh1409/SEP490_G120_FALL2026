/**
 * Bộ kiểm tra & đối chiếu địa chỉ Việt Nam chuẩn hóa (Địa giới 2026 + VietMap v4)
 * Ngăn chặn triệt để văn bản gõ ngẫu nhiên / vô nghĩa ("hiohuibs vvd auvasayi", "asdasd", v.v.)
 */

export function normalizeVi(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

const LOGISTICS_ACRONYMS = new Set([
  'kcn', 'ccn', 'kcx', 'kct', 'kdt', 'ktt', 'tdp', 'kp', 'ql', 'tl', 'dt', 'ct', 'km',
  'tp', 'tx', 'tt', 'q', 'p', 'x', 'h', 'tnhh', 'ctcp', 'cp', 'mtv', 'tm', 'dv', 'tmdv',
  'sx', 'xd', 'vt', 'xnk', 'hkqt', 'als', 'alsc', 'alsb', 'alse', 'alst', 'vsip', 'shtp',
  'vcc', 'fpt', 'vnpt', 'viettel', 'vn', 'hn', 'hcm', 'dn', 'hp', 'bn', 'tn', 'ls', 'hd',
  'samsung', 'canon', 'lg', 'honda', 'toyota', 'hyundai', 'panasonic', 'sony', 'brother',
  'dhl', 'fedex', 'ups', 'lotte', 'aeon', 'keangnam', 'vincom', 'vinhomes', 'ecopark',
  'amata', 'nomura', 'deep', 'cnc', 'tower', 'plaza', 'center', 'building', 'park', 'port',
  'gate', 'warehouse', 'logistics', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'
]);

const VI_SYLLABLE_RE =
  /^(ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdghklmnpqrstvx])?([aeiouy]{1,3})(ch|ng|nh|c|m|n|p|t)?$/;

const VALID_TRIPHTHONGS = new Set([
  'ieu', 'yeu', 'oai', 'oay', 'uay', 'uoi', 'uou', 'uya', 'uye', 'uyu', 'iau'
]);

const KEYBOARD_MASH_SUBSTRINGS = [
  'qwert', 'wert', 'asdf', 'sdfg', 'zxcv', 'xcvb', 'hjkl', 'uiop', 'jklm', 'dfgh', 'fghj', 'ghjk'
];

const PLACEHOLDER_JUNK_PHRASES = [
  'linh tinh', 'khong biet', 'khong co', 'test test', 'abc xyz', 'aaa bbb', 'demo address'
];

const GENERIC_ADDRESS_WORDS = new Set([
  'so', 'nha', 'lo', 'tang', 'ngo', 'ngach', 'hem', 'duong', 'pho', 'khu', 'kho',
  'cong', 'toa', 'thon', 'xom', 'cum', 'kien', 'block', 'phuong', 'xa', 'thi', 'tran',
  'tinh', 'thanh', 'tnhh', 'ctcp', 'congty', 'ty', 'viet', 'nam'
]);

// Theo dõi trạng thái xác thực VietMap theo chuỗi địa chỉ chuẩn hóa
const addressVerificationCache = new Map();

export function markAddressVerified(fullAddr, lat = null, lng = null) {
  const key = normalizeVi(fullAddr);
  if (!key) return;
  addressVerificationCache.set(key, {
    status: 'verified',
    lat,
    lng,
    reason: '',
    updatedAt: Date.now()
  });
}

export function markAddressUnverified(fullAddr, reason = '') {
  const key = normalizeVi(fullAddr);
  if (!key) return;
  addressVerificationCache.set(key, {
    status: 'unverified',
    lat: null,
    lng: null,
    reason: reason || 'Địa chỉ cụ thể chưa khớp trên bản đồ VietMap. Vui lòng chọn gợi ý từ VietMap hoặc kiểm tra lại.',
    updatedAt: Date.now()
  });
}

export function clearAddressVerification(fullAddr) {
  const key = normalizeVi(fullAddr);
  if (!key) return;
  addressVerificationCache.delete(key);
}

export function getAddressVerifyState(fullAddr) {
  const key = normalizeVi(fullAddr);
  if (!key) return null;
  return addressVerificationCache.get(key) || null;
}

export function isValidVietnameseWord(rawToken) {
  const w = normalizeVi(rawToken).replace(/[^a-z0-9]/g, '');
  if (!w) return true;
  if (/^\d+$/.test(w)) return true;

  // Mã lô / số nhà kèm chữ cái ngắn (VD: B2, CN05, 142B, A1, KM12)
  if (/^(?=.*\d)(?=.*[a-z])[a-z0-9]{2,7}$/.test(w)) {
    const lettersOnly = w.replace(/\d/g, '');
    return lettersOnly.length <= 4 && !/(.)\1{2,}/.test(w);
  }

  if (LOGISTICS_ACRONYMS.has(w)) return true;
  if (w.length > 7) return false;
  if (!/[aeiouy]/.test(w)) return false;

  const m = w.match(VI_SYLLABLE_RE);
  if (!m) return false;

  const nucleus = m[2] || '';
  if (nucleus.length >= 3 && !VALID_TRIPHTHONGS.has(nucleus)) {
    return false;
  }
  return true;
}

/**
 * Kiểm tra phần "Địa chỉ cụ thể" (số nhà, tên đường, KCN, tòa nhà...) có có nghĩa hay gõ bừa
 */
export function validateVietnamAddressDetail(detail = '') {
  const clean = String(detail || '').trim();
  if (!clean) {
    return { valid: false, reason: 'Vui lòng nhập địa chỉ cụ thể (số nhà, tên đường, KCN...).' };
  }
  if (clean.length < 4) {
    return { valid: false, reason: 'Địa chỉ cụ thể quá ngắn (tối thiểu 4 ký tự).' };
  }
  if (!/\p{L}/u.test(clean)) {
    return { valid: false, reason: 'Địa chỉ cụ thể phải chứa tên đường, KCN hoặc địa điểm hợp lệ.' };
  }
  if (/(.)\1{3,}/iu.test(clean)) {
    return { valid: false, reason: 'Địa chỉ cụ thể chứa ký tự lặp lại không hợp lệ.' };
  }

  const normFull = normalizeVi(clean);
  if (KEYBOARD_MASH_SUBSTRINGS.some((sub) => normFull.includes(sub))) {
    return { valid: false, reason: 'Địa chỉ cụ thể chứa chuỗi ký tự gõ ngẫu nhiên không hợp lệ.' };
  }
  if (PLACEHOLDER_JUNK_PHRASES.some((phrase) => normFull.includes(phrase))) {
    return { valid: false, reason: 'Vui lòng nhập địa chỉ thực tế, không dùng văn bản giữ chỗ.' };
  }
  if (/\b([a-z]{2,4})\1+\b/i.test(normFull)) {
    return { valid: false, reason: 'Địa chỉ cụ thể chứa từ lặp vô nghĩa.' };
  }

  const tokens = clean.split(/[\s,./;()\-–]+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length < 2) {
    return {
      valid: false,
      reason: 'Vui lòng nhập đầy đủ số nhà / tên đường (tối thiểu 2 từ) hoặc chọn gợi ý từ VietMap.'
    };
  }

  const normTokens = tokens.map((t) => normalizeVi(t).replace(/[^a-z0-9]/g, '')).filter(Boolean);
  if (normTokens.length >= 2 && normTokens.every((t) => t === normTokens[0])) {
    return { valid: false, reason: 'Địa chỉ cụ thể không được lặp lại cùng một từ.' };
  }

  let validWords = 0;
  const invalidWords = [];
  for (const tok of tokens) {
    const cleanTok = normalizeVi(tok).replace(/[^a-z0-9]/g, '');
    if (!cleanTok) continue;
    if (isValidVietnameseWord(tok)) {
      if (/[a-z]/.test(cleanTok)) validWords += 1;
    } else {
      invalidWords.push(tok);
    }
  }

  if (invalidWords.length >= 2 || (invalidWords.length === 1 && validWords < 2)) {
    return {
      valid: false,
      reason: `Địa chỉ chứa từ không hợp lệ ("${invalidWords[0]}"). Vui lòng nhập địa chỉ tiếng Việt có nghĩa hoặc chọn gợi ý từ VietMap.`
    };
  }
  if (validWords === 0 && invalidWords.length > 0) {
    return { valid: false, reason: 'Địa chỉ cụ thể không hợp lệ.' };
  }

  return { valid: true, reason: '' };
}

/**
 * Kiểm tra chuỗi địa chỉ đầy đủ ([Địa chỉ cụ thể], [Phường/Xã], [Tỉnh/Thành phố])
 */
export function validateVietnamAddressText(text = '', { requireVietmap = false } = {}) {
  const clean = String(text || '').trim();
  if (!clean) {
    return { valid: false, reason: 'Vui lòng nhập địa chỉ cụ thể và chọn Phường/Xã, Tỉnh/Thành phố.' };
  }
  if (clean.length < 10) {
    return { valid: false, reason: 'Địa chỉ quá ngắn. Vui lòng nhập địa chỉ cụ thể và chọn Phường/Xã, Tỉnh/Thành phố.' };
  }

  const parts = clean.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    return {
      valid: false,
      reason: 'Vui lòng nhập Địa chỉ cụ thể và chọn đầy đủ Phường/Xã, Tỉnh/Thành phố.'
    };
  }

  // Phần địa chỉ cụ thể là các phần trước Phường/Xã và Tỉnh/TP (tức parts.slice(0, -2))
  const detailPart = parts.slice(0, -2).join(', ');
  const detailCheck = validateVietnamAddressDetail(detailPart);
  if (!detailCheck.valid) {
    return detailCheck;
  }

  if (requireVietmap) {
    const verifyState = getAddressVerifyState(clean);
    if (verifyState?.status === 'unverified') {
      return {
        valid: false,
        reason: verifyState.reason || 'Địa chỉ cụ thể chưa khớp trên bản đồ VietMap. Vui lòng chọn gợi ý từ VietMap.'
      };
    }
  }

  return { valid: true, reason: '' };
}

/**
 * Loại bỏ tiền tố số nhà / số lô khi cần tìm lại tên đường / KCN gốc trên VietMap
 */
export function stripAddressUnitPrefix(detail = '') {
  return String(detail || '')
    .trim()
    .replace(
      /^(số nhà|so nha|số|so|lô|lo|kiốt|kiot|kho|cổng|cong|tầng|tang|phòng|phong)\s+[\w\-\/]+\s*[,.\s]*/i,
      ''
    )
    .trim();
}

/**
 * Kiểm tra kết quả VietMap có thực sự khớp với phần địa chỉ cụ thể (không phải fallback về tên Phường/Xã)
 */
export function doesVietmapItemMatchDetail(item, detailText = '', wardName = '', provinceName = '') {
  if (!item) return false;

  const itemDisplay = normalizeVi(
    [
      item.name,
      item.display,
      item.address,
      Array.isArray(item.boundaries) ? item.boundaries.map((b) => b.full_name || b.name).join(' ') : ''
    ]
      .filter(Boolean)
      .join(' ')
  );
  if (!itemDisplay) return false;

  // Nếu đã chọn Tỉnh/TP, kiểm tra sơ bộ tỉnh trong display/boundaries (nếu item có thông tin tỉnh)
  if (provinceName) {
    const provCore = normalizeVi(provinceName).replace(/^(tinh|thanh pho|tp\.?)\s+/i, '').trim();
    const boundaryCity = item.boundaries?.find((b) => b.type === 0);
    if (boundaryCity?.name) {
      const bNorm = normalizeVi(boundaryCity.name).replace(/^(tinh|thanh pho|tp\.?)\s+/i, '').trim();
      if (bNorm && provCore && !bNorm.includes(provCore) && !provCore.includes(bNorm)) {
        return false;
      }
    }
  }

  // Không chấp nhận kết quả mà tên gợi ý chỉ trùng đúng tên Phường/Xã hoặc Tỉnh/TP (fallback phường)
  const normItemName = normalizeVi(item.name || '');
  const normWard = normalizeVi(wardName || '');
  const normWardCore = normWard.replace(/^(phuong|xa|thi tran|dac khu)\s+/i, '').trim();
  if (normItemName && (normItemName === normWard || normItemName === normWardCore)) {
    return false;
  }

  // Tách token có nghĩa của phần detailText (bỏ qua từ chung & từ trùng tên phường/tỉnh)
  const wardTokens = new Set(normWard.split(/\s+/).filter(Boolean));
  const detailTokens = normalizeVi(detailText)
    .split(/[\s,./;()\-–]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 2 && !GENERIC_ADDRESS_WORDS.has(t) && !wardTokens.has(t));

  if (detailTokens.length === 0) return false;

  const itemWords = new Set(
    itemDisplay
      .split(/[\s,./;()\-–]+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  );

  // Mở rộng từ viết tắt KCN -> Khu Công Nghiệp nếu có trong kết quả VietMap
  const expandedMatchedCount = detailTokens.reduce((acc, tok) => {
    if (itemWords.has(tok)) return acc + 1;
    if (tok === 'kcn' && itemWords.has('khu') && itemWords.has('cong') && itemWords.has('nghiep')) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const nonNumericTokens = detailTokens.filter((t) => !/^\d+$/.test(t));
  if (nonNumericTokens.length === 0) {
    return expandedMatchedCount >= 1;
  }

  const nonNumMatched = nonNumericTokens.filter(
    (t) =>
      itemWords.has(t) ||
      (t === 'kcn' && itemWords.has('khu') && itemWords.has('cong') && itemWords.has('nghiep'))
  ).length;

  // Yêu cầu khớp tối thiểu 1 từ chữ có nghĩa (>= 50% số từ hoặc >= 2 từ nếu cụm dài)
  return nonNumMatched >= 1 && (nonNumMatched >= Math.ceil(nonNumericTokens.length * 0.5) || nonNumMatched >= 2);
}
