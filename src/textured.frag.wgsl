// shaders/textured.frag.wgsl - Iluminación básica con realce de selección
struct VSOut {
  @location(0) vNormal:   vec3<f32>,
  @location(1) vUV:       vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
  @builtin(position) Position: vec4<f32>,
};

// Grupo 0: cámara
@group(0) @binding(1) var<uniform> cameraPos: vec4<f32>;

struct LightData {
  lightDirIntensity: vec4<f32>,
  highlightDirPower: vec4<f32>,
  highlightParams: vec4<f32>,
};

@group(2) @binding(0) var<uniform> lightData: LightData;

// Grupo 3: textura
@group(3) @binding(0) var myTexture: texture_2d<f32>;
@group(3) @binding(1) var mySampler: sampler;

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let albedo = textureSample(myTexture, mySampler, in.vUV).rgb;

  // Luz base uniforme en toda la esfera
  let baseIntensity = max(lightData.lightDirIntensity.w, 0.0);
  var color = albedo * baseIntensity;

  // Realce de highlight suave alrededor del centroide del país
  let hDir = normalize(lightData.highlightDirPower.xyz);
  let hStrength = lightData.highlightDirPower.w;
  let inner = lightData.highlightParams.x;
  let outer = lightData.highlightParams.y;

  // Dot entre dirección highlight y normal de fragmento
  let n = normalize(in.vNormal);
  let dotHN = dot(hDir, n);
  let spot = smoothstep(outer, inner, dotHN); // 0..1
  let highlight = hStrength * spot;

  color += highlight * vec3<f32>(1.0, 0.9, 0.4); // amarillo suave
  return vec4<f32>(color, 1.0);
}
