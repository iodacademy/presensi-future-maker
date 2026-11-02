// Firestore dan Storage palsu bersama untuk test Job Portal / Shared fake Firestore and Storage for Job Portal tests
type Doc = Record<string, unknown>;
export const data: Record<string, Record<string, Doc>> = {};
export const selects: Record<string, string[][]> = {};
export const objects: Record<string, Buffer> = {};
export const counters = { tx: 0, ids: 0 };

export function reset(seed: Record<string, Record<string, Doc>> = {}) {
  for (const k of Object.keys(data)) delete data[k];
  for (const k of Object.keys(selects)) delete selects[k];
  for (const k of Object.keys(objects)) delete objects[k];
  counters.tx = 0;
  counters.ids = 0;
  for (const [c, rows] of Object.entries(seed)) data[c] = structuredClone(rows);
}

function pick(d: Doc, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Doc)[k] : undefined), d);
}

// Penambahan FieldValue.increment ditiru dengan objek penanda / FieldValue.increment is imitated with a marker object
function apply(prev: Doc | undefined, d: Doc): Doc {
  const out: Doc = { ...(prev ?? {}) };
  for (const [k, v] of Object.entries(d)) {
    const inc = v && typeof v === 'object' && 'operand' in (v as Doc) ? Number((v as Doc).operand) : null;
    if (k.includes('.')) {
      // Kunci bertitik seperti Firestore update('a.b', v) / Dotted keys like Firestore update('a.b', v)
      const [head, ...rest] = k.split('.');
      out[head] = apply((out[head] as Doc) ?? {}, { [rest.join('.')]: v });
      continue;
    }
    out[k] = inc !== null ? Number(out[k] ?? 0) + inc : v;
  }
  return out;
}

export function ref(col: string, id: string) {
  return {
    col, id,
    get: async () => ({ id, exists: !!data[col]?.[id], data: () => data[col]?.[id], get: (f: string) => (data[col]?.[id] ? pick(data[col][id], f) : undefined), ref: ref(col, id) }),
    set: async (d: Doc, o?: { merge?: boolean }) => { data[col] ??= {}; data[col][id] = o?.merge ? apply(data[col][id], d) : apply(undefined, d); },
    update: async (d: Doc) => { data[col][id] = apply(data[col][id], d); },
    delete: async () => { delete data[col][id]; },
  };
}

type Snap = { docs: { id: string; ref: ReturnType<typeof ref>; data: () => Doc; get: (f: string) => unknown }[]; size: number; empty: boolean };
interface Q {
  where: (f: string, op: string, v: unknown) => Q;
  orderBy: (f: unknown, dir?: 'desc') => Q;
  limit: (n: number) => Q;
  select: (...f: string[]) => Q;
  count: () => { get: () => Promise<{ data: () => { count: number } }> };
  get: () => Promise<Snap>;
}

function query(col: string, filters: [string, unknown][] = [], order?: 'desc', lim?: number, orderField?: string): Q {
  const rows = () => {
    // Medan bukan teks dianggap FieldPath.documentId() / A non-string field is treated as FieldPath.documentId()
    let r = Object.entries(data[col] ?? {}).filter(([id, d]) => filters.every(([f, v]) => (typeof f === 'string' ? pick(d, f) : id) === v));
    if (orderField) r = r.sort(([, a], [, b]) => (String(pick(a, orderField)) < String(pick(b, orderField)) ? 1 : -1) * (order === 'desc' ? 1 : -1));
    else if (order) r = r.sort(([a], [b]) => (a < b ? 1 : -1));
    return lim ? r.slice(0, lim) : r;
  };
  const snap = () => {
    const docs = rows().map(([id, d]) => ({ id, ref: ref(col, id), data: () => d, get: (f: string) => pick(d, f) }));
    return { docs, size: docs.length, empty: docs.length === 0 };
  };
  return {
    where: (f: string, _op: string, v: unknown) => query(col, [...filters, [f as string, v]], order, lim, orderField),
    orderBy: (f: unknown, dir?: 'desc') => {
      // Firestore menolak urutan id menurun tanpa indeks khusus / Firestore refuses a descending id order without a dedicated index
      if (typeof f !== 'string' && dir === 'desc') throw new Error('9 FAILED_PRECONDITION: The query requires an index.');
      return query(col, filters, dir, lim, typeof f === 'string' ? f : undefined);
    },
    limit: (n: number) => query(col, filters, order, n, orderField),
    select: (...fields: string[]) => { (selects[col] ??= []).push(fields); return query(col, filters, order, lim, orderField); },
    count: () => ({ get: async () => ({ data: () => ({ count: rows().length }) }) }),
    get: async () => snap(),
  };
}

type R = ReturnType<typeof ref>;
export const fakeDb = {
  runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    counters.tx++;
    return fn({
      get: (r: R) => r.get(),
      set: (r: R, d: Doc, o?: { merge?: boolean }) => { data[r.col] ??= {}; data[r.col][r.id] = o?.merge ? apply(data[r.col][r.id], d) : apply(undefined, d); },
      update: (r: R, d: Doc) => { data[r.col][r.id] = apply(data[r.col][r.id], d); },
      delete: (r: R) => { delete data[r.col][r.id]; },
    });
  },
  batch: () => {
    const ops: (() => void)[] = [];
    return {
      update: (r: R, d: Doc) => ops.push(() => { data[r.col][r.id] = apply(data[r.col][r.id], d); }),
      set: (r: R, d: Doc) => ops.push(() => { data[r.col] ??= {}; data[r.col][r.id] = apply(undefined, d); }),
      commit: async () => ops.forEach((o) => o()),
    };
  },
  collection: (col: string) => ({
    ...query(col),
    listDocuments: async () => Object.keys(data[col] ?? {}).map((id) => ref(col, id)),
    doc: (id?: string) => ref(col, id ?? `${col}-${++counters.ids}`),
    add: async (d: Doc) => { data[col] ??= {}; const id = `${col}-${++counters.ids}`; data[col][id] = d; return { id }; },
  }),
};

export const fakeStorage = {
  bucket: () => ({
    file: (path: string) => ({
      save: async (b: Buffer) => { objects[path] = b; },
      download: async () => { if (!objects[path]) throw new Error('tidak ada'); return [objects[path]]; },
      delete: async () => { delete objects[path]; },
    }),
  }),
};
