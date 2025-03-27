import * as THREE from 'https://cdn.skypack.dev/three@0.128.0';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { createNoise2D } from "https://cdn.skypack.dev/simplex-noise@4.0.1";

const noise2D = createNoise2D();
const biomeNoise2D = createNoise2D();

// ### Game Constants
const PLAYER_SPEED = 10.0;
const PLAYER_RUN_SPEED = 20.0;
const AIM_MODE_SPEED = 5.0;
const GRAVITY = 19.6;
const WORLD_SCALE = 1;
const DAY_LENGTH = 1200;
const NIGHT_LENGTH = 60;
const TOTAL_CYCLE_TIME = DAY_LENGTH + NIGHT_LENGTH;
const TERRAIN_SIZE = 500;
const TERRAIN_SEGMENTS = 200; // Increased terrain segments for smoother terrain
const ELEMENT_SIZE = TERRAIN_SIZE / TERRAIN_SEGMENTS;
const PLAYER_MAX_SPEED = 10;
const PLAYER_MAX_RUN_SPEED = 20;
const PLAYER_ACCELERATION = 100;
const MAX_ENEMIES = 15;
const MAX_CHASING_ENEMIES = 5;
const ENEMY_WANDER_SPEED = 2;
const ENEMY_FLEE_SPEED = 8;
const ENEMY_FLEE_HEALTH_THRESHOLD = 0.2;
const CAMPFIRE_RADIUS = 10;
const MINIMAP_SIZE = 200;
const MINIMAP_MARGIN = 10;
const MINIMAP_SCALE = 0.2;
const PLAYER_GROUND_RAY_LENGTH = 10;
const PLAYER_GROUND_OFFSET = 2.01;
const VERTICAL_CORRECTION_FACTOR = 70;
const RESOURCE_HEIGHT_OFFSET = 1;
const ENEMY_HEIGHT_OFFSET = 4;
const NPC_HEIGHT_OFFSET = 2;
const TREE_HEIGHT_OFFSET = 4;
const CAMPFIRE_HEIGHT_OFFSET = 1;
const INVULNERABILITY_DURATION = 0.5;
const BUILDING_SPAWN_CHANCE = 0.2;
const CHEST_SPAWN_CHANCE = 0.5;
const DOOR_INTERACTION_DISTANCE = 5;

// ### Weapon Stats
const weaponStats = {
    axe: { damage: 20, cooldown: 1.0 },
    sword: { damage: 30, cooldown: 0.8 },
    energy_blaster: { damage: 50, cooldown: 0.5, magazineSize: 10, reloadTime: 2.0, ammoType: 'energy_cell' },
    plasma_rifle: { damage: 70, cooldown: 0.3, magazineSize: 20, reloadTime: 3.0, ammoType: 'plasma_cell' },
    laser_sword: { damage: 60, cooldown: 0.7 }
};

// ### Height Functions with Simplex Noise
function getHeight(x, z) {
    const biomeScale = 0.005;
    const biomeValue = (biomeNoise2D(x * biomeScale, z * biomeScale) + 1) / 2;

    const minAmplitude = 5;
    const maxAmplitude = 40;
    const amplitude = minAmplitude + (maxAmplitude - minAmplitude) * biomeValue;

    const scale = 0.02;
    const xScaled = x * scale;
    const zScaled = z * scale;

    const baseHeight = noise2D(xScaled, zScaled) * amplitude;
    const detail = noise2D(xScaled * 4, zScaled * 4) * 2;
    const fineDetail = noise2D(xScaled * 10, zScaled * 10) * 0.5;

    let height = baseHeight + detail + fineDetail;
    height = Math.max(0, height);
    return height;
}

function getTerrainHeight(x, z) {
    let gridX = (x + TERRAIN_SIZE / 2) / ELEMENT_SIZE;
    let gridZ = (z + TERRAIN_SIZE / 2) / ELEMENT_SIZE;

    gridX = Math.max(0, Math.min(TERRAIN_SEGMENTS, gridX));
    gridZ = Math.max(0, Math.min(TERRAIN_SEGMENTS, gridZ));

    const x0 = Math.floor(gridX);
    const z0 = Math.floor(gridZ);
    const x1 = Math.min(x0 + 1, TERRAIN_SEGMENTS);
    const z1 = Math.min(z0 + 1, TERRAIN_SEGMENTS);

    const h00 = heightData[z0][x0];
    const h10 = heightData[z0][x1];
    const h01 = heightData[z1][x0];
    const h11 = heightData[z1][x1];

    const tx = gridX - x0;
    const tz = gridZ - z0;
    const h0 = h00 * (1 - tx) + h10 * tx;
    const h1 = h01 * (1 - tx) + h11 * tx;
    return h0 * (1 - tz) + h1 * tz;
}

// ### Game State
const gameState = {
    health: 100,
    maxHealth: 100,
    hunger: 100,
    thirst: 100,
    stamina: 100,
    maxStamina: 100,
    equippedWeapon: null,
    attackDamage: 10,
    attackCooldown: 0,
    enemiesDefeated: 0,
    timeOfDay: 0,
    weather: "clear",
    isJumping: false,
    isRunning: false,
    inventoryOpen: false,
    craftingOpen: false,
    questsOpen: false,
    shopOpen: false, // Shop state
    campfirePlaced: false,
    campfirePosition: new THREE.Vector3(),
    lastAttackTime: 0,
    invulnerableUntil: 0,
    isAiming: false,
    isReloading: false,
    reloadStartTime: 0,
    gunAmmo: {
        energy_blaster: { magazine: 10 },
        plasma_rifle: { magazine: 20 }
    }
};

// ### Inventory System
const inventory = {
    berries: 0, stone: 0, wood: 0, metal_scrap: 0, alien_crystal: 0,
    water_bottle: 0, alien_water: 0, fiber: 0, crystal_shard: 0, alien_vine: 0,
    meat: 0, alien_fruit: 0,
    axe: 0, sword: 0, energy_blaster: 0, plasma_rifle: 0, laser_sword: 0,
    campfire: 0,
    energy_cell: 0,
    plasma_cell: 0,
    gold_coin: 20, // Starting coins for testing
};

// ### Crafting Recipes
const recipes = {
    axe: { stone: 2, wood: 2 },
    sword: { metal_scrap: 3, wood: 1 },
    energy_blaster: { metal_scrap: 5, alien_crystal: 3 },
    plasma_rifle: { metal_scrap: 10, crystal_shard: 5, fiber: 2 },
    laser_sword: { alien_crystal: 4, alien_vine: 3 },
    campfire: { wood: 3, stone: 2 },
    energy_cell: { metal_scrap: 1, alien_crystal: 1 },
    plasma_cell: { crystal_shard: 2, fiber: 1 }
};

// ### Shop Items and Prices
const shopItems = {
    water_bottle: { price: 5, stock: 10 },
    berries: { price: 2, stock: 20 },
    meat: { price: 8, stock: 10 },
    energy_cell: { price: 3, stock: 30},
    plasma_cell: { price: 5, stock: 20},
    campfire: { price: 15, stock: 5}
};

// ### Quest System
const quests = [
    { id: 1, objective: "Collect 10 berries", progress: 0, target: 10, reward: "health_boost", completed: false },
    { id: 2, objective: "Defeat 5 enemies", progress: 0, target: 5, reward: "stamina_boost", completed: false },
    { id: 3, objective: "Collect 3 alien crystals", progress: 0, target: 3, reward: "energy_blaster", completed: false },
    { id: 4, objective: "Spend 20 gold coins", progress: 0, target: 20, reward: "plasma_rifle", completed: false} // New Quest
];

// ### Physics Setup
const world = new CANNON.World();
world.gravity.set(0, -GRAVITY * WORLD_SCALE, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const heightData = [];
for (let z = 0; z <= TERRAIN_SEGMENTS; z++) {
    const row = [];
    for (let x = 0; x <= TERRAIN_SEGMENTS; x++) {
        const xPos = x * ELEMENT_SIZE - TERRAIN_SIZE / 2;
        const zPos = z * ELEMENT_SIZE - TERRAIN_SIZE / 2;
        row.push(getHeight(xPos, zPos));
    }
    heightData.push(row);
}

// ### Terrain Flattening Function
function flattenTerrainArea(centerX, centerZ, width, depth, targetHeight) {
    const startX = centerX - width / 2;
    const endX = centerX + width / 2;
    const startZ = centerZ - depth / 2;
    const endZ = centerZ + depth / 2;

    for (let z = 0; z <= TERRAIN_SEGMENTS; z++) {
        for (let x = 0; x <= TERRAIN_SEGMENTS; x++) {
            const xPos = x * ELEMENT_SIZE - TERRAIN_SIZE / 2;
            const zPos = z * ELEMENT_SIZE - TERRAIN_SIZE / 2;

            if (xPos >= startX && xPos <= endX && zPos >= startZ && zPos <= endZ) {
                heightData[z][x] = targetHeight;
            }
        }
    }
}

function updateTerrainMesh() {
    const vertices = terrainGeometry.attributes.position.array;
    for (let z = 0; z <= TERRAIN_SEGMENTS; z++) {
        for (let x = 0; x <= TERRAIN_SEGMENTS; x++) {
            const index = (z * (TERRAIN_SEGMENTS + 1) + x) * 3;
            const xPos = (x * ELEMENT_SIZE) - TERRAIN_SIZE / 2;
            const zPos = -((z * ELEMENT_SIZE) - TERRAIN_SIZE / 2); // Note the negation for zPos to align with terrainMesh orientation
            vertices[index + 2] = heightData[z][x]; // Use heightData to set vertex height
        }
    }
    terrainGeometry.attributes.position.needsUpdate = true;
    terrainGeometry.computeVertexNormals();
}


const heightfieldShape = new CANNON.Heightfield(heightData, { elementSize: ELEMENT_SIZE });
const physicsMaterial = new CANNON.Material();
const groundBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
groundBody.addShape(heightfieldShape);
groundBody.position.set(-TERRAIN_SIZE / 2, 0, -TERRAIN_SIZE / 2);
groundBody.collisionFilterGroup = 8;
groundBody.collisionFilterMask = 1 | 2 | 4;
world.addBody(groundBody);

const physicsContactMaterial = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, { friction: 0.3, restitution: 0.1 });
world.addContactMaterial(physicsContactMaterial);

// --- Player Physics ---
let playerShape = new CANNON.Box(new CANNON.Vec3(1, 2, 0.5));
const playerBody = new CANNON.Body({
    mass: 5,
    position: new CANNON.Vec3(0, getHeight(0, 0) + 2, 0),
    material: physicsMaterial,
    linearDamping: 0.6,
    fixedRotation: true
});
playerBody.addShape(playerShape);
playerBody.angularFactor.set(0, 1, 0);
playerBody.collisionFilterGroup = 1;
playerBody.collisionFilterMask = 2 | 8;
world.addBody(playerBody);

// ### Three.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const aimCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
aimCamera.rotation.order = 'YXZ';
scene.add(aimCamera);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cameraPivot = new THREE.Object3D();
scene.add(cameraPivot);
cameraPivot.add(camera);
camera.position.set(0, 8, 15);
let zoomLevel = 1.0;

// ### Sky Setup
const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

