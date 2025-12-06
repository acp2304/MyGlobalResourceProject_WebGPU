import { Engine } from './engine';

const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
const engine = new Engine(canvas);
await engine.init();
engine.start();

const countries = [
  { label: 'Sin selección', lat: null, lon: null },
  { label: 'España', lat: 40.4637, lon: -3.7492 },
  { label: 'Estados Unidos', lat: 37.0902, lon: -95.7129 },
  { label: 'Brasil', lat: -14.235, lon: -51.9253 },
  { label: 'Japón', lat: 36.2048, lon: 138.2529 },
  { label: 'Australia', lat: -25.2744, lon: 133.7751 },
];

const selector = document.getElementById('country-select') as HTMLSelectElement;
const latInput = document.getElementById('lat-input') as HTMLInputElement;
const lonInput = document.getElementById('lon-input') as HTMLInputElement;
const manualBtn = document.getElementById('select-coordinates') as HTMLButtonElement;
const currentLabel = document.getElementById('current-selection') as HTMLSpanElement;

// Poblar selector
countries.forEach((country, index) => {
  const option = document.createElement('option');
  option.value = index.toString();
  option.textContent = country.label;
  selector.appendChild(option);
});

selector.addEventListener('change', () => {
  const selected = countries[parseInt(selector.value, 10)];
  if (!selected || selected.lat === null || selected.lon === null) {
    engine.clearHighlight();
    currentLabel.textContent = 'sin país activo';
    return;
  }

  engine.setHighlight(selected.lat, selected.lon, 8, 1.5);
  currentLabel.textContent = selected.label;
});

manualBtn.addEventListener('click', () => {
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    alert('Introduce coordenadas válidas (latitud y longitud).');
    return;
  }
  engine.setHighlight(lat, lon, 6, 1.2);
  currentLabel.textContent = `Personalizado (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
  selector.value = '0';
});
