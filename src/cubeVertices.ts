export const cubeVertices = new Float32Array([
  //  X,    Y,    Z,    R,  G,  B,    NX,  NY,  NZ
  // Frente (rojo), normal: +Z
  -1, -1,  1,   1,  0,  0,     0,  0,  1,  // Vértice 0
   1, -1,  1,   1,  0,  0,     0,  0,  1,  // Vértice 1
   1,  1,  1,   1,  0,  0,     0,  0,  1,  // Vértice 2
  -1,  1,  1,   1,  0,  0,     0,  0,  1,  // Vértice 3

  // Atrás (verde), normal: -Z
   1, -1, -1,   0,  1,  0,     0,  0, -1, // Vértice 4
  -1, -1, -1,   0,  1,  0,     0,  0, -1, // Vértice 5
  -1,  1, -1,   0,  1,  0,     0,  0, -1, // Vértice 6
   1,  1, -1,   0,  1,  0,     0,  0, -1, // Vértice 7

  // Izquierda (azul), normal: -X
  -1, -1,  1,   0,  0,  1,    -1,  0,  0, // Vértice 8
  -1,  1,  1,   0,  0,  1,    -1,  0,  0, // Vértice 9
  -1,  1, -1,   0,  0,  1,    -1,  0,  0, // Vértice 10
  -1, -1, -1,   0,  0,  1,    -1,  0,  0, // Vértice 11

  // Derecha (amarillo), normal: +X
   1, -1,  1,   1,  1,  0,     1,  0,  0, // Vértice 12
   1,  1,  1,   1,  1,  0,     1,  0,  0, // Vértice 13
   1,  1, -1,   1,  1,  0,     1,  0,  0, // Vértice 14
   1, -1, -1,   1,  1,  0,     1,  0,  0, // Vértice 15

  // Arriba (magenta), normal: +Y
  -1,  1,  1,   1,  0,  1,     0,  1,  0, // Vértice 16
   1,  1,  1,   1,  0,  1,     0,  1,  0, // Vértice 17
   1,  1, -1,   1,  0,  1,     0,  1,  0, // Vértice 18
  -1,  1, -1,   1,  0,  1,     0,  1,  0, // Vértice 19

  // Abajo (cian), normal: -Y
  -1, -1,  1,   0,  1,  1,     0, -1,  0, // Vértice 20
   1, -1,  1,   0,  1,  1,     0, -1,  0, // Vértice 21
   1, -1, -1,   0,  1,  1,     0, -1,  0, // Vértice 22
  -1, -1, -1,   0,  1,  1,     0, -1,  0, // Vértice 23
]);

export const cubeIndices = new Uint16Array([
  // Frente
  0,  1,  2,   0,  2,  3,
  // Atrás
  4,  5,  6,   4,  6,  7,
  // Izquierda
  8,  9, 10,   8, 10, 11,
  // Derecha (amarillo), ahora en CCW visto desde fuera
  12, 14, 13,
  12, 15, 14,

  // Arriba
  16, 17, 18,  16, 18, 19,
  // Abajo
  20, 21, 22,  20, 22, 23,
]);