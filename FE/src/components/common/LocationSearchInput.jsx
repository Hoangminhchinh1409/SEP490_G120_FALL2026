'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Select } from 'antd';
import { MapPin, Search, Loader2, X, Navigation, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { VIETMAP_API_KEY } from '../../utils/roadRouting';

const SAFE_VIETMAP_KEY = VIETMAP_API_KEY || '35a2d42231542a9bd918f8fd7c97a5021cbf67d145a74e47';

// Danh mục chuẩn 34 Tỉnh / Thành phố Việt Nam mới nhất 2026 (mô hình chính quyền địa phương 2 cấp: Tỉnh/Thành phố -> Phường/Xã)
export const VIETNAM_PROVINCES_2026 = [
  { code: 1, name: 'Thành phố Hà Nội' },
  { code: 24, name: 'Thành phố Bắc Ninh' },
  { code: 31, name: 'Thành phố Hải Phòng' },
  { code: 33, name: 'Tỉnh Hưng Yên' },
  { code: 25, name: 'Tỉnh Phú Thọ' },
  { code: 19, name: 'Tỉnh Thái Nguyên' },
  { code: 22, name: 'Thành phố Quảng Ninh' },
  { code: 37, name: 'Tỉnh Ninh Bình' },
  { code: 38, name: 'Tỉnh Thanh Hóa' },
  { code: 40, name: 'Tỉnh Nghệ An' },
  { code: 42, name: 'Tỉnh Hà Tĩnh' },
  { code: 20, name: 'Tỉnh Lạng Sơn' },
  { code: 4, name: 'Tỉnh Cao Bằng' },
  { code: 8, name: 'Tỉnh Tuyên Quang' },
  { code: 11, name: 'Tỉnh Điện Biên' },
  { code: 12, name: 'Tỉnh Lai Châu' },
  { code: 14, name: 'Tỉnh Sơn La' },
  { code: 15, name: 'Tỉnh Lào Cai' },
  { code: 44, name: 'Tỉnh Quảng Trị' },
  { code: 46, name: 'Thành phố Huế' },
  { code: 48, name: 'Thành phố Đà Nẵng' },
  { code: 51, name: 'Tỉnh Quảng Ngãi' },
  { code: 52, name: 'Tỉnh Gia Lai' },
  { code: 56, name: 'Tỉnh Khánh Hòa' },
  { code: 66, name: 'Tỉnh Đắk Lắk' },
  { code: 68, name: 'Tỉnh Lâm Đồng' },
  { code: 75, name: 'Thành phố Đồng Nai' },
  { code: 79, name: 'Thành phố Hồ Chí Minh' },
  { code: 80, name: 'Tỉnh Tây Ninh' },
  { code: 82, name: 'Tỉnh Đồng Tháp' },
  { code: 86, name: 'Tỉnh Vĩnh Long' },
  { code: 91, name: 'Tỉnh An Giang' },
  { code: 92, name: 'Thành phố Cần Thơ' },
  { code: 96, name: 'Tỉnh Cà Mau' }
];

// Cache danh sách Phường/Xã theo mã Tỉnh/Thành phố để tăng tốc độ phản hồi
const provinceWardsCache = new Map();

function normalizeVi(str = '') {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Kiểm tra địa chỉ chuẩn hóa theo địa giới hành chính Việt Nam 2026:
 * Bắt buộc có phần địa chỉ cụ thể hợp lệ VÀ có Phường/Xã + Tỉnh/Thành phố
 */
export function validateVietnamAddressText(text = '') {
  const clean = (text || '').trim();
  if (!clean) {
    return { valid: false, reason: 'Vui lòng nhập địa chỉ cụ thể và chọn Phường/Xã, Tỉnh/Thành phố.' };
  }
  if (clean.length < 8) {
    return { valid: false, reason: 'Địa chỉ quá ngắn. Vui lòng nhập địa chỉ cụ thể và chọn Phường/Xã, Tỉnh/Thành phố.' };
  }
  if (/(.)\1{4,}/i.test(clean)) {
    return { valid: false, reason: 'Địa chỉ cụ thể chứa ký tự lặp không hợp lệ.' };
  }
  const parts = clean.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { valid: false, reason: 'Vui lòng chọn đầy đủ Tỉnh/Thành phố và Phường/Xã ở bên dưới.' };
  }
  return { valid: true, reason: '' };
}

/**
 * Tách một chuỗi địa chỉ đầy đủ thành: { detail, wardName, provinceCode, provinceName }
 */
function parseStructuredAddress(fullAddress = '') {
  if (!fullAddress || !fullAddress.trim()) {
    return { detail: '', wardName: undefined, provinceCode: undefined, provinceName: '' };
  }
  const parts = fullAddress.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { detail: parts[0], wardName: undefined, provinceCode: undefined, provinceName: '' };
  }

  // Tìm xem phần cuối có khớp với 1 trong 34 Tỉnh/Thành phố 2026 không
  const lastPartNorm = normalizeVi(parts[parts.length - 1])
    .replace(/^(tinh|thanh pho|tp\.?|tp)\s+/i, '');

  const matchedProv = VIETNAM_PROVINCES_2026.find((p) => {
    const pNorm = normalizeVi(p.name).replace(/^(tinh|thanh pho)\s+/i, '');
    return pNorm === lastPartNorm || lastPartNorm.includes(pNorm) || pNorm.includes(lastPartNorm);
  });

  if (!matchedProv) {
    return { detail: fullAddress, wardName: undefined, provinceCode: undefined, provinceName: '' };
  }

  // Kiểm tra phần kế cuối có phải Phường/Xã/Thị trấn/Đặc khu không
  let wardCandidate = undefined;
  let detailParts = parts.slice(0, parts.length - 1);

  if (detailParts.length >= 2) {
    const secondLast = detailParts[detailParts.length - 1];
    if (/^(phường|xã|thị trấn|đặc khu)\s+/i.test(secondLast)) {
      wardCandidate = secondLast;
      detailParts = detailParts.slice(0, detailParts.length - 1);
    }
  } else if (detailParts.length === 1 && /^(phường|xã|thị trấn|đặc khu)\s+/i.test(detailParts[0])) {
    wardCandidate = detailParts[0];
    detailParts = [];
  }

  return {
    detail: detailParts.join(', '),
    wardName: wardCandidate,
    provinceCode: matchedProv.code,
    provinceName: matchedProv.name
  };
}

