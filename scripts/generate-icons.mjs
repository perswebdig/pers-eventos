import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../public/icons");

const svg = (size, pad = 0) => {
  const s = size;
  const inset = (s * pad) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${pad ? 0 : s * 0.22}" fill="#166534"/>
  <g transform="translate(${inset} ${inset}) scale(${(s - inset * 2) / s})">
    <path d="M ${s * 0.5} ${s * 0.16} L ${s * 0.78} ${s * 0.42} L ${s * 0.68} ${s * 0.42} L ${s * 0.68} ${s * 0.82} L ${s * 0.32} ${s * 0.82} L ${s * 0.32} ${s * 0.42} L ${s * 0.22} ${s * 0.42} Z" fill="#dcfce7"/>
    <circle cx="${s * 0.5}" cy="${s * 0.58}" r="${s * 0.07}" fill="#166534"/>
  </g>
</svg>`;
};

const targets = [
  // Standard PWA icons
  { name: "icon-72.png", size: 72, pad: 0 },
  { name: "icon-96.png", size: 96, pad: 0 },
  { name: "icon-128.png", size: 128, pad: 0 },
  { name: "icon-144.png", size: 144, pad: 0 },
  { name: "icon-152.png", size: 152, pad: 0 },
  { name: "icon-192.png", size: 192, pad: 0 },
  { name: "icon-384.png", size: 384, pad: 0 },
  { name: "icon-512.png", size: 512, pad: 0 },
  // Maskable icon (20% safe zone)
  { name: "maskable-512.png", size: 512, pad: 0.2 },
  // Apple touch icons
  { name: "apple-icon-60.png", size: 60, pad: 0 },
  { name: "apple-icon-76.png", size: 76, pad: 0 },
  { name: "apple-icon-120.png", size: 120, pad: 0 },
  { name: "apple-icon-152.png", size: 152, pad: 0 },
  { name: "apple-icon-180.png", size: 180, pad: 0 },
  // Favicon sizes
  { name: "favicon-16.png", size: 16, pad: 0 },
  { name: "favicon-32.png", size: 32, pad: 0 },
  { name: "favicon-48.png", size: 48, pad: 0 },
];

await mkdir(outDir, { recursive: true });
for (const { name, size, pad } of targets) {
  const png = await sharp(Buffer.from(svg(size, pad)))
    .png()
    .toBuffer();
  await writeFile(resolve(outDir, name), png);
  console.log("wrote", name);
}
