// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { notebookToHtml } from '../../src/features/exhibition/notebook-html';

const nb = JSON.stringify({
  cells: [
    { cell_type: 'markdown', source: ['# Judul\n', '\n', 'Halo <script>alert(1)</script>'] },
    {
      cell_type: 'code', source: ['print(1)'],
      outputs: [
        { output_type: 'stream', name: 'stdout', text: ['1\n'] },
        { output_type: 'display_data', data: { 'image/png': 'QUJD\n' } },
      ],
    },
  ],
});

describe('notebookToHtml', () => {
  const html = notebookToHtml(nb, 'Analisis');
  it('judul markdown, kode, dan gambar', () => {
    expect(html).toContain('<h2>Judul</h2>');
    expect(html).toContain('<pre>print(1)</pre>');
    expect(html).toContain('<img src="data:image/png;base64,QUJD"');
  });
  it('script di markdown di-escape', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
