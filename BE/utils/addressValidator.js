/**
 * Bộ kiểm tra địa chỉ Việt Nam chuẩn hóa tại Back-end (đồng bộ quy chuẩn với FE addressValidation.js)
 */

const normalizeVi = (str = '') =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

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

const isValidVietnameseWord = (rawToken) => {
  const w = normalizeVi(rawToken).replace(/[^a-z0-9]/g, '');
  if (!w) return true;
  if (/^\d+$/.test(w)) return true;

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
};

const validateVietnamAddressDetail = (detail = '') => {
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
      reason: `Địa chỉ chứa từ không hợp lệ ("${invalidWords[0]}"). Vui lòng nhập địa chỉ tiếng Việt có nghĩa.`
    };
  }
  if (validWords === 0 && invalidWords.length > 0) {
    return { valid: false, reason: 'Địa chỉ cụ thể không hợp lệ.' };
  }

  return { valid: true, reason: '' };
};

const validateVietnamAddressText = (text = '') => {
  const clean = String(text || '').trim();
  if (!clean) {
    return { valid: false, reason: 'Vui lòng nhập địa chỉ cụ thể và chọn Phường/Xã, Tỉnh/Thành phố.' };
  }
  if (clean.length < 10) {
    return { valid: false, reason: 'Địa chỉ quá ngắn. Vui lòng nhập đầy đủ Địa chỉ cụ thể, Phường/Xã, Tỉnh/Thành phố.' };
  }

  const parts = clean.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    return { valid: false, reason: 'Vui lòng nhập Địa chỉ cụ thể và chọn đầy đủ Phường/Xã, Tỉnh/Thành phố.' };
  }

  const detailPart = parts.slice(0, -2).join(', ');
  return validateVietnamAddressDetail(detailPart);
};

module.exports = {
  normalizeVi,
  isValidVietnameseWord,
  validateVietnamAddressDetail,
  validateVietnamAddressText
};