// --- Player Model Loading ---
let playerMesh;
let playerMixer;
let walkAction;
let standAction;
let jumpAction;
const loader = new GLTFLoader();
loader.load(
    'animation/player.glb',
    (gltf) => {
        playerMesh = gltf.scene;
        playerMesh.scale.set(4, 4, 4);
        playerBody.removeShape(playerShape);
        playerShape = new CANNON.Box(new CANNON.Vec3(
            playerMesh.scale.x * 0.25,
            playerMesh.scale.y * 0.5,
            playerMesh.scale.z * 0.125
        ));
        playerBody.addShape(playerShape);
        playerMesh.position.copy(playerBody.position);
        playerMesh.castShadow = true;
        playerMesh.receiveShadow = true;
        scene.add(playerMesh);

        const forward = new THREE.Vector3(0, 0, -1);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
        playerMesh.quaternion.copy(quaternion);
        playerBody.quaternion.copy(quaternion);
        targetFacingQuaternion.copy(playerMesh.quaternion);

        playerMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material = new THREE.MeshStandardMaterial({
                        map: child.material.map,
                        color: child.material.color,
                        skinning: child instanceof THREE.SkinnedMesh
                    });
                } else {
                    child.material = new THREE.MeshStandardMaterial({ color: 0xffffff, skinning: child instanceof THREE.SkinnedMesh });
                }
            }
        });

        playerMixer = new THREE.AnimationMixer(playerMesh);

        walkAction = gltf.animations.find(anim => anim.name === 'walking');
        standAction = gltf.animations.find(anim => anim.name === 'standing' || anim.name === 'stand' || anim.name === 'idle');
        jumpAction = gltf.animations.find(anim => anim.name === 'jumping.001');

        if (walkAction) walkAction = playerMixer.clipAction(walkAction);
        if (standAction) standAction = playerMixer.clipAction(standAction);
        if (jumpAction) jumpAction = playerMixer.clipAction(jumpAction);

        if (!walkAction) console.warn("No 'walking' animation found.");
        if (!standAction) console.warn("No 'standing', 'stand', or 'idle' animation found.");
        if (!jumpAction) console.warn("No 'jumping.001' animation found.");

        if (standAction) standAction.play();

        console.log('Player model loaded successfully');
    },
    (xhr) => console.log((xhr.loaded / xhr.total * 100) + '% loaded'),
    (error) => console.error('Error loading player.glb:', error)
);

// ### Terrain Setup with Simplex Noise
const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
const vertices = terrainGeometry.attributes.position.array;
for (let z = 0; z <= TERRAIN_SEGMENTS; z++) {
    for (let x = 0; x <= TERRAIN_SEGMENTS; x++) {
        const index = (z * (TERRAIN_SEGMENTS + 1) + x) * 3;
        const xPos = vertices[index];
        const zPos = vertices[index + 1];
        vertices[index + 2] = getHeight(xPos, -zPos);
    }
}
terrainGeometry.attributes.position.needsUpdate = true;
terrainGeometry.computeVertexNormals();

const textureLoader = new THREE.TextureLoader();
const grassTexture = textureLoader.load('assets/grass.png');
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(TERRAIN_SIZE / 10, TERRAIN_SIZE / 10);

const terrainMaterial = new THREE.MeshStandardMaterial({ map: grassTexture });
const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrainMesh.rotation.x = -Math.PI / 2;
terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

// ### Lighting System
const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 1000;
directionalLight.shadow.camera.left = -TERRAIN_SIZE / 2;
directionalLight.shadow.camera.right = TERRAIN_SIZE / 2;
directionalLight.shadow.camera.top = TERRAIN_SIZE / 2;
directionalLight.shadow.camera.bottom = -TERRAIN_SIZE / 2;
scene.add(directionalLight);

// ### Minimap Setup
const minimapCanvas = document.createElement('canvas');
const minimapCtx = minimapCanvas.getContext('2d');
minimapCanvas.width = MINIMAP_SIZE;
minimapCanvas.height = MINIMAP_SIZE;
minimapCanvas.style.position = 'absolute';
minimapCanvas.style.left = `${MINIMAP_MARGIN}px`;
minimapCanvas.style.bottom = `${MINIMAP_MARGIN}px`;
minimapCanvas.style.border = '2px solid black';
minimapCanvas.style.backgroundColor = "rgba(50, 100, 50, 0.8)";
document.body.appendChild(minimapCanvas);

// ### Game Entities
let resources = [];
let enemies = [];
let npcs = [];
let trees = [];
let projectiles = [];
let buildings = [];
let weaponModel = null;
let campfireMesh;
const projectilesToRemove = [];
const enemiesToRemove = [];

// ### Asset Loading
const gltfLoader = new GLTFLoader();
const models = {};

function loadGLTFModel(url, name) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(`assets/${url}`, (gltf) => {
            models[name] = gltf.scene;
            console.log(`Model ${name} loaded`);
            resolve(gltf.scene);
        }, undefined, (error) => {
            console.error(`Error loading model ${name} from ${url}`, error);
            reject(error);
        });
    });
}

// ### Input Handling
const keys = {};
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

function handleKeyDown(e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'i') toggleInventory();
    if (e.key === 'c') toggleCrafting();
    if (e.key === 'p') toggleQuests();
    if (e.key === 'l') toggleShop(); // Toggle shop on 'l' key
    if (e.key === 'escape') togglePauseMenu();
    if (e.key === 'f') placeCampfire();
    if (e.key === 'u') unequipWeapon();
    if (e.key === 'x') toggleAimMode();
    if (e.key === 'r') initiateReload();
    if (e.key === 'ArrowUp') zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
    if (e.key === 'ArrowDown') zoomLevel = Math.min(zoomLevel + 0.1, 2.0);
    if (e.key.toLowerCase() === 'q') {
        if (gameState.attackCooldown > 0) return;
        if (gameState.equippedWeapon) {
            if (gameState.equippedWeapon === 'energy_blaster' || gameState.equippedWeapon === 'plasma_rifle') {
                shootProjectile();
            } else if (gameState.equippedWeapon === 'axe' || gameState.equippedWeapon === 'sword' || gameState.equippedWeapon === 'laser_sword') {
                swingWeapon();
                gameState.attackCooldown = weaponStats[gameState.equippedWeapon].cooldown;
            }
        } else {
            barehandedAttack();
            gameState.attackCooldown = 1.0;
        }
    }
}

function handleKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
    if (e.key.toLowerCase() === 'e') {
        checkDoorInteraction();
        checkResourceCollection(); // Ensure resource collection is still checked with 'e'
        checkNPCInteraction();      // Ensure NPC interaction is still checked with 'e'
        checkChestInteraction();    // Ensure chest interaction is still checked with 'e'
    }
}

function togglePauseMenu() {
    console.log("Pause menu toggled");
}

// ### Physics Synchronization
function updatePhysics(deltaTime) {
    const terrainHeight = getTerrainHeight(playerBody.position.x, playerBody.position.z);
    const playerBottom = playerBody.position.y - 0;
    if (playerBottom < terrainHeight) {
        playerBody.position.y = terrainHeight + 0;
        playerBody.velocity.y = 0;
    }

    if (playerMesh) {
        playerMesh.position.copy(playerBody.position);
        playerMesh.quaternion.copy(playerBody.quaternion);
    }

    enemies.forEach(enemy => {
        enemy.mesh.position.copy(enemy.body.position);
        enemy.mesh.quaternion.copy(enemy.body.quaternion);
    });

    projectiles.forEach(proj => {
        proj.mesh.position.copy(proj.body.position);
    });
}

// ### Movement and Camera Control
let isGrounded = false;
let jumpStartTime = 0;
const JUMP_DELAY = 0.3;
const JUMP_UP_DURATION = 0.75;
const JUMP_DOWN_DURATION = 0.8;
let isJumpingUp = false;
let isJumpingDown = false;

let targetFacingQuaternion = new THREE.Quaternion();
let targetTiltAngle = 0;
let playerIsAttacking = false;
let playerAttackStartTime = 0;

function handleMovement(deltaTime) {
    let currentMaxSpeed;
    if (gameState.isAiming) {
        currentMaxSpeed = AIM_MODE_SPEED;
    } else {
        currentMaxSpeed = gameState.isRunning ? PLAYER_RUN_SPEED : PLAYER_MAX_SPEED;
        gameState.isRunning = keys.shift && gameState.stamina > 0;
    }

    let cameraDirection = new THREE.Vector3();
    if (gameState.isAiming) {
        aimCamera.getWorldDirection(cameraDirection);
    } else {
        camera.getWorldDirection(cameraDirection);
    }
    cameraDirection.y = 0;
    cameraDirection.normalize();

    const forward = new THREE.Vector3().copy(cameraDirection);
    const strafe = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
    let moveDirection = new THREE.Vector3();

    if (keys.w) moveDirection.add(forward);
    if (keys.s) moveDirection.sub(forward);
    if (keys.a) moveDirection.sub(strafe);
    if (keys.d) moveDirection.add(strafe);

    moveDirection.normalize();

    let desiredVelocityChange = new CANNON.Vec3(
        moveDirection.x * currentMaxSpeed,
        0,
        moveDirection.z * currentMaxSpeed
    );

    if (isGrounded) {
        desiredVelocityChange.x -= playerBody.velocity.x;
        desiredVelocityChange.z -= playerBody.velocity.z;
        desiredVelocityChange = desiredVelocityChange.scale(PLAYER_ACCELERATION * deltaTime);
        playerBody.applyImpulse(desiredVelocityChange);
    } else {
        desiredVelocityChange.x = 0;
        desiredVelocityChange.z = 0;
    }

    let currentVelocity = new THREE.Vector3(playerBody.velocity.x, 0, playerBody.velocity.z);
    if (currentVelocity.length() > currentMaxSpeed) {
        currentVelocity.normalize().multiplyScalar(currentMaxSpeed);
        playerBody.velocity.x = currentVelocity.x;
        playerBody.velocity.z = currentVelocity.z;
    }

    if (moveDirection.lengthSq() > 0.01) {
        const angle = Math.atan2(moveDirection.x, moveDirection.z);
        targetFacingQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    }

    const rayStartPoint = new CANNON.Vec3(playerBody.position.x, playerBody.position.y + 1, playerBody.position.z);
    const rayEndPoint = new CANNON.Vec3(playerBody.position.x, playerBody.position.y - PLAYER_GROUND_RAY_LENGTH, playerBody.position.z);
    const rayResult = new CANNON.RaycastResult();
    world.raycastClosest(rayStartPoint, rayEndPoint, {}, rayResult);

    isGrounded = rayResult.hasHit;

    if (keys[' '] && isGrounded && !gameState.isJumping) {
        jumpStartTime = clock.elapsedTime;
        gameState.isJumping = true;
        isGrounded = false;
    }

    if (gameState.isJumping && !isJumpingUp && !isJumpingDown) {
        const timeSinceJumpStart = clock.elapsedTime - jumpStartTime;
        if (timeSinceJumpStart >= JUMP_DELAY) {
            isJumpingUp = true;
            playerBody.velocity.y = 10;
            jumpStartTime = clock.elapsedTime;
        }
    }

    if (isJumpingUp) {
        const timeSinceJumpUp = clock.elapsedTime - jumpStartTime;
        if (timeSinceJumpUp >= JUMP_UP_DURATION) {
            isJumpingUp = false;
            isJumpingDown = true;
            jumpStartTime = clock.elapsedTime;
        }
    }

    if (isJumpingDown) {
        const timeSinceJumpDown = clock.elapsedTime - jumpStartTime;
        if (timeSinceJumpDown >= JUMP_DOWN_DURATION && isGrounded) {
            isJumpingDown = false;
            gameState.isJumping = false;
            if (isGrounded) playerBody.velocity.y = 0;
        }
    }

    if (gameState.isJumping) keys[' '] = false;

    if (!gameState.isAiming && gameState.isRunning) gameState.stamina = Math.max(0, gameState.stamina - 10 * deltaTime);
    if (!gameState.isRunning && !gameState.isJumping) gameState.stamina = Math.min(gameState.maxStamina, gameState.stamina + 5 * deltaTime);

    if (!gameState.isAiming) {
        const rotationSpeedH = 2.0;
        if (keys['arrowleft']) cameraPivot.rotation.y += rotationSpeedH * deltaTime;
        if (keys['arrowright']) cameraPivot.rotation.y -= rotationSpeedH * deltaTime;
    } else {
        playerMesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), aimCamera.rotation.y);
        playerBody.quaternion.copy(playerMesh.quaternion);
    }

    if (playerMesh && walkAction && standAction && jumpAction) {
        if (gameState.isJumping) {
            if (!jumpAction.isRunning()) {
                jumpAction.reset().play();
                jumpAction.setLoop(THREE.LoopOnce);
                jumpAction.clampWhenFinished = true;
            }
            if (walkAction.isRunning()) walkAction.stop();
            if (standAction.isRunning()) standAction.stop();
        } else {
            if (jumpAction.isRunning()) jumpAction.stop();
            const isMoving = keys.w || keys.a || keys.s || keys.d;
            if (isMoving) {
                if (!walkAction.isRunning()) walkAction.reset().play();
                if (standAction.isRunning()) standAction.stop();
                walkAction.timeScale = gameState.isRunning ? 2 : 1;
            } else {
                if (walkAction.isRunning()) walkAction.stop();
                if (!standAction.isRunning()) standAction.play();
                walkAction.timeScale = 1;
            }
        }
    }
}

