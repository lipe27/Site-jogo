/**
 * NEBULA FARM PRO - ULTIMATE ARCHITECT UPDATE
 * O Retorno do Moinho + Correção do Eixo + Construção com Grade!
 */

class NebulaFarmPro {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.grass = null;    
        this.lake = null; 
        this.tiles = [];      
        this.plants = [];
        this.animations = [];
        this.animals = []; 
        this.pets = [];       
        this.factories = []; 
        
        // ARRAYS DO MODO ARQUITETO
        this.constructions = []; 
        this.obstacles = [];     
        
        // INTERAÇÕES
        this.isDragging = false; 
        this.activeDragTool = null; 
        this.lastTreePlantTime = 0; 
        
        // CÂMERA PAN (Arrastar Mapa)
        this.isPanning = false;      
        this.panStart = { x: 0, y: 0 };
        this.hasPanned = false;      
        this.pendingBubble = null;   
        
        // MODO CONSTRUÇÃO
        this.placementMode = false;
        this.placementType = null;
        this.placementCost = 0;
        this.placementGhost = null;
        this.placementGrid = null;
        this.placementIsValid = false;

        this.isFishing = false;
        this.timeOfDay = 0;
        
        this.state = {
            money: 1000, xp: 0, lvl: 1, siloCount: 0, maxSilo: 50,
            inventory: { wheat: 10, carrot: 10, corn: 0, apple: 0, orange: 0, egg: 0, milk: 0, bacon: 0, feed: 5, fish: 0, bread: 0, cheese: 0 },
            unlocked: { wheat: true, carrot: true, corn: false, apple: false, orange: false },
            enclosures: { coop: false, pigpen: false, corral: false, mill: false, bakery: false, dairy: false },
            gridSize: 6, currentMission: null
        };

        this.config = {
            wheat:  { color: 0xFFD700, time: 120000, yield: 2, sellPrice: 2, xp: 10 },  
            carrot: { color: 0xFF4500, time: 240000, yield: 2, sellPrice: 5, xp: 20 },  
            corn:   { color: 0xFFEB3B, time: 600000, yield: 2, sellPrice: 12, xp: 50 },
            apple:  { isTree: true, leafColor: 0x27ae60, readyColor: 0xe74c3c, time: 180000, yield: 3, sellPrice: 10, xp: 30 },
            orange: { isTree: true, leafColor: 0x2ecc71, readyColor: 0xe67e22, time: 240000, yield: 3, sellPrice: 16, xp: 45 },
            egg:    { sellPrice: 8, xp: 15 },
            milk:   { sellPrice: 15, xp: 30 },
            bacon:  { sellPrice: 20, xp: 40 },
            fish:   { sellPrice: 25, xp: 50 },
            bread:  { sellPrice: 35, xp: 60 },
            cheese: { sellPrice: 45, xp: 80 } 
        };

        this.animalConfig = {
            chicken: { product: 'egg', time: 60000 }, 
            cow:     { product: 'milk', time: 120000 }, 
            pig:     { product: 'bacon', time: 90000 }  
        };

