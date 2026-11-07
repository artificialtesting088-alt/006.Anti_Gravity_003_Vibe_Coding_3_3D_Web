/**
 * LUSĪON • Creative 3D Studio Engine
 * WebGL, Three.js, Generative Shaders & Kinetic Interactions
 */

(() => {
  'use strict';

  // --- Global State ---
  const state = {
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0, velX: 0, velY: 0 },
    scroll: { current: 0, target: 0, ease: 0.08 },
    mode: 'iridescent',
    speedMultiplier: 1.0,
    isSupercharged: false,
    audioActive: false
  };

  // --- Web Audio Synthesizer (Zero External Assets) ---
  let audioCtx = null;
  let ambientOsc1 = null;
  let ambientOsc2 = null;
  let masterGain = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      // Warm atmospheric sub-drone
      ambientOsc1 = audioCtx.createOscillator();
      ambientOsc1.type = 'sine';
      ambientOsc1.frequency.setValueAtTime(55, audioCtx.currentTime); // A1 note

      ambientOsc2 = audioCtx.createOscillator();
      ambientOsc2.type = 'triangle';
      ambientOsc2.frequency.setValueAtTime(110.5, audioCtx.currentTime); // A2 slight detune

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, audioCtx.currentTime);

      ambientOsc1.connect(filter);
      ambientOsc2.connect(filter);
      filter.connect(masterGain);

      ambientOsc1.start();
      ambientOsc2.start();
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  function playChime(freq = 440) {
    if (!audioCtx || !state.audioActive) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
  }

  // --- Three.js 3D Canvas Experience ---
  const container = document.getElementById('webgl-container');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 7;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // --- Lighting Setup ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x38bdf8, 3, 20);
  pointLight1.position.set(5, 5, 4);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xa855f7, 3, 20);
  pointLight2.position.set(-5, -4, 4);
  scene.add(pointLight2);

  const pointLight3 = new THREE.PointLight(0xec4899, 2.5, 20);
  pointLight3.position.set(0, 4, -4);
  scene.add(pointLight3);

  // --- Organic Morphing Geometry & Simplex Noise Shaders ---
  const geometry = new THREE.IcosahedronGeometry(2.1, 64);
  
  // Custom GLSL Shader for Organic Iridescence
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
      
      // Calculate continuous procedural displacement
      vec3 coords = normal * 1.5 + vec3(uTime * 0.45);
      float noise = snoise(coords);
      
      // Mouse dynamic influence
      float mouseInfluence = sin(dot(normal.xy, uMouse) * 3.1415) * 0.25;
      
      float displacement = (noise * 0.35 + mouseInfluence) * uDistort;
      vDisplacement = displacement;
      
      vec3 newPosition = position + normal * displacement;
      vPosition = newPosition;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform int uMode; // 0: Iridescent, 1: Cyber, 2: Liquid, 3: Matrix
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vDisplacement;

    // Iridescent Palette Generator
    vec3 palette(float t) {
      vec3 a = vec3(0.5, 0.5, 0.5);
      vec3 b = vec3(0.5, 0.5, 0.5);
      vec3 c = vec3(1.0, 1.0, 1.0);
      vec3 d = vec3(0.00, 0.33, 0.67);
      return a + b * cos(6.28318 * (c * t + d));
    }

    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = dot(viewDir, vNormal);
      fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
      fresnel = pow(fresnel, 2.2);

      if (uMode == 0) {
        // --- 0: Iridescent Chrome Mode (Lusion Signature) ---
        float colorSeed = fresnel + vDisplacement * 0.8 + uTime * 0.15;
        vec3 iridescentColor = palette(colorSeed);
        
        vec3 baseShade = vec3(0.04, 0.04, 0.07);
        vec3 finalColor = mix(baseShade, iridescentColor, fresnel * 1.35 + 0.15);
        finalColor += vec3(0.4, 0.8, 1.0) * pow(fresnel, 4.0) * 0.6; // Edge glare
        gl_FragColor = vec4(finalColor, 0.94);

      } else if (uMode == 1) {
        // --- 1: Cyber Wireframe Mode ---
        float grid = abs(sin(vUv.x * 90.0)) * abs(sin(vUv.y * 90.0));
        vec3 cyberColor = mix(vec3(0.05, 0.05, 0.1), vec3(0.1, 0.9, 1.0), pow(grid, 0.1));
        cyberColor += vec3(0.8, 0.2, 1.0) * fresnel;
        gl_FragColor = vec4(cyberColor, 0.88);

      } else if (uMode == 2) {
        // --- 2: Liquid Glass Mode ---
        vec3 glass = vec3(0.08, 0.1, 0.15);
        glass += vec3(0.2, 0.7, 1.0) * pow(fresnel, 2.5);
        glass += vec3(1.0, 0.3, 0.6) * pow(fresnel, 5.0);
        gl_FragColor = vec4(glass, 0.65);

      } else {
        // --- 3: Quantum Particle Hologram ---
        float dots = step(0.65, sin(vPosition.x * 25.0) * sin(vPosition.y * 25.0) * sin(vPosition.z * 25.0));
        vec3 matrixColor = mix(vec3(0.0, 0.9, 0.6), vec3(0.2, 0.6, 1.0), fresnel);
        gl_FragColor = vec4(matrixColor * dots, dots * 0.9);
      }
    }
  `;

  const shaderUniforms = {
    uTime: { value: 0 },
    uDistort: { value: 1.0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMode: { value: 0 }
  };

  const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: shaderUniforms,
    transparent: true,
    wireframe: false
  });

  const morphMesh = new THREE.Mesh(geometry, shaderMaterial);
  scene.add(morphMesh);

  // --- Surrounding Ambient Starfield / Particle Dust ---
  const particleCount = 2000;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleScales = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const radius = 4 + Math.random() * 8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    particlePositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    particlePositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    particlePositions[i3 + 2] = radius * Math.cos(phi);
    particleScales[i] = Math.random() * 0.04 + 0.01;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 0.035,
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(particleSystem);

  // --- Mouse & Touch Tracking ---
  window.addEventListener('mousemove', (e) => {
    state.mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      state.mouse.targetX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
      state.mouse.targetY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
  }, { passive: true });

  // --- Custom Follower Cursor ---
  const cursorDot = document.getElementById('cursor-dot');
  const cursorCircle = document.getElementById('cursor-circle');
  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;
  let circleX = cursorX;
  let circleY = cursorY;

  window.addEventListener('mousemove', (e) => {
    cursorX = e.clientX;
    cursorY = e.clientY;
  });

  // Magnetic hover states on clickable targets
  const magnetics = document.querySelectorAll('[data-magnetic], [data-magnetic-card], [data-magnetic-row]');
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
      el.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
    });
  });

  // --- Sound Toggle ---
  const soundBtn = document.getElementById('sound-btn');
  soundBtn.addEventListener('click', () => {
    state.audioActive = !state.audioActive;
    if (state.audioActive) {
      initAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      soundBtn.classList.add('playing');
      soundBtn.querySelector('.sound-label').textContent = 'SOUND [ON]';
      playChime(660);
    } else {
      soundBtn.classList.remove('playing');
      soundBtn.querySelector('.sound-label').textContent = 'SOUND [OFF]';
      if (audioCtx) {
        audioCtx.suspend();
      }
    }
  });

  // --- 3D Mode Selector Buttons ---
  const modeButtons = document.querySelectorAll('.mode-btn');
  const modeMap = { iridescent: 0, cyber: 1, liquid: 2, matrix: 3 };

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const modeKey = btn.dataset.mode;
      state.mode = modeKey;
      shaderUniforms.uMode.value = modeMap[modeKey] || 0;
      
      // Wireframe toggle for cyber mode
      shaderMaterial.wireframe = (modeKey === 'cyber');
      
      playChime(520);

      // Ripple punch on mesh
      gsap.to(shaderUniforms.uDistort, {
        value: 1.8,
        duration: 0.35,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
      });
    });
  });

  // --- Speed Toggle ---
  const speedBtn = document.getElementById('speed-toggle');
  const speeds = [1.0, 1.8, 2.5, 0.4];
  let speedIdx = 0;

  speedBtn.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % speeds.length;
    state.speedMultiplier = speeds[speedIdx];
    speedBtn.textContent = `${state.speedMultiplier.toFixed(1)}X`;
    playChime(440 * state.speedMultiplier);
  });

  // --- Supercharge Mesh Action ---
  const superchargeBtn = document.getElementById('explode-trigger');
  if (superchargeBtn) {
    superchargeBtn.addEventListener('click', () => {
      playChime(880);
      gsap.to(camera.position, {
        z: 4.8,
        duration: 0.6,
        yoyo: true,
        repeat: 1,
        ease: 'expo.out'
      });
      gsap.to(shaderUniforms.uDistort, {
        value: 3.5,
        duration: 0.8,
        yoyo: true,
        repeat: 1,
        ease: 'elastic.out(1, 0.3)'
      });
    });
  }

  // --- Scroll Driven Spatial Transitions (GSAP ScrollTrigger) ---
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Camera travels & rotates organically with user scroll
    gsap.to(morphMesh.position, {
      scrollTrigger: {
        trigger: '#work',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.2
      },
      x: 1.8,
      y: -0.3,
      z: -1.0
    });

    gsap.to(morphMesh.rotation, {
      scrollTrigger: {
        trigger: '#services',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.5
      },
      y: Math.PI * 1.5,
      x: 0.6
    });

    gsap.to(morphMesh.position, {
      scrollTrigger: {
        trigger: '#about',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.2
      },
      x: -1.6,
      y: 0.4,
      z: 0.5
    });
  }

  // --- Animation Loop ---
  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime() * state.speedMultiplier;

    // Smooth Mouse Interpolation (Lerp)
    state.mouse.x += (state.mouse.targetX - state.mouse.x) * 0.05;
    state.mouse.y += (state.mouse.targetY - state.mouse.y) * 0.05;

    // Update Uniforms
    shaderUniforms.uTime.value = elapsedTime;
    shaderUniforms.uMouse.value.set(state.mouse.x, state.mouse.y);

    // Mesh Rotations
    morphMesh.rotation.y += 0.005 * state.speedMultiplier + state.mouse.x * 0.02;
    morphMesh.rotation.x += 0.003 * state.speedMultiplier + state.mouse.y * 0.02;

    // Background Particle Field Swirl
    particleSystem.rotation.y = elapsedTime * 0.02;
    particleSystem.rotation.x = Math.sin(elapsedTime * 0.015) * 0.15;

    // Render Scene
    renderer.render(scene, camera);

    // Custom Cursor Smoothing
    circleX += (cursorX - circleX) * 0.16;
    circleY += (cursorY - circleY) * 0.16;
    cursorDot.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;
    cursorCircle.style.transform = `translate3d(${circleX}px, ${circleY}px, 0) translate(-50%, -50%)`;
  }

  animate();

  // --- Window Resize Handling ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  console.log('%c LUSĪON CREATIVE LAB %c Ready • 60 FPS WebGL Engine Active ', 
    'background: #a855f7; color: #fff; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight: bold;', 
    'background: #0f172a; color: #38bdf8; padding: 4px 8px; border-radius: 0 4px 4px 0;');
})();
