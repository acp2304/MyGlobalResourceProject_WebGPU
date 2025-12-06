import type { Engine } from '../engine';
import { handleRegionSelection, type RegionSelection } from '../regionSelection';
import type { UIElements } from './domRefs';
import { baseInfoHtml, populateCountrySelect, renderCountryInfo, setCurrentSelection, setInfoPanel } from './panels';

// Cablea la UI con el motor: listeners de select, inputs y hover en el canvas.
export function setupUI(engine: Engine, ui: UIElements): void {
  const countries = engine.getCountries();
  populateCountrySelect(ui.countrySelect, countries);
  setInfoPanel(ui.infoPanel, baseInfoHtml);

  ui.countrySelect.addEventListener('change', () => {
    const name = ui.countrySelect.value || null;
    const selected = engine.selectCountry(name);
    if (!selected) {
      engine.clearHighlight();
      setCurrentSelection(ui.currentSelectionLabel, 'sin pais activo');
      setInfoPanel(ui.infoPanel, baseInfoHtml);
      return;
    }
    engine.clearHighlight(); // contorno amarillo se pinta en GPU
    setCurrentSelection(ui.currentSelectionLabel, selected.name);
    setInfoPanel(ui.infoPanel, renderCountryInfo(selected));
  });

  ui.manualButton.addEventListener('click', () => {
    const lat = parseFloat(ui.latInput.value);
    const lon = parseFloat(ui.lonInput.value);
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
    setCurrentSelection(ui.currentSelectionLabel, selection.label);
    ui.countrySelect.value = '';
  });

  // Hover sobre el canvas: actualiza highlight preciso + panel de info.
  ui.canvas.addEventListener('pointermove', (event) => {
    if (event.buttons !== 0) return; // si se estケ arrastrando para orbitar, no hacer hover
    const hovered = engine.pickCountryAt(event.clientX, event.clientY);
    if (!hovered) {
      engine.setHoveredCountry(null);
      setInfoPanel(ui.infoPanel, baseInfoHtml);
      return;
    }
    engine.setHoveredCountry(hovered.name);
    setInfoPanel(ui.infoPanel, renderCountryInfo(hovered));
  });

  ui.canvas.addEventListener('pointerleave', () => {
    engine.setHoveredCountry(null);
    setInfoPanel(ui.infoPanel, baseInfoHtml);
  });
}
