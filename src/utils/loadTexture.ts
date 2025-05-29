// utils/loadTexture.ts

export async function loadTexture(
  device: GPUDevice,
  url: string
): Promise<{ texture: GPUTexture; view: GPUTextureView; sampler: GPUSampler }> {
  // 1) Cargar la imagen y convertirla a ImageBitmap
  const response = await fetch(url);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  // 2) Crear la textura en GPU
  const texture = device.createTexture({
    size: [imageBitmap.width, imageBitmap.height, 1],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

    // 3) Copiar datos del ImageBitmap al GPUTexture
    //    Aquí volcamos los píxeles cargados en `imageBitmap` dentro del objeto `texture`
    //    usando la cola de comandos del dispositivo (device.queue).
    device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture: texture },
    [imageBitmap.width, imageBitmap.height, 1]
    );

    // 4) Crear TextureView y Sampler
    //    - TextureView: “ventana” que expone la textura al pipeline, indicando
    //      que es una textura 2D completa (mip-nivel 0, capa 0).
    const view = texture.createView({
    dimension: '2d',
    aspect: 'all',
    });

    //    - Sampler: describe cómo se muestrean los texels en el shader:
    //       * filtros de magnificación/minimización (linear vs nearest)
    //       * filtrado de mip-maps
    //       * modos de repetición (wrap) en U y V
    const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    });

  return { texture, view, sampler };
}