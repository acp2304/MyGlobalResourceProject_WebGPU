// src/createBindGroupLayouts.ts - Only create bind group layouts, no pipelines

export type BGLs = {
  cameraBGL: GPUBindGroupLayout;
  modelBGL:  GPUBindGroupLayout;
  lightBGL:  GPUBindGroupLayout;
  texBGL:    GPUBindGroupLayout;
};

export function createBindGroupLayouts(device: GPUDevice): BGLs {
  // 1) Camera bind group layout (group 0)
  const cameraBGL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX,   buffer: { type: 'uniform' }}, // viewProj
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}, // cameraPos
    ],
  });

  // 2) Model bind group layout (group 1)
  const modelBGL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } } // modelMatrix
    ],
  });

  // 3) Light bind group layout (group 2)
  const lightBGL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } } // lightData
    ],
  });

  // 4) Texture bind group layout (group 3)
  const texBGL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    ],
  });

  return { cameraBGL, modelBGL, lightBGL, texBGL };
}