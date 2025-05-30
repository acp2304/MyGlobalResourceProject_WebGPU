// pipelines.ts
import shaderCode from './shadersCube.wgsl?raw';
import commonVert   from './common.vert.wgsl?raw';
import texturedFrag from './textured.frag.wgsl?raw';

export type BGLs = {
  cameraBGL: GPUBindGroupLayout;
  modelBGL:  GPUBindGroupLayout;
  lightBGL:  GPUBindGroupLayout;
  texBGL:    GPUBindGroupLayout;
};

export async function createPipelinesWithExplicitLayout(
  device: GPUDevice,
  format: GPUTextureFormat
): Promise<{
  layouts:        BGLs;
  simplePipelineLayout: GPUPipelineLayout;
  texturedPipelineLayout: GPUPipelineLayout;
  simplePipeline: GPURenderPipeline;
  texturedPipeline: GPURenderPipeline;
}> {
  // 1) Creamos y guardamos cada BGL
  const cameraBGL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX,   buffer: { type: 'uniform' }}, // viewProj
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' }}, // cameraPos
    ],
  });
  const modelBGL = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
  });
  const lightBGL = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }],
  });
  const texBGL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    ],
  });

  // 2) Layouts separados
  const simplePipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [cameraBGL, modelBGL, lightBGL], // Sin texBGL
  });

  const texturedPipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [cameraBGL, modelBGL, lightBGL, texBGL], // Con texBGL
  });

  // 3) Shaders
  const cubeShader   = device.createShaderModule({ code: shaderCode });
  const vsTextured   = device.createShaderModule({ code: commonVert });
  const fsTextured   = device.createShaderModule({ code: texturedFrag});

  // 4) Pipeline "simple" (sin texturas)
  const simplePipeline = device.createRenderPipeline({
    layout: simplePipelineLayout, // Layout sin texturas
    vertex: {
      module:     cubeShader,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 9 * 4, // pos(3)+color(3)+normal(3)
        attributes: [
          { shaderLocation: 0, offset: 0,   format: 'float32x3' },
          { shaderLocation: 1, offset: 3*4, format: 'float32x3' },
          { shaderLocation: 2, offset: 6*4, format: 'float32x3' },
        ],
      }],
    },
    fragment: {
      module:     cubeShader,
      entryPoint: 'fs_main',
      targets:    [{ format }],
    },
    primitive:    { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });

  // 5) Pipeline "texturizado"
  const texturedPipeline = device.createRenderPipeline({
    layout: texturedPipelineLayout, // Layout con texturas
    vertex: {
      module:     vsTextured,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: (3 + 3 + 2) * 4, // pos+normal+uv
        attributes: [
          { shaderLocation: 0, offset:   0,   format: 'float32x3' },
          { shaderLocation: 1, offset: 3*4,   format: 'float32x3' },
          { shaderLocation: 2, offset: 6*4,   format: 'float32x2' },
        ],
      }],
    },
    fragment: {
      module:     fsTextured,
      entryPoint: 'fs_main',
      targets:    [{ format }],
    },
    primitive:    { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });

  return {
    layouts: { cameraBGL, modelBGL, lightBGL, texBGL },
    simplePipelineLayout,
    texturedPipelineLayout,
    simplePipeline,
    texturedPipeline,
  };
}