// ### Aim Mode Toggle
const aimWeaponOffsets = {
    energy_blaster: {
        position: new THREE.Vector3(0.5, -0.2, -0.5),
        rotation: new THREE.Euler(0, 1.5, 0)
    },
    plasma_rifle: {
        position: new THREE.Vector3(0.5, -0.2, -0.5),
        rotation: new THREE.Euler(0, 0, 0)
    }
};

function toggleAimMode() {
    if (gameState.equippedWeapon === 'energy_blaster' || gameState.equippedWeapon === 'plasma_rifle') {
        gameState.isAiming = !gameState.isAiming;
        if (gameState.isAiming) {
            console.log("Aim mode ON");
            document.getElementById('crosshair').style.display = 'block';
            if (equippedWeaponMesh) {
                const aimOffset = aimWeaponOffsets[gameState.equippedWeapon];
                if (aimOffset) {
                    equippedWeaponMesh.position.copy(aimOffset.position);
                    equippedWeaponMesh.rotation.copy(aimOffset.rotation);
                } else {
                    equippedWeaponMesh.position.set(0.5, -0.2, -0.5);
                    equippedWeaponMesh.rotation.set(0, 0, 0);
                }
                aimCamera.add(equippedWeaponMesh);
            }
            aimCamera.position.copy(playerMesh.position);
            aimCamera.position.y = playerMesh.position.y + 5.0;
            aimCamera.quaternion.copy(playerMesh.quaternion);
            const flipRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
            aimCamera.quaternion.multiply(flipRotation);
            aimCamera.rotation.x = 0;
            cameraPivot.remove(camera);
        } else {
            console.log("Aim mode OFF");
            document.getElementById('crosshair').style.display = 'none';
            if (equippedWeaponMesh) {
                const offset = weaponOffsets[gameState.equippedWeapon];
                if (offset) {
                    equippedWeaponMesh.position.copy(offset.position);
                    equippedWeaponMesh.rotation.copy(offset.rotation);
                } else {
                    equippedWeaponMesh.position.set(0.35, 0.5, 0.5);
                    equippedWeaponMesh.rotation.set(0, 0, 0);
                }
                playerMesh.add(equippedWeaponMesh);
                aimCamera.remove(equippedWeaponMesh);
            }
            cameraPivot.add(camera);
        }
    } else if (gameState.equippedWeapon) {
        showFeedback("Aim mode only available with guns!");
    } else {
        showFeedback("Equip a weapon first!");
    }
}

function handleAimModeMovement(deltaTime) {
    if (gameState.isAiming) {
        const rotationSpeedAim = 1.0;
        if (keys['arrowleft']) aimCamera.rotation.y += rotationSpeedAim * deltaTime;
        if (keys['arrowright']) aimCamera.rotation.y -= rotationSpeedAim * deltaTime;
        if (keys['arrowup']) aimCamera.rotation.x += rotationSpeedAim * deltaTime;
        if (keys['arrowdown']) aimCamera.rotation.x -= rotationSpeedAim * deltaTime;
        aimCamera.rotation.x = THREE.MathUtils.clamp(aimCamera.rotation.x, -Math.PI / 2, Math.PI / 2);
    }
}

// ### Combat System
function handleCombat(deltaTime) {
    gameState.attackCooldown = Math.max(0, gameState.attackCooldown - deltaTime);
}

function barehandedAttack() {
    console.log("Barehanded attack triggered");
    const defeated = [];
    enemies.forEach(enemy => {
        const distance3D = playerMesh.position.distanceTo(enemy.mesh.position);
        if (distance3D < 8) {
            enemy.health -= gameState.attackDamage;
            showFeedback(`Hit ${enemy.type}! (${enemy.health} HP)`);
            spawnBloodParticles(enemy.mesh.position);
            if (enemy.health <= 0) defeated.push(enemy);
        }
    });
    defeated.forEach(enemy => {
        const index = enemies.indexOf(enemy);
        if (index !== -1) handleEnemyDefeat(enemy, index);
    });
    playerIsAttacking = true;
    playerAttackStartTime = clock.elapsedTime;
}

function shootProjectile() {
    if (gameState.attackCooldown > 0 || gameState.isReloading) return;

    const equippedGun = gameState.equippedWeapon;
    if (!equippedGun || !weaponStats[equippedGun] || !weaponStats[equippedGun].magazineSize) return;

    const gunAmmo = gameState.gunAmmo[equippedGun];
    if (gunAmmo.magazine <= 0) {
        showFeedback("Magazine empty! Reload.");
        return;
    }

    gunAmmo.magazine--;

    const projectileRadius = 0.2;
    const projectileShape = new CANNON.Sphere(projectileRadius);
    const projectileBody = new CANNON.Body({
        mass: 0.1,
        shape: projectileShape,
        collisionFilterGroup: 4,
        collisionFilterMask: 2 | 8
    });

    let shootPosition = new THREE.Vector3();
    if (equippedWeaponMesh && gameState.isAiming) {
        equippedWeaponMesh.getWorldPosition(shootPosition);
    } else if (equippedWeaponMesh) {
        equippedWeaponMesh.getWorldPosition(shootPosition);
    } else {
        shootPosition.copy(playerMesh.position);
        shootPosition.y += 1.5;
    }

    projectileBody.position.set(shootPosition.x, shootPosition.y, shootPosition.z);

    let shootDirection = new THREE.Vector3();
    if (gameState.isAiming) {
        aimCamera.getWorldDirection(shootDirection);
    } else {
        const playerDirection = new THREE.Vector3(0, 0, 1);
        playerDirection.applyQuaternion(playerMesh.quaternion);
        shootDirection.copy(playerDirection);
    }

    const projectileSpeed = 80;
    projectileBody.velocity.set(
        shootDirection.x * projectileSpeed,
        shootDirection.y * projectileSpeed,
        shootDirection.z * projectileSpeed
    );

    world.addBody(projectileBody);

    const projectileGeometry = new THREE.SphereGeometry(projectileRadius, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const projectileMesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectileMesh.position.copy(projectileBody.position);
    scene.add(projectileMesh);

    const projectile = {
        body: projectileBody,
        mesh: projectileMesh,
        spawnTime: clock.elapsedTime,
        active: true
    };

    projectiles.push(projectile);

    projectileBody.addEventListener('collide', (event) => {
        if (!projectile.active) return;
        projectile.active = false;

        const otherBody = event.body;
        if (otherBody === groundBody) {
            removeProjectile(projectile);
        }
        const hitEnemy = enemies.find(enemy => enemy.body === otherBody);
        if (hitEnemy) {
            hitEnemy.health -= gameState.attackDamage;
            showFeedback(`Hit ${hitEnemy.type}! (${hitEnemy.health} HP)`);
            spawnBloodParticles(hitEnemy.mesh.position);
            if (hitEnemy.health <= 0) {
                const index = enemies.indexOf(hitEnemy);
                if (index !== -1) handleEnemyDefeat(hitEnemy, index);
            }
            removeProjectile(projectile);
        }
        if (trees.some(tree => tree.body === otherBody) || npcs.some(npc => npc.body === otherBody)) {
            removeProjectile(projectile);
        }
    });

    gameState.attackCooldown = weaponStats[equippedGun].cooldown;
}

function removeProjectile(projectile) {
    if (!projectile || !projectiles.includes(projectile) || projectilesToRemove.includes(projectile)) return;
    projectilesToRemove.push(projectile);
}

function processDeferredRemovals() {
    for (let i = 0; i < projectilesToRemove.length; i++) {
        const projectile = projectilesToRemove[i];
        if (projectiles.includes(projectile)) {
            if (projectile.body && world.bodies.includes(projectile.body)) {
                world.removeBody(projectile.body);
            }
            if (projectile.mesh && scene.children.includes(projectile.mesh)) {
                scene.remove(projectile.mesh);
            }
            const index = projectiles.indexOf(projectile);
            if (index !== -1) projectiles.splice(index, 1);
        }
    }
    projectilesToRemove.length = 0;

    for (let i = 0; i < enemiesToRemove.length; i++) {
        const enemy = enemiesToRemove[i];
        if (enemies.includes(enemy)) {
            if (enemy.body && world.bodies.includes(enemy.body)) {
                world.removeBody(enemy.body);
            }
            if (enemy.mesh && scene.children.includes(enemy.mesh)) {
                scene.remove(enemy.mesh);
            }
            const index = enemies.indexOf(enemy);
            if (index !== -1) enemies.splice(index, 1);
        }
    }
    enemiesToRemove.length = 0;
}

function updateProjectiles(deltaTime) {
    const maxProjectileLife = 5;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        if (!proj.active) continue;
        proj.mesh.position.copy(proj.body.position);
        if (clock.elapsedTime - proj.spawnTime > maxProjectileLife) {
            removeProjectile(proj);
        }
    }
}

let isSwinging = false;
let swingDirection = 1;
let swingStartTime = 0;

function swingWeapon() {
    isSwinging = true;
    swingDirection = 1;
    swingStartTime = clock.elapsedTime;
    checkMeleeHit();
}

