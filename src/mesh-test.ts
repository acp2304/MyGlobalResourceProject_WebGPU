// src/mesh-test.ts - Prueba del nuevo sistema (imports corregidos)

import { mat4 } from 'gl-matrix';
import { Geometry, IcosahedronGeometry } from './geometry-system';

/**
 * Versión nueva de Mesh que usa el sistema separado
 * Coexiste con SceneObject actual para pruebas graduales
 */
export class TestMesh {
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
    // Crear buffers usando la nueva geometría
    const { vertexBuffer, indexBuffer } = geometry.createBuffers(device);
    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;

    // Buffer uniforme para matriz de modelo (igual que antes)
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
   * Actualiza la transformación (igual que SceneObject)
   */
  updateModelTransform(deltaTime: number): void {
    mat4.identity(this.modelMatrix);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, deltaTime);
    this.device.queue.writeBuffer(
      this.modelUniformBuffer,
      0,
      this.modelMatrix as Float32Array
    );
  }

  /**
   * Renderiza usando la nueva geometría
   */
  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(1, this.modelBindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, this.geometry.getIndexFormat());
    pass.drawIndexed(this.geometry.indexCount);
  }

  /**
   * Libera recursos
   */
  destroy(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.modelUniformBuffer.destroy();
  }
}

// Factory para crear test meshes fácilmente
export class TestMeshFactory {
  static createTexturedIcosahedron(
    device: GPUDevice, 
    pipeline: GPURenderPipeline, 
    subdivisions: number = 2
  ): TestMesh {
    const geometry = new IcosahedronGeometry(1.0, subdivisions, true);
    return new TestMesh(device, geometry, pipeline);
  }

  static createColoredIcosahedron(
    device: GPUDevice, 
    pipeline: GPURenderPipeline, 
    subdivisions: number = 2
  ): TestMesh {
    const geometry = new IcosahedronGeometry(1.0, subdivisions, false);
    return new TestMesh(device, geometry, pipeline);
  }
}