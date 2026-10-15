'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Search, Loader2, X, Navigation, Check } from 'lucide-react';
import { searchVietnamLocations, lookupLocationCoords, removeVietnameseTones } from '../../data/vietnamLocationsData';

const LocationSearchInput = ({
  value = '',
  onChange,
  onSelectLocation,
  placeholder = 'Nhập địa chỉ, tên đường, KCN, quận huyện...',
  label,
  markerLetter = 'A',
  markerColor = '#2563eb', // blue
  required = false
}) => {
  const [prevValue, setPrevValue] = useState(value);
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [apiSuggestions, setApiSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(value || '');
  }

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Tìm kiếm tức thì trong danh mục địa điểm Việt Nam (offline, 0ms, không cascading render)
  const localMatches = useMemo(() => {
    const query = inputValue?.trim();
    if (!query || query.length < 1) return [];
    return searchVietnamLocations(query);
  }, [inputValue]);

  // 2. Tra cứu thêm qua API trực tuyến nếu cần bổ sung kết quả chi tiết
  useEffect(() => {
    const query = inputValue?.trim();
    if (!query || query.length < 2) {
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const apiTimer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=21.0285&lon=105.8542&limit=5`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data?.features && Array.isArray(data.features)) {
            const apiItems = data.features.map(feat => {
              const props = feat.properties || {};
              const coords = feat.geometry?.coordinates || [105.8542, 21.0285];
              const main = props.name || props.street || query;
              const parts = [
                props.housenumber ? `Số ${props.housenumber}` : '',
                props.street && props.street !== props.name ? props.street : '',
                props.district,
                props.city || props.state,
                props.country || 'Việt Nam'
              ].filter(Boolean);

              return {
                main,
                sub: parts.join(', '),
                lat: coords[1],
                lng: coords[0]
              };
            });

            setApiSuggestions(apiItems);
          }
        }
      } catch {
        // Fallback an toàn trên danh mục nội bộ
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(apiTimer);
      controller.abort();
    };
  }, [inputValue]);

  // Kết hợp kết quả gợi ý chuẩn xác nhất
  const suggestions = useMemo(() => {
    if (!inputValue?.trim()) return [];
    const seen = new Set();
    const merged = [];

    for (const item of localMatches) {
      const key = `${item.lat?.toFixed(3)},${item.lng?.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    for (const item of apiSuggestions) {
      const key = `${item.lat?.toFixed(3)},${item.lng?.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    return merged.slice(0, 8);
  }, [inputValue, localMatches, apiSuggestions]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (!val.trim()) {
      setApiSuggestions([]);
    }
    if (onChange) onChange(val);
    setIsOpen(true);
  };

  const handleSelect = (item) => {
    const fullAddress = item.sub ? `${item.main}, ${item.sub}` : item.main;
    setInputValue(fullAddress);
    setIsOpen(false);
    if (onChange) onChange(fullAddress);
    if (onSelectLocation) {
      onSelectLocation({
        address: fullAddress,
        mainName: item.main,
        lat: item.lat,
        lng: item.lng
      });
    }
  };

  const handleSelectCustomAddress = () => {
    const customText = inputValue?.trim();
    if (!customText) return;
    setIsOpen(false);
    if (onChange) onChange(customText);
    const coords = lookupLocationCoords(customText, markerLetter);
    if (onSelectLocation) {
      onSelectLocation({
        address: customText,
        mainName: customText,
        lat: coords?.lat || null,
        lng: coords?.lng || null
      });
    }
  };

  const handleBlur = () => {
    // Đóng dropdown sau khi xử lý click/mousedown, tuyệt đối không tự ý đè kết quả gợi ý thứ nhất
    setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleClear = () => {
    setInputValue('');
    setApiSuggestions([]);
    if (onChange) onChange('');
    if (onSelectLocation) {
      onSelectLocation(null);
    }
  };

  // Làm nổi bật từ khóa trong kết quả gợi ý
  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const cleanT = removeVietnameseTones(text);
    const cleanQ = removeVietnameseTones(query);
    const idx = cleanT.indexOf(cleanQ);
    if (idx === -1) return text;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);

    return (
      <span>
        {before}
        <strong className="font-extrabold text-indigo-700 underline decoration-indigo-300 underline-offset-2">
          {match}
        </strong>
        {after}
      </span>
    );
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
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
          <span className="text-[11px] font-normal text-indigo-600 flex items-center gap-1">
            <Search size={11} /> Tìm kiếm vị trí
          </span>
        </label>
      )}

      {/* Input box */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-gray-400 pointer-events-none flex items-center">
          <MapPin size={16} style={{ color: markerColor }} />
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (inputValue?.trim()) setIsOpen(true);
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleBlur();
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 bg-white text-gray-800 text-xs rounded-lg border border-gray-200 hover:border-indigo-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all shadow-inner placeholder:text-gray-400"
        />

        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown Gợi ý thông minh */}
      {isOpen && (suggestions.length > 0 || isLoading || inputValue?.trim().length >= 2) && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[2500] bg-white rounded-xl shadow-2xl border border-gray-150 overflow-hidden max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-gray-400 flex items-center gap-1">
              <Navigation size={11} className="text-indigo-600" /> Kết quả tìm kiếm địa chỉ
            </span>
            {isLoading && (
              <span className="flex items-center gap-1 text-indigo-600 font-medium text-[10px]">
                <Loader2 size={11} className="animate-spin" /> Đang tìm...
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {suggestions.map((item, index) => (
              <div
                key={index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                className="px-3.5 py-2.5 flex items-start gap-3 cursor-pointer hover:bg-indigo-50/70 transition-colors group"
              >
                <div className="mt-0.5 text-gray-400 group-hover:text-indigo-600 transition-colors shrink-0">
                  <MapPin size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 group-hover:text-indigo-900 truncate">
                    {highlightMatch(item.main, inputValue)}
                  </div>
                  {item.sub && (
                    <div className="text-[11px] text-gray-400 group-hover:text-gray-600 truncate mt-0.5">
                      {item.sub}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Mục cho phép chọn trực tiếp địa chỉ tự do */}
            {inputValue?.trim().length > 0 && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectCustomAddress();
                }}
                className="px-3.5 py-2.5 flex items-center gap-2.5 cursor-pointer bg-slate-50/80 hover:bg-indigo-50 transition-colors text-indigo-700"
              >
                <Check size={14} className="shrink-0 text-indigo-600" />
                <div className="text-xs truncate font-medium">
                  Sử dụng địa chỉ: <span className="font-bold underline">{inputValue}</span>
                </div>
              </div>
            )}
          </div>

          {suggestions.length === 0 && isLoading && (
            <div className="p-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin text-indigo-600" />
              <span>Đang tra cứu cơ sở dữ liệu bản đồ...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSearchInput;
