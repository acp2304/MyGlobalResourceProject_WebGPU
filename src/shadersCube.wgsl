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

// Grupo 2, binding 0: Luz direccional + intensidad (x,y,z = dirección, w = intensidad)
@group(2) @binding(0)
var<uniform> light : vec4<f32>;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) vColor : vec3<f32>,
  @location(1) vNormal: vec3<f32>
};

@vertex
fn vs_main(@location(0) position: vec3<f32>, @location(1) color: vec3<f32>, @location(2) normal:vec3<f32>) -> VertexOutput {
  var output : VertexOutput;
  let worldPos = model * vec4<f32>(position, 1.0);
  output.Position = vp * worldPos;
  output.vColor = color;
  output.vNormal = normal;
  return output;
}

@fragment
fn fs_main(@location(0) vColor: vec3<f32>,@location(1) vNormal:vec3<f32>) -> @location(0) vec4<f32> {
  let ambientStrength: f32 = 0.1;
  // Normal y dirección de luz normalizadas
  let N = normalize(vNormal);
  let L = normalize(light.xyz);

  // Componente difusa (Lambert)
  let diff = max(dot(N, L), 0.0);
  let diffuse = diff * vColor;

  // Color final: ambient + diffuse*intensidad
  let ambient = ambientStrength * vColor;
  let litColor = ambient + diffuse * light.w;

  return vec4(litColor, 1.0);
}
  //return vec4<f32>(vColor, 1.0);
