// src/material.ts - Sistema de Materiales para WebGPU

import { VertexLayout } from './geometry-system';
import shaderCube from './shadersCube.wgsl?raw';
import textVertexShader from './common.vert.wgsl?raw';
import textFragmentShader from './textured.frag.wgsl?raw';
// src/material.ts - Fixed Material System with shared bind group layouts

/**
 * Configuración base para crear un material
 */
export interface MaterialConfig {
  device: GPUDevice;
  format: GPUTextureFormat;
  // Bind group layouts compartidos
  cameraBGL: GPUBindGroupLayout;
  modelBGL: GPUBindGroupLayout;
  lightBGL: GPUBindGroupLayout;
  texBGL?: GPUBindGroupLayout; // Optional, only for textured materials
}

/**
 * Clase base abstracta para todos los materiales
 */
export abstract class Material {
  protected device: GPUDevice;
  protected pipeline!: GPURenderPipeline;
  protected pipelineLayout!: GPUPipelineLayout;
  
  // Bind groups específicos del material (ej: texturas)
  protected materialBindGroups: Map<number, GPUBindGroup> = new Map();

  constructor(protected config: MaterialConfig) {
    this.device = config.device;
    this.createPipeline();
  }

  /**
   * Cada material debe definir su propio pipeline
   */
  protected abstract createPipeline(): void;

  /**
   * Obtiene el vertex layout requerido por este material
   */
  abstract getRequiredVertexLayout(): VertexLayout;

  /**
   * Obtiene el pipeline de renderizado
   */
  getPipeline(): GPURenderPipeline {
    return this.pipeline;
  }

  /**
   * Obtiene el layout del pipeline
   */
  getPipelineLayout(): GPUPipelineLayout {
    return this.pipelineLayout;
  }

  /**
   * Configura los bind groups específicos del material antes del draw
   */
  bind(pass: GPURenderPassEncoder): void {
    // Los materiales derivados pueden sobrescribir esto para configurar sus bind groups
    this.materialBindGroups.forEach((bindGroup, index) => {
      pass.setBindGroup(index, bindGroup);
    });
  }

  /**
   * Libera recursos GPU
   */
  destroy(): void {
    // Los pipelines no necesitan ser destruidos explícitamente
    // pero los bind groups sí podrían tener recursos asociados
    this.materialBindGroups.clear();
  }
}

/**
 * Material simple con color e iluminación Phong (sin texturas)
 */
export class SimpleMaterial extends Material {


  protected createPipeline(): void {
    // Crear módulos de shader
    const simpleModule = this.device.createShaderModule({
      code: shaderCube
    });
    

    // Layout del pipeline (sin texturas)
    this.pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.config.cameraBGL,
        this.config.modelBGL,
        this.config.lightBGL
      ]
    });

    // Crear pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: this.pipelineLayout,
      vertex: {
        module: simpleModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 9 * 4, // pos(3) + color(3) + normal(3)
          attributes: [
            { shaderLocation: 0, offset: 0,   format: 'float32x3' }, // position
            { shaderLocation: 1, offset: 3*4, format: 'float32x3' }, // color
            { shaderLocation: 2, offset: 6*4, format: 'float32x3' }, // normal
          ],
        }],
      },
      fragment: {
        module: simpleModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.config.format }],
      },
      primitive: { 
        topology: 'triangle-list', 
        cullMode: 'back' 
      },
      depthStencil: { 
        format: 'depth24plus', 
        depthWriteEnabled: true, 
        depthCompare: 'less' 
      },
    });
  }

  getRequiredVertexLayout(): VertexLayout {
    return {
      stride: 9 * 4,
      attributes: [
        { location: 0, offset: 0,   format: 'float32x3', name: 'position' },
        { location: 1, offset: 3*4, format: 'float32x3', name: 'color' },
        { location: 2, offset: 6*4, format: 'float32x3', name: 'normal' },
      ],
    };
  }
}

/**
 * Material con textura e iluminación Phong
 */
export class TexturedMaterial extends Material {
  private textureBindGroup?: GPUBindGroup;

  constructor(config: MaterialConfig) {
    super(config);
    if (!config.texBGL) {
      throw new Error('TexturedMaterial requires texBGL in config');
    }
  }

  protected createPipeline(): void {
    if (!this.config.texBGL) {
      throw new Error('TexturedMaterial requires texBGL in config');
    }

    // Crear módulos de shader
    const vertexModule = this.device.createShaderModule({
      code: textVertexShader
    });
    
    const fragmentModule = this.device.createShaderModule({
      code: textFragmentShader
    });

    // Layout del pipeline (con texturas)
    this.pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.config.cameraBGL,
        this.config.modelBGL,
        this.config.lightBGL,
        this.config.texBGL  // Grupo 3 para texturas - usando el layout compartido
      ]
    });

    // Crear pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: this.pipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 8 * 4, // pos(3) + normal(3) + uv(2)
          attributes: [
            { shaderLocation: 0, offset: 0,   format: 'float32x3' }, // position
            { shaderLocation: 1, offset: 3*4, format: 'float32x3' }, // normal
            { shaderLocation: 2, offset: 6*4, format: 'float32x2' }, // uv
          ],
        }],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.config.format }],
      },
      primitive: { 
        topology: 'triangle-list', 
        cullMode: 'back' 
      },
      depthStencil: { 
        format: 'depth24plus', 
        depthWriteEnabled: true, 
        depthCompare: 'less' 
      },
    });
  }

  getRequiredVertexLayout(): VertexLayout {
    return {
      stride: 8 * 4,
      attributes: [
        { location: 0, offset: 0,   format: 'float32x3', name: 'position' },
        { location: 1, offset: 3*4, format: 'float32x3', name: 'normal' },
        { location: 2, offset: 6*4, format: 'float32x2', name: 'uv' },
      ],
    };
  }

  /**
   * Configura la textura para este material
   */
  setTexture(textureView: GPUTextureView, sampler: GPUSampler): void {
    if (!this.config.texBGL) {
      throw new Error('TexturedMaterial requires texBGL in config');
    }

    this.textureBindGroup = this.device.createBindGroup({
      layout: this.config.texBGL,
      entries: [
        { binding: 0, resource: textureView },
        { binding: 1, resource: sampler },
      ],
    });
    
    // Guardar en el mapa de bind groups
    this.materialBindGroups.set(3, this.textureBindGroup);
  }

  bind(pass: GPURenderPassEncoder): void {
    if (this.textureBindGroup) {
      pass.setBindGroup(3, this.textureBindGroup);
    }
  }
}

/**
 * Factory para crear materiales fácilmente
 */
export class MaterialFactory {
  static createSimpleMaterial(config: MaterialConfig): SimpleMaterial {
    return new SimpleMaterial(config);
  }

  static createTexturedMaterial(
    config: MaterialConfig, 
    textureView?: GPUTextureView, 
    sampler?: GPUSampler
  ): TexturedMaterial {
    const material = new TexturedMaterial(config);
    
    if (textureView && sampler) {
      material.setTexture(textureView, sampler);
    }
    
    return material;
  }
}