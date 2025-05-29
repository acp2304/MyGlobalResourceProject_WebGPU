
// Icosahedron.ts
import { SceneObject } from './sceneObject';
import { generateIcosahedron } from './geometry';

// Mejores coordenadas UV para icosaedro
function calculateBetterUVs(vertices: Float32Array): Float32Array {
  const count = vertices.length / 6; // pos(3) + normal(3)
  const result = new Float32Array(count * 8); // pos(3) + normal(3) + uv(2)
  
  for (let i = 0; i < count; i++) {
    const px = vertices[i * 6 + 0];
    const py = vertices[i * 6 + 1];
    const pz = vertices[i * 6 + 2];
    const nx = vertices[i * 6 + 3];
    const ny = vertices[i * 6 + 4];
    const nz = vertices[i * 6 + 5];
    
    // Normalizar la posición para obtener coordenadas en la esfera unitaria
    const length = Math.sqrt(px * px + py * py + pz * pz);
    const normX = px / length;
    const normY = py / length;
    const normZ = pz / length;
    
    // Mapeo esférico mejorado
    // Usar atan2 para manejar mejor los cuadrantes
    let u = Math.atan2(normZ, normX) / (2 * Math.PI) + 0.5;
    let v = Math.asin(Math.max(-1, Math.min(1, normY))) / Math.PI + 0.5;
    
    // Corregir el seam en u = 0/1
    if (u < 0) u += 1;
    if (u > 1) u -= 1;
    
    // Asegurar que v esté en rango válido
    v = Math.max(0, Math.min(1, v));
    
    // Invertir V para que coincida con la orientación estándar de texturas
    v = 1.0 - v;
    
    result.set([px, py, pz, nx, ny, nz, u, v], i * 8);
  }
  
  return result;
}

export class Icosahedron extends SceneObject {
  constructor(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    subdivisions: number = 2,
    isTextured: boolean = false
  ) {
    super(device, pipeline);
    const raw = generateIcosahedron(subdivisions);

    if (isTextured) {
      // Usar la función mejorada para calcular UVs
      const vertsWithUVs = calculateBetterUVs(raw.vertices);
      this.initializeBuffers(vertsWithUVs, raw.indices);
    } else {
      // Formato: [pos(3), color(3), norm(3)] para pipeline simple
      const count = raw.vertices.length / 6;
      const verts = new Float32Array(count * 9);
      for (let i = 0; i < count; i++) {
        const px = raw.vertices[i * 6 + 0];
        const py = raw.vertices[i * 6 + 1];
        const pz = raw.vertices[i * 6 + 2];
        const nx = raw.vertices[i * 6 + 3];
        const ny = raw.vertices[i * 6 + 4];
        const nz = raw.vertices[i * 6 + 5];
        verts.set([px, py, pz, 0, 0, 1, nx, ny, nz], i * 9);
      }
      this.initializeBuffers(verts, raw.indices);
    }
  }
}

// Exportar la función por si quieres usarla en otros lugares
//export { calculateBetterUVs };