const { getPokemonVariants, getSpriteUrl } = require('@team-soju/utils');

function imageResponse(source, fallbackContentType = 'image/gif') {
  const headers = new Headers(source.headers);
  headers.set('content-type', headers.get('content-type') || fallbackContentType);
  headers.set('content-disposition', 'inline');
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(source.body, { status: source.status, statusText: source.statusText, headers });
}

async function resolveCanonicalSprite(nationalNumber, variant) {
  if (!Number.isInteger(nationalNumber) || nationalNumber < 1 || nationalNumber > 1010) return null;
  const normalizedVariant = String(variant || '').trim().toLowerCase();
  if (normalizedVariant) {
    const variants = await getPokemonVariants(nationalNumber);
    if (!(variants?.variants || []).includes(normalizedVariant)) return null;
  }
  return getSpriteUrl(nationalNumber, normalizedVariant ? { variant: normalizedVariant } : undefined);
}

async function getGreyscaleSprite({ nationalNumber, variant, fetchImpl = fetch }) {
  const spriteUrl = await resolveCanonicalSprite(nationalNumber, variant);
  if (!spriteUrl) return null;

  const transformed = await fetchImpl(spriteUrl, {
    cf: { image: { saturation: 0, anim: true } },
  }).catch(() => null);
  if (transformed?.ok && String(transformed.headers.get('content-type') || '').startsWith('image/')) {
    return imageResponse(transformed);
  }

  const original = await fetchImpl(spriteUrl);
  return original.ok ? imageResponse(original) : null;
}

module.exports = { getGreyscaleSprite, resolveCanonicalSprite };
