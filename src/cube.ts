import { SceneObject } from './sceneObject';

export class Cube extends SceneObject {
  constructor(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    vertices: Float32Array,
    indices: Uint16Array
  ) {
    super(device, pipeline);
    this.initializeBuffers(vertices, indices);
  }
}