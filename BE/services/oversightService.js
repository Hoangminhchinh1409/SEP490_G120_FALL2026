const {
  parsePeriodRange,
  getCurrentPeriodGMT7,
  getPerformanceOverview
} = require('./oversight/managerKpiService');
const { getDriverPerformance } = require('./oversight/dispatcherStatsService');

/**
 * Oversight Service — Phân hệ Quản lý & Giám sát Vận hành (Manager Oversight & Dashboard)
 * Bám sát tiêu chuẩn SRS v2 (Mục 7.1 - Screen 16 & 7.2 - Screen 41) và SDS v2 (Mục A18 & Module Dashboard)
 */

const OVERSIGHT_CACHE_TTL_MS = 10000;
const overviewCache = new Map();
const overviewInflight = new Map();
const driverPerfCache = new Map();
const driverPerfInflight = new Map();

const runWithShortTtlCache = async (cacheMap, inflightMap, key, fetcher, forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh) {
    const cached = cacheMap.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    const pending = inflightMap.get(key);
    if (pending) {
      return pending;
    }
  }

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      if (cacheMap.size > 40) {
        const oldestKey = cacheMap.keys().next().value;
        cacheMap.delete(oldestKey);
      }
      cacheMap.set(key, { data, expiresAt: Date.now() + OVERSIGHT_CACHE_TTL_MS });
      return data;
    })
    .finally(() => {
      if (inflightMap.get(key) === promise) {
        inflightMap.delete(key);
      }
    });

  inflightMap.set(key, promise);
  return promise;
};

const getPerformanceOverviewCached = (periodStr = getCurrentPeriodGMT7(), options = {}) => {
  const effectivePeriod = periodStr || getCurrentPeriodGMT7();
  const cacheKey = String(effectivePeriod);
  return runWithShortTtlCache(
    overviewCache,
    overviewInflight,
    cacheKey,
    () => getPerformanceOverview(effectivePeriod),
    Boolean(options?.refresh)
  );
};

const getDriverPerformanceCached = (periodStr = 'ALL', options = {}) => {
  const cacheKey = String(periodStr || 'ALL');
  return runWithShortTtlCache(
    driverPerfCache,
    driverPerfInflight,
    cacheKey,
    () => getDriverPerformance(periodStr),
    Boolean(options?.refresh)
  );
};

const invalidateOversightCache = () => {
  overviewCache.clear();
  driverPerfCache.clear();
};

module.exports = {
  parsePeriodRange,
  getPerformanceOverview: getPerformanceOverviewCached,
  getDriverPerformance: getDriverPerformanceCached,
  invalidateOversightCache
};
