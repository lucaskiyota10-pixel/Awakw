import { deflateSync } from "node:zlib";

/** Gera um PNG simples de gráfico de barras (sem dependências nativas) para inserir no DOCX. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function barChartPng(values: number[], opts: { width?: number; height?: number; color?: string; bg?: string } = {}): Buffer {
  const W = opts.width ?? 800;
  const H = opts.height ?? 360;
  const px = new Uint8Array(W * H * 3);
  const fill = (x0: number, y0: number, x1: number, y1: number, c: number[]) => {
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const i = (y * W + x) * 3;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
      }
  };
  fill(0, 0, W, H, hex(opts.bg ?? "#FFFFFF"));
  const pad = 30;
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  const grid = hex("#E9E2D8");
  for (let g = 0; g <= 4; g++) {
    const y = Math.round(H - pad - ((H - 2 * pad) * g) / 4);
    fill(pad, y, W - pad, y + 1, grid);
  }
  const n = Math.max(values.length, 1);
  const slot = (W - 2 * pad) / n;
  const bw = Math.max(2, Math.floor(slot * 0.65));
  const c = hex(opts.color ?? "#252521");
  values.forEach((v, i) => {
    const h = Math.round(((H - 2 * pad) * Math.max(0, v)) / max);
    const x = Math.round(pad + i * slot + (slot - bw) / 2);
    fill(x, H - pad - h, x + bw, H - pad, c);
  });
  fill(pad, H - pad, W - pad, H - pad + 2, hex("#B6A18B"));
  return encodePng(W, H, px);
}
