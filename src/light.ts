// src/light.ts - Primera versión simple para migración gradual
export class SimpleLight {
  private device: GPUDevice;
  private lightBuffer: GPUBuffer;
  private lightBindGroup: GPUBindGroup;
  
  // Propiedades de la luz (público para fácil migración)
  public direction: [number, number, number] = [-0.25, -1.0, -1.0]; // ✅ Invertido para compensar el shader
  public intensity: number = 2.0;

  constructor(
    device: GPUDevice, 
    lightBGL: GPUBindGroupLayout,
    direction: [number, number, number] = [0.25, 1.0, 1.0],
    intensity: number = 2.0
  ) {
    this.device = device;
    this.direction = direction;
    this.intensity = intensity;

    // Crear exactamente el mismo buffer que tienes ahora
    const lightData = new Float32Array([...direction, intensity]);
    this.lightBuffer = device.createBuffer({
      size: lightData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Escribir datos iniciales
    device.queue.writeBuffer(this.lightBuffer, 0, lightData);
    
    // Crear bind group exactamente igual que antes
    this.lightBindGroup = device.createBindGroup({
      layout: lightBGL,
      entries: [{ binding: 0, resource: { buffer: this.lightBuffer } }],
    });
  }

  /**
   * Actualiza la dirección de la luz
   */
  setDirection(x: number, y: number, z: number): void {
    this.direction = [x, y, z];
    this.updateBuffer();
  }

  /**
   * Actualiza la intensidad de la luz
   */
  setIntensity(intensity: number): void {
    this.intensity = intensity;
    this.updateBuffer();
  }

  /**
   * Actualiza el buffer GPU con los valores actuales
   */
  private updateBuffer(): void {
    const lightData = new Float32Array([...this.direction, this.intensity]);
    this.device.queue.writeBuffer(this.lightBuffer, 0, lightData);
  }

  /**
   * Obtiene el bind group para usar en render pass
   * EXACTAMENTE igual que antes: pass.setBindGroup(2, light.getBindGroup())
   */
  getBindGroup(): GPUBindGroup {
    return this.lightBindGroup;
  }

  /**
   * Limpia recursos
   */
  destroy(): void {
    this.lightBuffer.destroy();
  }
}

// Helper para crear la luz que ya tienes configurada (restaurando comportamiento original)
export function createCurrentLight(device: GPUDevice, lightBGL: GPUBindGroupLayout): SimpleLight {
  return new SimpleLight(device, lightBGL, [-0.25, -1.0, -1.0], 2.0); // Compensar la inversión del shader
}

// Helper para crear una luz "sol" más intuitiva
export function createSunLight(device: GPUDevice, lightBGL: GPUBindGroupLayout): SimpleLight {
  // Luz que viene de arriba-derecha-adelante (más natural)
  // El shader la invertirá a [-0.5, 1.0, 0.5] que es perfecto para iluminación
  return new SimpleLight(device, lightBGL, [0.5, -1.0, -0.5], 2.0);
}