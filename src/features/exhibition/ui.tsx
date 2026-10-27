'use client';

import React, { useState, type CSSProperties, type ElementType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toEmbedUrl } from '@/lib/embed-url';
import { COHORTS, COH, PHOTOS, TRACKS, cohLabel } from './content';

const cache = new Map<string, CSSProperties>();

/**
 * Mengubah string CSS menjadi objek style React.
 *
 * Style di halaman pameran disalin verbatim dari desain. Menyalin string apa
 * adanya jauh lebih kecil peluang salahnya daripada menerjemahkan ratusan
 * deklarasi ke camelCase dengan tangan.
 *
 * Turns a CSS string into a React style object.
 *
 * Exhibition styles are copied verbatim from the design. Copying the strings
 * as-is leaves far less room for error than hand-translating hundreds of
 * declarations into camelCase.
 */
export function css(s: string): CSSProperties {
  let out = cache.get(s);
  if (!out) {
    const o: Record<string, string> = {};
    for (const decl of s.split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const k = decl.slice(0, i).trim();
      if (!k) continue;
      o[k.startsWith('--') ? k : k.replace(/^-ms-/, 'ms-').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = decl.slice(i + 1).trim();
    }
    out = o as CSSProperties;
    cache.set(s, out);
  }
  return out;
}

type HvProps = { as?: ElementType; s: string; h?: string; a?: string } & Omit<React.AllHTMLAttributes<HTMLElement>, 'as' | 'style'>;

/**
 * Elemen dengan style dasar, hover, dan tekan, padanan atribut style-hover dan
 * style-active pada desain. Nilainya sering dinamis per item, sehingga kelas
 * CSS statis tidak dapat menggantikannya.
 *
 * An element with base, hover, and pressed styles, matching the design's
 * style-hover and style-active attributes. Their values are often dynamic per
 * item, so a static CSS class cannot stand in for them.
 */
export function Hv({ as: Tag = 'button', s, h, a, ...rest }: HvProps) {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const style = { ...css(s), ...(hover && h ? css(h) : null), ...(down && a ? css(a) : null) };
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
      {...rest}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
    />
  );
}

/**
 * Slot foto pengganti <image-slot> desain. Foto diambil dari PHOTOS menurut
 * id slot; slot kosong meniru tampilan placeholder desain tanpa kontrol
 * unggah milik alat desainnya.
 *
 * Photo slot replacing the design's <image-slot>. The photo comes from PHOTOS
 * by slot id; an empty slot mimics the design's placeholder without the design
 * tool's upload controls.
 */
export function Photo({ id, placeholder, fit = 'cover', circle }: { id: string; placeholder: string; fit?: 'cover' | 'contain'; circle?: boolean }) {
  const src = PHOTOS[id];
  const round = circle ? ';border-radius:50%' : '';
  if (src) {
    // <img> biasa: foto sudah WebP terkompres di CDN, next/image hanya menambah kerja CPU Cloud Run / Plain <img>: photos are already compressed WebP on a CDN, next/image would only add Cloud Run CPU work
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={placeholder} loading="lazy" decoding="async" style={css(`position:absolute;inset:0;width:100%;height:100%;object-fit:${fit}`)} />;
  }
  return (
    <div style={css('position:absolute;inset:0;overflow:hidden;background:rgba(127,127,127,.08);font:13px/1.3 system-ui,-apple-system,sans-serif' + round)}>
      <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:12px;box-sizing:border-box;user-select:none')}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45 }} aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
        </svg>
        <div style={css('max-width:90%;font-weight:500;letter-spacing:.01em;opacity:.75')}>{placeholder}</div>
      </div>
      <div style={css('position:absolute;inset:0;pointer-events:none;border:1.5px dashed currentColor;opacity:.35' + round)} />
    </div>
  );
}

/** Tombol "Perbesar foto" di pojok kanan atas foto / The "Perbesar foto" button at a photo's top right */
export function Expand({ onClick }: { onClick: () => void }) {
  return (
    <Hv onClick={onClick} aria-label="Perbesar foto" s="all:unset;cursor:pointer;position:absolute;top:10px;right:10px;z-index:2;width:34px;height:34px;border-radius:50%;background:#fff;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm);transition:transform 160ms ease" h="transform:scale(1.1)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
    </Hv>
  );
}

/**
 * Alamat pemutar untuk sebuah tautan video: iframe untuk YouTube, Drive, dan
 * Vimeo; berkas langsung untuk tautan lain.
 *
 * Player address for a video link: an iframe for YouTube, Drive, and Vimeo; a
 * direct file for any other link.
 */
