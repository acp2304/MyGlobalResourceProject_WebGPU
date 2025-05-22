import { mat4 } from 'gl-matrix';

/**
 * Clase que encapsula un cubo: buffers de vértices/índices, transformaciones de modelo y su bindGroup.
 * El pipeline debe estar creado con `layout: 'auto'` o con un segundo bind group para el modelo.
 */
export class Cube {
  public vertexBuffer: GPUBuffer;
  public indexBuffer: GPUBuffer;
  public modelMatrix = mat4.create();

  private modelUniformBuffer: GPUBuffer;
  public modelBindGroup: GPUBindGroup;
  private numIndices: number;

  constructor(
    private device: GPUDevice,
    private pipeline: GPURenderPipeline,
    vertices: Float32Array,
    indices: Uint16Array
  ) {
    this.numIndices = indices.length;

    // 1) Crear buffers de vértices e índices
    this.vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();

    this.indexBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
    this.indexBuffer.unmap();

    // 2) Buffer para la matriz de modelo
    const mat4Size = 4 * 4 * 4;
    this.modelUniformBuffer = device.createBuffer({
      size: mat4Size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 3) Crear bind group para el modelo (grupo 1, binding 0)
    this.modelBindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [{
        binding: 0,
        resource: { buffer: this.modelUniformBuffer },
      }],
    });
  }

  /**
   * Actualiza la transformación del cubo (modelo) y sube la matriz al GPU.
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
   * Dibuja el cubo en el render pass, asumiendo que el bind group de cámara (grupo 0)
   * ya fue seteado antes con setBindGroup(0, ...).
   */
  draw(pass: GPURenderPassEncoder) {
    pass.setPipeline(this.pipeline);
    // Bind group 1: modelo
    pass.setBindGroup(1, this.modelBindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, 'uint16');
    pass.drawIndexed(this.numIndices);
  }
}