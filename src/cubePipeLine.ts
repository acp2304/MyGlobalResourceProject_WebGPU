import { shaderCode } from "./shadersCube";

export async function createCubePipeline(device:GPUDevice,format:GPUTextureFormat){
    const shaderModule = device.createShaderModule({ code: shaderCode });

    const pipeline = await device.createRenderPipelineAsync({
        vertex: {
            module: shaderModule,
            entryPoint: "vs_main",
            buffers: [
            {
                //Aqui definimos cuanta informacion viene en cada vertize a procesar, 3 floats para la posicion y 3 para el color
                arrayStride: 24, // 3 pos + 3 color = 6 * 4 bytes
                attributes: [
                //Aqui es donde especificamos luego el location(0) en los shaders, es decir cada punto que tendra 24 bytes, los 3x4 12 priemros bytes definidos por el formato
                //corresponden al punto establecido
                { shaderLocation: 0, offset: 0, format: 'float32x3' },
                //Entonces el location(1) correspondera al buffer offsetado con 12 bytes. 
                { shaderLocation: 1, offset: 12, format: 'float32x3' },
                ],
            },
            ],
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fs_main",
            targets: [{ format }],
        },
        primitive: {
            //Esto es lo que definia como se interpretan la secuencia de puntos dada para formar las mallas
            //Con triangle-list tenemos que definir todos los triangulos, es con el strip con el que tenemos que
            //  definir solo 1 punto mas para utilizar los dos puntos previos para compltar el triangulo
            //Con line-* definimos las lineas y con point-* definimos los puntos
            topology: 'triangle-list',
            cullMode: 'back',
        },
        layout: 'auto',
    });
    return {pipeline};
}