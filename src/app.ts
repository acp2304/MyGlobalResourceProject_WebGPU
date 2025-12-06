import './styles.css';
import { Engine } from './engine';
import { getUIElements } from './ui/domRefs';
import { setupUI } from './ui/interactions';

// Punto de entrada de la app: inicia el motor grБfico y cablea la UI.
async function bootstrap(): Promise<void> {
  const ui = getUIElements();
  const engine = new Engine(ui.canvas);
  await engine.init();
  engine.start();

  setupUI(engine, ui);
}

bootstrap().catch((err) => {
  console.error('Error inicializando la app', err);
});
