const isStr = (v) => typeof v === 'string';
const isNonEmptyStr = (v) => isStr(v) && v.trim() !== '';

export function validateMeta(meta) {
  const errors = [];
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    return { ok: false, errors: ['meta must be an object'] };
  }

  if (!isStr(meta.id) || !/^[a-z0-9-]+$/.test(meta.id)) {
    errors.push('id must match [a-z0-9-]+');
  }
  for (const f of ['title', 'topic', 'variantControl']) {
    if (!isNonEmptyStr(meta[f])) errors.push(`${f} must be a non-empty string`);
  }

  if (!Array.isArray(meta.variants) || meta.variants.length === 0) {
    errors.push('variants must be a non-empty array');
  } else {
    meta.variants.forEach((v, i) => {
      if (!v || !isNonEmptyStr(v.key) || !isNonEmptyStr(v.label)) {
        errors.push(`variants[${i}] must have string key and label`);
      }
    });
  }

  if (!Array.isArray(meta.claims) || meta.claims.length === 0 || !meta.claims.every(isNonEmptyStr)) {
    errors.push('claims must be a non-empty array of strings');
  }
  if (!Array.isArray(meta.sources) || !meta.sources.every(isStr)) {
    errors.push('sources must be an array of strings');
  }

  if ('status' in meta) errors.push('status is no longer used');

  return { ok: errors.length === 0, errors };
}
