(() => {
  "use strict";

  const THREE = window.THREE;
  const $ = selector => document.querySelector(selector);
  const canvas = $("#game");
  const arena = $("#arena");
  const intro = $("#intro");
  const hud = $("#hud");
  const pauseOverlay = $("#pause-overlay");
  const missionOverlay = $("#mission-overlay");
  const startForm = $("#start-form");
  const captainInput = $("#captain-name");
  const healthFill = $("#health-fill");
  const specialFill = $("#special-fill");
  const levelNumber = $("#level-number");
  const levelTitle = $("#level-title");
  const objective = $("#objective");
  const distanceLabel = $("#distance-label");
  const difficultyLabel = $("#difficulty-label");
  const centerPrompt = $("#center-prompt");
  const toastElement = $("#toast");
  const storyCard = $("#story-card");
  const compassArrow = $("#nav-arrow");
  const keys = new Set();
  const islands = [];
  const guards = [];
  const projectiles = [];
  const effects = [];
  const levelData = [
    { name: "Drowned Palm", title: "THE DROWNED PALM", chapter: "CHAPTER I · THE MAP THAT SHOULD NOT EXIST", story: "A page torn from a drowned captain's log names this island. Its beacon is burning, though no one has lived here for years.", clue: "Inside the chest: a brass astrolabe and a line in your own handwriting — “Three seals keep the Drowned King below.” Its needle turns toward Thornreach.", difficulty: "◆ EASY", guards: 3, reward: 40, center: { x: 0, y: 0 }, sand: 0xc98942, grass: 0x194c2d, hill: 0x465b36 },
    { name: "Thornreach", title: "THORNREACH", chapter: "CHAPTER II · THE BELL BENEATH THE TIDE", story: "The astrolabe leads to a frozen bell tower. Each time the bell sounds, the tide pulls farther from shore — and something answers beneath it.", clue: "The second seal breaks. A new line appears beneath your name: “I buried the last seal at the Ember Crown.” You don't remember writing it.", difficulty: "◆◆ DANGEROUS", guards: 5, reward: 75, center: { x: 510, y: -620 }, sand: 0xb77942, grass: 0x254932, hill: 0x4a5b43 },
    { name: "The Ember Crown", title: "THE EMBER CROWN", chapter: "CHAPTER III · THE CAPTAIN IN THE ASH", story: "At the last island, a fire burns in daylight. The champion waiting there carries your old captain's compass — warm, and ticking like a heart.", clue: "The final seal shatters. The storm clears, and the truth is yours: the chart, the clues, even the handwriting were left by you before the sea took your memory. The Cays are free.", difficulty: "◆◆◆ DEADLY", guards: 7, reward: 130, center: { x: -330, y: -1260 }, sand: 0xc56a3e, grass: 0x3f3b2a, hill: 0x654032 }
  ];

  let renderer;
  let scene;
  let camera;
  let world;
  let waterMaterial;
  let ship;
  let captain;
  let captainName = "Captain";
  let captainModel;
  let treasure;
  let currentIsland = -1;
  let targetIsland = 0;
  let campaign = [];
  let phase = "menu";
  let state = "menu";
  let gold = 0;
  let health = 100;
  let specialCooldown = 0;
  let attackCooldown = 0;
  let cannonCooldown = 0;
  let respawnTimer = 0;
  let shipYaw = 0;
  let shipTurnVelocity = 0;
  let cameraYaw = 0;
  let cameraPitch = .38;
  let shipSpeed = 0;
  let firebombCooldown = 0;
  let playerSwing = 0;
  let lastFrame = 0;
  let toastTimer = 0;
  let storyTimer = 0;
  let audioContext;
  let musicTimer;
  let musicStep = 0;
  let soundOn = true;
  let pointerWasLocked = false;
  let mouseLooking = false;
  let sun;
  let modelTextures = [];

  const forwardFor = yaw => new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));

  if (!THREE) {
    showFatal("The local Three.js engine did not load. Check that three.min.js is beside index.html.");
    return;
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = .92;

    scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x6bb8cb, 380, 1500);
    camera = new THREE.PerspectiveCamera(67, 16 / 9, .1, 1800);
    world = new THREE.Group();
    scene.add(world);
    addLighting();
    addOcean();
    buildIslands();
    captain = { position: new THREE.Vector3(0, 0, 282), yaw: 0 };
    captainModel = createPirate();
    world.add(captainModel);
    ship = createShip();
    scene.add(ship);
    ship.position.set(0, 0, 282);
    ship.rotation.y = 0;
    setIntroCamera();
    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(frame);
  } catch (error) {
    showFatal(`3D could not start: ${error.message}`);
    return;
  }

  function showFatal(message) {
    const panel = document.querySelector(".intro-panel");
    if (panel) {
      const notice = document.createElement("p");
      notice.className = "error-message";
      notice.setAttribute("role", "alert");
      notice.textContent = message;
      panel.prepend(notice);
    }
  }

  function addLighting() {
    scene.add(new THREE.HemisphereLight(0xd5f2ff, 0x263e2b, .34));
    const ambient = new THREE.AmbientLight(0x86a9a0, .05);
    scene.add(ambient);
    sun = new THREE.DirectionalLight(0xffdfaa, .88);
    sun.position.set(-90, 155, 75);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -330;
    sun.shadow.camera.right = 330;
    sun.shadow.camera.top = 330;
    sun.shadow.camera.bottom = -330;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 570;
    sun.shadow.bias = -.00035;
    sun.shadow.normalBias = .025;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x69c4e0, .16);
    fill.position.set(160, 45, -170);
    scene.add(fill);
  }

  function addOcean() {
    waterMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vec3 pos = position;
          float wave = sin(pos.x * 0.035 + time * 0.8) * 0.42
                     + cos(pos.y * 0.043 + time * 0.63) * 0.25
                     + sin((pos.x + pos.y) * 0.018 + time * 0.48) * 0.22;
          pos.y += wave;
          vUv = uv;
          vPosition = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          float ripple = sin(vPosition.x * 0.11 + time * 1.4) * cos(vPosition.z * 0.09 - time * 0.8);
          float glitter = pow(max(0.0, ripple), 8.0) * 0.17;
          vec3 deep = vec3(0.025, 0.19, 0.29);
          vec3 shallow = vec3(0.065, 0.39, 0.48);
          float depth = smoothstep(0.12, 0.86, vUv.y);
          vec3 color = mix(deep, shallow, depth);
          color += vec3(0.42, 0.69, 0.64) * glitter;
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    const oceanGeometry = new THREE.PlaneGeometry(5000, 5000);
    oceanGeometry.rotateX(-Math.PI / 2);
    const ocean = new THREE.Mesh(oceanGeometry, waterMaterial);
    ocean.position.y = -4.4;
    ocean.frustumCulled = false;
    scene.add(ocean);
  }

  function sampleTerrain(index, x, z) {
    const r = Math.hypot(x / 190, z / 157);
    if (r >= 1.15) return -5;
    const coast = -3 + ((1.15 - r) / .27) * 4.5;
    const interior = 1.5 + Math.max(0, .88 - r) * 18;
    const hilly = Math.max(0, .88 - r);
    let height = r > .88 ? coast : interior;
    height += (Math.sin(x * .037) * Math.cos(z * .045) * 1.65 + Math.sin((x + z) * .022) * 1.1) * hilly;
    height += Math.exp(-(((x + 31) / 39) ** 2 + ((z + 32) / 48) ** 2)) * (index === 2 ? 49 : 33);
    if (index === 1) height += Math.exp(-(((x - 55) / 48) ** 2 + ((z - 4) / 42) ** 2)) * 18;
    return height;
  }

  function terrainColor(index, height, radius) {
    const colors = levelData[index];
    if (radius > .88) return new THREE.Color(colors.sand);
    if (height > 18) return new THREE.Color(colors.hill);
    const low = new THREE.Color(colors.grass);
    const high = new THREE.Color(colors.hill);
    low.lerp(high, THREE.MathUtils.clamp((height - 5) / 24, 0, .72));
    const variation = .91 + .09 * Math.sin(height * .47 + radius * 39);
    low.multiplyScalar(variation);
    return low;
  }

  function buildIslands() {
    const rng = makeRandom(8103);
    levelData.forEach((data, index) => {
      const group = new THREE.Group();
      group.position.set(data.center.x, 0, data.center.y);
      group.userData.index = index;
      world.add(group);
      const geometry = new THREE.PlaneGeometry(460, 374, 104, 88);
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.attributes.position;
      const colors = [];
      const color = new THREE.Color();
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const radius = Math.hypot(x / 190, z / 157);
        const height = sampleTerrain(index, x, z);
        positions.setY(i, height);
        color.copy(terrainColor(index, height, radius));
        colors.push(color.r, color.g, color.b);
      }
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const groundTexture = makeGroundTexture(index);
      modelTextures.push(groundTexture);
      const land = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: groundTexture,
        vertexColors: true,
        roughness: .96,
        metalness: 0,
        flatShading: false
      }));
      land.receiveShadow = true;
      land.castShadow = false;
      group.add(land);

      const beaches = new THREE.Mesh(
        new THREE.TorusGeometry(1, 2.6, 6, 110),
        new THREE.MeshStandardMaterial({ color: data.sand, roughness: 1 })
      );
      beaches.scale.set(185, 1, 151);
      beaches.rotation.x = Math.PI / 2;
      beaches.position.y = .3;
      beaches.receiveShadow = true;
      group.add(beaches);

      addHill(group, index);
      addRuins(group, index);
      addDock(group);
      addPalms(group, index, rng, index === 2 ? 24 : 20);
      addGroundcover(group, index, rng, 800);
      for (let i = 0; i < 17; i++) {
        const angle = rng() * Math.PI * 2;
        const radius = .43 + rng() * .41;
        const x = Math.cos(angle) * 171 * radius;
        const z = Math.sin(angle) * 139 * radius;
        addRock(group, index, x, z, .6 + rng() * 1.3, rng());
      }
      for (let i = 0; i < 30; i++) {
        const angle = rng() * Math.PI * 2;
        const radius = .88 + rng() * .17;
        const x = Math.cos(angle) * 180 * radius;
        const z = Math.sin(angle) * 147 * radius;
        addRock(group, index, x, z, .55 + rng() * 1.25, rng());
      }
      addBeaconLandmark(group, index);
      islands.push({ group, data, index, state: "unvisited", dock: new THREE.Vector3(data.center.x, 0, data.center.y + 193) });
    });
  }

  function makeRandom(value) {
    let seed = value;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }

  function makeGroundTexture(index) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 512;
    textureCanvas.height = 512;
    const context = textureCanvas.getContext("2d");
    const image = context.createImageData(512, 512);
    const rng = makeRandom(9341 + index * 71);
    for (let i = 0; i < image.data.length; i += 4) {
      const grain = 221 + Math.floor(rng() * 35);
      image.data[i] = grain;
      image.data[i + 1] = grain - Math.floor(rng() * 9);
      image.data[i + 2] = grain - Math.floor(rng() * 22);
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    for (let i = 0; i < 420; i++) {
      const x = rng() * 512;
      const y = rng() * 512;
      const radius = 2 + rng() * 18;
      context.fillStyle = i % 4 === 0 ? "rgba(132,113,74,.14)" : "rgba(41,81,48,.09)";
      context.beginPath();
      context.ellipse(x, y, radius, radius * (.35 + rng() * .6), rng() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 7);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function addGroundcover(group, index, rng, count) {
    const palette = index === 2 ? [0x9b5934, 0xb57740, 0x697443] : [0x2d8442, 0x68a84e, 0x3e713e];
    const bladeVertices = [];
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      const directionX = Math.sin(angle);
      const directionZ = Math.cos(angle);
      const sideX = Math.cos(angle) * .13;
      const sideZ = -Math.sin(angle) * .13;
      bladeVertices.push(
        -sideX, 0, -sideZ,
        sideX, 0, sideZ,
        directionX * .16, .58, directionZ * .16
      );
    }
    const grassGeometry = new THREE.BufferGeometry();
    grassGeometry.setAttribute("position", new THREE.Float32BufferAttribute(bladeVertices, 3));
    grassGeometry.computeVertexNormals();
    const plants = new THREE.InstancedMesh(
      grassGeometry,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, side: THREE.DoubleSide }),
      count
    );
    const transform = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng()) * .82;
      const x = Math.cos(angle) * 172 * radius;
      const z = Math.sin(angle) * 141 * radius;
      const scale = .65 + rng() * .65;
      transform.position.set(x, sampleTerrain(index, x, z), z);
      transform.rotation.set(0, rng() * Math.PI, (rng() - .5) * .24);
      transform.scale.set(scale, scale, scale);
      transform.updateMatrix();
      plants.setMatrixAt(i, transform.matrix);
      plants.setColorAt(i, new THREE.Color(palette[Math.floor(rng() * palette.length)]));
    }
    plants.instanceMatrix.needsUpdate = true;
    plants.instanceColor.needsUpdate = true;
    plants.castShadow = false;
    plants.receiveShadow = false;
    group.add(plants);
  }

  function addHill(group, index) {
    const mountain = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 2),
      new THREE.MeshStandardMaterial({ color: index === 2 ? 0x514b42 : 0x666a51, roughness: .97, flatShading: true })
    );
    mountain.position.set(-31, sampleTerrain(index, -31, -32) - 8, -32);
    mountain.scale.set(47, index === 2 ? 42 : 28, 53);
    mountain.castShadow = true;
    mountain.receiveShadow = true;
    group.add(mountain);

    const peak = new THREE.Mesh(
      new THREE.ConeGeometry(21, 28, 7, 2),
      new THREE.MeshStandardMaterial({ color: 0x746952, roughness: 1, flatShading: true })
    );
    peak.position.set(-36, sampleTerrain(index, -36, -37) + 10, -38);
    peak.castShadow = true;
    group.add(peak);
  }

  function addRuins(group, index) {
    const stone = new THREE.MeshStandardMaterial({ color: index === 2 ? 0x87785f : 0xa39a7b, roughness: .92, flatShading: true });
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x46463b, roughness: 1 });
    const temple = new THREE.Group();
    temple.position.set(42, sampleTerrain(index, 42, -40), -40);
    group.add(temple);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(28, 2.4, 17), stone);
    platform.position.y = 1;
    platform.castShadow = true;
    platform.receiveShadow = true;
    temple.add(platform);
    const columns = [[-10,-5],[10,-5],[-10,5],[10,5]];
    columns.forEach(([x, z]) => {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.85, 13, 8), stone);
      column.position.set(x, 8.2, z);
      column.castShadow = true;
      column.receiveShadow = true;
      temple.add(column);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.3, 4.4), stone);
      cap.position.set(x, 15, z);
      cap.castShadow = true;
      temple.add(cap);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(27, 3, 4), stone);
    lintel.position.set(0, 15.5, 0);
    lintel.castShadow = true;
    temple.add(lintel);
    const altar = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 6), darkStone);
    altar.position.set(0, 3.2, -2);
    altar.castShadow = true;
    temple.add(altar);
    const runes = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({
      color: index === 2 ? 0xe36e43 : 0x70c7c0,
      emissive: index === 2 ? 0x852d13 : 0x1b7470,
      emissiveIntensity: 1.8,
      roughness: .24,
      metalness: .26
    }));
    runes.position.set(0, 7, -2);
    temple.add(runes);
  }

  function addDock(group) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x624a32, roughness: .88 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xa48456, roughness: .7 });
    const dock = new THREE.Group();
    dock.position.set(0, -.2, 137);
    group.add(dock);
    for (let i = 0; i < 38; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(8, .45, 1.5), i % 3 === 0 ? trim : wood);
      plank.position.set(0, 0, i * 1.55);
      plank.castShadow = true;
      plank.receiveShadow = true;
      dock.add(plank);
    }
    [-3, 3].forEach(x => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(.8, .55, 59), wood);
      beam.position.set(x, -.12, 28.5);
      dock.add(beam);
      for (let i = 0; i < 14; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.27,.34,4,7), trim);
        post.position.set(x, -1.6, i * 4.3);
        post.castShadow = true;
        dock.add(post);
      }
    });
  }

  function addPalms(group, index, rng, count) {
    const trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(.23, .62, 8, 7, 3),
      new THREE.MeshStandardMaterial({ color: index === 2 ? 0x624b38 : 0x705038, roughness: 1, flatShading: true }),
      count
    );
    const leafMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(.38, 5.4, 5, 1),
      new THREE.MeshStandardMaterial({
        color: index === 2 ? 0x536245 : 0x3f704b,
        roughness: .93,
        side: THREE.DoubleSide,
        flatShading: true
      }),
      count * 7
    );
    const transform = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    let leafIndex = 0;
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng()) * .78;
      const x = Math.cos(angle) * 171 * radius;
      const z = Math.sin(angle) * 138 * radius;
      const scale = .72 + rng() * .57;
      const lean = .08 + Math.sin(rng() * 9) * .14;
      const ground = sampleTerrain(index, x, z);
      transform.position.set(x - Math.sin(lean) * 2.5 * scale, ground + 4 * scale, z);
      transform.rotation.set(0, angle, lean);
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      trunkMesh.setMatrixAt(i, transform.matrix);
      const crown = new THREE.Vector3(x - Math.sin(lean) * 5 * scale, ground + 8 * scale, z);
      for (let leaf = 0; leaf < 7; leaf++) {
        const leafAngle = leaf * Math.PI / 3.5 + angle;
        const direction = new THREE.Vector3(Math.cos(leafAngle), -.16 + Math.sin(leaf * 3) * .05, Math.sin(leafAngle)).normalize();
        transform.position.copy(crown).addScaledVector(direction, 2.12 * scale);
        transform.quaternion.setFromUnitVectors(up, direction);
        transform.scale.set(scale, scale, scale * .58);
        transform.updateMatrix();
        leafMesh.setMatrixAt(leafIndex++, transform.matrix);
      }
    }
    leafMesh.count = leafIndex;
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    leafMesh.castShadow = true;
    group.add(trunkMesh, leafMesh);
  }

  function addRock(group, index, x, z, scale, randomValue) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: index === 2 ? 0x6a5a4a : 0x797764, roughness: 1, flatShading: true })
    );
    rock.position.set(x, sampleTerrain(index, x, z) + scale * .55, z);
    rock.scale.set(scale * (1.1 + randomValue), scale * .7, scale * (.8 + randomValue * .6));
    rock.rotation.set(randomValue * .4, randomValue * Math.PI, randomValue * .3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  function addBeaconLandmark(group, index) {
    const x = -103;
    const z = -76;
    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4.1, 14, 8),
      new THREE.MeshStandardMaterial({ color: 0x81785f, roughness: .9, flatShading: true })
    );
    stone.position.set(x, sampleTerrain(index, x, z) + 7, z);
    stone.castShadow = true;
    group.add(stone);
    const flame = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.4, 1),
      new THREE.MeshBasicMaterial({ color: index === 2 ? 0xff7942 : 0xf0cd75 })
    );
    flame.position.set(x, stone.position.y + 9, z);
    group.add(flame);
    const light = new THREE.PointLight(index === 2 ? 0xf87b47 : 0xf2cb73, 2.7, 55, 2);
    light.position.copy(flame.position);
    group.add(light);
  }

  function makeMaterial(color, options = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: .78, ...options });
  }

  function createPirate() {
    const group = new THREE.Group();
    const root = new THREE.Group();
    group.add(root);
    const coat = makeMaterial(0x8c332b, { roughness: .88 });
    const pants = makeMaterial(0x263244);
    const skin = makeMaterial(0xc89770, { roughness: .92 });
    const leather = makeMaterial(0x523729);
    const gold = makeMaterial(0xe4b84f, { metalness: .62, roughness: .36 });
    const dark = makeMaterial(0x211c1c);
    const blade = new THREE.MeshStandardMaterial({ color: 0xdce7e6, metalness: .82, roughness: .2 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(.44, .54, 1.36, 9), coat);
    torso.position.y = 1.83;
    torso.castShadow = true;
    root.add(torso);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(.53,.53,.18,9), leather);
    belt.position.y = 1.28;
    root.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(.22,.2,.08), gold);
    buckle.position.set(0,1.3,.52);
    root.add(buckle);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.38,12,10), skin);
    head.position.y = 2.85;
    head.castShadow = true;
    root.add(head);
    const eyeMaterial = makeMaterial(0x211b19, { roughness: .45 });
    [-1,1].forEach(side=>{
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),eyeMaterial);
      eye.position.set(side*.13,2.89,.34);
      root.add(eye);
    });
    const beard=new THREE.Mesh(new THREE.ConeGeometry(.28,.38,9),dark);
    beard.position.set(0,2.57,.23);
    beard.rotation.x=Math.PI;
    root.add(beard);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.39,10,7,0,Math.PI*2,0,Math.PI*.52), dark);
    hair.position.set(0,2.95,-.04);
    root.add(hair);
    const hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.72,.74,.12,12), leather);
    brim.position.y = 3.23;
    brim.scale.z = .84;
    hat.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(.38,.47,.42,10), dark);
    crown.position.y = 3.46;
    hat.add(crown);
    const hatBand = new THREE.Mesh(new THREE.TorusGeometry(.43,.055,6,12), gold);
    hatBand.position.y = 3.34;
    hatBand.rotation.x = Math.PI / 2;
    hat.add(hatBand);
    root.add(hat);

    const arms = [];
    [-1,1].forEach(side => {
      const arm = new THREE.Group();
      arm.position.set(side * .48, 2.29, 0);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.76,7), coat);
      sleeve.position.y = -.34;
      sleeve.rotation.z = side * -.12;
      sleeve.castShadow = true;
      arm.add(sleeve);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(.15,8,7), skin);
      hand.position.set(side * -.03,-.76,.04);
      arm.add(hand);
      root.add(arm);
      arms.push(arm);
    });
    const legs = [];
    [-1,1].forEach(side => {
      const leg = new THREE.Group();
      leg.position.set(side * .22,1.22,0);
      const pantsLeg = new THREE.Mesh(new THREE.CylinderGeometry(.17,.14,.72,7), pants);
      pantsLeg.position.y = -.34;
      pantsLeg.castShadow = true;
      leg.add(pantsLeg);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(.32,.2,.43), leather);
      boot.position.set(0,-.7,.1);
      leg.add(boot);
      root.add(leg);
      legs.push(leg);
    });

    const sword = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.055,.065,.38,8), leather);
    grip.position.y = .22;
    sword.add(grip);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(.1,8,7),gold);
    pommel.position.y=.43;
    sword.add(pommel);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(.52,.1,.14), gold);
    guard.position.set(0,.02,.02);
    sword.add(guard);
    const bladeShape=new THREE.Shape();
    bladeShape.moveTo(-.09,.02);
    bladeShape.lineTo(.09,.02);
    bladeShape.lineTo(.11,-.7);
    bladeShape.quadraticCurveTo(.12,-1.03,.34,-1.34);
    bladeShape.quadraticCurveTo(-.02,-1.18,-.09,-.84);
    bladeShape.closePath();
    const bladeGeometry=new THREE.ExtrudeGeometry(bladeShape,{depth:.065,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025});
    bladeGeometry.translate(0,0,-.032);
    const swordBlade = new THREE.Mesh(bladeGeometry, blade);
    swordBlade.castShadow = true;
    sword.add(swordBlade);
    arms[1].add(sword);
    sword.position.set(.16,-.63,.18);
    sword.rotation.z = -.45;
    group.userData = { root, arms, legs };
    group.scale.setScalar(1.22);
    return group;
  }

  function createGuard(boss, difficulty) {
    const group = new THREE.Group();
    const root = new THREE.Group();
    group.add(root);
    const bone = makeMaterial(boss ? 0xcbbd9c : 0xb9b49c, { roughness: .96 });
    const cloth = makeMaterial(boss ? 0x422c2a : 0x303b36, { roughness: 1 });
    const shadow = makeMaterial(0x292b29);
    const red = new THREE.MeshStandardMaterial({ color: 0xc63e25, emissive: 0x9e2614, emissiveIntensity: 1.6 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(.39,.5,1.25,8),cloth);
    torso.position.y=1.6;
    torso.castShadow=true;
    root.add(torso);
    const ribCount=boss?5:4;
    for(let i=0;i<ribCount;i++){
      const rib=new THREE.Mesh(new THREE.TorusGeometry(.36-i*.025,.055,5,9),bone);
      rib.position.set(0,1.84-i*.22,.08);
      rib.rotation.x=Math.PI/2;
      root.add(rib);
    }
    const skull=new THREE.Mesh(new THREE.SphereGeometry(boss?.52:.4,11,9),bone);
    skull.position.y=2.65;
    skull.castShadow=true;
    root.add(skull);
    const jaw=new THREE.Mesh(new THREE.BoxGeometry(.44,.19,.4),bone);
    jaw.position.set(0,2.42,.09);
    root.add(jaw);
    [-1,1].forEach(side=>{
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.082,8,7),red);
      eye.position.set(side*.16,2.68,.34);
      root.add(eye);
    });
    const hat=new THREE.Mesh(new THREE.CylinderGeometry(.52,.56,.14,8),shadow);
    hat.position.y=3.04;
    root.add(hat);
    const crown=new THREE.Mesh(new THREE.ConeGeometry(.43,.42,7),cloth);
    crown.position.y=3.31;
    root.add(crown);
    const arms=[];
    [-1,1].forEach(side=>{
      const arm=new THREE.Group();
      arm.position.set(side*.45,2.08,0);
      const boneArm=new THREE.Mesh(new THREE.CylinderGeometry(.105,.13,.8,6),bone);
      boneArm.position.y=-.35;
      boneArm.castShadow=true;
      arm.add(boneArm);
      const hand=new THREE.Mesh(new THREE.SphereGeometry(.13,7,6),bone);
      hand.position.y=-.77;
      arm.add(hand);
      root.add(arm);
      arms.push(arm);
    });
    const legs=[];
    [-1,1].forEach(side=>{
      const leg=new THREE.Group();
      leg.position.set(side*.22,1.05,0);
      const femur=new THREE.Mesh(new THREE.CylinderGeometry(.14,.11,.63,6),bone);
      femur.position.y=-.28;
      femur.castShadow=true;
      leg.add(femur);
      const boot=new THREE.Mesh(new THREE.BoxGeometry(.3,.18,.38),shadow);
      boot.position.set(0,-.64,.08);
      leg.add(boot);
      root.add(leg);
      legs.push(leg);
    });
    const sword=new THREE.Mesh(new THREE.CylinderGeometry(.035,.075,.95,6),new THREE.MeshStandardMaterial({color:0xc9c9b8,metalness:.65,roughness:.27}));
    sword.position.set(.9,1.64,.08);
    sword.rotation.z=-.42;
    sword.castShadow=true;
    root.add(sword);
    if(boss){
      const shoulder=new THREE.Mesh(new THREE.BoxGeometry(1.4,.28,.7),makeMaterial(0x8b542f,{metalness:.18}));
      shoulder.position.y=2.04;
      shoulder.castShadow=true;
      root.add(shoulder);
      const aura=new THREE.PointLight(0xff6237,1.2,17);
      aura.position.y=2.5;
      root.add(aura);
    }
    group.scale.setScalar(boss?1.55:1);
    group.userData={root,arms,legs,difficulty,boss};
    return group;
  }

  function createShip() {
    const shipGroup = new THREE.Group();
    const hullMaterial = makeMaterial(0x38241f, { roughness: .68 });
    const trim = makeMaterial(0xc08a43, { roughness: .5 });
    const deck = makeMaterial(0x68432c, { roughness: .86 });
    const sailCanvas=document.createElement("canvas");
    sailCanvas.width=256;
    sailCanvas.height=512;
    const sailContext=sailCanvas.getContext("2d");
    sailContext.fillStyle="#dfd2b2";
    sailContext.fillRect(0,0,256,512);
    for(let x=0;x<256;x+=64){
      sailContext.fillStyle=x%128===0?"rgba(255,250,224,.13)":"rgba(91,70,43,.055)";
      sailContext.fillRect(x,0,64,512);
      if(x>0){
        sailContext.strokeStyle="rgba(68,53,36,.32)";
        sailContext.lineWidth=2;
        sailContext.beginPath();
        sailContext.moveTo(x,0);
        sailContext.lineTo(x,512);
        sailContext.stroke();
        sailContext.setLineDash([3,5]);
        sailContext.strokeStyle="rgba(250,237,204,.65)";
        sailContext.lineWidth=1;
        sailContext.beginPath();
        sailContext.moveTo(x+4,0);
        sailContext.lineTo(x+4,512);
        sailContext.stroke();
        sailContext.setLineDash([]);
      }
    }
    for(let y=8;y<512;y+=12){
      sailContext.strokeStyle="rgba(78,66,47,.035)";
      sailContext.beginPath();
      sailContext.moveTo(0,y);
      sailContext.lineTo(256,y);
      sailContext.stroke();
    }
    const sailTexture=new THREE.CanvasTexture(sailCanvas);
    sailTexture.encoding=THREE.sRGBEncoding;
    modelTextures.push(sailTexture);
    const sailMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map:sailTexture, roughness: .95, side: THREE.DoubleSide });
    const shape = new THREE.Shape();
    shape.moveTo(0,-8);
    shape.lineTo(-2.2,-4.8);
    shape.lineTo(-2.8,2.8);
    shape.quadraticCurveTo(-3,6.6,0,8);
    shape.quadraticCurveTo(3,6.6,2.8,2.8);
    shape.lineTo(2.2,-4.8);
    shape.closePath();
    const hullGeometry = new THREE.ExtrudeGeometry(shape,{depth:1.55,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.18,bevelThickness:.2});
    hullGeometry.translate(0,0,-.775);
    hullGeometry.rotateX(-Math.PI/2);
    hullGeometry.rotateY(Math.PI);
    const hull = new THREE.Mesh(hullGeometry,hullMaterial);
    hull.position.y=.9;
    hull.castShadow=true;
    hull.receiveShadow=true;
    shipGroup.add(hull);
    const hullStations=[
      {z:-7.3,top:.18,bottom:.12},
      {z:-5.2,top:1.35,bottom:.86},
      {z:-2.2,top:2.28,bottom:1.62},
      {z:1.5,top:2.62,bottom:1.82},
      {z:4.7,top:2.2,bottom:1.48},
      {z:7.3,top:.18,bottom:.12}
    ];
    const hullVertices=[];
    const hullIndices=[];
    for(const side of [-1,1]){
      const base=hullVertices.length/3;
      hullStations.forEach((station,index)=>{
        const end=index===0||index===hullStations.length-1;
        hullVertices.push(side*station.top,end ? 1.7 : 1.43,station.z);
        hullVertices.push(side*station.bottom,end ? .72 : .12,station.z);
      });
      for(let i=0;i<hullStations.length-1;i++){
        const top=base+i*2;
        const bottom=top+1;
        hullIndices.push(top,bottom,top+2,bottom,bottom+2,top+2);
      }
    }
    const hullSideGeometry=new THREE.BufferGeometry();
    hullSideGeometry.setAttribute("position",new THREE.Float32BufferAttribute(hullVertices,3));
    hullSideGeometry.setIndex(hullIndices);
    hullSideGeometry.computeVertexNormals();
    const hullSides=new THREE.Mesh(hullSideGeometry,new THREE.MeshStandardMaterial({color:0x503026,roughness:.72,side:THREE.DoubleSide}));
    hullSides.castShadow=true;
    hullSides.receiveShadow=true;
    shipGroup.add(hullSides);
    const strakeMaterial=makeMaterial(0x875638,{roughness:.8});
    for(const side of [-1,1]){
      for(const fraction of [.28,.57,.84]){
        const points=hullStations.map(station=>{
          const x=station.bottom+(station.top-station.bottom)*fraction+.055;
          const y=.12+(1.43-.12)*fraction;
          return new THREE.Vector3(side*x,y,station.z);
        });
        const strake=new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),30,.045,5,false),
          strakeMaterial
        );
        shipGroup.add(strake);
      }
    }
    const deckMesh=new THREE.Mesh(new THREE.BoxGeometry(5,.32,11),deck);
    deckMesh.position.set(0,1.3,0);
    deckMesh.castShadow=true;
    shipGroup.add(deckMesh);
    for(let i=0;i<10;i++){
      const board=new THREE.Mesh(new THREE.BoxGeometry(4.65,.035,.075),trim);
      board.position.set(0,1.48,-4.6+i*.98);
      shipGroup.add(board);
    }
    const gunmetal=makeMaterial(0x252a29,{metalness:.62,roughness:.4});
    [-1,1].forEach(side=>{
      [-2.4,.8,4].forEach(z=>{
        const port=new THREE.Mesh(new THREE.CircleGeometry(.23,10),gunmetal);
        port.position.set(side*(z>3?1.65:2.48),1.03,z);
        port.rotation.y=side*Math.PI/2;
        shipGroup.add(port);
      });
      [-1.4,2.2].forEach(z=>{
        const cannon=new THREE.Mesh(new THREE.CylinderGeometry(.13,.17,.9,8),gunmetal);
        cannon.position.set(side*2.65,1.03,z);
        cannon.rotation.z=Math.PI/2;
        cannon.castShadow=true;
        shipGroup.add(cannon);
      });
    });
    [-2.7,2.7].forEach(side=>{
      const rail=new THREE.Mesh(new THREE.BoxGeometry(.24,.55,9.3),trim);
      rail.position.set(side,1.75,0);
      rail.castShadow=true;
      shipGroup.add(rail);
      for(let i=0;i<5;i++){
        const post=new THREE.Mesh(new THREE.CylinderGeometry(.105,.13,.95,6),hullMaterial);
        post.position.set(side,1.65,-4+i*2);
        post.castShadow=true;
        shipGroup.add(post);
      }
    });
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.19,.28,15,9),trim);
    mast.position.set(0,8.2,-1);
    mast.castShadow=true;
    shipGroup.add(mast);
    const makeSail=(width,height,bulge,material)=>{
      const columns=8;
      const rows=10;
      const vertices=[];
      const uvs=[];
      const indices=[];
      for(let row=0;row<=rows;row++){
        const v=row/rows;
        for(let column=0;column<=columns;column++){
          const u=column/columns;
          const billow=Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
          vertices.push((u-.5)*width*(.72+.28*(1-v)),v*height,bulge*billow+.12*Math.sin(u*Math.PI*4+v)*billow);
          uvs.push(u,v);
          if(row<rows&&column<columns){
            const a=row*(columns+1)+column;
            const b=a+columns+1;
            indices.push(a,b,a+1,b,b+1,a+1);
          }
        }
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
      geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,material);
      mesh.castShadow=true;
      mesh.userData.sail=true;
      return mesh;
    };
    const sail=makeSail(8.4,10.3,1.05,sailMaterial);
    sail.position.set(0,2.1,-1.1);
    shipGroup.add(sail);
    const rearSail=makeSail(5.4,6.2,.72,new THREE.MeshStandardMaterial({color:0xc5b58d,map:sailTexture,side:THREE.DoubleSide,roughness:1}));
    rearSail.position.set(0,2.1,2.5);
    shipGroup.add(rearSail);
    const riggingMaterial=makeMaterial(0x392c25,{roughness:.92});
    const addRigging=(start,end)=>{
      const from=new THREE.Vector3(...start);
      const to=new THREE.Vector3(...end);
      const direction=to.clone().sub(from);
      const rope=new THREE.Mesh(
        new THREE.CylinderGeometry(.035,.045,direction.length(),5),
        riggingMaterial
      );
      rope.position.copy(from).add(to).multiplyScalar(.5);
      rope.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
      shipGroup.add(rope);
    };
    [[-4.1,12.5,-1],[4.1,12.5,-1],[-2.7,7,-1],[2.7,7,-1]].forEach(([x,y,z])=>{
      addRigging([x,y,z],[0,15.7,-1]);
    });
    addRigging([0,8,-1],[0,2.5,-9.6]);
    const bowsprit=new THREE.Mesh(new THREE.CylinderGeometry(.11,.17,9,7),trim);
    bowsprit.position.set(0,2.15,-7.2);
    bowsprit.rotation.x=Math.PI/2;
    shipGroup.add(bowsprit);
    [[8.4,12.6],[5.4,7],[7.8,2.2]].forEach(([width,y])=>{
      const yard=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,width,7),trim);
      yard.rotation.z=Math.PI/2;
      yard.position.set(0,y,-1.1);
      shipGroup.add(yard);
    });
    const flagCanvas=document.createElement("canvas");
    flagCanvas.width=256;flagCanvas.height=128;
    const flagContext=flagCanvas.getContext("2d");
    flagContext.fillStyle="#332925";
    flagContext.fillRect(0,0,256,128);
    flagContext.fillStyle="#e6d5aa";
    flagContext.beginPath();
    flagContext.arc(125,57,28,0,Math.PI*2);
    flagContext.fill();
    flagContext.fillStyle="#332925";
    flagContext.beginPath();
    flagContext.arc(115,54,4,0,Math.PI*2);
    flagContext.arc(135,54,4,0,Math.PI*2);
    flagContext.fill();
    flagContext.fillRect(116,67,18,4);
    flagContext.strokeStyle="#e6d5aa";
    flagContext.lineWidth=7;
    flagContext.beginPath();flagContext.moveTo(98,91);flagContext.lineTo(154,105);flagContext.moveTo(154,91);flagContext.lineTo(98,105);flagContext.stroke();
    const flagTexture=new THREE.CanvasTexture(flagCanvas);
    modelTextures.push(flagTexture);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.6),new THREE.MeshBasicMaterial({map:flagTexture,side:THREE.DoubleSide}));
    flag.position.set(0,15.7,-1);
    shipGroup.add(flag);
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.72,.07,6,12),trim);
    wheel.position.set(0,2,4.35);
    wheel.rotation.x=Math.PI/2;
    shipGroup.add(wheel);
    const wheelHub=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.3,8),hullMaterial);
    wheelHub.position.set(0,2,4.35);
    shipGroup.add(wheelHub);
    const lanternMaterial=new THREE.MeshStandardMaterial({color:0xf0c675,emissive:0xc3782d,emissiveIntensity:1.7});
    [-2.3,2.3].forEach(x=>{
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.22,8,7),lanternMaterial);
      lamp.position.set(x,2.6,3.8);
      shipGroup.add(lamp);
    });
    shipGroup.scale.set(1.12,1.06,1.12);
    return shipGroup;
  }

  function makeChest() {
    const chest = new THREE.Group();
    const wood = makeMaterial(0x65412a,{roughness:.74});
    const metal = makeMaterial(0xd0a14f,{metalness:.52,roughness:.34});
    const base=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.9,2.3),wood);
    base.position.y=.98;
    base.castShadow=true;
    base.receiveShadow=true;
    chest.add(base);
    const lid=new THREE.Mesh(new THREE.SphereGeometry(1.6,12,8,0,Math.PI*2,0,Math.PI/2),wood);
    lid.scale.z=.72;
    lid.position.y=1.86;
    lid.rotation.x=Math.PI;
    lid.castShadow=true;
    chest.add(lid);
    [-1.25,1.25].forEach(x=>{
      const strap=new THREE.Mesh(new THREE.BoxGeometry(.3,2.5,2.38),metal);
      strap.position.set(x,1.08,0);
      chest.add(strap);
    });
    const lock=new THREE.Mesh(new THREE.BoxGeometry(.54,.65,.16),metal);
    lock.position.set(0,1.12,1.2);
    chest.add(lock);
    const glow=new THREE.PointLight(0xf3be56,2,24,2);
    glow.position.set(0,3.4,0);
    chest.add(glow);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(3,.09,6,32),new THREE.MeshBasicMaterial({color:0xe9c371,transparent:true,opacity:.8}));
    ring.rotation.x=Math.PI/2;
    ring.position.y=.18;
    chest.add(ring);
    return chest;
  }

  function setIntroCamera() {
    camera.position.set(52,54,336);
    camera.lookAt(0,18,30);
  }

  function resize() {
    const rect=arena.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    renderer.setSize(rect.width,rect.height,false);
    camera.aspect=rect.width/rect.height;
    camera.updateProjectionMatrix();
  }

  function updateCamera(dt) {
    if(state==="menu"){
      const t=performance.now()*.00012;
      camera.position.lerp(new THREE.Vector3(52+Math.sin(t)*3,54+Math.sin(t*1.7)*1.5,336),.025);
      camera.lookAt(0,18,30);
      return;
    }
    if(captain.boat){
      const forward=forwardFor(shipYaw);
      const starboard=new THREE.Vector3(Math.cos(shipYaw),0,Math.sin(shipYaw));
      const heightOffset=15+Math.tan(cameraPitch-.42)*24;
      const desired=captain.position.clone()
        .add(new THREE.Vector3(0,heightOffset,0))
        .addScaledVector(forward,-32)
        .addScaledVector(starboard,12);
      camera.position.lerp(desired,1-Math.exp(-4*dt));
      const look=captain.position.clone().add(new THREE.Vector3(0,3,0)).addScaledVector(forward,15);
      camera.lookAt(look);
      camera.fov=62;
      camera.updateProjectionMatrix();
    }else{
      const distance=9.4;
      const horizontalDistance=distance*Math.cos(cameraPitch);
      const behind=new THREE.Vector3(-Math.sin(cameraYaw)*horizontalDistance,1.7+Math.sin(cameraPitch)*distance,Math.cos(cameraYaw)*horizontalDistance);
      const desired=captain.position.clone().add(behind);
      camera.position.lerp(desired,1-Math.exp(-5.8*dt));
      const look=captain.position.clone().add(new THREE.Vector3(0,2,0));
      camera.lookAt(look);
      camera.fov=60;
      camera.updateProjectionMatrix();
    }
  }

  function setCaptainName(name) {
    captainName=name.trim().slice(0,18)||"Captain";
    $("#captain-display").textContent=captainName.toUpperCase();
    $("#footer-captain").textContent=captainName.toUpperCase();
  }

  function beginCampaign() {
    const name=captainInput.value.trim();
    if(!name){
      captainInput.setCustomValidity("Enter a captain name before setting sail.");
      captainInput.reportValidity();
      captainInput.focus();
      return;
    }
    captainInput.setCustomValidity("");
    setCaptainName(name);
    gold=0;
    health=100;
    specialCooldown=0;
    campaign=levelData.map(()=>({status:"unvisited",kills:0}));
    targetIsland=0;
    currentIsland=-1;
    phase="voyage";
    state="playing";
    captain.boat=true;
    captain.position.set(levelData[0].center.x,-4.5,levelData[0].center.y+282);
    captainModel.visible=true;
    shipYaw=0;
    shipTurnVelocity=0;
    cameraYaw=0;
    cameraPitch=.42;
    shipSpeed=0;
    firebombCooldown=0;
    intro.classList.add("hidden");
    hud.classList.remove("hidden");
    updateShip();
    updateHud();
    startMusic();
    playTone(440,.18,"triangle",.04);
    showStoryCard("PROLOGUE · THE TIDELESS CHART","The sea knows your name","A stolen chart marks three islands. At its edge, in your handwriting, are four words: “Finish what you buried.”");
  }

  function startIsland(index) {
    if(index<0||index>=levelData.length)return;
    currentIsland=index;
    targetIsland=index;
    campaign[index].status="active";
    phase="combat";
    health=Math.max(health,85);
    spawnGuards(index);
    showStoryCard(levelData[index].chapter,levelData[index].name,levelData[index].story);
    showToast(`${levelData[index].title} · defeat its guardians`);
    updateHud();
  }

  function spawnGuards(index) {
    clearGuards();
    const config=levelData[index];
    const offsets=[
      [-70,-28],[68,-55],[59,63],[-62,61],[0,-86],[-104,15],[104,17]
    ];
    for(let i=0;i<config.guards;i++){
      const boss=index===2&&i===config.guards-1;
      const model=createGuard(boss,index);
      const [x,z]=offsets[i%offsets.length];
      const y=sampleTerrain(index,x,z);
      const scale=boss?1.55:1;
      model.position.set(config.center.x+x,y,config.center.y+z);
      world.add(model);
      guards.push({
        model,
        x:config.center.x+x,
        z:config.center.y+z,
        hp:(boss?14:3+index)*scale,
        maxHp:(boss?14:3+index)*scale,
        speed:(boss?2.45:2.05)+index*.72,
        attackCooldown:.7+i*.42,
        attackTime:0,
        boss,
        phase:Math.random()*Math.PI*2
      });
    }
  }

  function clearGuards() {
    guards.forEach(guard=>world.remove(guard.model));
    guards.length=0;
  }

  function calculateIslandRadius(index,x,z) {
    const center=levelData[index].center;
    const localX=x-center.x;
    const localZ=z-center.y;
    return Math.hypot(localX/190,localZ/157);
  }

  function nearestIsland(x,z) {
    let best=null;
    for(let i=0;i<levelData.length;i++){
      const center=levelData[i].center;
      const dx=x-center.x;
      const dz=z-center.y;
      const radius=calculateIslandRadius(i,x,z);
      const distance=Math.hypot(dx,dz);
      if(!best||radius<best.radius)best={index:i,radius,distance,dx,dz};
    }
    return best;
  }

  function dockPosition(index) {
    const center=levelData[index].center;
    return new THREE.Vector3(center.x,0,center.y+193);
  }

  function updateShip() {
    if(!ship)return;
    if(captain.boat){
      ship.visible=true;
      ship.position.set(captain.position.x,captain.position.y+.06,captain.position.z);
      const time=performance.now()*.001;
      ship.rotation.set(Math.sin(time*1.1)*.018,shipYaw,Math.sin(time*1.7)*.032);
      ship.children.filter(child=>child.userData.sail).forEach((sail,index)=>{
        sail.rotation.z=Math.sin(time*1.4+index*.8)*.035;
      });
      captainModel.visible=true;
      const deckPosition=new THREE.Vector3(0,1.52,3.8).applyAxisAngle(new THREE.Vector3(0,1,0),shipYaw);
      captainModel.position.set(ship.position.x+deckPosition.x,ship.position.y+deckPosition.y,ship.position.z+deckPosition.z);
      captainModel.rotation.y=Math.PI-shipYaw;
      animateHuman(captainModel,Math.min(1,Math.abs(shipSpeed)/25)*.35,time,false);
    }else{
      const index=Math.max(0,currentIsland);
      const dock=dockPosition(index);
      ship.visible=true;
      ship.position.set(dock.x,-4.05,dock.z);
      ship.rotation.set(Math.sin(performance.now()*.0011)*.012,0,Math.sin(performance.now()*.0013)*.02);
    }
  }

  function keepShipOffLand(previousX,previousZ) {
    const safeRadius=1.22;
    levelData.forEach(island=>{
      const dx=captain.position.x-island.center.x;
      const dz=captain.position.z-island.center.y;
      const radius=Math.hypot(dx/190,dz/157);
      if(radius>=safeRadius)return;
      const previousRadius=Math.hypot((previousX-island.center.x)/190,(previousZ-island.center.y)/157);
      if(previousRadius<safeRadius&&radius>=previousRadius)return;
      const angle=radius>.001?Math.atan2(dz/157,dx/190):Math.atan2((previousZ-island.center.y)/157,(previousX-island.center.x)/190);
      captain.position.x=island.center.x+Math.cos(angle)*190*safeRadius;
      captain.position.z=island.center.y+Math.sin(angle)*157*safeRadius;
      shipSpeed=0;
    });
  }

  function updatePlayer(dt,time) {
    if(respawnTimer>0){
      respawnTimer-=dt;
      if(respawnTimer<=0){
        health=70;
        const index=Math.max(0,currentIsland);
        const center=levelData[index].center;
        captain.position.set(center.x,0,center.y+103);
        captain.boat=false;
        showToast("Back from the brink · find your footing");
      }
      if(respawnTimer>0)return;
    }
    if(captain.boat){
      const movingForward=keys.has("KeyW")||keys.has("ArrowUp");
      const movingBackward=keys.has("KeyS")||keys.has("ArrowDown");
      const turning=(keys.has("KeyD")||keys.has("ArrowRight")?1:0)-(keys.has("KeyA")||keys.has("ArrowLeft")?1:0);
      const boost=keys.has("ShiftLeft")||keys.has("ShiftRight");
      const rudderAuthority=THREE.MathUtils.clamp(Math.abs(shipSpeed)/12,.12,1);
      const targetTurn=turning*(boost ? .58 : .38)*rudderAuthority;
      shipTurnVelocity=THREE.MathUtils.lerp(shipTurnVelocity,targetTurn,1-Math.exp(-2.2*dt));
      shipYaw+=shipTurnVelocity*dt;
      const targetSpeed=movingForward?(boost?27:18):movingBackward?-7:0;
      shipSpeed=THREE.MathUtils.lerp(shipSpeed,targetSpeed,Math.min(1,dt*1.5));
      const direction=forwardFor(shipYaw);
      const previousX=captain.position.x;
      const previousZ=captain.position.z;
      captain.position.addScaledVector(direction,shipSpeed*dt);
      keepShipOffLand(previousX,previousZ);
      captain.position.y=-4.5+Math.sin(time*1.4)*.28;
    }else{
      const forwardAxis=(keys.has("KeyW")||keys.has("ArrowUp")?1:0)-(keys.has("KeyS")||keys.has("ArrowDown")?1:0);
      const sideAxis=(keys.has("KeyD")||keys.has("ArrowRight")?1:0)-(keys.has("KeyA")||keys.has("ArrowLeft")?1:0);
      const running=keys.has("ShiftLeft")||keys.has("ShiftRight");
      const movement=new THREE.Vector3(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw)).multiplyScalar(forwardAxis)
        .add(new THREE.Vector3(Math.cos(cameraYaw),0,-Math.sin(cameraYaw)).multiplyScalar(sideAxis));
      if(movement.lengthSq()>0){
        movement.normalize();
        const speed=running?15:9.1;
        captain.position.addScaledVector(movement,speed*dt);
        captain.yaw=Math.atan2(movement.x,-movement.z);
      }
      const island=currentIsland;
      if(island>=0){
        const center=levelData[island].center;
        const dx=captain.position.x-center.x;
        const dz=captain.position.z-center.y;
        const r=Math.hypot(dx/190,dz/157);
        if(r>.965){
          const factor=.958/r;
          captain.position.x=center.x+dx*factor;
          captain.position.z=center.y+dz*factor;
        }
        captain.position.y=sampleTerrain(island,captain.position.x-center.x,captain.position.z-center.y);
      }
      captainModel.visible=true;
      captainModel.position.set(captain.position.x,captain.position.y,captain.position.z);
      captainModel.rotation.y=Math.PI-captain.yaw;
      animateHuman(captainModel,playerSwing>0?1:movementLength(forwardAxis,sideAxis),time,playerSwing>0);
      if(playerSwing>0)playerSwing=Math.max(0,playerSwing-dt);
    }
    updateShip();
  }

  function movementLength(x,z){return Math.hypot(x,z);}

  function animateHuman(model,speed,time,attacking){
    const user=model.userData;
    if(!user?.legs)return;
    const walk=Math.sin(time*10)*Math.min(1,speed);
    user.legs[0].rotation.x=walk*.62;
    user.legs[1].rotation.x=-walk*.62;
    user.arms[0].rotation.x=-walk*.34;
    if(attacking){
      user.arms[1].rotation.x=-Math.sin(time*16)*.9;
      user.arms[1].rotation.z=-.8+Math.sin(time*16)*.4;
    }else{
      user.arms[1].rotation.x=walk*.3;
      user.arms[1].rotation.z=-.08;
    }
    user.root.position.y=Math.abs(walk)*.045;
  }

  function updateGuards(dt,time) {
    if(captain.boat||currentIsland<0||phase!=="combat")return;
    guards.forEach(guard=>{
      if(guard.attackTime>0){
        guard.attackTime-=dt;
        if(guard.attackTime<0)guard.attackTime=0;
      }
      const dx=captain.position.x-guard.x;
      const dz=captain.position.z-guard.z;
      const distance=Math.hypot(dx,dz)||.001;
      guard.model.rotation.y=Math.atan2(dx,-dz);
      const user=guard.model.userData;
      const walk=distance>2.65?Math.sin(time*8+guard.phase)*.55:0;
      user.legs[0].rotation.x=walk;
      user.legs[1].rotation.x=-walk;
      user.arms[0].rotation.x=-walk*.45;
      user.arms[1].rotation.x=guard.attackTime>0?-Math.sin(guard.attackTime*17)*.9:walk*.35;
      if(distance>2.6&&distance<39){
        const step=guard.speed*dt;
        guard.x+=(dx/distance)*step;
        guard.z+=(dz/distance)*step;
        guard.model.position.x=guard.x;
        guard.model.position.z=guard.z;
        guard.model.position.y=sampleTerrain(currentIsland,guard.x-levelData[currentIsland].center.x,guard.z-levelData[currentIsland].center.y);
      }
      guard.attackCooldown-=dt;
      if(distance<3.7&&guard.attackCooldown<=0&&respawnTimer<=0){
        guard.attackCooldown=Math.max(.82,1.65-currentIsland*.2);
        guard.attackTime=.48;
        const damage=guard.boss?20:11+currentIsland*3;
        health=Math.max(0,health-damage);
        showToast(guard.boss?"The island champion struck you!":"A shore guard landed a hit!");
        playTone(104,.19,"sawtooth",.04);
        if(health<=0)startRespawn();
        updateHud();
      }
    });
  }

  function startRespawn(){
    health=0;
    respawnTimer=2.5;
    captainModel.visible=false;
    showToast("You were overwhelmed · returning to the shore...");
  }

  function attack(){
    if(captain.boat){
      if(cannonCooldown>0)return;
      cannonCooldown=.8;
      fireCannon(shipYaw,0);
      return;
    }
    if(attackCooldown>0||phase!=="combat")return;
    attackCooldown=.55;
    playerSwing=.27;
    playTone(295,.1,"triangle",.045);
    const forward=forwardFor(captain.yaw);
    const target=guards
      .map(guard=>({guard,dx:guard.x-captain.position.x,dz:guard.z-captain.position.z}))
      .map(item=>({...item,distance:Math.hypot(item.dx,item.dz)}))
      .filter(item=>item.distance<5.4&&item.distance>0)
      .find(item=>(item.dx*forward.x+item.dz*forward.z)/item.distance>-.25);
    if(target)damageGuard(target.guard,2);
    else showToast("Cutlass swing · close the distance");
  }

  function specialAttack(){
    if(state!=="playing"||specialCooldown>0)return;
    specialCooldown=8;
    if(captain.boat){
      for(let i=-1;i<=1;i++)fireCannon(shipYaw+i*.105,0);
      playTone(92,.42,"sawtooth",.075);
      showToast("Broadside! Three cannonballs away!");
      return;
    }
    if(phase!=="combat"){
      showToast("No enemies in range · save your storm strike");
      specialCooldown=1;
      return;
    }
    const ring=new THREE.Mesh(
      new THREE.TorusGeometry(1,.18,8,44),
      new THREE.MeshBasicMaterial({color:0xf4cb78,transparent:true,opacity:.92})
    );
    ring.rotation.x=Math.PI/2;
    ring.position.set(captain.position.x,captain.position.y+.28,captain.position.z);
    scene.add(ring);
    effects.push({object:ring,life:.72,maxLife:.72,kind:"shockwave"});
    const targets=guards.filter(guard=>Math.hypot(guard.x-captain.position.x,guard.z-captain.position.z)<13);
    targets.forEach(guard=>damageGuard(guard,5));
    playTone(165,.38,"triangle",.075);
    playTone(494,.2,"sine",.05);
    showToast(targets.length?`Storm strike! ${targets.length} guard${targets.length===1?"":"s"} hit`:"The storm answers · no guard in range");
  }

  function throwFirebomb(){
    if(captain.boat){
      showToast("Firebombs can only be thrown ashore");
      return;
    }
    if(phase!=="combat"){
      showToast("Save the firebomb for the island guardians");
      return;
    }
    if(firebombCooldown>0)return;
    firebombCooldown=12;
    const glass=new THREE.MeshStandardMaterial({color:0x40523b,roughness:.24,metalness:.18,emissive:0x38170a,emissiveIntensity:.42});
    const cork=makeMaterial(0x9a7043);
    const bottle=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.27,.68,9),glass);
    body.castShadow=true;
    bottle.add(body);
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(.095,.12,.24,8),glass);
    neck.position.y=.43;
    bottle.add(neck);
    const stopper=new THREE.Mesh(new THREE.CylinderGeometry(.08,.09,.13,7),cork);
    stopper.position.y=.61;
    bottle.add(stopper);
    const wick=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.2,5),cork);
    wick.position.y=.76;
    bottle.add(wick);
    const ember=new THREE.Mesh(new THREE.SphereGeometry(.12,7,6),new THREE.MeshBasicMaterial({color:0xff9a32}));
    ember.position.y=.86;
    bottle.add(ember);
    const direction=forwardFor(captain.yaw);
    bottle.position.copy(captain.position).add(new THREE.Vector3(0,1.85,0)).addScaledVector(direction,1.3);
    bottle.rotation.x=-.28;
    scene.add(bottle);
    projectiles.push({
      mesh:bottle,
      velocity:direction.multiplyScalar(17).add(new THREE.Vector3(0,10,0)),
      life:2.5,
      kind:"firebomb"
    });
    playTone(235,.12,"triangle",.04);
    showToast("Firebomb away!");
    updateHud();
  }

  function explodeFirebomb(x,z){
    if(currentIsland<0)return;
    const island=levelData[currentIsland];
    const groundY=sampleTerrain(currentIsland,x-island.center.x,z-island.center.y);
    const ring=new THREE.Mesh(
      new THREE.TorusGeometry(1,.16,8,36),
      new THREE.MeshBasicMaterial({color:0xff9b3d,transparent:true,opacity:.9})
    );
    ring.rotation.x=Math.PI/2;
    ring.position.set(x,groundY+.24,z);
    scene.add(ring);
    effects.push({object:ring,life:.55,maxLife:.55,kind:"shockwave"});
    const flame=new THREE.Mesh(
      new THREE.SphereGeometry(1.35,10,8),
      new THREE.MeshBasicMaterial({color:0xff702e,transparent:true,opacity:.78})
    );
    flame.position.set(x,groundY+1.6,z);
    scene.add(flame);
    effects.push({object:flame,life:.3,maxLife:.3,kind:"flame"});
    const light=new THREE.PointLight(0xff762e,3,18,2);
    light.position.set(x,groundY+2,z);
    scene.add(light);
    effects.push({object:light,life:.24,maxLife:.24,kind:"light"});
    const targets=guards.filter(guard=>Math.hypot(guard.x-x,guard.z-z)<10);
    targets.forEach(guard=>damageGuard(guard,6));
    playTone(108,.3,"sawtooth",.065);
    showToast(targets.length?`Firebomb blast · ${targets.length} guardian${targets.length===1?"":"s"} hit`:"Firebomb burst!");
  }

  function fireCannon(yaw,spread){
    const direction=forwardFor(yaw+spread);
    const ball=new THREE.Mesh(
      new THREE.SphereGeometry(.48,10,8),
      new THREE.MeshStandardMaterial({color:0x202226,roughness:.4,metalness:.18,emissive:0x542a0c,emissiveIntensity:.42})
    );
    const start=captain.position.clone().add(new THREE.Vector3(0,1.2,0)).addScaledVector(direction,4);
    ball.position.copy(start);
    ball.castShadow=true;
    scene.add(ball);
    projectiles.push({mesh:ball,velocity:direction.clone().multiplyScalar(44).add(new THREE.Vector3(0,5,0)),life:3});
    const flash=new THREE.PointLight(0xffb255,2.5,13,2);
    flash.position.copy(start);
    scene.add(flash);
    effects.push({object:flash,life:.12,maxLife:.12,kind:"light"});
    playTone(83,.32,"sawtooth",.075);
  }

  function damageGuard(guard,damage){
    guard.hp-=damage;
    const material=guard.model.userData.root.children.find(child=>child.material)?.material;
    if(material){
      const original=material.color.clone();
      material.color.set(0xe4a078);
      window.setTimeout(()=>material.color.copy(original),100);
    }
    const spark=new THREE.Mesh(new THREE.SphereGeometry(.48,8,6),new THREE.MeshBasicMaterial({color:0xffd686}));
    spark.position.set(guard.x,guard.model.position.y+2.2,guard.z);
    scene.add(spark);
    effects.push({object:spark,life:.18,maxLife:.18,kind:"spark"});
    if(guard.hp<=0){
      const index=guards.indexOf(guard);
      if(index!==-1)guards.splice(index,1);
      world.remove(guard.model);
      const reward=guard.boss?35:10+currentIsland*4;
      gold+=reward;
      campaign[currentIsland].kills++;
      showToast(`${guard.boss?"Champion defeated":"Shore guard defeated"} · +${reward} gold`);
      updateHud();
      if(guards.length===0)revealTreasure();
    }else{
      const dx=guard.x-captain.position.x;
      const dz=guard.z-captain.position.z;
      const distance=Math.hypot(dx,dz)||1;
      guard.x+=dx/distance*1.3;
      guard.z+=dz/distance*1.3;
    }
  }

  function revealTreasure(){
    phase="treasure";
    campaign[currentIsland].status="ready";
    const island=levelData[currentIsland];
    treasure=makeChest();
    treasure.position.set(island.center.x+8,sampleTerrain(currentIsland,8,-17),island.center.y-17);
    treasure.rotation.y=.3;
    scene.add(treasure);
    const light=new THREE.PointLight(0xe3bc68,2.4,70,2);
    light.position.set(island.center.x+8,treasure.position.y+6,island.center.y-17);
    treasure.add(light);
    showToast("All clear · the island treasure has surfaced");
    updateHud();
  }

  function claimTreasure(){
    if(phase!=="treasure"||!treasure)return;
    const reward=levelData[currentIsland].reward;
    gold+=reward;
    campaign[currentIsland].status="cleared";
    scene.remove(treasure);
    treasure=null;
    $("#mission-kicker").textContent=`ISLAND ${String(currentIsland+1).padStart(2,"0")} · TREASURE CLAIMED`;
    if(currentIsland===levelData.length-1){
      state="victory";
      $("#mission-title").textContent=`The Shattered Cays are yours, ${captainName}.`;
      $("#mission-copy").textContent=`${levelData[currentIsland].clue} You survived all three islands and return with ${gold} gold.`;
      $("#mission-button").textContent="SAIL AGAIN";
      $("#campaign-status").textContent="CAMPAIGN COMPLETE · LEGEND MADE";
    }else{
      state="mission";
      targetIsland=currentIsland+1;
      $("#mission-title").textContent=`${levelData[currentIsland+1].title} is on the horizon.`;
      $("#mission-copy").textContent=`${levelData[currentIsland].clue} You claim ${reward} gold. Return to the dock; the next clue is waiting at ${levelData[currentIsland+1].name}.`;
      $("#mission-button").innerHTML="BACK TO THE ISLAND <span aria-hidden=\"true\">→</span>";
    }
    missionOverlay.classList.remove("hidden");
    playTone(660,.25,"triangle",.06);
    updateHud();
  }

  function interact(){
    if(state!=="playing")return;
    if(captain.boat){
      const island=nearestIsland(captain.position.x,captain.position.z);
      if(island.radius<1.31&&island.radius>1.1){
        if(island.index!==targetIsland){
          showToast(`Follow your chart to ${levelData[targetIsland].name} first`);
          return;
        }
        captain.boat=false;
        shipSpeed=0;
        const info=levelData[island.index];
        const dx=island.dx/190;
        const dz=island.dz/157;
        const length=Math.hypot(dx,dz)||1;
        captain.position.set(info.center.x+dx/length*135,0,info.center.y+dz/length*115);
        captain.position.y=sampleTerrain(island.index,captain.position.x-info.center.x,captain.position.z-info.center.y);
        cameraYaw=shipYaw;
        if(campaign[island.index].status==="unvisited"){
          startIsland(island.index);
        }else if(campaign[island.index].status==="ready"){
          phase="treasure";
        }else if(campaign[island.index].status==="cleared"){
          phase="voyage";
          currentIsland=island.index;
          targetIsland=Math.min(island.index+1,levelData.length-1);
        }else{
          currentIsland=island.index;
          phase="combat";
        }
        showToast(`Came ashore at ${info.name}`);
        updateHud();
      }else{
        showToast("Bring the ship alongside the long pier to come ashore");
      }
      return;
    }
    if(phase==="treasure"&&treasure&&captain.position.distanceTo(treasure.position)<11){
      claimTreasure();
      return;
    }
    const index=Math.max(0,currentIsland);
    const dock=dockPosition(index);
    const distance=Math.hypot(captain.position.x-dock.x,captain.position.z-dock.z);
    if(distance<52){
      captain.boat=true;
      const destination=campaign[index].status==="cleared"?Math.min(index+1,levelData.length-1):index;
      targetIsland=destination;
      const target=levelData[destination].center;
      shipYaw=Math.atan2(target.x-captain.position.x,-(target.y-captain.position.z));
      cameraYaw=shipYaw;
      captain.position.set(dock.x,-4.5,dock.z);
      phase="voyage";
      showToast(`Ship ready · sailing for ${levelData[destination].name}`);
      updateHud();
      return;
    }
    if(phase==="treasure"&&treasure){
      showToast("The relic chest is marked by a golden beacon");
    }else{
      showToast("Find your ship at the island dock to set sail");
    }
  }

  function updateProjectiles(dt){
    for(let i=projectiles.length-1;i>=0;i--){
      const projectile=projectiles[i];
      projectile.life-=dt;
      projectile.velocity.y-=(projectile.kind==="firebomb"?19:17)*dt;
      projectile.mesh.position.addScaledVector(projectile.velocity,dt);
      projectile.mesh.rotation.x+=dt*8;
      projectile.mesh.rotation.z+=dt*5;
      if(projectile.kind==="firebomb"){
        const island=levelData[currentIsland];
        const terrain=sampleTerrain(currentIsland,projectile.mesh.position.x-island.center.x,projectile.mesh.position.z-island.center.y);
        const hitGuard=guards.some(guard=>Math.hypot(guard.x-projectile.mesh.position.x,guard.z-projectile.mesh.position.z)<2.4&&projectile.mesh.position.y>guard.model.position.y);
        if(hitGuard||projectile.mesh.position.y<=terrain+.35||projectile.life<=0){
          explodeFirebomb(projectile.mesh.position.x,projectile.mesh.position.z);
          scene.remove(projectile.mesh);
          projectiles.splice(i,1);
          continue;
        }
      }else if(currentIsland>=0&&!captain.boat){
        const target=guards.find(guard=>Math.hypot(guard.x-projectile.mesh.position.x,guard.z-projectile.mesh.position.z)<2.9&&projectile.mesh.position.y>guard.model.position.y);
        if(target){
          damageGuard(target,4);
          scene.remove(projectile.mesh);
          projectiles.splice(i,1);
          showToast("Cannonball struck a shore guardian!");
          continue;
        }
      }
      if(projectile.life<=0||projectile.mesh.position.y<-4){
        scene.remove(projectile.mesh);
        projectiles.splice(i,1);
      }
    }
  }

  function updateEffects(dt){
    for(let i=effects.length-1;i>=0;i--){
      const effect=effects[i];
      effect.life-=dt;
      const t=1-Math.max(0,effect.life)/effect.maxLife;
      if(effect.kind==="shockwave"){
        const scale=1+t*15;
        effect.object.scale.set(scale,scale,scale);
        effect.object.material.opacity=1-t;
      }else if(effect.kind==="light"){
        effect.object.intensity=Math.max(0,1-t)*2.5;
      }else{
        effect.object.scale.setScalar(1+t*2);
        effect.object.material.opacity=1-t;
      }
      if(effect.life<=0){
        scene.remove(effect.object);
        if(effect.object.material)effect.object.material.dispose();
        effects.splice(i,1);
      }
    }
  }

  function updateMissionHud(){
    const displayIndex=currentIsland>=0?currentIsland:targetIsland;
    const data=levelData[displayIndex];
    levelNumber.textContent=`LEVEL ${String(displayIndex+1).padStart(2,"0")} / 03`;
    levelTitle.textContent=data.name;
    difficultyLabel.textContent=data.difficulty;
    $("#campaign-status").textContent=`YOUR STORY · ${campaign.filter(item=>item.status==="cleared").length} / 3 ISLANDS`;
    document.querySelectorAll(".campaign-dots i").forEach((dot,index)=>{
      dot.classList.toggle("done",campaign[index]?.status==="cleared");
    });
    updateCompass();

    if(captain.boat){
      const shoreRadius=calculateIslandRadius(targetIsland,captain.position.x,captain.position.z);
      const toCoast=Math.max(0,(shoreRadius-1.15)*172);
      objective.textContent=shoreRadius<1.31&&shoreRadius>1.1
        ?`Shore reached · press E to land at ${levelData[targetIsland].name}`
        :phase==="voyage"?`Sail to ${levelData[targetIsland].name} · steer around the coast`:"Return to the island shore";
      distanceLabel.textContent=`SHORE APPROACH · ${Math.round(toCoast)} m`;
      if(shoreRadius<1.31&&shoreRadius>1.1){
        centerPrompt.textContent="E · COME ASHORE";
        centerPrompt.classList.remove("hidden");
      }else{
        centerPrompt.classList.add("hidden");
      }
      return;
    }

    distanceLabel.textContent=phase==="combat"?`GUARDIANS REMAINING · ${guards.length}`:phase==="treasure"?"RELIC DETECTED · FIND THE GOLDEN LIGHT":"TREASURE HELD · RETURN TO THE DOCK";
    if(phase==="combat"){
      objective.textContent=`Defeat the island guardians · ${guards.length} remain`;
    }else if(phase==="treasure"){
      objective.textContent="The guardians are gone. Find the relic chest and press E.";
    }else{
      objective.textContent=`${campaign[currentIsland]?.status==="cleared"?"Sail for "+levelData[targetIsland].name:"Board your ship at the dock to set sail"}`;
    }

    let prompt="";
    if(phase==="treasure"&&treasure&&captain.position.distanceTo(treasure.position)<11)prompt="E · CLAIM THE ISLAND TREASURE";
    else if(currentIsland>=0&&Math.hypot(captain.position.x-dockPosition(currentIsland).x,captain.position.z-dockPosition(currentIsland).z)<52)prompt="E · BOARD YOUR SHIP";
    if(prompt){
      centerPrompt.textContent=prompt;
      centerPrompt.classList.remove("hidden");
    }else{
      centerPrompt.classList.add("hidden");
    }
  }

  function updateHud(){
    healthFill.style.width=`${health}%`;
    $("#health-value").textContent=`${Math.ceil(health)}%`;
    specialFill.style.width=`${Math.max(0,1-specialCooldown/8)*100}%`;
    $("#special-label").textContent=specialCooldown<=0?"Q · SPECIAL READY":`Q · SPECIAL ${specialCooldown.toFixed(1)}s`;
    $("#firebomb-fill").style.width=`${Math.max(0,1-firebombCooldown/12)*100}%`;
    $("#firebomb-label").textContent=firebombCooldown<=0?"R · FIREBOMB READY":`R · FIREBOMB ${firebombCooldown.toFixed(1)}s`;
    $("#gold-value").textContent=String(gold).padStart(3,"0");
    updateMissionHud();
  }

  function showToast(message){
    toastElement.textContent=message;
    toastElement.classList.remove("hidden");
    toastTimer=2.1;
  }

  function showStoryCard(chapter,title,copy){
    $("#story-kicker").textContent=chapter;
    $("#story-title").textContent=title;
    $("#story-copy").textContent=copy;
    storyCard.classList.remove("hidden");
    storyCard.classList.remove("story-card-enter");
    void storyCard.offsetWidth;
    storyCard.classList.add("story-card-enter");
    storyTimer=8;
  }

  function updateStoryCard(dt){
    if(storyTimer<=0)return;
    storyTimer-=dt;
    if(storyTimer<=0)storyCard.classList.add("hidden");
  }

  function updateToast(dt){
    if(toastTimer<=0)return;
    toastTimer-=dt;
    if(toastTimer<=0)toastElement.classList.add("hidden");
  }

  function updateInteraction(dt){
    if(!captain||state!=="playing")return;
    updateMissionHud();
  }

  function update(dt,time){
    if(state!=="playing")return;
    if(specialCooldown>0)specialCooldown=Math.max(0,specialCooldown-dt);
    if(attackCooldown>0)attackCooldown=Math.max(0,attackCooldown-dt);
    if(cannonCooldown>0)cannonCooldown=Math.max(0,cannonCooldown-dt);
    if(firebombCooldown>0)firebombCooldown=Math.max(0,firebombCooldown-dt);
    updatePlayer(dt,time);
    updateGuards(dt,time);
    updateProjectiles(dt);
    updateEffects(dt);
    updateToast(dt);
    updateInteraction(dt);
    updateStoryCard(dt);
    updateHud();
  }

  function frame(timestamp){
    const time=timestamp*.001;
    const dt=lastFrame?Math.min((timestamp-lastFrame)*.001,.04):0;
    lastFrame=timestamp;
    if(waterMaterial)waterMaterial.uniforms.time.value=time;
    if(state==="playing")update(dt,time);
    else if(state==="menu")updateToast(dt);
    if(treasure)treasure.rotation.y=Math.sin(time*.7)*.12;
    if(captain.boat&&ship)ship.position.y=captain.position.y+.06+Math.sin(time*1.65)*.22;
    updateCamera(dt);
    renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }

  function ensureAudio(){
    const AudioCtor=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtor)return null;
    if(!audioContext)audioContext=new AudioCtor();
    if(audioContext.state==="suspended")audioContext.resume();
    return audioContext;
  }

  function playTone(frequency,duration,type="sine",volume=.04){
    if(!soundOn)return;
    const audio=ensureAudio();
    if(!audio)return;
    const oscillator=audio.createOscillator();
    const gain=audio.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,audio.currentTime);
    gain.gain.setValueAtTime(volume,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
    oscillator.connect(gain);gain.connect(audio.destination);
    oscillator.start();oscillator.stop(audio.currentTime+duration);
  }

  function note(frequency,start,duration,volume,type){
    if(!audioContext||!soundOn)return;
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(.001,start);
    gain.gain.linearRampToValueAtTime(volume,start+.025);
    gain.gain.exponentialRampToValueAtTime(.001,start+duration);
    oscillator.connect(gain);gain.connect(audioContext.destination);
    oscillator.start(start);oscillator.stop(start+duration+.02);
  }

  function startMusic(){
    if(!soundOn||musicTimer)return;
    ensureAudio();
    const melody=[293.66,349.23,392,440,392,349.23,261.63,293.66,349.23,392,523.25,440,392,349.23,293.66,261.63];
    const bass=[73.42,73.42,87.31,87.31,65.41,65.41,98,98];
    const tick=()=>{
      if(!audioContext||!soundOn)return;
      const now=audioContext.currentTime+.02;
      const index=musicStep%melody.length;
      if(index%2===0)note(bass[(musicStep>>1)%bass.length],now,.42,.031,"triangle");
      note(melody[index],now,.24,.022,"triangle");
      if(index%4===2)note(melody[(index+4)%melody.length]/2,now,.2,.014,"sine");
      musicStep++;
    };
    tick();
    musicTimer=window.setInterval(tick,290);
  }

  function stopMusic(){
    if(musicTimer)window.clearInterval(musicTimer);
    musicTimer=null;
  }

  function togglePause(){
    if(state==="playing"){
      state="paused";
      keys.clear();
      pauseOverlay.classList.remove("hidden");
      stopMusic();
      if(document.pointerLockElement)document.exitPointerLock();
      return;
    }
    if(state==="paused"){
      state="playing";
      pauseOverlay.classList.add("hidden");
      startMusic();
    }
  }

  function requestMouseLock(){
    if(state!=="playing")return;
    if(!arena.requestPointerLock){
      showToast("Click and drag the game to look around");
      return;
    }
    try{
      const request=arena.requestPointerLock();
      if(request&&typeof request.catch==="function"){
        request.catch(()=>showToast("Mouse capture unavailable here · click and drag to look around"));
      }
    }catch(error){
      showToast(`Mouse capture unavailable: ${error.message} · click and drag to look around`);
    }
  }

  function inputDown(event){
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLButtonElement)return;
    const code=event.code;
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(code))event.preventDefault();
    if(code==="Escape"){
      if(state==="playing"||state==="paused")togglePause();
      return;
    }
    if(state!=="playing")return;
    const fresh=!keys.has(code);
    keys.add(code);
    if(!fresh||event.repeat)return;
    if(code==="Space")attack();
    if(code==="KeyQ")specialAttack();
    if(code==="KeyR")throwFirebomb();
    if(code==="KeyE")interact();
  }

  function inputUp(event){keys.delete(event.code);}

  startForm.addEventListener("submit",event=>{
    event.preventDefault();
    beginCampaign();
  });
  captainInput.addEventListener("input",()=>captainInput.setCustomValidity(""));
  $("#resume-button").addEventListener("click",()=>togglePause());
  $("#mission-button").addEventListener("click",()=>{
    if(state==="victory"){
      state="menu";
      intro.classList.remove("hidden");
      hud.classList.add("hidden");
      missionOverlay.classList.add("hidden");
      captainInput.value="";
      clearGuards();
      campaign=[];
      gold=0;
      health=100;
      captain.boat=true;
      captain.position.set(0,-4.5,282);
      shipYaw=0;
      shipTurnVelocity=0;
      shipSpeed=0;
      firebombCooldown=0;
      targetIsland=0;
      currentIsland=-1;
      phase="menu";
      setIntroCamera();
      updateShip();
      stopMusic();
      updateHud();
    }else{
      state="playing";
      missionOverlay.classList.add("hidden");
      startMusic();
      showToast(`Return to the dock · sail for ${levelData[targetIsland].name}`);
    }
  });
  $("#sound-button").addEventListener("click",event=>{
    soundOn=!soundOn;
    event.currentTarget.setAttribute("aria-pressed",String(soundOn));
    event.currentTarget.innerHTML=`<span aria-hidden="true">${soundOn?"♫":"♪"}</span> MUSIC ${soundOn?"ON":"OFF"}`;
    if(soundOn&&state==="playing")startMusic();
    else stopMusic();
  });
  $("#fullscreen-button").addEventListener("click",async event=>{
    try{
      if(!document.fullscreenElement)await $(".game-shell").requestFullscreen();
      else await document.exitFullscreen();
      event.currentTarget.textContent=document.fullscreenElement?"⛶ EXIT FULLSCREEN":"⛶ FULLSCREEN";
      resize();
    }catch(error){
      showToast(`Fullscreen unavailable: ${error.message}`);
    }
  });
  $("#mouse-button").addEventListener("click",requestMouseLock);
  canvas.addEventListener("click",requestMouseLock);
  canvas.addEventListener("mousedown",event=>{
    if(event.button!==0||state!=="playing")return;
    if(document.pointerLockElement===arena)attack();
    else mouseLooking=true;
  });
  document.addEventListener("mousemove",event=>{
    if((document.pointerLockElement!==arena&&!mouseLooking)||state!=="playing")return;
    if(captain.boat)shipYaw-=event.movementX*.003;
    else cameraYaw-=event.movementX*.0035;
    cameraPitch=THREE.MathUtils.clamp(cameraPitch+event.movementY*.0025,-.12,.82);
  });
  document.addEventListener("mouseup",()=>{mouseLooking=false;});
  document.addEventListener("pointerlockchange",()=>{
    const locked=document.pointerLockElement===arena;
    $("#mouse-button").classList.toggle("hidden",locked);
    if(pointerWasLocked&&!locked&&state==="playing")togglePause();
    pointerWasLocked=locked;
  });
  window.addEventListener("keydown",inputDown);
  window.addEventListener("keyup",inputUp);
  window.addEventListener("blur",()=>{keys.clear();mouseLooking=false;});
  window.addEventListener("contextmenu",event=>event.preventDefault());
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden&&state==="playing")togglePause();
  });

  function updateCompass(){
    if(!compassArrow)return;
    const target=levelData[targetIsland].center;
    const desired=Math.atan2(target.x-captain.position.x,-(target.y-captain.position.z));
    const facing=captain.boat?shipYaw:cameraYaw;
    compassArrow.style.transform=`rotate(${(desired-facing)*180/Math.PI}deg)`;
  }

  window.addEventListener("beforeunload",stopMusic);
})();
