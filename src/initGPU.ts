/// <reference types="@webgpu/types" />

export async function initWebGPU(canvas: HTMLCanvasElement) {
  if (!navigator.gpu) {
    throw new Error("WebGPU no soportado.");
  }
  // Verificamos que el navegador soporte WebGPU
  const adapter = await navigator.gpu.requestAdapter();
  // Pedimos un adaptador de GPU (es decir, acceso a la GPU, esto es como la abstraccion de las funciones)
  if (!adapter) {
    throw new Error("Adapter is null.");
  }
  const device = await adapter.requestDevice();
  // Solicitamos un dispositivo GPU (es el objeto principal para crear buffers, shaders, etc. Este seria como la instanciacion del adaptador o como una sesion de trabajo sobre el adaptador)
  if (!device) {
    throw new Error("Device is null.");
  }
  // canvas es el elemento HTML sobre el cual se va a renderizar,
  // y context es la interfaz específica para usar WebGPU sobre ese canvas.
  // El contexto proporciona los métodos necesarios para configurar y presentar imágenes renderizadas por la GPU.
  const context = canvas.getContext("webgpu");
  // Obtenemos el contexto WebGPU del canvas, necesario para dibujar
  if (!context) {
    throw new Error("Context is null.");
  }
  const format = navigator.gpu.getPreferredCanvasFormat();

  // Ajustar resolución interna del canvas al tamaño CSS × DPR
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.floor(canvas.clientWidth  * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);

  // Pedimos el formato de color recomendado por el navegador para renderizar (normalmente "bgra8unorm")
  context.configure({
    device: device,
    format: format,
    alphaMode: 'opaque'
  });
  // Configuramos el canvas para usar WebGPU con el dispositivo y el formato elegidos
  return {adapter, device, format, context };
}