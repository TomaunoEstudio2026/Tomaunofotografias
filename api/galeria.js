/**
 * TOMAUNO · Vista previa (Open Graph) de cada galería especial.
 *
 * Qué hace:
 *  - Cuando alguien pega  https://tomaunofotografias.vercel.app/g/<ID>  en WhatsApp, Instagram, Telegram, etc.,
 *    el "robot" de esa app llega acá y recibe el título, la descripción y la imagen de ESA galería.
 *  - Las personas comunes son enviadas al instante a la galería (  /?especial=<ID>  ).
 *  - Las galerías privadas NO muestran portada ni descripción (se usa la imagen general de Tomauno).
 *
 * Instalación: copiar esta carpeta "api" a la raíz del proyecto de Vercel y sumar la regla del archivo vercel.json.
 */
const APPS = 'https://script.google.com/macros/s/AKfycbznf-yPUwLZADidp01088eRXnJ4KRvV5wm_bb1cd72DObX9jcmpa7thI2VMhl1DQjZ9/exec';
const SITE = 'https://tomaunofotografias.vercel.app';
const FALLBACK_IMG = 'https://i.imgur.com/4lcJyes.png';
const BOTS = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|pinterest|skypeuripreview|googlebot|bingbot|embedly|vkshare|iframely|redditbot|applebot|viber|signal|line-poker|mastodon|bluesky|imessage|iMessage/i;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

async function getGallery(id) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(APPS + '?action=specialGalleryById&id=' + encodeURIComponent(id), { signal: ctl.signal, redirect: 'follow' });
    const j = await r.json();
    return j && j.success !== false ? j : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}

module.exports = async (req, res) => {
  const q = req.query || {};
  if (q.ping === '1') {                       // la web de Tomauno pregunta si esta función está instalada
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ ok: true, v: 1 }));
  }
  const id = String(q.id || q.especial || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  if (!id) { res.statusCode = 302; res.setHeader('Location', '/'); return res.end(); }

  const foto = String(q.foto || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  const dest = '/?especial=' + encodeURIComponent(id) + (foto ? '&foto=' + encodeURIComponent(foto) : '');

  /* Imagen: se descarga la portada y se entrega desde este mismo sitio (WhatsApp es exigente con las imágenes de Drive). */
  if (q.img === '1') {
    const data = await getGallery(id);
    const g = data && data.gallery;
    let url = FALLBACK_IMG;
    if (g && g.visible !== false && !data.requiresPassword && !g.passwordRequired && g.coverUrl) url = String(g.coverUrl).replace(/sz=w\d+/, 'sz=w1200');
    try {
      let r = await fetch(url, { redirect: 'follow' });
      if (!r.ok && url !== FALLBACK_IMG) r = await fetch(FALLBACK_IMG, { redirect: 'follow' });
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.end(buf);
    } catch (e) { res.statusCode = 302; res.setHeader('Location', FALLBACK_IMG); return res.end(); }
  }

  const ua = String((req.headers && req.headers['user-agent']) || '');
  if (!BOTS.test(ua)) {                       // persona común: directo a la galería, sin demoras
    res.statusCode = 302; res.setHeader('Location', dest); res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }

  const data = await getGallery(id);
  const g = data && data.gallery;
  const privada = !!(data && (data.requiresPassword || (g && g.passwordRequired)));
  let title, desc;
  if (!g || g.visible === false) { title = 'Tomauno Fotografías'; desc = 'Reviví tus momentos. Tomauno Está con Vos.'; }
  else if (privada) { title = '🔒 Galería privada · Tomauno Fotografías'; desc = 'Esta galería es privada. Ingresá con la clave que te compartieron.'; }
  else { title = '📸 ' + clip(g.name, 90) + ' · Tomauno Fotografías'; desc = clip(g.description, 220) || 'Mirá todas las fotos de la galería.'; }

  const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || SITE.replace('https://', '');
  const base = /localhost|127\.0\.0\.1/.test(host) ? 'http://' + host : 'https://' + host;
  const shareUrl = base + '/g/' + encodeURIComponent(id);
  const img = (g && !privada && g.visible !== false && g.coverUrl) ? base + '/api/galeria?id=' + encodeURIComponent(id) + '&img=1' : FALLBACK_IMG;

  const html = '<!doctype html><html lang="es"><head><meta charset="utf-8">'
    + '<title>' + esc(title) + '</title>'
    + '<meta name="description" content="' + esc(desc) + '">'
    + '<meta property="og:type" content="website"><meta property="og:locale" content="es_AR"><meta property="og:site_name" content="Tomauno Fotografías">'
    + '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">'
    + '<meta property="og:url" content="' + esc(shareUrl) + '">'
    + '<meta property="og:image" content="' + esc(img) + '"><meta property="og:image:secure_url" content="' + esc(img) + '">'
    + '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(title) + '">'
    + '<meta name="twitter:description" content="' + esc(desc) + '"><meta name="twitter:image" content="' + esc(img) + '">'
    + '<link rel="canonical" href="' + esc(shareUrl) + '">'
    + '<meta http-equiv="refresh" content="0;url=' + esc(dest) + '"></head>'
    + '<body style="background:#000;color:#fff;font-family:Arial"><p>Abriendo la galería… <a style="color:#f33" href="' + esc(dest) + '">Entrar</a></p>'
    + '<script>location.replace(' + JSON.stringify(dest) + ')</script></body></html>';
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.end(html);
};
