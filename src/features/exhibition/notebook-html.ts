/**
 * Mengubah notebook Jupyter menjadi satu halaman HTML yang bisa dibaca di iframe.
 * Output text/html dari notebook disisipkan apa adanya (sama seperti notebook
 * dibuka di Jupyter); iframe pameran bersandbox, jadi risikonya tertahan di sana.
 *
 * Turns a Jupyter notebook into one HTML page readable in an iframe. The
 * notebook's text/html output is inserted as-is (like opening it in Jupyter);
 * the exhibition iframe is sandboxed, which contains the risk.
 */
interface Cell { cell_type: string; source?: string | string[]; outputs?: Output[] }
interface Output { output_type: string; text?: string | string[]; data?: Record<string, string | string[]> }

const join = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join('') : v ?? '');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function markdown(src: string): string {
  return src.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean).map((block) => {
    const h = /^(#{1,6})\s+(.*)$/.exec(block);
    if (h && !block.includes('\n')) return h[1].length === 1 ? `<h2>${esc(h[2])}</h2>` : `<h3>${esc(h[2])}</h3>`;
    return `<p>${esc(block).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

function output(o: Output): string {
  const d = o.data;
  if (d?.['image/png']) return `<img src="data:image/png;base64,${join(d['image/png']).replace(/\s/g, '')}" alt="">`;
  if (d?.['text/html']) return join(d['text/html']);
  const text = d?.['text/plain'] ?? o.text;
  return text ? `<pre>${esc(join(text))}</pre>` : '';
}

export function notebookToHtml(ipynbJson: string, title: string): string {
  const cells: Cell[] = JSON.parse(ipynbJson).cells ?? [];
  const body = cells.map((c) => {
    const src = join(c.source);
    if (c.cell_type === 'markdown') return markdown(src);
    if (c.cell_type !== 'code') return '';
    return [`<pre>${esc(src)}</pre>`, ...(c.outputs ?? []).map(output)].join('\n');
  }).join('\n');
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>body{max-width:860px;margin:0 auto;padding:24px 16px;font:16px/1.6 system-ui,sans-serif;color:#1a1a1a}pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow-x:auto;font:13px/1.5 ui-monospace,monospace}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:4px 8px}</style>
</head><body>
${body}
</body></html>`;
}
