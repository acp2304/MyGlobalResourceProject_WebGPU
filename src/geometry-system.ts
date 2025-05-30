// src/geometry-system.ts - Arquitectura mejorada con inicialización diferida

import { generateIcosahedron } from './geometry';
import { fixTextureSeamProperly } from './fixTextureSeam';

export interface VertexLayout {
  stride: number;
  attributes: {
    location: number;
    offset: number;
    format: GPUVertexFormat;
    name: string;
  }[];
}

export abstract class Geometry {
  public vertices!: Float32Array;
  public indices!: Uint16Array | Uint32Array;
  public vertexLayout!: VertexLayout;
  public vertexCount: number = 0;
  public indexCount: number = 0;
  
  private _initialized: boolean = false;

  constructor() {
    // NO llamamos a generateVertices aquí
  }

  /**
   * Inicializa la geometría. Debe llamarse después de que las propiedades
   * de la clase derivada hayan sido establecidas.
   */
  protected initialize(): void {
    if (this._initialized) {
      console.warn('Geometry already initialized');
      return;
    }
    
    try {
      this.generateVertices();
      this._initialized = true;
    } catch (error) {
      console.error('🚨 ERROR en generateVertices():', error);
      throw error;
    }
  }

  /**
   * Verifica que la geometría esté inicializada antes de usarla
   */
  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error('Geometry not initialized. Call initialize() first.');
    }
  }

  protected abstract generateVertices(): void;

  getVertexBufferDescriptor(): GPUVertexBufferLayout {
    this.ensureInitialized();
    return {
      arrayStride: this.vertexLayout.stride,
      attributes: this.vertexLayout.attributes.map(attr => ({
        shaderLocation: attr.location,
        offset: attr.offset,
        format: attr.format,
      })),
    };
  }

  createBuffers(device: GPUDevice): {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
  } {
    this.ensureInitialized();
    
    // Verificación adicional de seguridad
    if (!this.vertices || !this.indices) {
      throw new Error('Geometry vertices or indices are not initialized');
    }
    
    console.log('📦 Creando buffers:', {
      vertexSize: this.vertices.byteLength,
      indexSize: this.indices.byteLength,
      vertexCount: this.vertexCount,
      indexCount: this.indexCount
    });
    
    const vertexBuffer = device.createBuffer({
      size: this.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(this.vertices);
    vertexBuffer.unmap();

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

  getIndexFormat(): GPUIndexFormat {
    this.ensureInitialized();
    return this.indices instanceof Uint32Array ? 'uint32' : 'uint16';
  }
}

export class IcosahedronGeometry extends Geometry {
  private radius: number;
  private subdivisions: number;
  private useTextureCoords: boolean;

  constructor(
    radius: number = 1.0,
    subdivisions: number = 2,
    useTextureCoords: boolean = true
  ) {
    super();
    this.radius = radius;
    this.subdivisions = subdivisions;
    this.useTextureCoords = useTextureCoords;
    
    // Ahora sí podemos inicializar con las propiedades correctamente establecidas
    this.initialize();
  }

  protected generateVertices(): void {
    console.log('🔧 Generando icosaedro:', {
      radius: this.radius,
      subdivisions: this.subdivisions,
      useTextureCoords: this.useTextureCoords
    });

    const rawGeometry = generateIcosahedron(this.subdivisions);

    if (this.useTextureCoords) {
      this.setupTexturedLayout(rawGeometry);
    } else {
      this.setupColoredLayout(rawGeometry);
    }
  }

  private setupTexturedLayout(rawGeometry: any): void {
    console.log('📐 Configurando layout con texturas');
    
    this.vertexLayout = {
      stride: 8 * 4, // 8 floats * 4 bytes
      attributes: [
        { location: 0, offset: 0,   format: 'float32x3' as GPUVertexFormat, name: 'position' },
        { location: 1, offset: 3*4, format: 'float32x3' as GPUVertexFormat, name: 'normal' },
        { location: 2, offset: 6*4, format: 'float32x2' as GPUVertexFormat, name: 'uv' },
      ],
    };

    this.vertices = calculateBetterUVs(rawGeometry.vertices);
    
    const { vertices: fixedVertices, indices: fixedIndices } = 
      fixTextureSeamProperly(this.vertices, rawGeometry.indices);
    this.vertices = fixedVertices;
    this.indices = fixedIndices;
    
    this.vertexCount = this.vertices.length / 8;
    this.indexCount = this.indices.length;
  }

  private setupColoredLayout(rawGeometry: any): void {
    console.log('🎨 Configurando layout con colores');
    
    this.vertexLayout = {
      stride: 9 * 4, // 9 floats * 4 bytes
      attributes: [
        { location: 0, offset: 0,   format: 'float32x3' as GPUVertexFormat, name: 'position' },
        { location: 1, offset: 3*4, format: 'float32x3' as GPUVertexFormat, name: 'color' },
        { location: 2, offset: 6*4, format: 'float32x3' as GPUVertexFormat, name: 'normal' },
      ],
    };

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

// Importar la función de corrección de seam
//import { fixTextureSeamProperly } from './fixTextureSeam';

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
    
    // Mapeo esférico mejorado para texturas terrestres
    // Usar atan2 para manejar mejor los cuadrantes
    //let u = 1.0 - (Math.atan2(-normX, normZ) / (2 * Math.PI) + 0.5);
    let u = 1.0 - (Math.atan2(-normX, normZ) / (2 * Math.PI) + 0.5);
    let v = Math.asin(Math.max(-1, Math.min(1, normY))) / Math.PI + 0.5;
    
    // Corregir el seam en u = 0/1 con un pequeño margen
    if (u < 0.001) u = 0.001;
    if (u > 0.999) u = 0.999;
    
    // Asegurar que v esté en rango válido
    v = Math.max(0.001, Math.min(0.999, v));
    
    // Invertir V para que coincida con la orientación estándar de texturas
    v = 1.0 - v;
    
    result.set([px, py, pz, nx, ny, nz, u, v], i * 8);
  }
  
  return result;
}