import { initWebGPU } from './initGPU';
import { createCubePipeline } from './cubePipeLine';
import { Camera } from './camera';
import { Cube } from './cube';
import { cubeVertices, cubeIndices } from './cubeVertices';

export class Engine {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;

  private camera!: Camera;
  private cube!: Cube;
  private lightBuffer!: GPUBuffer;
  private lightBindGroup!: GPUBindGroup;
  private cameraPosBindGroup!: GPUBindGroup;
  private depthTexture!: GPUTexture;

  constructor(private canvas: HTMLCanvasElement) {}

  /**
   * Inicializa WebGPU, pipeline, cámara y escena principal (cubo).
   */
  public async init(): Promise<void> {
    // 1) Init WebGPU
    const { device, format, context } = await initWebGPU(this.canvas);

    this.device = device;
    this.format = format;
    this.context = context;


    // 2) Depth texture
    this.configureDepthTexture();

    // 3) Crear pipeline
    const { pipeline } = await createCubePipeline(this.device, this.format);
    this.pipeline = pipeline;

    // 4) Crear cámara
    const aspect = this.canvas.width / this.canvas.height;
    const matrixSize = 4 * 4 * 4;
    const cameraBuffer = this.device.createBuffer({
      size: matrixSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const cameraBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: cameraBuffer } }],
    });
    this.camera = new Camera(this.device, cameraBuffer, cameraBindGroup, aspect);

    // 5) Crear cubo
    this.cube = new Cube(
      this.device,
      this.pipeline,
      cubeVertices,
      cubeIndices
    );

    //Generamos uniform de luces
    // 6) Configurar luz direccional

    //El motivo por el que 

    const lightData = new Float32Array([0.0, 1.0, -1.0, 1]);
    this.lightBuffer = this.device.createBuffer({
        size: lightData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.lightBuffer, 0, lightData);
    this.lightBindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(2),
        entries: [{ binding: 0, resource: { buffer: this.lightBuffer } }],
    });

    // Creamos un uniform para pasar informacion de la posicion de la camara
    const cameraPos = new Float32Array([...this.camera.eye,1]); 
    const cameraPosBuffer = device.createBuffer({
      size: cameraPos.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(cameraPosBuffer, 0, cameraPos);
    this.cameraPosBindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(3),  // ¡nuevo grupo 3!
      entries: [{ binding: 0, resource: { buffer: cameraPosBuffer } }],
    });

    // 6) Resize listener
    window.addEventListener('resize', () => this.onResize());
  }

  /**
   * Inicia el bucle de render.
   */
  public start(): void {
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(time: number): void {
    const seconds = time / 1000;

    // 1) Update logic
    this.camera.update();
    this.cube.updateModelTransform(seconds);

    // 2) Encode commands
    const encoder = this.device.createCommandEncoder();
    const colorView = this.context.getCurrentTexture().createView();
    const depthView = this.depthTexture.createView();

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

    // 3) Draw
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.camera.bindGroup);
    pass.setBindGroup(2, this.lightBindGroup);
    pass.setBindGroup(3,this.cameraPosBindGroup);
    this.cube.draw(pass);
    pass.end();

    // 4) Submit
    this.device.queue.submit([encoder.finish()]);

    // 5) Next frame
    requestAnimationFrame((t) => this.frame(t));
  }

  /**
   * (Re)configura la textura de profundidad al tamaño del canvas.
   */
  private configureDepthTexture(): void {
    const size = [this.canvas.width, this.canvas.height, 1] as const;
    this.depthTexture = this.device.createTexture({
      size,
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  /**
   * Handler de resize: actualiza cámara, depthTexture y contexto.
   */
  private onResize(): void {
    // Ajustar tamaño del canvas si necesario
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;

    // Reconfigurar contexto (importante para DPI)
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });

    // Actualizar cámara
    const aspect = this.canvas.width / this.canvas.height;
    this.camera.update({ aspect });

    // Reconfigurar depth texture
    this.configureDepthTexture();
  }
}
