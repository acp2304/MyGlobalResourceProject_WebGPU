// src/shadersCube.wgsl
struct Uniforms {
  mvpMatrix : mat4x4<f32>
};
// Grupo 0, binding 0: View-Projection
@group(0) @binding(0)
var<uniform> vp : mat4x4<f32>;

// Grupo 1, binding 0: Model
@group(1) @binding(0)
var<uniform> model : mat4x4<f32>;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) vColor : vec3<f32>
};

@vertex
fn vs_main(@location(0) position: vec3<f32>, @location(1) color: vec3<f32>) -> VertexOutput {
  var output : VertexOutput;
  let worldPos = model * vec4<f32>(position, 1.0);
  output.Position = vp * worldPos;
  output.vColor = color;
  return output;
}

@fragment
fn fs_main(@location(0) vColor: vec3<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(vColor, 1.0);
}
