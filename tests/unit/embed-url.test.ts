import { describe, expect, it } from 'vitest';
import { toEmbedUrl } from '../../src/lib/embed-url';

describe('toEmbedUrl', () => {
  it('mengubah tautan YouTube ke alamat embed', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=abc123&t=10')).toBe('https://www.youtube.com/embed/abc123');
    expect(toEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube.com/embed/abc123');
    expect(toEmbedUrl('https://youtube.com/live/abc123')).toBe('https://www.youtube.com/embed/abc123');
  });

  it('mengubah berkas dan folder Google Drive ke pratinjau', () => {
    expect(toEmbedUrl('https://drive.google.com/file/d/XYZ/view?usp=sharing')).toBe('https://drive.google.com/file/d/XYZ/preview');
    expect(toEmbedUrl('https://drive.google.com/open?id=XYZ')).toBe('https://drive.google.com/file/d/XYZ/preview');
    expect(toEmbedUrl('https://drive.google.com/drive/folders/F1')).toBe('https://drive.google.com/embeddedfolderview?id=F1#list');
  });

  it('mengubah Google Slides, Docs, dan Sheets ke pratinjau', () => {
    expect(toEmbedUrl('https://docs.google.com/presentation/d/P1/edit#slide=id.p')).toBe('https://docs.google.com/presentation/d/P1/preview');
    expect(toEmbedUrl('https://docs.google.com/document/u/0/d/D1/edit')).toBe('https://docs.google.com/document/d/D1/preview');
  });

  it('mengubah Vimeo ke pemutarnya', () => {
    expect(toEmbedUrl('https://vimeo.com/123456')).toBe('https://player.vimeo.com/video/123456');
  });

  it('menolak penyedia tak dikenal, http, dan skema berbahaya', () => {
    // Situs lain biasanya menolak dibingkai; peserta diberi tombol buka di tab baru.
    // Other sites usually refuse framing; participants get an open-in-new-tab button.
    expect(toEmbedUrl('https://zoom.us/rec/share/abc')).toBeNull();
    expect(toEmbedUrl('http://youtu.be/abc')).toBeNull();
    expect(toEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(toEmbedUrl('')).toBeNull();
    expect(toEmbedUrl(null)).toBeNull();
  });

  it('menyandikan id sehingga tidak dapat keluar dari jalurnya', () => {
    expect(toEmbedUrl('https://drive.google.com/open?id=a/../b')).toBe('https://drive.google.com/file/d/a%2F..%2Fb/preview');
  });
});
