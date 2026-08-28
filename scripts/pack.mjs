#!/usr/bin/env node
/**
 * Gera um arquivo tucano.zip com todo o projeto (sem node_modules/dist).
 * Uso: node scripts/pack.mjs
 * Não precisa instalar nada — usa apenas módulos nativos do Node.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tucano.zip");

const IGNORE = new Set(["node_modules", "dist", ".git", "tucano.zip", ".DS_Store", "Thumbs.db"]);

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    day: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/* ---------- coleta de arquivos ---------- */
const files = [];
(function walk(dir, rel) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    const relPath = rel ? rel + "/" + ent.name : ent.name;
    if (ent.isDirectory()) walk(abs, relPath);
    else if (ent.isFile()) files.push({ abs, relPath });
  }
})(ROOT, "");

if (files.length === 0) {
  console.error("Nenhum arquivo encontrado para empacotar.");
  process.exit(1);
}

/* ---------- montagem do ZIP ---------- */
const parts = [];
const central = [];
let offset = 0;

for (const f of files) {
  const data = fs.readFileSync(f.abs);
  const compressed = zlib.deflateRawSync(data, { level: 6 });
  const name = Buffer.from(f.relPath, "utf8");
  const crc = crc32(data);
  const { time, day } = dosDateTime(fs.statSync(f.abs).mtime);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // nomes UTF-8
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  parts.push(local, name, compressed);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0x0800, 8);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt16LE(time, 12);
  cd.writeUInt16LE(day, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(compressed.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  cd.writeUInt32LE(0, 38);
  cd.writeUInt32LE(offset, 42);
  central.push(cd, name);

  offset += 30 + name.length + compressed.length;
}

const cdSize = central.reduce((s, b) => s + b.length, 0);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cdSize, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

fs.writeFileSync(OUT, Buffer.concat([...parts, ...central, eocd]));

const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`[ok] ${files.length} arquivos empacotados`);
console.log(`[ok] ZIP criado em: ${OUT} (${mb} MB)`);
console.log("");
console.log("O que ficou de fora (propositalmente):");
console.log("  - node_modules  -> regenere com: npm install");
console.log("  - dist          -> regenere com: npm run build");
