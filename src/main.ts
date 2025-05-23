import { Engine } from './engine';

const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
const engine = new Engine(canvas);

await engine.init();
engine.start();

