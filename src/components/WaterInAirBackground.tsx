import { useEffect, useRef } from 'react';

const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 vUv;

  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const physicsFragmentShaderSource = `
  precision highp float;

  uniform sampler2D samplePrev;
  uniform sampler2D sampleCurr;
  uniform vec2 uResolution;
  uniform vec3 uMouse;
  uniform vec3 uPrevMouse;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uRadius;
  uniform float uDamping;
  varying vec2 vUv;

  void main() {
    vec2 texel = 1.0 / uResolution;
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);

    float p10 = texture2D(sampleCurr, vUv + vec2(-texel.x, 0.0)).r;
    float p12 = texture2D(sampleCurr, vUv + vec2( texel.x, 0.0)).r;
    float p01 = texture2D(sampleCurr, vUv + vec2(0.0, -texel.y)).r;
    float p21 = texture2D(sampleCurr, vUv + vec2(0.0,  texel.y)).r;
    float p00 = texture2D(sampleCurr, vUv + vec2(-texel.x, -texel.y)).r;
    float p20 = texture2D(sampleCurr, vUv + vec2( texel.x, -texel.y)).r;
    float p02 = texture2D(sampleCurr, vUv + vec2(-texel.x,  texel.y)).r;
    float p22 = texture2D(sampleCurr, vUv + vec2( texel.x,  texel.y)).r;
    float prev = texture2D(samplePrev, vUv).r;

    float avg = (p10 + p12 + p01 + p21) * 0.2 + (p00 + p20 + p02 + p22) * 0.05;
    float val = avg * 2.0 - prev;

    float ampFactor = 1.0 - smoothstep(0.0, 0.08, abs(val)) * 0.006;
    val *= uDamping * ampFactor;

    float interaction = 0.0;
    float baseRadius = 0.038 * uRadius;
    if (uMouse.z > 0.5) {
      vec2 currUV = vec2(uMouse.x, 1.0 - uMouse.y);
      vec2 prevUV = (uPrevMouse.z > 0.5)
        ? vec2(uPrevMouse.x, 1.0 - uPrevMouse.y)
        : currUV;

      vec2 pa = (vUv - prevUV) * aspect;
      vec2 ba = (currUV - prevUV) * aspect;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
      float dist = length(pa - ba * h);

      float vel = length(ba) * uResolution.y;
      float force = 0.6 + clamp(vel * 0.012, 0.0, 1.2);
      interaction += smoothstep(baseRadius, 0.0, dist) * force;
    }
    val += clamp(interaction, 0.0, 2.0) * uIntensity * 0.7;

    gl_FragColor = vec4(val, 0.0, 0.0, 1.0);
  }
`;

