import { mat4, vec3 } from 'gl-matrix';

/**
 * Cámara mejorada que maneja internamente:
 * - Matriz View-Projection (para vértices)
 * - Posición de cámara (para iluminación Phong)
 * - Bind group completo del grupo 0
 */
export class Camera {
  private viewMatrix = mat4.create();
  private projMatrix = mat4.create();
  private vpMatrix   = mat4.create();

  // Buffers GPU
  private vpBuffer: GPUBuffer;      // Matriz view-projection
  private positionBuffer: GPUBuffer; // Posición de cámara
  private bindGroup: GPUBindGroup;   // Bind group completo

  /**
   * @param device   GPUDevice
   * @param bindGroupLayout Layout del grupo 0 (camera + position)
   * @param aspect   Relación de aspecto inicial (width/height)
   * @param fovy     Campo de visión vertical (rad)
   * @param near     Plano cercano de la cámara
   * @param far      Plano lejano de la cámara
   * @param eye      Posición de la cámara
   * @param center   Punto al que mira la cámara
   * @param up       Vector up de la cámara
   */
  constructor(
    private device: GPUDevice,
    bindGroupLayout: GPUBindGroupLayout,
    private aspect: number,
    private fovy: number = Math.PI / 4,
    private near: number = 0.1,
    private far: number = 100.0,
    public eye: vec3 = [0, 1, 3],
    private center: vec3 = [0, 0, 0],
    private up: vec3 = [0, 1, 0],
  ) {
    // Crear buffer para matriz VP (4x4 matrix = 64 bytes)
    this.vpBuffer = device.createBuffer({
      size: 4 * 4 * 4, // 16 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Crear buffer para posición de cámara (vec4 = 16 bytes)
    this.positionBuffer = device.createBuffer({
      size: 4 * 4, // 4 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Crear bind group que combina ambos buffers
    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { 
          binding: 0, 
          resource: { buffer: this.vpBuffer } 
        },
        { 
          binding: 1, 
          resource: { buffer: this.positionBuffer } 
        },
      ],
    });

    // Inicializar con los valores actuales
    this.update();
  }

  /**
   * Actualiza la cámara y escribe ambos buffers uniformes.
   * @param params Opciones para modificar aspect, eye o center antes de recalcular
   */
  update(params?: { aspect?: number; eye?: vec3; center?: vec3 }): void {
    if (params?.aspect !== undefined) this.aspect = params.aspect;
    if (params?.eye) vec3.copy(this.eye, params.eye);
    if (params?.center) vec3.copy(this.center, params.center);

    // 1. Calcular proyección
    mat4.perspective(this.projMatrix, this.fovy, this.aspect, this.near, this.far);
    
    // 2. Calcular view
    mat4.lookAt(this.viewMatrix, this.eye, this.center, this.up);

    // 3. VP = proj * view
    mat4.multiply(this.vpMatrix, this.projMatrix, this.viewMatrix);

    // 4. Escribir matriz VP al buffer
    this.device.queue.writeBuffer(
      this.vpBuffer,
      0,
      this.vpMatrix as Float32Array
    );

    // 5. Escribir posición de cámara al buffer (como vec4 con w=1)
    const cameraPos = new Float32Array([this.eye[0], this.eye[1], this.eye[2], 1.0]);
    this.device.queue.writeBuffer(
      this.positionBuffer,
      0,
      cameraPos
    );
  }

  /**
   * Obtiene el bind group completo para usar en render pass
   */
  getBindGroup(): GPUBindGroup {
    return this.bindGroup;
  }

  /**
   * Mueve la cámara a una nueva posición
   */
  setPosition(x: number, y: number, z: number): void {
    vec3.set(this.eye, x, y, z);
    this.update();
  }

  /**
   * Hace que la cámara mire hacia un punto específico
   */
  lookAt(target: vec3): void {
    vec3.copy(this.center, target);
    this.update();
  }

  /**
   * Orbita la cámara alrededor del centro
   */
  orbit(deltaAzimuth: number, deltaElevation: number, radius?: number): void {
    // Calcular posición relativa al centro
    const offset = vec3.create();
    vec3.subtract(offset, this.eye, this.center);
    
    // Convertir a coordenadas esféricas
    const currentRadius = radius || vec3.length(offset);
    let azimuth = Math.atan2(offset[0], offset[2]);
    let elevation = Math.asin(offset[1] / currentRadius);
    
    // Aplicar deltas
    azimuth += deltaAzimuth;
    elevation = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, elevation + deltaElevation));
    
    // Convertir de vuelta a cartesianas
    const newOffset = vec3.fromValues(
      currentRadius * Math.cos(elevation) * Math.sin(azimuth),
      currentRadius * Math.sin(elevation),
      currentRadius * Math.cos(elevation) * Math.cos(azimuth)
    );
    
    // Establecer nueva posición
    vec3.add(this.eye, this.center, newOffset);
    this.update();
  }

  /**
   * Libera recursos GPU
   */
  destroy(): void {
    this.vpBuffer.destroy();
    this.positionBuffer.destroy();
  }

  // Getters para acceso de solo lectura
  getPosition(): vec3 {
    return vec3.clone(this.eye);
  }

  getTarget(): vec3 {
    return vec3.clone(this.center);
  }

  getViewMatrix(): mat4 {
    return mat4.clone(this.viewMatrix);
  }

  getProjectionMatrix(): mat4 {
    return mat4.clone(this.projMatrix);
  }

  getViewProjectionMatrix(): mat4 {
    return mat4.clone(this.vpMatrix);
  }
}