
export function generateIcosahedron(subdivisions: number): {
  vertices: Float32Array,
  indices: Uint16Array
} {
  const t = (1 + Math.sqrt(5)) / 2;

  const baseVertices = [
    [-1,  t,  0], [1,  t,  0], [-1, -t,  0], [1, -t,  0],
    [0, -1,  t], [0,  1,  t], [0, -1, -t], [0,  1, -t],
    [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1],
  ].map(v => {
    const len = Math.hypot(...v);
    return v.map(x => x / len);
  });

  let vertices = [...baseVertices];
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  const midpointCache = new Map<string, number>();

  const getMidpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (midpointCache.has(key)) return midpointCache.get(key)!;

    const [ax, ay, az] = vertices[a];
    const [bx, by, bz] = vertices[b];
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const mz = (az + bz) / 2;
    const len = Math.hypot(mx, my, mz);
    const newVertex: [number, number, number] = [mx / len, my / len, mz / len];
    const index = vertices.length;
    vertices.push(newVertex);
    midpointCache.set(key, index);
    return index;
  };

  for (let i = 0; i < subdivisions; i++) {
    const newFaces: number[][] = [];
    for (const [a, b, c] of faces) {
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      newFaces.push([a, ab, ca]);
      newFaces.push([b, bc, ab]);
      newFaces.push([c, ca, bc]);
      newFaces.push([ab, bc, ca]);
    }
    faces = newFaces;
  }

  // Aplanar los vértices
  const flatVertices = new Float32Array(vertices.length * 6); // 3 pos + 3 normal
  for (let i = 0; i < vertices.length; i++) {
    const [x, y, z] = vertices[i];
    flatVertices.set([x, y, z, x, y, z], i * 6);
  }

  const flatIndices = new Uint16Array(faces.length * 3);
  for (let i = 0; i < faces.length; i++) {
    flatIndices.set(faces[i], i * 3);
  }

  return {
    vertices: flatVertices,
    indices: flatIndices,
  };
}