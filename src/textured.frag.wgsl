// shaders/textured.frag.wgsl
struct VSOut {
  @location(0) vNormal:   vec3<f32>,
  @location(1) vUV:       vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
  @builtin(position) Position: vec4<f32>,
};
//@group(0) @binding(0) var<uniform> viewProj: mat4x4<f32>;
@group(0) @binding(1) var<uniform> cameraPos: vec4<f32>;

//@group(1) @binding(0) var<uniform> modelMatrix: mat4x4<f32>;

struct LightData {
  lightDirIntensity: vec4<f32>,
};

@group(2) @binding(0) var<uniform> lightData: LightData;

@group(3) @binding(0) var myTexture: texture_2d<f32>;
@group(3) @binding(1) var mySampler: sampler;

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let albedo = textureSample(myTexture, mySampler, in.vUV).rgb;
  let N = normalize(in.vNormal);
  let L = normalize(-lightData.lightDirIntensity.xyz);
  let V = normalize(cameraPos.xyz - in.vWorldPos);
  let R = reflect(-L, N);
  let ambient  = 0.25 * lightData.lightDirIntensity.www;
  let diff     = max(dot(N, L), 0.0) * lightData.lightDirIntensity.www;
  let spec     = pow(max(dot(R, V), 0.0), 64.0) * 0.1 * lightData.lightDirIntensity.www;
  let color    = (ambient + diff + spec) * albedo;
  return vec4<f32>(color, 1.0);
}
