window.onerror = function(message, source, lineno) { 
    console.error(`ERRO CRÍTICO BLOQUEADO: ${message} (Linha: ${lineno})`); 
    return false; 
};

const firebaseConfig = {
    apiKey: "AIzaSyCCnMspqNoKarOxZxXzaWACNxIV-mi3qNQ",
    authDomain: "nebulafarm-db.firebaseapp.com",
    projectId: "nebulafarm-db",
    storageBucket: "nebulafarm-db.firebasestorage.app",
    messagingSenderId: "642094890680",
    appId: "1:642094890680:web:33e78b20729f19be8cbe4d"
};

let db = null; let auth = null;
try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); auth = firebase.auth(); } catch (e) {}

class NebulaFarmPro {
    constructor() {
        this.scene = new THREE.Scene(); this.camera = null; this.renderer = null;
        this.grass = null; this.lake = null; this.tiles = []; this.plants = []; this.animations = [];
        this.animals = []; this.pets = []; this.npcs = []; this.factories = []; this.constructions = []; this.obstacles = []; this.decorations = []; this.enclosureFloors = []; 
        
        // VOLTOU O DRAG AND DROP ORIGINAL DE PC
        this.isDragging = false; this.activeDragTool = null; this.lastTreePlantTime = 0; 
        this.isPanning = false; this.panStart = { x: 0, y: 0 }; this.hasPanned = false; this.pendingBubble = null;   
        
        this.placementMode = false; this.placementType = null; this.placementCost = 0; this.placementGhost = null; this.placementGrid = null; this.placementIsValid = false;
        this.isFishing = false; this.timeOfDay = 1.5; this.currentUser = null; 
        this.weather = { isRaining: false, timer: 0 }; this.rainParticles = null;
        this.tractor = { active: false, mesh: null, isDriving: false, target: null };

        this.state = {
            money: 1000, xp: 0, lvl: 1, siloCount: 0, maxSilo: 50,
            inventory: { wheat: 10, carrot: 10, corn: 0, apple: 0, orange: 0, egg: 0, milk: 0, bacon: 0, feed: 5, fish: 0, bread: 0, cheese: 0, silage: 0, junk: 0, fertilizer: 0 },
            unlocked: { wheat: true, carrot: true, corn: false, apple: false, orange: false },
            enclosures: { coop: false, pigpen: false, corral: false, mill: false, bakery: false, dairy: false, trench: false, doghouse: false, recycler: false, tractor: false },
            gridSize: 6, currentMission: null, savedPlants: [], savedDecorations: [] 
        };

        this.config = {
            wheat: { color: 0xFFD700, time: 120000, yield: 2, sellPrice: 2, xp: 10 }, carrot: { color: 0xFF4500, time: 240000, yield: 2, sellPrice: 5, xp: 20 }, corn: { color: 0xFFEB3B, time: 600000, yield: 2, sellPrice: 12, xp: 50 },
            apple: { isTree: true, leafColor: 0x27ae60, readyColor: 0xe74c3c, time: 180000, yield: 3, sellPrice: 10, xp: 30 }, orange: { isTree: true, leafColor: 0x2ecc71, readyColor: 0xe67e22, time: 240000, yield: 3, sellPrice: 16, xp: 45 },
            egg: { sellPrice: 8, xp: 15 }, milk: { sellPrice: 15, xp: 30 }, bacon: { sellPrice: 20, xp: 40 }, fish: { sellPrice: 25, xp: 50 }, bread: { sellPrice: 35, xp: 60 }, cheese: { sellPrice: 45, xp: 80 }, silage: { sellPrice: 50, xp: 60 }, fertilizer: { sellPrice: 30, xp: 50 } 
        };
        this.animalConfig = { chicken: { product: 'egg', time: 60000 }, cow: { product: 'milk', time: 120000 }, pig: { product: 'bacon', time: 90000 } };
        
        this.init();
    }

