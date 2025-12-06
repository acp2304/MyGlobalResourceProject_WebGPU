@group(0) @binding(0) var<uniform> viewProj: mat4x4<f32>;

// Vertex simple: devuelve directamente la posición en clip-space
@vertex
fn vs_main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
  return viewProj * vec4<f32>(position, 1.0);
}