const LocationSearchInput = ({
  value = '',
  onChange,
  onSelectLocation,
  placeholder = 'Nhập số nhà, tên đường, KCN, tòa nhà, cổng kho...',
  label,
  markerLetter = 'A',
  markerColor = '#2563eb',
  required = false
}) => {
  const initialParsed = useMemo(() => parseStructuredAddress(value), []);
  const [prevValue, setPrevValue] = useState(value);

  const [detailText, setDetailText] = useState(initialParsed.detail);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState(initialParsed.provinceCode);
  const [selectedProvinceName, setSelectedProvinceName] = useState(initialParsed.provinceName);
  const [selectedWardName, setSelectedWardName] = useState(initialParsed.wardName);

  const [wardsList, setWardsList] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [apiSuggestions, setApiSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvingCoords, setResolvingCoords] = useState(false);
  const [isVerifiedCoords, setIsVerifiedCoords] = useState(Boolean(value && value.trim().length >= 10));
  const containerRef = useRef(null);

  // Đồng bộ khi prop `value` thay đổi từ bên ngoài (ví dụ chọn Preset hoặc Reset form)
  if (value !== prevValue) {
    setPrevValue(value);
    const currentCombined = [detailText?.trim(), selectedWardName, selectedProvinceName]
      .filter(Boolean)
      .join(', ');

    if ((value || '').trim() !== currentCombined) {
      const parsed = parseStructuredAddress(value);
      setDetailText(parsed.detail);
      if (parsed.provinceCode) {
        setSelectedProvinceCode(parsed.provinceCode);
        setSelectedProvinceName(parsed.provinceName);
      } else if (!value) {
        setSelectedProvinceCode(undefined);
        setSelectedProvinceName('');
      }
      if (parsed.wardName) {
        setSelectedWardName(parsed.wardName);
      } else if (!value) {
        setSelectedWardName(undefined);
      }
      setIsVerifiedCoords(Boolean(value && value.trim().length >= 10));
    }
  }

  // Đóng dropdown gợi ý khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tải danh sách Phường/Xã 2026 khi chọn Tỉnh/Thành phố
  useEffect(() => {
    if (!selectedProvinceCode) {
      setWardsList([]);
      return;
    }

    if (provinceWardsCache.has(selectedProvinceCode)) {
      setWardsList(provinceWardsCache.get(selectedProvinceCode));
      return;
    }

    let isCancelled = false;
    const fetchWards = async () => {
      try {
        setLoadingWards(true);
        const res = await fetch(`https://provinces.open-api.vn/api/v2/p/${selectedProvinceCode}?depth=2`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data?.wards)) {
            provinceWardsCache.set(selectedProvinceCode, data.wards);
            setWardsList(data.wards);
          }
        }
      } catch {
        // Ignore network error
      } finally {
        if (!isCancelled) {
          setLoadingWards(false);
        }
      }
    };

    fetchWards();
    return () => {
      isCancelled = true;
    };
  }, [selectedProvinceCode]);

  // Ghép địa chỉ đầy đủ từ 3 thành phần: [Địa chỉ cụ thể], [Phường/Xã], [Tỉnh/Thành phố]
  const buildFullAddress = (detail, ward, province) => {
    return [detail?.trim(), ward?.trim(), province?.trim()].filter(Boolean).join(', ');
  };

  // Tự động tra cứu tọa độ VietMap khi đã có đủ: Địa chỉ cụ thể + Phường/Xã + Tỉnh/Thành phố
  useEffect(() => {
    const cleanDetail = (detailText || '').trim();
    if (!cleanDetail || cleanDetail.length < 2 || !selectedWardName || !selectedProvinceName) {
      return;
    }

    const fullAddr = buildFullAddress(cleanDetail, selectedWardName, selectedProvinceName);
    let isCancelled = false;
    const controller = new AbortController();

    const geocodeTimer = setTimeout(async () => {
      try {
        setResolvingCoords(true);
        const searchUrl = `https://maps.vietmap.vn/api/search/v3?apikey=${SAFE_VIETMAP_KEY}&text=${encodeURIComponent(fullAddr)}`;
        const searchRes = await fetch(searchUrl, { signal: controller.signal });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const first = Array.isArray(searchData) && searchData.length > 0 ? searchData[0] : null;

          if (!isCancelled && first?.ref_id) {
            const placeUrl = `https://maps.vietmap.vn/api/place/v3?apikey=${SAFE_VIETMAP_KEY}&refid=${encodeURIComponent(first.ref_id)}`;
            const placeRes = await fetch(placeUrl, { signal: controller.signal });
            if (placeRes.ok) {
              const placeData = await placeRes.json();
              if (!isCancelled && typeof placeData?.lat === 'number' && typeof placeData?.lng === 'number') {
                setIsVerifiedCoords(true);
                if (onSelectLocation) {
                  onSelectLocation({
                    address: fullAddr,
                    mainName: cleanDetail,
                    ward: selectedWardName,
                    province: selectedProvinceName,
                    lat: placeData.lat,
                    lng: placeData.lng,
                    verified: true
                  });
                }
                return;
              }
            }
          }
        }

        // Nếu địa chỉ cụ thể quá chi tiết (VD số lô nội bộ), fallback lấy tọa độ trung tâm Phường/Xã + Tỉnh/Thành phố trên VietMap
        const wardFallbackQuery = `${selectedWardName}, ${selectedProvinceName}`;
        const fbRes = await fetch(
          `https://maps.vietmap.vn/api/search/v3?apikey=${SAFE_VIETMAP_KEY}&text=${encodeURIComponent(wardFallbackQuery)}`,
          { signal: controller.signal }
        );
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          const fbFirst = Array.isArray(fbData) && fbData.length > 0 ? fbData[0] : null;
          if (!isCancelled && fbFirst?.ref_id) {
            const placeUrl = `https://maps.vietmap.vn/api/place/v3?apikey=${SAFE_VIETMAP_KEY}&refid=${encodeURIComponent(fbFirst.ref_id)}`;
            const placeRes = await fetch(placeUrl, { signal: controller.signal });
            if (placeRes.ok) {
              const placeData = await placeRes.json();
              if (!isCancelled && typeof placeData?.lat === 'number' && typeof placeData?.lng === 'number') {
                setIsVerifiedCoords(true);
                if (onSelectLocation) {
                  onSelectLocation({
                    address: fullAddr,
                    mainName: cleanDetail,
                    ward: selectedWardName,
                    province: selectedProvinceName,
                    lat: placeData.lat,
                    lng: placeData.lng,
                    verified: true
                  });
                }
              }
            }
          }
        }
      } catch {
        // Ignore abort
      } finally {
        if (!isCancelled) {
          setResolvingCoords(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(geocodeTimer);
      controller.abort();
    };
  }, [detailText, selectedWardName, selectedProvinceName]);

  // Gợi ý VietMap Autocomplete khi người dùng đang gõ ở ô Địa chỉ cụ thể
  useEffect(() => {
    const query = detailText?.trim();
    if (!query || query.length < 2 || !isOpen) {
      setApiSuggestions([]);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const apiTimer = setTimeout(async () => {
      try {
        setIsLoading(true);
        // Tìm kiếm tự do theo từ khóa người dùng gõ trên toàn quốc, không bó hẹp cứng theo tỉnh/xã đã chọn trước đó
        const vietmapUrl = `https://maps.vietmap.vn/api/autocomplete/v3?apikey=${SAFE_VIETMAP_KEY}&text=${encodeURIComponent(query)}`;
        const res = await fetch(vietmapUrl, { signal: controller.signal });

        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data) && data.length > 0) {
            const mapped = data.slice(0, 6).map((item) => {
              const mainName = item.name || item.display?.split(',')[0] || query;
              const boundaryText = Array.isArray(item.boundaries) && item.boundaries.length > 0
                ? item.boundaries.map((b) => b.full_name || b.name).filter(Boolean).join(', ')
                : item.address || '';
              return {
                ref_id: item.ref_id,
                main: mainName,
                sub: boundaryText || item.address || 'Việt Nam',
                boundaries: item.boundaries || []
              };
            });
            setApiSuggestions(mapped);
          }
        }
      } catch {
        // Ignore
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      isCancelled = true;
      clearTimeout(apiTimer);
      controller.abort();
    };
  }, [detailText, isOpen]);

  // Xử lý khi thay đổi ô Địa chỉ cụ thể
  const handleDetailChange = (e) => {
    const nextDetail = e.target.value;
    setDetailText(nextDetail);
    setIsOpen(true);

    const combined = buildFullAddress(nextDetail, selectedWardName, selectedProvinceName);
    if (onChange) onChange(combined);

    if (!nextDetail.trim() || !selectedWardName || !selectedProvinceName) {
      setIsVerifiedCoords(false);
      if (onSelectLocation) onSelectLocation(null);
    }
  };

  // Xử lý khi chọn Tỉnh/Thành phố (34 Tỉnh/Thành phố 2026)
  const handleProvinceChange = (provCode) => {
    const provObj = VIETNAM_PROVINCES_2026.find((p) => p.code === provCode);
    const nextProvName = provObj ? provObj.name : '';

    setSelectedProvinceCode(provCode);
    setSelectedProvinceName(nextProvName);
    setSelectedWardName(undefined);
    setIsVerifiedCoords(false);

    const combined = buildFullAddress(detailText, '', nextProvName);
    if (onChange) onChange(combined);
    if (onSelectLocation) onSelectLocation(null);
  };

  // Xử lý khi chọn Phường/Xã
  const handleWardChange = (wardName) => {
    setSelectedWardName(wardName);
    const combined = buildFullAddress(detailText, wardName, selectedProvinceName);
    if (onChange) onChange(combined);

    if (!detailText?.trim() || !wardName || !selectedProvinceName) {
      setIsVerifiedCoords(false);
      if (onSelectLocation) onSelectLocation(null);
    }
  };

  // Khi người dùng bấm chọn nhanh 1 gợi ý từ VietMap Autocomplete: tự động điền cả Địa chỉ cụ thể + Tỉnh/Thành + Phường/Xã
  const handleSelectSuggestion = async (item) => {
    setIsOpen(false);
    setDetailText(item.main);

    // Tự động khớp Tỉnh/Thành phố & Phường/Xã từ boundaries của VietMap
    const provBoundary = (item.boundaries || []).find((b) => b.type === 0);
    const wardBoundary = (item.boundaries || []).find((b) => b.type === 2);

    let matchedProv = null;

    if (provBoundary?.name) {
      const bNorm = normalizeVi(provBoundary.name);
      const foundProv = VIETNAM_PROVINCES_2026.find((p) => normalizeVi(p.name).includes(bNorm) || bNorm.includes(normalizeVi(p.name).replace(/^(tinh|thanh pho)\s+/i, '')));
      if (foundProv) {
        matchedProv = foundProv;
        setSelectedProvinceCode(foundProv.code);
        setSelectedProvinceName(foundProv.name);
      }
    }

    // Nếu VietMap không trả về boundary tỉnh nhưng đã chọn tỉnh trước đó, giữ lại tỉnh đó
    if (!matchedProv && selectedProvinceCode) {
      matchedProv = VIETNAM_PROVINCES_2026.find((p) => p.code === selectedProvinceCode) || null;
    }

    let nextWard = undefined;
    if (wardBoundary?.full_name || wardBoundary?.name) {
      nextWard = wardBoundary.full_name || `${wardBoundary.prefix || 'Xã'} ${wardBoundary.name}`.trim();
      setSelectedWardName(nextWard);
    } else {
      // Khi chọn địa điểm mới khác hẳn, reset phường/xã cũ để người dùng chọn đúng theo địa bàn mới
      setSelectedWardName(undefined);
    }

    const nextProvName = matchedProv?.name || selectedProvinceName;
    const fullAddr = buildFullAddress(item.main, nextWard, nextProvName);
    if (onChange) onChange(fullAddr);

    if (item.ref_id) {
      try {
        setResolvingCoords(true);
        const placeUrl = `https://maps.vietmap.vn/api/place/v3?apikey=${SAFE_VIETMAP_KEY}&refid=${encodeURIComponent(item.ref_id)}`;
        const placeRes = await fetch(placeUrl);
        if (placeRes.ok) {
          const placeData = await placeRes.json();
          if (typeof placeData?.lat === 'number' && typeof placeData?.lng === 'number' && nextWard && nextProvName) {
            setIsVerifiedCoords(true);
            if (onSelectLocation) {
              onSelectLocation({
                address: fullAddr,
                mainName: item.main,
                ward: nextWard,
                province: nextProvName,
                lat: placeData.lat,
                lng: placeData.lng,
                verified: true
              });
            }
          }
        }
      } catch {
        // Ignore
      } finally {
        setResolvingCoords(false);
      }
    }
  };

  const handleClearDetail = () => {
    setDetailText('');
    setApiSuggestions([]);
    setIsVerifiedCoords(false);
    const combined = buildFullAddress('', selectedWardName, selectedProvinceName);
    if (onChange) onChange(combined);
    if (onSelectLocation) onSelectLocation(null);
  };

  const isComplete = Boolean(detailText?.trim().length >= 2 && selectedProvinceCode && selectedWardName);

  return (
    <div className="relative w-full space-y-2" ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-gray-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span
              className="w-4 h-4 rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center shadow-xs"
              style={{ backgroundColor: markerColor }}
            >
              {markerLetter}
            </span>
            <span>{label}</span>
            {required && <span className="text-red-500 font-bold">*</span>}
          </span>
          {isComplete && isVerifiedCoords ? (
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={11} className="text-emerald-600" /> VietMap
            </span>
          ) : (
            <span className="text-[10px] font-medium text-indigo-600 flex items-center gap-1">
              <Building2 size={11} /> Địa giới hành chính
            </span>
          )}
        </label>
      )}

      {/* 1. Ô nhập Địa chỉ cụ thể ở trên */}
      <div className="relative">
        <div className="text-[10px] font-semibold text-gray-500 mb-1 flex items-center justify-between">
          <span>
            Địa chỉ cụ thể <span className="text-red-500">*</span>
          </span>
          {resolvingCoords && (
            <span className="text-[10px] text-indigo-600 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Đang định vị...
            </span>
          )}
        </div>

        <div className="relative flex items-center">
          <div className="absolute left-3 text-gray-400 pointer-events-none flex items-center">
            <MapPin size={15} style={{ color: isComplete ? '#059669' : markerColor }} />
          </div>

          <input
            type="text"
            value={detailText}
            onChange={handleDetailChange}
            onFocus={() => {
              if (detailText?.trim().length >= 2) setIsOpen(true);
            }}
            onBlur={() => {
              setTimeout(() => setIsOpen(false), 200);
            }}
            placeholder={placeholder}
            className={`w-full pl-9 pr-8 py-2 bg-white text-gray-800 text-xs rounded-lg border transition-all shadow-inner placeholder:text-gray-400 focus:outline-none ${
              isComplete
                ? 'border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
                : 'border-gray-200 hover:border-indigo-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100'
            }`}
          />

          {detailText && (
            <button
              type="button"
              onClick={handleClearDetail}
              className="absolute right-2.5 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown gợi ý nhanh từ VietMap nếu khách gõ tên KCN/tòa nhà */}
        {isOpen && (apiSuggestions.length > 0 || isLoading) && (
          <div className="absolute left-0 right-0 top-full mt-1 z-[2500] bg-white rounded-xl shadow-2xl border border-gray-150 overflow-hidden max-h-60 overflow-y-auto">
            <div className="px-3 py-1.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between text-[10px] text-indigo-800">
              <span className="font-bold flex items-center gap-1">
                <Navigation size={11} className="text-indigo-600" /> Gợi ý địa điểm VietMap
              </span>
              {isLoading && (
                <span className="flex items-center gap-1 text-indigo-600">
                  <Loader2 size={10} className="animate-spin" /> Đang tìm...
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {apiSuggestions.map((item, idx) => (
                <div
                  key={item.ref_id || idx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(item);
                  }}
                  className="px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:bg-indigo-50/80 transition-colors"
                >
                  <MapPin size={14} className="text-indigo-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-800 truncate">{item.main}</div>
                    {item.sub && <div className="text-[11px] text-gray-500 truncate">{item.sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Bên dưới: Hàng chọn Phường/Xã & Tỉnh/Thành phố (Đã đổi chỗ Phường/Xã sang trước, Tỉnh/TP sang sau) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] font-semibold text-gray-500 mb-1">
            Phường / Xã <span className="text-red-500">*</span>
          </div>
          <Select
            showSearch
            allowClear
            disabled={!selectedProvinceCode}
            loading={loadingWards}
            placeholder={selectedProvinceCode ? 'Chọn Phường / Xã...' : 'Chọn Tỉnh/TP bên cạnh'}
            value={selectedWardName}
            onChange={handleWardChange}
            optionFilterProp="label"
            filterOption={(input, option) =>
              normalizeVi(option?.label || '').includes(normalizeVi(input))
            }
            className="w-full text-xs"
            options={wardsList.map((w) => ({
              value: w.name,
              label: w.name
            }))}
          />
        </div>

        <div>
          <div className="text-[10px] font-semibold text-gray-500 mb-1">
            Tỉnh / Thành phố <span className="text-red-500">*</span>
          </div>
          <Select
            showSearch
            allowClear
            placeholder="Chọn Tỉnh / Thành phố..."
            value={selectedProvinceCode}
            onChange={handleProvinceChange}
            optionFilterProp="label"
            filterOption={(input, option) =>
              normalizeVi(option?.label || '').includes(normalizeVi(input))
            }
            className="w-full text-xs"
            options={VIETNAM_PROVINCES_2026.map((p) => ({
              value: p.code,
              label: p.name
            }))}
          />
        </div>
      </div>

      {/* 3. Hiển thị chuỗi địa chỉ chuẩn hóa đầy đủ */}
      {isComplete ? (
        <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between gap-2">
          <span className="truncate">
            <b>Địa chỉ:</b> {buildFullAddress(detailText, selectedWardName, selectedProvinceName)}
          </span>
        </div>
      ) : (detailText || selectedProvinceCode || selectedWardName) ? (
        <div className="text-[11px] text-amber-700 flex items-center gap-1">
          <AlertCircle size={12} className="text-amber-600 shrink-0" />
          <span>
            {!selectedProvinceCode
              ? 'Vui lòng chọn Tỉnh / Thành phố.'
              : !selectedWardName
                ? 'Vui lòng chọn Phường / Xã.'
                : 'Vui lòng nhập thêm địa chỉ cụ thể.'}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default LocationSearchInput;
