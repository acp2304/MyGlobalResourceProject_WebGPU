// src/engine.ts - Engine with proper Material system

import { initWebGPU } from './initGPU';
import { createBindGroupLayouts, BGLs } from './createBindGroupLayouts';
import { loadTexture } from './utils/loadTexture';
import { Camera } from './camera';
import {  createSunLight, SimpleLight } from './light';
import { Mesh, MeshFactory } from './mesh';
import { MaterialConfig, SimpleMaterial, TexturedMaterial } from './material';

export class Engine {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  // Materials instead of pipelines
  private simpleMaterial!: SimpleMaterial;
  private texturedMaterial!: TexturedMaterial;

  // Bind group layouts
  private layouts!: BGLs;

  // Shared bind-groups
  private camera!: Camera;
  private light!: SimpleLight;

  // Scene objects using the new system
  private sceneSimple!: Mesh;
  private sceneTextured!: Mesh;

  // Depth buffer
  private depthTexture!: GPUTexture;

  // Toggle between simple and textured rendering
  public useTexture = true;

  constructor(private canvas: HTMLCanvasElement) {}

  /** Inicializa WebGPU, materials, bind-groups y escena */
  public async init(): Promise<void> {
    // 1) Inicialización básica
    const { device, format, context } = await initWebGPU(this.canvas);
    this.device  = device;
    this.format  = format;
    this.context = context;
    this.configureDepthTexture();

    // 2) Crear bind group layouts
    const layouts = createBindGroupLayouts(device);
    this.layouts = layouts;

    // 3) Crear configuración base para materiales
    const materialConfig: MaterialConfig = {
      device,
      format,
      cameraBGL: layouts.cameraBGL,
      modelBGL: layouts.modelBGL,
      lightBGL: layouts.lightBGL,
    };

    // 4) Crear materiales
    this.simpleMaterial = new SimpleMaterial(materialConfig);
    
    // Para el material con textura, incluir texBGL
    const texturedMaterialConfig = { ...materialConfig, texBGL: layouts.texBGL };
    this.texturedMaterial = new TexturedMaterial(texturedMaterialConfig);
    
    // 5) Cargar textura y configurarla en el material
    const { view, sampler } = await loadTexture(device, 'textures/earth.jpg');
    this.texturedMaterial.setTexture(view, sampler);

    // 6) Cámara
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

    // 7) Configurar luz
    this.light = createSunLight(device, layouts.lightBGL);

    // 8) Instanciar objetos usando MeshFactory con MATERIALES
    this.sceneSimple = MeshFactory.createColoredIcosahedron(
      device, 
      this.simpleMaterial,  // Material, no pipeline
      layouts.modelBGL,     // Model bind group layout
      3
    );
    
    this.sceneTextured = MeshFactory.createTexturedIcosahedron(
      device, 
      this.texturedMaterial,  // Material, no pipeline
      layouts.modelBGL,       // Model bind group layout
      3
    );

    // 9) Manejar resize
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

    // Configurar bind groups compartidos
    pass.setBindGroup(0, this.camera.getBindGroup());
    pass.setBindGroup(2, this.light.getBindGroup());
    
    // Dibujar objeto activo - el mesh maneja su pipeline y bind groups
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

  // Método para cambiar subdivisiones dinámicamente
  public setSubdivisions(subdivisions: number): void {
    // Destruir meshes anteriores
    this.sceneSimple.destroy();
    this.sceneTextured.destroy();
    
    // Crear nuevos meshes con las subdivisiones especificadas
    this.sceneSimple = MeshFactory.createColoredIcosahedron(
      this.device, 
      this.simpleMaterial,  // Material, no pipeline
      this.layouts.modelBGL, // Model bind group layout
      subdivisions
    );
    
    this.sceneTextured = MeshFactory.createTexturedIcosahedron(
      this.device, 
      this.texturedMaterial,  // Material, no pipeline
      this.layouts.modelBGL,  // Model bind group layout
      subdivisions
    );
  }

  // Cleanup
  public destroy(): void {
    this.sceneSimple?.destroy();
    this.sceneTextured?.destroy();
    this.depthTexture?.destroy();
    this.simpleMaterial?.destroy();
    this.texturedMaterial?.destroy();
    this.camera?.destroy();
    this.light?.destroy();
  }
}