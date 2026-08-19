/**
 * Minimal deterministic ZIP (STORE) for byte-stable DOCX export (P12-T4).
 */

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

/** Fixed DOS date/time: 2020-01-01 00:00:00 */
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = 33;

export interface DeterministicZipEntry {
  name: string;
  data: Uint8Array;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc ^= data[index]!;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeName(name: string): Uint8Array {
  return new TextEncoder().encode(name);
}

function writeUint16(view: DataView, offset: number, value: number): number {
  view.setUint16(offset, value, true);
  return offset + 2;
}

function writeUint32(view: DataView, offset: number, value: number): number {
  view.setUint32(offset, value, true);
  return offset + 4;
}

export function buildDeterministicZip(entries: readonly DeterministicZipEntry[]): Uint8Array {
  const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const nameBytes = sorted.map((entry) => encodeName(entry.name));
  const crcValues = sorted.map((entry) => crc32(entry.data));

  let totalSize = 0;
  const localHeaders: number[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    localHeaders.push(totalSize);
    totalSize += 30 + nameBytes[index]!.length + sorted[index]!.data.length;
  }

  const centralDirectoryStart = totalSize;
  let centralDirectorySize = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    centralDirectorySize += 46 + nameBytes[index]!.length;
  }

  const endSize = 22;
  const buffer = new Uint8Array(totalSize + centralDirectorySize + endSize);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index]!;
    const name = nameBytes[index]!;
    const crc = crcValues[index]!;

    offset = writeUint32(view, offset, LOCAL_FILE_HEADER_SIGNATURE);
    offset = writeUint16(view, offset, 20);
    offset = writeUint16(view, offset, 0);
    offset = writeUint16(view, offset, 0);
    offset = writeUint16(view, offset, FIXED_DOS_TIME);
    offset = writeUint16(view, offset, FIXED_DOS_DATE);
    offset = writeUint32(view, offset, crc);
    offset = writeUint32(view, offset, entry.data.length);
    offset = writeUint32(view, offset, entry.data.length);
    offset = writeUint16(view, offset, name.length);
    offset = writeUint16(view, offset, 0);
    buffer.set(name, offset);
    offset += name.length;
    buffer.set(entry.data, offset);
    offset += entry.data.length;
  }

  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index]!;
    const name = nameBytes[index]!;
    const crc = crcValues[index]!;
    const localHeaderOffset = localHeaders[index]!;

    offset = writeUint32(view, offset, CENTRAL_DIRECTORY_SIGNATURE);
    offset = writeUint16(view, offset, 20);
    offset = writeUint16(view, offset, 20);
    offset = writeUint16(view, offset, 0);
    offset = writeUint16(view, offset, 0);
    offset = writeUint16(view, offset, FIXED_DOS_TIME);
    offset = writeUint16(view, offset, FIXED_DOS_DATE);
    offset = writeUint32(view, offset, crc);
    offset = writeUint32(view, offset, entry.data.length);
    offset = writeUint32(view, offset, entry.data.length);
    offset = writeUint16(view, offset, name.length);
    offset = writeUint16(view, offset, 0);
    offset = writeUint16(view, offset, 0);
    offset = writeUint16(view, offset, 0);
    offset = writeUint16(view, offset, 0);
    offset = writeUint32(view, offset, 0);
    offset = writeUint32(view, offset, localHeaderOffset);
    buffer.set(name, offset);
    offset += name.length;
  }

  offset = writeUint32(view, offset, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  offset = writeUint16(view, offset, 0);
  offset = writeUint16(view, offset, 0);
  offset = writeUint16(view, offset, sorted.length);
  offset = writeUint16(view, offset, sorted.length);
  offset = writeUint32(view, offset, centralDirectorySize);
  offset = writeUint32(view, offset, centralDirectoryStart);
  writeUint16(view, offset, 0);

  return buffer;
}
