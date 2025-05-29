import { mat4, vec3 } from 'gl-matrix';

/**
 * Cámara que calcula la matriz View-Projection (VP) y la sube cada frame a un uniform buffer.
 * El bindGroup debe estar ya creado apuntando al mismo buffer en binding 0.
 */
export class Camera {
  private viewMatrix = mat4.create();
  private projMatrix = mat4.create();
  private vpMatrix   = mat4.create();

  /**
   * @param device   GPUDevice para escribir en el uniform buffer
   * @param uniformBuffer  GPUBuffer donde se escribirá la matriz VP
   * @param bindGroup      GPUBindGroup que referencia el uniformBuffer en binding=0
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
    private uniformBuffer: GPUBuffer,
    public bindGroup: GPUBindGroup,
    private aspect: number,
    private fovy: number = Math.PI / 4,
    private near: number = 0.1,
    private far: number = 100.0,
    public eye: vec3 = [0, 1, 3],
    private center: vec3 = [0, 0, 0],
    private up: vec3 = [0, 1, 0],
  ) {
    // Inicializa la primera matriz
    this.update();
  }

  /**
   * Actualiza la cámara (para cambios de aspecto, posición o target) y escribe el uniforme.
   * @param params Opciones para modificar aspect, eye o center antes de recalcular
   */
  update(params?: { aspect?: number; eye?: vec3; center?: vec3 }): void {
    if (params?.aspect !== undefined) this.aspect = params.aspect;
    if (params?.eye) this.eye = params.eye;
    if (params?.center) this.center = params.center;

    // 1. Calcula proyección
    mat4.perspective(this.projMatrix, this.fovy, this.aspect, this.near, this.far);
    
    // 2. Calcula view
    mat4.lookAt(this.viewMatrix, this.eye, this.center, this.up);

    // 3. VP = proj * view
    mat4.multiply(this.vpMatrix, this.projMatrix, this.viewMatrix);

    // 4. Escribe la matriz al buffer
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.vpMatrix as Float32Array
    );
  }
}
