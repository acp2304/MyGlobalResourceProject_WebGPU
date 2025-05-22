/// <reference types="@webgpu/types" />

import { cubeIndices, cubeVertices } from './cubeVertices';
import { initWebGPU } from './initGPU';
import { createCubePipeline } from './cubePipeLine';
import { Camera } from './camera';
import { Cube } from './cube'

const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;

// 1. Inicializar WebGPU: adapter, device, formato y contexto
const { device, format, context } = await initWebGPU(canvas);

// Tras initWebGPU
let depthTexture = device.createTexture({
  size: [canvas.width, canvas.height, 1],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

// Si el canvas cambia de tamaño:
function resize() {
  const aspect = canvas.width / canvas.height;
  camera.update({ aspect });
  depthTexture.destroy();
  depthTexture = device.createTexture({
    size: [canvas.width, canvas.height, 1],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

// 2. Crear la pipeline para renderizar el cubo
const { pipeline } = await createCubePipeline(device, format);

// 3. Preparar el uniform buffer para la matriz VP de la cámara
const aspect = canvas.width / canvas.height;
const matrixSize = 4 * 4 * 4; // 4×4 floats, 4 bytes cada uno

const uniformBuffer = device.createBuffer({
  size: matrixSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

// 4. Crear el bind group que asocia el uniform buffer al binding 0 del grupo 0
const uniformBindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{
    binding: 0,
    resource: { buffer: uniformBuffer },
  }],
});

// 5. Instanciar la cámara (se encargará de actualizar la matriz VP cada frame)
const camera = new Camera(
  device,
  uniformBuffer,
  uniformBindGroup,
  aspect
);

window.addEventListener('resize', resize);

// 6. Creamos el buffer de vertices
const cube = new Cube(
  device,
  pipeline,
  cubeVertices,
  cubeIndices
);


// Función de render loop
function frame(time: number) {
  // time viene en ms, convertimos a segundos
  const seconds = time / 1000;

  // 1) Actualizar cámara y modelo
  camera.update();
  cube.updateModelTransform(seconds);

  // 2) Preparar command encoder y attachments
  const commandEncoder = device.createCommandEncoder();
  const colorView = context.getCurrentTexture().createView();
  const depthView = depthTexture.createView();

  // 3) Iniciar render pass
  const renderPass = commandEncoder.beginRenderPass({
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

    // 4) Dibujar escena
  renderPass.setPipeline(pipeline);
  renderPass.setBindGroup(0, camera.bindGroup);
  cube.draw(renderPass);
  renderPass.end();

  // 5) Enviar comandos a la GPU
  device.queue.submit([commandEncoder.finish()]);

  // 6) Siguiente frame
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);