const renderFragmentShaderSource = `
  precision highp float;

  uniform sampler2D uCamera;
  uniform sampler2D uPhysics;
  uniform vec2 uResolution;
  uniform vec2 uVideoScale;
  uniform float uMode;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uMirror;
  uniform float uQuality;
  varying vec2 vUv;

  #define cam(offset) texture2D(uCamera, vec2( \
    mix(camUv.x + (offset).x, 1.0 - (camUv.x + (offset).x), uMirror), \
    camUv.y + (offset).y))

  void main() {
    vec2 texel = 1.0 / uResolution;
    float isLiquid = 1.0 - step(0.1, abs(uMode - 0.0));
    float isCrystal = 1.0 - step(0.1, abs(uMode - 1.0));

    vec2 uv = vUv;
    float data = texture2D(uPhysics, uv).r;

    float tl = texture2D(uPhysics, uv + vec2(-texel.x, -texel.y)).r;
    float tc = texture2D(uPhysics, uv + vec2( 0.0,     -texel.y)).r;
    float tr = texture2D(uPhysics, uv + vec2( texel.x, -texel.y)).r;
    float cl = texture2D(uPhysics, uv + vec2(-texel.x,  0.0    )).r;
    float cr = texture2D(uPhysics, uv + vec2( texel.x,  0.0    )).r;
    float bl = texture2D(uPhysics, uv + vec2(-texel.x,  texel.y)).r;
    float bc = texture2D(uPhysics, uv + vec2( 0.0,      texel.y)).r;
    float br = texture2D(uPhysics, uv + vec2( texel.x,  texel.y)).r;

    float dx = (tr + 2.0 * cr + br) - (tl + 2.0 * cl + bl);
    float dy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
    vec2 grad = vec2(dx, dy) * 0.25;

    vec2 aspect = vec2(1.0, uResolution.x / uResolution.y);
    vec2 camUv = (uv - 0.5) * uVideoScale + 0.5;
    float gradLen = length(grad);
    float highQuality = step(0.72, uQuality);
    float mediumQuality = step(0.32, uQuality);

    vec3 color = vec3(0.0);

    if (isLiquid > 0.5) {
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 mainLight = normalize(vec3(0.4, 0.7, 1.0));

      float lap = (cl + cr + tc + bc) * 0.25 - data;

      float refractStr = 0.55 * uIntensity;
      vec2 refractOffset = grad * refractStr * aspect;

      float lensStr = 0.18 * uIntensity;
      vec2 gradDir = grad / max(gradLen, 0.001);
      vec2 lensOffset = gradDir * lap * lensStr * aspect;
      vec2 totalOffset = refractOffset + lensOffset;

      float dispersion = (0.008 + clamp(gradLen * 0.20, 0.0, 0.14)) * mix(0.45, 1.0, uQuality);
      vec2 rOff = totalOffset * (1.0 + dispersion);
      vec2 bOff = totalOffset * (1.0 - dispersion);

      float blur = gradLen * 1.2;
      vec3 refracted = vec3(
        cam(rOff).r,
        cam(totalOffset).g,
        cam(bOff).b
      );
      vec3 refractedBlur = vec3(
        (cam(rOff).r
          + cam(rOff + texel * blur).r
          + cam(rOff - texel * blur).r) / 3.0,
        (cam(totalOffset).g
          + cam(totalOffset + texel * blur).g
          + cam(totalOffset - texel * blur).g) / 3.0,
        (cam(bOff).b
          + cam(bOff + texel * blur).b
          + cam(bOff - texel * blur).b) / 3.0
      );
      color = mix(refracted, refractedBlur, highQuality);

      float depthDrive = data * 2.2;
      float brightness = 1.0 + clamp(depthDrive, -0.38, 0.45);
      color *= brightness;

      float valleyMask = clamp(-data * 12.0, 0.0, 1.0);
      color = mix(color, color * vec3(0.78, 0.90, 1.08), valleyMask * 0.55);
      float crestMask = clamp(data * 10.0, 0.0, 1.0);
      color = mix(color, color * vec3(1.06, 1.02, 0.94), crestMask * 0.40);

      vec3 normal = normalize(vec3(-grad.x, -grad.y, 0.8 / (uIntensity + 0.01)));
      float cosTheta = max(dot(normal, viewDir), 0.0);
      float fresnel = 0.02 + 0.98 * pow(1.0 - cosTheta, 5.0);

      vec2 reflUV = totalOffset * -1.6 * aspect;
      vec3 reflection = cam(reflUV).rgb;
      reflection = mix(reflection, reflection * vec3(0.88, 0.94, 1.0), 0.28);
      color = mix(color, reflection, fresnel * clamp(uIntensity * 0.5, 0.0, 0.75) * mix(0.45, 1.0, uQuality));

      vec3 halfVec = normalize(mainLight + viewDir);
      float NdotH = max(dot(normal, halfVec), 0.0);
      float specSharp = pow(NdotH, mix(70.0, 180.0, uQuality)) * 2.2;
      float specBroad = pow(NdotH, 28.0) * 0.35;
      color += vec3(specSharp + specBroad) * uIntensity * mix(0.75, 1.0, uQuality);

      float causticMask = smoothstep(0.04, 0.10, data) * smoothstep(0.01, 0.06, lap);
      color += vec3(1.0, 0.98, 0.92) * causticMask * uIntensity * 0.50 * mediumQuality;

      color *= mix(vec3(0.90, 0.95, 1.0), vec3(1.0), clamp(gradLen * 7.0, 0.0, 1.0));
    }

    if (isCrystal > 0.5) {
      float steps = 18.0;
      vec2 facetGrad = floor(grad * steps) / steps;
      vec2 offset = facetGrad * 0.32 * uIntensity * aspect;
      color = cam(offset).rgb;

      float edgeMask = smoothstep(0.02, 0.16, gradLen);
      if (mediumQuality > 0.5) {
        vec2 gradR = vec2(
          (texture2D(uPhysics, uv + vec2(texel.x, 0.0)).r
            - texture2D(uPhysics, uv - vec2(texel.x, 0.0)).r),
          (texture2D(uPhysics, uv + vec2(0.0, texel.y)).r
            - texture2D(uPhysics, uv - vec2(0.0, texel.y)).r)
        );
        float edgeH = length(floor(grad * steps) - floor(gradR * steps));
        edgeMask = clamp(edgeH, 0.0, 1.0);
      }

      vec3 edgeCol = vec3(0.75, 0.90, 1.0) * edgeMask * gradLen * uIntensity * 4.0;
      color += edgeCol;

      float facetBright = 0.5 + 0.5 * dot(normalize(vec3(facetGrad, 0.5)), normalize(vec3(0.3, 0.6, 1.0)));
      color *= mix(1.0, facetBright, gradLen * 3.0 * uIntensity);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const baseTexturePoints = [
  { x: 0.22, y: 0.18, radius: 0.58, color: 'rgba(74, 157, 255, 0.92)', speed: 0.34, phase: 0.3 },
  { x: 0.82, y: 0.24, radius: 0.48, color: 'rgba(255, 217, 94, 0.62)', speed: 0.27, phase: 1.7 },
  { x: 0.28, y: 0.78, radius: 0.54, color: 'rgba(64, 214, 165, 0.7)', speed: 0.31, phase: 3.1 },
  { x: 0.76, y: 0.78, radius: 0.52, color: 'rgba(255, 93, 126, 0.66)', speed: 0.23, phase: 4.5 },
];

function requireResource<T>(value: T | null, label: string): T {
  if (!value) {
    throw new Error(`Could not create WebGL ${label}.`);
  }

  return value;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = requireResource(gl.createShader(type), 'shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Unknown shader compile error.';
    gl.deleteShader(shader);
    throw new Error(log);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext, fragmentShaderSource: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = requireResource(gl.createProgram(), 'program');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Unknown program link error.';
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return program;
}

function createTexture(gl: WebGLRenderingContext, width: number, height: number) {
  const texture = requireResource(gl.createTexture(), 'texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

function createFramebuffer(gl: WebGLRenderingContext, texture: WebGLTexture) {
  const framebuffer = requireResource(gl.createFramebuffer(), 'framebuffer');
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Water background framebuffer is incomplete.');
  }

  return framebuffer;
}

function setTextureParameters(gl: WebGLRenderingContext, texture: WebGLTexture) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export default function WaterInAirBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!canvas || !gl) {
      return undefined;
    }

    let frameId = 0;
    let width = 1;
    let height = 1;
    let simWidth = 1;
    let simHeight = 1;

    let textureA: WebGLTexture | null = null;
    let textureB: WebGLTexture | null = null;
    let textureC: WebGLTexture | null = null;
    let framebufferA: WebGLFramebuffer | null = null;
    let framebufferB: WebGLFramebuffer | null = null;
    let framebufferC: WebGLFramebuffer | null = null;

    let pointerActive = false;
    let activePointerId: number | null = null;
    let pulseUntil = 0;
    let mouseX = 0.5;
    let mouseY = 0.5;
    const mouseUniform = new Float32Array([0.5, 0.5, 0.0]);
    const previousMouseUniform = new Float32Array([0.5, 0.5, 0.0]);
    const videoScale = new Float32Array([1.0, 1.0]);

    try {
      const physicsProgram = createProgram(gl, physicsFragmentShaderSource);
      const renderProgram = createProgram(gl, renderFragmentShaderSource);
      const quadBuffer = requireResource(gl.createBuffer(), 'buffer');
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

      const physicsPosition = gl.getAttribLocation(physicsProgram, 'position');
      const renderPosition = gl.getAttribLocation(renderProgram, 'position');
      const physicsLocations = {
        samplePrev: gl.getUniformLocation(physicsProgram, 'samplePrev'),
        sampleCurr: gl.getUniformLocation(physicsProgram, 'sampleCurr'),
        resolution: gl.getUniformLocation(physicsProgram, 'uResolution'),
        mouse: gl.getUniformLocation(physicsProgram, 'uMouse'),
        previousMouse: gl.getUniformLocation(physicsProgram, 'uPrevMouse'),
        time: gl.getUniformLocation(physicsProgram, 'uTime'),
        intensity: gl.getUniformLocation(physicsProgram, 'uIntensity'),
        radius: gl.getUniformLocation(physicsProgram, 'uRadius'),
        damping: gl.getUniformLocation(physicsProgram, 'uDamping'),
      };
      const renderLocations = {
        camera: gl.getUniformLocation(renderProgram, 'uCamera'),
        physics: gl.getUniformLocation(renderProgram, 'uPhysics'),
        resolution: gl.getUniformLocation(renderProgram, 'uResolution'),
        videoScale: gl.getUniformLocation(renderProgram, 'uVideoScale'),
        mode: gl.getUniformLocation(renderProgram, 'uMode'),
        time: gl.getUniformLocation(renderProgram, 'uTime'),
        intensity: gl.getUniformLocation(renderProgram, 'uIntensity'),
        mirror: gl.getUniformLocation(renderProgram, 'uMirror'),
        quality: gl.getUniformLocation(renderProgram, 'uQuality'),
      };

      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = 640;
      sourceCanvas.height = 640;
      const sourceContext = requireResource(sourceCanvas.getContext('2d'), 'canvas texture context');
      const sourceTexture = requireResource(gl.createTexture(), 'source texture');
      setTextureParameters(gl, sourceTexture);

      const drawSourceTexture = (time: number) => {
        const size = sourceCanvas.width;
        const seconds = time * 0.001;
        sourceContext.globalCompositeOperation = 'source-over';
        sourceContext.fillStyle = '#020408';
        sourceContext.fillRect(0, 0, size, size);

        const baseGradient = sourceContext.createLinearGradient(0, 0, size, size);
        baseGradient.addColorStop(0, '#071521');
        baseGradient.addColorStop(0.42, '#0b1515');
        baseGradient.addColorStop(0.72, '#18101a');
        baseGradient.addColorStop(1, '#050509');
        sourceContext.fillStyle = baseGradient;
        sourceContext.fillRect(0, 0, size, size);

        sourceContext.globalCompositeOperation = 'screen';
        baseTexturePoints.forEach((point) => {
          const driftX = Math.sin(seconds * point.speed + point.phase) * 0.055;
          const driftY = Math.cos(seconds * point.speed * 0.8 + point.phase) * 0.05;
          const centerX = (point.x + driftX) * size;
          const centerY = (point.y + driftY) * size;
          const radius = point.radius * size;
          const gradient = sourceContext.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
          gradient.addColorStop(0, point.color);
          gradient.addColorStop(0.46, point.color.replace(/, [\d.]+\)$/, ', 0.18)'));
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          sourceContext.fillStyle = gradient;
          sourceContext.fillRect(0, 0, size, size);
        });

        sourceContext.globalCompositeOperation = 'overlay';
        for (let i = 0; i < 16; i += 1) {
          const y = ((i * 47 + seconds * 12) % size) - 24;
          const lineGradient = sourceContext.createLinearGradient(0, y, size, y + 68);
          lineGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
          lineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.045)');
          lineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          sourceContext.fillStyle = lineGradient;
          sourceContext.fillRect(0, y, size, 68);
        }

        sourceContext.globalCompositeOperation = 'source-over';
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      };

      const deleteRenderTargets = () => {
        if (textureA) gl.deleteTexture(textureA);
        if (textureB) gl.deleteTexture(textureB);
        if (textureC) gl.deleteTexture(textureC);
        if (framebufferA) gl.deleteFramebuffer(framebufferA);
        if (framebufferB) gl.deleteFramebuffer(framebufferB);
        if (framebufferC) gl.deleteFramebuffer(framebufferC);
        textureA = null;
        textureB = null;
        textureC = null;
        framebufferA = null;
        framebufferB = null;
        framebufferC = null;
      };

      const getQualityUniformValue = () => {
        const pixelCount = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio || 1, 1.7);
        if (pixelCount > 3_000_000) return 0.45;
        if (pixelCount > 1_600_000) return 0.7;
        return 1.0;
      };

      const getSimulationScale = () => {
        const pixelCount = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio || 1, 1.7);
        if (pixelCount > 3_000_000) return 0.33;
        if (pixelCount > 1_600_000) return 0.4;
        return 0.5;
      };

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.7);
        width = Math.max(1, Math.floor(window.innerWidth * dpr));
        height = Math.max(1, Math.floor(window.innerHeight * dpr));
        canvas.width = width;
        canvas.height = height;

        const simulationScale = getSimulationScale();
        simWidth = Math.max(1, Math.floor(width * simulationScale));
        simHeight = Math.max(1, Math.floor(height * simulationScale));

        deleteRenderTargets();
        textureA = createTexture(gl, simWidth, simHeight);
        framebufferA = createFramebuffer(gl, textureA);
        textureB = createTexture(gl, simWidth, simHeight);
        framebufferB = createFramebuffer(gl, textureB);
        textureC = createTexture(gl, simWidth, simHeight);
        framebufferC = createFramebuffer(gl, textureC);
      };

      const swapFramebuffers = () => {
        const nextFramebuffer = framebufferA;
        framebufferA = framebufferB;
        framebufferB = framebufferC;
        framebufferC = nextFramebuffer;

        const nextTexture = textureA;
        textureA = textureB;
        textureB = textureC;
        textureC = nextTexture;
      };

      const updatePointerPosition = (event: PointerEvent) => {
        mouseX = Math.min(1, Math.max(0, event.clientX / Math.max(window.innerWidth, 1)));
        mouseY = Math.min(1, Math.max(0, event.clientY / Math.max(window.innerHeight, 1)));
        pulseUntil = performance.now() + 140;
      };

      const handlePointerDown = (event: PointerEvent) => {
        pointerActive = true;
        activePointerId = event.pointerId;
        updatePointerPosition(event);
        previousMouseUniform[0] = mouseX;
        previousMouseUniform[1] = mouseY;
        previousMouseUniform[2] = 0.0;
      };

      const handlePointerMove = (event: PointerEvent) => {
        if (activePointerId === event.pointerId || pointerActive) {
          updatePointerPosition(event);
        }
      };

      const handlePointerUp = (event: PointerEvent) => {
        if (activePointerId !== null && activePointerId !== event.pointerId) {
          return;
        }

        updatePointerPosition(event);
        pointerActive = false;
        activePointerId = null;
      };

      const bindQuad = (positionLocation: number) => {
        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      };

      const render = (time: number) => {
        if (!textureA || !textureB || !textureC || !framebufferC) {
          frameId = requestAnimationFrame(render);
          return;
        }

        drawSourceTexture(time);

        const isPointerLive = pointerActive || time < pulseUntil;
        if (isPointerLive) {
          mouseUniform[0] = mouseX;
          mouseUniform[1] = mouseY;
          mouseUniform[2] = 1.0;
        } else {
          mouseUniform[2] = 0.0;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferC);
        gl.viewport(0, 0, simWidth, simHeight);
        gl.useProgram(physicsProgram);
        bindQuad(physicsPosition);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureA);
        gl.uniform1i(physicsLocations.samplePrev, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textureB);
        gl.uniform1i(physicsLocations.sampleCurr, 1);

        gl.uniform2f(physicsLocations.resolution, simWidth, simHeight);
        gl.uniform3fv(physicsLocations.mouse, mouseUniform);
        gl.uniform3fv(physicsLocations.previousMouse, previousMouseUniform);
        gl.uniform1f(physicsLocations.time, time * 0.001);
        gl.uniform1f(physicsLocations.intensity, 1.28);
        gl.uniform1f(physicsLocations.radius, 1.15);
        gl.uniform1f(physicsLocations.damping, 0.99);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        previousMouseUniform[0] = mouseX;
        previousMouseUniform[1] = mouseY;
        previousMouseUniform[2] = isPointerLive ? 1.0 : 0.0;

        swapFramebuffers();

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        gl.useProgram(renderProgram);
        bindQuad(renderPosition);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.uniform1i(renderLocations.camera, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textureB);
        gl.uniform1i(renderLocations.physics, 1);

        gl.uniform2f(renderLocations.resolution, width, height);
        gl.uniform2fv(renderLocations.videoScale, videoScale);
        gl.uniform1f(renderLocations.mode, 0.0);
        gl.uniform1f(renderLocations.time, time * 0.001);
        gl.uniform1f(renderLocations.intensity, 1.28);
        gl.uniform1f(renderLocations.mirror, 0.0);
        gl.uniform1f(renderLocations.quality, getQualityUniformValue());
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        frameId = requestAnimationFrame(render);
      };

      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('pointerdown', handlePointerDown, { passive: true });
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerup', handlePointerUp, { passive: true });
      window.addEventListener('pointercancel', handlePointerUp, { passive: true });
      frameId = requestAnimationFrame(render);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        deleteRenderTargets();
        gl.deleteTexture(sourceTexture);
        gl.deleteBuffer(quadBuffer);
        gl.deleteProgram(physicsProgram);
        gl.deleteProgram(renderProgram);
      };
    } catch (error) {
      console.error('Water-in-air background failed to initialize.', error);
      return undefined;
    }
  }, []);

  return (
    <div className="water-in-air-background" aria-hidden="true">
      <canvas ref={canvasRef} className="water-in-air-canvas" />
    </div>
  );
}
