// shaders/textured.frag.wgsl - Iluminación básica con realce de selección
struct VSOut {
  @location(0) vNormal:   vec3<f32>,
  @location(1) vUV:       vec2<f32>,
  @location(2) vWorldPos: vec3<f32>,
  @builtin(position) Position: vec4<f32>,
};

// Grupo 0: cámara
@group(0) @binding(1) var<uniform> cameraPos: vec4<f32>;

// Grupo 2: luz + selección
struct LightingData {
  lightDirIntensity: vec4<f32>;   // xyz: dirección de la luz, w: intensidad
  highlightDirPower: vec4<f32>;   // xyz: dirección del realce, w: intensidad (0 = apagado)
  highlightParams:   vec4<f32>;   // x: cosInterior, y: cosExterior, z/w: reservados
};
@group(2) @binding(0) var<uniform> lighting: LightingData;

// Grupo 3: textura
@group(3) @binding(0) var myTexture: texture_2d<f32>;
@group(3) @binding(1) var mySampler: sampler;

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let albedo = textureSample(myTexture, mySampler, in.vUV).rgb;

  // Iluminación difusa + especular sencilla
  let N = normalize(in.vNormal);
  let L = normalize(-lighting.lightDirIntensity.xyz);
  let V = normalize(cameraPos.xyz - in.vWorldPos);
  let R = reflect(-L, N);

  let ambient  = 0.25 * lighting.lightDirIntensity.w;
  let diff     = max(dot(N, L), 0.0) * lighting.lightDirIntensity.w;
  let spec     = pow(max(dot(R, V), 0.0), 64.0) * 0.1 * lighting.lightDirIntensity.w;
  let litColor = (ambient + diff + spec) * albedo;

  // Resaltado de país
  var highlightMask = 0.0;
  if (lighting.highlightDirPower.w > 0.0) {
    let highlightDir = normalize(lighting.highlightDirPower.xyz);
    let alignment = dot(N, highlightDir);
    highlightMask = smoothstep(lighting.highlightParams.y, lighting.highlightParams.x, alignment) * lighting.highlightDirPower.w;
  }

  let highlightColor = mix(litColor, vec3<f32>(1.0, 0.55, 0.2), 0.65);
  let finalColor = mix(litColor, highlightColor, highlightMask);

  return vec4<f32>(finalColor, 1.0);
}
