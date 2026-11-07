/**
 * AETHERIA // Spatial Design & Creative Engineering Laboratory
 * High-Fidelity 3D WebGL Engine, Bespoke Shaders & Kinetic Soundscapes
 * Optimized for Visual Comfort, 60 FPS Performance & Perfect Readability
 */

(() => {
  'use strict';

  // --- Engine State ---
  const state = {
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
    geometryType: 'knot',
    shaderMode: 'prismatic',
    audioActive: false,
    isWarping: false
  };

  // --- Web Audio Polyphonic Ambient Soundscape ---
  let audioCtx = null;
  let masterGain = null;
  let filterNode = null;
  let osc1 = null;
  let osc2 = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      filterNode = audioCtx.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(380, audioCtx.currentTime);
      filterNode.connect(masterGain);

      // Deep harmonic ambient pad (D2 + A2 fifth)
      osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(73.42, audioCtx.currentTime); // D2

      osc2 = audioCtx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(110.0, audioCtx.currentTime); // A2

      osc1.connect(filterNode);
      osc2.connect(filterNode);

      osc1.start();
      osc2.start();
    } catch (e) {
      console.warn('AudioContext not supported:', e);
    }
  }

  function playChime(freq = 587.33) {
    if (!audioCtx || !state.audioActive) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
  }

  // --- Three.js WebGL Scene Architecture ---
  const container = document.getElementById('canvas-container');
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  // --- Soft Atmospheric Lighting (Subtle, Non-glaring) ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambientLight);

  const keyLight = new THREE.PointLight(0x38bdf8, 2.2, 25);
  keyLight.position.set(6, 4, 4);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0xa78bfa, 2.0, 25);
  fillLight.position.set(-6, -3, 3);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0x34d399, 1.5, 20);
  rimLight.position.set(0, 5, -4);
  scene.add(rimLight);

  // --- GLSL Shaders (Soft Pearlescent, Easy on the Eyes) ---
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

      // Smooth organic wave (low-frequency, no harsh spikes)
      vec3 coords = normal * 1.2 + vec3(uTime * 0.3);
      float noise = snoise(coords);

      float mouseInfluence = sin(dot(normal.xy, uMouse) * 3.1415) * 0.15;
      float displacement = (noise * 0.28 + mouseInfluence) * uDistort;
      vDisplacement = displacement;

      vec3 newPosition = position + normal * displacement;
      vPosition = newPosition;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform int uMode; // 0: Satin Pearl, 1: Icy Glass, 2: Cyber Wire, 3: Cosmic Core
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vDisplacement;

    // Soft, Elegant Cosine Color Palette (No Harsh Neon Clashing)
    vec3 softPalette(float t) {
      // Gentle pastel tones: lavender, soft cyan, muted champagne
      vec3 a = vec3(0.35, 0.38, 0.45);
      vec3 b = vec3(0.25, 0.25, 0.30);
      vec3 c = vec3(0.8, 0.8, 0.8);
      vec3 d = vec3(0.15, 0.40, 0.65);
      return a + b * cos(6.28318 * (c * t + d));
    }

    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = dot(viewDir, vNormal);
      fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
      fresnel = pow(fresnel, 2.8);

      if (uMode == 0) {
        // --- 0: Satin Pearl (Comfortable Obsidian-Pearl with Soft Highlights) ---
        float seed = fresnel * 0.9 + vDisplacement * 0.6 + uTime * 0.12;
        vec3 spectralColor = softPalette(seed);
        
        // Deep velvety titanium base
        vec3 base = vec3(0.06, 0.07, 0.11);
        vec3 finalColor = mix(base, spectralColor, fresnel * 1.1 + 0.08);
        finalColor += vec3(0.4, 0.7, 0.9) * pow(fresnel, 5.0) * 0.45; // Subtle soft sheen
        gl_FragColor = vec4(finalColor, 0.92);

      } else if (uMode == 1) {
        // --- 1: Icy Glass (Cool Frosted Glaze, Calm on the Eyes) ---
        vec3 glass = vec3(0.05, 0.08, 0.12);
        glass += vec3(0.2, 0.6, 0.85) * pow(fresnel, 2.0);
        glass += vec3(0.5, 0.8, 0.7) * pow(fresnel, 4.0) * 0.5;
        gl_FragColor = vec4(glass, 0.75);

      } else if (uMode == 2) {
        // --- 2: Cyber Wire (Subtle Violet Grid) ---
        float grid = abs(sin(vUv.x * 60.0)) * abs(sin(vUv.y * 60.0));
        vec3 cyber = mix(vec3(0.06, 0.06, 0.1), vec3(0.3, 0.6, 0.9), pow(grid, 0.15));
        cyber += vec3(0.6, 0.3, 0.8) * fresnel;
        gl_FragColor = vec4(cyber, 0.85);

      } else {
        // --- 3: Cosmic Core (Warm Amber & Rose Violet Glow) ---
        vec3 warmBase = vec3(0.08, 0.06, 0.1);
        vec3 warmGlow = mix(vec3(0.7, 0.3, 0.5), vec3(0.9, 0.5, 0.3), fresnel);
        vec3 col = mix(warmBase, warmGlow, fresnel * 1.2 + 0.1);
        gl_FragColor = vec4(col, 0.9);
      }
    }
  `;

  const shaderUniforms = {
    uTime: { value: 0 },
    uDistort: { value: 0.65 }, // Balanced distortion (smooth, not spiky)
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

  // Switchable Geometries
  const geometries = {
    knot: new THREE.TorusKnotGeometry(1.4, 0.42, 128, 32, 2, 3),
    sphere: new THREE.IcosahedronGeometry(1.8, 64),
    torus: new THREE.TorusGeometry(1.5, 0.5, 32, 100),
    icosa: new THREE.IcosahedronGeometry(1.9, 16)
  };

  // 3D Sculpture Group
  const sculptureGroup = new THREE.Group();
  scene.add(sculptureGroup);

  // Initial Placement: Positioned gracefully to the right on desktop
  const isDesktop = window.innerWidth > 1024;
  sculptureGroup.position.set(isDesktop ? 1.5 : 0, isDesktop ? 0.1 : 0, 0);

  const coreMesh = new THREE.Mesh(geometries.knot, coreMaterial);
  sculptureGroup.add(coreMesh);

  // --- Concentric Orbital Rings ---
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.015, 16, 100),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25, wireframe: true })
  );
  ring1.rotation.x = Math.PI * 0.35;
  sculptureGroup.add(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.0, 0.012, 16, 100),
    new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.2, wireframe: true })
  );
  ring2.rotation.y = Math.PI * 0.4;
  sculptureGroup.add(ring2);

  // --- Gentle Cosmic Particle Dust (Subtle & Non-distracting) ---
  const particleCount = 2000;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleOriginals = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const radius = 3.2 + Math.random() * 7.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    particlePositions[i3] = x;
    particlePositions[i3 + 1] = y;
    particlePositions[i3 + 2] = z;

    particleOriginals[i3] = x;
    particleOriginals[i3 + 1] = y;
    particleOriginals[i3 + 2] = z;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 0.024,
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(particleSystem);

  // --- Mouse & Gesture Interaction ---
  window.addEventListener('mousemove', (e) => {
    state.mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;

    // Filter frequency modulation
    if (filterNode && state.audioActive && audioCtx) {
      const f = 250 + ((state.mouse.targetX + 1) * 0.5) * 600;
      filterNode.frequency.setTargetAtTime(f, audioCtx.currentTime, 0.1);
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      state.mouse.targetX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
      state.mouse.targetY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
  }, { passive: true });

  // --- Custom Smooth Cursor ---
  const cursorDot = document.getElementById('cursor-dot');
  const cursorRing = document.getElementById('cursor-ring');

  let curX = window.innerWidth / 2;
  let curY = window.innerHeight / 2;
  let ringX = curX;
  let ringY = curY;

  window.addEventListener('mousemove', (e) => {
    curX = e.clientX;
    curY = e.clientY;
  });

  // Magnetic hover
  const magnetics = document.querySelectorAll('[data-magnetic], [data-magnetic-card]');
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
      el.style.transform = `translate(${x * 0.14}px, ${y * 0.14}px)`;
    });
  });

  // --- HUD Preset Buttons ---
  const modeButtons = document.querySelectorAll('.shader-btn');
  const modeIndex = { prismatic: 0, celestial: 1, cybernetic: 2, vortex: 3 };

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.mode;
      const geo = btn.dataset.geometry;

      state.shaderMode = mode;
      state.geometryType = geo;

      if (geometries[geo]) {
        coreMesh.geometry = geometries[geo];
      }

      shaderUniforms.uMode.value = modeIndex[mode] || 0;
      coreMaterial.wireframe = (mode === 'cybernetic');

      playChime(659.25);

      gsap.to(shaderUniforms.uDistort, {
        value: 1.1,
        duration: 0.35,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
      });
    });
  });

  // Audio Toggle Button
  const audioBtn = document.getElementById('audio-toggle');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      state.audioActive = !state.audioActive;
      if (state.audioActive) {
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        audioBtn.classList.add('playing');
        audioBtn.querySelector('.sound-text').textContent = 'SOUND: ON';
        playChime(587.33);
      } else {
        audioBtn.classList.remove('playing');
        audioBtn.querySelector('.sound-text').textContent = 'SOUND: OFF';
        if (audioCtx) {
          audioCtx.suspend();
        }
      }
    });
  }

  // Supercharge / Warp Action Button
  const warpBtn = document.getElementById('warp-btn');
  if (warpBtn) {
    warpBtn.addEventListener('click', () => {
      playChime(880);
      state.isWarping = true;

      gsap.to(camera.position, {
        z: 4.8,
        duration: 0.6,
        yoyo: true,
        repeat: 1,
        ease: 'expo.out',
        onComplete: () => { state.isWarping = false; }
      });

      gsap.to(shaderUniforms.uDistort, {
        value: 2.2,
        duration: 0.7,
        yoyo: true,
        repeat: 1,
        ease: 'elastic.out(1, 0.3)'
      });
    });
  }

  // Work Item Hover Reaction
  const workItems = document.querySelectorAll('.work-item');
  workItems.forEach((item) => {
    item.addEventListener('mouseenter', () => {
      const mode = item.dataset.meshMode;
      if (mode && modeIndex[mode] !== undefined) {
        shaderUniforms.uMode.value = modeIndex[mode];
        playChime(523.25);
      }
      gsap.to(coreMesh.scale, { x: 1.12, y: 1.12, z: 1.12, duration: 0.35, ease: 'power2.out' });
    });
    item.addEventListener('mouseleave', () => {
      shaderUniforms.uMode.value = modeIndex[state.shaderMode] || 0;
      gsap.to(coreMesh.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.35, ease: 'power2.out' });
    });
  });

  // --- Scroll Choreography (GSAP ScrollTrigger) ---
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Hero -> Manifesto: sculpture gently travels toward left
    gsap.to(sculptureGroup.position, {
      scrollTrigger: {
        trigger: '#manifesto',
        start: 'top bottom',
        end: 'center center',
        scrub: 1.2
      },
      x: isDesktop ? -1.4 : 0,
      y: -0.2,
      z: -0.6
    });

    // Manifesto -> Works: sculpture returns to right side
    gsap.to(sculptureGroup.position, {
      scrollTrigger: {
        trigger: '#works',
        start: 'top bottom',
        end: 'bottom bottom',
        scrub: 1.4
      },
      x: isDesktop ? 1.6 : 0,
      y: 0.2,
      z: 0.2
    });
  }

  // --- Main Animation & Render Loop ---
  let clock = new THREE.Clock();
  let frameCount = 0;
  let lastTime = performance.now();
  const fpsEl = document.getElementById('fps-counter');

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // FPS Counter
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      if (fpsEl) fpsEl.textContent = frameCount;
      frameCount = 0;
      lastTime = now;
    }

    // Smooth Mouse Interpolation
    state.mouse.x += (state.mouse.targetX - state.mouse.x) * 0.05;
    state.mouse.y += (state.mouse.targetY - state.mouse.y) * 0.05;

    // Update Uniforms
    shaderUniforms.uTime.value = elapsed;
    shaderUniforms.uMouse.value.set(state.mouse.x, state.mouse.y);

    // Core Rotation
    const warpSpeed = state.isWarping ? 3.5 : 1.0;
    coreMesh.rotation.y += (0.006 + state.mouse.x * 0.015) * warpSpeed;
    coreMesh.rotation.x += (0.004 + state.mouse.y * 0.015) * warpSpeed;

    // Rings Rotation
    ring1.rotation.z += 0.005 * warpSpeed;
    ring2.rotation.x += 0.003 * warpSpeed;

    // Gentle Particle Swirl
    particleSystem.rotation.y = elapsed * 0.015;
    particleSystem.rotation.x = Math.sin(elapsed * 0.01) * 0.08;

    // Render WebGL Scene
    renderer.render(scene, camera);

    // Smooth Follower Cursor
    ringX += (curX - ringX) * 0.16;
    ringY += (curY - ringY) * 0.16;
    if (cursorDot) cursorDot.style.transform = `translate3d(${curX}px, ${curY}px, 0) translate(-50%, -50%)`;
    if (cursorRing) cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
  }

  animate();

  // --- Window Resize Handling ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const desktop = window.innerWidth > 1024;
    sculptureGroup.position.set(desktop ? 1.5 : 0, desktop ? 0.1 : 0, 0);
  });

  console.log('%c AETHERIA LAB %c 3D Spatial Engine Active • Visual Comfort Mode ',
    'background: #38bdf8; color: #000; padding: 4px 8px; font-weight: bold; border-radius: 4px 0 0 4px;',
    'background: #08090d; color: #a78bfa; padding: 4px 8px; border-radius: 0 4px 4px 0;');
})();
