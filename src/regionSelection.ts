import type { Engine } from './engine';

export type RegionSelection = {
  label: string;
  lat: number | null;
  lon: number | null;
  radius?: number;
  intensity?: number;
};

export type RegionSelectionContext = {
  engine: Engine;
  selection: RegionSelection;
  source: 'preset' | 'manual';
};

type RegionSelectionHandler = (context: RegionSelectionContext) => void;

let handler: RegionSelectionHandler = ({ engine, selection }) => {
  if (selection.lat === null || selection.lon === null) {
    engine.clearHighlight();
    return;
  }

  const radius = selection.radius ?? 8;
  const intensity = selection.intensity ?? 1.5;
  engine.setHighlight(selection.lat, selection.lon, radius, intensity);
};

export function setRegionSelectionHandler(next: RegionSelectionHandler): void {
  handler = next;
}

export function handleRegionSelection(
  engine: Engine,
  selection: RegionSelection,
  source: RegionSelectionContext['source'] = 'preset'
): void {
  handler({ engine, selection, source });
}
