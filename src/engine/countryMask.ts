import type { CountryOutline } from '../countryLoader';
import { lonLatToUV, LONGITUDE_OFFSET_DEG } from './geoMapping';

export type MaskSize = { width: number; height: number };

export type CountryMaskResources = {
  texture: GPUTexture;
  view: GPUTextureView;
  sampler: GPUSampler;
  selectionBuffer: GPUBuffer;
  data: Uint8ClampedArray;
};

// Genera el map de paВїs -> color (ID) y crea recursos GPU.
export function createCountryMaskResources(
  device: GPUDevice,
  outlines: CountryOutline[],
  size: MaskSize,
  toUV: (lat: number, lon: number) => { u: number; v: number },
): CountryMaskResources {
  const data = buildCountryMaskData(outlines, size, toUV);

  const texture = device.createTexture({
    size: { width: size.width, height: size.height },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: size.width * 4, rowsPerImage: size.height },
    { width: size.width, height: size.height },
  );

  const view = texture.createView();
  const sampler = device.createSampler({
    magFilter: 'nearest',
    minFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  const selectionBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return { texture, view, sampler, selectionBuffer, data };
}

// Construye el buffer RGBA que identifica cada paВїs por color codificado.
export function buildCountryMaskData(
  outlines: CountryOutline[],
  size: MaskSize,
  toUV: (lat: number, lon: number) => { u: number; v: number } = (lat, lon) =>
    lonLatToUV(lat, lon, LONGITUDE_OFFSET_DEG),
): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No se pudo crear el contexto 2D para el mapa de paВїses');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size.width, size.height);

  const w = size.width - 1;
  const h = size.height - 1;

  for (const country of outlines) {
    const { r, g, b } = encodeMaskColor(country.id);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    for (const ring of country.rings) {
      if (!ring.length) continue;
      const uvRing = ring.map(([lon, lat]) => toUV(lat, lon));
      ctx.moveTo(uvRing[0].u * w, uvRing[0].v * h);
      for (let i = 1; i < uvRing.length; i++) {
        ctx.lineTo(uvRing[i].u * w, uvRing[i].v * h);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }

  return ctx.getImageData(0, 0, size.width, size.height).data;
}

export function sampleMaskId(
  u: number,
  v: number,
  data: Uint8ClampedArray | null,
  size: MaskSize,
): number | null {
  if (!data) return null;
  const clampedU = Math.min(1, Math.max(0, u));
  const clampedV = Math.min(1, Math.max(0, v));
  const x = Math.round(clampedU * (size.width - 1));
  const y = Math.round(clampedV * (size.height - 1));
  const offset = (y * size.width + x) * 4;
  const id = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
  return id === 0 ? null : id;
}

export function updateSelectionBuffer(
  device: GPUDevice,
  buffer: GPUBuffer | null | undefined,
  hoveredId: number,
  selectedId: number,
): void {
  if (!buffer) return;
  const data = new Uint32Array([hoveredId, selectedId, 0, 0]);
  device.queue.writeBuffer(buffer, 0, data);
}

export function buildCountryIdLookup(outlines: CountryOutline[]): number[] {
  const lookup = new Array(outlines.length + 1).fill(-1);
  outlines.forEach((o, i) => {
    lookup[o.id] = i;
  });
  return lookup;
}

function encodeMaskColor(id: number): { r: number; g: number; b: number } {
  const safeId = Math.max(0, Math.floor(id));
  return {
    r: safeId & 0xff,
    g: (safeId >> 8) & 0xff,
    b: (safeId >> 16) & 0xff,
  };
}