export function media(url: string) {
  const u = (url || '').trim();
  const e = toEmbedUrl(u);
  return { url: u, embed: e ? e + (e.includes('youtube.com') ? '?autoplay=1&rel=0' : '') : '', isEmbed: !!e, isFile: !!u && !e };
}

/** Kolom pencarian, padanan komponen Input design system / Search field, matching the design system's Input */
export function Field({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={css('font-family:var(--font-body);display:grid;gap:6px')}>
      <input
        type="text"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={css(`font:inherit;font-size:16px;padding:10px 14px;border-radius:var(--radius-md);border:2px solid ${focus ? 'var(--plan-blue)' : 'var(--light-grey)'};background:var(--white);color:var(--text-body);outline:none;transition:border-color var(--duration) var(--ease-standard)`)}
      />
    </div>
  );
}

type WorkCardData = { href: string; cTint: string; cColor: string; cFg: string; cLabel: string; thumbLabel: string; type: string; title: string; initials: string; personName: string };

/** Kartu karya di galeri dan profil peserta / Work card in the gallery and participant profile */
export function WorkCard({ w }: { w: WorkCardData }) {
  return (
    <Hv as={Link} href={w.href} s="all:unset;cursor:pointer;display:flex;flex-direction:column;background:#fff;border-radius:22px;overflow:hidden;border:1px solid #ececea;transition:transform 240ms ease,box-shadow 240ms ease" h="transform:translateY(-6px);box-shadow:var(--shadow-lg)">
      <div style={css(`position:relative;aspect-ratio:4/3;background:${w.cTint};display:flex;align-items:center;justify-content:center;padding:16px`)}>
        <span style={css(`position:absolute;top:12px;left:12px;padding:5px 10px;border-radius:999px;background:${w.cColor};color:${w.cFg};font-size:12px;font-weight:700`)}>{w.cLabel}</span>
        <span style={css('font-family:var(--font-caption);font-style:italic;font-size:14px;color:var(--text-muted);text-align:center')}>{w.thumbLabel}</span>
        <span style={css('position:absolute;bottom:12px;right:12px;padding:5px 10px;border-radius:999px;background:#fff;color:var(--dark-blue);font-size:12px;font-weight:700')}>{w.type}</span>
      </div>
      <div style={css('padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px;flex:1')}>
        <span style={css('font-family:var(--font-headline);font-weight:700;font-size:18px;line-height:1.25;letter-spacing:-0.01em;color:var(--dark-blue)')}>{w.title}</span>
        <span style={css('margin-top:auto;display:flex;align-items:center;gap:10px')}>
          <span style={css(`width:30px;height:30px;flex:none;border-radius:50%;background:${w.cColor};color:${w.cFg};display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-weight:700;font-size:11px`)}>{w.initials}</span>
          <span style={css('flex:1;font-size:14px;font-weight:700;color:var(--dark-blue)')}>{w.personName}</span>
          <span style={css('font-size:18px;font-weight:700;color:var(--dark-blue)')}>→</span>
        </span>
      </div>
    </Hv>
  );
}

/**
 * Kepala halaman Galeri dan Peserta: warna mengikuti kelas atau jurusan yang
 * dipilih, ubin kelas di bawahnya.
 *
 * Gallery and People page head: the colour follows the chosen class or track,
 * with class tiles beneath it.
 */
