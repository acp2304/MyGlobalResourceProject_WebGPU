// src/material.ts - Sistema de Materiales para WebGPU

import { VertexLayout } from './geometry-system';

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
  private vertexShaderCode = `
    struct VertexOutput {
      @builtin(position) Position : vec4<f32>,
      @location(0) vColor : vec3<f32>,
      @location(1) vNormal: vec3<f32>,
      @location(2) worldPos: vec3<f32>
    };

    @group(0) @binding(0) var<uniform> vp : mat4x4<f32>;
    @group(0) @binding(1) var<uniform> cameraPos: vec4<f32>;
    @group(1) @binding(0) var<uniform> model : mat4x4<f32>;

    @vertex
    fn vs_main(
      @location(0) position: vec3<f32>, 
      @location(1) color: vec3<f32>, 
      @location(2) normal: vec3<f32>
    ) -> VertexOutput {
      var output : VertexOutput;
      let worldPos = model * vec4<f32>(position, 1.0);
      output.Position = vp * worldPos;
      output.vColor = color;
      output.vNormal = normalize((model * vec4<f32>(normal, 0.0)).xyz);
      output.worldPos = worldPos.xyz;
      return output;
    }
  `;

  private fragmentShaderCode = `
    @group(0) @binding(1) var<uniform> cameraPos: vec4<f32>;
    @group(2) @binding(0) var<uniform> light : vec4<f32>;

    fn toneMap_Reinhard(color: vec3<f32>) -> vec3<f32> {
      return color / (color + vec3(1.0));
    }

    @fragment
    fn fs_main(
      @location(0) vColor: vec3<f32>,
      @location(1) vNormal: vec3<f32>,
      @location(2) worldPos: vec3<f32>
    ) -> @location(0) vec4<f32> {
      let ambientStrength: f32 = 1.0;
      
      let N = normalize(vNormal);
      let L = normalize(light.xyz);
      let diff = max(dot(N, L), 0.0);
      let diffuse = diff * vColor * light.w;
      
      let ambient = ambientStrength * vColor;
      
      let V = normalize(cameraPos.xyz - worldPos);
      let R = reflect(-L, N);
      let specPower: f32 = 5.0;
      let specular = pow(max(dot(R, V), 0.0), specPower) * light.w * 3.0;
      let specColor = vec3<f32>(1.0) * specular;
      
      let litColor = ambient + diffuse + specColor;
      let normalizedColor = toneMap_Reinhard(litColor);
      return vec4<f32>(normalizedColor, 1.0);
    }
  `;

  protected createPipeline(): void {
    // Crear módulos de shader
    const vertexModule = this.device.createShaderModule({
      code: this.vertexShaderCode
    });
    
    const fragmentModule = this.device.createShaderModule({
      code: this.fragmentShaderCode
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
        module: vertexModule,
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
  private textureBGL: GPUBindGroupLayout;
  private textureBindGroup?: GPUBindGroup;

  private vertexShaderCode = `
    struct VertexIn {
      @location(0) position: vec3<f32>,
      @location(1) normal:   vec3<f32>,
      @location(2) uv:       vec2<f32>,
    };

    struct VSOut {
      @builtin(position) Position: vec4<f32>,
      @location(0) vNormal:      vec3<f32>,
      @location(1) vUV:          vec2<f32>,
      @location(2) vWorldPos:    vec3<f32>,
    };

    @group(0) @binding(0) var<uniform> viewProj:   mat4x4<f32>;
    @group(0) @binding(1) var<uniform> cameraPos:  vec4<f32>;
    @group(1) @binding(0) var<uniform> modelMatrix: mat4x4<f32>;

    @vertex
    fn vs_main(in: VertexIn) -> VSOut {
      var out: VSOut;
      let worldPos4 = modelMatrix * vec4<f32>(in.position, 1.0);
      out.Position  = viewProj * worldPos4;
      out.vWorldPos = worldPos4.xyz;
      out.vNormal   = (modelMatrix * vec4<f32>(in.normal, 0.0)).xyz;
      out.vUV       = in.uv;
      return out;
    }
  `;

  private fragmentShaderCode = `
    struct VSOut {
      @location(0) vNormal:   vec3<f32>,
      @location(1) vUV:       vec2<f32>,
      @location(2) vWorldPos: vec3<f32>,
      @builtin(position) Position: vec4<f32>,
    };

    @group(0) @binding(1) var<uniform> cameraPos: vec4<f32>;
    @group(2) @binding(0) var<uniform> lightData: vec4<f32>;
    @group(3) @binding(0) var myTexture: texture_2d<f32>;
    @group(3) @binding(1) var mySampler: sampler;

    @fragment
    fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
      let albedo = textureSample(myTexture, mySampler, in.vUV).rgb;
      let N = normalize(in.vNormal);
      let L = normalize(-lightData.xyz);
      let V = normalize(cameraPos.xyz - in.vWorldPos);
      let R = reflect(-L, N);
      
      let ambient  = 0.25 * lightData.w;
      let diff     = max(dot(N, L), 0.0) * lightData.w;
      let spec     = pow(max(dot(R, V), 0.0), 64.0) * 0.1 * lightData.w;
      
      let color = (ambient + diff + spec) * albedo;
      return vec4<f32>(color, 1.0);
    }
  `;

  constructor(config: MaterialConfig) {
    // Crear bind group layout para texturas
    const texBGL = config.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });
    
    super(config);
    this.textureBGL = texBGL;
  }

  protected createPipeline(): void {
    // Crear módulos de shader
    const vertexModule = this.device.createShaderModule({
      code: this.vertexShaderCode
    });
    
    const fragmentModule = this.device.createShaderModule({
      code: this.fragmentShaderCode
    });

    // Layout del pipeline (con texturas)
    this.pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.config.cameraBGL,
        this.config.modelBGL,
        this.config.lightBGL,
        this.textureBGL  // Grupo 3 para texturas
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
    this.textureBindGroup = this.device.createBindGroup({
      layout: this.textureBGL,
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