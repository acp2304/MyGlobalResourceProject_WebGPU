export const shaderCode = `
  struct Uniforms {
    mvpMatrix : mat4x4<f32>
  };
  @binding(0) @group(0) var<uniform> uniforms : Uniforms;

  struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) vColor : vec3<f32>
  };

  @vertex
  fn vs_main(@location(0) position: vec3<f32>, @location(1) color: vec3<f32>) -> VertexOutput {
    var output : VertexOutput;
    output.Position = uniforms.mvpMatrix * vec4<f32>(position, 1.0);
    output.vColor = color;
    return output;
  }

  @fragment
  fn fs_main(@location(0) vColor: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(vColor, 1.0);
  }
`;