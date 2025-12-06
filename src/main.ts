import { Engine } from './engine';
import { handleRegionSelection, type RegionSelection } from './regionSelection';

const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
const engine = new Engine(canvas);
await engine.init();
engine.start();

const regions: RegionSelection[] = [
  { label: 'Sin seleccion', lat: null, lon: null },
  { label: 'Espana', lat: 40.4637, lon: -3.7492, radius: 8, intensity: 1.5 },
  { label: 'Estados Unidos', lat: 37.0902, lon: -95.7129, radius: 8, intensity: 1.5 },
  { label: 'Brasil', lat: -14.235, lon: -51.9253, radius: 8, intensity: 1.5 },
  { label: 'Japon', lat: 36.2048, lon: 138.2529, radius: 8, intensity: 1.5 },
  { label: 'Australia', lat: -25.2744, lon: 133.7751, radius: 8, intensity: 1.5 },
];

const selector = document.getElementById('country-select') as HTMLSelectElement;
const latInput = document.getElementById('lat-input') as HTMLInputElement;
const lonInput = document.getElementById('lon-input') as HTMLInputElement;
const manualBtn = document.getElementById('select-coordinates') as HTMLButtonElement;
const currentLabel = document.getElementById('current-selection') as HTMLSpanElement;

regions.forEach((region, index) => {
  const option = document.createElement('option');
  option.value = index.toString();
  option.textContent = region.label;
  selector.appendChild(option);
});
selector.value = '0';

selector.addEventListener('change', () => {
  const selected = regions[Number(selector.value)];
  if (!selected) {
    return;
  }

  handleRegionSelection(engine, selected, 'preset');
  currentLabel.textContent = selected.lat === null || selected.lon === null
    ? 'sin pais activo'
    : selected.label;
});

manualBtn.addEventListener('click', () => {
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    alert('Introduce coordenadas validas (latitud y longitud).');
    return;
  }

  const selection: RegionSelection = {
    label: `Personalizado (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
    lat,
    lon,
    radius: 6,
    intensity: 1.2,
  };

  handleRegionSelection(engine, selection, 'manual');
  currentLabel.textContent = selection.label;
  selector.value = '0';
});
