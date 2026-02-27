/**
 * NEBULA FARM PRO - A VERSÃO DEFINITIVA
 * Todas as construções, colisões, silagem, pets e salvamentos funcionando!
 */

window.onerror = function(message, source, lineno) {
    console.error(`ERRO: ${message} (Linha: ${lineno})`);
    return false;
};

// CONEXÃO COM O FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyCCnMspqNoKarOxZxXzaWACNxIV-mi3qNQ",
    authDomain: "nebulafarm-db.firebaseapp.com",
    projectId: "nebulafarm-db",
    storageBucket: "nebulafarm-db.firebasestorage.app",
    messagingSenderId: "642094890680",
    appId: "1:642094890680:web:33e78b20729f19be8cbe4d"
};

let db = null; let auth = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore(); auth = firebase.auth();
} catch (e) { console.error("Firebase não carregou:", e); }

class NebulaFarmPro {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = null; this.renderer = null;
        this.grass = null; this.lake = null; 
        this.tiles = []; this.plants = []; this.animations = [];
        this.animals = []; this.pets = []; this.factories = []; 
        this.constructions = []; this.obstacles = [];     
        
        this.isDragging = false; this.activeDragTool = null; 
        this.isPanning = false; this.panStart = { x: 0, y: 0 };
        this.hasPanned = false; this.pendingBubble = null;   
        
        this.placementMode = false; this.placementType = null;
        this.placementCost = 0; this.placementGhost = null;
        this.placementGrid = null; this.placementIsValid = false;

        this.isFishing = false; this.timeOfDay = 1.5; 
        this.currentUser = null; 

        this.state = {
            money: 1000, xp: 0, lvl: 1, siloCount: 0, maxSilo: 50,
            inventory: { wheat: 10, carrot: 10, corn: 0, apple: 0, orange: 0, egg: 0, milk: 0, bacon: 0, feed: 5, fish: 0, bread: 0, cheese: 0, silage: 0 },
            unlocked: { wheat: true, carrot: true, corn: false, apple: false, orange: false },
            enclosures: { coop: false, pigpen: false, corral: false, mill: false, bakery: false, dairy: false, trench: false, doghouse: false },
            gridSize: 6, currentMission: null, savedPlants: [] 
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
            cheese: { sellPrice: 45, xp: 80 },
            silage: { sellPrice: 50, xp: 60 }
        };

        this.animalConfig = {
            chicken: { product: 'egg', time: 60000 }, 
            cow:     { product: 'milk', time: 120000 }, 
            pig:     { product: 'bacon', time: 90000 }  
        };

