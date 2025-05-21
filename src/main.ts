/// <reference types="@webgpu/types" />

import { mat4 } from 'gl-matrix';
import {cubeIndices , cubeVertices } from "./cubeVertices";
import { initWebGPU } from './initGPU';
import { createCubePipeline } from './cubePipeLine';

const canvas = document.getElementById("gpu-canvas") as HTMLCanvasElement;

//Aqui inicializamos el webGPU
const {adapter,device,format, context} =  await initWebGPU(canvas);

//Aqui queremos empezar el proces de creacion de la pipeline que define como se van a dibujar los modelos. Actualmente los modelos definen un cubo.
const {pipeline} = await createCubePipeline(device,format);


  const vertexBuffer = device.createBuffer({
        size: cubeVertices.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
  });

  new Float32Array(vertexBuffer.getMappedRange()).set(cubeVertices);
  vertexBuffer.unmap();
      const indexBuffer = device.createBuffer({
      size: cubeIndices.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
  });

  new Uint16Array(indexBuffer.getMappedRange()).set(cubeIndices);
  indexBuffer.unmap();

  const matrixSize = 4 * 4 * 4; // 4x4 matriz, 4 bytes por float
  const uniformBuffer = device.createBuffer({
  size: matrixSize,
  //Con GPUBufferUssage.COPY_DST estamos diciendo que este buffer se puede usar como target para copiar datos
  //A su vez indicamos que vamos a utilizar esto como constante uniform. Es decir en este caso será para representar la matrix MVP para renderizar la escena
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

const uniformBindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{
    binding: 0,
    resource: {
      buffer: uniformBuffer,
    },
  }],
});

const aspect = canvas.width / canvas.height;
const projectionMatrix = mat4.create();
mat4.perspective(projectionMatrix, Math.PI / 4, aspect, 0.1, 100.0);

const viewMatrix = mat4.create();
mat4.lookAt(viewMatrix, [3, 3, 6], [0, 0, 0], [0, 1, 0]);

const modelMatrix = mat4.create();
const mvpMatrix = mat4.create();

function frame() {
  const now = Date.now() / 1000;
  mat4.identity(modelMatrix);
  mat4.rotate(modelMatrix, modelMatrix, now, [0, 1, 0]);
  mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
  mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);

  //Es aqui donde escrivimos la matrix MVP al uniformBuffer, que a su vez esta incluido en el binding group mas arriba, esto se hace de forma sincrona
  device.queue.writeBuffer(uniformBuffer, 0, mvpMatrix as Float32Array);

  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  //Aqui empezamos todo lo que queremos hacer en este renderizado
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      //Aqui designamos la vista donde queremos pintar el objeto a renderizar, en este caso es nuestro canvas, utilizamos el contexto que como hemos visto antes es lo que nos permite
      //interactuar con el canvas. Cogemos la textura y creamos una view para que la GPU pueda trabajar con ello.
      view: textureView,
      //Aqui decimos lo que queremos cargar, antes de dibujar, en este caso limpiar la escena
      loadOp: 'clear',
      //Aqui definimos el color con el que queremos limpiar
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      //Aqui definimos lo que queremos que haga despues de dibujar, en este caso guardar (store)
      storeOp: 'store',
    }],
  });
  //Con esto seteamos la pipeline que queremos usar para renderizar
  renderPass.setPipeline(pipeline);

  //Esto son pasos donde definimos los vertices y demas...
  //Como esto esta asignado al renderPass al llamar drawIndexed llamamos a draw de todo lo que hemos indexado

  //Esto es lo que despues en los shaders pordemos referenciar como group(0)
  renderPass.setBindGroup(0, uniformBindGroup);
  
  renderPass.setVertexBuffer(0, vertexBuffer);
  renderPass.setIndexBuffer(indexBuffer, 'uint16');
  renderPass.drawIndexed(cubeIndices.length);
  //Con esto finalizamo lo que queremos hacer en este renderizado
  renderPass.end();
  const buffer = commandEncoder.finish()
  //Finalmente hacemos el submit al device para que meta el buffer a renderizar, esto es sincrono ya que esto lo gestiona la GPU y no tenemos que esperar a que esta termina
  //Simplemnete lo renderizara y ya
  device.queue.submit([buffer]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);