function updateWeaponSwing(deltaTime) {
    if (isSwinging && equippedWeaponMesh) {
        const swingDuration = 0.4;
        const returnDuration = 0.3;
        const maxSwingAngle = Math.PI / 2.5;

        const elapsedTime = clock.elapsedTime - swingStartTime;

        if (swingDirection === 1) {
            const swingProgress = Math.min(elapsedTime / swingDuration, 1);
            const angle = swingProgress * maxSwingAngle;
            equippedWeaponMesh.rotation.z = angle;
            if (swingProgress >= 1) swingDirection = -1;
        } else {
            const returnProgress = Math.min((elapsedTime - swingDuration) / returnDuration, 1);
            const angle = (1 - returnProgress) * maxSwingAngle;
            equippedWeaponMesh.rotation.z = angle;
            if (returnProgress >= 1) isSwinging = false;
        }
    }
}

function checkMeleeHit() {
    const defeated = [];
    enemies.forEach(enemy => {
        const distance3D = playerMesh.position.distanceTo(enemy.mesh.position);
        if (distance3D < 10) {
            enemy.health -= gameState.attackDamage;
            showFeedback(`Hit ${enemy.type}! (${enemy.health} HP)`);
            spawnBloodParticles(enemy.mesh.position);
            if (enemy.health <= 0) defeated.push(enemy);
        }
    });
    defeated.forEach(enemy => {
        const index = enemies.indexOf(enemy);
        if (index !== -1) handleEnemyDefeat(enemy, index);
    });
}

// ### Enemy Defeat
function handleEnemyDefeat(enemy, index) {
    if (!enemy || !enemies.includes(enemy) || enemiesToRemove.includes(enemy)) return;
    enemiesToRemove.push(enemy);
    inventory.meat += Math.floor(Math.random() * 2) + 1;
    inventory.gold_coin += Math.floor(Math.random() * 3) + 1; // Add gold coins on enemy defeat
    updateInventoryUI();
    gameState.enemiesDefeated++;
    checkQuests();
}

// ### Reload System
function initiateReload() {
    if (gameState.isReloading) return;
    const equippedGun = gameState.equippedWeapon;
    if (!equippedGun || !weaponStats[equippedGun] || !weaponStats[equippedGun].magazineSize) return;

    const gunAmmo = gameState.gunAmmo[equippedGun];
    if (gunAmmo.magazine >= weaponStats[equippedGun].magazineSize) {
        showFeedback("Magazine is full.");
        return;
    }
    const ammoType = weaponStats[equippedGun].ammoType;
    if (inventory[ammoType] <= 0) {
        showFeedback("No ammo left to reload.");
        return;
    }

    gameState.isReloading = true;
    gameState.reloadStartTime = clock.elapsedTime;
    showFeedback("Reloading...");
}

function updateReload(deltaTime) {
    if (gameState.isReloading) {
        const equippedGun = gameState.equippedWeapon;
        const reloadTime = weaponStats[equippedGun].reloadTime;
        if (clock.elapsedTime - gameState.reloadStartTime >= reloadTime) {
            const gunAmmo = gameState.gunAmmo[equippedGun];
            const ammoType = weaponStats[equippedGun].ammoType;
            if (inventory[ammoType] > 0) {
                inventory[ammoType]--;
                gunAmmo.magazine = weaponStats[equippedGun].magazineSize;
                gameState.isReloading = false;
                showFeedback("Reloaded!");
                updateInventoryUI();
            } else {
                showFeedback("No ammo left to reload.");
                gameState.isReloading = false;
            }
        }
    }
}

// ### Survival System
function updateSurvival(deltaTime) {
    gameState.hunger = Math.max(0, gameState.hunger - 0.5 * deltaTime);
    gameState.thirst = Math.max(0, gameState.thirst - 0.7 * deltaTime);
    if (gameState.hunger <= 0 || gameState.thirst <= 0) {
        gameState.health = Math.max(0, gameState.health - 2 * deltaTime);
    }
}

// ### Crafting System
function craftItem(item) {
    const recipe = recipes[item];
    if (!recipe) return;

    if (Object.keys(recipe).every(res => inventory[res] >= recipe[res])) {
        Object.entries(recipe).forEach(([res, qty]) => inventory[res] -= qty);
        inventory[item]++;
        showFeedback(`Crafted ${item}!`);
        updateInventoryUI();
        updateCraftingUI();
    } else {
        showFeedback("Not enough resources!");
    }
}

// ### Inventory and UI
function updateInventoryUI() {
    const itemsDiv = document.getElementById('inventory-items');
    if (!itemsDiv) return;
    itemsDiv.innerHTML = '';

    Object.entries(inventory).forEach(([item, qty]) => {
        if (qty > 0) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item';
            itemDiv.innerHTML = `
                <div>${item}: ${qty}</div>
                ${['axe', 'sword', 'energy_blaster', 'plasma_rifle', 'laser_sword', 'campfire'].includes(item) ?
                    `<button onclick="equipWeapon('${item}')">Equip</button>` :
                    ['berries', 'alien_fruit', 'water_bottle', 'alien_water', 'meat', 'gold_coin'].includes(item) ?
                        `<button onclick="useItem('${item}')">Use</button>` : ''}
            `;
            itemsDiv.appendChild(itemDiv);
        }
    });
    document.getElementById('coins').textContent = `Coins: ${inventory.gold_coin}`; // Update coin display in HUD
}

let campfireLight = null;

function placeCampfire() {
    if (inventory.campfire > 0 && !gameState.campfirePlaced) {
        const playerPos = playerMesh.position.clone();
        playerPos.y = getTerrainHeight(playerPos.x, playerPos.z) + CAMPFIRE_HEIGHT_OFFSET;

        if (models.campfire) {
            campfireMesh = models.campfire.clone();
            campfireMesh.scale.set(4, 4, 4);
        } else {
            campfireMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.5, 0.8, 1, 16),
                new THREE.MeshBasicMaterial({ color: 0xffa500 })
            );
        }
        campfireMesh.position.copy(playerPos);
        campfireMesh.castShadow = true;
        scene.add(campfireMesh);

        campfireLight = new THREE.PointLight(0xffa500, 1, 15);
        campfireLight.position.set(playerPos.x, playerPos.y + 1, playerPos.z);
        campfireLight.castShadow = true;
        scene.add(campfireLight);

        gameState.campfirePlaced = true;
        gameState.campfirePosition.copy(playerPos);
        inventory.campfire--;
        updateInventoryUI();
        showFeedback("Campfire placed!");
    } else if (gameState.campfirePlaced) {
        showFeedback("You already have a campfire placed.");
    } else {
        showFeedback("You don't have a campfire to place.");
    }
}

let equippedWeaponMesh = null;

const weaponOffsets = {
    axe: { position: new THREE.Vector3(0.32, 0.73, 0.41), rotation: new THREE.Euler(Math.PI / 2 - 0.8, Math.PI, 0) },
    sword: { position: new THREE.Vector3(0.35, 0.43, 0.5), rotation: new THREE.Euler(0, 0, 0) },
    energy_blaster: { position: new THREE.Vector3(0.45, 0.83, 0.62), rotation: new THREE.Euler(0, -Math.PI / 2 - 0.2, 0) },
    plasma_rifle: { position: new THREE.Vector3(0.33, 0.7, 0.53), rotation: new THREE.Euler(0, Math.PI, 0) },
    laser_sword: { position: new THREE.Vector3(0.35, 0.45, 0.5), rotation: new THREE.Euler(0, 0, 0) }
};

function equipWeapon(weapon) {
    if (gameState.isAiming) {
        showFeedback("Cannot switch weapons while aiming!");
        return;
    }
    if (gameState.equippedWeapon && gameState.equippedWeapon !== weapon) {
        inventory[gameState.equippedWeapon] += 1;
        if (equippedWeaponMesh) {
            playerMesh.remove(equippedWeaponMesh);
            scene.remove(equippedWeaponMesh);
            equippedWeaponMesh = null;
        }
        showFeedback(`Returned ${gameState.equippedWeapon} to inventory.`);
    }

    if (inventory[weapon] > 0) {
        gameState.equippedWeapon = weapon;
        inventory[weapon] -= 1;
        updateInventoryUI();

        gameState.attackDamage = weaponStats[weapon].damage;
        showFeedback(`Equipped ${weapon}!`);

        if (equippedWeaponMesh) {
            playerMesh.remove(equippedWeaponMesh);
            scene.remove(equippedWeaponMesh);
            equippedWeaponMesh = null;
        }

        let modelName = weapon;
        if (weapon === 'energy_blaster') modelName = 'energy_blaster';
        if (weapon === 'plasma_rifle') modelName = 'plasma_rifle';
        if (weapon === 'laser_sword') modelName = 'laser_sword';

        if (models[modelName]) {
            equippedWeaponMesh = models[modelName].clone();
            equippedWeaponMesh.scale.set(1, 1, 1);

            const offset = weaponOffsets[weapon];
            if (offset) {
                equippedWeaponMesh.position.copy(offset.position);
                equippedWeaponMesh.rotation.copy(offset.rotation);
            } else {
                equippedWeaponMesh.position.set(0.35, 0.5, 0.5);
                equippedWeaponMesh.rotation.set(0, 0, 0);
            }

            playerMesh.add(equippedWeaponMesh);
        } else {
            console.warn(`No model found for ${modelName}, weapon won't be visible.`);
        }
    } else {
        showFeedback(`No ${weapon} in inventory to equip!`);
    }
}

function unequipWeapon() {
    if (gameState.isAiming) {
        showFeedback("Cannot unequip weapon while aiming!");
        return;
    }
    if (gameState.equippedWeapon) {
        inventory[gameState.equippedWeapon] += 1;
        gameState.equippedWeapon = null;
        gameState.attackDamage = 10;
        showFeedback("Unequipped weapon!");
        if (equippedWeaponMesh) {
            playerMesh.remove(equippedWeaponMesh);
            scene.remove(equippedWeaponMesh);
            equippedWeaponMesh = null;
        }
        updateInventoryUI();
    } else {
        showFeedback("No weapon equipped to unequip!");
    }
}

function useItem(item) {
    const itemEffects = {
        'berries': () => { gameState.hunger = Math.min(100, gameState.hunger + 20); inventory.berries--; },
        'alien_fruit': () => { gameState.hunger = Math.min(100, gameState.hunger + 40); gameState.health = Math.min(gameState.maxHealth, gameState.health + 10); inventory.alien_fruit--; },
        'water_bottle': () => { gameState.thirst = Math.min(100, gameState.thirst + 30); inventory.water_bottle--; },
        'alien_water': () => { gameState.thirst = Math.min(100, gameState.thirst + 50); inventory.alien_water--; },
        'meat': () => { gameState.hunger = Math.min(100, gameState.hunger + 30); inventory.meat--; },
        'gold_coin': () => { showFeedback("It's a shiny gold coin!"); }
    };

    if (itemEffects[item]) {
        itemEffects[item]();
        updateInventoryUI();
    }
}

// ### Shop System
function toggleShop() {
    gameState.shopOpen = !gameState.shopOpen;
    document.getElementById('shop').style.display = gameState.shopOpen ? 'block' : 'none';
    if (gameState.shopOpen) updateShopUI();
}

function updateShopUI() {
    const shopItemsDiv = document.getElementById('shop-items');
    if (!shopItemsDiv) return;
    shopItemsDiv.innerHTML = '';

    Object.entries(shopItems).forEach(([itemName, itemDetails]) => {
        if (itemDetails.stock > 0) {
            const shopItemDiv = document.createElement('div');
            shopItemDiv.className = 'shop-item';
            shopItemDiv.innerHTML = `
                <div>${itemName} - Price: ${itemDetails.price} coins (Stock: ${itemDetails.stock})</div>
                <button onclick="purchaseItem('${itemName}')">Buy</button>
            `;
            shopItemsDiv.appendChild(shopItemDiv);
        }
    });
}

