import { Engine } from './engine';
import { handleRegionSelection, type RegionSelection } from './regionSelection';

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
  const engine = new Engine(canvas);
  await engine.init();
  engine.start();

  const selector = document.getElementById('country-select') as HTMLSelectElement;
  const latInput = document.getElementById('lat-input') as HTMLInputElement;
  const lonInput = document.getElementById('lon-input') as HTMLInputElement;
  const manualBtn = document.getElementById('select-coordinates') as HTMLButtonElement;
  const currentLabel = document.getElementById('current-selection') as HTMLSpanElement;
  const infoPanel = document.getElementById('country-info') as HTMLDivElement;
  const baseInfoText = '<p>Selecciona o pasa el ratИn por un paヴs para ver sus datos del TopoJSON.</p>';
  infoPanel.innerHTML = baseInfoText;

  // Poblado dinケmico de paヴses desde el TopoJSON (vヴa engine)
  const countries = engine.getCountries();
  selector.innerHTML = '';
  const noneOption = document.createElement('option');
  noneOption.value = '';
  noneOption.textContent = 'Sin seleccion';
  selector.appendChild(noneOption);

  countries.forEach((country) => {
    const option = document.createElement('option');
    option.value = country.name;
    option.textContent = country.name;
    selector.appendChild(option);
  });
  selector.value = '';

  selector.addEventListener('change', () => {
    const name = selector.value || null;
    const selected = engine.selectCountry(name);
    if (!selected) {
      engine.clearHighlight();
      currentLabel.textContent = 'sin pais activo';
      infoPanel.innerHTML = baseInfoText;
      return;
    }

    engine.clearHighlight(); // el contorno se pinta con el mask preciso en GPU
    currentLabel.textContent = selected.name;
    infoPanel.innerHTML = `
      <h3>${selected.name}</h3>
      <pre>${JSON.stringify(selected.properties, null, 2)}</pre>
    `;
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
    selector.value = '';
  });

  // Hover sobre el canvas: actualizar info + highlight suave
  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons !== 0) return; // si se estケ arrastrando para orbitar, no hacer hover
    const hovered = engine.pickCountryAt(event.clientX, event.clientY);
    if (!hovered) {
      engine.setHoveredCountry(null);
      infoPanel.innerHTML = baseInfoText;
      return;
    }
    engine.setHoveredCountry(hovered.name);
    infoPanel.innerHTML = `
      <h3>${hovered.name}</h3>
      <pre>${JSON.stringify(hovered.properties, null, 2)}</pre>
    `;
  });

  canvas.addEventListener('pointerleave', () => {
    engine.setHoveredCountry(null);
    infoPanel.innerHTML = baseInfoText;
  });
}

bootstrap().catch((err) => {
  console.error('Error inicializando la app', err);
});