    init() {
        if (!auth) { this.startGame(); return; }
        auth.onAuthStateChanged((user) => {
            const loader = document.getElementById('loader'); const loginModal = document.getElementById('login-modal');
            if (user) {
                this.currentUser = user; if (loginModal) loginModal.style.display = 'none';
                if (loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "BAIXANDO DADOS..."; }
                this.initCloud(); 
            } else { if (loader) loader.style.display = 'none'; if (loginModal) loginModal.style.display = 'flex'; }
        });
        const btnGoogle = document.getElementById('btn-google-login'); if (btnGoogle) btnGoogle.addEventListener('click', () => { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => console.error(e)); });
        const btnLogout = document.getElementById('btn-logout'); if (btnLogout) btnLogout.addEventListener('click', () => { auth.signOut().then(() => window.location.reload()); });
    }

    initCloud() {
        if (!db || !this.currentUser) return this.startGame();
        let hasStarted = false; const safetyTimeout = setTimeout(() => { if(!hasStarted) { hasStarted = true; this.startGame(); } }, 5000);
        db.collection("fazendas").doc(this.currentUser.uid).get().then((doc) => {
            if (hasStarted) return;
            if (doc.exists) {
                try {
                    const data = doc.data(); this.state = { ...this.state, ...data }; this.state.money = 1000;
                    if (!this.state.inventory) this.state.inventory = {};
                    const defaultInv = { wheat: 10, carrot: 10, corn: 0, apple: 0, orange: 0, egg: 0, milk: 0, bacon: 0, feed: 5, fish: 0, bread: 0, cheese: 0, silage: 0, junk: 0, fertilizer: 0 };
                    for(let key in defaultInv) { if(this.state.inventory[key] === undefined) this.state.inventory[key] = defaultInv[key]; }
                    if (!this.state.unlocked) this.state.unlocked = { wheat: true, carrot: true, corn: false, apple: false, orange: false };
                    if (!this.state.enclosures) this.state.enclosures = {};
                    if (!this.state.savedPlants) this.state.savedPlants = [];
                    if (!this.state.savedDecorations) this.state.savedDecorations = [];
                } catch (err) { }
            } else { this.saveToCloud(true); }
            hasStarted = true; clearTimeout(safetyTimeout); this.startGame();
        }).catch((e) => { if(!hasStarted) { hasStarted = true; clearTimeout(safetyTimeout); this.startGame(); } });
    }

    saveToCloud(isAutoSave = false) {
        if (!db || !this.currentUser) return;
        this.state.savedPlants = this.plants.map(p => ({ type: p.type, x: p.mesh.position.x, z: p.mesh.position.z, plantedAt: p.plantedAt }));
        this.state.savedDecorations = this.decorations.map(d => ({ type: d.type, x: d.mesh.position.x, z: d.mesh.position.z }));
        db.collection("fazendas").doc(this.currentUser.uid).set(this.state).then(() => { if (!isAutoSave) this.spawnFX(window.innerWidth / 2, 80, "💾 SALVO!", "#4CAF50"); }).catch(() => {});
    }

    startGame() {
        const loader = document.getElementById('loader'); if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 500); }
        try {
            const ui = document.getElementById('game-ui'); if (ui) ui.style.display = 'block';
            this.setupCore(); this.setupLights(); this.buildWorld(); this.createWeatherSystem(); this.setupInteractions();
            if (!this.state.currentMission) { this.generateMission(); }
            this.updateUI();
            setInterval(() => { this.saveToCloud(true); }, 30000);
            requestAnimationFrame((time) => this.animate(time));
        } catch (err) { console.error("Montagem bloqueou erro:", err); }
    }

    setupCore() {
        this.scene.background = new THREE.Color(0x87CEEB); this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.008); 
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-18 * aspect, 18 * aspect, 18, -18, 1, 1000);
        this.camera.position.set(50, 50, 50); this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight); this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
        this.renderer.shadowMap.enabled = true; document.body.appendChild(this.renderer.domElement);
    }

    setupLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4); this.scene.add(this.ambientLight);
        this.sun = new THREE.DirectionalLight(0xffffff, 1.0); this.sun.position.set(40, 60, 20); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.scene.add(this.sun);
        this.houseLight = new THREE.PointLight(0xffaa00, 0, 30); this.houseLight.position.set(22, 6, -10); this.scene.add(this.houseLight);
    }

    createWeatherSystem() {
        const rainGeo = new THREE.BufferGeometry(); const posArray = new Float32Array(1500 * 3);
        for(let i=0; i < 1500 * 3; i+=3) { posArray[i] = (Math.random() - 0.5) * 150; posArray[i+1] = Math.random() * 80; posArray[i+2] = (Math.random() - 0.5) * 150; }
        rainGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        this.rainParticles = new THREE.Points(rainGeo, new THREE.PointsMaterial({color: 0xaaaaaa, size: 0.3, transparent: true, opacity: 0.6}));
        this.scene.add(this.rainParticles); this.rainParticles.visible = false;
    }

    buildWorld() {
        this.grass = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x7cb342 }));
        this.grass.rotation.x = -Math.PI / 2; this.grass.receiveShadow = true; this.scene.add(this.grass);
        this.obstacles.push({ x: -22, z: -15, r: 8 }, { x: 22, z: -10, r: 8 }, { x: 35, z: 25, r: 14 }, { x: 0, z: 0, r: 12 }, { x: -22, z: 10, r: 6 });  
        
        this.createBarn(-22, -15); this.createFarmhouse(22, -10); this.createLake(35, 25); this.createWindmill(-22, 10); 
        const checkB = (s, id) => { if (s && s.built) { const b = document.getElementById(id); if (b) b.style.display = 'none'; return true; } return false; }

        if (checkB(this.state.enclosures.bakery, 'btn-bakery')) { this.createBakery(this.state.enclosures.bakery.x||5, this.state.enclosures.bakery.z||-25); this.obstacles.push({ x: this.state.enclosures.bakery.x||5, z: this.state.enclosures.bakery.z||-25, r: 5 }); }
        if (checkB(this.state.enclosures.dairy, 'btn-dairy')) { this.createDairy(this.state.enclosures.dairy.x||15, this.state.enclosures.dairy.z||-25); this.obstacles.push({ x: this.state.enclosures.dairy.x||15, z: this.state.enclosures.dairy.z||-25, r: 5 }); }
        if (checkB(this.state.enclosures.trench, 'btn-trench')) { this.createTrench(this.state.enclosures.trench.x||25, this.state.enclosures.trench.z||-25); this.obstacles.push({ x: this.state.enclosures.trench.x||25, z: this.state.enclosures.trench.z||-25, r: 5 }); }
        if (checkB(this.state.enclosures.recycler, 'btn-recycler')) { this.createRecycler(this.state.enclosures.recycler.x||-15, this.state.enclosures.recycler.z||-25); this.obstacles.push({ x: this.state.enclosures.recycler.x||-15, z: this.state.enclosures.recycler.z||-25, r: 4 }); }
        if (checkB(this.state.enclosures.doghouse, 'btn-doghouse')) { this.createDoghouse(this.state.enclosures.doghouse.x||20, this.state.enclosures.doghouse.z||-3); this.obstacles.push({ x: this.state.enclosures.doghouse.x||20, z: this.state.enclosures.doghouse.z||-3, r: 3 }); }
        if (checkB(this.state.enclosures.tractor, 'btn-tractor')) { this.createTractor(this.state.enclosures.tractor.x||-10, this.state.enclosures.tractor.z||-10); this.obstacles.push({ x: this.state.enclosures.tractor.x||-10, z: this.state.enclosures.tractor.z||-10, r: 4 }); }
        if (checkB(this.state.enclosures.coop, 'btn-coop')) { this.buildEnclosureOld('coop', this.state.enclosures.coop.x||10, this.state.enclosures.coop.z||-22); this.obstacles.push({ x: this.state.enclosures.coop.x||10, z: this.state.enclosures.coop.z||-22, r: 6 }); }
        if (checkB(this.state.enclosures.pigpen, 'btn-pigpen')) { this.buildEnclosureOld('pigpen', this.state.enclosures.pigpen.x||-5, this.state.enclosures.pigpen.z||20); this.obstacles.push({ x: this.state.enclosures.pigpen.x||-5, z: this.state.enclosures.pigpen.z||20, r: 6 }); }
        if (checkB(this.state.enclosures.corral, 'btn-corral')) { this.buildEnclosureOld('corral', this.state.enclosures.corral.x||25, this.state.enclosures.corral.z||5); this.obstacles.push({ x: this.state.enclosures.corral.x||25, z: this.state.enclosures.corral.z||5, r: 8 }); }

        this.renderGrid(); 
        
        if (this.state.savedPlants) { 
            this.state.savedPlants.forEach(sp => { 
                try { if (this.config[sp.type] && this.config[sp.type].isTree) { this.restoreTree(sp); } else { this.restoreCrop(sp); } } catch(e) {} 
            }); 
        }
        if (this.state.savedDecorations) { 
            this.state.savedDecorations.forEach(sd => { 
                try { this.placeDecoration(sd.type, sd.x, sd.z, false); } catch(e) {} 
            }); 
        }

        this.createNPC('Fazendeiro Zé', -10, 5, 0x2980b9, ["Belo dia para plantar!", "Cuidado com as vacas!"]);
        this.createNPC('Visitante Ana', 15, 10, 0x9b59b6, ["Vim comprar queijo!", "Que trator bonito!"]);
        this.createNPC('Pescador Tião', 24, 25, 0xf1c40f, ["A isca de milho é a melhor!", "O peixe não fisga hoje..."]);

        for (let i=0; i<45; i++) { this.createTree((Math.random()-0.5)*200, (Math.random()-0.5)*200); }
        this.createPet('dog', 15, -5); this.createPet('cat', 18, -12);
        for (let i=0; i<5; i++) { this.createBird(); }
    }

    buyBuilding(type, cost) {
        if (this.state.money < cost) { alert("Dinheiro Insuficiente!"); return; }
        if (type !== 'path' && type !== 'fence') { if (this.state.enclosures[type] && this.state.enclosures[type].built) { alert("Já possui esta construção!"); return; } }
        this.closeMarket(); this.enterPlacementMode(type, cost);
    }
    enterPlacementMode(type, cost) {
        this.placementMode = true; this.placementType = type; this.placementCost = cost; this.placementIsValid = false;
        document.getElementById('placement-ui').classList.remove('hidden');
        this.placementGrid = new THREE.GridHelper(200, 50, 0x000000, 0xffffff); this.placementGrid.position.y = 0.2; this.placementGrid.material.opacity = 0.2; this.placementGrid.material.transparent = true; this.scene.add(this.placementGrid);
        let ghostSize = (type === 'doghouse' || type === 'recycler' || type === 'tractor') ? 6 : (type === 'path' || type === 'fence' ? 4 : 8); 
        this.placementGhost = new THREE.Mesh(new THREE.BoxGeometry(ghostSize, 4, ghostSize), new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 }));
        this.placementGhost.position.set(this.camera.position.x - 50, 2, this.camera.position.z - 50); this.scene.add(this.placementGhost);
        this.validatePlacementPosition(this.placementGhost.position.x, this.placementGhost.position.z);
    }
    cancelPlacement() { this.placementMode = false; document.getElementById('placement-ui').classList.add('hidden'); if (this.placementGrid) this.scene.remove(this.placementGrid); if (this.placementGhost) this.scene.remove(this.placementGhost); }
    confirmPlacement() {
        if (!this.placementIsValid) return;
        this.state.money -= this.placementCost; const px = this.placementGhost.position.x; const pz = this.placementGhost.position.z;
        if (this.placementType === 'path' || this.placementType === 'fence') { this.placeDecoration(this.placementType, px, pz, true); } 
        else { this.state.enclosures[this.placementType] = { built: true, x: px, z: pz }; this.obstacles.push({ x: px, z: pz, r: (this.placementType === 'doghouse' || this.placementType === 'tractor' || this.placementType === 'recycler') ? 3 : 5 }); this.createConstructionSite(this.placementType, px, pz, 5000); }
        this.cancelPlacement(); this.updateUI(); this.saveToCloud();
    }
    validatePlacementPosition(x, z) {
        if (!this.placementGhost) return;
        const snapX = Math.round(x / 4) * 4; const snapZ = Math.round(z / 4) * 4; this.placementGhost.position.set(snapX, 2, snapZ);
        let hasCollision = false;
        if (this.placementType !== 'path' && this.placementType !== 'fence') { for (const obs of this.obstacles) { if (Math.sqrt(Math.pow(snapX - obs.x, 2) + Math.pow(snapZ - obs.z, 2)) < (4 + obs.r)) { hasCollision = true; break; } } }
        this.placementIsValid = !hasCollision; this.placementGhost.material.color.setHex(hasCollision ? 0xff0000 : 0x00ff00);
        document.getElementById('btn-confirm-place').disabled = hasCollision;
    }
    placeDecoration(type, x, z, save = false) {
        let mesh = null;
        if (type === 'path') { mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 4), new THREE.MeshStandardMaterial({color: 0x95a5a6})); mesh.position.set(x, 0.05, z); } 
        else if (type === 'fence') {
            mesh = new THREE.Group();
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3), new THREE.MeshStandardMaterial({color: 0x8B4513})); p1.position.set(-1.5, 1, 0);
            const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3), new THREE.MeshStandardMaterial({color: 0x8B4513})); p2.position.set(1.5, 1, 0);
            const cross = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 0.2), new THREE.MeshStandardMaterial({color: 0x8B4513})); cross.position.set(0, 1.2, 0);
            mesh.add(p1, p2, cross); mesh.position.set(x, 0, z);
        }
        if (mesh) { this.scene.add(mesh); this.decorations.push({ mesh, type, x, z }); if (save) this.saveToCloud(true); }
    }
    createConstructionSite(type, x, z, buildTimeMs) {
        const site = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4, 7.5), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
        box.position.y = 2; box.castShadow = true; site.add(box); site.position.set(x, 0, z); this.scene.add(site);
        this.spawnFX(x, 150, "CONSTRUINDO...", "#FFD700"); this.constructions.push({ mesh: site, type: type, x: x, z: z, timer: Date.now(), duration: buildTimeMs });
    }
    finishConstruction(construction) {
        this.scene.remove(construction.mesh); this.spawnFX(window.innerWidth/2, window.innerHeight/2, "OBRA PRONTA!", "#4CAF50");
        if (construction.type === 'bakery') this.createBakery(construction.x, construction.z); else if (construction.type === 'dairy') this.createDairy(construction.x, construction.z); else if (construction.type === 'trench') this.createTrench(construction.x, construction.z); else if (construction.type === 'recycler') this.createRecycler(construction.x, construction.z); else if (construction.type === 'doghouse') this.createDoghouse(construction.x, construction.z); else if (construction.type === 'tractor') this.createTractor(construction.x, construction.z); else if (construction.type === 'coop') this.buildEnclosureOld('coop', construction.x, construction.z); else if (construction.type === 'pigpen') this.buildEnclosureOld('pigpen', construction.x, construction.z); else if (construction.type === 'corral') this.buildEnclosureOld('corral', construction.x, construction.z);
        const btn = document.getElementById(`btn-${construction.type}`); if (btn) btn.style.display = 'none'; this.updateUI();
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
        const winMat = new THREE.MeshStandardMaterial({ color: 0x87CEEB, roughness: 0.1, metalness: 0.8 }); const winBorderMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 }); 
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
        house.add(walls, roof, door, janelaEsq, janelaDir, chimney); house.position.set(x, 0, z); house.rotation.y = -Math.PI / 6; this.scene.add(house);
    }

    createBarn(x, z) {
        if (typeof THREE.GLTFLoader === 'undefined') return;
        const loader = new THREE.GLTFLoader();
        loader.load('celeiro.glb', (gltf) => {
            const barn = gltf.scene; barn.position.set(x, 0, z); barn.scale.set(1, 1, 1); 
            const materialParedeVermelha = new THREE.MeshStandardMaterial({ color: 0xFF0000, roughness: 0.8 }); const materialTelhadoCinza = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 }); const materialMadeiraMarrom = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });    
            barn.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true; node.receiveShadow = true;
                    const nomeDaPeca = node.name.toLowerCase(); const nomeDoGrupo = node.parent ? node.parent.name.toLowerCase() : "";
                    if (nomeDaPeca.includes('triangle') || nomeDoGrupo.includes('triangle')) { node.material = materialTelhadoCinza; } else if (nomeDaPeca.includes('window') || nomeDoGrupo.includes('window') || nomeDaPeca.includes('door') || nomeDoGrupo.includes('door')) { node.material = materialMadeiraMarrom; } else { node.material = materialParedeVermelha; }
                }
            });
            this.scene.add(barn);
        }, undefined, () => {});
    }

    createRecycler(x, z) {
        const recGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({color: 0x2ecc71})); base.position.y = 1.5; base.castShadow = true;
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2, 1, 2), new THREE.MeshStandardMaterial({color: 0x7f8c8d})); funnel.position.y = 4; funnel.castShadow = true;
        recGroup.add(base, funnel); recGroup.position.set(x, 0, z);
        recGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: recGroup, type: 'recycler' }); this.scene.add(recGroup);
        this.factories.push({ mesh: recGroup, type: 'recycler', state: 'idle', timer: 0, duration: 10000 });
    }

    createTractor(x, z) {
        const tractorGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({color: 0xe74c3c, roughness: 0.5}); const tireMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.9});
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 4), bodyMat); body.position.y = 1.5; body.castShadow = true;
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.5), new THREE.MeshStandardMaterial({color: 0xffffff, transparent: true, opacity: 0.5})); cab.position.set(0, 3, -1);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 1.8), bodyMat); roof.position.set(0, 3.8, -1);
        const w1 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 16), tireMat); w1.rotation.z = Math.PI/2; w1.position.set(1.2, 1, -1);
        const w2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 16), tireMat); w2.rotation.z = Math.PI/2; w2.position.set(-1.2, 1, -1);
        const w3 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16), tireMat); w3.rotation.z = Math.PI/2; w3.position.set(1.2, 0.6, 1.5);
        const w4 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16), tireMat); w4.rotation.z = Math.PI/2; w4.position.set(-1.2, 0.6, 1.5);
        tractorGroup.add(body, cab, roof, w1, w2, w3, w4); tractorGroup.position.set(x, 0, z);
        tractorGroup.children.forEach(c => c.userData = { isTractor: true, parentRef: tractorGroup }); this.scene.add(tractorGroup); this.tractor.mesh = tractorGroup; this.tractor.active = true;
    }

    createTrench(x, z) {
        const trenchGroup = new THREE.Group();
        const wallMat = new THREE.MeshStandardMaterial({color: 0x95a5a6, roughness: 0.9});
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.5), wallMat); w1.position.set(0, 1, -2); w1.castShadow = true;
        const w2 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.5), wallMat); w2.position.set(0, 1, 2); w2.castShadow = true;
        const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 4), new THREE.MeshStandardMaterial({color: 0x4e342e})); floor.position.y = 0.25;
        trenchGroup.add(w1, w2, floor); trenchGroup.position.set(x, 0, z);
        trenchGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: trenchGroup, type: 'trench' }); this.scene.add(trenchGroup);
        this.factories.push({ mesh: trenchGroup, type: 'trench', state: 'idle', timer: 0, duration: 18000, indicator: floor });
    }

    createDoghouse(x, z) {
        const dhGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), new THREE.MeshStandardMaterial({color: 0x8B4513})); base.position.y = 1.25; base.castShadow = true;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2, 4), new THREE.MeshStandardMaterial({color: 0xb71c1c})); roof.position.y = 3.5; roof.rotation.y = Math.PI/4; roof.castShadow = true;
        dhGroup.add(base, roof); dhGroup.position.set(x, 0, z); this.scene.add(dhGroup);
        const dog = this.pets.find(p => p.type === 'dog'); if (dog) { dog.mesh.position.set(x, 0, z + 3); dog.target.set(x, 0, z + 3); }
    }

    createLake(x, z) {
        const lakeGroup = new THREE.Group();
        this.lake = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0x2980b9, transparent: true, opacity: 0.8 })); 
        this.lake.position.set(x, 0.1, z); this.lake.userData = { isLake: true }; this.scene.add(this.lake);
        for(let i=0; i<8; i++) { const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({color: 0x7f8c8d})); rock.position.set(x + Math.cos((i/8)*Math.PI*2)*12, 0.5, z + Math.sin((i/8)*Math.PI*2)*12); rock.castShadow = true; lakeGroup.add(rock); }
        const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 8), new THREE.MeshStandardMaterial({color: 0x8d6e63})); pier.position.set(x - 11, 0.3, z); lakeGroup.add(pier);
        this.scene.add(lakeGroup);
    }

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
        const base = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 5), new THREE.MeshStandardMaterial({ color: 0xecf0f1 })); base.position.y = 1.5; base.castShadow = true;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.5, 4), new THREE.MeshStandardMaterial({ color: 0x2980b9 })); roof.position.y = 4.25; roof.rotation.y = Math.PI/4; roof.castShadow = true;
        dairyGroup.add(base, roof); dairyGroup.position.set(x, 0, z); dairyGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: dairyGroup, type: 'dairy' }); this.scene.add(dairyGroup);
        this.factories.push({ mesh: dairyGroup, type: 'dairy', state: 'idle', timer: 0, duration: 20000 });
    }

    createBakery(x, z) {
        const bakeryGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: 0xc0392b })); base.position.y = 1.5; base.castShadow = true;
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc0392b })); roof.rotation.z = Math.PI / 2; roof.position.y = 3; roof.castShadow = true;
        bakeryGroup.add(base, roof); bakeryGroup.position.set(x, 0, z); bakeryGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: bakeryGroup, type: 'bakery' }); this.scene.add(bakeryGroup);
        this.factories.push({ mesh: bakeryGroup, type: 'bakery', state: 'idle', timer: 0, duration: 15000 });
    }

    buildEnclosureOld(type, x, z) {
        let w = 12, d = 12, color = 0x5d4037;
        if (type === 'coop') { color = 0x8d6e63; for(let i=0; i<3; i++) this.createAnimal('chicken', {x, z, w, d}); } 
        else if (type === 'pigpen') { for(let i=0; i<2; i++) this.createAnimal('pig', {x, z, w, d}); } 
        else if (type === 'corral') { w = 18; d = 16; color = 0xe0e0e0; for(let i=0; i<2; i++) this.createAnimal('cow', {x, z, w, d}); }
        const geoH = new THREE.BoxGeometry(w, 1, 0.5); const geoV = new THREE.BoxGeometry(0.5, 1, d);
        const f1 = new THREE.Mesh(geoH, new THREE.MeshStandardMaterial({color})); f1.position.set(x, 0.5, z - d/2);
        const f2 = new THREE.Mesh(geoH, new THREE.MeshStandardMaterial({color})); f2.position.set(x, 0.5, z + d/2);
        const f3 = new THREE.Mesh(geoV, new THREE.MeshStandardMaterial({color})); f3.position.set(x - w/2, 0.5, z);
        const f4 = new THREE.Mesh(geoV, new THREE.MeshStandardMaterial({color})); f4.position.set(x + w/2, 0.5, z);
        const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), new THREE.MeshStandardMaterial({color: 0x5d4037, transparent: true, opacity: 0.2}));
        floor.position.set(x, 0.05, z); floor.userData = { isEnclosureFloor: true }; this.scene.add(floor); this.enclosureFloors.push(floor);
        this.scene.add(f1, f2, f3, f4);
    }

    createNPC(name, x, z, color, phrases) {
        const npcGroup = new THREE.Group();
        const skinMat = new THREE.MeshStandardMaterial({color: 0xffccaa, roughness: 0.8});
        const shirtMat = new THREE.MeshStandardMaterial({color: color, roughness: 0.8});
        const pantsMat = new THREE.MeshStandardMaterial({color: 0x333333, roughness: 0.8});
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), skinMat); head.position.y = 3; head.castShadow = true; npcGroup.add(head);
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.6), shirtMat); body.position.y = 1.6; body.castShadow = true; npcGroup.add(body);
        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), skinMat); leftArm.position.set(-0.8, 1.6, 0); leftArm.castShadow = true; npcGroup.add(leftArm);
        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.4), skinMat); rightArm.position.set(0.8, 1.6, 0); rightArm.castShadow = true; npcGroup.add(rightArm);
        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), pantsMat); leftLeg.position.set(-0.3, 0.8, 0); leftLeg.castShadow = true; npcGroup.add(leftLeg);
        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), pantsMat); rightLeg.position.set(0.3, 0.8, 0); rightLeg.castShadow = true; npcGroup.add(rightLeg);
        if (name.includes("Zé") || name.includes("Tião")) {
             const hatBrim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 1.6), new THREE.MeshStandardMaterial({color: 0x8B4513})); hatBrim.position.y = 3.6; hatBrim.castShadow = true;
             const hatTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), new THREE.MeshStandardMaterial({color: 0x8B4513})); hatTop.position.y = 3.9; hatTop.castShadow = true;
             npcGroup.add(hatBrim, hatTop);
        }
        npcGroup.position.set(x, 0, z); npcGroup.scale.set(0.7, 0.7, 0.7); 
        npcGroup.children.forEach(c => { c.userData = { isNPC: true, parentRef: npcGroup }; }); this.scene.add(npcGroup);
        this.npcs.push({ mesh: npcGroup, name: name, speed: 0.05, target: new THREE.Vector3(x, 0, z), state: 'idle', timer: Math.random() * 200, phrases: phrases });
    }

    updateNPCs() {
        this.npcs.forEach(npc => {
            if (npc.state === 'idle') {
                npc.timer--;
                if (npc.timer <= 0) { 
                    npc.state = 'walking'; 
                    if (npc.name.includes("Pescador")) { npc.target.set(24 + (Math.random() - 0.5) * 2, 0, 25 + (Math.random() - 0.5) * 4); } 
                    else {
                        let safeTarget = false; let rx, rz;
                        while (!safeTarget) { rx = (Math.random() - 0.5) * 80; rz = (Math.random() - 0.5) * 80; if (Math.sqrt(Math.pow(rx - 35, 2) + Math.pow(rz - 25, 2)) > 16) { safeTarget = true; } }
                        npc.target.set(rx, 0, rz); 
                    }
                }
            } else if (npc.state === 'walking') {
                const dx = npc.target.x - npc.mesh.position.x; const dz = npc.target.z - npc.mesh.position.z; const dist = Math.sqrt(dx*dx + dz*dz);
                if (Math.sqrt(Math.pow(npc.mesh.position.x - 35, 2) + Math.pow(npc.mesh.position.z - 25, 2)) < 14 && !npc.name.includes("Pescador")) { npc.state = 'idle'; npc.timer = 10; } 
                else if (dist < 1) { npc.state = 'idle'; npc.timer = 100 + Math.random() * 300; } 
                else { npc.mesh.position.x += (dx / dist) * npc.speed; npc.mesh.position.z += (dz / dist) * npc.speed; npc.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.015)) * 0.3; npc.mesh.rotation.y = Math.atan2(dx, dz); }
            }
        });
    }

    createAnimal(type, bounds) {
        const animal = new THREE.Group(); let speed = 0;
        if (type === 'pig') { 
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.8), new THREE.MeshStandardMaterial({ color: 0xf8bbd0 })); body.position.y = 0.5;
            const snout = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.2), new THREE.MeshStandardMaterial({ color: 0xd81b60 })); snout.position.set(0, 0, 0.95); body.add(snout);
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 })); eye.position.set(0.3, 0.3, 0.9); body.add(eye);
            const eye2 = eye.clone(); eye2.position.set(-0.3, 0.3, 0.9); body.add(eye2);
            animal.add(body); speed = 0.03; 
        } else if (type === 'chicken') { 
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff })); body.position.y = 0.3;
            const beak = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xe67e22 })); beak.position.set(0, 0.1, 0.5); body.add(beak);
            const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xe74c3c })); crest.position.set(0, 0.4, 0.2); body.add(crest);
            animal.add(body); speed = 0.05; 
        } else if (type === 'cow') { 
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 2.5), new THREE.MeshStandardMaterial({ color: 0xffffff })); body.position.y = 1.0;
            const spot1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.21, 0.8), new THREE.MeshStandardMaterial({ color: 0x111111 })); spot1.position.set(0.3, 0, 0.5); body.add(spot1);
            const spot2 = new THREE.Mesh(new THREE.BoxGeometry(1.61, 0.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111 })); spot2.position.set(0, 0.2, -0.6); body.add(spot2);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff })); head.position.set(0, 0.5, 1.4);
            const snout = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.3), new THREE.MeshStandardMaterial({ color: 0xffb6c1 })); snout.position.set(0, -0.2, 0.5); head.add(snout);
            body.add(head); animal.add(body); speed = 0.02; 
        }
        const startX = bounds.x + (Math.random() - 0.5) * (bounds.w - 2); const startZ = bounds.z + (Math.random() - 0.5) * (bounds.d - 2);
        animal.position.set(startX, 0, startZ); animal.children.forEach(c => { c.userData = { isAnimal: true, parentRef: animal }; }); this.scene.add(animal);
        this.animals.push({ mesh: animal, bounds: bounds, type: type, speed: speed, target: new THREE.Vector3(startX, 0, startZ), state: 'hungry', timer: 0, product: this.animalConfig[type].product, produceTime: this.animalConfig[type].time, produceTimer: null });
    }

    updateAnimals() {
        const now = Date.now();
        this.animals.forEach(anim => {
            if (anim.state === 'hungry') { anim.mesh.scale.set(0.9, 0.8, 0.9); return; }
            if (anim.state === 'producing' || anim.state === 'idle' || anim.state === 'walking') {
                if (now - anim.produceTimer > anim.produceTime) { anim.state = 'ready'; if(typeof TWEEN !== 'undefined') new TWEEN.Tween(anim.mesh.scale).to({x: 1.4, y: 1.4, z: 1.4}, 500).easing(TWEEN.Easing.Elastic.Out).start(); else anim.mesh.scale.set(1.4, 1.4, 1.4); } 
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

    createPet(type, startX, startZ) {
        const pet = new THREE.Group(); let speed = 0.06;
        if (type === 'dog') { 
            const matBody = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); const matSnout = new THREE.MeshStandardMaterial({ color: 0x5D4037 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.6), matBody); body.position.y = 0.6;
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), matBody); head.position.set(0, 0.4, 1.0);
            const snout = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), matSnout); snout.position.set(0, 0, 0.55); head.add(snout);
            body.add(head);
            const legGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
            const l1 = new THREE.Mesh(legGeo, matBody); l1.position.set(0.4, -0.4, 0.6); const l2 = new THREE.Mesh(legGeo, matBody); l2.position.set(-0.4, -0.4, 0.6);
            const l3 = new THREE.Mesh(legGeo, matBody); l3.position.set(0.4, -0.4, -0.6); const l4 = new THREE.Mesh(legGeo, matBody); l4.position.set(-0.4, -0.4, -0.6);
            body.add(l1, l2, l3, l4); pet.add(body);
        } else if (type === 'cat') { 
            const matBody = new THREE.MeshStandardMaterial({ color: 0x95a5a6 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.2), matBody); body.position.y = 0.4;
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), matBody); head.position.set(0, 0.3, 0.7);
            const ear1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), matBody); ear1.position.set(0.2, 0.35, 0);
            const ear2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), matBody); ear2.position.set(-0.2, 0.35, 0);
            head.add(ear1, ear2); body.add(head);
            const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.8), matBody); tail.position.set(0, 0.2, -0.7); tail.rotation.x = Math.PI / 6; body.add(tail);
            pet.add(body); speed = 0.07; 
        }
        pet.position.set(startX, 0, startZ); pet.castShadow = true; this.scene.add(pet);
        this.pets.push({ mesh: pet, type: type, speed: speed, target: new THREE.Vector3(startX, 0, startZ), state: 'idle', timer: Math.random() * 100 });
    }

    updatePets() {
        this.pets.forEach(pet => {
            if (pet.state === 'idle') { 
                pet.timer--; 
                if (pet.timer <= 0) { 
                    pet.state = 'walking'; 
                    if (pet.type === 'dog' && this.state.enclosures.doghouse) { const dh = this.state.enclosures.doghouse; pet.target.set(dh.x + (Math.random()-0.5)*15, 0, dh.z + (Math.random()-0.5)*15); } 
                    else { pet.target.set((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60); }
                } 
            } else if (pet.state === 'walking') {
                const dx = pet.target.x - pet.mesh.position.x; const dz = pet.target.z - pet.mesh.position.z; const dist = Math.sqrt(dx*dx + dz*dz);
                if (dist < 0.5) { pet.state = 'idle'; pet.timer = 100 + Math.random() * 300; } 
                else { pet.mesh.position.x += (dx / dist) * pet.speed; pet.mesh.position.z += (dz / dist) * pet.speed; pet.mesh.rotation.y = Math.atan2(dx, dz); pet.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.01)) * 0.2; }
            }
        });
    }

    createBird() {
        const bird = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.6), new THREE.MeshStandardMaterial({color: 0x2980b9})); bird.add(body);
        const pivot = new THREE.Group(); pivot.position.set((Math.random()-0.5)*100, 15 + Math.random()*5, (Math.random()-0.5)*100);
        bird.position.set(10 + Math.random()*5, 0, 0); pivot.add(bird); this.scene.add(pivot);
        this.animations.push(() => { pivot.rotation.y += 0.02; bird.position.y = Math.sin(Date.now() * 0.005) * 2; });
    }

    createTree(x, z) {
        for(const obs of this.obstacles) { if (Math.sqrt(Math.pow(x - obs.x, 2) + Math.pow(z - obs.z, 2)) < obs.r + 3) return; }
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4, 0.8), new THREE.MeshStandardMaterial({color: 0x5d4037})); trunk.position.y = 2;
        const leaves = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshStandardMaterial({color: 0x388e3c})); leaves.position.y = 5;
        tree.add(trunk, leaves); tree.position.set(x, 0, z); this.scene.add(tree);
    }

    renderGrid() {
        this.tiles.forEach(t => this.scene.remove(t)); this.tiles = []; const dirtMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 }); const offset = (this.state.gridSize * 3.5) / 2 - 1.75; 
        for(let x=0; x<this.state.gridSize; x++) { 
            for(let z=0; z<this.state.gridSize; z++) { 
                const tile = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.5, 3.45), dirtMat); 
                tile.position.set(x * 3.5 - offset, 0.25, z * 3.5 - offset); 
                tile.receiveShadow = true; tile.userData = { isTile: true, occupied: false, tileRef: tile }; 
                this.scene.add(tile); this.tiles.push(tile); 
            } 
        }
    }

    plant(tile, seedType) {
        if (tile.userData.occupied || this.state.inventory[seedType] <= 0) return;
        this.state.inventory[seedType]--; tile.userData.occupied = true;
        const stalk = new THREE.Group();
        if (seedType === 'wheat') {
            const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), new THREE.MeshStandardMaterial({color: 0xf1c40f})); s1.position.set(-0.2, 0.4, 0);
            const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), new THREE.MeshStandardMaterial({color: 0xf1c40f})); s2.position.set(0.2, 0.5, 0); stalk.add(s1, s2);
        } else if (seedType === 'carrot') {
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshStandardMaterial({color: 0xe67e22})); base.position.y = 0.25;
            const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), new THREE.MeshStandardMaterial({color: 0x2ecc71})); top.position.y = 0.7; stalk.add(base, top);
        } else if (seedType === 'corn') {
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), new THREE.MeshStandardMaterial({color: 0x2ecc71})); base.position.y = 0.6;
            const cob = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshStandardMaterial({color: 0xf1c40f})); cob.position.set(0, 0.8, 0.1); stalk.add(base, cob);
        }
        stalk.position.set(tile.position.x, 0.4, tile.position.z); stalk.traverse(c => { if(c.isMesh) c.userData = { isPlant: true, parentRef: stalk }; }); this.scene.add(stalk);
        this.plants.push({ mesh: stalk, tile, type: seedType, plantedAt: Date.now(), progress: 0 }); this.updateUI(); this.saveToCloud(true);
    }

    restoreCrop(sp) {
        let targetTile = null; let minDist = Infinity;
        this.tiles.forEach(t => { if(!t.userData.occupied) { let dist = Math.sqrt(Math.pow(t.position.x - sp.x, 2) + Math.pow(t.position.z - sp.z, 2)); if (dist < minDist) { minDist = dist; targetTile = t; } } });
        if (targetTile) { 
            targetTile.userData.occupied = true; const stalk = new THREE.Group();
            if (sp.type === 'wheat') { const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), new THREE.MeshStandardMaterial({color: 0xf1c40f})); s1.position.set(-0.2, 0.4, 0); const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), new THREE.MeshStandardMaterial({color: 0xf1c40f})); s2.position.set(0.2, 0.5, 0); stalk.add(s1, s2); } 
            else if (sp.type === 'carrot') { const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshStandardMaterial({color: 0xe67e22})); base.position.y = 0.25; const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), new THREE.MeshStandardMaterial({color: 0x2ecc71})); top.position.y = 0.7; stalk.add(base, top); } 
            else { const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), new THREE.MeshStandardMaterial({color: 0x2ecc71})); base.position.y = 0.6; const cob = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshStandardMaterial({color: 0xf1c40f})); cob.position.set(0, 0.8, 0.1); stalk.add(base, cob); }
            stalk.position.set(targetTile.position.x, 0.4, targetTile.position.z); stalk.traverse(c => { if(c.isMesh) c.userData = { isPlant: true, parentRef: stalk }; }); this.scene.add(stalk);
            this.plants.push({ mesh: stalk, tile: targetTile, type: sp.type, plantedAt: sp.plantedAt, progress: 0 });
        }
    }

    plantTree(point, seedType) {
        let hasCollision = false;
        for (const obs of this.obstacles) { if (Math.sqrt(Math.pow(point.x - obs.x, 2) + Math.pow(point.z - obs.z, 2)) < (obs.r + 2)) { hasCollision = true; break; } }
        if (hasCollision) { this.spawnFX(window.innerWidth / 2, window.innerHeight / 2, "❌ LOCAL INVÁLIDO!", "#F44336"); return; }
        if (this.state.inventory[seedType] <= 0) return;
        this.state.inventory[seedType]--; const conf = this.config[seedType];
        const mesh = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 0.4), new THREE.MeshStandardMaterial({color: 0x5d4037})); trunk.position.y = 0.75;
        const leaves = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({color: conf.leafColor})); leaves.position.y = 2;
        mesh.add(trunk, leaves); mesh.position.set(point.x, 0, point.z); mesh.traverse(c => { if(c.isMesh) c.userData = { isPlant: true, parentRef: mesh }; }); this.scene.add(mesh);
        this.plants.push({ mesh: mesh, type: seedType, plantedAt: Date.now(), progress: 0 }); this.updateUI(); this.saveToCloud(true);
    }

    restoreTree(sp) {
        const conf = this.config[sp.type]; const mesh = new THREE.Group(); 
        const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 0.4), new THREE.MeshStandardMaterial({color: 0x5d4037})); trunk.position.y = 0.75;
        const leaves = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({color: conf.leafColor})); leaves.position.y = 2;
        mesh.add(trunk, leaves); mesh.position.set(sp.x, 0, sp.z); mesh.traverse(c => { if(c.isMesh) c.userData = { isPlant: true, parentRef: mesh }; }); this.scene.add(mesh);
        this.plants.push({ mesh: mesh, type: sp.type, plantedAt: sp.plantedAt, progress: 0 });
    }

    harvestPlant(mesh, x, y) {
        let targetMesh = mesh; if (mesh.parent && mesh.parent.type === "Group") targetMesh = mesh.parent;
        const idx = this.plants.findIndex(p => p.mesh === targetMesh); if (idx === -1) return;
        const p = this.plants[idx]; if (p.progress < 1) return;
        const conf = this.config[p.type]; 
        if (this.state.siloCount + conf.yield > this.state.maxSilo) { this.spawnFX(x, y, "SILO CHEIO!", "#F44336"); return; }
        
        this.state.inventory[p.type] += conf.yield; this.state.siloCount += conf.yield; this.state.xp += conf.xp;
        if (conf.isTree) { p.progress = 0; p.plantedAt = Date.now(); p.mesh.children[1].material.color.setHex(conf.leafColor); this.spawnFX(x, y, `+${conf.yield} ${p.type.toUpperCase()}`, "#FFF"); } 
        else { p.tile.userData.occupied = false; if(typeof TWEEN !== 'undefined') { new TWEEN.Tween(p.mesh.scale).to({x:0,y:0,z:0}, 200).onComplete(()=>this.scene.remove(p.mesh)).start(); } else { this.scene.remove(p.mesh); } this.plants.splice(idx, 1); this.spawnFX(x, y, `+${conf.yield} ${p.type.toUpperCase()}`, "#FFF"); }
        this.checkLevel(); this.updateUI(); this.saveToCloud(true);
    }

    // ==========================================
    // 8. O RADAR DE CLIQUES (SISTEMA DE ARRASTO NATIVO DE PC)
    // ==========================================
    setupInteractions() {
        const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
        
        // 1. CLIQUE INICIAL (ABRE O MENU)
        window.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.game-header') || e.target.closest('.side-panel') || e.target.closest('.modal-content') || e.target.closest('.bubble-item') || e.target.closest('.login-box')) return;
            
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; raycaster.setFromCamera(mouse, this.camera);
            
            if (this.tractor.isDriving) { const hitsGrass = raycaster.intersectObject(this.grass); if (hitsGrass.length > 0) { this.tractor.target = new THREE.Vector3(hitsGrass[0].point.x, 0, hitsGrass[0].point.z); this.spawnFX(e.clientX, e.clientY, "🎯", "#e74c3c"); } return; }
            if (this.placementMode) { const hitsGrass = raycaster.intersectObject(this.grass); if (hitsGrass.length > 0) this.validatePlacementPosition(hitsGrass[0].point.x, hitsGrass[0].point.z); return; }
            
            const bubble = document.getElementById('bubble-menu'); if (bubble && bubble.style.display === 'flex') { this.hideBubble(); }

            this.isPanning = true; this.panStart = { x: e.clientX, y: e.clientY }; this.hasPanned = false; this.pendingBubble = null;

            // PRIORIDADE MESTRE: A HORTA DEVE SER CHECADA ANTES DE TUDO!
            const hitsTiles = raycaster.intersectObjects(this.tiles);
            if (hitsTiles.length > 0) {
                const tile = hitsTiles[0].object;
                if (!tile.userData.occupied) { this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'plant_crop', hitObj: tile }; }
                return; // SE BATEU NA HORTA, O CLIQUE MORRE AQUI E A ÁRVORE NUNCA APARECE.
            }

            const hits = raycaster.intersectObjects(this.scene.children, true);
            if (hits.length > 0) {
                let targetHit = null;
                for (let hit of hits) {
                    if (hit.object === this.placementGhost || hit.object === this.placementGrid) continue;
                    targetHit = hit; break; 
                }
                if (!targetHit) return;

                const obj = targetHit.object; const ud = obj.userData || {};

                if (ud.isNPC) { const npc = this.npcs.find(n => n.mesh === ud.parentRef); if (npc) this.spawnFX(e.clientX, e.clientY - 30, `💬 "${npc.phrases[Math.floor(Math.random() * npc.phrases.length)]}"`, "#ffffff"); return; }
                if (ud.isTractor) { this.tractor.isDriving = true; document.getElementById('driving-alert').style.display = 'block'; this.isPanning = false; return; }
                if (ud.isFactory) { const fac = this.factories.find(f => f.mesh === ud.parentRef); if (fac) { this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: fac.state === 'idle' ? fac.type + '_idle' : fac.type + '_ready', hitObj: ud.parentRef }; } return; }
                if (ud.isPlant) { const plantObj = this.plants.find(p => p.mesh === ud.parentRef); if (plantObj && plantObj.progress >= 1) { this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'harvest_plant', hitObj: ud.parentRef }; } return; }
                if (ud.isAnimal) { this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'animal_actions', hitObj: ud.parentRef }; return; }
                if (ud.isLake) { this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'fish' }; return; }
                
                if (obj === this.grass) { this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'plant_tree', hitPoint: targetHit.point }; return; }
            }
        });

        // 2. ARRASTO DO MOUSE (DRAG AND DROP OU MOVER CAMERA)
        window.addEventListener('pointermove', (e) => {
            if (this.placementMode || this.tractor.isDriving) return; 
            
            // Se eu estiver arrastando a ferramenta, ignora a camera e prepara pra soltar.
            if (this.isDragging && this.activeDragTool) { 
                return;
            } else if (this.isPanning) {
                const moveX = e.clientX - this.panStart.x; const moveY = e.clientY - this.panStart.y;
                if (Math.abs(moveX) > 10 || Math.abs(moveY) > 10) { 
                    this.hasPanned = true; this.pendingBubble = null; const f = 0.08; 
                    let newX = this.camera.position.x - (moveX * f) - (moveY * f); let newZ = this.camera.position.z + (moveX * f) - (moveY * f);
                    this.camera.position.x = Math.max(-60, Math.min(100, newX)); this.camera.position.z = Math.max(-60, Math.min(100, newZ));
                    this.panStart = { x: e.clientX, y: e.clientY };
                }
            }
        });

        // 3. SOLTAR O CLIQUE (PLANTA)
        window.addEventListener('pointerup', (e) => { 
            if (this.placementMode) return; 
            this.isPanning = false; 
            
            if (this.isDragging && this.activeDragTool) { 
                mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; raycaster.setFromCamera(mouse, this.camera); 
                this.applyDragTool(raycaster, e.clientX, e.clientY);
                this.isDragging = false; 
                this.activeDragTool = null; 
                this.hideBubble(); 
            } else if (!this.hasPanned && this.pendingBubble) { 
                this.showBubble(this.pendingBubble.x, this.pendingBubble.y, this.pendingBubble.ctx, this.pendingBubble); 
            } 
        });

        window.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.tractor.isDriving) { this.tractor.isDriving = false; document.getElementById('driving-alert').style.display = 'none'; } });
    }

    showBubble(x, y, context, pendingData) {
        const bubble = document.getElementById('bubble-menu'); if (!bubble) return;
        bubble.style.left = x + 'px'; bubble.style.top = y + 'px'; bubble.style.display = 'flex'; bubble.innerHTML = '';

        if (context === 'plant_crop') {
            if(this.state.unlocked.wheat) bubble.innerHTML += this.createBubbleItem('wheat', '🌾', this.state.inventory.wheat);
            if(this.state.unlocked.carrot) bubble.innerHTML += this.createBubbleItem('carrot', '🥕', this.state.inventory.carrot);
            if(this.state.unlocked.corn) bubble.innerHTML += this.createBubbleItem('corn', '🌽', this.state.inventory.corn);
        } else if (context === 'plant_tree') {
            if(this.state.unlocked.apple) bubble.innerHTML += this.createBubbleItem('apple', '🌳', this.state.inventory.apple);
            if(this.state.unlocked.orange) bubble.innerHTML += this.createBubbleItem('orange', '🍊', this.state.inventory.orange);
        } else if (context === 'harvest_plant') { bubble.innerHTML += this.createBubbleItem('harvest', '✂️', 'CORTAR');
        } else if (context === 'animal_actions') { bubble.innerHTML += this.createBubbleItem('harvest', '✂️', 'CORTAR'); bubble.innerHTML += this.createBubbleItem('feed', '🥣', this.state.inventory.feed);
        } else if (context === 'fish') { bubble.innerHTML += this.createBubbleItem('fish', '🎣', '1🌽');
        } else if (context === 'bakery_idle') { const canBake = this.state.inventory.wheat >= 3 ? this.state.inventory.wheat : 0; bubble.innerHTML += this.createBubbleItem('bake_bread', '🌾', '-3🌾', canBake === 0);
        } else if (context === 'bakery_ready') { bubble.innerHTML += this.createBubbleItem('collect_bread', '🍞', 'PEGAR');
        } else if (context === 'dairy_idle') { const canMakeCheese = this.state.inventory.milk >= 2 ? this.state.inventory.milk : 0; bubble.innerHTML += this.createBubbleItem('make_cheese', '🥛', '-2🥛', canMakeCheese === 0);
        } else if (context === 'dairy_ready') { bubble.innerHTML += this.createBubbleItem('collect_cheese', '🧀', 'PEGAR');
        } else if (context === 'trench_idle') { const canMakeSilage = this.state.inventory.corn >= 2 ? this.state.inventory.corn : 0; bubble.innerHTML += this.createBubbleItem('make_silage', '🌽', '-2🌽', canMakeSilage === 0);
        } else if (context === 'trench_ready') { bubble.innerHTML += this.createBubbleItem('collect_silage', '🚜', 'PEGAR');
        } else if (context === 'recycler_idle') { const canRecycle = this.state.inventory.junk >= 2 ? this.state.inventory.junk : 0; bubble.innerHTML += this.createBubbleItem('recycle', '🥾', '-2 Lixo', canRecycle === 0);
        } else if (context === 'recycler_ready') { bubble.innerHTML += this.createBubbleItem('collect_fertilizer', '🧪', 'PEGAR'); }

        document.querySelectorAll('.bubble-item').forEach(item => {
            if (!item.classList.contains('locked')) {
                // AQUI É A CHAVE DO DRAG AND DROP DO PC
                item.addEventListener('pointerdown', (e) => { 
                    e.preventDefault(); e.stopPropagation();
                    this.activeDragTool = e.currentTarget.dataset.tool; 
                    this.isDragging = true; 
                });
            }
        });
    }

    createBubbleItem(tool, icon, textOverride, forceLock = false) { const lockedClass = forceLock || (typeof textOverride === 'number' && textOverride <= 0) ? 'locked' : ''; return `<div class="bubble-item ${lockedClass}" data-tool="${tool}">${icon}<small>${textOverride}</small></div>`; }
    hideBubble() { const b = document.getElementById('bubble-menu'); if (b) b.style.display = 'none'; }

    applyDragTool(raycaster, x, y) {
        if (['bake_bread', 'make_cheese', 'make_silage', 'recycle'].includes(this.activeDragTool)) {
            const factoryMeshes = []; this.factories.forEach(f => factoryMeshes.push(...f.mesh.children));
            const hitsF = raycaster.intersectObjects(factoryMeshes);
            if (hitsF.length > 0) {
                const fac = this.factories.find(f => f.mesh === hitsF[0].object.userData.parentRef);
                if (fac && fac.state === 'idle') {
                    if (this.activeDragTool === 'bake_bread' && this.state.inventory.wheat >= 3 && fac.type === 'bakery') { this.state.inventory.wheat -= 3; fac.state = 'baking'; fac.timer = Date.now(); this.spawnFX(x, y, "ASSANDO...", "#e67e22"); } 
                    else if (this.activeDragTool === 'make_cheese' && this.state.inventory.milk >= 2 && fac.type === 'dairy') { this.state.inventory.milk -= 2; fac.state = 'baking'; fac.timer = Date.now(); this.spawnFX(x, y, "PRODUZINDO...", "#f1c40f"); } 
                    else if (this.activeDragTool === 'make_silage' && this.state.inventory.corn >= 2 && fac.type === 'trench') { this.state.inventory.corn -= 2; fac.state = 'baking'; fac.timer = Date.now(); this.spawnFX(x, y, "FERMENTANDO...", "#689f38"); } 
                    else if (this.activeDragTool === 'recycle' && this.state.inventory.junk >= 2 && fac.type === 'recycler') { this.state.inventory.junk -= 2; fac.state = 'baking'; fac.timer = Date.now(); this.spawnFX(x, y, "RECICLANDO...", "#2ecc71"); }
                    this.updateUI();
                }
            } return;
        }

        if (['collect_bread', 'collect_cheese', 'collect_silage', 'collect_fertilizer'].includes(this.activeDragTool)) {
            const factoryMeshes = []; this.factories.forEach(f => factoryMeshes.push(...f.mesh.children));
            const hitsF = raycaster.intersectObjects(factoryMeshes);
            if (hitsF.length > 0) {
                const fac = this.factories.find(f => f.mesh === hitsF[0].object.userData.parentRef);
                if (fac && fac.state === 'ready') {
                    if (this.state.siloCount + 1 > this.state.maxSilo) { this.spawnFX(x, y, "SILO CHEIO!", "#F44336"); return; }
                    if (fac.type === 'bakery') { this.state.inventory.bread++; this.state.xp += this.config.bread.xp; this.spawnFX(x, y, "+1 🍞", "#e67e22"); }
                    if (fac.type === 'dairy') { this.state.inventory.cheese++; this.state.xp += this.config.cheese.xp; this.spawnFX(x, y, "+1 🧀", "#f1c40f"); }
                    if (fac.type === 'trench') { this.state.inventory.silage++; this.state.xp += this.config.silage.xp; this.spawnFX(x, y, "+1 🚜", "#689f38"); }
                    if (fac.type === 'recycler') { this.state.inventory.fertilizer++; this.state.xp += this.config.fertilizer.xp; this.spawnFX(x, y, "+1 🧪", "#2ecc71"); }
                    this.state.siloCount++; fac.state = 'idle'; this.checkLevel(); this.updateUI(); this.saveToCloud(true);
                }
            } return;
        }

        if (this.activeDragTool === 'harvest') {
            const plantMeshes = this.plants.filter(p => p.progress >= 1).flatMap(p => p.mesh.type === 'Group' ? p.mesh.children : [p.mesh]);
            const hitsP = raycaster.intersectObjects(plantMeshes); if (hitsP.length > 0) { this.harvestPlant(hitsP[0].object, x, y); return; }
            const animalMeshes = []; this.animals.forEach(a => animalMeshes.push(...a.mesh.children));
            const hitsA = raycaster.intersectObjects(animalMeshes); if (hitsA.length > 0) { this.harvestAnimal(hitsA[0].object.userData.parentRef, x, y); return; }
        } else if (this.activeDragTool === 'feed') {
            const animalMeshes = []; this.animals.forEach(a => animalMeshes.push(...a.mesh.children));
            const hitsA = raycaster.intersectObjects(animalMeshes); if (hitsA.length > 0) { this.feedAnimal(hitsA[0].object.userData.parentRef, x, y); return; }
        } else if (this.activeDragTool === 'fish') {
             const hitsLake = raycaster.intersectObject(this.lake); if(hitsLake.length > 0) { this.startFishing(x, y); }
        } else {
            const seedType = this.activeDragTool;
            if (this.config[seedType].isTree) { 
                const hitsGrass = raycaster.intersectObject(this.grass); 
                const hitsTiles = raycaster.intersectObjects(this.tiles);
                // Trava: Só planta árvore na grama se o raio NÃO bater numa horta
                if (hitsGrass.length > 0 && hitsTiles.length === 0 && Date.now() - this.lastTreePlantTime > 400) { this.plantTree(hitsGrass[0].point, seedType); this.lastTreePlantTime = Date.now(); }
            } else { 
                const hitsTiles = raycaster.intersectObjects(this.tiles); 
                if (hitsTiles.length > 0) { this.plant(hitsTiles[0].object, seedType); } 
            }
        }
    }

    feedAnimal(animalGroup, x, y) {
        const anim = this.animals.find(a => a.mesh === animalGroup);
        if (!anim || anim.state !== 'hungry' || this.state.inventory.feed <= 0) return;
        this.state.inventory.feed--; anim.state = 'producing'; anim.produceTimer = Date.now(); anim.timer = 0;
        if (typeof TWEEN !== 'undefined') { new TWEEN.Tween(anim.mesh.scale).to({x: 1, y: 1, z: 1}, 300).easing(TWEEN.Easing.Bounce.Out).start(); }
        this.spawnFX(x, y, "❤️", "#F44336"); this.updateUI(); this.saveToCloud(true);
    }

    harvestAnimal(animalGroup, x, y) {
        const anim = this.animals.find(a => a.mesh === animalGroup);
        if (!anim || anim.state !== 'ready' || this.state.siloCount + 1 > this.state.maxSilo) return;
        const prodConf = this.config[anim.product]; this.state.inventory[anim.product]++; this.state.siloCount++; this.state.xp += prodConf.xp;
        anim.state = 'hungry'; anim.mesh.position.y = 0; 
        if (typeof TWEEN !== 'undefined') { new TWEEN.Tween(anim.mesh.scale).to({x: 0.9, y: 0.8, z: 0.9}, 300).start(); }
        let icon = anim.product === 'egg' ? '🥚' : (anim.product === 'milk' ? '🥛' : '🥓');
        this.spawnFX(x, y, `+1 ${icon}`, "#FFD700"); this.checkLevel(); this.updateUI();
    }

    startFishing(x, y) {
        if (this.isFishing) return; 
        if (this.state.inventory.corn <= 0) { this.spawnFX(x, y, "PRECISA DE 1 MILHO", "#F44336"); return; }
        if (this.state.siloCount >= this.state.maxSilo) { this.spawnFX(x, y, "SILO CHEIO!", "#F44336"); return; }
        this.state.inventory.corn--; this.isFishing = true; this.spawnFX(x, y, "PESCANDO...", "#3498db"); this.updateUI();
        setTimeout(() => {
            this.isFishing = false; const chance = Math.random();
            if (chance > 0.4) { this.state.inventory.fish++; this.state.siloCount++; this.state.xp += this.config.fish.xp; this.spawnFX(x, y - 50, "🎣 PEGOU UM PEIXE!", "#4CAF50"); this.checkLevel(); } 
            else { this.state.inventory.junk++; this.spawnFX(x, y - 50, "🥾 BOTA VELHA (+1 Lixo)", "#9e9e9e"); } 
            this.updateUI(); this.saveToCloud(true);
        }, 3000);
    }

    generateMission() {
        const types = ['wheat', 'carrot', 'egg', 'apple']; 
        if(this.state.unlocked.corn) types.push('corn'); if(this.state.unlocked.orange) types.push('orange'); if(this.state.enclosures.pigpen) types.push('bacon'); if(this.state.enclosures.corral) types.push('milk'); if(this.state.inventory.fish > 0) types.push('fish'); if(this.state.enclosures.bakery) types.push('bread'); if(this.state.enclosures.dairy) types.push('cheese'); if(this.state.enclosures.trench) types.push('silage'); 
        const type = types[Math.floor(Math.random() * types.length)];
        const qty = (type === 'bread' || type === 'cheese' || type === 'silage') ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 4) + 2; 
        const basePrice = this.config[type] ? this.config[type].sellPrice : 0;
        this.state.currentMission = { type, qty, reward: (basePrice * qty) * 2 }; this.updateUI();
    }

    openMissionModal() { const modal = document.getElementById('mission-modal'); if (modal) modal.classList.remove('modal-hidden'); }
    closeMissionModal() { const modal = document.getElementById('mission-modal'); if (modal) modal.classList.add('modal-hidden'); }
    completeMission() {
        const m = this.state.currentMission;
        if (this.state.inventory[m.type] >= m.qty) {
            this.state.inventory[m.type] -= m.qty; this.state.siloCount -= m.qty; this.state.money += m.reward; this.state.xp += 150; 
            this.spawnFX(window.innerWidth/2, 100, `ENTREGA FEITA! +$${m.reward}`, "#FFD700");
            this.checkLevel(); this.generateMission(); this.closeMissionModal(); this.updateUI(); this.saveToCloud(true);
        } else { alert("Você não tem os itens necessários!"); }
    }

    checkLevel() {
        if (this.state.xp >= this.state.lvl * 300) {
            this.state.lvl++; this.state.xp = 0; this.state.inventory.wheat += 5; this.state.inventory.carrot += 5;
            this.spawnFX(window.innerWidth/2, window.innerHeight/2 - 50, `LEVEL ${this.state.lvl}!`, "#4CAF50");
            if (this.state.lvl === 2 && !this.state.unlocked.corn) { this.state.unlocked.corn = true; this.state.inventory.corn += 5; setTimeout(() => this.spawnFX(window.innerWidth/2, window.innerHeight/2 + 20, "MILHO LIBERADO!", "#FFD700"), 1000); }
            if (this.state.lvl === 3 && !this.state.unlocked.apple) { this.state.unlocked.apple = true; this.state.inventory.apple += 2; setTimeout(() => this.spawnFX(window.innerWidth/2, window.innerHeight/2 + 20, "MACIEIRA!", "#e74c3c"), 1000); }
            if (this.state.lvl === 4 && !this.state.unlocked.orange) { this.state.unlocked.orange = true; this.state.inventory.orange += 2; setTimeout(() => this.spawnFX(window.innerWidth/2, window.innerHeight/2 + 20, "LARANJEIRA!", "#e67e22"), 1000); }
            this.updateUI();
        }
    }

    openMarket() { document.getElementById('market-modal').classList.remove('modal-hidden'); this.updateUI(); }
    closeMarket() { document.getElementById('market-modal').classList.add('modal-hidden'); }
    
    craftFeed() {
        if (this.state.inventory.wheat >= 3 && this.state.inventory.corn >= 1) { 
            this.state.inventory.wheat -= 3; this.state.inventory.corn -= 1; this.state.inventory.feed++; 
            this.spawnFX(window.innerWidth/2, 200, "🥣 RAÇÃO PRONTA!", "#FFD700"); this.updateUI(); this.saveToCloud(true);
        } else { alert("Faltam ingredientes! (3x Trigo, 1x Milho)"); }
    }

    buyFeed(amount, cost) {
        if (this.state.money >= cost) { 
            this.state.money -= cost; this.state.inventory.feed += amount; 
            this.spawnFX(window.innerWidth/2, 200, `+${amount} 🥣 RAÇÃO`, "#4CAF50"); this.updateUI(); this.saveToCloud(true); 
        } else { alert("Dinheiro Insuficiente!"); }
    }

    buyUpgrade(type, cost) { if (this.state.money >= cost) { this.state.money -= cost; if (type === 'silo') { this.state.maxSilo += 25; alert("Silo Ampliado!"); } else if (type === 'land') { this.state.gridSize += 1; this.renderGrid(); alert("Lote expandido!"); } this.updateUI(); } else { alert("Dinheiro Insuficiente!"); } }
    buySeed(type, amount, cost) { if (this.state.money >= cost) { if (!this.state.unlocked[type]) { alert("Suba de nível primeiro!"); return; } this.state.money -= cost; this.state.inventory[type] += amount; this.spawnFX(window.innerWidth/2, 200, `+${amount} ${type.toUpperCase()}`, "#4CAF50"); this.updateUI(); this.saveToCloud(true); } else { alert("Dinheiro Insuficiente!"); } }
    sellItem(type) { if (this.state.inventory[type] > 0) { this.state.inventory[type]--; this.state.siloCount--; this.state.money += this.config[type].sellPrice; this.spawnFX(window.innerWidth/2, 200, `+ $${this.config[type].sellPrice}`, "#FFD700"); this.updateUI(); this.saveToCloud(true); } else { alert(`Estoque vazio!`); } }
    spawnFX(x, y, text, color) { const el = document.createElement('div'); el.className = 'floating-feedback'; el.innerText = text; el.style.color = color; el.style.left = x + 'px'; el.style.top = y + 'px'; document.body.appendChild(el); setTimeout(() => el.remove(), 1000); }

    updateUI() {
        const setTxt = (id, text) => { try { const el = document.getElementById(id); if (el) el.innerText = text; } catch(e) {} };
        setTxt('money', this.state.money); setTxt('silo-text', `${this.state.siloCount}/${this.state.maxSilo}`); setTxt('lvl', this.state.lvl);
        try { const xpBar = document.getElementById('xp-bar'); if (xpBar) xpBar.style.width = (this.state.xp / (this.state.lvl * 300)) * 100 + "%"; } catch(e){}

        const alertBtn = document.getElementById('mission-alert');
        if (this.state.currentMission) {
            if (alertBtn) alertBtn.classList.remove('hidden');
            const m = this.state.currentMission; const itemNames = { wheat: 'Trigos', carrot: 'Cenouras', apple: 'Maçãs', orange: 'Laranjas', corn: 'Milhos', egg: 'Ovos', milk: 'Leites', bacon: 'Bacons', fish: 'Peixes', bread: 'Pães', cheese: 'Queijos', silage: 'Silagens' };
            setTxt('mission-text', `Entregar ${m.qty} ${itemNames[m.type] || m.type}`); setTxt('mission-reward-val', m.reward);
            try { const btnMission = document.getElementById('btn-mission'); if (btnMission) btnMission.disabled = this.state.inventory[m.type] < m.qty; } catch(e){}
        } else { if (alertBtn) alertBtn.classList.add('hidden'); }

        setTxt('mkt-qty-wheat', this.state.inventory.wheat); setTxt('mkt-qty-carrot', this.state.inventory.carrot); setTxt('mkt-qty-apple', this.state.inventory.apple); setTxt('mkt-qty-orange', this.state.inventory.orange); setTxt('mkt-qty-corn', this.state.inventory.corn); setTxt('mkt-qty-egg', this.state.inventory.egg); setTxt('mkt-qty-milk', this.state.inventory.milk); setTxt('mkt-qty-bacon', this.state.inventory.bacon); setTxt('mkt-qty-fish', this.state.inventory.fish); setTxt('mkt-qty-bread', this.state.inventory.bread); setTxt('mkt-qty-cheese', this.state.inventory.cheese); setTxt('mkt-qty-silage', this.state.inventory.silage || 0); setTxt('mkt-qty-fertilizer', this.state.inventory.fertilizer || 0); setTxt('mkt-qty-feed', this.state.inventory.feed); setTxt('mkt-money', this.state.money); 
    }

    animate(time) {
        try {
            requestAnimationFrame((t) => this.animate(t));
            if (typeof TWEEN !== 'undefined' && time) TWEEN.update(time);
            this.animations.forEach(fn => fn()); 
            this.updateAnimals(); this.updatePets(); this.updateNPCs(); 
            const now = Date.now();

            if (now - this.weather.timer > 60000) { 
                this.weather.timer = now; this.weather.isRaining = Math.random() > 0.7; 
                const ind = document.getElementById('weather-indicator');
                if (this.weather.isRaining) { this.rainParticles.visible = true; if(ind) { ind.className = 'weather-rain'; ind.innerText = '🌧️ CHOVENDO (+ Crescimento)'; } } 
                else { this.rainParticles.visible = false; if(ind) { ind.className = 'weather-clear'; ind.innerText = '☀️ ENSOLARADO'; } }
            }
            if (this.weather.isRaining && this.rainParticles) {
                const positions = this.rainParticles.geometry.attributes.position.array;
                for(let i=1; i < positions.length; i+=3) { positions[i] -= 1.5; if(positions[i] < 0) positions[i] = 80; }
                this.rainParticles.geometry.attributes.position.needsUpdate = true;
            }

            if (!this.weather.isRaining) this.timeOfDay += 0.0005; 
            const sunHeight = this.weather.isRaining ? 0.2 : Math.sin(this.timeOfDay);
            this.sun.position.y = sunHeight * 60; this.sun.position.x = Math.cos(this.timeOfDay) * 60;

            if (sunHeight > 0 && !this.weather.isRaining) {
                this.scene.background.lerp(new THREE.Color(0x87CEEB), 0.05); this.scene.fog.color.lerp(new THREE.Color(0x87CEEB), 0.05);
                this.sun.intensity = sunHeight * 1.0; this.ambientLight.intensity = 0.4; this.houseLight.intensity = 0; 
            } else {
                const darkColor = this.weather.isRaining ? 0x5a6e7f : 0x0B1D3A; 
                this.scene.background.lerp(new THREE.Color(darkColor), 0.05); this.scene.fog.color.lerp(new THREE.Color(darkColor), 0.05);
                this.sun.intensity = 0; this.ambientLight.intensity = 0.3; this.houseLight.intensity = 2; 
            }

            if (this.tractor.isDriving && this.tractor.mesh && this.tractor.target) {
                this.camera.position.x += (this.tractor.mesh.position.x + 50 - this.camera.position.x) * 0.05;
                this.camera.position.z += (this.tractor.mesh.position.z + 50 - this.camera.position.z) * 0.05;
                const dx = this.tractor.target.x - this.tractor.mesh.position.x; const dz = this.tractor.target.z - this.tractor.mesh.position.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                if (dist > 1) {
                    this.tractor.mesh.position.x += (dx / dist) * 0.3; this.tractor.mesh.position.z += (dz / dist) * 0.3; this.tractor.mesh.rotation.y = Math.atan2(dx, dz);
                    for (let i = this.plants.length - 1; i >= 0; i--) {
                        const p = this.plants[i];
                        if (p.progress >= 1 && !this.config[p.type].isTree) {
                            const pDist = Math.sqrt(Math.pow(p.mesh.position.x - this.tractor.mesh.position.x, 2) + Math.pow(p.mesh.position.z - this.tractor.mesh.position.z, 2));
                            if (pDist < 3) {
                                if (this.state.siloCount + this.config[p.type].yield <= this.state.maxSilo) {
                                    this.state.inventory[p.type] += this.config[p.type].yield; this.state.siloCount += this.config[p.type].yield; this.state.xp += this.config[p.type].xp;
                                    p.tile.userData.occupied = false; this.scene.remove(p.mesh); this.plants.splice(i, 1);
                                    this.spawnFX(window.innerWidth/2, window.innerHeight/2, "🚜 COLHEITA!", "#FFD700"); this.updateUI(); this.checkLevel();
                                }
                            }
                        }
                    }
                }
            }

            for (let i = this.constructions.length - 1; i >= 0; i--) {
                const c = this.constructions[i];
                if (now - c.timer > c.duration) { this.finishConstruction(c); this.constructions.splice(i, 1); } else { c.mesh.rotation.y = Math.sin(now * 0.01) * 0.05; }
            }

            this.factories.forEach(f => {
                try {
                    if (f.state === 'baking') {
                        if (now - f.timer > f.duration) {
                            f.state = 'ready';
                            if (f.type === 'bakery') { const breadMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1), new THREE.MeshStandardMaterial({color: 0xe67e22})); breadMesh.position.set(0, 6, 0); breadMesh.name = "product_ready"; f.mesh.add(breadMesh); } 
                            else if (f.type === 'dairy') { const cheeseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 16), new THREE.MeshStandardMaterial({color: 0xf1c40f})); cheeseMesh.position.set(0, 6, 0); cheeseMesh.name = "product_ready"; f.mesh.add(cheeseMesh); } 
                            else if (f.type === 'trench') { const silageMesh = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 3), new THREE.MeshStandardMaterial({color: 0x689f38})); silageMesh.position.set(0, 0.8, 0); silageMesh.name = "product_ready"; f.mesh.add(silageMesh); } 
                            else if (f.type === 'recycler') { const fertMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8), new THREE.MeshStandardMaterial({color: 0x2ecc71})); fertMesh.position.set(0, 6, 0); fertMesh.name = "product_ready"; f.mesh.add(fertMesh); }
                        }
                    } else if (f.state === 'idle') { const oldProd = f.mesh.getObjectByName("product_ready"); if (oldProd) f.mesh.remove(oldProd); }
                } catch(e) {}
            });

            const growthMult = this.weather.isRaining ? 3 : 1;
            this.plants.forEach(p => {
                try {
                    if (p.progress < 1) {
                        const conf = this.config[p.type]; p.progress += (growthMult * 16) / conf.time; if (p.progress > 1) p.progress = 1;
                        if (!conf.isTree) { 
                            let s = 0.3 + (p.progress * 0.7); if (s > 1) s = 1;
                            p.mesh.scale.set(s, s, s); p.mesh.position.y = 0.2 + (s * 0.2); 
                        } 
                        else { const leaves = p.mesh.children[1]; leaves.scale.set(1 + p.progress*0.3, 1 + p.progress*0.3, 1 + p.progress*0.3); }
                        if (p.progress === 1) { if (conf.isTree) p.mesh.children[1].material.color.setHex(conf.readyColor); }
                    }
                } catch(e) {}
            });

            this.renderer.render(this.scene, this.camera);
        } catch (e) {
            // ENGOLIDOR DE ERROS: A TELA PRETA NÃO PODE PASSAR DAQUI!
        }
    }
}

window.addEventListener('resize', () => {
    if (window.gameInstance && window.gameInstance.camera) {
        const aspect = window.innerWidth / window.innerHeight;
        window.gameInstance.camera.left = -18 * aspect; window.gameInstance.camera.right = 18 * aspect;
        window.gameInstance.camera.top = 18; window.gameInstance.camera.bottom = -18;
        window.gameInstance.camera.updateProjectionMatrix(); window.gameInstance.renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

window.addEventListener('DOMContentLoaded', () => { window.gameInstance = new NebulaFarmPro(); });
