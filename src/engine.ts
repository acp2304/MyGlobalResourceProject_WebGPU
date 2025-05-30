// src/engine.ts - Engine actualizado con el nuevo sistema de Mesh

import { initWebGPU } from './initGPU';
import { createPipelinesWithExplicitLayout, BGLs } from './pipelines';
import { loadTexture } from './utils/loadTexture';
import { Camera } from './camera';
import { createCurrentLight, createSunLight, SimpleLight } from './light';
import { Mesh, MeshFactory } from './mesh'; // ✅ NUEVO: Importar sistema definitivo

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
  private camera!: Camera;
  private light!: SimpleLight;
  private texBG!: GPUBindGroup;

  // Scene objects usando el nuevo sistema
  private sceneSimple!: Mesh;    // ✅ CAMBIADO: Mesh en lugar de Icosahedron
  private sceneTextured!: Mesh;  // ✅ CAMBIADO: Mesh en lugar de Icosahedron

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

    // 4) Cámara
    const aspect = this.canvas.width / this.canvas.height;
    this.camera = new Camera(
      device,
      layouts.cameraBGL,
      aspect,
      Math.PI / 4,        // fovy
      0.1,                // near
      100.0,              // far
      [0, 1, 3],          // eye position
      [0, 0, 0],          // look at center
      [0, 1, 0]           // up vector
    );

    // 5) Configurar luz
    this.light = createSunLight(device, layouts.lightBGL);

    // 6) ✅ NUEVO: Instanciar objetos usando MeshFactory
    this.sceneSimple = MeshFactory.createColoredIcosahedron(
      device, 
      this.simplePipeline, 
      3
    );
    
    this.sceneTextured = MeshFactory.createTexturedIcosahedron(
      device, 
      this.texturedPipeline, 
      3
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
    
    // Actualizar cámara
    this.camera.update();
    
    // Actualizar transformación del objeto activo
    const activeScene = this.useTexture ? this.sceneTextured : this.sceneSimple;
    activeScene.updateModelTransform(delta);

    // Crear command encoder
    const encoder = this.device.createCommandEncoder();
    const colorView = this.context.getCurrentTexture().createView();
    const depthView = this.depthTexture.createView();

    // Configurar render pass
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: colorView,
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: depthView,
        depthLoadOp: 'clear',
        depthClearValue: 1.0,
        depthStoreOp: 'store',
      },
    });

    // Configurar pipeline y bind groups compartidos
    pass.setPipeline(this.useTexture ? this.texturedPipeline : this.simplePipeline);
    pass.setBindGroup(0, this.camera.getBindGroup());
    pass.setBindGroup(2, this.light.getBindGroup());
    
    // Bind group de textura solo si es necesario
    if (this.useTexture) {
      pass.setBindGroup(3, this.texBG);
    }

    // Dibujar objeto activo
    activeScene.draw(pass);

    pass.end();
    this.device.queue.submit([encoder.finish()]);
    
    // Continuar loop
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
    
    // Actualizar aspecto de la cámara
    const newAspect = this.canvas.width / this.canvas.height;
    this.camera.update({ aspect: newAspect });
    
    this.configureDepthTexture();
  }

  // Métodos públicos para controlar la cámara
  public setCameraPosition(x: number, y: number, z: number): void {
    this.camera.setPosition(x, y, z);
  }

  // Métodos públicos para controlar la luz
  public setLightDirection(x: number, y: number, z: number): void {
    this.light.setDirection(x, y, z);
  }

  public setLightIntensity(intensity: number): void {
    this.light.setIntensity(intensity);
  }

  // ✅ NUEVO: Método para cambiar subdivisiones dinámicamente
  public setSubdivisions(subdivisions: number): void {
    // Destruir meshes anteriores
    this.sceneSimple.destroy();
    this.sceneTextured.destroy();
    
    // Crear nuevos meshes con las subdivisiones especificadas
    this.sceneSimple = MeshFactory.createColoredIcosahedron(
      this.device, 
      this.simplePipeline, 
      subdivisions
    );
    
    this.sceneTextured = MeshFactory.createTexturedIcosahedron(
      this.device, 
      this.texturedPipeline, 
      subdivisions
    );
  }

  // Cleanup
  public destroy(): void {
    this.sceneSimple?.destroy();
    this.sceneTextured?.destroy();
    this.depthTexture?.destroy();
  }
}