import { mat4, vec3, vec4 } from 'gl-matrix';
import { initWebGPU } from './initGPU';
import { loadTexture } from './utils/loadTexture';
import { Camera } from './camera';
import { IcosahedronGeometry } from './geometry-system';
import vertexShader from './common.vert.wgsl?raw';
import fragmentShader from './textured.frag.wgsl?raw';

interface HighlightConfig {
  direction: vec3;
  intensity: number;
  innerCos: number;
  outerCos: number;
}

export class Engine {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private depthTexture!: GPUTexture;

  private camera!: Camera;

  private cameraLayout!: GPUBindGroupLayout;
  private cameraBindGroup!: GPUBindGroup;
  private modelLayout!: GPUBindGroupLayout;
  private modelBindGroup!: GPUBindGroup;
  private lightingLayout!: GPUBindGroupLayout;
  private lightingBindGroup!: GPUBindGroup;
  private textureLayout!: GPUBindGroupLayout;
  private textureBindGroup!: GPUBindGroup;

  private modelMatrix = mat4.create();
  private modelBuffer!: GPUBuffer;
  private lightingBuffer!: GPUBuffer;

  private vertexBuffer!: GPUBuffer;
  private indexBuffer!: GPUBuffer;
  private indexCount = 0;

  private highlight: HighlightConfig = {
    direction: vec3.fromValues(0, 0, 1),
    intensity: 0,
    innerCos: 1,
    outerCos: 1,
  };

  private readonly lightDir = vec3.fromValues(-0.25, -0.6, -0.3);
  private readonly lightIntensity = 2.0;

  constructor(private canvas: HTMLCanvasElement) {}

  public async init(): Promise<void> {
    const { device, format, context } = await initWebGPU(this.canvas);
    this.device = device;
    this.format = format;
    this.context = context;
    this.configureDepthTexture();

    this.createCamera(device);
    this.createModelGroup(device);
    this.createLightingGroup(device);

    const { view, sampler } = await loadTexture(device, 'textures/earth.jpg');
    this.textureBindGroup = this.createTextureGroup(device, view, sampler);

    this.pipeline = this.createPipeline(device);
    this.createGeometry(device);

    window.addEventListener('resize', () => this.onResize());
  }

  public start(): void {
    requestAnimationFrame((t) => this.frame(t));
  }

  public setHighlight(lat: number, lon: number, radiusDegrees = 10, strength = 1): void {
    const dir = this.latLonToDirection(lat, lon);
    this.highlight.direction = dir;
    this.highlight.intensity = strength;
    const inner = Math.cos((radiusDegrees * Math.PI) / 180);
    const outer = Math.cos(((radiusDegrees + 6) * Math.PI) / 180);
    this.highlight.innerCos = inner;
    this.highlight.outerCos = outer;
  }

  public clearHighlight(): void {
    this.highlight.intensity = 0;
  }

  private frame(time: number): void {
    const rotation = time / 3000;
    mat4.identity(this.modelMatrix);
    mat4.rotateY(this.modelMatrix, this.modelMatrix, rotation);
    this.device.queue.writeBuffer(this.modelBuffer, 0, this.modelMatrix as Float32Array);

    this.updateLightingBuffer();
    this.camera.update();

    const encoder = this.device.createCommandEncoder();
    const colorView = this.context.getCurrentTexture().createView();
    const depthView = this.depthTexture.createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: colorView,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.cameraBindGroup);
    pass.setBindGroup(1, this.modelBindGroup);
    pass.setBindGroup(2, this.lightingBindGroup);
    pass.setBindGroup(3, this.textureBindGroup);

    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, 'uint16');
    pass.drawIndexed(this.indexCount);

    pass.end();
    this.device.queue.submit([encoder.finish()]);

    requestAnimationFrame((t) => this.frame(t));
  }

  private createCamera(device: GPUDevice): void {
    this.cameraLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    const aspect = this.canvas.width / this.canvas.height;
    this.camera = new Camera(
      device,
      this.cameraLayout,
      aspect,
      Math.PI / 4,
      0.1,
      100,
      [0, 1, 3],
      [0, 0, 0],
      [0, 1, 0]
    );

    this.cameraBindGroup = this.camera.getBindGroup();
  }

  private createModelGroup(device: GPUDevice): void {
    this.modelBuffer = device.createBuffer({
      size: 4 * 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.modelLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    this.modelBindGroup = device.createBindGroup({
      layout: this.modelLayout,
      entries: [{ binding: 0, resource: { buffer: this.modelBuffer } }],
    });
  }

  private createLightingGroup(device: GPUDevice): void {
    this.lightingBuffer = device.createBuffer({
      size: 4 * 4 * 3,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.lightingLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.lightingBindGroup = device.createBindGroup({
      layout: this.lightingLayout,
      entries: [{ binding: 0, resource: { buffer: this.lightingBuffer } }],
    });
  }

  private createTextureGroup(device: GPUDevice, view: GPUTextureView, sampler: GPUSampler): void {
    this.textureLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });

    this.textureBindGroup = device.createBindGroup({
      layout: this.textureLayout,
      entries: [
        { binding: 0, resource: view },
        { binding: 1, resource: sampler },
      ],
    });
  }

  private createPipeline(device: GPUDevice): GPURenderPipeline {
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [
        this.cameraLayout,
        this.modelLayout,
        this.lightingLayout,
        this.textureLayout,
      ],
    });

    return device.createRenderPipeline({
      layout,
      vertex: {
        module: device.createShaderModule({ code: vertexShader }),
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 8 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' },
              { shaderLocation: 2, offset: 6 * 4, format: 'float32x2' },
            ],
          },
        ],
      },
      fragment: {
        module: device.createShaderModule({ code: fragmentShader }),
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    });
  }

  private createGeometry(device: GPUDevice): void {
    const geometry = new IcosahedronGeometry(1.0, 3, true);
    const { vertexBuffer, indexBuffer } = geometry.createBuffers(device);
    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;
    this.indexCount = geometry.indexCount;
  }

  private updateLightingBuffer(): void {
    const rotatedHighlight = vec3.create();
    const rotationOnly = mat4.clone(this.modelMatrix);
    rotationOnly[12] = 0; rotationOnly[13] = 0; rotationOnly[14] = 0;
    vec3.transformMat4(rotatedHighlight, this.highlight.direction, rotationOnly);

    const lightDirIntensity = vec4.fromValues(this.lightDir[0], this.lightDir[1], this.lightDir[2], this.lightIntensity);
    const highlightDirPower = vec4.fromValues(
      rotatedHighlight[0],
      rotatedHighlight[1],
      rotatedHighlight[2],
      this.highlight.intensity,
    );
    const highlightParams = vec4.fromValues(this.highlight.innerCos, this.highlight.outerCos, 0, 0);

    const data = new Float32Array([
      ...lightDirIntensity,
      ...highlightDirPower,
      ...highlightParams,
    ]);

    this.device.queue.writeBuffer(this.lightingBuffer, 0, data);
  }

  private latLonToDirection(lat: number, lon: number): vec3 {
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    const x = Math.cos(latRad) * Math.cos(lonRad);
    const y = Math.sin(latRad);
    const z = Math.cos(latRad) * Math.sin(lonRad);
    return vec3.fromValues(x, y, z);
  }

  private configureDepthTexture(): void {
    const size = [this.canvas.width, this.canvas.height, 1] as const;
    this.depthTexture = this.device.createTexture({
      size,
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  private onResize(): void {
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
    const newAspect = this.canvas.width / this.canvas.height;
    this.camera.update({ aspect: newAspect });
    this.configureDepthTexture();
  }
}
