// src/geometry-system.ts - Nueva arquitectura (imports corregidos)

import { generateIcosahedron } from './geometry'; // Tu archivo actual
import { calculateBetterUVs } from './icosahedron'; // Tu función actual  
import { fixTextureSeamProperly } from './fixTextureSeam'; // Tu función actual

export interface VertexLayout {
  stride: number;           // bytes por vértice
  attributes: {
    location: number;
    offset: number;
    format: GPUVertexFormat;
    name: string;          // 'position', 'normal', 'uv', 'color'
  }[];
}

export abstract class Geometry {
  public vertices!: Float32Array;
  public indices!: Uint16Array | Uint32Array;
  public vertexLayout!: VertexLayout;
  public vertexCount: number = 0;
  public indexCount: number = 0;

  constructor() {
    this.generateVertices();
  }

  /**
   * Genera los datos de vértices e índices específicos de cada geometría
   */
  protected abstract generateVertices(): void;

  /**
   * Obtiene el descriptor de vertex buffer para WebGPU
   */
  getVertexBufferDescriptor(): GPUVertexBufferLayout {
    return {
      arrayStride: this.vertexLayout.stride,
      attributes: this.vertexLayout.attributes.map(attr => ({
        shaderLocation: attr.location,
        offset: attr.offset,
        format: attr.format,
      })),
    };
  }

  /**
   * Crea los buffers GPU para esta geometría
   */
  createBuffers(device: GPUDevice): {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
  } {
    // Vertex buffer
    const vertexBuffer = device.createBuffer({
      size: this.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(this.vertices);
    vertexBuffer.unmap();

    // Index buffer
    const indexBuffer = device.createBuffer({
      size: this.indices.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    if (this.indices instanceof Uint32Array) {
      new Uint32Array(indexBuffer.getMappedRange()).set(this.indices);
    } else {
      new Uint16Array(indexBuffer.getMappedRange()).set(this.indices);
    }
    indexBuffer.unmap();

    return { vertexBuffer, indexBuffer };
  }

  /**
   * Obtiene el formato de índices para WebGPU
   */
  getIndexFormat(): GPUIndexFormat {
    return this.indices instanceof Uint32Array ? 'uint32' : 'uint16';
  }
}

/**
 * Geometría de icosaedro (versión nueva, coexiste con la antigua)
 */
export class IcosahedronGeometry extends Geometry {
  constructor(
    private radius: number = 1.0,
    private subdivisions: number = 2,
    private useTextureCoords: boolean = true
  ) {
    super();
  }

  protected generateVertices(): void {
    // Usar tu función existente
    const rawGeometry = generateIcosahedron(this.subdivisions);

    if (this.useTextureCoords) {
      this.setupTexturedLayout(rawGeometry);
    } else {
      this.setupColoredLayout(rawGeometry);
    }
  }

  private setupTexturedLayout(rawGeometry: any): void {
    // Layout: position(3) + normal(3) + uv(2)
    this.vertexLayout = {
      stride: 8 * 4, // 8 floats * 4 bytes
      attributes: [
        { location: 0, offset: 0,   format: 'float32x3' as GPUVertexFormat, name: 'position' },
        { location: 1, offset: 3*4, format: 'float32x3' as GPUVertexFormat, name: 'normal' },
        { location: 2, offset: 6*4, format: 'float32x2' as GPUVertexFormat, name: 'uv' },
      ],
    };

    // Usar tu función de UV mapping existente
    this.vertices = calculateBetterUVs(rawGeometry.vertices);
    console.log('Primeros 3 vértices del sistema ORIGINAL:');
    for (let i = 0; i < 3; i++) {
    const offset = i * 8;
    console.log(`Vértice original ${i}:`, {
        position: [this.vertices[offset], this.vertices[offset+1], this.vertices[offset+2]],
        normal: [this.vertices[offset+3], this.vertices[offset+4], this.vertices[offset+5]],
        uv: [this.vertices[offset+6], this.vertices[offset+7]]
    });
    }
    // Aplicar corrección de seam
    const { vertices: fixedVertices, indices: fixedIndices } = 
      fixTextureSeamProperly(this.vertices, rawGeometry.indices);
    
    this.vertices = fixedVertices;
    this.indices = fixedIndices;
    
    this.vertexCount = this.vertices.length / 8;
    this.indexCount = this.indices.length;
  }

  private setupColoredLayout(rawGeometry: any): void {
    // Layout: position(3) + color(3) + normal(3)
    this.vertexLayout = {
      stride: 9 * 4, // 9 floats * 4 bytes
      attributes: [
        { location: 0, offset: 0,   format: 'float32x3' as GPUVertexFormat, name: 'position' },
        { location: 1, offset: 3*4, format: 'float32x3' as GPUVertexFormat, name: 'color' },
        { location: 2, offset: 6*4, format: 'float32x3' as GPUVertexFormat, name: 'normal' },
      ],
    };

    // Convertir de [pos(3), norm(3)] a [pos(3), color(3), norm(3)]
    const count = rawGeometry.vertices.length / 6;
    this.vertices = new Float32Array(count * 9);
    
    for (let i = 0; i < count; i++) {
      const px = rawGeometry.vertices[i * 6 + 0];
      const py = rawGeometry.vertices[i * 6 + 1];
      const pz = rawGeometry.vertices[i * 6 + 2];
      const nx = rawGeometry.vertices[i * 6 + 3];
      const ny = rawGeometry.vertices[i * 6 + 4];
      const nz = rawGeometry.vertices[i * 6 + 5];
      
      // Color azul por defecto
      this.vertices.set([px, py, pz, 0, 0, 1, nx, ny, nz], i * 9);
    }
    
    this.indices = rawGeometry.indices;
    this.vertexCount = this.vertices.length / 9;
    this.indexCount = this.indices.length;
  }
}

// Factory para crear geometrías comunes
export class GeometryFactory {
  static createIcosahedronTextured(subdivisions: number = 2): IcosahedronGeometry {
    return new IcosahedronGeometry(1.0, subdivisions, true);
  }

  static createIcosahedronColored(subdivisions: number = 2): IcosahedronGeometry {
    return new IcosahedronGeometry(1.0, subdivisions, false);
  }
}