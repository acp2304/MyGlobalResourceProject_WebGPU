// Engine.ts - Solo cambiando la parte de luz
import { initWebGPU } from './initGPU';
import { createPipelinesWithExplicitLayout, BGLs } from './pipelines';
import { loadTexture } from './utils/loadTexture';
import { Camera } from './camera';
import { Icosahedron } from './icosahedron';
import { createCurrentLight, createSunLight, SimpleLight } from './light'; // ✅ NUEVO
import { TestMeshFactory, TestMesh } from './mesh-test';

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
  private camera!: Camera;         // ✅ CAMBIADO: ahora Camera en lugar de GPUBindGroup
  private light!: SimpleLight;      // ✅ CAMBIADO: ahora es SimpleLight en lugar de GPUBindGroup
  private camPosBG!: GPUBindGroup;
  private texBG!:    GPUBindGroup;

  // Scene objects
  private sceneSimple!:  Icosahedron;
  private sceneTextured!: Icosahedron;

  private testMesh?: TestMesh;

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
    const aspect = this.canvas.width / this.canvas.height;
    this.camera = new Camera(
      device,
      layouts.cameraBGL,  // El bind group layout del grupo 0
      aspect,
      Math.PI / 4,        // fovy
      0.1,                // near
      100.0,              // far
      [0, 1, 3],          // eye position
      [0, 0, 0],          // look at center
      [0, 1, 0]           // up vector
    );

    // ✅ 5) NUEVO: Configurar luz usando la clase SimpleLight
    this.light = createSunLight(device, layouts.lightBGL);

    // 6) Instanciar objetos de escena
    this.sceneSimple    = new Icosahedron(device, this.simplePipeline,   3, false);
    this.sceneTextured  = new Icosahedron(device, this.texturedPipeline, 3, true);

        // ✅ NUEVO - crear objeto de prueba con nuevo sistema
    this.testMesh = TestMeshFactory.createTexturedIcosahedron(
      device, 
      this.texturedPipeline, 
      1  // Menos subdivisiones para diferenciar visualmente
    );


    // 7) Manejar resize
    window.addEventListener('resize', () => this.onResize());
  }

  /** Inicia el bucle de renderizado */
  public start(): void {
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(time: number): void {
    const delta = time / -1500;
    this.camera.update();
    (this.useTexture ? this.sceneTextured : this.sceneSimple)
      .updateModelTransform(delta);

    // ✅ NUEVO - actualizar objeto de prueba
    if (this.testMesh) {
      this.testMesh.updateModelTransform(delta * 0.3); // Más lento para diferenciar
    }

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
    pass.setBindGroup(0, this.camera.getBindGroup());
    pass.setBindGroup(2, this.light.getBindGroup()); // ✅ CAMBIADO: ahora usa .getBindGroup()
    if (this.useTexture) pass.setBindGroup(3, this.texBG);

    // Dibujar objeto
    const sceneObj = this.useTexture
      ? this.sceneTextured
      : this.sceneSimple;
    //sceneObj.draw(pass);
    // ✅ NUEVO - dibujar TAMBIÉN el objeto de prueba
    if (this.testMesh && this.useTexture) {
      this.testMesh.draw(pass);
    }
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
    
    // ✅ CAMBIADO: actualización de aspecto más simple
    const newAspect = this.canvas.width / this.canvas.height;
    this.camera.update({ aspect: newAspect });
    
    this.configureDepthTexture();
  }

  // ✅ NUEVO: Métodos públicos para controlar la cámara
  public setCameraPosition(x: number, y: number, z: number): void {
    this.camera.setPosition(x, y, z);
  }

  // ✅ NUEVO: Métodos públicos para controlar la luz
  public setLightDirection(x: number, y: number, z: number): void {
    this.light.setDirection(x, y, z);
  }

  public setLightIntensity(intensity: number): void {
    this.light.setIntensity(intensity);
  }
}