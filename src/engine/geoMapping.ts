import { vec3 } from 'gl-matrix';

// Conversiones comunes entre coordenadas geogrБficas y espacio de la esfera.
export const LONGITUDE_OFFSET_DEG = 90; // corrige desplazamiento de textura

export function latLonToDirection(lat: number, lon: number, offsetDeg = LONGITUDE_OFFSET_DEG): vec3 {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = ((-lon + offsetDeg) * Math.PI) / 180;
  const x = Math.cos(latRad) * Math.cos(lonRad);
  const y = Math.sin(latRad);
  const z = Math.cos(latRad) * Math.sin(lonRad);
  return vec3.fromValues(x, y, z);
}

export function directionToUV(dir: vec3): { u: number; v: number } {
  const n = vec3.normalize(vec3.create(), dir);
  let u = 1 - (Math.atan2(-n[0], n[2]) / (2 * Math.PI) + 0.5);
  let v = 1 - (Math.asin(Math.max(-1, Math.min(1, n[1]))) / Math.PI + 0.5);
  u = ((u % 1) + 1) % 1;
  v = Math.min(1, Math.max(0, v));
  return { u, v };
}

export function lonLatToUV(lat: number, lon: number, offsetDeg = LONGITUDE_OFFSET_DEG): { u: number; v: number } {
  return directionToUV(latLonToDirection(lat, lon, offsetDeg));
}