        this.init();
    }

    init() {
        try {
            this.setupCore();
            this.setupLights();
            this.buildWorld();
            this.setupInteractions();
            this.generateMission(); 
            this.updateUI();
            
            const loader = document.getElementById('loader');
            if(loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 500);
            }
            
            requestAnimationFrame((time) => this.animate(time));
            
        } catch (e) {
            console.error("ERRO GRAVE:", e);
            alert("🚨 PANE NO MOTOR DO JOGO!\nErro: " + e.message);
        }
    }

    setupCore() {
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.008); 
        const aspect = window.innerWidth / window.innerHeight;
        
        const zoom = 18; 
        this.camera = new THREE.OrthographicCamera(-zoom * aspect, zoom * aspect, zoom, -zoom, 1, 1000);
        this.camera.position.set(50, 50, 50);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
    }

    setupLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(this.ambientLight);
        this.sun = new THREE.DirectionalLight(0xffffff, 1.3);
        this.sun.position.set(40, 60, 20);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.scene.add(this.sun);
        this.houseLight = new THREE.PointLight(0xffaa00, 0, 30); 
        this.houseLight.position.set(22, 6, -10);
        this.houseLight.castShadow = true;
        this.scene.add(this.houseLight);
    }

    buildWorld() {
        this.grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x7cb342 }));
        this.grass.rotation.x = -Math.PI / 2; 
        this.grass.receiveShadow = true; 
        this.scene.add(this.grass);
        
        // Áreas que você NÃO pode construir em cima!
        this.obstacles.push({ x: -22, z: -15, r: 8 }); // Celeiro
        this.obstacles.push({ x: 22, z: -10, r: 8 });  // Casa
        this.obstacles.push({ x: 35, z: 25, r: 14 });  // Lago
        this.obstacles.push({ x: 0, z: 0, r: 12 });    // Terra Arada
        this.obstacles.push({ x: -22, z: 10, r: 6 });  // O MOINHO VOLTOU PARA OS OBSTÁCULOS!
        
        this.createBarn(-22, -15); 
        this.createFarmhouse(22, -10); 
        this.createLake(35, 25);
        
        // CHAMANDO O MOINHO DE VOLTA PRO JOGO!
        this.createWindmill(-22, 10); 

        this.renderGrid(); 
        
        for(let i=0; i<45; i++) this.createTree((Math.random()-0.5)*250, (Math.random()-0.5)*250);

        this.createPet('dog', 15, -5);
        this.createPet('cat', 18, -12);
        for(let i=0; i<5; i++) this.createBird(); 
    }

    // ==========================================
    // SISTEMA DE CONSTRUÇÃO (ARQUITETO)
    // ==========================================
    buyBuilding(type, cost) {
        if (this.state.money < cost) { alert("Dinheiro Insuficiente!"); return; }
        if (this.state.enclosures[type]) { alert("Você já possui esta construção!"); return; }
        
        this.closeMarket();
        this.enterPlacementMode(type, cost);
    }

    enterPlacementMode(type, cost) {
        this.placementMode = true;
        this.placementType = type;
        this.placementCost = cost;
        this.placementIsValid = false;

        const ui = document.getElementById('placement-ui');
        if(ui) ui.classList.remove('hidden');

        // Cria a grade do chão
        this.placementGrid = new THREE.GridHelper(200, 50, 0x000000, 0xffffff);
        this.placementGrid.position.y = 0.2;
        this.placementGrid.material.opacity = 0.2;
        this.placementGrid.material.transparent = true;
        this.scene.add(this.placementGrid);

        // Bloco Fantasma (2x2 na nossa escala é 8x8)
        const geo = new THREE.BoxGeometry(8, 4, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
        this.placementGhost = new THREE.Mesh(geo, mat);
        
        // Põe o fantasma na frente da câmera
        this.placementGhost.position.set(this.camera.position.x - 50, 2, this.camera.position.z - 50);
        this.scene.add(this.placementGhost);
        
        this.validatePlacementPosition(this.placementGhost.position.x, this.placementGhost.position.z);
    }

    cancelPlacement() {
        this.placementMode = false;
        const ui = document.getElementById('placement-ui');
        if(ui) ui.classList.add('hidden');
        if (this.placementGrid) this.scene.remove(this.placementGrid);
        if (this.placementGhost) this.scene.remove(this.placementGhost);
    }

    confirmPlacement() {
        if (!this.placementIsValid) return;

        this.state.money -= this.placementCost;
        this.state.enclosures[this.placementType] = true;
        
        const px = this.placementGhost.position.x;
        const pz = this.placementGhost.position.z;

        this.obstacles.push({ x: px, z: pz, r: 5 });

        this.cancelPlacement(); 
        this.updateUI();

        // Demora 10 segundos pra obra ficar pronta
        this.createConstructionSite(this.placementType, px, pz, 10000);
    }

    validatePlacementPosition(x, z) {
        if (!this.placementGhost) return;
        
        // Faz o bloco pular de 4 em 4 unidades
        const snapX = Math.round(x / 4) * 4;
        const snapZ = Math.round(z / 4) * 4;
        
        this.placementGhost.position.set(snapX, 2, snapZ);

        let hasCollision = false;
        for (const obs of this.obstacles) {
            const dist = Math.sqrt(Math.pow(snapX - obs.x, 2) + Math.pow(snapZ - obs.z, 2));
            if (dist < (4 + obs.r)) { 
                hasCollision = true; break;
            }
        }

        this.placementIsValid = !hasCollision;
        this.placementGhost.material.color.setHex(hasCollision ? 0xff0000 : 0x00ff00);
        
        const btn = document.getElementById('btn-confirm-place');
        if(btn) btn.disabled = hasCollision;
    }

    createConstructionSite(type, x, z, buildTimeMs) {
        const site = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 1 });
        const box = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4, 7.5), woodMat);
        box.position.y = 2; box.castShadow = true;
        
        site.add(box);
        site.position.set(x, 0, z);
        this.scene.add(site);
        
        this.spawnFX(x, 150, "CONSTRUINDO...", "#FFD700");

        this.constructions.push({
            mesh: site, type: type, x: x, z: z, timer: Date.now(), duration: buildTimeMs
        });
    }

    finishConstruction(construction) {
        this.scene.remove(construction.mesh); 
        this.spawnFX(window.innerWidth/2, window.innerHeight/2, "OBRA CONCLUÍDA!", "#4CAF50");
        
        if (construction.type === 'bakery') this.createBakery(construction.x, construction.z);
        else if (construction.type === 'dairy') this.createDairy(construction.x, construction.z);
        else if (construction.type === 'coop') this.buildEnclosureOld('coop', construction.x, construction.z);
        else if (construction.type === 'pigpen') this.buildEnclosureOld('pigpen', construction.x, construction.z);
        else if (construction.type === 'corral') this.buildEnclosureOld('corral', construction.x, construction.z);
        
        const btn = document.getElementById(`btn-${construction.type}`);
        if(btn) btn.style.display = 'none';
        
        this.updateUI();
    }

    // ==========================================
    // FÁBRICAS, MOINHO E CONSTRUÇÕES
    // ==========================================
    
    // O MOINHO VOLTOU!
    createWindmill(x, z) {
        const windmill = new THREE.Group();
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 15, 8), new THREE.MeshStandardMaterial({color: 0x8d6e63})); tower.position.y = 7.5; tower.castShadow = true;
        const blades = new THREE.Group();
        for(let i=0; i<4; i++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 0.2), new THREE.MeshStandardMaterial({color: 0xffffff})); blade.position.y = 5; const pivot = new THREE.Group(); pivot.rotation.z = (Math.PI / 2) * i; pivot.add(blade); blades.add(pivot); }
        blades.position.set(0, 14, 2.5); windmill.add(tower, blades); windmill.position.set(x, 0, z); this.scene.add(windmill);
        this.animations.push(() => { blades.rotation.z -= 0.015; }); 
    }

    createDairy(x, z) {
        const dairyGroup = new THREE.Group();
        const baseMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.8 }); 
        const base = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 5), baseMat); base.position.y = 1.5; base.castShadow = true;
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.5 }); 
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.5, 4), roofMat); roof.position.y = 4.25; roof.rotation.y = Math.PI/4; roof.castShadow = true;
        const tankMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.9, roughness: 0.2 }); 
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 16), tankMat); tank.position.set(-2, 1.5, 2); tank.castShadow = true;

        dairyGroup.add(base, roof, tank);
        dairyGroup.position.set(x, 0, z);
        dairyGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: dairyGroup, type: 'dairy' });
        this.scene.add(dairyGroup);

        this.factories.push({ mesh: dairyGroup, type: 'dairy', state: 'idle', timer: 0, duration: 20000, indicator: tank });
    }

    createBakery(x, z) {
        const bakeryGroup = new THREE.Group();
        const baseMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.9 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), baseMat); base.position.y = 1.5; base.castShadow = true;
        const chaminyMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
        const chaminy = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3), chaminyMat); chaminy.position.set(0, 4, -1); chaminy.castShadow = true;
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4, 16, 1, false, 0, Math.PI), baseMat); roof.rotation.z = Math.PI / 2; roof.position.y = 3; roof.castShadow = true;
        const holeMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); 
        const hole = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 0.5), holeMat); hole.position.set(0, 1, 1.8);
        bakeryGroup.add(base, chaminy, roof, hole); bakeryGroup.position.set(x, 0, z);
        bakeryGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: bakeryGroup, type: 'bakery' });
        this.scene.add(bakeryGroup);
        this.factories.push({ mesh: bakeryGroup, type: 'bakery', state: 'idle', timer: 0, duration: 15000, holeMesh: hole });
    }

    createBarn(x, z) {
        if (typeof THREE.GLTFLoader === 'undefined') return;
        const loader = new THREE.GLTFLoader();
        loader.load('celeiro.glb', (gltf) => {
            const barn = gltf.scene; barn.position.set(x, 0, z); barn.scale.set(1, 1, 1); 
            const materialParedeVermelha = new THREE.MeshStandardMaterial({ color: 0xFF0000, roughness: 0.8 }); 
            const materialTelhadoCinza = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 });    
            const materialMadeiraMarrom = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });    
            barn.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true; node.receiveShadow = true;
                    const nomeDaPeca = node.name.toLowerCase(); const nomeDoGrupo = node.parent ? node.parent.name.toLowerCase() : "";
                    if (nomeDaPeca.includes('triangle') || nomeDoGrupo.includes('triangle')) node.material = materialTelhadoCinza;
                    else if (nomeDaPeca.includes('window') || nomeDoGrupo.includes('window') || nomeDaPeca.includes('door') || nomeDoGrupo.includes('door')) node.material = materialMadeiraMarrom;
                    else node.material = materialParedeVermelha; 
                }
            });
            this.scene.add(barn);
        }, undefined, () => {});
    }

    createFarmhouse(x, z) {
        const house = new THREE.Group();
        const wallsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6), wallsMat); walls.position.y = 2.5; walls.castShadow = true; walls.receiveShadow = true;
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.9 });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.5, 4), roofMat); roof.position.y = 6.75; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });
        const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.5, 0.2), doorMat); door.position.set(0, 1.75, 3.1); 
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8 })); knob.position.set(0.6, 0, 0.15); door.add(knob); 
        const winMat = new THREE.MeshStandardMaterial({ color: 0x87CEEB, roughness: 0.1, metalness: 0.8 }); 
        const winBorderMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 }); 
        const criarJanela = (wx, wy, wz) => {
            const winGroup = new THREE.Group(); const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.1), winMat);
            const bTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.2), winBorderMat); bTop.position.y = 0.85;
            const bBot = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.2), winBorderMat); bBot.position.y = -0.85;
            const bL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), winBorderMat); bL.position.x = -0.85;
            const bR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), winBorderMat); bR.position.x = 0.85;
            winGroup.add(glass, bTop, bBot, bL, bR); winGroup.position.set(wx, wy, wz); return winGroup;
        };
        const janelaEsq = criarJanela(-2.5, 3, 3.1); const janelaDir = criarJanela(2.5, 3, 3.1);
        const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 });
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, 1.2), chimneyMat); chimney.position.set(-2, 6, -1); chimney.castShadow = true;
        house.add(walls, roof, door, janelaEsq, janelaDir, chimney); house.position.set(x, 0, z); house.rotation.y = -Math.PI / 6; 
        this.scene.add(house);
    }

    createLake(x, z) {
        const lakeGeo = new THREE.CylinderGeometry(12, 12, 0.2, 32);
        const lakeMat = new THREE.MeshStandardMaterial({ color: 0x2980b9, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.1 });
        this.lake = new THREE.Mesh(lakeGeo, lakeMat); this.lake.position.set(x, 0.1, z); this.scene.add(this.lake);
        for(let i=0; i<8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({color: 0x7f8c8d}));
            rock.position.set(x + Math.cos(angle)*12, 0.5, z + Math.sin(angle)*12); rock.castShadow = true; this.scene.add(rock);
        }
        const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 8), new THREE.MeshStandardMaterial({color: 0x8d6e63})); pier.position.set(x - 10, 0.3, z); this.scene.add(pier);
    }

    buildEnclosureOld(type, x, z) {
        let w = 12, d = 12, color = 0x5d4037;
        if (type === 'coop') { color = 0x8d6e63; const coop = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({color: 0xffcc80})); body.position.y = 1.5; body.castShadow = true; const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2, 4), new THREE.MeshStandardMaterial({color: 0xf44336})); roof.position.y = 4; roof.rotation.y = Math.PI/4; coop.add(body, roof); coop.position.set(x, 0, z-3); this.scene.add(coop); for(let i=0; i<3; i++) this.createAnimal('chicken', {x, z, w, d}); } 
        else if (type === 'pigpen') { const mud = new THREE.Mesh(new THREE.BoxGeometry(w-1, 0.2, d-1), new THREE.MeshStandardMaterial({color: 0x4e342e})); mud.position.set(x, 0.1, z); this.scene.add(mud); for(let i=0; i<2; i++) this.createAnimal('pig', {x, z, w, d}); } 
        else if (type === 'corral') { w = 18; d = 16; color = 0xe0e0e0; const trough = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1.5), new THREE.MeshStandardMaterial({color: 0x795548})); trough.position.set(x + 5, 0.5, z - 5); this.scene.add(trough); for(let i=0; i<2; i++) this.createAnimal('cow', {x, z, w, d}); }
        const mat = new THREE.MeshStandardMaterial({color: color}); const geoH = new THREE.BoxGeometry(w, 1, 0.5); const geoV = new THREE.BoxGeometry(0.5, 1, d);
        const f1 = new THREE.Mesh(geoH, mat); f1.position.set(x, 0.5, z - d/2); f1.castShadow = true; const f2 = new THREE.Mesh(geoH, mat); f2.position.set(x, 0.5, z + d/2); f2.castShadow = true;
        const f3 = new THREE.Mesh(geoV, mat); f3.position.set(x - w/2, 0.5, z); f3.castShadow = true; const f4 = new THREE.Mesh(geoV, mat); f4.position.set(x + w/2, 0.5, z); f4.castShadow = true;
        this.scene.add(f1, f2, f3, f4);
    }

    createAnimal(type, bounds) {
        const animal = new THREE.Group(); let speed = 0;
        if (type === 'pig') { const pink = new THREE.MeshStandardMaterial({ color: 0xf8bbd0 }); const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.8), pink); body.position.y = 0.6; const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.2), new THREE.MeshStandardMaterial({color: 0xf48fb1})); snout.position.set(0, 0.7, 1.0); animal.add(body, snout); speed = 0.03; } 
        else if (type === 'chicken') { const white = new THREE.MeshStandardMaterial({ color: 0xffffff }); const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.8), white); body.position.y = 0.35; const beak = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.3), new THREE.MeshStandardMaterial({color: 0xffb300})); beak.position.set(0, 0.5, 0.5); animal.add(body, beak); speed = 0.05; } 
        else if (type === 'cow') { const white = new THREE.MeshStandardMaterial({ color: 0xffffff }); const black = new THREE.MeshStandardMaterial({ color: 0x222222 }); const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 2.5), white); body.position.y = 1.0; const spot = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 1.0), black); spot.position.y = 1.0; const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), white); head.position.set(0, 1.5, 1.5); animal.add(body, spot, head); speed = 0.02; }
        const startX = bounds.x + (Math.random() - 0.5) * (bounds.w - 2); const startZ = bounds.z + (Math.random() - 0.5) * (bounds.d - 2);
        animal.position.set(startX, 0, startZ); animal.castShadow = true; animal.children.forEach(c => { c.userData = { isAnimal: true, parentRef: animal }; }); this.scene.add(animal);
        this.animals.push({ mesh: animal, bounds: bounds, type: type, speed: speed, target: new THREE.Vector3(startX, 0, startZ), state: 'hungry', timer: 0, product: this.animalConfig[type].product, produceTime: this.animalConfig[type].time, produceTimer: null });
    }

    updateAnimals() {
        const now = Date.now();
        this.animals.forEach(anim => {
            if (anim.state === 'hungry') { anim.mesh.scale.set(0.9, 0.8, 0.9); return; }
            if (anim.state === 'producing' || anim.state === 'idle' || anim.state === 'walking') {
                if (now - anim.produceTimer > anim.produceTime) { anim.state = 'ready'; new TWEEN.Tween(anim.mesh.scale).to({x: 1.4, y: 1.4, z: 1.4}, 500).easing(TWEEN.Easing.Elastic.Out).start(); } 
                else {
                    if (anim.state === 'idle' || anim.state === 'producing') { anim.timer--; if (anim.timer <= 0) { anim.state = 'walking'; anim.target.set(anim.bounds.x + (Math.random() - 0.5) * (anim.bounds.w - 2), 0, anim.bounds.z + (Math.random() - 0.5) * (anim.bounds.d - 2)); } } 
                    else if (anim.state === 'walking') {
                        const dx = anim.target.x - anim.mesh.position.x; const dz = anim.target.z - anim.mesh.position.z; const dist = Math.sqrt(dx*dx + dz*dz);
                        if (dist < 0.3) { anim.state = 'idle'; anim.timer = 100 + Math.random() * 200; anim.mesh.position.y = 0; } 
                        else { anim.mesh.position.x += (dx / dist) * anim.speed; anim.mesh.position.z += (dz / dist) * anim.speed; anim.mesh.rotation.y = Math.atan2(dx, dz); anim.mesh.position.y = Math.abs(Math.sin(now * 0.015)) * (anim.type === 'cow' ? 0.1 : 0.25); }
                    }
                }
            } else if (anim.state === 'ready') { anim.mesh.position.y = Math.abs(Math.sin(now * 0.005)) * 0.2; }
        });
    }

    createTree(x, z) {
        for(const obs of this.obstacles) { if (Math.sqrt(Math.pow(x - obs.x, 2) + Math.pow(z - obs.z, 2)) < obs.r + 3) return; }
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 5), new THREE.MeshStandardMaterial({color: 0x5d4037}));
        const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(3.5, 1), new THREE.MeshStandardMaterial({color: 0x388e3c}));
        leaves.position.y = 5.5; trunk.position.y = 2.5; leaves.castShadow = true; trunk.castShadow = true;
        tree.add(trunk, leaves); tree.position.set(x, 0, z); this.scene.add(tree);
    }

    createPet(type, startX, startZ) {
        const pet = new THREE.Group(); let speed = 0.06;
        if (type === 'dog') {
            const fur = new THREE.MeshStandardMaterial({ color: 0xd35400 }); 
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 2), fur); body.position.y = 0.7;
            const head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), fur); head.position.set(0, 1.2, 1.2);
            const snout = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), fur); snout.position.set(0, 1.1, 1.8);
            pet.add(body, head, snout);
        } else if (type === 'cat') {
            const fur = new THREE.MeshStandardMaterial({ color: 0x7f8c8d }); 
            const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.5), fur); body.position.y = 0.5;
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), fur); head.position.set(0, 0.9, 1);
            const ear1 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4), fur); ear1.position.set(0.25, 1.4, 1);
            const ear2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4), fur); ear2.position.set(-0.25, 1.4, 1);
            pet.add(body, head, ear1, ear2); speed = 0.07; 
        }
        pet.position.set(startX, 0, startZ); pet.castShadow = true; this.scene.add(pet);
        this.pets.push({ mesh: pet, type: type, speed: speed, target: new THREE.Vector3(startX, 0, startZ), state: 'idle', timer: Math.random() * 100 });
    }

    createBird() {
        const bird = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.6), new THREE.MeshStandardMaterial({color: 0x2980b9}));
        const wings = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), new THREE.MeshStandardMaterial({color: 0x3498db}));
        bird.add(body, wings); const pivot = new THREE.Group();
        pivot.position.set((Math.random()-0.5)*100, 15 + Math.random()*5, (Math.random()-0.5)*100);
        bird.position.set(10 + Math.random()*5, 0, 0); pivot.add(bird); this.scene.add(pivot);
        const speed = 0.02 + Math.random()*0.02;
        this.animations.push(() => { pivot.rotation.y += speed; bird.position.y = Math.sin(Date.now() * 0.005 * speed * 100) * 2; });
    }

    updatePets() {
        this.pets.forEach(pet => {
            if (pet.state === 'idle') { pet.timer--; if (pet.timer <= 0) { pet.state = 'walking'; pet.target.set((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60); } } 
            else if (pet.state === 'walking') {
                const dx = pet.target.x - pet.mesh.position.x; const dz = pet.target.z - pet.mesh.position.z; const dist = Math.sqrt(dx*dx + dz*dz);
                if (dist < 0.5) { pet.state = 'idle'; pet.timer = 100 + Math.random() * 300; } 
                else { pet.mesh.position.x += (dx / dist) * pet.speed; pet.mesh.position.z += (dz / dist) * pet.speed; pet.mesh.rotation.y = Math.atan2(dx, dz); pet.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.01)) * 0.2; }
            }
        });
    }

    renderGrid() {
        this.tiles.forEach(t => this.scene.remove(t)); this.tiles = []; const dirtMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 }); const offset = (this.state.gridSize * 3.5) / 2 - 1.75; 
        for(let x=0; x<this.state.gridSize; x++) { for(let z=0; z<this.state.gridSize; z++) { const tile = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), dirtMat); tile.position.set(x * 3.5 - offset, 0.25, z * 3.5 - offset); tile.receiveShadow = true; tile.userData = { occupied: false }; this.scene.add(tile); this.tiles.push(tile); } }
    }

    // ==========================================
    // SISTEMA DE INTERAÇÃO (COM O PAN CORRIGIDO)
    // ==========================================
    setupInteractions() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        window.addEventListener('pointerdown', (e) => {
            if (e.target.closest('#game-ui') || e.target.closest('#market-modal')) return;
            if (e.target.closest('.bubble-item')) return;

            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, this.camera);

            if (this.placementMode) {
                const hitsGrass = raycaster.intersectObject(this.grass);
                if (hitsGrass.length > 0) this.validatePlacementPosition(hitsGrass[0].point.x, hitsGrass[0].point.z);
                return;
            }

            const bubble = document.getElementById('bubble-menu');
            if (bubble && bubble.style.display === 'flex') this.hideBubble();

            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.hasPanned = false;
            this.pendingBubble = null;

            const factoryMeshes = []; this.factories.forEach(f => factoryMeshes.push(...f.mesh.children));
            const hitsF = raycaster.intersectObjects(factoryMeshes);
            if (hitsF.length > 0) {
                const fac = this.factories.find(f => f.mesh === hitsF[0].object.userData.parentRef);
                if (fac && fac.state === 'idle') this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: fac.type + '_idle' };
                else if (fac && fac.state === 'ready') this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: fac.type + '_ready' };
                return;
            }

            const plantMeshes = this.plants.filter(p => p.progress >= 1).flatMap(p => p.mesh.type === 'Group' ? p.mesh.children : [p.mesh]);
            if (raycaster.intersectObjects(plantMeshes).length > 0) { 
                this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'harvest_plant' }; return; 
            }

            const animalMeshes = []; this.animals.forEach(a => animalMeshes.push(...a.mesh.children));
            const hitsA = raycaster.intersectObjects(animalMeshes);
            if (hitsA.length > 0) {
                const anim = this.animals.find(a => a.mesh === hitsA[0].object.userData.parentRef);
                if (anim.state === 'hungry') this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'feed_animal' };
                else if (anim.state === 'ready') this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'harvest_animal' };
                return;
            }

            if (this.lake && raycaster.intersectObject(this.lake).length > 0) {
                this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'fish' }; return;
            }

            const hitsTiles = raycaster.intersectObjects(this.tiles);
            if (hitsTiles.length > 0 && !hitsTiles[0].object.userData.occupied) {
                this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'plant_crop' }; return;
            }

            const hitsGrass = raycaster.intersectObject(this.grass);
            if (hitsGrass.length > 0) {
                this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'plant_tree' }; return;
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (this.placementMode) return; 
            
            if (this.isDragging && this.activeDragTool) {
                mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
                raycaster.setFromCamera(mouse, this.camera);
                this.applyDragTool(raycaster, e.clientX, e.clientY);
            } 
            else if (this.isPanning) {
                const moveX = e.clientX - this.panStart.x;
                const moveY = e.clientY - this.panStart.y;
                
                if (Math.abs(moveX) > 4 || Math.abs(moveY) > 4) {
                    this.hasPanned = true;
                    this.pendingBubble = null; 
                    const f = 0.08; 
                    
                    let newX = this.camera.position.x - (moveX * f) - (moveY * f);
                    let newZ = this.camera.position.z + (moveX * f) - (moveY * f);
                    
                    newX = Math.max(-40, Math.min(110, newX));
                    newZ = Math.max(-40, Math.min(110, newZ));
                    
                    this.camera.position.x = newX;
                    this.camera.position.z = newZ;
                    
                    this.panStart = { x: e.clientX, y: e.clientY };
                }
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.placementMode) return;
            this.isPanning = false;
            if (this.activeDragTool) {
                this.isDragging = false;
                this.activeDragTool = null;
                this.hideBubble();
            } 
            else if (!this.hasPanned && this.pendingBubble) {
                this.showBubble(this.pendingBubble.x, this.pendingBubble.y, this.pendingBubble.ctx);
            }
        });
    }

    showBubble(x, y, context) {
        const bubble = document.getElementById('bubble-menu');
        if(!bubble) return;
        bubble.style.left = x + 'px';
        bubble.style.top = y + 'px';
        bubble.style.display = 'flex';
        bubble.innerHTML = '';

        if (context === 'plant_crop') {
            if(this.state.unlocked.wheat) bubble.innerHTML += this.createBubbleItem('wheat', '🌾', this.state.inventory.wheat);
            if(this.state.unlocked.carrot) bubble.innerHTML += this.createBubbleItem('carrot', '🥕', this.state.inventory.carrot);
            if(this.state.unlocked.corn) bubble.innerHTML += this.createBubbleItem('corn', '🌽', this.state.inventory.corn);
        } else if (context === 'plant_tree') {
            if(this.state.unlocked.apple) bubble.innerHTML += this.createBubbleItem('apple', '🌳', this.state.inventory.apple);
            if(this.state.unlocked.orange) bubble.innerHTML += this.createBubbleItem('orange', '🍊', this.state.inventory.orange);
        } else if (context === 'harvest_plant' || context === 'harvest_animal') {
            bubble.innerHTML += this.createBubbleItem('harvest', '✂️', 'CORTAR');
        } else if (context === 'feed_animal') {
            bubble.innerHTML += this.createBubbleItem('feed', '🥣', this.state.inventory.feed);
        } else if (context === 'fish') {
            bubble.innerHTML += this.createBubbleItem('fish', '🎣', '1🌽');
        } else if (context === 'bakery_idle') {
            const canBake = this.state.inventory.wheat >= 3 ? this.state.inventory.wheat : 0; 
            bubble.innerHTML += this.createBubbleItem('bake_bread', '🌾', '-3🌾', canBake === 0);
        } else if (context === 'bakery_ready') {
            bubble.innerHTML += this.createBubbleItem('collect_bread', '🍞', 'PEGAR');
        } else if (context === 'dairy_idle') {
            const canMakeCheese = this.state.inventory.milk >= 2 ? this.state.inventory.milk : 0; 
            bubble.innerHTML += this.createBubbleItem('make_cheese', '🥛', '-2🥛', canMakeCheese === 0);
        } else if (context === 'dairy_ready') {
            bubble.innerHTML += this.createBubbleItem('collect_cheese', '🧀', 'PEGAR');
        }

        document.querySelectorAll('.bubble-item').forEach(item => {
            if (!item.classList.contains('locked')) {
                item.addEventListener('pointerdown', (e) => {
                    e.preventDefault(); 
                    this.activeDragTool = e.currentTarget.dataset.tool;
                    this.isDragging = true;
                    e.stopPropagation(); 
                });
            }
        });
    }

    createBubbleItem(tool, icon, textOverride, forceLock = false) {
        const lockedClass = forceLock || (typeof textOverride === 'number' && textOverride <= 0) ? 'locked' : '';
        return `<div class="bubble-item ${lockedClass}" data-tool="${tool}">${icon}<small>${textOverride}</small></div>`;
    }

    hideBubble() { 
        const b = document.getElementById('bubble-menu');
        if(b) b.style.display = 'none'; 
    }

    applyDragTool(raycaster, x, y) {
        if (this.activeDragTool === 'bake_bread' || this.activeDragTool === 'make_cheese') {
            const factoryMeshes = []; this.factories.forEach(f => factoryMeshes.push(...f.mesh.children));
            const hitsF = raycaster.intersectObjects(factoryMeshes);
            if (hitsF.length > 0) {
                const fac = this.factories.find(f => f.mesh === hitsF[0].object.userData.parentRef);
                if (fac && fac.state === 'idle') {
                    if (this.activeDragTool === 'bake_bread' && this.state.inventory.wheat >= 3) {
                        this.state.inventory.wheat -= 3; fac.state = 'baking'; fac.timer = Date.now();
                        this.spawnFX(x, y, "ASSANDO PÃO...", "#e67e22"); this.activeDragTool = null; this.isDragging = false; this.hideBubble(); this.updateUI();
                    } else if (this.activeDragTool === 'make_cheese' && this.state.inventory.milk >= 2) {
                        this.state.inventory.milk -= 2; fac.state = 'baking'; fac.timer = Date.now();
                        this.spawnFX(x, y, "PRODUZINDO QUEIJO...", "#f1c40f"); this.activeDragTool = null; this.isDragging = false; this.hideBubble(); this.updateUI();
                    }
                }
            } return;
        }

        if (this.activeDragTool === 'collect_bread' || this.activeDragTool === 'collect_cheese') {
            const factoryMeshes = []; this.factories.forEach(f => factoryMeshes.push(...f.mesh.children));
            const hitsF = raycaster.intersectObjects(factoryMeshes);
            if (hitsF.length > 0) {
                const fac = this.factories.find(f => f.mesh === hitsF[0].object.userData.parentRef);
                if (fac && fac.state === 'ready') {
                    if (this.state.siloCount + 1 > this.state.maxSilo) { this.spawnFX(x, y, "SILO CHEIO!", "#F44336"); return; }
                    if (fac.type === 'bakery') { this.state.inventory.bread++; this.state.xp += this.config.bread.xp; this.spawnFX(x, y, "+1 🍞", "#e67e22"); }
                    if (fac.type === 'dairy') { this.state.inventory.cheese++; this.state.xp += this.config.cheese.xp; this.spawnFX(x, y, "+1 🧀", "#f1c40f"); }
                    this.state.siloCount++; fac.state = 'idle'; this.checkLevel();
                    this.activeDragTool = null; this.isDragging = false; this.hideBubble(); this.updateUI();
                }
            } return;
        }

        if (this.activeDragTool === 'harvest') {
            const plantMeshes = this.plants.filter(p => p.progress >= 1).flatMap(p => p.mesh.type === 'Group' ? p.mesh.children : [p.mesh]);
            const hitsP = raycaster.intersectObjects(plantMeshes);
            if (hitsP.length > 0) this.harvestPlant(hitsP[0].object, x, y);
            const animalMeshes = []; this.animals.forEach(a => animalMeshes.push(...a.mesh.children));
            const hitsA = raycaster.intersectObjects(animalMeshes);
            if (hitsA.length > 0) this.harvestAnimal(hitsA[0].object.userData.parentRef, x, y);
        } else if (this.activeDragTool === 'feed') {
            const animalMeshes = []; this.animals.forEach(a => animalMeshes.push(...a.mesh.children));
            const hitsA = raycaster.intersectObjects(animalMeshes);
            if (hitsA.length > 0) this.feedAnimal(hitsA[0].object.userData.parentRef, x, y);
        } else if (this.activeDragTool === 'fish') {
             const hitsLake = raycaster.intersectObject(this.lake);
             if(hitsLake.length > 0) { this.startFishing(x, y); this.activeDragTool = null; this.isDragging = false; this.hideBubble(); }
        } else {
            const seedType = this.activeDragTool;
            if (this.config[seedType].isTree) {
                const hitsGrass = raycaster.intersectObject(this.grass);
                if (hitsGrass.length > 0 && Date.now() - this.lastTreePlantTime > 400) {
                    this.plantTree(hitsGrass[0].point, seedType); this.lastTreePlantTime = Date.now(); this.updateBubbleQuantity(seedType); 
                }
            } else {
                const hitsTiles = raycaster.intersectObjects(this.tiles);
                if (hitsTiles.length > 0) { this.plant(hitsTiles[0].object, seedType); this.updateBubbleQuantity(seedType); }
            }
        }
    }

    updateBubbleQuantity(tool) {
        const bubbleItem = document.querySelector(`.bubble-item[data-tool="${tool}"] small`);
        if(bubbleItem) {
            const qty = this.state.inventory[tool]; bubbleItem.innerText = qty;
            if(qty <= 0) bubbleItem.parentElement.classList.add('locked');
        }
    }

    startFishing(x, y) {
        if (this.isFishing) return; 
        if (this.state.inventory.corn <= 0) { this.spawnFX(x, y, "PRECISA DE 1 MILHO (ISCA)", "#F44336"); return; }
        if (this.state.siloCount >= this.state.maxSilo) { this.spawnFX(x, y, "SILO CHEIO!", "#F44336"); return; }

        this.state.inventory.corn--; this.isFishing = true; this.spawnFX(x, y, "PESCANDO...", "#3498db"); this.updateUI();
        setTimeout(() => {
            this.isFishing = false; const chance = Math.random();
            if (chance > 0.3) { this.state.inventory.fish++; this.state.siloCount++; this.state.xp += this.config.fish.xp; this.spawnFX(x, y - 50, "🎣 PEGOU UM PEIXE!", "#4CAF50"); this.checkLevel(); } 
            else { this.spawnFX(x, y - 50, "🥾 PEGOU UMA BOTA VELHA...", "#9e9e9e"); }
            this.updateUI();
        }, 3000);
    }

    generateMission() {
        const types = ['wheat', 'carrot', 'egg', 'apple']; 
        if(this.state.unlocked.corn) types.push('corn');
        if(this.state.unlocked.orange) types.push('orange');
        if(this.state.enclosures.pigpen) types.push('bacon');
        if(this.state.enclosures.corral) types.push('milk');
        if(this.state.inventory.fish > 0) types.push('fish'); 
        if(this.state.enclosures.bakery) types.push('bread'); 
        if(this.state.enclosures.dairy) types.push('cheese'); 
        
        const type = types[Math.floor(Math.random() * types.length)];
        const qty = (type === 'bread' || type === 'cheese') ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 4) + 2; 
        const basePrice = this.config[type] ? this.config[type].sellPrice : 0;
        const reward = (basePrice * qty) * 2; 
        this.state.currentMission = { type, qty, reward };
        this.updateUI();
    }

    completeMission() {
        const m = this.state.currentMission;
        if(this.state.inventory[m.type] >= m.qty) {
            this.state.inventory[m.type] -= m.qty; this.state.siloCount -= m.qty;
            this.state.money += m.reward; this.state.xp += 150; 
            this.spawnFX(window.innerWidth/2, 100, `ENTREGA CONCLUÍDA! +$${m.reward}`, "#FFD700");
            this.checkLevel(); this.generateMission(); this.updateUI();
        }
    }

    checkLevel() {
        const targetXP = this.state.lvl * 300;
        if(this.state.xp >= targetXP) {
            this.state.lvl++; this.state.xp = 0; 
            this.state.inventory.wheat += 5; this.state.inventory.carrot += 5;
            this.spawnFX(window.innerWidth/2, window.innerHeight/2 - 50, `LEVEL ${this.state.lvl}!`, "#4CAF50");
            
            if (this.state.lvl === 2 && !this.state.unlocked.corn) { this.state.unlocked.corn = true; this.state.inventory.corn += 5; setTimeout(() => this.spawnFX(window.innerWidth/2, window.innerHeight/2 + 20, "MILHO LIBERADO!", "#FFD700"), 1000); }
            if (this.state.lvl === 3 && !this.state.unlocked.apple) { this.state.unlocked.apple = true; this.state.inventory.apple += 2; setTimeout(() => this.spawnFX(window.innerWidth/2, window.innerHeight/2 + 20, "MACIEIRA LIBERADA!", "#e74c3c"), 1000); }
            if (this.state.lvl === 4 && !this.state.unlocked.orange) { this.state.unlocked.orange = true; this.state.inventory.orange += 2; setTimeout(() => this.spawnFX(window.innerWidth/2, window.innerHeight/2 + 20, "LARANJEIRA LIBERADA!", "#e67e22"), 1000); }
            this.updateUI();
        }
    }

    feedAnimal(animalGroup, x, y) {
        const anim = this.animals.find(a => a.mesh === animalGroup);
        if (!anim || anim.state !== 'hungry' || this.state.inventory.feed <= 0) return;
        this.state.inventory.feed--; anim.state = 'producing'; anim.produceTimer = Date.now(); anim.timer = 0;
        new TWEEN.Tween(anim.mesh.scale).to({x: 1, y: 1, z: 1}, 300).easing(TWEEN.Easing.Bounce.Out).start();
        this.spawnFX(x, y, "❤️", "#F44336"); this.updateBubbleQuantity('feed'); this.updateUI();
    }

    plant(tile, seedType) {
        if (tile.userData.occupied || this.state.inventory[seedType] <= 0) return;
        this.state.inventory[seedType]--; tile.userData.occupied = true;
        const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshStandardMaterial({color: 0x4caf50}));
        stalk.position.set(tile.position.x, 0.4, tile.position.z); this.scene.add(stalk);
        this.plants.push({ mesh: stalk, tile, type: seedType, plantedAt: Date.now(), progress: 0 }); this.updateUI();
    }

    plantTree(point, seedType) {
        if (this.state.inventory[seedType] <= 0) return;
        this.state.inventory[seedType]--; const conf = this.config[seedType];
        const mesh = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5), new THREE.MeshStandardMaterial({color: 0x5d4037})); trunk.position.y = 0.75;
        const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), new THREE.MeshStandardMaterial({color: conf.leafColor})); leaves.position.y = 2;
        mesh.add(trunk, leaves); mesh.position.set(point.x, 0, point.z); this.scene.add(mesh);
        this.plants.push({ mesh: mesh, type: seedType, plantedAt: Date.now(), progress: 0 }); this.updateUI();
    }

    harvestPlant(mesh, x, y) {
        let targetMesh = mesh; if (mesh.parent && mesh.parent.type === "Group") targetMesh = mesh.parent;
        const idx = this.plants.findIndex(p => p.mesh === targetMesh); if (idx === -1) return;
        const p = this.plants[idx]; if (p.progress < 1) return;
        const conf = this.config[p.type]; if (this.state.siloCount + conf.yield > this.state.maxSilo) return;
        this.state.inventory[p.type] += conf.yield; this.state.siloCount += conf.yield; this.state.xp += conf.xp;
        
        if (conf.isTree) { p.progress = 0; p.plantedAt = Date.now(); p.mesh.children[1].material.color.setHex(conf.leafColor); this.spawnFX(x, y, `+${conf.yield} ${p.type.toUpperCase()}`, "#FFF"); } 
        else { p.tile.userData.occupied = false; if(typeof TWEEN !== 'undefined') new TWEEN.Tween(p.mesh.scale).to({x:0,y:0,z:0}, 200).onComplete(()=>this.scene.remove(p.mesh)).start(); else this.scene.remove(p.mesh); this.plants.splice(idx, 1); this.spawnFX(x, y, `+${conf.yield} ${p.type.toUpperCase()}`, "#FFF"); }
        this.checkLevel(); this.updateUI();
    }

    harvestAnimal(animalGroup, x, y) {
        const anim = this.animals.find(a => a.mesh === animalGroup);
        if (!anim || anim.state !== 'ready' || this.state.siloCount + 1 > this.state.maxSilo) return;
        const prodConf = this.config[anim.product]; this.state.inventory[anim.product]++; this.state.siloCount++; this.state.xp += prodConf.xp;
        anim.state = 'hungry'; anim.mesh.position.y = 0; new TWEEN.Tween(anim.mesh.scale).to({x: 0.9, y: 0.8, z: 0.9}, 300).start();
        let icon = anim.product === 'egg' ? '🥚' : (anim.product === 'milk' ? '🥛' : '🥓');
        this.spawnFX(x, y, `+1 ${icon}`, "#FFD700"); this.checkLevel(); this.updateUI();
    }

    openMarket() { document.getElementById('market-modal').classList.remove('modal-hidden'); this.updateUI(); }
    closeMarket() { document.getElementById('market-modal').classList.add('modal-hidden'); }

    craftFeed() {
        if (this.state.inventory.wheat >= 3 && this.state.inventory.corn >= 1) { this.state.inventory.wheat -= 3; this.state.inventory.corn -= 1; this.state.inventory.feed++; this.spawnFX(window.innerWidth/2, 200, "🥣 RAÇÃO PRONTA!", "#FFD700"); this.updateUI(); } 
        else { alert("Recursos insuficientes! (3 Trigos + 1 Milho)"); }
    }

    buySeed(type, amount, cost) {
        if (this.state.money >= cost) { if (!this.state.unlocked[type]) { alert("Você precisa subir de nível primeiro!"); return; } this.state.money -= cost; this.state.inventory[type] += amount; this.spawnFX(window.innerWidth/2, 200, `+${amount} ${type.toUpperCase()}`, "#4CAF50"); this.updateUI(); } 
        else { alert("Dinheiro Insuficiente!"); }
    }

    sellItem(type) {
        if (this.state.inventory[type] > 0) { this.state.inventory[type]--; this.state.siloCount--; this.state.money += this.config[type].sellPrice; this.spawnFX(window.innerWidth/2, 200, `+ $${this.config[type].sellPrice}`, "#FFD700"); this.updateUI(); } 
        else { alert(`Estoque vazio!`); }
    }

    buyUpgrade(type, cost) {
        if (this.state.money >= cost) { this.state.money -= cost; if (type === 'silo') { this.state.maxSilo += 25; alert("Silo Ampliado!"); } else if (type === 'land') { this.state.gridSize += 1; this.renderGrid(); alert("Lote expandido!"); } this.updateUI(); } 
        else { alert("Dinheiro Insuficiente!"); }
    }

    spawnFX(x, y, text, color) {
        const el = document.createElement('div'); el.className = 'floating-feedback'; el.innerText = text; el.style.color = color;
        el.style.left = x + 'px'; el.style.top = y + 'px'; document.body.appendChild(el); setTimeout(() => el.remove(), 1000);
    }

    // ==========================================
    // INTERFACE BLINDADA - O SEGREDO PRA NÃO CRASHAR
    // ==========================================
    updateUI() {
        const setTxt = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setTxt('money', this.state.money);
        setTxt('silo-text', `${this.state.siloCount}/${this.state.maxSilo}`);
        setTxt('lvl', this.state.lvl);
        
        const xpBar = document.getElementById('xp-bar');
        if (xpBar) xpBar.style.width = (this.state.xp / (this.state.lvl * 300)) * 100 + "%";

        setTxt('qty-apple', this.state.inventory.apple); 
        setTxt('qty-orange', this.state.inventory.orange); 
        setTxt('qty-egg', this.state.inventory.egg);
        setTxt('qty-milk', this.state.inventory.milk);
        setTxt('qty-bacon', this.state.inventory.bacon);
        setTxt('qty-bread', this.state.inventory.bread);
        setTxt('qty-cheese', this.state.inventory.cheese);
        setTxt('qty-fish', this.state.inventory.fish);
        setTxt('qty-feed-inv', this.state.inventory.feed);

        if(this.state.currentMission) {
            const m = this.state.currentMission;
            const itemNames = { wheat: 'Trigos', carrot: 'Cenouras', apple: 'Maçãs', orange: 'Laranjas', corn: 'Milhos', egg: 'Ovos', milk: 'Leites', bacon: 'Bacons', fish: 'Peixes', bread: 'Pães', cheese: 'Queijos' };
            setTxt('mission-text', `Entregar ${m.qty} ${itemNames[m.type] || m.type}`);
            
            const btnMission = document.getElementById('btn-mission');
            if (btnMission) btnMission.disabled = this.state.inventory[m.type] < m.qty;
        }

        setTxt('mkt-money', this.state.money);
        setTxt('mkt-qty-wheat', this.state.inventory.wheat);
        setTxt('mkt-qty-carrot', this.state.inventory.carrot);
        setTxt('mkt-qty-apple', this.state.inventory.apple);
        setTxt('mkt-qty-orange', this.state.inventory.orange);
        setTxt('mkt-qty-corn', this.state.inventory.corn);
        setTxt('mkt-qty-egg', this.state.inventory.egg);
        setTxt('mkt-qty-milk', this.state.inventory.milk);
        setTxt('mkt-qty-bacon', this.state.inventory.bacon);
        setTxt('mkt-qty-fish', this.state.inventory.fish);
        setTxt('mkt-qty-bread', this.state.inventory.bread);
        setTxt('mkt-qty-cheese', this.state.inventory.cheese);
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));
        if (typeof TWEEN !== 'undefined' && time) TWEEN.update(time);
        this.animations.forEach(fn => fn()); 
        this.updateAnimals();
        this.updatePets();

        this.timeOfDay += 0.0005; 
        const sunHeight = Math.sin(this.timeOfDay);
        this.sun.position.y = sunHeight * 60;
        this.sun.position.x = Math.cos(this.timeOfDay) * 60;

        if (sunHeight > 0) {
            this.scene.background.lerp(new THREE.Color(0x87CEEB), 0.05); 
            this.scene.fog.color.lerp(new THREE.Color(0x87CEEB), 0.05);
            this.sun.intensity = sunHeight * 1.3;
            this.ambientLight.intensity = 0.55;
            this.houseLight.intensity = 0; 
        } else {
            this.scene.background.lerp(new THREE.Color(0x0B1D3A), 0.05); 
            this.scene.fog.color.lerp(new THREE.Color(0x0B1D3A), 0.05);
            this.sun.intensity = 0;
            this.ambientLight.intensity = 0.2; 
            this.houseLight.intensity = 2; 
        }

        const now = Date.now();

        // OBRAS (Tapumes pulando)
        for (let i = this.constructions.length - 1; i >= 0; i--) {
            const c = this.constructions[i];
            if (now - c.timer > c.duration) {
                this.finishConstruction(c);
                this.constructions.splice(i, 1);
            } else {
                c.mesh.rotation.y = Math.sin(now * 0.01) * 0.05;
            }
        }

        // FÁBRICAS (Fogo e Produto)
        this.factories.forEach(f => {
            if (f.state === 'baking') {
                if (now - f.timer > f.duration) {
                    f.state = 'ready';
                    if (f.type === 'bakery') {
                        f.holeMesh.material.color.setHex(0x111111); 
                        const breadMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1), new THREE.MeshStandardMaterial({color: 0xe67e22}));
                        breadMesh.position.set(0, 6, 0); breadMesh.name = "product_ready"; f.mesh.add(breadMesh);
                    } else if (f.type === 'dairy') {
                        const cheeseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16), new THREE.MeshStandardMaterial({color: 0xf1c40f}));
                        cheeseMesh.position.set(0, 6, 0); cheeseMesh.name = "product_ready"; f.mesh.add(cheeseMesh);
                    }
                } else {
                    if(f.type === 'bakery') f.holeMesh.material.color.setHex(now % 500 < 250 ? 0xff5500 : 0xffaa00);
                }
            } else if (f.state === 'idle') {
                const oldProd = f.mesh.getObjectByName("product_ready");
                if(oldProd) f.mesh.remove(oldProd);
            }
        });

        // CRESCIMENTO DAS PLANTAS
        this.plants.forEach(p => {
            if (p.progress < 1) {
                const conf = this.config[p.type];
                p.progress = (now - p.plantedAt) / conf.time;
                if (p.progress > 1) p.progress = 1;
                
                if (!conf.isTree) {
                    p.mesh.scale.set(1 + p.progress*2, 1 + p.progress*10, 1 + p.progress*2);
                    p.mesh.position.y = 0.4 + (p.mesh.scale.y * 0.05);
                } else {
                    const leaves = p.mesh.children[1];
                    leaves.scale.set(1 + p.progress*0.3, 1 + p.progress*0.3, 1 + p.progress*0.3);
                }

                if (p.progress === 1) {
                    if (conf.isTree) p.mesh.children[1].material.color.setHex(conf.readyColor); 
                    else p.mesh.material.color.setHex(conf.color); 
                }
            }
        });

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => { window.gameInstance = new NebulaFarmPro(); });