function purchaseItem(itemName) {
    const itemDetails = shopItems[itemName];
    if (!itemDetails) return;

    if (inventory.gold_coin >= itemDetails.price) {
        if (itemDetails.stock > 0) {
            inventory.gold_coin -= itemDetails.price;
            inventory[itemName]++;
            itemDetails.stock--;
            updateInventoryUI();
            updateShopUI();
            showFeedback(`Purchased ${itemName}!`);
            checkQuests(); // Check quests after purchase
        } else {
            showFeedback(`${itemName} is out of stock!`);
        }
    } else {
        showFeedback("Not enough gold coins!");
    }
}


// ### Quest System
function checkQuests() {
    quests.forEach(quest => {
        if (quest.completed) return;

        switch (quest.objective) {
            case "Collect 10 berries": quest.progress = inventory.berries; break;
            case "Defeat 5 enemies": quest.progress = gameState.enemiesDefeated; break;
            case "Collect 3 alien crystals": quest.progress = inventory.alien_crystal; break;
            case "Spend 20 gold coins":
                let coinsSpentForQuest = 0;
                let initialCoins = 20; // Assuming starting coins are around 20 for quest tracking, adjust if needed.
                if (inventory.gold_coin < initialCoins) {
                    coinsSpentForQuest = initialCoins - inventory.gold_coin;
                }
                quest.progress = coinsSpentForQuest;
                break;
        }

        if (quest.progress >= quest.target) completeQuest(quest);
    });
    updateQuestUI();
}

function completeQuest(quest) {
    quest.completed = true;
    switch (quest.reward) {
        case "health_boost": gameState.maxHealth += 20; gameState.health = gameState.maxHealth; break;
        case "stamina_boost": gameState.maxStamina += 20; gameState.stamina = gameState.maxStamina; break;
        case "energy_blaster": recipes.energy_blaster = { metal_scrap: 5, alien_crystal: 3 }; inventory.energy_blaster += 1; break;
        case "plasma_rifle": recipes.plasma_rifle = { metal_scrap: 10, crystal_shard: 5, fiber: 2 }; inventory.plasma_rifle += 1; break; // Quest reward plasma rifle
        case "laser_sword": inventory.laser_sword += 1; break; // Example coin reward
        case "gold_coins_reward": inventory.gold_coin += 50; break; // Example coin reward
    }
    showFeedback(`Quest Complete: ${quest.objective}`);
    updateQuestUI();
}

function updateQuestUI() {
    const questList = document.getElementById('quest-list');
    if (!questList) return;
    questList.innerHTML = '';
    quests.forEach(quest => {
        const questDiv = document.createElement('div');
        questDiv.className = 'quest';
        questDiv.textContent = `${quest.objective} (${quest.progress}/${quest.target})${quest.completed ? ' - Completed' : ''}`;
        questList.appendChild(questDiv);
    });
}

// ### Enemy System
function spawnEnemy() {
    if (enemies.length >= MAX_ENEMIES) return;

    const enemyTypes = [
        { type: 'enemy1', health: 30, speed: 4, damage: 5, modelName: 'enemy1', chaseRange: 15, attackRange: 5, attackCooldown: 1.5, spawnChance: 0.4 },
        { type: 'enemy2', health: 100, speed: 3, damage: 12, modelName: 'enemy2', chaseRange: 20, attackRange: 7, attackCooldown: 2.5, spawnChance: 0.2 },
        { type: 'enemy3', health: 50, speed: 6, damage: 8, modelName: 'enemy3', chaseRange: 18, attackRange: 6, attackCooldown: 1, spawnChance: 0.3 },
        { type: 'enemy4', health: 150, speed: 5, damage: 15, modelName: 'enemy4', chaseRange: 22, attackRange: 8, attackCooldown: 3, spawnChance: 0.1 }
    ];

    let totalChance = 0;
    enemyTypes.forEach(type => totalChance += type.spawnChance);
    let rand = Math.random() * totalChance;
    let selectedType = null;
    for (const type of enemyTypes) {
        rand -= type.spawnChance;
        if (rand <= 0) {
            selectedType = type;
            break;
        }
    }
    if (!selectedType) return;

    const spawnX = (Math.random() - 0.5) * TERRAIN_SIZE;
    const spawnZ = (Math.random() - 0.5) * TERRAIN_SIZE;
    const spawnY = getHeight(spawnX, spawnZ) + ENEMY_HEIGHT_OFFSET;

    const enemyBody = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(spawnX, spawnY, spawnZ),
        material: physicsMaterial,
        linearDamping: 0.6,
        fixedRotation: true
    });
    enemyBody.angularFactor.set(0, 0, 0);
    enemyBody.collisionFilterGroup = 2;
    enemyBody.collisionFilterMask = 1 | 8 | 4;

    let enemyShape;
    if (models[selectedType.modelName]) {
        const model = models[selectedType.modelName];
        const boundingBox = new THREE.Box3().setFromObject(model);
        const size = boundingBox.getSize(new THREE.Vector3()).multiplyScalar(7);
        enemyShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    } else {
        enemyShape = new CANNON.Sphere(0.7 * 7);
    }
    enemyBody.addShape(enemyShape);
    world.addBody(enemyBody);

    let enemyMesh;
    if (models[selectedType.modelName]) {
        enemyMesh = models[selectedType.modelName].clone();
        enemyMesh.scale.set(7, 7, 7);
        enemyMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    } else {
        enemyMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.5),
            new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        enemyMesh.castShadow = true;
        enemyMesh.receiveShadow = true;
    }
    scene.add(enemyMesh);

    const facingQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);

    enemies.push({
        type: selectedType.type,
        health: selectedType.health,
        maxHealth: selectedType.health,
        speed: selectedType.speed,
        damage: selectedType.damage,
        mesh: enemyMesh,
        body: enemyBody,
        chaseRange: selectedType.chaseRange,
        attackRange: selectedType.attackRange,
        attackCooldown: selectedType.attackCooldown,
        lastAttack: 0,
        wanderTarget: null,
        isAttacking: false,
        attackStartTime: 0,
        facingQuaternion: facingQuaternion,
        tiltAngle: 0,
        isFleeing: false,
    });
}

function setNewWanderTarget(enemy) {
    const wanderAngle = Math.random() * Math.PI * 2;
    const wanderDistance = 5 + Math.random() * 5;
    const wanderX = enemy.mesh.position.x + Math.sin(wanderAngle) * wanderDistance;
    const wanderZ = enemy.mesh.position.z + Math.cos(wanderAngle) * wanderDistance;

    const clampedX = THREE.MathUtils.clamp(wanderX, -TERRAIN_SIZE / 2, TERRAIN_SIZE / 2);
    const clampedZ = THREE.MathUtils.clamp(wanderZ, -TERRAIN_SIZE / 2, TERRAIN_SIZE / 2);

    enemy.wanderTarget = new THREE.Vector3(clampedX, getTerrainHeight(clampedX, clampedZ) + ENEMY_HEIGHT_OFFSET, clampedZ);
}

function updateEnemyAttackAnimation(enemy, deltaTime) {
    if (enemy.isAttacking) {
        const attackDuration = 0.3;
        const maxTiltAngle = Math.PI / 6;

        const elapsedTime = clock.elapsedTime - enemy.attackStartTime;
        let animationProgress = elapsedTime / attackDuration;

        if (animationProgress < 0.5) {
            enemy.tiltAngle = -maxTiltAngle * (animationProgress * 2);
        } else if (animationProgress < 1.0) {
            enemy.tiltAngle = -maxTiltAngle * (1.0 - (animationProgress - 0.5) * 2);
        } else {
            enemy.isAttacking = false;
            enemy.tiltAngle = 0;
        }
    } else {
        enemy.tiltAngle = 0;
    }
}

function updateEnemies(deltaTime) {
    let chasingCount = 0;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy) continue;

        const directionToPlayer = new THREE.Vector3().subVectors(playerMesh.position, enemy.mesh.position);
        const distanceToPlayer = directionToPlayer.length();
        directionToPlayer.normalize();

        const terrainHeight = getTerrainHeight(enemy.body.position.x, enemy.body.position.z);
        enemy.body.position.y = terrainHeight + ENEMY_HEIGHT_OFFSET;
        enemy.body.velocity.y = 0;

        if (enemy.health < enemy.maxHealth * ENEMY_FLEE_HEALTH_THRESHOLD) {
            enemy.isFleeing = true;
        }

        if (gameState.campfirePlaced) {
            const distToCampfire = enemy.mesh.position.distanceTo(gameState.campfirePosition);
            if (distToCampfire < CAMPFIRE_RADIUS) {
                enemy.health -= 100 * deltaTime;
                if (enemy.health <= 0) {
                    handleEnemyDefeat(enemy, i);
                    continue;
                }
            }
        }

        let moveDirection = new THREE.Vector3();

        if (enemy.isFleeing) {
            moveDirection = new THREE.Vector3().subVectors(enemy.mesh.position, playerMesh.position);
            moveDirection.y = 0;
            moveDirection.normalize();
            enemy.body.velocity.x = moveDirection.x * ENEMY_FLEE_SPEED;
            enemy.body.velocity.z = moveDirection.z * ENEMY_FLEE_SPEED;
        } else if (distanceToPlayer <= enemy.chaseRange && chasingCount < MAX_CHASING_ENEMIES) {
            chasingCount++;
            moveDirection.copy(directionToPlayer);
            moveDirection.y = 0;
            moveDirection.normalize();

            enemy.body.velocity.x = moveDirection.x * enemy.speed;
            enemy.body.velocity.z = moveDirection.z * enemy.speed;

            if (distanceToPlayer <= enemy.attackRange && clock.elapsedTime - enemy.lastAttack >= enemy.attackCooldown) {
                applyDamageToPlayer(enemy.damage);
                enemy.lastAttack = clock.elapsedTime;
                enemy.isAttacking = true;
                enemy.attackStartTime = clock.elapsedTime;
            }
        } else {
            if (!enemy.wanderTarget || isNaN(enemy.wanderTarget.x) || isNaN(enemy.wanderTarget.z)) {
                setNewWanderTarget(enemy);
            }

            const wanderDirection = new THREE.Vector3().subVectors(enemy.wanderTarget, enemy.mesh.position);
            wanderDirection.y = 0;
            const distanceToTarget = wanderDirection.length();
            wanderDirection.normalize();

            if (distanceToTarget > 1) {
                moveDirection.copy(wanderDirection);
                enemy.body.velocity.x = moveDirection.x * ENEMY_WANDER_SPEED;
                enemy.body.velocity.z = moveDirection.z * ENEMY_WANDER_SPEED;
            } else {
                setNewWanderTarget(enemy);
            }
        }

        if (moveDirection.lengthSq() > 0.01) {
            const angle = Math.atan2(moveDirection.x, moveDirection.z);
            const offsetAngle = angle - Math.PI / 2;
            enemy.facingQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), offsetAngle);
        }

        updateEnemyAttackAnimation(enemy, deltaTime);

        const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), enemy.tiltAngle);
        const targetQuaternion = enemy.facingQuaternion.clone().multiply(tiltQuaternion);
        enemy.mesh.quaternion.slerp(targetQuaternion, 0.1);
        enemy.body.quaternion.copy(enemy.mesh.quaternion);
    }
}

