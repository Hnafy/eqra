// Normalizes a reciter name for duplicate detection / indexing.
// Arabic diacritics are stripped and letter variants unified.
function normalizeName(name) {
  if (!name) return "";
  return String(name)
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

module.exports = normalizeName;
