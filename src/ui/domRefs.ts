// DOM bindings centralizados. Se usa desde setupUI/app para desacoplar el motor WebGPU de la UI.
export type UIElements = {
  canvas: HTMLCanvasElement;
  countrySelect: HTMLSelectElement;
  latInput: HTMLInputElement;
  lonInput: HTMLInputElement;
  manualButton: HTMLButtonElement;
  currentSelectionLabel: HTMLSpanElement;
  infoPanel: HTMLDivElement;
};

export function getUIElements(): UIElements {
  const canvas = document.getElementById('gpu-canvas');
  const countrySelect = document.getElementById('country-select');
  const latInput = document.getElementById('lat-input');
  const lonInput = document.getElementById('lon-input');
  const manualButton = document.getElementById('select-coordinates');
  const currentSelectionLabel = document.getElementById('current-selection');
  const infoPanel = document.getElementById('country-info');

  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas #gpu-canvas no encontrado');
  if (!(countrySelect instanceof HTMLSelectElement)) throw new Error('select #country-select no encontrado');
  if (!(latInput instanceof HTMLInputElement)) throw new Error('input #lat-input no encontrado');
  if (!(lonInput instanceof HTMLInputElement)) throw new Error('input #lon-input no encontrado');
  if (!(manualButton instanceof HTMLButtonElement)) throw new Error('boton #select-coordinates no encontrado');
  if (!(currentSelectionLabel instanceof HTMLSpanElement)) throw new Error('span #current-selection no encontrado');
  if (!(infoPanel instanceof HTMLDivElement)) throw new Error('div #country-info no encontrado');

  return {
    canvas,
    countrySelect,
    latInput,
    lonInput,
    manualButton,
    currentSelectionLabel,
    infoPanel,
  };
}