// ### Damage Application
let isPulsingRed = false;

function applyDamageToPlayer(damage) {
    if (clock.elapsedTime < gameState.invulnerableUntil) return;
    gameState.health -= damage;
    gameState.invulnerableUntil = clock.elapsedTime + INVULNERABILITY_DURATION;
    gameState.lastAttackTime = clock.elapsedTime;
    pulseScreenRed();
    if (gameState.health <= 0) {
        gameState.health = gameState.maxHealth;
    }
}

// ### Visual and Particle Effects
function spawnBloodParticles(position) {
    const particleCount = 20;
    const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0x8a0303 });

    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);

        const direction = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 1,
            (Math.random() - 0.5) * 2
        );
        direction.normalize();
        const speed = Math.random() * 2 + 1;
        particle.userData.velocity = direction.multiplyScalar(speed);
        particle.userData.lifespan = 1.0;

        scene.add(particle);
    }
}

function updateBloodParticles(deltaTime) {
    scene.children.forEach(child => {
        if (child.userData && child.userData.velocity && child.userData.lifespan > 0) {
            child.position.add(child.userData.velocity.clone().multiplyScalar(deltaTime));
            child.userData.lifespan -= deltaTime;
            child.userData.velocity.multiplyScalar(0.95);
            child.userData.velocity.y -= 9.8 * deltaTime;

            if (child.userData.lifespan <= 0) {
                scene.remove(child);
            }
        }
    });
}

function pulseScreenRed() {
    if (!isPulsingRed) {
        isPulsingRed = true;
        const overlay = document.getElementById('red-pulse');
        if (overlay) {
            overlay.style.opacity = 0.5;
            setTimeout(() => {
                overlay.style.opacity = 0;
                isPulsingRed = false;
            }, 200);
        }
    }
}

// ### Resource System
function spawnResource() {
    const resourceTypes = [
        { type: 'berries', modelName: 'berries', chance: 0.3 },
        { type: 'stone', modelName: 'rock', chance: 0.2 },
        { type: 'wood', modelName: 'wood', chance: 0.2 },
        { type: 'alien_crystal', modelName: 'alien_crystal', chance: 0.05 },
        { type: 'metal_scrap', modelName: 'metal', chance: 0.1 },
        { type: 'water_bottle', modelName: 'water_bottle', chance: 0.05 },
        { type: 'alien_water', modelName: 'alien_water', chance: 0.05 },
        { type: 'fiber', modelName: 'fiber', chance: 0.05 },
        { type: 'crystal_shard', modelName: 'crystal_shard', chance: 0.05 },
        { type: 'alien_vine', modelName: 'alien_vine', chance: 0.05 },
        { type: 'alien_fruit', modelName: 'alien_fruit', chance: 0.05 },
        { type: 'gold_coin', modelName: 'gold_coin_resource', chance: 0.03 } // Gold coin as resource
    ];

    let totalChance = 0;
    resourceTypes.forEach(type => totalChance += type.chance);
    let rand = Math.random() * totalChance;
    let selectedType = null;
    for (const type of resourceTypes) {
        rand -= type.chance;
        if (rand <= 0) {
            selectedType = type;
            break;
        }
    }
    if (!selectedType) return;


    const x = (Math.random() - 0.5) * TERRAIN_SIZE;
    const z = (Math.random() - 0.5) * TERRAIN_SIZE;
    const y = getHeight(x, z) + RESOURCE_HEIGHT_OFFSET;

    let resourceMesh;
    let modelNameToLoad = selectedType.modelName;
    if (modelNameToLoad === 'gold_coin_resource') modelNameToLoad = 'alien_crystal'; // Reuse model for gold coin for simplicity

    if (models[modelNameToLoad]) {
        resourceMesh = models[modelNameToLoad].clone();
        resourceMesh.scale.set(2, 2, 2);
    } else {
        resourceMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.3),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
    }
    resourceMesh.position.set(x, y, z);
    resourceMesh.castShadow = true;
    resourceMesh.receiveShadow = true;
    scene.add(resourceMesh);

    resources.push({
        type: selectedType.type,
        amount: Math.floor(Math.random() * 3) + 1,
        mesh: resourceMesh
    });
}

function checkResourceCollection() {
    if (keys.e) {
        resources.forEach((resource, index) => {
            const distance = playerMesh.position.distanceTo(resource.mesh.position);
            if (distance < 2) {
                inventory[resource.type] += resource.amount;
                scene.remove(resource.mesh);
                resources.splice(index, 1);
                showFeedback(`Collected ${resource.amount} ${resource.type}!`);
                checkQuests();
                updateInventoryUI();
            }
        });
    }
}

// ### NPC System
function spawnNPC() {
    const x = (Math.random() - 0.5) * TERRAIN_SIZE;
    const z = (Math.random() - 0.5) * TERRAIN_SIZE;
    const y = getHeight(x, z) + NPC_HEIGHT_OFFSET;

    let npcMesh;
    let npcBody;
    if (models.NPC) {
        npcMesh = models.NPC.clone();
        npcMesh.scale.set(4, 4, 4);
        const boundingBox = new THREE.Box3().setFromObject(npcMesh);
        const size = boundingBox.getSize(new THREE.Vector3());
        const npcShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        npcBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
        npcBody.addShape(npcShape);
        npcBody.position.set(x, y, z);
        npcBody.collisionFilterGroup = 8;
        npcBody.collisionFilterMask = 1 | 2 | 4;
        world.addBody(npcBody);
        npcMesh.userData.physicsBody = npcBody;
    } else {
        npcMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 2, 1),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        const npcShape = new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5));
        npcBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
        npcBody.addShape(npcShape);
        npcBody.position.set(x, y, z);
        npcBody.collisionFilterGroup = 8;
        npcBody.collisionFilterMask = 1 | 2 | 4;
        world.addBody(npcBody);
        npcMesh.userData.physicsBody = npcBody;
    }
    npcMesh.position.set(x, y, z);
    npcMesh.castShadow = true;
    npcMesh.receiveShadow = true;
    scene.add(npcMesh);

    npcs.push({
        mesh: npcMesh,
        body: npcBody,
        quests: [{
            id: Date.now(),
            objective: "Collect 5 crystal_shards",
            progress: 0,
            target: 5,
            reward: "laser_sword",
            completed: false
        }]
    });
}

function checkNPCInteraction() {
    if (keys.e) {
        npcs.forEach(npc => {
            const distance = playerMesh.position.distanceTo(npc.mesh.position);
            if (distance < 3 && npc.quests.length > 0) {
                const quest = npc.quests[0];
                if (!quests.some(existingQuest => existingQuest.id === quest.id)) {
                    quests.push(quest);
                    showFeedback(`New Quest from NPC: ${quest.objective}`);
                    npc.quests.shift();
                    updateQuestUI();
                }
            }
        });
    }
}

// ### Terrain Features
function spawnTrees() {
    for (let i = 0; i < 50; i++) {
        const x = (Math.random() - 0.5) * TERRAIN_SIZE;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE;
        const y = getHeight(x, z) + TREE_HEIGHT_OFFSET;

        let treeMesh;
        let treeBody;
        if (models.tree) {
            treeMesh = models.tree.clone();
            treeMesh.scale.set(8, 8, 8);
            const boundingBox = new THREE.Box3().setFromObject(treeMesh);
            const size = boundingBox.getSize(new THREE.Vector3());
            const treeShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
            treeBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
            treeBody.addShape(treeShape);
            treeBody.position.set(x, y, z);
            treeBody.collisionFilterGroup = 8;
            treeBody.collisionFilterMask = 1 | 2 | 4;
            world.addBody(treeBody);
            treeMesh.userData.physicsBody = treeBody;
        } else {
            treeMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.5, 1, 5),
                new THREE.MeshStandardMaterial({ color: 0x8b4513 })
            );
            const treeShape = new CANNON.Cylinder(0.5, 1, 5, 8);
            treeBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
            treeBody.addShape(treeShape);
            treeBody.position.set(x, y, z);
            treeBody.collisionFilterGroup = 8;
            treeBody.collisionFilterMask = 1 | 2 | 4;
            world.addBody(treeBody);
            treeMesh.userData.physicsBody = treeBody;
        }
        treeMesh.position.set(x, y, z);
        treeMesh.castShadow = true;
        treeMesh.receiveShadow = true;
        scene.add(treeMesh);
        trees.push({ mesh: treeMesh, body: treeBody });
    }
}

