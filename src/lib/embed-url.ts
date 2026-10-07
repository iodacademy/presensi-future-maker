/**
 * Mengubah tautan rekaman atau bahan menjadi alamat yang boleh ditanam dalam
 * iframe, atau null bila tidak dikenali.
 *
 * Hanya penyedia yang dikenal yang ditanam. Situs lain umumnya menolak
 * dibingkai (X-Frame-Options), dan iframe kosong lebih membingungkan peserta
 * daripada tombol "buka di tab baru". Id disandikan ulang agar tautan yang
 * disisipi admin tidak dapat mengarahkan iframe ke jalur lain.
 *
 * Turns a recording or material link into an address that may be embedded in
 * an iframe, or null when it is not recognised.
 *
 * Only known providers are embedded. Other sites usually refuse framing
 * (X-Frame-Options), and a blank iframe confuses participants more than an
 * "open in new tab" button. Ids are re-encoded so a link pasted by an admin
 * cannot steer the iframe to another path.
 */
export function toEmbedUrl(raw: string | null | undefined): string | null {
  let url: URL;
  try {
    url = new URL((raw ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  const id = (value: string | null | undefined) => (value ? encodeURIComponent(value) : null);

  if (host === 'youtu.be') {
    const v = id(url.pathname.split('/')[1]);
    return v ? `https://www.youtube.com/embed/${v}` : null;
  }
  if (host === 'youtube.com') {
    const v = id(url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]);
    return v ? `https://www.youtube.com/embed/${v}` : null;
  }
  if (host === 'vimeo.com') {
    const v = url.pathname.match(/^\/(\d+)/)?.[1];
    return v ? `https://player.vimeo.com/video/${v}` : null;
  }
  if (host === 'drive.google.com') {
    const folder = id(url.pathname.match(/\/folders\/([^/]+)/)?.[1]);
    if (folder) return `https://drive.google.com/embeddedfolderview?id=${folder}#list`;
    const file = id(url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get('id'));
    return file ? `https://drive.google.com/file/d/${file}/preview` : null;
  }
  if (host === 'docs.google.com') {
    const m = url.pathname.match(/^\/(document|presentation|spreadsheets)\/(?:u\/\d+\/)?d\/([^/]+)/);
    return m ? `https://docs.google.com/${m[1]}/d/${encodeURIComponent(m[2])}/preview` : null;
  }
  return null;
}
