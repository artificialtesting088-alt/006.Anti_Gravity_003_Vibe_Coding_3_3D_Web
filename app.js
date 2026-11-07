/**
 * AETHERIA // Spatial Design & Creative Engineering Laboratory
 * High-Performance WebGL Engine, Custom Shaders & Dynamic Sound Synthesis
 */

(() => {
  'use strict';

  // --- Engine State ---
  const state = {
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0, velX: 0, velY: 0 },
    geometryType: 'knot', // 'knot', 'sphere', 'torus', 'icosa'
    shaderMode: 'prismatic',
    turbulence: 1.2,
    audioActive: false,
    particleDensity: 'hyper',
    isWarping: false
  };

  // --- Real-time Clock ---
  function updateClock() {
    const el = document.getElementById('utc-clock');
    if (el) {
      const now = new Date();
      el.textContent = `UTC ${now.toUTCString().split(' ')[4]}`;
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --- Web Audio Polyphonic Ambient Synthesizer ---
  let audioCtx = null;
  let masterGain = null;
  let padOsc1 = null;
  let padOsc2 = null;
  let padOsc3 = null;
  let filterNode = null;

  function initSpatialAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.045, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      filterNode = audioCtx.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(450, audioCtx.currentTime);
      filterNode.connect(masterGain);

      // 3 Harmonic Oscillators creating an atmospheric chord (D minor / celestial 5th)
      padOsc1 = audioCtx.createOscillator();
      padOsc1.type = 'sine';
      padOsc1.frequency.setValueAtTime(73.42, audioCtx.currentTime); // D2

      padOsc2 = audioCtx.createOscillator();
      padOsc2.type = 'triangle';
      padOsc2.frequency.setValueAtTime(110.0, audioCtx.currentTime); // A2

      padOsc3 = audioCtx.createOscillator();
      padOsc3.type = 'sine';
      padOsc3.frequency.setValueAtTime(146.83, audioCtx.currentTime); // D3

      padOsc1.connect(filterNode);
      padOsc2.connect(filterNode);
      padOsc3.connect(filterNode);

      padOsc1.start();
      padOsc2.start();
      padOsc3.start();
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  }

  function triggerChime(freq = 587.33, duration = 1.4) {
    if (!audioCtx || !state.audioActive) return;
    const osc = audioCtx.createOscillator();
    const chimeGain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    chimeGain.gain.setValueAtTime(0.09, audioCtx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(chimeGain);
    chimeGain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  // --- Three.js WebGL Scene Architecture ---
  const container = document.getElementById('canvas-container');
  const scene = new THREE.Scene();
  
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 7.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);

  // --- Dynamic Volumetric Lighting ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const keyLight = new THREE.PointLight(0x38bdf8, 3.5, 25);
  keyLight.position.set(6, 5, 5);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0xc084fc, 3.0, 25);
  fillLight.position.set(-6, -4, 4);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xf472b6, 2.5, 20);
  rimLight.position.set(0, 6, -5);
  scene.add(rimLight);

  // --- Procedural Simplex Noise Vertex & Fragment Shader ---
  const vertexShader = `
    uniform float uTime;
    uniform float uDistort;
    uniform vec2 uMouse;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vDisplacement;

    // Simplex Noise 3D Implementation
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      vec3 coords = normal * 1.8 + vec3(uTime * 0.4);
      float noise = snoise(coords);
      
      float mouseInfluence = sin(dot(normal.xy, uMouse) * 3.14159) * 0.22;
      float displacement = (noise * 0.38 + mouseInfluence) * uDistort;
      vDisplacement = displacement;
      
      vec3 newPos = position + normal * displacement;
      vPosition = newPos;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform int uMode; // 0: Prismatic, 1: Celestial Glass, 2: Cybernetic, 3: Vortex
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vDisplacement;

    vec3 palette(float t) {
      vec3 a = vec3(0.5, 0.5, 0.5);
      vec3 b = vec3(0.5, 0.5, 0.5);
      vec3 c = vec3(1.0, 1.0, 1.0);
      vec3 d = vec3(0.05, 0.33, 0.67);
      return a + b * cos(6.28318 * (c * t + d));
    }

    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = dot(viewDir, vNormal);
      fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
      fresnel = pow(fresnel, 2.4);

      if (uMode == 0) {
        // Prismatic Core
        float seed = fresnel * 1.2 + vDisplacement * 0.9 + uTime * 0.18;
        vec3 spectral = palette(seed);
        vec3 base = vec3(0.04, 0.04, 0.08);
        vec3 col = mix(base, spectral, fresnel * 1.4 + 0.1);
        col += vec3(0.6, 0.9, 1.0) * pow(fresnel, 4.5);
        gl_FragColor = vec4(col, 0.94);

      } else if (uMode == 1) {
        // Celestial Glass
        vec3 glass = vec3(0.06, 0.09, 0.14);
        glass += vec3(0.2, 0.7, 1.0) * pow(fresnel, 2.2);
        glass += vec3(0.9, 0.4, 0.8) * pow(fresnel, 4.8);
        gl_FragColor = vec4(glass, 0.7);

      } else if (uMode == 2) {
        // Cybernetic Lattice
        float grid = abs(sin(vUv.x * 80.0)) * abs(sin(vUv.y * 80.0));
        vec3 cyber = mix(vec3(0.05, 0.05, 0.09), vec3(0.2, 0.8, 1.0), pow(grid, 0.12));
        cyber += vec3(0.9, 0.3, 1.0) * fresnel;
        gl_FragColor = vec4(cyber, 0.88);

      } else {
        // Vortex Singularity
        float pulse = sin(uTime * 3.0 + length(vPosition) * 4.0);
        vec3 vortexCol = mix(vec3(0.7, 0.2, 1.0), vec3(0.1, 0.9, 0.8), fresnel);
        vortexCol += vec3(1.0, 0.5, 0.2) * pow(fresnel, 3.5) * (0.8 + 0.2 * pulse);
        gl_FragColor = vec4(vortexCol, 0.92);
      }
    }
  `;

  const shaderUniforms = {
    uTime: { value: 0 },
    uDistort: { value: 1.2 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMode: { value: 0 }
  };

  const coreMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: shaderUniforms,
    transparent: true,
    wireframe: false
  });

  // --- Dynamic Morphing Geometries ---
  const geometries = {
    knot: new THREE.TorusKnotGeometry(1.6, 0.5, 128, 32, 2, 3),
    sphere: new THREE.IcosahedronGeometry(2.1, 64),
    torus: new THREE.TorusGeometry(1.8, 0.65, 32, 100),
    icosa: new THREE.IcosahedronGeometry(2.3, 16)
  };

  const coreMesh = new THREE.Mesh(geometries.knot, coreMaterial);
  scene.add(coreMesh);

  // --- Concentric Orbital Rings ---
  const ringGroup = new THREE.Group();
  scene.add(ringGroup);

  const ringGeo1 = new THREE.TorusGeometry(3.1, 0.02, 16, 120);
  const ringMat1 = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.35,
    wireframe: true
  });
  const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
  ring1.rotation.x = Math.PI * 0.35;
  ringGroup.add(ring1);

  const ringGeo2 = new THREE.TorusGeometry(3.6, 0.015, 16, 120);
  const ringMat2 = new THREE.MeshBasicMaterial({
    color: 0xc084fc,
    transparent: true,
    opacity: 0.25,
    wireframe: true
  });
  const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
  ring2.rotation.y = Math.PI * 0.4;
  ringGroup.add(ring2);

  // --- Gravitational Cosmic Particle Vortex ---
  const particleCount = 4000;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const originalPositions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const radius = 3.5 + Math.random() * 8.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    particlePositions[i3] = x;
    particlePositions[i3 + 1] = y;
    particlePositions[i3 + 2] = z;

    originalPositions[i3] = x;
    originalPositions[i3 + 1] = y;
    originalPositions[i3 + 2] = z;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 0.038,
    color: 0xa5f3fc,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(particleSystem);

  // --- Mouse & Touch Tracking ---
  const compassPointer = document.getElementById('compass-pointer');

  window.addEventListener('mousemove', (e) => {
    state.mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;

    // Compass angle
    if (compassPointer) {
      const angle = Math.atan2(-state.mouse.targetY, state.mouse.targetX);
      compassPointer.style.transform = `rotate(${angle}rad)`;
    }

    // Dynamic Filter Frequency based on mouse position
    if (filterNode && state.audioActive && audioCtx) {
      const freq = 200 + ((state.mouse.targetX + 1) * 0.5) * 800;
      filterNode.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      state.mouse.targetX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
      state.mouse.targetY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
  }, { passive: true });

  // --- Interactive Smooth Cursor ---
  const cursorCore = document.getElementById('cursor-core');
  const cursorFollower = document.getElementById('cursor-follower');
  const cursorGlow = document.getElementById('cursor-glow');

  let curX = window.innerWidth / 2;
  let curY = window.innerHeight / 2;
  let folX = curX;
  let folY = curY;

  window.addEventListener('mousemove', (e) => {
    curX = e.clientX;
    curY = e.clientY;
  });

  // Magnetic elements
  const magnetics = document.querySelectorAll('[data-magnetic], [data-magnetic-row], [data-tilt]');
  magnetics.forEach((el) => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('cursor-hover');
      el.style.transform = '';
    });
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * 0.16}px, ${y * 0.16}px)`;
    });
  });

  // --- Interactive HUD Controls ---
  const modeButtons = document.querySelectorAll('.hud-mode-btn');
  const modeIndex = { prismatic: 0, celestial: 1, cybernetic: 2, vortex: 3 };

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.mode;
      const geo = btn.dataset.geometry;

      state.shaderMode = mode;
      state.geometryType = geo;

      // Switch geometry seamlessly
      if (geometries[geo]) {
        coreMesh.geometry = geometries[geo];
      }

      shaderUniforms.uMode.value = modeIndex[mode] || 0;
      coreMaterial.wireframe = (mode === 'cybernetic');

      triggerChime(659.25, 0.8);

      gsap.to(shaderUniforms.uDistort, {
        value: state.turbulence * 1.8,
        duration: 0.35,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
      });
    });
  });

  // Turbulence Slider
  const turbSlider = document.getElementById('turbulence-range');
  if (turbSlider) {
    turbSlider.addEventListener('input', (e) => {
      state.turbulence = parseFloat(e.target.value);
      shaderUniforms.uDistort.value = state.turbulence;
    });
  }

  // Particle Density Toggle
  const densityBtn = document.getElementById('density-toggle');
  if (densityBtn) {
    densityBtn.addEventListener('click', () => {
      if (state.particleDensity === 'hyper') {
        state.particleDensity = 'luminous';
        densityBtn.textContent = 'LUMINOUS (2K)';
        particleMat.size = 0.06;
        particleMat.opacity = 0.85;
      } else {
        state.particleDensity = 'hyper';
        densityBtn.textContent = 'HYPER (4K)';
        particleMat.size = 0.038;
        particleMat.opacity = 0.55;
      }
      triggerChime(440, 0.4);
    });
  }

  // Audio Toggle
  const audioToggle = document.getElementById('audio-toggle');
  if (audioToggle) {
    audioToggle.addEventListener('click', () => {
      state.audioActive = !state.audioActive;
      if (state.audioActive) {
        initSpatialAudio();
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        audioToggle.classList.add('playing');
        audioToggle.querySelector('.sound-text').textContent = 'AUDIO: LIVE';
        triggerChime(587.33);
      } else {
        audioToggle.classList.remove('playing');
        audioToggle.querySelector('.sound-text').textContent = 'AUDIO: MUTED';
        if (audioCtx) {
          audioCtx.suspend();
        }
      }
    });
  }

  // Supermassive Warp Button
  const warpBtn = document.getElementById('warp-speed-btn');
  if (warpBtn) {
    warpBtn.addEventListener('click', () => {
      triggerChime(880, 2.5);
      state.isWarping = true;

      gsap.to(camera.position, {
        z: 3.8,
        duration: 0.8,
        ease: 'power3.in',
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          state.isWarping = false;
        }
      });

      gsap.to(shaderUniforms.uDistort, {
        value: 4.5,
        duration: 0.9,
        yoyo: true,
        repeat: 1,
        ease: 'elastic.out(1, 0.25)'
      });
    });
  }

  // Hovering on work items reacts on 3D Core
  const workRows = document.querySelectorAll('.work-row');
  workRows.forEach((row) => {
    row.addEventListener('mouseenter', () => {
      const mode = row.dataset.meshTrigger;
      if (mode && modeIndex[mode] !== undefined) {
        shaderUniforms.uMode.value = modeIndex[mode];
        triggerChime(523.25, 0.5);
      }
      gsap.to(coreMesh.scale, { x: 1.15, y: 1.15, z: 1.15, duration: 0.4, ease: 'power2.out' });
    });
    row.addEventListener('mouseleave', () => {
      shaderUniforms.uMode.value = modeIndex[state.shaderMode] || 0;
      gsap.to(coreMesh.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.4, ease: 'power2.out' });
    });
  });

  // --- Scroll Choreography (GSAP ScrollTrigger) ---
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Hero -> Manifesto: camera travels & core moves right
    gsap.to(coreMesh.position, {
      scrollTrigger: {
        trigger: '#manifesto',
        start: 'top bottom',
        end: 'center center',
        scrub: 1.2
      },
      x: 1.9,
      y: -0.2,
      z: -0.5
    });

    // Manifesto -> Works: core scales up and centers
    gsap.to(coreMesh.position, {
      scrollTrigger: {
        trigger: '#works',
        start: 'top bottom',
        end: 'bottom bottom',
        scrub: 1.4
      },
      x: -1.7,
      y: 0.3,
      z: 0.4
    });

    // Experiments: ring group spin acceleration
    gsap.to(ringGroup.rotation, {
      scrollTrigger: {
        trigger: '#experiments',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 2
      },
      z: Math.PI * 2,
      x: Math.PI
    });
  }

  // --- Animation & Physics Engine Loop ---
  let clock = new THREE.Clock();
  let frameCount = 0;
  let lastTime = performance.now();
  const fpsEl = document.getElementById('fps-counter');

  function renderLoop() {
    requestAnimationFrame(renderLoop);

    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // FPS Meter
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      if (fpsEl) fpsEl.textContent = frameCount;
      frameCount = 0;
      lastTime = now;
    }

    // Smooth Mouse Velocity Interpolation
    state.mouse.x += (state.mouse.targetX - state.mouse.x) * 0.06;
    state.mouse.y += (state.mouse.targetY - state.mouse.y) * 0.06;

    // Update Uniforms
    shaderUniforms.uTime.value = elapsed;
    shaderUniforms.uMouse.value.set(state.mouse.x, state.mouse.y);

    // Core Mesh Rotations
    const warpMult = state.isWarping ? 4.0 : 1.0;
    coreMesh.rotation.y += (0.007 + state.mouse.x * 0.02) * warpMult;
    coreMesh.rotation.x += (0.005 + state.mouse.y * 0.02) * warpMult;

    // Rings Rotation
    ring1.rotation.z += 0.006 * warpMult;
    ring2.rotation.x += 0.004 * warpMult;

    // Cosmic Particles Gravitational Vortex
    const positions = particleGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Drift & orbital swirl
      const ox = originalPositions[i3];
      const oy = originalPositions[i3 + 1];
      const oz = originalPositions[i3 + 2];

      const angle = elapsed * 0.15 + (i * 0.002);
      positions[i3] = ox * Math.cos(angle) - oz * Math.sin(angle) + state.mouse.x * 0.8;
      positions[i3 + 2] = ox * Math.sin(angle) + oz * Math.cos(angle) + state.mouse.y * 0.8;
      positions[i3 + 1] = oy + Math.sin(elapsed + i) * 0.12;
    }
    particleGeo.attributes.position.needsUpdate = true;

    // Render WebGL
    renderer.render(scene, camera);

    // Smooth Custom Cursor
    folX += (curX - folX) * 0.16;
    folY += (curY - folY) * 0.16;
    if (cursorCore) cursorCore.style.transform = `translate3d(${curX}px, ${curY}px, 0) translate(-50%, -50%)`;
    if (cursorFollower) cursorFollower.style.transform = `translate3d(${folX}px, ${folY}px, 0) translate(-50%, -50%)`;
    if (cursorGlow) cursorGlow.style.transform = `translate3d(${curX}px, ${curY}px, 0) translate(-50%, -50%)`;
  }

  renderLoop();

  // --- Window Resize ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  console.log('%c AETHERIA LAB %c 3D Spatial Computing Engine Initialized (60 FPS) ', 
    'background: #38bdf8; color: #000; padding: 4px 8px; font-weight: bold; border-radius: 4px 0 0 4px;', 
    'background: #050508; color: #c084fc; padding: 4px 8px; border-radius: 0 4px 4px 0;');
})();
