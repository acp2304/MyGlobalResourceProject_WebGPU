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

// Grupo 3: texturas (color y mask) + selecciones
@group(3) @binding(0) var myTexture: texture_2d<f32>;
@group(3) @binding(1) var mySampler: sampler;

struct CountrySelection {
  hoveredId: u32,
  selectedId: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(3) @binding(2) var countryMask: texture_2d<f32>;
@group(3) @binding(3) var countryMaskSampler: sampler;
@group(3) @binding(4) var<uniform> selection: CountrySelection;

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

  let maskSample = textureSample(countryMask, countryMaskSampler, in.vUV);
  let maskId = u32(round(maskSample.r * 255.0))
             | (u32(round(maskSample.g * 255.0)) << 8u)
             | (u32(round(maskSample.b * 255.0)) << 16u);

  var countryMix = 0.0;
  var countryColor = vec3<f32>(0.0);
  if (maskId != 0u && maskId == selection.hoveredId) {
    countryMix = 0.5;
    countryColor = vec3<f32>(1.0, 0.9, 0.45);
  }
  if (maskId != 0u && maskId == selection.selectedId) {
    countryMix = 0.65;
    countryColor = vec3<f32>(1.0, 0.95, 0.55);
  }
  if (countryMix > 0.0) {
    color = mix(color, countryColor, countryMix) + 0.08 * countryMix;
  }

  color += highlight * vec3<f32>(1.0, 0.9, 0.4); // amarillo suave
  return vec4<f32>(color, 1.0);
}
