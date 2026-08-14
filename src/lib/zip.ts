/* ---------------------------------------------------------------------------
   A minimal ZIP writer, about a hundred lines, with no dependency.

   It exists because downloading nine files one after another does not work.
   Browsers throttle bursts of programmatic downloads, ask the guest to approve
   "multiple files" — sometimes more than once, because a burst split by pauses
   reads as several bursts — and quietly drop whichever ones arrive while the
   tab is busy. One archive is one download, one permission prompt, and nothing
   silently missing.

   Entries are STORED rather than deflated. The payload is JPEG, which is
   already compressed: deflating it again would cost CPU on a phone and save
   almost nothing. Storing means the archive is written in one pass with no
   compression library at all.
--------------------------------------------------------------------------- */

/* Standard CRC-32, table built once on first use. */
let table: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (table) return table;
  const next = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    next[i] = c >>> 0;
  }
  table = next;
  return next;
}

function crc32(bytes: Uint8Array): number {
  const t = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = t[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* MS-DOS date and time, which is what the format still uses. */
function dosStamp(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export type ZipEntry = { name: string; blob: Blob };

export async function zipStore(entries: ZipEntry[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const stamp = dosStamp(new Date());
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(data);

    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // local file header
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // method: stored
    view.setUint16(10, stamp.time, true);
    view.setUint16(12, stamp.date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true); // compressed size
    view.setUint32(22, data.length, true); // uncompressed size
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true); // extra length
    header.set(name, 30);

    parts.push(header, data);

    const record = new Uint8Array(46 + name.length);
    const rview = new DataView(record.buffer);
    rview.setUint32(0, 0x02014b50, true); // central directory header
    rview.setUint16(4, 20, true); // version made by
    rview.setUint16(6, 20, true); // version needed
    rview.setUint16(8, 0, true);
    rview.setUint16(10, 0, true);
    rview.setUint16(12, stamp.time, true);
    rview.setUint16(14, stamp.date, true);
    rview.setUint32(16, crc, true);
    rview.setUint32(20, data.length, true);
    rview.setUint32(24, data.length, true);
    rview.setUint16(28, name.length, true);
    rview.setUint32(42, offset, true); // offset of local header
    record.set(name, 46);
    central.push(record);

    offset += header.length + data.length;
  }

  const centralSize = central.reduce((sum, record) => sum + record.length, 0);
  const end = new Uint8Array(22);
  const eview = new DataView(end.buffer);
  eview.setUint32(0, 0x06054b50, true); // end of central directory
  eview.setUint16(8, entries.length, true);
  eview.setUint16(10, entries.length, true);
  eview.setUint32(12, centralSize, true);
  eview.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
