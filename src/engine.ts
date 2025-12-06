import { mat4, vec3, vec4 } from 'gl-matrix';
import { initWebGPU } from './initGPU';
import { loadTexture } from './utils/loadTexture';
import { loadCountryOutlines, type CountryOutline } from './countryLoader';
import { Camera } from './camera';
import { IcosahedronGeometry } from './geometry-system';
import vertexShader from './common.vert.wgsl?raw';
import fragmentShader from './textured.frag.wgsl?raw';
import outlineVert from './outline.vert.wgsl?raw';
import outlineFrag from './outline.frag.wgsl?raw';

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
  private outlineLayout!: GPUBindGroupLayout;
  private outlineBindGroup!: GPUBindGroup;
  private outlineColorBuffer!: GPUBuffer;
  private outlinePipeline!: GPURenderPipeline;
  private countryMaskTexture!: GPUTexture;
  private countryMaskView!: GPUTextureView;
  private countryMaskSampler!: GPUSampler;
  private countrySelectionBuffer!: GPUBuffer;

  private modelMatrix = mat4.create();
  private modelBuffer!: GPUBuffer;
  private lightingBuffer!: GPUBuffer;
  private outlineVertexBuffer!: GPUBuffer;
  private outlineVertexCount = 0;
  private countryOutlines: CountryOutline[] = [];
  private countryIdToIndex: number[] = [];
  private countryMaskData: Uint8ClampedArray | null = null;
  private readonly maskWidth = 4096;
  private readonly maskHeight = 2048;
  private selectedCountryIndex: number | null = null;
  private hoveredCountryIndex: number | null = null;
  private readonly longitudeOffsetDeg = 90; // corrige desplazamiento del mapa/textura

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
  private readonly lightIntensity = 0.8; // Luz más suave sobre toda la esfera

  // Estado de interacción con el ratón (orbita y zoom)
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private readonly orbitSpeed = 0.0025; // Menor sensibilidad de rotación
  private readonly zoomStep = 0.1; // Zoom más suave por rueda
  private orbitVelAzimuth = 0;
  private orbitVelElevation = 0;
  private readonly orbitDamping = 0.9; // Desaceleración al soltar el botón
  private zoomVelocity = 0;
  private readonly zoomDamping = 0.82; // Pequeña desaceleración de zoom

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
    await this.createOutlineResources(device);
    await this.createCountryMaskResources(device);

    const { view, sampler } = await loadTexture(device, 'textures/earth.jpg');
    this.textureBindGroup = this.createTextureGroup(device, view, sampler);

    this.pipeline = this.createPipeline(device);
    this.outlinePipeline = this.createOutlinePipeline(device);
    this.createGeometry(device);

    window.addEventListener('resize', () => this.onResize());
    this.registerControls(); // Habilita orbitar con ratón y zoom con rueda
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

  // Selecciona un país por nombre, para pintar su contorno destacado
  public selectCountry(name: string | null): CountryOutline | null {
    if (name === null) {
      this.selectedCountryIndex = null;
      this.updateCountrySelectionUniform();
      return null;
    }
    const idx = this.countryOutlines.findIndex((c) => c.name === name);
    this.selectedCountryIndex = idx >= 0 ? idx : null;
    this.updateCountrySelectionUniform();
    return this.selectedCountryIndex !== null ? this.countryOutlines[this.selectedCountryIndex] : null;
  }

  // Establece país hovered (para contorno/hover)
  public setHoveredCountry(name: string | null): CountryOutline | null {
    if (name === null) {
      this.hoveredCountryIndex = null;
      this.updateCountrySelectionUniform();
      return null;
    }
    const idx = this.countryOutlines.findIndex((c) => c.name === name);
    this.hoveredCountryIndex = idx >= 0 ? idx : null;
    this.updateCountrySelectionUniform();
    return this.hoveredCountryIndex !== null ? this.countryOutlines[this.hoveredCountryIndex] : null;
  }

  // Devuelve un país bajo el puntero (si encuentra alguno cercano)
  public pickCountryAt(clientX: number, clientY: number): CountryOutline | null {
    const dir = this.screenToDirection(clientX, clientY);
    if (!dir) return null;
    const uv = this.directionToUV(dir);
    const maskId = this.sampleMaskId(uv.u, uv.v);
    if (maskId === null) return null;
    const idx = this.countryIdToIndex[maskId];
    if (idx === undefined || idx < 0) return null;
    return this.countryOutlines[idx];
  }

  public getCountries(): CountryOutline[] {
    return this.countryOutlines;
  }

  private frame(_time: number): void {
    // Sin rotación automática: la cámara se orbita manualmente con el ratón
    mat4.identity(this.modelMatrix);
    this.device.queue.writeBuffer(this.modelBuffer, 0, this.modelMatrix as Float32Array);

    // Inercia suave cuando se suelta el ratón
    if (!this.isDragging) {
      if (Math.abs(this.orbitVelAzimuth) > 1e-4 || Math.abs(this.orbitVelElevation) > 1e-4) {
        this.camera.orbit(this.orbitVelAzimuth, this.orbitVelElevation);
        this.orbitVelAzimuth *= this.orbitDamping;
        this.orbitVelElevation *= this.orbitDamping;
      } else {
        this.orbitVelAzimuth = 0;
        this.orbitVelElevation = 0;
      }
    }

    // Inercia corta para el zoom (da suavidad al scroll)
    if (Math.abs(this.zoomVelocity) > 1e-4) {
      this.camera.zoom(this.zoomVelocity);
      this.zoomVelocity *= this.zoomDamping;
    } else {
      this.zoomVelocity = 0;
    }

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

    // Dibujar contornos base
    if (this.outlineVertexCount > 0) {
      pass.setPipeline(this.outlinePipeline);
      pass.setBindGroup(0, this.cameraBindGroup);
      // Color base tenue
      this.device.queue.writeBuffer(this.outlineColorBuffer, 0, new Float32Array([0.25, 0.6, 0.9, 0.35]));
      pass.setBindGroup(1, this.outlineBindGroup);
      pass.setVertexBuffer(0, this.outlineVertexBuffer);
      pass.draw(this.outlineVertexCount);

      // Contorno hover (amarillo suave)
      if (this.hoveredCountryIndex !== null) {
        const hovered = this.countryOutlines[this.hoveredCountryIndex];
        this.device.queue.writeBuffer(this.outlineColorBuffer, 0, new Float32Array([1.0, 0.85, 0.3, 0.75]));
        pass.setBindGroup(1, this.outlineBindGroup);
        pass.draw(hovered.count, 1, hovered.start);
      }

      // Contorno seleccionado (prioridad sobre hover)
      if (this.selectedCountryIndex !== null) {
        const selected = this.countryOutlines[this.selectedCountryIndex];
        this.device.queue.writeBuffer(this.outlineColorBuffer, 0, new Float32Array([1.0, 0.95, 0.4, 1.0]));
        pass.setBindGroup(1, this.outlineBindGroup);
        pass.draw(selected.count, 1, selected.start);
      }
    }

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

  // Carga contornos de países y prepara buffers + bind group para dibujarlos
  private async createOutlineResources(device: GPUDevice): Promise<void> {
    this.outlineLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.outlineColorBuffer = device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.outlineBindGroup = device.createBindGroup({
      layout: this.outlineLayout,
      entries: [
        { binding: 0, resource: { buffer: this.outlineColorBuffer } },
      ],
    });

    const { vertices, outlines } = await loadCountryOutlines();
    this.countryOutlines = outlines;
    this.countryIdToIndex = new Array(outlines.length + 1).fill(-1);
    outlines.forEach((o, i) => {
      this.countryIdToIndex[o.id] = i;
    });
    this.outlineVertexCount = vertices.length / 3;

    this.outlineVertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.outlineVertexBuffer.getMappedRange()).set(vertices);
    this.outlineVertexBuffer.unmap();
  }

  private async createCountryMaskResources(device: GPUDevice): Promise<void> {
    const maskData = this.buildCountryMaskData();
    this.countryMaskData = maskData;

    this.countryMaskTexture = device.createTexture({
      size: { width: this.maskWidth, height: this.maskHeight },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    device.queue.writeTexture(
      { texture: this.countryMaskTexture },
      maskData,
      { bytesPerRow: this.maskWidth * 4, rowsPerImage: this.maskHeight },
      { width: this.maskWidth, height: this.maskHeight },
    );

    this.countryMaskView = this.countryMaskTexture.createView();
    this.countryMaskSampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.countrySelectionBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.updateCountrySelectionUniform();
  }

  private createTextureGroup(
    device: GPUDevice,
    view: GPUTextureView,
    sampler: GPUSampler,
  ): GPUBindGroup {
    this.textureLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.textureBindGroup = device.createBindGroup({
      layout: this.textureLayout,
      entries: [
        { binding: 0, resource: view },
        { binding: 1, resource: sampler },
        { binding: 2, resource: this.countryMaskView },
        { binding: 3, resource: this.countryMaskSampler },
        { binding: 4, resource: { buffer: this.countrySelectionBuffer } },
      ],
    });

    return this.textureBindGroup;
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

  private createOutlinePipeline(device: GPUDevice): GPURenderPipeline {
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [
        this.cameraLayout, // usa viewProj
        this.outlineLayout,
      ],
    });

    return device.createRenderPipeline({
      layout,
      vertex: {
        module: device.createShaderModule({ code: outlineVert }),
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 3 * 4,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
          },
        ],
      },
      fragment: {
        module: device.createShaderModule({ code: outlineFrag }),
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'line-list' },
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
    // Invertimos lon y aplicamos offset para alinear con la textura/mapa
    const lonRad = ((-lon + this.longitudeOffsetDeg) * Math.PI) / 180;
    const x = Math.cos(latRad) * Math.cos(lonRad);
    const y = Math.sin(latRad);
    const z = Math.cos(latRad) * Math.sin(lonRad);
    return vec3.fromValues(x, y, z);
  }

  private directionToUV(dir: vec3): { u: number; v: number } {
    const n = vec3.normalize(vec3.create(), dir);
    let u = 1 - (Math.atan2(-n[0], n[2]) / (2 * Math.PI) + 0.5);
    let v = 1 - (Math.asin(Math.max(-1, Math.min(1, n[1]))) / Math.PI + 0.5);
    u = ((u % 1) + 1) % 1;
    v = Math.min(1, Math.max(0, v));
    return { u, v };
  }

  private lonLatToUV(lat: number, lon: number): { u: number; v: number } {
    return this.directionToUV(this.latLonToDirection(lat, lon));
  }

  private buildCountryMaskData(): Uint8ClampedArray {
    const canvas = document.createElement('canvas');
    canvas.width = this.maskWidth;
    canvas.height = this.maskHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No se pudo crear el contexto 2D para el mapa de paヴses');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.maskWidth, this.maskHeight);

    const w = this.maskWidth - 1;
    const h = this.maskHeight - 1;

    for (const country of this.countryOutlines) {
      const { r, g, b } = this.encodeMaskColor(country.id);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      for (const ring of country.rings) {
        if (!ring.length) continue;
        const uvRing = ring.map(([lon, lat]) => this.lonLatToUV(lat, lon));
        ctx.moveTo(uvRing[0].u * w, uvRing[0].v * h);
        for (let i = 1; i < uvRing.length; i++) {
          ctx.lineTo(uvRing[i].u * w, uvRing[i].v * h);
        }
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }

    return ctx.getImageData(0, 0, this.maskWidth, this.maskHeight).data;
  }

  private sampleMaskId(u: number, v: number): number | null {
    if (!this.countryMaskData) return null;
    const clampedU = Math.min(1, Math.max(0, u));
    const clampedV = Math.min(1, Math.max(0, v));
    const x = Math.round(clampedU * (this.maskWidth - 1));
    const y = Math.round(clampedV * (this.maskHeight - 1));
    const offset = (y * this.maskWidth + x) * 4;
    const data = this.countryMaskData;
    const id = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
    return id === 0 ? null : id;
  }

  private encodeMaskColor(id: number): { r: number; g: number; b: number } {
    const safeId = Math.max(0, Math.floor(id));
    return {
      r: safeId & 0xff,
      g: (safeId >> 8) & 0xff,
      b: (safeId >> 16) & 0xff,
    };
  }

  private updateCountrySelectionUniform(): void {
    if (!this.device || !this.countrySelectionBuffer) return;
    const hoveredId = this.hoveredCountryIndex !== null ? this.countryOutlines[this.hoveredCountryIndex].id : 0;
    const selectedId = this.selectedCountryIndex !== null ? this.countryOutlines[this.selectedCountryIndex].id : 0;
    const data = new Uint32Array([hoveredId, selectedId, 0, 0]);
    this.device.queue.writeBuffer(this.countrySelectionBuffer, 0, data);
  }

  // Ray casting del cursor a la esfera y devuelve dirección normalizada
  private screenToDirection(clientX: number, clientY: number): vec3 | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    const vp = this.camera.getViewProjectionMatrix();
    const invVP = mat4.create();
    if (!mat4.invert(invVP, vp)) return null;

    const ndcNear = vec4.fromValues(x, y, -1, 1);
    const ndcFar = vec4.fromValues(x, y, 1, 1);

    const nearWorld = vec4.transformMat4(vec4.create(), ndcNear, invVP);
    const farWorld = vec4.transformMat4(vec4.create(), ndcFar, invVP);
    for (const v of [nearWorld, farWorld]) {
      v[0] /= v[3]; v[1] /= v[3]; v[2] /= v[3]; v[3] = 1;
    }

    const origin = this.camera.getPosition();
    const dir = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), [farWorld[0], farWorld[1], farWorld[2]], [origin[0], origin[1], origin[2]]));

    // Intersección con esfera de radio 1 (centro 0)
    const oDotD = vec3.dot(origin, dir);
    const oDotO = vec3.dot(origin, origin);
    const radius = 1.0;
    const discriminant = oDotD * oDotD - (oDotO - radius * radius);
    if (discriminant < 0) return null;
    const t = -oDotD - Math.sqrt(discriminant);
    if (t < 0) return null;
    const hit = vec3.scaleAndAdd(vec3.create(), origin, dir, t);
    return vec3.normalize(vec3.create(), hit);
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

  // Registra controles de ratón para orbitar (X/Y) y hacer zoom (rueda)
  private registerControls(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      this.isDragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.orbitVelAzimuth = 0; // reset inercia al empezar un drag
      this.orbitVelElevation = 0;
      this.canvas.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener('pointerup', (event) => {
      this.isDragging = false;
      this.canvas.releasePointerCapture(event.pointerId);
    });

    this.canvas.addEventListener('pointerleave', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.isDragging) return;
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;

      // Invertimos direcciones para que el movimiento se sienta natural (dx derecha -> yaw derecha)
      const az = -dx * this.orbitSpeed;
      const el = dy * this.orbitSpeed;
      this.camera.orbit(az, el);
      this.orbitVelAzimuth = az;      // guarda velocidad para la inercia
      this.orbitVelElevation = el;
    });

    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const direction = Math.sign(event.deltaY);
      // Acumula velocidad para un zoom suave con ligera inercia
      this.zoomVelocity += direction * this.zoomStep;
    }, { passive: false });
  }
}
