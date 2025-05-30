// src/mesh.ts - Sistema definitivo de Mesh que reemplaza SceneObject

import { mat4 } from 'gl-matrix';
import { Geometry } from './geometry-system';
import { IcosahedronGeometry } from './geometry-system';
/**
 * Clase Mesh que combina geometría con transformación y renderizado.
 * Esta es la versión final que reemplaza tanto SceneObject como TestMesh.
 */
export class Mesh {
  private vertexBuffer: GPUBuffer;
  private indexBuffer: GPUBuffer;
  private modelMatrix = mat4.create();
  private modelUniformBuffer: GPUBuffer;
  private modelBindGroup: GPUBindGroup;

  constructor(
    private device: GPUDevice,
    private geometry: Geometry,
    private pipeline: GPURenderPipeline
  ) {
    // Crear buffers usando la geometría
    const { vertexBuffer, indexBuffer } = geometry.createBuffers(device);
    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;

    // Buffer uniforme para matriz de modelo (16 floats * 4 bytes)
    const mat4Size = 4 * 4 * 4;
    this.modelUniformBuffer = device.createBuffer({
      size: mat4Size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Bind group para matriz de modelo (grupo 1, binding 0)
    this.modelBindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [{
        binding: 0,
        resource: { buffer: this.modelUniformBuffer }
      }],
    });
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

  /**
   * Método de compatibilidad con la API anterior
   * @deprecated Use updateTransform en su lugar
   */
  updateModelTransform(deltaTime: number): void {
    this.updateTransform(deltaTime);
  }

  /**
   * Renderiza el mesh
   */
  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(1, this.modelBindGroup);
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

  getPipeline(): GPURenderPipeline {
    return this.pipeline;
  }

  getModelMatrix(): mat4 {
    return this.modelMatrix;
  }
}

/**
 * Factory para crear meshes con diferentes geometrías
 */
export class MeshFactory {
  /**
   * Crea un mesh de icosaedro con textura
   */
  static createTexturedIcosahedron(
    device: GPUDevice, 
    pipeline: GPURenderPipeline, 
    subdivisions: number = 3
  ): Mesh {
    // Importación dinámica para evitar dependencias circulares
    const geometry = new IcosahedronGeometry(1.0, subdivisions, true);
    return new Mesh(device, geometry, pipeline);
  }

  /**
   * Crea un mesh de icosaedro con colores
   */
  static createColoredIcosahedron(
    device: GPUDevice, 
    pipeline: GPURenderPipeline, 
    subdivisions: number = 2
  ): Mesh {
    const geometry = new IcosahedronGeometry(1.0, subdivisions, false);
    return new Mesh(device, geometry, pipeline);
  }

  /**
   * Crea un mesh con geometría personalizada
   */
  static createFromGeometry(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    geometry: Geometry
  ): Mesh {
    return new Mesh(device, geometry, pipeline);
  }
}