// ### Buildings and Structures
function createBuilding(x, z, width, depth, height) {
    // Create a group to hold all building parts
    const buildingGroup = new THREE.Group();
    const y = getTerrainHeight(x, z) + height / 2;
    buildingGroup.position.set(x, y, z);

    // Wall material (visible from both sides)
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, side: THREE.DoubleSide });
    const wallThickness = 1;

    // Left wall
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, height, depth),
        wallMaterial
    );
    leftWall.position.set(-width / 2 + wallThickness / 2, 0, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    buildingGroup.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, height, depth),
        wallMaterial
    );
    rightWall.position.set(width / 2 - wallThickness / 2, 0, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    buildingGroup.add(rightWall);

    // Back wall
    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, wallThickness),
        wallMaterial
    );
    backWall.position.set(0, 0, -depth / 2 + wallThickness / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    buildingGroup.add(backWall);

    // Front left wall
    const doorWidth = 6;
    const frontLeftWidth = (width - doorWidth) / 2;
    const frontLeftWall = new THREE.Mesh(
        new THREE.BoxGeometry(frontLeftWidth, height, wallThickness),
        wallMaterial
    );
    frontLeftWall.position.set(-width / 2 + frontLeftWidth / 2, 0, depth / 2 - wallThickness / 2);
    frontLeftWall.castShadow = true;
    frontLeftWall.receiveShadow = true;
    buildingGroup.add(frontLeftWall);

    // Front right wall
    const frontRightWall = new THREE.Mesh(
        new THREE.BoxGeometry(frontLeftWidth, height, wallThickness),
        wallMaterial
    );
    frontRightWall.position.set(width / 2 - frontLeftWidth / 2, 0, depth / 2 - wallThickness / 2);
    frontRightWall.castShadow = true;
    frontRightWall.receiveShadow = true;
    buildingGroup.add(frontRightWall);

    // Door
    const doorHeight = 8;
    const doorDepth = 0.4;
    const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth);
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x4b3621 });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.castShadow = true;

    // Door pivot for swinging
    const doorPivot = new THREE.Object3D();
    const hingeX = -doorWidth / 2;
    const hingeY = -height / 2 + doorHeight / 2;
    const hingeZ = depth / 2 - wallThickness / 2; // Align with front wall plane
    doorPivot.position.set(hingeX, hingeY, hingeZ);
    buildingGroup.add(doorPivot);
    door.position.set(doorWidth / 2, 0, 0); // Relative to pivot, centered in gap
    doorPivot.add(door);
    buildingGroup.doorPivot = doorPivot;
    buildingGroup.door = door;
    door.userData.isDoor = true;
    door.userData.isOpen = false;

    // Half wall above the door
    const halfWallHeight = height - doorHeight - 0.5;
    const halfWallGeometry = new THREE.BoxGeometry(doorWidth, halfWallHeight, wallThickness);
    const halfWall = new THREE.Mesh(halfWallGeometry, wallMaterial);
    halfWall.position.set(0, -height / 2 + doorHeight + halfWallHeight / 2, depth / 2 - wallThickness / 2);
    halfWall.castShadow = true;
    halfWall.receiveShadow = true;
    buildingGroup.add(halfWall);

    // Windows
    const windowWidth = 2;
    const windowHeight = 2.5;
    const windowGeometry = new THREE.BoxGeometry(windowWidth, windowHeight, 0.2);
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0xADD8E6, transparent: true, opacity: 0.7 });
    const windowOffsetZ = depth / 2 - wallThickness / 2 + 0.01;
    const windowOffsetY = height / 4;

    // Ensure windows fit within front wall segments
    const maxWindowOffsetX = frontLeftWidth - windowWidth / 2 - 1; // 1 unit buffer
    const windowOffsetX = Math.min(width / 4, maxWindowOffsetX);

    const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
    window1.position.set(-windowOffsetX, -windowOffsetY, windowOffsetZ);
    window1.castShadow = true;
    buildingGroup.add(window1);

    const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
    window2.position.set(windowOffsetX, -windowOffsetY, windowOffsetZ);
    window2.castShadow = true;
    buildingGroup.add(window2);

    const window3 = new THREE.Mesh(windowGeometry, windowMaterial);
    window3.position.set(-windowOffsetX, windowOffsetY, windowOffsetZ);
    window3.castShadow = true;
    buildingGroup.add(window3);

    const window4 = new THREE.Mesh(windowGeometry, windowMaterial);
    window4.position.set(windowOffsetX, windowOffsetY, windowOffsetZ);
    window4.castShadow = true;
    buildingGroup.add(window4);

    // Roof
    const roofHeight = 4 + Math.random() * 5;
    const roofGeometry = new THREE.ConeGeometry(width * 0.8, roofHeight, 4);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x708090 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(0, height / 2 + roofHeight / 2 - 0.5, 0);
    roof.rotation.y = -Math.PI / 4;
    roof.castShadow = true;
    roof.receiveShadow = true;
    buildingGroup.add(roof);

    // Physics for building walls
    const buildingBody = new CANNON.Body({ mass: 0, material: physicsMaterial });

    // Left wall
    const leftWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, height / 2, depth / 2));
    buildingBody.addShape(leftWallShape, new CANNON.Vec3(-width / 2 + wallThickness / 2, 0, 0));

    // Right wall
    const rightWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, height / 2, depth / 2));
    buildingBody.addShape(rightWallShape, new CANNON.Vec3(width / 2 - wallThickness / 2, 0, 0));

    // Back wall
    const backWallShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, wallThickness / 2));
    buildingBody.addShape(backWallShape, new CANNON.Vec3(0, 0, -depth / 2 + wallThickness / 2));

    // Front wall left
    const frontLeftShape = new CANNON.Box(new CANNON.Vec3(frontLeftWidth / 2, height / 2, wallThickness / 2));
    buildingBody.addShape(frontLeftShape, new CANNON.Vec3(-width / 2 + frontLeftWidth / 2, 0, depth / 2 - wallThickness / 2));

    // Front wall right
    const frontRightShape = new CANNON.Box(new CANNON.Vec3(frontLeftWidth / 2, height / 2, wallThickness / 2));
    buildingBody.addShape(frontRightShape, new CANNON.Vec3(width / 2 - frontLeftWidth / 2, 0, depth / 2 - wallThickness / 2));

    // Half wall above door
    const halfWallShape = new CANNON.Box(new CANNON.Vec3(doorWidth / 2, halfWallHeight / 2, wallThickness / 2));
    buildingBody.addShape(halfWallShape, new CANNON.Vec3(0, -height / 2 + doorHeight + halfWallHeight / 2, depth / 2 - wallThickness / 2));

    buildingBody.position.set(x, y, z);
    buildingBody.collisionFilterGroup = 8;
    buildingBody.collisionFilterMask = 1 | 2 | 4;
    world.addBody(buildingBody);

    // Door physics body
    const doorShape = new CANNON.Box(new CANNON.Vec3(doorWidth / 2, doorHeight / 2, doorDepth / 2));
    const doorBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
    doorBody.addShape(doorShape);
    doorBody.position.set(x, y - height / 2 + doorHeight / 2, z + depth / 2 + doorDepth / 2);
    doorBody.collisionFilterGroup = 8;
    doorBody.collisionFilterMask = 1 | 2 | 4;
    world.addBody(doorBody); // Initially closed

    buildingGroup.body = buildingBody;
    buildingGroup.doorBody = doorBody;
    buildingGroup.hasChest = false;

    // Initialize door animation properties
    buildingGroup.doorCurrentAngle = 0;
    buildingGroup.doorTargetAngle = 0;
    buildingGroup.doorBodyAdded = true;

    scene.add(buildingGroup);

    // Store building dimensions
    buildingGroup.userData.width = width;
    buildingGroup.userData.depth = depth;
    buildingGroup.userData.height = height;

    return buildingGroup;
}

function isAreaFlat(x, z, width, depth, threshold) {
    const points = [
        [x - width / 2, z - depth / 2],
        [x + width / 2, z - depth / 2],
        [x - width / 2, z + depth / 2],
        [x + width / 2, z + depth / 2],
        [x, z]
    ];
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    points.forEach(point => {
        const height = getTerrainHeight(point[0], point[1]);
        if (height < minHeight) minHeight = height;
        if (height > maxHeight) maxHeight = height;
    });
    return maxHeight - minHeight < threshold;
}

function spawnBuildings() {
    const numHousesToSpawn = Math.floor(Math.random() * 4) + 2; // Random number of houses from 2 to 5
    const houseBaseWidth = 20; // Approximate base width of the house
    const houseBaseDepth = 20; // Approximate base depth of the house
    const flatAreaMargin = 50; // Margin around the house for flat area
    const houseWidth = houseBaseWidth + flatAreaMargin; // Increased width for flat area
    const houseDepth = houseBaseDepth + flatAreaMargin; // Increased depth for flat area
    const houseLocations = [];

    for (let i = 0; i < numHousesToSpawn; i++) {
        const x = (Math.random() - 0.5) * TERRAIN_SIZE;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE;
        const flatAreaHeight = getHeight(x, z); // Get height at the center for flattening

        flattenTerrainArea(x, z, houseWidth, houseDepth, flatAreaHeight);
        updateTerrainMesh(); // Update terrain mesh after flattening

        houseLocations.push({ x, z });
    }

    houseLocations.forEach(location => {
        const height = 10 + Math.random() * 10;
        const buildingWidth = 20 + Math.random() * 10; // Actual building width, can be smaller than flat area
        const buildingDepth = 20 + Math.random() * 10; // Actual building depth, can be smaller than flat area
        const newBuilding = createBuilding(location.x, location.z, buildingWidth, buildingDepth, height);
        buildings.push(newBuilding);
        if (Math.random() < CHEST_SPAWN_CHANCE) {
            createChest(newBuilding);
        }
    });
}


// ### Chests
function createChest(building) {
    if (!building || building.hasChest) return;

    const chestWidth = 1.5;
    const chestHeight = 1;
    const chestDepth = 1;

    const chestGeometry = new THREE.BoxGeometry(chestWidth, chestHeight, chestDepth);
    const chestMaterial = new THREE.MeshStandardMaterial({ color: 0xDAA520 });
    const chest = new THREE.Mesh(chestGeometry, chestMaterial);

    const xOffset = (Math.random() - 0.5) * (building.userData.width - chestWidth) * 0.8;
    const zOffset = (Math.random() - 0.5) * (building.userData.depth - chestDepth) * 0.8;

    chest.position.set(xOffset, -building.userData.height / 2 + chestHeight / 2, zOffset);
    chest.castShadow = true;
    building.add(chest);

    building.chest = chest;
    building.hasChest = true;
    chest.userData.isOpenable = true;
    chest.userData.building = building;
    chest.userData.isOpen = false;
}

function checkChestInteraction() {
    if (keys.e) {
        buildings.forEach(building => {
            if (building.chest && building.chest.userData.isOpenable) {
                const dist = playerMesh.position.distanceTo(
                    new THREE.Vector3(
                        building.body.position.x + building.chest.position.x,
                        building.body.position.y + building.chest.position.y,
                        building.body.position.z + building.chest.position.z
                    )
                );

                if (dist < 5) {
                    openChest(building.chest);
                }
            }
        });
    }
}

function openChest(chest) {
    if (!chest.userData.isOpen) {
        chest.rotation.x = -Math.PI / 2;
        chest.userData.isOpen = true;

        const loot = generateChestLoot();
        Object.entries(loot).forEach(([item, quantity]) => {
            inventory[item] += quantity;
            showFeedback(`Found ${quantity} x ${item} in the chest!`);
        });
        updateInventoryUI();
        chest.userData.isOpenable = false;
    }
}

function generateChestLoot() {
    const possibleLoot = [
        { item: 'gold_coin', min: 1, max: 10, chance: 0.9 },
        { item: 'berries', min: 2, max: 5, chance: 0.7 },
        { item: 'water_bottle', min: 1, max: 2, chance: 0.6 },
        { item: 'metal_scrap', min: 1, max: 3, chance: 0.5 },
        { item: 'alien_crystal', min: 1, max: 1, chance: 0.2 }
    ];

    const loot = {};
    possibleLoot.forEach(lootItem => {
        if (Math.random() < lootItem.chance) {
            const quantity = Math.floor(Math.random() * (lootItem.max - lootItem.min + 1)) + lootItem.min;
            loot[lootItem.item] = quantity;
        }
    });
    return loot;
}


// ### UI System
function showFeedback(message) {
    const feedbackDiv = document.getElementById('feedback');
    if (!feedbackDiv) return;
    feedbackDiv.textContent = message;
    feedbackDiv.style.display = 'block';
    setTimeout(() => feedbackDiv.style.display = 'none', 2000);
}

function toggleInventory() {
    gameState.inventoryOpen = !gameState.inventoryOpen;
    document.getElementById('inventory').style.display = gameState.inventoryOpen ? 'block' : 'none';
    if (gameState.inventoryOpen) updateInventoryUI();
}

function toggleCrafting() {
    gameState.craftingOpen = !gameState.craftingOpen;
    document.getElementById('crafting').style.display = gameState.craftingOpen ? 'block' : 'none';
    if (gameState.craftingOpen) updateCraftingUI();
}

function toggleQuests() {
    const questsDiv = document.getElementById('quests');
    gameState.questsOpen = !gameState.questsOpen;
    questsDiv.style.display = gameState.questsOpen ? 'block' : 'none';
    if (gameState.questsOpen) updateQuestUI();
}

function updateCraftingUI() {
    const recipesDiv = document.getElementById('crafting-recipes');
    if (!recipesDiv) return;
    recipesDiv.innerHTML = '';

    Object.entries(recipes).forEach(([item, recipe]) => {
        const recipeDiv = document.createElement('div');
        recipeDiv.className = `recipe ${Object.keys(recipe).every(res => inventory[res] >= recipe[res]) ? 'available' : 'unavailable'}`;
        recipeDiv.innerHTML = `
            <h3>${item}</h3>
            ${Object.entries(recipe).map(([res, qty]) => `${res}: ${qty}`).join(', ')}
            <button onclick="craftItem('${item}')">Craft</button>
        `;
        recipesDiv.appendChild(recipeDiv);
    });
}

