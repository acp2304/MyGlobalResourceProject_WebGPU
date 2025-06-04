
// src/mesh.ts - Fixed Mesh system with proper bind group layout handling

import { mat4 } from 'gl-matrix';
import { Geometry } from './geometry-system';
import { Material } from './material';
import { IcosahedronGeometry } from './geometry-system';

/**
 * Configuration for creating a Mesh
 */
export interface MeshConfig {
  device: GPUDevice;
  geometry: Geometry;
  material: Material;
  modelBGL: GPUBindGroupLayout;  // Model bind group layout
}

/**
 * Clase Mesh que combina geometría, material y transformación.
 */
export class Mesh {
  private vertexBuffer: GPUBuffer;
  private indexBuffer: GPUBuffer;
  private modelMatrix = mat4.create();
  private modelUniformBuffer: GPUBuffer;
  private modelBindGroup: GPUBindGroup;
  
  private geometry: Geometry;
  private material: Material;
  private device: GPUDevice;

  constructor(config: MeshConfig) {
    this.device = config.device;
    this.geometry = config.geometry;
    this.material = config.material;

    // Crear buffers usando la geometría
    const { vertexBuffer, indexBuffer } = this.geometry.createBuffers(this.device);
    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;

    // Buffer uniforme para matriz de modelo (16 floats * 4 bytes)
    const mat4Size = 4 * 4 * 4;
    this.modelUniformBuffer = this.device.createBuffer({
      size: mat4Size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Bind group para matriz de modelo usando el layout proporcionado
    this.modelBindGroup = this.device.createBindGroup({
      layout: config.modelBGL,
      entries: [{
        binding: 0,
        resource: { buffer: this.modelUniformBuffer }
      }],
    });
    
    // Verificar que la geometría sea compatible con el material
    const requiredLayout = this.material.getRequiredVertexLayout();
    const geometryLayout = this.geometry.vertexLayout;
    
    if (requiredLayout.stride !== geometryLayout.stride) {
      console.warn('⚠️ Geometry vertex layout may not match material requirements');
    }
  }

  /**
   * Actualiza la matriz de transformación del modelo
   * @param deltaTime - Tiempo para animación (rotación)
   * @param position - Posición [x, y, z]
   * @param rotation - Rotación [x, y, z] en radianes
   * @param scale - Escala [x, y, z]
   */
  updateTransform(
    deltaTime: number = 0,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1]
  ): void {
    mat4.identity(this.modelMatrix);
    
    // Aplicar transformaciones en orden: escala -> rotación -> traslación
    mat4.translate(this.modelMatrix, this.modelMatrix, position);
    
    // Rotación con deltaTime para animación
    mat4.rotateX(this.modelMatrix, this.modelMatrix, rotation[0]);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, rotation[1] + deltaTime);
    mat4.rotateZ(this.modelMatrix, this.modelMatrix, rotation[2]);
    
    mat4.scale(this.modelMatrix, this.modelMatrix, scale);
    
    // Actualizar buffer en GPU
    this.device.queue.writeBuffer(
      this.modelUniformBuffer,
      0,
      this.modelMatrix as Float32Array
    );
  }

  
  updateModelTransform(deltaTime: number): void {
    this.updateTransform(deltaTime);
  }

  /**
   * Renderiza el mesh
   */
  draw(pass: GPURenderPassEncoder): void {
    // El material configura el pipeline
    pass.setPipeline(this.material.getPipeline());
    
    // Configurar bind group del modelo
    pass.setBindGroup(1, this.modelBindGroup);
    
    // Configurar bind groups propios del material (ej: texturas)
    this.material.bind(pass);
    
    // Configurar geometría
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, this.geometry.getIndexFormat());
    pass.drawIndexed(this.geometry.indexCount);
  }

  /**
   * Libera recursos GPU
   */
  destroy(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.modelUniformBuffer.destroy();
  }

  // Getters útiles
  getGeometry(): Geometry {
    return this.geometry;
  }

  getMaterial(): Material {
    return this.material;
  }

  getPipeline(): GPURenderPipeline {
    return this.material.getPipeline();
  }

  getModelMatrix(): mat4 {
    return this.modelMatrix;
  }
}

/**
 * Factory para crear meshes con diferentes geometrías y materiales
 */
export class MeshFactory {
  /**
   * Crea un mesh de icosaedro con textura
   */
  static createTexturedIcosahedron(
    device: GPUDevice, 
    material: Material,
    modelBGL: GPUBindGroupLayout,
    subdivisions: number = 3
  ): Mesh {
    const geometry = new IcosahedronGeometry(1.0, subdivisions, true);
    return new Mesh({
      device,
      geometry,
      material,
      modelBGL
    });
  }

  /**
   * Crea un mesh de icosaedro con colores
   */
  static createColoredIcosahedron(
    device: GPUDevice, 
    material: Material,
    modelBGL: GPUBindGroupLayout,
    subdivisions: number = 2
  ): Mesh {
    const geometry = new IcosahedronGeometry(1.0, subdivisions, false);
    return new Mesh({
      device,
      geometry,
      material,
      modelBGL
    });
  }

  /**
   * Crea un mesh con geometría y material personalizados
   */
  static createFromComponents(
    device: GPUDevice,
    geometry: Geometry,
    material: Material,
    modelBGL: GPUBindGroupLayout
  ): Mesh {
    return new Mesh({
      device,
      geometry,
      material,
      modelBGL
    });
  }
}