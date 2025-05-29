// utils/loadTexture.ts

export async function loadTexture(
  device: GPUDevice,
  url: string
): Promise<{ texture: GPUTexture; view: GPUTextureView; sampler: GPUSampler }> {
  // 1) Cargar la imagen y convertirla a ImageBitmap
  const response = await fetch(url);
  const blob = await response.blob();
  let imageBitmap = await createImageBitmap(blob);

  // 2) Obtener los límites máximos del dispositivo
  const maxTextureSize = device.limits.maxTextureDimension2D;
  
  // 3) Verificar si la imagen excede los límites y redimensionar si es necesario
  if (imageBitmap.width > maxTextureSize || imageBitmap.height > maxTextureSize) {
    console.warn(`Imagen ${url} excede el tamaño máximo (${maxTextureSize}x${maxTextureSize}). Redimensionando...`);
    
    // Calcular el factor de escala para mantener el aspect ratio
    const scale = Math.min(
      maxTextureSize / imageBitmap.width,
      maxTextureSize / imageBitmap.height
    );
    
    const newWidth = Math.floor(imageBitmap.width * scale);
    const newHeight = Math.floor(imageBitmap.height * scale);
    
    // Redimensionar usando canvas
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo obtener el contexto 2D del canvas');
    }
    
    // Dibujar la imagen redimensionada
    ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);
    
    // Crear un nuevo ImageBitmap desde el canvas redimensionado
    imageBitmap = await createImageBitmap(canvas);
    
    console.log(`Imagen redimensionada de ${imageBitmap.width}x${imageBitmap.height} a ${newWidth}x${newHeight}`);
  }

  // 4) Crear la textura en GPU
  const texture = device.createTexture({
    size: [imageBitmap.width, imageBitmap.height, 1],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // 5) Copiar datos del ImageBitmap al GPUTexture
  device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture: texture },
    [imageBitmap.width, imageBitmap.height, 1]
  );

  // 6) Crear TextureView y Sampler
  const view = texture.createView({
    dimension: '2d',
    aspect: 'all',
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'clamp-to-edge',
    maxAnisotropy: 1,       
  });

  return { texture, view, sampler };
}

// Función auxiliar opcional para verificar dimensiones antes de cargar
export function getMaxTextureSize(device: GPUDevice): number {
  return device.limits.maxTextureDimension2D;
}

// Función auxiliar opcional para previsualizar si una imagen necesitará redimensionamiento
export async function checkImageDimensions(
  url: string,
  maxSize: number
): Promise<{ needsResize: boolean; originalWidth: number; originalHeight: number }> {
  const response = await fetch(url);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);
  
  return {
    needsResize: imageBitmap.width > maxSize || imageBitmap.height > maxSize,
    originalWidth: imageBitmap.width,
    originalHeight: imageBitmap.height
  };
}