// ### Day-Night Cycle
function updateDayNightCycle(deltaTime) {
    gameState.timeOfDay += deltaTime / TOTAL_CYCLE_TIME;
    if (gameState.timeOfDay >= 1) gameState.timeOfDay -= 1;

    const sunAngle = gameState.timeOfDay * 2 * Math.PI;
    const sunElevation = Math.sin(sunAngle) * 50;
    const sunDistance = 100;
    directionalLight.position.set(
        Math.cos(sunAngle) * sunDistance,
        sunElevation,
        Math.sin(sunAngle) * sunDistance
    );

    let brightness = Math.max(0, sunElevation / 50 + 0.5) * 0.75 + 0.25;
    ambientLight.intensity = 0.2 + brightness * 0.8;
    directionalLight.intensity = brightness * 1.5;
    sky.material.color.setHSL(0.6, 1, 0.1 + brightness * 0.4);
}

// ### Minimap Update
function updateMinimap() {
    minimapCtx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    drawMinimapEntity(playerMesh, 'blue');
    enemies.forEach(enemy => drawMinimapEntity(enemy.mesh, 'red'));
    buildings.forEach(building => drawMinimapBuilding(building));
}

function drawMinimapEntity(entityMesh, color) {
    if (!entityMesh) return;
    const minimapX = (entityMesh.position.x * MINIMAP_SCALE + MINIMAP_SIZE / 2);
    const minimapY = (entityMesh.position.z * MINIMAP_SCALE + MINIMAP_SIZE / 2);
    minimapCtx.fillStyle = color;
    minimapCtx.beginPath();
    minimapCtx.arc(minimapX, minimapY, 5, 0, Math.PI * 2);
    minimapCtx.closePath();
    minimapCtx.fill();
}

function drawMinimapBuilding(building) {
    const minimapX = (building.position.x * MINIMAP_SCALE + MINIMAP_SIZE / 2);
    const minimapY = (building.position.z * MINIMAP_SCALE + MINIMAP_SIZE / 2);
    minimapCtx.fillStyle = 'gray';
    const size = 5;
    minimapCtx.fillRect(minimapX - size / 2, minimapY - size / 2, size, size);

    if (building.hasChest) {
        minimapCtx.fillStyle = 'yellow';
        minimapCtx.fillRect(minimapX - size / 4, minimapY - size / 4, size / 2, size / 2);
    }
}

// ### Player Attack Animation
function updatePlayerAttackAnimation() {
    if (playerIsAttacking) {
        const attackDuration = 0.3;
        const maxTiltAngle = Math.PI / 6;

        const elapsedTime = clock.elapsedTime - playerAttackStartTime;
        let animationProgress = elapsedTime / attackDuration;

        if (animationProgress < 0.5) {
            targetTiltAngle = maxTiltAngle * (animationProgress * 2);
        } else if (animationProgress < 1.0) {
            targetTiltAngle = maxTiltAngle * (1.0 - (animationProgress - 0.5) * 2);
        } else {
            playerIsAttacking = false;
            targetTiltAngle = 0;
        }
    } else {
        targetTiltAngle = 0;
    }
}

// ### Door Interaction
function checkDoorInteraction() {
    buildings.forEach(building => {
        if (building.door) {
            const doorWorldPosition = new THREE.Vector3();
            building.door.getWorldPosition(doorWorldPosition);
            const distanceToDoor = playerMesh.position.distanceTo(doorWorldPosition);

            if (distanceToDoor < DOOR_INTERACTION_DISTANCE) {
                interactWithDoor(building);
            }
        }
    });
}

function interactWithDoor(building) {
    if (!building.doorPivot || !building.doorBody) return;
    const door = building.door;

    if (door.userData.isOpen) {
        // Close the door
        building.doorTargetAngle = 0;
        door.userData.isOpen = false;
        showFeedback("Closing door...");
    } else {
        // Open the door
        building.doorTargetAngle = -Math.PI / 2;
        door.userData.isOpen = true;
        if (building.doorBodyAdded) {
            world.removeBody(building.doorBody);
            building.doorBodyAdded = false;
        }
        showFeedback("Opening door...");
    }
}

// ### Game Loop
let clock = new THREE.Clock();

function animate() {
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    world.step(1 / 60, deltaTime, 3);
    updatePhysics(deltaTime);
    processDeferredRemovals();

    if (playerMesh) {
        cameraPivot.position.copy(playerMesh.position);
        if (gameState.isAiming) {
            aimCamera.position.x = playerMesh.position.x;
            aimCamera.position.z = playerMesh.position.z;
            aimCamera.position.y = playerMesh.position.y + 5.0;
        }
    }

    camera.position.z = 15 * zoomLevel;

    // Update door animations
    buildings.forEach(building => {
        if (Math.abs(building.doorCurrentAngle - building.doorTargetAngle) > 0.01) {
            const animationSpeed = 5; // Radians per second
            const deltaAngle = (building.doorTargetAngle - building.doorCurrentAngle) * animationSpeed * deltaTime;
            building.doorCurrentAngle += deltaAngle;
            if (Math.abs(building.doorCurrentAngle - building.doorTargetAngle) < 0.01) {
                building.doorCurrentAngle = building.doorTargetAngle;
                if (building.doorTargetAngle === 0 && !building.doorBodyAdded) {
                    world.addBody(building.doorBody);
                    building.doorBodyAdded = true;
                }
            }
            building.doorPivot.rotation.y = building.doorCurrentAngle;
        } else if (building.doorTargetAngle === 0 && !building.doorBodyAdded) {
            world.addBody(building.doorBody);
            building.doorBodyAdded = true;
        }
    });

    handleMovement(deltaTime);
    if (gameState.isAiming) handleAimModeMovement(deltaTime);
    updatePlayerAttackAnimation();
    const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), targetTiltAngle);
    const targetQuaternion = targetFacingQuaternion.clone().multiply(tiltQuaternion);
    playerMesh.quaternion.slerp(targetQuaternion, 0.2);
    playerBody.quaternion.copy(playerMesh.quaternion);

    handleCombat(deltaTime);
    updateSurvival(deltaTime);
    updateDayNightCycle(deltaTime);
    updateEnemies(deltaTime);
    updateBloodParticles(deltaTime);
    checkResourceCollection();
    checkNPCInteraction();
    checkChestInteraction();
    updateMinimap();
    updateProjectiles(deltaTime);
    updateWeaponSwing(deltaTime);
    updateReload(deltaTime);

    if (playerMixer) playerMixer.update(deltaTime);

    if (Math.random() < 0.01) spawnResource();
    if (enemies.length < MAX_ENEMIES && Math.random() < 0.005) spawnEnemy();

    updateHUD();

    if (gameState.isAiming) {
        renderer.render(scene, aimCamera);
    } else {
        renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
}

// ### HUD Update
function updateHUD() {
    document.getElementById('health').textContent = `Health: ${Math.floor(gameState.health)}/${gameState.maxHealth}`;
    document.getElementById('hunger').textContent = `Hunger: ${Math.floor(gameState.hunger)}`;
    document.getElementById('thirst').textContent = `Thirst: ${Math.floor(gameState.thirst)}`;
    document.getElementById('stamina').textContent = `Stamina: ${Math.floor(gameState.stamina)}/${gameState.maxStamina}`;
    document.getElementById('coins').textContent = `Coins: ${inventory.gold_coin}`; // Update coin display in HUD
}

// ### Initialization
function init() {
    renderer.shadowMap.enabled = true;
    terrainMesh.receiveShadow = true;
    directionalLight.castShadow = true;

    const crosshairDiv = document.createElement('div');
    crosshairDiv.id = 'crosshair';
    crosshairDiv.style.position = 'fixed';
    crosshairDiv.style.left = '50%';
    crosshairDiv.style.top = '50%';
    crosshairDiv.style.transform = 'translate(-50%, -50%)';
    crosshairDiv.style.width = '20px';
    crosshairDiv.style.height = '20px';
    crosshairDiv.style.border = '2px solid white';
    crosshairDiv.style.borderRadius = '50%';
    crosshairDiv.style.pointerEvents = 'none';
    crosshairDiv.style.display = 'none';
    document.body.appendChild(crosshairDiv);

    inventory.axe = 1;
    inventory.sword = 1;
    inventory.energy_blaster = 1;
    inventory.plasma_rifle = 1;
    inventory.laser_sword = 1;
    inventory.energy_cell = 50;
    inventory.plasma_cell = 100;

    Promise.all([
        loadGLTFModel('alien_crystal.glb', 'alien_crystal'),
        loadGLTFModel('alien_fruit.glb', 'alien_fruit'),
        loadGLTFModel('alien_vine.glb', 'alien_vine'),
        loadGLTFModel('alien_water.glb', 'alien_water'),
        loadGLTFModel('axe.glb', 'axe'),
        loadGLTFModel('berries.glb', 'berries'),
        loadGLTFModel('campfire.glb', 'campfire'),
        loadGLTFModel('crystal_shard.glb', 'crystal_shard'),
        loadGLTFModel('enemy1.glb', 'enemy1'),
        loadGLTFModel('enemy2.glb', 'enemy2'),
        loadGLTFModel('enemy3.glb', 'enemy3'),
        loadGLTFModel('enemy4.glb', 'enemy4'),
        loadGLTFModel('energy_blaster.glb', 'energy_blaster'),
        loadGLTFModel('fiber.glb', 'fiber'),
        loadGLTFModel('laser_sword.glb', 'laser_sword'),
        loadGLTFModel('meat.glb', 'meat'),
        loadGLTFModel('metal.glb', 'metal'),
        loadGLTFModel('NPC.glb', 'NPC'),
        loadGLTFModel('plasma_rifle.glb', 'plasma_rifle'),
        loadGLTFModel('rock.glb', 'rock'),
        loadGLTFModel('sword.glb', 'sword'),
        loadGLTFModel('tree.glb', 'tree'),
        loadGLTFModel('water_bottle.glb', 'water_bottle'),
        loadGLTFModel('wood.glb', 'wood'),
        loadGLTFModel('gold_coin.glb', 'gold_coin_resource') // Load gold coin model - though reuses alien crystal model in code
    ]).then(() => {
        console.log("All assets loaded");
        const checkPlayerLoaded = setInterval(() => {
            if (playerMesh) {
                clearInterval(checkPlayerLoaded);
                playerMesh.castShadow = true;

                // Generate terrain and buildings FIRST
                spawnBuildings(); // This will flatten terrain and spawn buildings

                // Then spawn resources, NPCs and trees AFTER the world is ready
                for (let i = 0; i < 10; i++) spawnResource();
                for (let i = 0; i < 3; i++) spawnEnemy();
                for (let i = 0; i < 3; i++) spawnNPC();
                spawnTrees();

                animate();
            }
        }, 100);
    }).catch(error => {
        console.error("Asset loading failed", error);
    });
}

init();

// ### Exposed Functions for HTML
window.equipWeapon = equipWeapon;
window.unequipWeapon = unequipWeapon;
window.craftItem = craftItem;
window.useItem = useItem;
window.placeCampfire = placeCampfire;
window.purchaseItem = purchaseItem; // Expose purchaseItem to HTML

// Window Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    aimCamera.aspect = window.innerWidth / window.innerHeight;
    aimCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});