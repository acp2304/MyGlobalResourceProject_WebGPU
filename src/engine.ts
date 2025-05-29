
// Engine.ts
import { initWebGPU } from './initGPU';
import { createPipelinesWithExplicitLayout, BGLs } from './pipelines';
import { loadTexture } from './utils/loadTexture';
import { Camera } from './camera';
import { Icosahedron } from './icosahedron';

export class Engine {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  // Separate pipeline layouts and pipelines
  private simplePipelineLayout!: GPUPipelineLayout;
  private texturedPipelineLayout!: GPUPipelineLayout;
  private simplePipeline!: GPURenderPipeline;
  private texturedPipeline!: GPURenderPipeline;

  // Bind group layouts
  private layouts!: BGLs;

  // Shared bind-groups
  private cameraBG!: GPUBindGroup;
  private lightBG!:  GPUBindGroup;
  private camPosBG!: GPUBindGroup;
  private texBG!:    GPUBindGroup;

  // Scene objects
  private sceneSimple!:  Icosahedron;
  private sceneTextured!: Icosahedron;

  // Camera controller
  private camera!: Camera;

  // Depth buffer
  private depthTexture!: GPUTexture;

  // Toggle between simple and textured rendering
  public useTexture = true;

  constructor(private canvas: HTMLCanvasElement) {}

  /** Inicializa WebGPU, pipelines, bind-groups y escena */
  public async init(): Promise<void> {
    // 1) Inicialización básica
    const { device, format, context } = await initWebGPU(this.canvas);
    this.device  = device;
    this.format  = format;
    this.context = context;
    this.configureDepthTexture();

    // 2) Crear pipelines con layouts separados
    const { 
      layouts, 
      simplePipeline, 
      texturedPipeline, 
      simplePipelineLayout,
      texturedPipelineLayout 
    } = await createPipelinesWithExplicitLayout(device, format);
    
    this.layouts = layouts;
    this.simplePipeline = simplePipeline;
    this.texturedPipeline = texturedPipeline;
    this.simplePipelineLayout = simplePipelineLayout;
    this.texturedPipelineLayout = texturedPipelineLayout;

    // 3) Cargar textura y crear bind-group 
    const { view, sampler } = await loadTexture(device, 'textures/earth.jpg');
    this.texBG = device.createBindGroup({
      layout: layouts.texBGL,
      entries: [
        { binding: 0, resource: view    },
        { binding: 1, resource: sampler },
      ],
    });

    // 4) Cámara + posición en mismo bind-group (grupo 0)
    const aspect     = this.canvas.width / this.canvas.height;
    const camBufSize = 4*4*4;
    const camBuffer   = device.createBuffer({
      size: camBufSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.camera = new Camera(device, camBuffer, null!, aspect);
    
    // cameraPos buffer
    const camPosData = new Float32Array([...this.camera.eye, 1]);
    const camPosBuf  = device.createBuffer({
      size: camPosData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.cameraBG = device.createBindGroup({
      layout: layouts.cameraBGL,  // grupo 0
      entries: [
        { binding: 0, resource: { buffer: camBuffer } },
        { binding: 1, resource: { buffer: camPosBuf } },
      ],
    });

    // 5) Configurar luz direccional (grupo 2)
    const lightData = new Float32Array([0.5, 1.0, 0.5, 2.0]);
    const lightBuffer = device.createBuffer({
      size: lightData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(lightBuffer, 0, lightData);
    this.lightBG = device.createBindGroup({
      layout: layouts.lightBGL,
      entries: [{ binding: 0, resource: { buffer: lightBuffer } }],
    });

    // 6) Instanciar objetos de escena
    this.sceneSimple    = new Icosahedron(device, this.simplePipeline,   3);
    this.sceneTextured  = new Icosahedron(device, this.texturedPipeline, 3,true);

    // 7) Manejar resize
    window.addEventListener('resize', () => this.onResize());
  }

  /** Inicia el bucle de renderizado */
  public start(): void {
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(time: number): void {
    const delta = time / 1000;
    this.camera.update();
    (this.useTexture ? this.sceneTextured : this.sceneSimple)
      .updateModelTransform(delta);

    const encoder = this.device.createCommandEncoder();
    const colorView = this.context.getCurrentTexture().createView();
    const depthView = this.depthTexture.createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view:      colorView,
        loadOp:    'clear',
        clearValue:{ r:0, g:0, b:0, a:1 },
        storeOp:   'store',
      }],
      depthStencilAttachment: {
        view:              depthView,
        depthLoadOp:       'clear',
        depthClearValue:   1.0,
        depthStoreOp:      'store',
      },
    });

    // Bind-groups compartidos
    pass.setPipeline(this.useTexture
      ? this.texturedPipeline
      : this.simplePipeline
    );
    pass.setBindGroup(0, this.cameraBG);
    pass.setBindGroup(2, this.lightBG);
    if (this.useTexture) pass.setBindGroup(3, this.texBG);

    // Dibujar objeto
    const sceneObj = this.useTexture
      ? this.sceneTextured
      : this.sceneSimple;
    sceneObj.draw(pass);

    pass.end();
    this.device.queue.submit([encoder.finish()]);
    requestAnimationFrame((t) => this.frame(t));
  }

  /** (Re)configura la textura de profundidad al tamaño del canvas */
  private configureDepthTexture(): void {
    const size = [this.canvas.width, this.canvas.height, 1] as const;
    this.depthTexture = this.device.createTexture({
      size,
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  /** Ajusta cámara, contexto y depth texture en resize */
  private onResize(): void {
    this.canvas.width  = this.canvas.clientWidth  * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
    });
    this.camera.update({ aspect: this.canvas.width / this.canvas.height });
    this.configureDepthTexture();
  }
}