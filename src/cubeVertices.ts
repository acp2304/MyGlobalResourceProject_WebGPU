export const cubeVertices = new Float32Array([
    //  X,    Y,    Z,     R,   G,   B
    -1, -1,  1,    1,  0,  0,  // Frente abajo izquierda (rojo)
     1, -1,  1,    0,  1,  0,  // Frente abajo derecha (verde)
     1,  1,  1,    0,  0,  1,  // Frente arriba derecha (azul)
    -1,  1,  1,    1,  1,  0,  // Frente arriba izquierda (amarillo)
    -1, -1, -1,    1,  0,  1,  // Atrás abajo izquierda (magenta)
     1, -1, -1,    0,  1,  1,  // Atrás abajo derecha (cian)
     1,  1, -1,    1,  1,  1,  // Atrás arriba derecha (blanco)
    -1,  1, -1,    0,  0,  0,  // Atrás arriba izquierda (negro)
  ]);
  
  export const cubeIndices = new Uint16Array([
    // Frente
    0, 1, 2, 0, 2, 3,
    // Atrás
    4, 5, 6, 4, 6, 7,
    // Izquierda
    0, 3, 7, 0, 7, 4,
    // Derecha
    1, 2, 6, 1, 6, 5,
    // Arriba
    3, 2, 6, 3, 6, 7,
    // Abajo
    0, 1, 5, 0, 5, 4,
  ]);