export function CohortHead({ cohort, track, allColor, allFg, eyebrowAll, title, intro, allLabel, count, pick }: {
  cohort: string; track: string; allColor: string; allFg: string; eyebrowAll: string; title: string; intro: string; allLabel: string;
  count: (key: string) => string; pick: (key: string) => void;
}) {
  const head = cohort !== 'all'
    ? { bg: COH[cohort].color, fg: COH[cohort].fg, eyebrow: cohLabel(COH[cohort]) }
    : track !== 'all'
      ? { bg: TRACKS[track as keyof typeof TRACKS].color, fg: TRACKS[track as keyof typeof TRACKS].fg, eyebrow: TRACKS[track as keyof typeof TRACKS].name }
      : { bg: allColor, fg: allFg, eyebrow: eyebrowAll };
  const tiles = [{ key: 'all' } as { key: string; city?: string; color?: string; track?: string }, ...COHORTS].map((c) => {
    const isAll = c.key === 'all', on = isAll ? cohort === 'all' && track === 'all' : cohort === c.key || (cohort === 'all' && track === c.track);
    return { key: c.key, city: isAll ? 'Semua kelas' : c.city, track: isAll ? allLabel : TRACKS[c.track as keyof typeof TRACKS].name, count: count(c.key),
      bg: on ? '#243C4B' : '#fff', fg: on ? '#fff' : '#243C4B', dot: isAll ? allColor : c.color, dotRing: on ? '#fff' : isAll ? allColor : c.color };
  });
  return (
    <section style={css(`background:${head.bg};color:${head.fg};padding:calc(80px + clamp(40px,6vw,72px)) 22px clamp(32px,4vw,48px);transition:background 320ms ease,color 320ms ease`)}>
      <div style={css('max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:32px')}>
        <div style={css('display:flex;flex-wrap:wrap;gap:16px 40px;align-items:flex-end;justify-content:space-between')}>
          <div style={css('display:flex;flex-direction:column;gap:10px')}>
            <span style={css('font-size:15px;font-weight:700')}>{head.eyebrow}</span>
            <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(48px,8vw,104px);line-height:0.95;letter-spacing:-0.045em;margin:0')}>{title}</h1>
          </div>
          <p style={css('margin:0;font-size:17px;line-height:1.5;max-width:340px')}>{intro}</p>
        </div>
        <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:10px')}>
          {tiles.map((t) => (
            <Hv key={t.key} onClick={() => pick(t.key)} s={`all:unset;cursor:pointer;display:flex;flex-direction:column;gap:16px;padding:16px 18px;border-radius:20px;background:${t.bg};color:${t.fg};box-shadow:var(--shadow-sm);transition:transform 200ms ease,background 200ms ease`} h="transform:translateY(-3px)" a="transform:scale(.98)">
              <span style={css('display:flex;justify-content:space-between;align-items:center;gap:8px')}>
                <span style={css(`width:16px;height:16px;border-radius:50%;background:${t.dot};border:2px solid ${t.dotRing}`)} />
                <span style={css('font-size:13px;font-weight:700')}>{t.count}</span>
              </span>
              <span style={css('display:flex;flex-direction:column;gap:2px')}>
                <span style={css('font-family:var(--font-headline);font-weight:700;font-size:20px;line-height:1.1;letter-spacing:-0.01em')}>{t.city}</span>
                <span style={css('font-size:13px')}>{t.track}</span>
              </span>
            </Hv>
          ))}
        </div>
      </div>
    </section>
  );
}

const NAV: [string, string][] = [['/', 'Beranda'], ['/galeri', 'Galeri'], ['/peserta', 'Peserta'], ['/dokumentasi', 'Dokumentasi'], ['/tentang', 'Tentang'], ['/login', 'Masuk']];

function activeNav(path: string): string {
  if (path.startsWith('/karya')) return '/galeri';
  return NAV.find(([href]) => href !== '/' && path.startsWith(href))?.[0] ?? (path === '/' ? '/' : '');
}

export function Header() {
  const active = activeNav(usePathname() ?? '/');
  return (
    <header style={css('position:sticky;top:12px;z-index:30;padding:12px 16px 0;margin-bottom:-68px;pointer-events:none')}>
      <div style={css('pointer-events:auto;max-width:1080px;margin:0 auto;height:56px;padding:0 8px 0 22px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:#fff;border-radius:999px;border:1px solid #ececea;box-shadow:0 8px 28px rgba(36,60,75,.12)')}>
        <Link href="/" style={css('all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;font-family:var(--font-headline);font-weight:700;font-size:15px;letter-spacing:-0.01em;white-space:nowrap')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pameran/logo-plan-indonesia.png" alt="Plan International Indonesia" style={css('display:block;height:40px;width:auto;flex:none')} />
        </Link>
        <nav style={css('display:flex;flex-wrap:nowrap;gap:2px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;overflow-y:hidden')}>
          {NAV.map(([href, label]) => {
            const on = active === href;
            return (
              <Hv key={href} as={Link} href={href} s={`all:unset;cursor:pointer;white-space:nowrap;padding:9px 16px;border-radius:999px;font-size:14px;font-weight:700;color:${on ? '#fff' : 'var(--dark-blue)'};background:${on ? 'var(--dark-blue)' : 'transparent'};transition:background 160ms ease,color 160ms ease`} h={`background:${on ? 'var(--dark-blue)' : 'var(--surface-muted)'}`}>{label}</Hv>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
