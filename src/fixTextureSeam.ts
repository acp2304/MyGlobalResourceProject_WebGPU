// Función para corregir el seam de textura detectando triángulos problemáticos
export function fixTextureSeamProperly(
  vertices: Float32Array, 
  indices: Uint16Array | Uint32Array
): { vertices: Float32Array; indices: Uint16Array | Uint32Array } {
  
  const stride = 8; // pos(3) + normal(3) + uv(2)
  const vertexCount = vertices.length / stride;
  
  // Arrays para nuevos datos
  const newVertices: number[] = Array.from(vertices);
  const newIndices: number[] = Array.from(indices);
  let nextVertexIndex = vertexCount;
  
  // Procesar cada triángulo
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];
    
    // Obtener coordenadas U de cada vértice
    const u0 = vertices[i0 * stride + 6];
    const u1 = vertices[i1 * stride + 6];
    const u2 = vertices[i2 * stride + 6];
    
    // Detectar si el triángulo cruza el seam (diferencia de U > 0.5)
    const seamCrossing = 
      Math.abs(u0 - u1) > 0.5 || 
      Math.abs(u1 - u2) > 0.5 || 
      Math.abs(u0 - u2) > 0.5;
    
    if (seamCrossing) {
      console.log(`Triángulo ${i/3} cruza el seam: U=[${u0.toFixed(3)}, ${u1.toFixed(3)}, ${u2.toFixed(3)}]`);
      
      // Duplicar vértices y ajustar coordenadas U
      const newTriangleIndices = [i0, i1, i2];
      
      for (let j = 0; j < 3; j++) {
        const originalIndex = [i0, i1, i2][j];
        const u = [u0, u1, u2][j];
        
        // Si esta coordenada U está cerca de 0 pero el triángulo tiene U cerca de 1,
        // crear un vértice duplicado con U ajustada
        if (u < 0.3 && (u0 > 0.7 || u1 > 0.7 || u2 > 0.7)) {
          // Duplicar vértice con U + 1.0
          const newVertex = [];
          for (let k = 0; k < stride; k++) {
            newVertex.push(vertices[originalIndex * stride + k]);
          }
          newVertex[6] = u + 1.0; // Ajustar U
          
          newVertices.push(...newVertex);
          newTriangleIndices[j] = nextVertexIndex;
          nextVertexIndex++;
          
          console.log(`  Duplicado vértice ${originalIndex} -> ${nextVertexIndex-1}, U: ${u} -> ${u + 1.0}`);
        }
      }
      
      // Actualizar índices del triángulo
      newIndices[i] = newTriangleIndices[0];
      newIndices[i + 1] = newTriangleIndices[1];
      newIndices[i + 2] = newTriangleIndices[2];
    }
  }
  
  console.log(`Vértices originales: ${vertexCount}, nuevos: ${newVertices.length / stride}`);
  
  // Convertir de vuelta a typed arrays
  const finalVertices = new Float32Array(newVertices);
  const finalIndices = indices instanceof Uint32Array 
    ? new Uint32Array(newIndices)
    : new Uint16Array(newIndices);
  
  return { vertices: finalVertices, indices: finalIndices };
}