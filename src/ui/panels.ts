import type { CountryOutline } from '../countryLoader';

// Texto base reutilizado cuando no hay paヴs activo en panel de info.
export const baseInfoHtml = '<p>Selecciona o pasa el ratón por un país para ver sus datos del TopoJSON.</p>';

// Rellena el selector de paヴses con la lista cargada por el motor (Engine.getCountries()).
export function populateCountrySelect(
  select: HTMLSelectElement,
  countries: CountryOutline[]
): void {
  select.innerHTML = '';
  const noneOption = document.createElement('option');
  noneOption.value = '';
  noneOption.textContent = 'Sin seleccion';
  select.appendChild(noneOption);

  countries.forEach((country) => {
    const option = document.createElement('option');
    option.value = country.name;
    option.textContent = country.name;
    select.appendChild(option);
  });
  select.value = '';
}

// Renderiza datos del TopoJSON de un paヴs en HTML simple.
export function renderCountryInfo(country: CountryOutline): string {
  return `
    <h3>${country.name}</h3>
    <pre>${JSON.stringify(country.properties, null, 2)}</pre>
  `;
}

export function setInfoPanel(panel: HTMLDivElement, html: string): void {
  panel.innerHTML = html;
}

export function setCurrentSelection(label: HTMLSpanElement, text: string): void {
  label.textContent = text;
}
