// Icosahedron.ts
import { SceneObject } from './sceneObject';
import { generateIcosahedron } from './geometry';

export class Icosahedron extends SceneObject {
  constructor(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    subdivisions: number = 2
  ) {
    super(device, pipeline);
    const raw = generateIcosahedron(subdivisions);

    // Convertir [pos(3), norm(3)] -> [pos(3), color(3), norm(3)] con color blanco
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

