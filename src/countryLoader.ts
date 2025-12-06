// countryLoader.ts
// Carga y decodifica el TopoJSON de países a líneas sobre la esfera.

type Transform = {
  scale: [number, number];
  translate: [number, number];
};

type TopoGeometry = {
  type: string;
  arcs?: any;
  properties?: Record<string, any>;
};

type Topology = {
  type: 'Topology';
  transform?: Transform;
  arcs: number[][][];
  objects: Record<string, { type: string; geometries: TopoGeometry[] }>;
};

export type CountryOutline = {
  id: number;
  name: string;
  start: number;
  count: number;
  properties: Record<string, any>;
  centroid: { lat: number; lon: number };
  rings: [number, number][][];
};

export type CountryOutlinesData = {
  vertices: Float32Array;
  outlines: CountryOutline[];
};

const LONGITUDE_OFFSET_DEG = 90; // corrige el desplazamiento de 1/4 de globo

// Decodifica un punto aplicando transform si existe.
function decodePoint(pos: number[], transform?: Transform): [number, number] {
  if (!transform) return [pos[0], pos[1]];
  return [
    pos[0] * transform.scale[0] + transform.translate[0],
    pos[1] * transform.scale[1] + transform.translate[1],
  ];
}

// Decodifica un arco delta-encoded y aplica transform
function decodeArc(arc: number[][], transform?: Transform): [number, number][] {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return decodePoint([x, y], transform);
  });
}

// Reconstruye una lista de posiciones (lon,lat) para un arco indexado (puede ser negativo)
function extractArcByIndex(
  arcs: number[][][],
  index: number,
  transform?: Transform
): [number, number][] {
  if (index >= 0) {
    return decodeArc(arcs[index], transform);
  }
  // Índice negativo = invertir
  const arc = decodeArc(arcs[~index], transform);
  return arc.reverse();
}

// Convierte lon/lat a coordenada 3D en la esfera (radio levemente mayor para evitar z-fighting)
function lonLatToXYZ(lon: number, lat: number, radius = 1.01): [number, number, number] {
  // Invertimos la longitud y aplicamos un offset para alinear con la textura (corrige ~90°)
  const lonRad = ((-lon + LONGITUDE_OFFSET_DEG) * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const x = radius * Math.cos(latRad) * Math.cos(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.sin(lonRad);
  return [x, y, z];
}

// Extrae las coordenadas absolutas de un geometry (Polygon o MultiPolygon)
function extractRings(
  geom: TopoGeometry,
  arcs: number[][][],
  transform?: Transform
): [number, number][][] {
  const rings: [number, number][][] = [];
  if (geom.type === 'Polygon') {
    for (const ring of geom.arcs ?? []) {
      const points: [number, number][] = [];
      for (const arcIndex of ring) {
        const arcPositions = extractArcByIndex(arcs, arcIndex, transform);
        // Evitar duplicar el primer punto de arcos consecutivos
        if (points.length > 0 && arcPositions.length > 0) arcPositions.shift();
        points.push(...arcPositions);
      }
      rings.push(points);
    }
  } else if (geom.type === 'MultiPolygon') {
    for (const polygon of geom.arcs ?? []) {
      for (const ring of polygon) {
        const points: [number, number][] = [];
        for (const arcIndex of ring) {
          const arcPositions = extractArcByIndex(arcs, arcIndex, transform);
          if (points.length > 0 && arcPositions.length > 0) arcPositions.shift();
          points.push(...arcPositions);
        }
        rings.push(points);
      }
    }
  }
  return rings;
}

// Calcula centroid aproximado de un conjunto de puntos lon/lat
function centroidLonLat(points: [number, number][]): { lon: number; lat: number } {
  if (points.length === 0) return { lon: 0, lat: 0 };
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of points) {
    // Guardamos lon original; la conversión a XYZ aplicará el offset/inversión
    sumLon += lon;
    sumLat += lat;
  }
  return { lon: sumLon / points.length, lat: sumLat / points.length };
}

export async function loadCountryOutlines(): Promise<CountryOutlinesData> {
  const response = await fetch('country_data/countries-50m.json');
  if (!response.ok) {
    throw new Error(`No se pudo cargar el TopoJSON: ${response.statusText}`);
  }
  const topo = (await response.json()) as Topology;
  const countriesObj = topo.objects['countries'];
  if (!countriesObj) {
    throw new Error('No se encontró el objeto "countries" en el TopoJSON');
  }

  const outlines: CountryOutline[] = [];
  const vertices: number[] = [];

  for (const geom of countriesObj.geometries) {
    const rings = extractRings(geom, topo.arcs, topo.transform);
    if (!rings.length) continue;

    // Usaremos la primera ring para centroid aproximado
    const centroid = centroidLonLat(rings[0]);

    const start = vertices.length / 3;
    let segmentCount = 0;

    for (const ring of rings) {
      if (ring.length < 2) continue;
      for (let i = 0; i < ring.length; i++) {
        const curr = ring[i];
        const next = ring[(i + 1) % ring.length]; // cerrar ring
        const [x1, y1, z1] = lonLatToXYZ(curr[0], curr[1]);
        const [x2, y2, z2] = lonLatToXYZ(next[0], next[1]);
        vertices.push(x1, y1, z1, x2, y2, z2); // dos vértices por segmento (line-list)
        segmentCount += 2;
      }
    }

    const name = geom.properties?.name ?? 'Unknown';
    const id = outlines.length + 1; // Reservamos 0 para el ocケano en el mask
    outlines.push({
      id,
      name,
      start,
      count: segmentCount,
      properties: geom.properties ?? {},
      centroid,
      rings,
    });
  }

  return { vertices: new Float32Array(vertices), outlines };
}