        this.init();
    }

    init() {
        if (!auth) return this.startGame(); 

        auth.onAuthStateChanged((user) => {
            const loader = document.getElementById('loader');
            const loginModal = document.getElementById('login-modal');

            if (user) {
                this.currentUser = user;
                if(loginModal) loginModal.style.display = 'none';
                if(loader) { loader.style.display = 'flex'; document.getElementById('loading-text').innerText = "BAIXANDO DADOS DA FAZENDA..."; }
                this.initCloud(); 
            } else {
                if(loader) loader.style.display = 'none';
                if(loginModal) loginModal.style.display = 'flex';
            }
        });

        const btnGoogle = document.getElementById('btn-google-login');
        if (btnGoogle) btnGoogle.addEventListener('click', () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => console.error(e)));
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.addEventListener('click', () => auth.signOut().then(() => window.location.reload()));
    }

    initCloud() {
        if (!db || !this.currentUser) return this.startGame();
        db.collection("fazendas").doc(this.currentUser.uid).get().then((doc) => {
            if (doc.exists) {
                this.state = { ...this.state, ...doc.data() };
                if(this.state.inventory.silage === undefined) this.state.inventory.silage = 0;
            } else this.saveToCloud(true);
            this.startGame();
        }).catch(() => this.startGame());
    }

    saveToCloud(isAutoSave = false) {
        if(!db || !this.currentUser) return;
        this.state.savedPlants = this.plants.map(p => ({ type: p.type, x: p.mesh.position.x, z: p.mesh.position.z, plantedAt: p.plantedAt }));
        db.collection("fazendas").doc(this.currentUser.uid).set(this.state)
            .then(() => { if (!isAutoSave) this.spawnFX(window.innerWidth / 2, 80, "💾 SALVO!", "#4CAF50"); })
            .catch(() => {});
    }

    startGame() {
        try {
            const ui = document.getElementById('game-ui'); if(ui) ui.style.display = 'block';
            this.setupCore(); this.setupLights(); this.buildWorld(); this.setupInteractions();
            if(!this.state.currentMission) this.generateMission(); 
            this.updateUI();
            
            const loader = document.getElementById('loader');
            if(loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 500); }
            
            setInterval(() => { this.saveToCloud(true); }, 30000);
            requestAnimationFrame((time) => this.animate(time));
        } catch (e) { console.error(e); }
    }

    setupCore() {
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.008); 
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-18 * aspect, 18 * aspect, 18, -18, 1, 1000);
        this.camera.position.set(50, 50, 50); this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
    }

    setupLights() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55); this.scene.add(this.ambientLight);
        this.sun = new THREE.DirectionalLight(0xffffff, 1.3); this.sun.position.set(40, 60, 20);
        this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.scene.add(this.sun);
        this.houseLight = new THREE.PointLight(0xffaa00, 0, 30); this.houseLight.position.set(22, 6, -10); this.scene.add(this.houseLight);
    }

    buildWorld() {
        this.grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x7cb342 }));
        this.grass.rotation.x = -Math.PI / 2; this.grass.receiveShadow = true; this.scene.add(this.grass);
        this.obstacles.push({ x: -22, z: -15, r: 8 }, { x: 22, z: -10, r: 8 }, { x: 35, z: 25, r: 14 }, { x: 0, z: 0, r: 12 }, { x: -22, z: 10, r: 6 });  
        
        this.createBarn(-22, -15); this.createFarmhouse(22, -10); this.createLake(35, 25); this.createWindmill(-22, 10); 

        // CRÍTICO: CARREGANDO TODAS AS CONSTRUÇÕES DA NUVEM (INCLUINDO AS NOVAS!)
        if (this.state.enclosures.bakery) { let x=5, z=-25; if (this.state.enclosures.bakery.x !== undefined) { x = this.state.enclosures.bakery.x; z = this.state.enclosures.bakery.z; } this.createBakery(x, z); const b = document.getElementById('btn-bakery'); if(b) b.style.display = 'none'; this.obstacles.push({ x, z, r: 5 }); }
        if (this.state.enclosures.dairy) { let x=15, z=-25; if (this.state.enclosures.dairy.x !== undefined) { x = this.state.enclosures.dairy.x; z = this.state.enclosures.dairy.z; } this.createDairy(x, z); const b = document.getElementById('btn-dairy'); if(b) b.style.display = 'none'; this.obstacles.push({ x, z, r: 5 }); }
        if (this.state.enclosures.trench) { let x=25, z=-25; if (this.state.enclosures.trench.x !== undefined) { x = this.state.enclosures.trench.x; z = this.state.enclosures.trench.z; } this.createTrench(x, z); const b = document.getElementById('btn-trench'); if(b) b.style.display = 'none'; this.obstacles.push({ x, z, r: 5 }); }
        if (this.state.enclosures.doghouse) { let x=20, z=-3; if (this.state.enclosures.doghouse.x !== undefined) { x = this.state.enclosures.doghouse.x; z = this.state.enclosures.doghouse.z; } this.createDoghouse(x, z); const b = document.getElementById('btn-doghouse'); if(b) b.style.display = 'none'; this.obstacles.push({ x, z, r: 3 }); }
        
        if (this.state.enclosures.coop) { let x=10, z=-22; if (this.state.enclosures.coop.x !== undefined) { x = this.state.enclosures.coop.x; z = this.state.enclosures.coop.z; } this.buildEnclosureOld('coop', x, z); const b = document.getElementById('btn-coop'); if(b) b.style.display = 'none'; this.obstacles.push({ x, z, r: 6 }); }
        if (this.state.enclosures.pigpen) { let x=-5, z=20; if (this.state.enclosures.pigpen.x !== undefined) { x = this.state.enclosures.pigpen.x; z = this.state.enclosures.pigpen.z; } this.buildEnclosureOld('pigpen', x, z); const b = document.getElementById('btn-pigpen'); if(b) b.style.display = 'none'; this.obstacles.push({ x, z, r: 6 }); }
        if (this.state.enclosures.corral) { let x=25, z=5; if (this.state.enclosures.corral.x !== undefined) { x = this.state.enclosures.corral.x; z = this.state.enclosures.corral.z; } this.buildEnclosureOld('corral', x, z); const b = document.getElementById('btn-corral'); if(b) b.style.display = 'none'; this.obstacles.push({ x, z, r: 8 }); }

        this.renderGrid(); 
        
        if (this.state.savedPlants && this.state.savedPlants.length > 0) {
            this.state.savedPlants.forEach(sp => { if (this.config[sp.type] && this.config[sp.type].isTree) this.restoreTree(sp); else this.restoreCrop(sp); });
        }

        for(let i=0; i<45; i++) this.createTree((Math.random()-0.5)*250, (Math.random()-0.5)*250);
        
        this.createPet('dog', 15, -5); this.createPet('cat', 18, -12);
        for(let i=0; i<5; i++) this.createBird(); 
    }

    restoreCrop(sp) {
        let targetTile = null; let minDist = Infinity;
        this.tiles.forEach(t => { 
            if(!t.userData.occupied) {
                let dist = Math.sqrt(Math.pow(t.position.x - sp.x, 2) + Math.pow(t.position.z - sp.z, 2)); 
                if (dist < minDist) { minDist = dist; targetTile = t; }
            }
        });
        if (targetTile) { 
            targetTile.userData.occupied = true;
            const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshStandardMaterial({color: 0x4caf50}));
            stalk.position.set(targetTile.position.x, 0.4, targetTile.position.z);
            this.scene.add(stalk);
            this.plants.push({ mesh: stalk, tile: targetTile, type: sp.type, plantedAt: sp.plantedAt, progress: 0 });
        }
    }

    restoreTree(sp) {
        const conf = this.config[sp.type];
        const mesh = new THREE.Group(); 
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5), new THREE.MeshStandardMaterial({color: 0x5d4037})); trunk.position.y = 0.75;
        const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), new THREE.MeshStandardMaterial({color: conf.leafColor})); leaves.position.y = 2;
        mesh.add(trunk, leaves); mesh.position.set(sp.x, 0, sp.z); this.scene.add(mesh);
        this.plants.push({ mesh: mesh, type: sp.type, plantedAt: sp.plantedAt, progress: 0 });
    }

    // ==========================================
    // SISTEMA ARQUITETO (COM RADAR DE COLISÃO CORRETO)
    // ==========================================
    buyBuilding(type, cost) {
        if (this.state.money < cost) { alert("Dinheiro Insuficiente!"); return; }
        if (this.state.enclosures[type]) { alert("Já possui!"); return; }
        this.closeMarket(); this.enterPlacementMode(type, cost);
    }

    enterPlacementMode(type, cost) {
        this.placementMode = true; this.placementType = type; this.placementCost = cost; this.placementIsValid = false;
        const ui = document.getElementById('placement-ui'); if(ui) ui.classList.remove('hidden');
        
        this.placementGrid = new THREE.GridHelper(200, 50, 0x000000, 0xffffff); this.placementGrid.position.y = 0.2; this.placementGrid.material.opacity = 0.2; this.placementGrid.material.transparent = true;
        this.scene.add(this.placementGrid);
        
        let ghostSize = type === 'doghouse' ? 4 : 8; 
        this.placementGhost = new THREE.Mesh(new THREE.BoxGeometry(ghostSize, 4, ghostSize), new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 }));
        this.placementGhost.position.set(this.camera.position.x - 50, 2, this.camera.position.z - 50);
        this.scene.add(this.placementGhost);
        this.validatePlacementPosition(this.placementGhost.position.x, this.placementGhost.position.z);
    }

    cancelPlacement() {
        this.placementMode = false;
        const ui = document.getElementById('placement-ui'); if(ui) ui.classList.add('hidden');
        if (this.placementGrid) this.scene.remove(this.placementGrid);
        if (this.placementGhost) this.scene.remove(this.placementGhost);
    }

    confirmPlacement() {
        if (!this.placementIsValid) return;
        this.state.money -= this.placementCost; 
        const px = this.placementGhost.position.x; const pz = this.placementGhost.position.z;
        this.state.enclosures[this.placementType] = { built: true, x: px, z: pz };
        
        let collisionRadius = this.placementType === 'doghouse' ? 3 : 5;
        this.obstacles.push({ x: px, z: pz, r: collisionRadius });
        
        this.cancelPlacement(); this.updateUI();
        this.createConstructionSite(this.placementType, px, pz, 5000);
        this.saveToCloud();
    }

    validatePlacementPosition(x, z) {
        if (!this.placementGhost) return;
        const snapX = Math.round(x / 4) * 4; const snapZ = Math.round(z / 4) * 4;
        this.placementGhost.position.set(snapX, 2, snapZ);
        let hasCollision = false;
        
        let safeRadius = this.placementType === 'doghouse' ? 3 : 4;
        for (const obs of this.obstacles) {
            if (Math.sqrt(Math.pow(snapX - obs.x, 2) + Math.pow(snapZ - obs.z, 2)) < (safeRadius + obs.r)) { hasCollision = true; break; }
        }
        this.placementIsValid = !hasCollision;
        this.placementGhost.material.color.setHex(hasCollision ? 0xff0000 : 0x00
