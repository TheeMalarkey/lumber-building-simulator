// Convert Roblox's bundled content/avatar/heads/head.mesh (v2) without changing its shape.
// Usage: node scripts/convert-classic-head.mjs <path-to-head.mesh>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source = readFileSync(process.argv[2]);
const header = source.indexOf(10) + 1;
if (source.subarray(0, header).toString().trim() !== 'version 2.00') throw new Error('Expected mesh v2');
const headerSize = source.readUInt16LE(header), stride = source[header + 2];
const faceStride = source[header + 3], vertices = source.readUInt32LE(header + 4);
const faces = source.readUInt32LE(header + 8), positions = [], normals = [], indices = [];
for (let i = 0; i < vertices; i++) {
  const offset = header + headerSize + i * stride;
  for (let axis = 0; axis < 3; axis++) {
    positions.push(Number((source.readFloatLE(offset + axis * 4) * 1.25).toFixed(7)));
    normals.push(Number(source.readFloatLE(offset + 12 + axis * 4).toFixed(7)));
  }
}
for (let i = 0; i < faces; i++) for (let axis = 0; axis < 3; axis++)
  indices.push(source.readUInt32LE(header + headerSize + vertices * stride + i * faceStride + axis * 4));
if (indices.some(i => i >= vertices)) throw new Error('Invalid mesh index');
mkdirSync('src/assets', { recursive: true });
writeFileSync('src/assets/classic-head.json', JSON.stringify({
  source: 'Roblox client content/avatar/heads/head.mesh',
  sha256: createHash('sha256').update(source).digest('hex'),
  scale: 1.25, positions, normals, indices,
}));
console.log({ vertices, faces });
