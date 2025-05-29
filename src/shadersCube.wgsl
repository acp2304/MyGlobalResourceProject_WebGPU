// src/shadersCube.wgsl
struct Uniforms {
  mvpMatrix : mat4x4<f32>
};

// Grupo 0: Cámara (View-Projection + posición)
@group(0) @binding(0)
var<uniform> vp : mat4x4<f32>;

@group(0) @binding(1)
var<uniform> cameraPos: vec4<f32>;

// Grupo 1: Model matrix
@group(1) @binding(0)
var<uniform> model : mat4x4<f32>;

// Grupo 2: Luz direccional + intensidad (x,y,z = dirección, w = intensidad)
@group(2) @binding(0)
var<uniform> light : vec4<f32>;

// ❌ REMOVIDO: @group(3) ya no se usa en el shader simple

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) vColor : vec3<f32>,
  @location(1) vNormal: vec3<f32>,
  @location(2) worldPos: vec3<f32>
};

@vertex
fn vs_main(@location(0) position: vec3<f32>, @location(1) color: vec3<f32>, @location(2) normal:vec3<f32>) -> VertexOutput {
  var output : VertexOutput;
  let worldPos = model * vec4<f32>(position, 1.0);
  output.Position = vp * worldPos;
  output.vColor = color;
  //Aqui rotamos las normales para que la iluminacion aplique correctamente ya que dependen de estas
  output.vNormal = normalize((model * vec4<f32>(normal, 0.0)).xyz);
  output.worldPos = worldPos.xyz;
  return output;
}

//Esto sirve para normalizar el color si se pase de rango, con uint8 tenemos que declarar el color entre el rango 0,1
fn toneMap_Reinhard(color: vec3<f32>) -> vec3<f32> {
    return color / (color + vec3(1.0));
}

@fragment
fn fs_main(@location(0) vColor: vec3<f32>,@location(1) vNormal:vec3<f32>,@location(2) worldPos:vec3<f32>) -> @location(0) vec4<f32> {
  let ambientStrength: f32 = 1;

  // 1) Diffuse (Lambert)
  let N   = normalize(vNormal);
  let L   = normalize(light.xyz);
  //El dot product entre dos vectores normalizados te da el coseno del ángulo entre ellos,
  //y ese coseno es el valor escalar de la proyección de uno sobre otro.
  //El dot product mide cuánto dos vectores colabora
  let diff = max(dot(N, L), 0.0);
  let diffuse  = diff * vColor * light.w;

  // 2) Ambient
  let ambient  = ambientStrength * vColor;

  // 3) Specular (Phong)
  //Este es el vector direccion
  //Para saber la direccion que estoy calculando es: Punto final - Punto inicial
  let V = normalize(cameraPos.xyz - worldPos);

  // Calcula el vector reflejado ideal de la luz sobre la normal (R).
  // Si el vector de vista V se alinea con R, se genera el punto de máximo brillo especular.
  let R         = reflect(-L, N);

  let specPower : f32     = 5;
  //Aqui lo mismo que con Lambert, miramos como de coincidentes son los rayos, La potencia es para reducir los numero des escalar que estara entre [0,1] ya que el vector R y V estan normalizados
  //Contra mas alto sea el power mas pequeños se haran los numeros de forma exponencial. Por lo que un spec muy alto llevara los numero casi a 0, solo respetando los completamente incidentes,
  //reflexion casi perfecta de materiales por ejemplo metalicos. Contra mas bajo sera mas difuso. 
  let specular = pow(max(dot(R, V), 0.0), specPower) * light.w * 3.0;
  //Aqui simplemente escalamos un vector 1.0,1.0,1.0 con luz blanca para ver la potencia
  let specColor = vec3<f32>(1.0) * specular;

  // 4) Combinar
  let litColor  = ambient + diffuse + specColor;
  // Aplicamos tone mapping para evitar saturación y comprimir colores al rango [0, 1]
  let normalizedColor = toneMap_Reinhard(litColor);
  return vec4<f32>(normalizedColor, 1.0);
}