const YouTubeCache = require("../models/YouTubeCache");

function cacheKey(query, maxResults) {
  return `${String(query).trim().toLowerCase()}::${maxResults}`;
}

// Returns cached YouTube results if present, otherwise calls `producer`,
// stores the result (with a TTL index) and returns it.
async function getOrFetch(query, maxResults, producer) {
  const key = cacheKey(query, maxResults);

  try {
    const cached = await YouTubeCache.findOne({ key });
    if (cached) {
      const cachedList =
        (cached.results && cached.results.results) || cached.results || [];
      // Ignore empty cached entries so a past failure cannot mask new results.
      if (Array.isArray(cachedList) && cachedList.length > 0) {
        return { results: cached.results, cached: true };
      }
    }
  } catch (err) {
    console.warn("[youtube-cache] read failed:", err.message);
  }

  const results = await producer();

  // Only cache successful, non-empty results. Caching an empty list would make
  // a single transient failure (rate limit, timeout) stick for the whole TTL.
  const list = results && (results.results || results);
  const hasResults = Array.isArray(list) && list.length > 0;

  if (hasResults) {
    try {
      await YouTubeCache.findOneAndUpdate(
        { key },
        { key, results, createdAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.warn("[youtube-cache] write failed:", err.message);
    }
  }

  return { results, cached: false };
}

module.exports = { getOrFetch, cacheKey };
