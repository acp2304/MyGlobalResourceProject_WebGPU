// common.vert.wgsl

struct VertexIn {
  @location(0) position: vec3<f32>,
  @location(1) normal:   vec3<f32>,
  @location(2) uv:       vec2<f32>,
};  // Cierra struct VertexIn

struct VSOut {
  @builtin(position) Position: vec4<f32>,
  @location(0) vNormal:      vec3<f32>,
  @location(1) vUV:          vec2<f32>,
  @location(2) vWorldPos:    vec3<f32>,
};  // Cierra struct VSOut

// Grupo 0: viewProj (binding 0) y cameraPos (binding 1)
@group(0) @binding(0) var<uniform> viewProj:   mat4x4<f32>;
@group(0) @binding(1) var<uniform> cameraPos:  vec4<f32>;

// Grupo 1: modelMatrix
@group(1) @binding(0) var<uniform> modelMatrix: mat4x4<f32>;

@vertex
fn vs_main(in: VertexIn) -> VSOut {
  var out: VSOut;
  let worldPos4 = modelMatrix * vec4<f32>(in.position, 1.0);
  out.Position  = viewProj * worldPos4;
  out.vWorldPos = worldPos4.xyz;
  out.vNormal   = (modelMatrix * vec4<f32>(in.normal, 0.0)).xyz;
  out.vUV       = in.uv;
  return out;
}