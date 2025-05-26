// SceneObject.ts
import { mat4 } from 'gl-matrix';

/**
 * Clase base genérica para cualquier objeto de escena con buffers, transformación y bind group.
 */
export abstract class SceneObject {
  protected vertexBuffer!: GPUBuffer;
  protected indexBuffer!: GPUBuffer;
  protected modelMatrix = mat4.create();
  protected modelUniformBuffer: GPUBuffer;
  protected modelBindGroup: GPUBindGroup;
  protected numIndices!: number;

  constructor(
    protected device: GPUDevice,
    protected pipeline: GPURenderPipeline
  ) {
    // Crear buffer uniforme para la matriz de modelo
    const mat4Size = 4 * 4 * 4;
    this.modelUniformBuffer = device.createBuffer({
      size: mat4Size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // Bind group para la matriz de modelo (grupo 1, binding 0)
    this.modelBindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [{
        binding: 0,
        resource: { buffer: this.modelUniformBuffer }
      }],
    });
  }

  /**
   * Inicializa los buffers de vértices e índices a partir de datos proporcionados.
   */
  protected initializeBuffers(
    vertices: Float32Array,
    indices: Uint16Array | Uint32Array
  ) {
    this.numIndices = indices.length;

    // Vertex buffer
    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();

    // Index buffer
    const indexFormat = indices instanceof Uint32Array ? 'uint32' : 'uint16';
    this.indexBuffer = this.device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    if (indices instanceof Uint32Array) {
      new Uint32Array(this.indexBuffer.getMappedRange()).set(indices as Uint32Array);
    } else {
      new Uint16Array(this.indexBuffer.getMappedRange()).set(indices as Uint16Array);
    }
    this.indexBuffer.unmap();
  }

  /**
   * Actualiza la matriz de modelo (rotación Y) y sube al GPU.
   */
  updateModelTransform(deltaTime: number) {
    mat4.identity(this.modelMatrix);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, deltaTime);
    this.device.queue.writeBuffer(
      this.modelUniformBuffer,
      0,
      this.modelMatrix as Float32Array
    );
  }

  /**
   * Dibuja el objeto en el render pass.
   */
  draw(pass: GPURenderPassEncoder) {
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(1, this.modelBindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, this.indexBuffer instanceof Uint32Array ? 'uint32' : 'uint16');
    pass.drawIndexed(this.numIndices);
  }
}