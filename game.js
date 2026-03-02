/**
 * NEBULA FARM PRO - CÓDIGO LIMPO E FORMATADO 🚜♻️🌧️
 * Celeiro corrigido, Clima Dinâmico, Reciclagem, Decoração e Trator Pilotável!
 */

window.onerror = function(message, source, lineno) { 
    console.error(`ERRO: ${message} (Linha: ${lineno})`); 
    return false; 
};

// ==========================================
// 1. CONEXÃO COM O FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCCnMspqNoKarOxZxXzaWACNxIV-mi3qNQ",
    authDomain: "nebulafarm-db.firebaseapp.com",
    projectId: "nebulafarm-db",
    storageBucket: "nebulafarm-db.firebasestorage.app",
    messagingSenderId: "642094890680",
    appId: "1:642094890680:web:33e78b20729f19be8cbe4d"
};

let db = null; 
let auth = null;

try { 
    firebase.initializeApp(firebaseConfig); 
    db = firebase.firestore(); 
    auth = firebase.auth(); 
} catch (e) {
    console.error("Erro ao carregar o Firebase:", e);
}

class NebulaFarmPro {
    constructor() {
        // Core 3D
        this.scene = new THREE.Scene(); 
        this.camera = null; 
        this.renderer = null;
        
        // Elementos do Mundo
        this.grass = null; 
        this.lake = null; 
        this.tiles = []; 
        this.plants = []; 
        this.animations = [];
        this.animals = []; 
        this.pets = []; 
        this.factories = []; 
        this.constructions = []; 
        this.obstacles = [];     
        this.decorations = []; 
        
        // Interações
        this.isDragging = false; 
        this.activeDragTool = null; 
        this.lastTreePlantTime = 0; 
        this.isPanning = false; 
        this.panStart = { x: 0, y: 0 }; 
        this.hasPanned = false; 
        this.pendingBubble = null;   
        
        // Modo Arquiteto
        this.placementMode = false; 
        this.placementType = null; 
        this.placementCost = 0;
        this.placementGhost = null; 
        this.placementGrid = null; 
        this.placementIsValid = false;

        // Mecânicas
        this.isFishing = false; 
        this.timeOfDay = 1.5; 
        this.currentUser = null; 

        // Clima e Trator
        this.weather = { isRaining: false, timer: 0 };
        this.rainParticles = null;
        this.tractor = { active: false, mesh: null, isDriving: false, target: null };

        // Estado do Jogo (Save)
        this.state = {
            money: 1000, 
            xp: 0, 
            lvl: 1, 
            siloCount: 0, 
            maxSilo: 50,
            inventory: { wheat: 10, carrot: 10, corn: 0, apple: 0, orange: 0, egg: 0, milk: 0, bacon: 0, feed: 5, fish: 0, bread: 0, cheese: 0, silage: 0, junk: 0, fertilizer: 0 },
            unlocked: { wheat: true, carrot: true, corn: false, apple: false, orange: false },
            enclosures: { coop: false, pigpen: false, corral: false, mill: false, bakery: false, dairy: false, trench: false, doghouse: false, recycler: false, tractor: false },
            gridSize: 6, 
            currentMission: null, 
            savedPlants: [], 
            savedDecorations: [] 
        };

        // Configurações Globais
        this.config = {
            wheat:  { color: 0xFFD700, time: 120000, yield: 2, sellPrice: 2, xp: 10 },  
            carrot: { color: 0xFF4500, time: 240000, yield: 2, sellPrice: 5, xp: 20 },  
            corn:   { color: 0xFFEB3B, time: 600000, yield: 2, sellPrice: 12, xp: 50 },
            apple:  { isTree: true, leafColor: 0x27ae60, readyColor: 0xe74c3c, time: 180000, yield: 3, sellPrice: 10, xp: 30 },
            orange: { isTree: true, leafColor: 0x2ecc71, readyColor: 0xe67e22, time: 240000, yield: 3, sellPrice: 16, xp: 45 },
            egg: { sellPrice: 8, xp: 15 }, 
            milk: { sellPrice: 15, xp: 30 }, 
            bacon: { sellPrice: 20, xp: 40 },
            fish: { sellPrice: 25, xp: 50 }, 
            bread: { sellPrice: 35, xp: 60 }, 
            cheese: { sellPrice: 45, xp: 80 },
            silage: { sellPrice: 50, xp: 60 }, 
            fertilizer: { sellPrice: 30, xp: 50 } 
        };

        this.animalConfig = { 
            chicken: { product: 'egg', time: 60000 }, 
            cow: { product: 'milk', time: 120000 }, 
            pig: { product: 'bacon', time: 90000 } 
        };

        this.init();
    }

    // ==========================================
    // 2. INICIALIZAÇÃO E LOGIN
    // ==========================================
    init() {
        if (!auth) return this.startGame(); 

        auth.onAuthStateChanged((user) => {
            const loader = document.getElementById('loader'); 
            const loginModal = document.getElementById('login-modal');
            
            if (user) {
                this.currentUser = user; 
                if (loginModal) loginModal.style.display = 'none';
                if (loader) { 
                    loader.style.display = 'flex'; 
                    document.getElementById('loading-text').innerText = "BAIXANDO DADOS..."; 
                }
                this.initCloud(); 
            } else {
                if (loader) loader.style.display = 'none'; 
                if (loginModal) loginModal.style.display = 'flex';
            }
        });

        const btnGoogle = document.getElementById('btn-google-login');
        if (btnGoogle) {
            btnGoogle.addEventListener('click', () => { 
                auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => console.error(e)); 
            });
        }

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                auth.signOut().then(() => window.location.reload());
            });
        }
    }

    initCloud() {
        if (!db || !this.currentUser) return this.startGame();
        
        db.collection("fazendas").doc(this.currentUser.uid).get().then((doc) => {
            if (doc.exists) {
                this.state = { ...this.state, ...doc.data() };
                
                // Prevenção de erros para contas antigas
                if (this.state.inventory.silage === undefined) this.state.inventory.silage = 0;
                if (this.state.inventory.junk === undefined) this.state.inventory.junk = 0;
                if (this.state.inventory.fertilizer === undefined) this.state.inventory.fertilizer = 0;
                if (!this.state.savedDecorations) this.state.savedDecorations = [];
            } else {
                this.saveToCloud(true);
            }
            this.startGame();
        }).catch(() => this.startGame());
    }

    saveToCloud(isAutoSave = false) {
        if (!db || !this.currentUser) return;
        
        this.state.savedPlants = this.plants.map(p => ({ 
            type: p.type, 
            x: p.mesh.position.x, 
            z: p.mesh.position.z, 
            plantedAt: p.plantedAt 
        }));
        
        this.state.savedDecorations = this.decorations.map(d => ({ 
            type: d.type, 
            x: d.mesh.position.x, 
            z: d.mesh.position.z 
        }));
        
        db.collection("fazendas").doc(this.currentUser.uid).set(this.state).then(() => { 
            if (!isAutoSave) {
                this.spawnFX(window.innerWidth / 2, 80, "💾 SALVO!", "#4CAF50"); 
            }
        }).catch(() => {});
    }

    startGame() {
        const ui = document.getElementById('game-ui'); 
        if (ui) ui.style.display = 'block';
        
        this.setupCore(); 
        this.setupLights(); 
        this.buildWorld(); 
        this.createWeatherSystem(); 
        this.setupInteractions();
        
        if (!this.state.currentMission) {
            this.generateMission(); 
        }
        this.updateUI();
        
        const loader = document.getElementById('loader'); 
        if (loader) { 
            loader.style.opacity = '0'; 
            setTimeout(() => loader.remove(), 500); 
        }
        
        setInterval(() => { this.saveToCloud(true); }, 30000);
        requestAnimationFrame((time) => this.animate(time));
    }

    // ==========================================
    // 3. MOTOR GRÁFICO E AMBIENTE
    // ==========================================
    setupCore() {
        this.scene.background = new THREE.Color(0x87CEEB); 
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.008); 
        
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-18 * aspect, 18 * aspect, 18, -18, 1, 1000);
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
        this.scene.add(this.houseLight);
    }

    createWeatherSystem() {
        const rainGeo = new THREE.BufferGeometry();
        const rainCount = 1500;
        const posArray = new Float32Array(rainCount * 3);
        
        for(let i=0; i < rainCount * 3; i+=3) {
            posArray[i] = (Math.random() - 0.5) * 150;     // X
            posArray[i+1] = Math.random() * 80;            // Y
            posArray[i+2] = (Math.random() - 0.5) * 150;   // Z
        }
        
        rainGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const rainMat = new THREE.PointsMaterial({color: 0xaaaaaa, size: 0.3, transparent: true, opacity: 0.6});
        this.rainParticles = new THREE.Points(rainGeo, rainMat);
        this.scene.add(this.rainParticles);
        this.rainParticles.visible = false;
    }

    buildWorld() {
        this.grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x7cb342 }));
        this.grass.rotation.x = -Math.PI / 2; 
        this.grass.receiveShadow = true; 
        this.scene.add(this.grass);
        
        this.obstacles.push(
            { x: -22, z: -15, r: 8 }, 
            { x: 22, z: -10, r: 8 }, 
            { x: 35, z: 25, r: 14 }, 
            { x: 0, z: 0, r: 12 }, 
            { x: -22, z: 10, r: 6 }
        );  
        
        this.createBarn(-22, -15); 
        this.createFarmhouse(22, -10); 
        this.createLake(35, 25); 
        this.createWindmill(-22, 10); 

        // Função auxiliar para esconder botões do mercado se já construiu
        const checkB = (s, id) => { 
            if (s) { 
                const b = document.getElementById(id); 
                if (b) b.style.display = 'none'; 
            } 
            return s; 
        }

        // Restaura Estruturas da Nuvem
        if (checkB(this.state.enclosures.bakery, 'btn-bakery')) { 
            let p = this.state.enclosures.bakery; 
            this.createBakery(p.x||5, p.z||-25); 
            this.obstacles.push({ x: p.x||5, z: p.z||-25, r: 5 }); 
        }
        if (checkB(this.state.enclosures.dairy, 'btn-dairy')) { 
            let p = this.state.enclosures.dairy; 
            this.createDairy(p.x||15, p.z||-25); 
            this.obstacles.push({ x: p.x||15, z: p.z||-25, r: 5 }); 
        }
        if (checkB(this.state.enclosures.trench, 'btn-trench')) { 
            let p = this.state.enclosures.trench; 
            this.createTrench(p.x||25, p.z||-25); 
            this.obstacles.push({ x: p.x||25, z: p.z||-25, r: 5 }); 
        }
        if (checkB(this.state.enclosures.recycler, 'btn-recycler')) { 
            let p = this.state.enclosures.recycler; 
            this.createRecycler(p.x||-15, p.z||-25); 
            this.obstacles.push({ x: p.x||-15, z: p.z||-25, r: 4 }); 
        }
        if (checkB(this.state.enclosures.doghouse, 'btn-doghouse')) { 
            let p = this.state.enclosures.doghouse; 
            this.createDoghouse(p.x||20, p.z||-3); 
            this.obstacles.push({ x: p.x||20, z: p.z||-3, r: 3 }); 
        }
        if (checkB(this.state.enclosures.tractor, 'btn-tractor')) { 
            let p = this.state.enclosures.tractor; 
            this.createTractor(p.x||-10, p.z||-10); 
            this.obstacles.push({ x: p.x||-10, z: p.z||-10, r: 4 }); 
        }
        
        if (checkB(this.state.enclosures.coop, 'btn-coop')) { 
            let p = this.state.enclosures.coop; 
            this.buildEnclosureOld('coop', p.x||10, p.z||-22); 
            this.obstacles.push({ x: p.x||10, z: p.z||-22, r: 6 }); 
        }
        if (checkB(this.state.enclosures.pigpen, 'btn-pigpen')) { 
            let p = this.state.enclosures.pigpen; 
            this.buildEnclosureOld('pigpen', p.x||-5, p.z||20); 
            this.obstacles.push({ x: p.x||-5, z: p.z||20, r: 6 }); 
        }
        if (checkB(this.state.enclosures.corral, 'btn-corral')) { 
            let p = this.state.enclosures.corral; 
            this.buildEnclosureOld('corral', p.x||25, p.z||5); 
            this.obstacles.push({ x: p.x||25, z: p.z||5, r: 8 }); 
        }

        this.renderGrid(); 
        
        if (this.state.savedPlants) { 
            this.state.savedPlants.forEach(sp => { 
                if (this.config[sp.type] && this.config[sp.type].isTree) {
                    this.restoreTree(sp); 
                } else {
                    this.restoreCrop(sp); 
                }
            }); 
        }
        
        if (this.state.savedDecorations) { 
            this.state.savedDecorations.forEach(sd => {
                this.placeDecoration(sd.type, sd.x, sd.z, false);
            }); 
        }

        for (let i=0; i<45; i++) {
            this.createTree((Math.random()-0.5)*250, (Math.random()-0.5)*250);
        }

        this.createPet('dog', 15, -5); 
        this.createPet('cat', 18, -12);
        
        for (let i=0; i<5; i++) {
            this.createBird(); 
        }
    }

    // ==========================================
    // 4. MODO ARQUITETO E DECORAÇÕES
    // ==========================================
    buyBuilding(type, cost) {
        if (this.state.money < cost) { 
            alert("Dinheiro Insuficiente!"); 
            return; 
        }
        
        if (type !== 'path' && type !== 'fence') { 
            if (this.state.enclosures[type]) { 
                alert("Já possui esta construção!"); 
                return; 
            } 
        }
        this.closeMarket(); 
        this.enterPlacementMode(type, cost);
    }

    enterPlacementMode(type, cost) {
        this.placementMode = true; 
        this.placementType = type; 
        this.placementCost = cost; 
        this.placementIsValid = false;
        
        const ui = document.getElementById('placement-ui'); 
        if (ui) ui.classList.remove('hidden');
        
        this.placementGrid = new THREE.GridHelper(200, 50, 0x000000, 0xffffff); 
        this.placementGrid.position.y = 0.2; 
        this.placementGrid.material.opacity = 0.2; 
        this.placementGrid.material.transparent = true;
        this.scene.add(this.placementGrid);
        
        let ghostSize = 8;
        if (type === 'doghouse' || type === 'recycler' || type === 'tractor') ghostSize = 6; 
        if (type === 'path' || type === 'fence') ghostSize = 4; 
        
        this.placementGhost = new THREE.Mesh(
            new THREE.BoxGeometry(ghostSize, 4, ghostSize), 
            new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 })
        );
        this.placementGhost.position.set(this.camera.position.x - 50, 2, this.camera.position.z - 50);
        this.scene.add(this.placementGhost);
        
        this.validatePlacementPosition(this.placementGhost.position.x, this.placementGhost.position.z);
    }

    cancelPlacement() {
        this.placementMode = false;
        const ui = document.getElementById('placement-ui'); 
        if (ui) ui.classList.add('hidden');
        
        if (this.placementGrid) this.scene.remove(this.placementGrid);
        if (this.placementGhost) this.scene.remove(this.placementGhost);
    }

    confirmPlacement() {
        if (!this.placementIsValid) return;
        
        this.state.money -= this.placementCost; 
        const px = this.placementGhost.position.x; 
        const pz = this.placementGhost.position.z;
        
        if (this.placementType === 'path' || this.placementType === 'fence') {
            this.placeDecoration(this.placementType, px, pz, true);
        } else {
            this.state.enclosures[this.placementType] = { built: true, x: px, z: pz };
            let collisionRadius = (this.placementType === 'doghouse' || this.placementType === 'tractor' || this.placementType === 'recycler') ? 3 : 5;
            this.obstacles.push({ x: px, z: pz, r: collisionRadius });
            this.createConstructionSite(this.placementType, px, pz, 5000);
        }
        
        this.cancelPlacement(); 
        this.updateUI(); 
        this.saveToCloud();
    }

    validatePlacementPosition(x, z) {
        if (!this.placementGhost) return;
        
        const snapX = Math.round(x / 4) * 4; 
        const snapZ = Math.round(z / 4) * 4;
        this.placementGhost.position.set(snapX, 2, snapZ);
        
        let hasCollision = false;
        if (this.placementType !== 'path' && this.placementType !== 'fence') {
            let safeRadius = 4;
            for (const obs of this.obstacles) { 
                if (Math.sqrt(Math.pow(snapX - obs.x, 2) + Math.pow(snapZ - obs.z, 2)) < (safeRadius + obs.r)) { 
                    hasCollision = true; break; 
                } 
            }
        }
        
        this.placementIsValid = !hasCollision;
        this.placementGhost.material.color.setHex(hasCollision ? 0xff0000 : 0x00ff00);
        
        const btn = document.getElementById('btn-confirm-place'); 
        if (btn) btn.disabled = hasCollision;
    }

    placeDecoration(type, x, z, save = false) {
        let mesh;
        if (type === 'path') {
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(4, 0.1, 4), 
                new THREE.MeshStandardMaterial({color: 0x95a5a6})
            ); 
            mesh.position.set(x, 0.05, z);
        } else if (type === 'fence') {
            mesh = new THREE.Group();
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3), new THREE.MeshStandardMaterial({color: 0x8B4513})); 
            p1.position.set(-1.5, 1, 0);
            
            const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3), new THREE.MeshStandardMaterial({color: 0x8B4513})); 
            p2.position.set(1.5, 1, 0);
            
            const cross = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 0.2), new THREE.MeshStandardMaterial({color: 0x8B4513})); 
            cross.position.set(0, 1.2, 0);
            
            mesh.add(p1, p2, cross); 
            mesh.position.set(x, 0, z);
        }
        this.scene.add(mesh); 
        this.decorations.push({ mesh, type, x, z }); 
        if (save) this.saveToCloud(true);
    }

    createConstructionSite(type, x, z, buildTimeMs) {
        const site = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4, 7.5), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
        box.position.y = 2; 
        box.castShadow = true; 
        
        site.add(box); 
        site.position.set(x, 0, z); 
        this.scene.add(site);
        
        this.spawnFX(x, 150, "CONSTRUINDO...", "#FFD700");
        this.constructions.push({ mesh: site, type: type, x: x, z: z, timer: Date.now(), duration: buildTimeMs });
    }

    finishConstruction(construction) {
        this.scene.remove(construction.mesh); 
        this.spawnFX(window.innerWidth/2, window.innerHeight/2, "OBRA PRONTA!", "#4CAF50");
        
        if (construction.type === 'bakery') this.createBakery(construction.x, construction.z);
        else if (construction.type === 'dairy') this.createDairy(construction.x, construction.z);
        else if (construction.type === 'trench') this.createTrench(construction.x, construction.z);
        else if (construction.type === 'recycler') this.createRecycler(construction.x, construction.z);
        else if (construction.type === 'doghouse') this.createDoghouse(construction.x, construction.z);
        else if (construction.type === 'tractor') this.createTractor(construction.x, construction.z);
        else if (construction.type === 'coop') this.buildEnclosureOld('coop', construction.x, construction.z);
        else if (construction.type === 'pigpen') this.buildEnclosureOld('pigpen', construction.x, construction.z);
        else if (construction.type === 'corral') this.buildEnclosureOld('corral', construction.x, construction.z);
        
        const btn = document.getElementById(`btn-${construction.type}`); 
        if (btn) btn.style.display = 'none'; 
        
        this.updateUI();
    }

    // ==========================================
    // 5. CRIAÇÃO DAS FÁBRICAS E ESTRUTURAS
    // ==========================================
    createRecycler(x, z) {
        const recGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({color: 0x2ecc71})); 
        base.position.y = 1.5; 
        base.castShadow = true;
        
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2, 1, 2), new THREE.MeshStandardMaterial({color: 0x7f8c8d})); 
        funnel.position.y = 4; 
        funnel.castShadow = true;
        
        recGroup.add(base, funnel); 
        recGroup.position.set(x, 0, z);
        
        recGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: recGroup, type: 'recycler' }); 
        this.scene.add(recGroup);
        this.factories.push({ mesh: recGroup, type: 'recycler', state: 'idle', timer: 0, duration: 10000 });
    }

    createTractor(x, z) {
        const tractorGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({color: 0xe74c3c, roughness: 0.5});
        const tireMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.9});
        
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 4), bodyMat); 
        body.position.y = 1.5; 
        body.castShadow = true;
        
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.5), new THREE.MeshStandardMaterial({color: 0xffffff, transparent: true, opacity: 0.5})); 
        cab.position.set(0, 3, -1);
        
        const roof = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 1.8), bodyMat); 
        roof.position.set(0, 3.8, -1);
        
        const w1 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 16), tireMat); 
        w1.rotation.z = Math.PI/2; 
        w1.position.set(1.2, 1, -1);
        
        const w2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 16), tireMat); 
        w2.rotation.z = Math.PI/2; 
        w2.position.set(-1.2, 1, -1);
        
        const w3 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16), tireMat); 
        w3.rotation.z = Math.PI/2; 
        w3.position.set(1.2, 0.6, 1.5);
        
        const w4 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16), tireMat); 
        w4.rotation.z = Math.PI/2; 
        w4.position.set(-1.2, 0.6, 1.5);
        
        tractorGroup.add(body, cab, roof, w1, w2, w3, w4); 
        tractorGroup.position.set(x, 0, z);
        
        tractorGroup.children.forEach(c => c.userData = { isTractor: true, parentRef: tractorGroup }); 
        this.scene.add(tractorGroup); 
        this.tractor.mesh = tractorGroup; 
        this.tractor.active = true;
    }

    createTrench(x, z) {
        const trenchGroup = new THREE.Group();
        const wallMat = new THREE.MeshStandardMaterial({color: 0x95a5a6, roughness: 0.9});
        
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.5), wallMat); 
        w1.position.set(0, 1, -2); 
        w1.castShadow = true;
        
        const w2 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.5), wallMat); 
        w2.position.set(0, 1, 2); 
        w2.castShadow = true;
        
        const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 4), new THREE.MeshStandardMaterial({color: 0x4e342e})); 
        floor.position.y = 0.25;
        
        trenchGroup.add(w1, w2, floor); 
        trenchGroup.position.set(x, 0, z);
        
        trenchGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: trenchGroup, type: 'trench' });
        this.scene.add(trenchGroup);
        this.factories.push({ mesh: trenchGroup, type: 'trench', state: 'idle', timer: 0, duration: 18000, indicator: floor });
    }

    createDoghouse(x, z) {
        const dhGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), new THREE.MeshStandardMaterial({color: 0x8B4513})); 
        base.position.y = 1.25; 
        base.castShadow = true;
        
        const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2, 4), new THREE.MeshStandardMaterial({color: 0xb71c1c})); 
        roof.position.y = 3.5; 
        roof.rotation.y = Math.PI/4; 
        roof.castShadow = true;
        
        dhGroup.add(base, roof); 
        dhGroup.position.set(x, 0, z); 
        this.scene.add(dhGroup);
        
        const dog = this.pets.find(p => p.type === 'dog'); 
        if (dog) { 
            dog.mesh.position.set(x, 0, z + 3); 
            dog.target.set(x, 0, z + 3); 
        }
    }

    createFarmhouse(x, z) {
        const house = new THREE.Group();
        const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); 
        walls.position.y = 2.5; 
        walls.castShadow = true; 
        walls.receiveShadow = true;
        
        const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.5, 4), new THREE.MeshStandardMaterial({ color: 0xb71c1c })); 
        roof.position.y = 6.75; 
        roof.rotation.y = Math.PI / 4; 
        roof.castShadow = true;
        
        house.add(walls, roof); 
        house.position.set(x, 0, z); 
        house.rotation.y = -Math.PI / 6; 
        this.scene.add(house);
    }

    createLake(x, z) {
        const lakeGroup = new THREE.Group();
        this.lake = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0x2980b9, transparent: true, opacity: 0.8 })); 
        this.lake.position.set(x, 0.1, z); 
        this.scene.add(this.lake);
        
        for(let i=0; i<8; i++) { 
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({color: 0x7f8c8d})); 
            rock.position.set(x + Math.cos((i/8)*Math.PI*2)*12, 0.5, z + Math.sin((i/8)*Math.PI*2)*12); 
            rock.castShadow = true; 
            lakeGroup.add(rock); 
        }
        this.scene.add(lakeGroup);
    }

    createWindmill(x, z) {
        const windmill = new THREE.Group();
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 15, 8), new THREE.MeshStandardMaterial({color: 0x8d6e63})); 
        tower.position.y = 7.5; 
        tower.castShadow = true;
        
        const blades = new THREE.Group();
        for(let i=0; i<4; i++) { 
            const blade = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 0.2), new THREE.MeshStandardMaterial({color: 0xffffff})); 
            blade.position.y = 5; 
            const pivot = new THREE.Group(); 
            pivot.rotation.z = (Math.PI / 2) * i; 
            pivot.add(blade); 
            blades.add(pivot); 
        }
        blades.position.set(0, 14, 2.5); 
        windmill.add(tower, blades); 
        windmill.position.set(x, 0, z); 
        this.scene.add(windmill);
        
        this.animations.push(() => { blades.rotation.z -= 0.015; }); 
    }

    createDairy(x, z) {
        const dairyGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 5), new THREE.MeshStandardMaterial({ color: 0xecf0f1 })); 
        base.position.y = 1.5; 
        base.castShadow = true;
        
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.5, 4), new THREE.MeshStandardMaterial({ color: 0x2980b9 })); 
        roof.position.y = 4.25; 
        roof.rotation.y = Math.PI/4; 
        roof.castShadow = true;
        
        dairyGroup.add(base, roof); 
        dairyGroup.position.set(x, 0, z);
        
        dairyGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: dairyGroup, type: 'dairy' }); 
        this.scene.add(dairyGroup);
        this.factories.push({ mesh: dairyGroup, type: 'dairy', state: 'idle', timer: 0, duration: 20000 });
    }

    createBakery(x, z) {
        const bakeryGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: 0xc0392b })); 
        base.position.y = 1.5; 
        base.castShadow = true;
        
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc0392b })); 
        roof.rotation.z = Math.PI / 2; 
        roof.position.y = 3; 
        roof.castShadow = true;
        
        bakeryGroup.add(base, roof); 
        bakeryGroup.position.set(x, 0, z);
        
        bakeryGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: bakeryGroup, type: 'bakery' }); 
        this.scene.add(bakeryGroup);
        this.factories.push({ mesh: bakeryGroup, type: 'bakery', state: 'idle', timer: 0, duration: 15000 });
    }

    // AQUI ESTÁ O CELEIRO COM AS CORES CORRETAS E FORMATADO!
    createBarn(x, z) {
        if (typeof THREE.GLTFLoader === 'undefined') return;
        
        const loader = new THREE.GLTFLoader();
        loader.load('celeiro.glb', (gltf) => {
            const barn = gltf.scene; 
            barn.position.set(x, 0, z); 
            barn.scale.set(1, 1, 1); 
            
            const materialParedeVermelha = new THREE.MeshStandardMaterial({ color: 0xFF0000, roughness: 0.8 }); 
            const materialTelhadoCinza = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 });    
            const materialMadeiraMarrom = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });    
            
            barn.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true; 
                    node.receiveShadow = true;
                    
                    const nomeDaPeca = node.name.toLowerCase(); 
                    const nomeDoGrupo = node.parent ? node.parent.name.toLowerCase() : "";
                    
                    if (nomeDaPeca.includes('triangle') || nomeDoGrupo.includes('triangle')) {
                        node.material = materialTelhadoCinza;
                    } else if (nomeDaPeca.includes('window') || nomeDoGrupo.includes('window') || nomeDaPeca.includes('door') || nomeDoGrupo.includes('door')) {
                        node.material = materialMadeiraMarrom;
                    } else {
                        node.material = materialParedeVermelha; 
                    }
                }
            });
            this.scene.add(barn);
        }, undefined, () => {});
    }

    buildEnclosureOld(type, x, z) {
        let w = 12, d = 12, color = 0x5d4037;
        
        if (type === 'coop') { 
            color = 0x8d6e63; 
            for(let i=0; i<3; i++) this.createAnimal('chicken', {x, z, w, d}); 
        } else if (type === 'pigpen') { 
            for(let i=0; i<2; i++) this.createAnimal('pig', {x, z, w, d}); 
        } else if (type === 'corral') { 
            w = 18; d = 16; color = 0xe0e0e0; 
            for(let i=0; i<2; i++) this.createAnimal('cow', {x, z, w, d}); 
        }
        
        const geoH = new THREE.BoxGeometry(w, 1, 0.5); 
        const geoV = new THREE.BoxGeometry(0.5, 1, d);
        
        const f1 = new THREE.Mesh(geoH, new THREE.MeshStandardMaterial({color})); f1.position.set(x, 0.5, z - d/2);
        const f2 = new THREE.Mesh(geoH, new THREE.MeshStandardMaterial({color})); f2.position.set(x, 0.5, z + d/2);
        const f3 = new THREE.Mesh(geoV, new THREE.MeshStandardMaterial({color})); f3.position.set(x - w/2, 0.5, z);
        const f4 = new THREE.Mesh(geoV, new THREE.MeshStandardMaterial({color})); f4.position.set(x + w/2, 0.5, z);
        
        this.scene.add(f1, f2, f3, f4);
    }

    // ==========================================
    // 6. ANIMAIS E PETS
    // ==========================================
    createAnimal(type, bounds) {
        const animal = new THREE.Group(); 
        let speed = 0;
        
        if (type === 'pig') { 
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.8), new THREE.MeshStandardMaterial({ color: 0xf8bbd0 })); 
            body.position.y = 0.6; 
            animal.add(body); 
            speed = 0.03; 
        } else if (type === 'chicken') { 
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff })); 
            body.position.y = 0.35; 
            animal.add(body); 
            speed = 0.05; 
        } else if (type === 'cow') { 
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 2.5), new THREE.MeshStandardMaterial({ color: 0xffffff })); 
            body.position.y = 1.0; 
            animal.add(body); 
            speed = 0.02; 
        }
        
        const startX = bounds.x + (Math.random() - 0.5) * (bounds.w - 2); 
        const startZ = bounds.z + (Math.random() - 0.5) * (bounds.d - 2);
        
        animal.position.set(startX, 0, startZ); 
        animal.children.forEach(c => { c.userData = { isAnimal: true, parentRef: animal }; }); 
        this.scene.add(animal);
        
        this.animals.push({ 
            mesh: animal, bounds: bounds, type: type, speed: speed, 
            target: new THREE.Vector3(startX, 0, startZ), 
            state: 'hungry', timer: 0, 
            product: this.animalConfig[type].product, 
            produceTime: this.animalConfig[type].time, 
            produceTimer: null 
        });
    }

    updateAnimals() {
        const now = Date.now();
        this.animals.forEach(anim => {
            if (anim.state === 'hungry') { 
                anim.mesh.scale.set(0.9, 0.8, 0.9); 
                return; 
            }
            if (anim.state === 'producing' || anim.state === 'idle' || anim.state === 'walking') {
                if (now - anim.produceTimer > anim.produceTime) { 
                    anim.state = 'ready'; 
                    new TWEEN.Tween(anim.mesh.scale).to({x: 1.4, y: 1.4, z: 1.4}, 500).easing(TWEEN.Easing.Elastic.Out).start(); 
                } else {
                    if (anim.state === 'idle' || anim.state === 'producing') { 
                        anim.timer--; 
                        if (anim.timer <= 0) { 
                            anim.state = 'walking'; 
                            anim.target.set(anim.bounds.x + (Math.random() - 0.5) * (anim.bounds.w - 2), 0, anim.bounds.z + (Math.random() - 0.5) * (anim.bounds.d - 2)); 
                        } 
                    } else if (anim.state === 'walking') {
                        const dx = anim.target.x - anim.mesh.position.x; 
                        const dz = anim.target.z - anim.mesh.position.z; 
                        const dist = Math.sqrt(dx*dx + dz*dz);
                        if (dist < 0.3) { 
                            anim.state = 'idle'; 
                            anim.timer = 100 + Math.random() * 200; 
                            anim.mesh.position.y = 0; 
                        } else { 
                            anim.mesh.position.x += (dx / dist) * anim.speed; 
                            anim.mesh.position.z += (dz / dist) * anim.speed; 
                            anim.mesh.rotation.y = Math.atan2(dx, dz); 
                            anim.mesh.position.y = Math.abs(Math.sin(now * 0.015)) * (anim.type === 'cow' ? 0.1 : 0.25); 
                        }
                    }
                }
            } else if (anim.state === 'ready') { 
                anim.mesh.position.y = Math.abs(Math.sin(now * 0.005)) * 0.2; 
            }
        });
    }

    createPet(type, startX, startZ) {
        const pet = new THREE.Group(); 
        let speed = 0.06;
        
        if (type === 'dog') {
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 2), new THREE.MeshStandardMaterial({ color: 0xd35400 })); 
            body.position.y = 0.7; 
            pet.add(body);
        } else if (type === 'cat') {
            const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.5), new THREE.MeshStandardMaterial({ color: 0x7f8c8d })); 
            body.position.y = 0.5; 
            pet.add(body); 
            speed = 0.07; 
        }
        
        pet.position.set(startX, 0, startZ); 
        pet.castShadow = true; 
        this.scene.add(pet);
        
        this.pets.push({ mesh: pet, type: type, speed: speed, target: new THREE.Vector3(startX, 0, startZ), state: 'idle', timer: Math.random() * 100 });
    }

    updatePets() {
        this.pets.forEach(pet => {
            if (pet.state === 'idle') { 
                pet.timer--; 
                if (pet.timer <= 0) { 
                    pet.state = 'walking'; 
                    if (pet.type === 'dog' && this.state.enclosures.doghouse) { 
                        const dh = this.state.enclosures.doghouse; 
                        pet.target.set(dh.x + (Math.random()-0.5)*15, 0, dh.z + (Math.random()-0.5)*15); 
                    } else { 
                        pet.target.set((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60); 
                    }
                } 
            } else if (pet.state === 'walking') {
                const dx = pet.target.x - pet.mesh.position.x; 
                const dz = pet.target.z - pet.mesh.position.z; 
                const dist = Math.sqrt(dx*dx + dz*dz);
                
                if (dist < 0.5) { 
                    pet.state = 'idle'; 
                    pet.timer = 100 + Math.random() * 300; 
                } else { 
                    pet.mesh.position.x += (dx / dist) * pet.speed; 
                    pet.mesh.position.z += (dz / dist) * pet.speed; 
                    pet.mesh.rotation.y = Math.atan2(dx, dz); 
                    pet.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.01)) * 0.2; 
                }
            }
        });
    }

    createBird() {
        const bird = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.6), new THREE.MeshStandardMaterial({color: 0x2980b9})); 
        bird.add(body);
        
        const pivot = new THREE.Group(); 
        pivot.position.set((Math.random()-0.5)*100, 15 + Math.random()*5, (Math.random()-0.5)*100);
        bird.position.set(10 + Math.random()*5, 0, 0); 
        pivot.add(bird); 
        this.scene.add(pivot);
        
        this.animations.push(() => { 
            pivot.rotation.y += 0.02; 
            bird.position.y = Math.sin(Date.now() * 0.005) * 2; 
        });
    }

    // ==========================================
    // 7. FLORA E AGRICULTURA
    // ==========================================
    createTree(x, z) {
        for (const obs of this.obstacles) { 
            if (Math.sqrt(Math.pow(x - obs.x, 2) + Math.pow(z - obs.z, 2)) < obs.r + 3) return; 
        }
        const tree = new THREE.Group();
        
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 5), new THREE.MeshStandardMaterial({color: 0x5d4037}));
        const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(3.5, 1), new THREE.MeshStandardMaterial({color: 0x388e3c}));
        
        leaves.position.y = 5.5; 
        trunk.position.y = 2.5; 
        leaves.castShadow = true; 
        trunk.castShadow = true;
        
        tree.add(trunk, leaves); 
        tree.position.set(x, 0, z); 
        this.scene.add(tree);
    }

    renderGrid() {
        this.tiles.forEach(t => this.scene.remove(t)); 
        this.tiles = []; 
        const dirtMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 }); 
        const offset = (this.state.gridSize * 3.5) / 2 - 1.75; 
        
        for(let x=0; x<this.state.gridSize; x++) { 
            for(let z=0; z<this.state.gridSize; z++) { 
                const tile = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), dirtMat); 
                tile.position.set(x * 3.5 - offset, 0.25, z * 3.5 - offset); 
                tile.receiveShadow = true; 
                tile.userData = { occupied: false }; 
                this.scene.add(tile); 
                this.tiles.push(tile); 
            } 
        }
    }

    restoreCrop(sp) {
        let targetTile = null; 
        let minDist = Infinity;
        
        this.tiles.forEach(t => { 
            if (!t.userData.occupied) { 
                let dist = Math.sqrt(Math.pow(t.position.x - sp.x, 2) + Math.pow(t.position.z - sp.z, 2)); 
                if (dist < minDist) { 
                    minDist = dist; 
                    targetTile = t; 
                } 
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
        
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5), new THREE.MeshStandardMaterial({color: 0x5d4037})); 
        trunk.position.y = 0.75;
        
        const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), new THREE.MeshStandardMaterial({color: conf.leafColor})); 
        leaves.position.y = 2;
        
        mesh.add(trunk, leaves); 
        mesh.position.set(sp.x, 0, sp.z); 
        this.scene.add(mesh);
        
        this.plants.push({ mesh: mesh, type: sp.type, plantedAt: sp.plantedAt, progress: 0 });
    }

    plant(tile, seedType) {
        if (tile.userData.occupied || this.state.inventory[seedType] <= 0) return;
        this.state.inventory[seedType]--; 
        tile.userData.occupied = true;
        
        const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshStandardMaterial({color: 0x4caf50}));
        stalk.position.set(tile.position.x, 0.4, tile.position.z); 
        this.scene.add(stalk);
        
        this.plants.push({ mesh: stalk, tile, type: seedType, plantedAt: Date.now(), progress: 0 }); 
        this.updateUI(); 
        this.saveToCloud(true);
    }

    plantTree(point, seedType) {
        let hasCollision = false;
        for (const obs of this.obstacles) { 
            if (Math.sqrt(Math.pow(point.x - obs.x, 2) + Math.pow(point.z - obs.z, 2)) < (obs.r + 2)) { 
                hasCollision = true; break; 
            } 
        }
        if (hasCollision) { 
            this.spawnFX(window.innerWidth / 2, window.innerHeight / 2, "❌ LOCAL INVÁLIDO!", "#F44336"); 
            return; 
        }
        
        if (this.state.inventory[seedType] <= 0) return;
        this.state.inventory[seedType]--; 
        
        const conf = this.config[seedType];
        const mesh = new THREE.Group(); 
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5), new THREE.MeshStandardMaterial({color: 0x5d4037})); 
        trunk.position.y = 0.75;
        const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), new THREE.MeshStandardMaterial({color: conf.leafColor})); 
        leaves.position.y = 2;
        
        mesh.add(trunk, leaves); 
        mesh.position.set(point.x, 0, point.z); 
        this.scene.add(mesh);
        
        this.plants.push({ mesh: mesh, type: seedType, plantedAt: Date.now(), progress: 0 }); 
        this.updateUI(); 
        this.saveToCloud(true);
    }

    harvestPlant(mesh, x, y) {
        let targetMesh = mesh; 
        if (mesh.parent && mesh.parent.type === "Group") targetMesh = mesh.parent;
        
        const idx = this.plants.findIndex(p => p.mesh === targetMesh); 
        if (idx === -1) return;
        
        const p = this.plants[idx]; 
        if (p.progress < 1) return;
        
        const conf = this.config[p.type]; 
        if (this.state.siloCount + conf.yield > this.state.maxSilo) return;
        
        this.state.inventory[p.type] += conf.yield; 
        this.state.siloCount += conf.yield; 
        this.state.xp += conf.xp;
        
        if (conf.isTree) { 
            p.progress = 0; 
            p.plantedAt = Date.now(); 
            p.mesh.children[1].material.color.setHex(conf.leafColor); 
            this.spawnFX(x, y, `+${conf.yield} ${p.type.toUpperCase()}`, "#FFF"); 
        } else { 
            p.tile.userData.occupied = false; 
            if (typeof TWEEN !== 'undefined') {
                new TWEEN.Tween(p.mesh.scale).to({x:0,y:0,z:0}, 200).onComplete(() => this.scene.remove(p.mesh)).start(); 
            } else {
                this.scene.remove(p.mesh); 
            }
            this.plants.splice(idx, 1); 
            this.spawnFX(x, y, `+${conf.yield} ${p.type.toUpperCase()}`, "#FFF"); 
        }
        this.checkLevel(); 
        this.updateUI(); 
        this.saveToCloud(true);
    }

    // ==========================================
    // 8. INTERAÇÕES E CONTROLES (MOUSE/TOUCH)
    // ==========================================
    setupInteractions() {
        const raycaster = new THREE.Raycaster(); 
        const mouse = new THREE.Vector2();
        
        window.addEventListener('pointerdown', (e) => {
            if (e.target.closest('#game-ui') || e.target.closest('#market-modal') || e.target.closest('#login-modal') || e.target.closest('.bubble-item')) return;
            
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1; 
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; 
            raycaster.setFromCamera(mouse, this.camera);
            
            if (this.tractor.isDriving) {
                const hitsGrass = raycaster.intersectObject(this.grass);
                if (hitsGrass.length > 0) {
                    this.tractor.target = new THREE.Vector3(hitsGrass[0].point.x, 0, hitsGrass[0].point.z);
                    this.spawnFX(hitsGrass[0].point.x, e.clientY, "🎯", "#e74c3c");
                }
                return; 
            }

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

            if (this.tractor.mesh) {
                const hitsTractor = raycaster.intersectObjects(this.tractor.mesh.children);
                if (hitsTractor.length > 0) {
                    this.tractor.isDriving = true;
                    document.getElementById('driving-alert').style.display = 'block';
                    this.isPanning = false; 
                    return;
                }
            }

            const factoryMeshes = []; 
            this.factories.forEach(f => factoryMeshes.push(...f.mesh.children));
            const hitsF = raycaster.intersectObjects(factoryMeshes);
            if (hitsF.length > 0) {
                const fac = this.factories.find(f => f.mesh === hitsF[0].object.userData.parentRef);
                if (fac && fac.state === 'idle') this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: fac.type + '_idle' };
                else if (fac && fac.state === 'ready') this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: fac.type + '_ready' };
                return;
            }

            const plantMeshes = this.plants.filter(p => p.progress >= 1).flatMap(p => p.mesh.type === 'Group' ? p.mesh.children : [p.mesh]);
            if (raycaster.intersectObjects(plantMeshes).length > 0) { 
                this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'harvest_plant' }; 
                return; 
            }

            const animalMeshes = []; 
            this.animals.forEach(a => animalMeshes.push(...a.mesh.children));
            if (raycaster.intersectObjects(animalMeshes).length > 0) {
                const anim = this.animals.find(a => a.mesh === raycaster.intersectObjects(animalMeshes)[0].object.userData.parentRef);
                if (anim.state === 'hungry') this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'feed_animal' };
                else if (anim.state === 'ready') this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'harvest_animal' };
                return;
            }

            if (this.lake && raycaster.intersectObject(this.lake).length > 0) { 
                this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'fish' }; 
                return; 
            }
            
            const hitsTiles = raycaster.intersectObjects(this.tiles); 
            if (hitsTiles.length > 0 && !hitsTiles[0].object.userData.occupied) { 
                this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'plant_crop' }; 
                return; 
            }
            
            const hitsGrass = raycaster.intersectObject(this.grass); 
            if (hitsGrass.length > 0) { 
                this.pendingBubble = { x: e.clientX, y: e.clientY, ctx: 'plant_tree' }; 
                return; 
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (this.placementMode || this.tractor.isDriving) return; 
            
            if (this.isDragging && this.activeDragTool) { 
                mouse.x = (e.clientX / window.innerWidth) * 2 - 1; 
                mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; 
                raycaster.setFromCamera(mouse, this.camera); 
                this.applyDragTool(raycaster, e.clientX, e.clientY); 
            } else if (this.isPanning) {
                const moveX = e.clientX - this.panStart.x; 
                const moveY = e.clientY - this.panStart.y;
                
                if (Math.abs(moveX) > 4 || Math.abs(moveY) > 4) {
                    this.hasPanned = true; 
                    this.pendingBubble = null; 
                    const f = 0.08; 
                    let newX = this.camera.position.x - (moveX * f) - (moveY * f); 
                    let newZ = this.camera.position.z + (moveX * f) - (moveY * f);
                    this.camera.position.x = Math.max(-40, Math.min(110, newX)); 
                    this.camera.position.z = Math.max(-40, Math.min(110, newZ));
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
            } else if (!this.hasPanned && this.pendingBubble) { 
                this.showBubble(this.pendingBubble.x, this.pendingBubble.y, this.pendingBubble.ctx); 
            }
        });

        window.addEventListener('contextmenu', (e) => { 
            e.preventDefault(); 
            if (this.tractor.isDriving) { 
                this.tractor.isDriving = false; 
                document.getElementById('driving-alert').style.display = 'none'; 
            } 
        });
    }

    showBubble(x, y, context) {
        const bubble = document.getElementById('bubble-menu'); 
        if (!bubble) return;
        
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
        } else if (context === 'trench_idle') {
            const canMakeSilage = this.state.inventory.corn >= 2 ? this.state.inventory.corn : 0;
            bubble.innerHTML += this.createBubbleItem('make_silage', '🌽', '-2🌽', canMakeSilage === 0);
        } else if (context === 'trench_ready') {
            bubble.innerHTML += this.createBubbleItem('collect_silage', '🚜', 'PEGAR');
        } else if (context === 'recycler_idle') {
            const canRecycle = this.state.inventory.junk >= 2 ? this.state.inventory.junk : 0;
            bubble.innerHTML += this.createBubbleItem('recycle', '🥾', '-2 Lixo', canRecycle === 0);
        } else if (context === 'recycler_ready') {
            bubble.innerHTML += this.createBubbleItem('collect_fertilizer', '🧪', 'PEGAR');
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
        if (b) b.style.display = 'none'; 
    }

    applyDragTool(raycaster, x, y) {
        if (this.activeDragTool === 'bake_bread' || this.activeDragTool === 'make_cheese' || this.activeDragTool === 'make_silage' || this.activeDragTool === 'recycle') {
            const factoryMeshes = []; 
            this.factories.forEach(f => factoryMeshes.push(...f.mesh.children));
            const hitsF = raycaster.intersectObjects(factoryMeshes);
            
            if (hitsF.length > 0) {
                const fac = this.factories.find(f => f.mesh === hitsF[0].object.userData.parentRef);
                if (fac && fac.state === 'idle') {
                    if (this.activeDragTool === 'bake_bread' && this.state.inventory.wheat >= 3 && fac.type === 'bakery') {
                        this.state.inventory.wheat -= 3; fac.state = 'baking'; fac.timer = Date.now(); this.spawnFX(x, y, "ASSANDO...", "#e67e22");
                    } else if (this.activeDragTool === 'make_cheese' && this.state.inventory.milk >= 2 && fac.type === 'dairy') {
                        this.state.inventory.milk -= 2; fac.state = 'baking'; fac.timer = Date.now(); this.spawnFX(x, y, "PRODUZINDO...", "#f1c40f"); 
                    } else if (this.activeDragTool === 'make_silage' && this.state.inventory.corn >= 2 && fac.type === 'trench') {
                        this.state.inventory.corn -= 2; fac.state = 'baking'; fac.timer = Date.now(); this.spawnFX(x, y, "FERMENTANDO...", "#689f38"); 
                    } else if (this.activeDragTool === 'recycle' && this.state.inventory.junk >= 2 && fac.type === 'recycler') {
                        this.state.inventory.junk -= 2; fac.state = 'baking'; fac.timer = Date.now(); this.spawnFX(x, y, "RECICLANDO...", "#2ecc71"); 
                    }
                    this.activeDragTool = null; this.isDragging = false; this.hideBubble(); this.updateUI();
                }
            } 
            return;
        }

        if (this.activeDragTool === 'collect_bread' || this.activeDragTool === 'collect_cheese' || this.activeDragTool === 'collect_silage' || this.activeDragTool === 'collect_fertilizer') {
            const factoryMeshes = []; 
            this.factories.forEach(f => factoryMeshes.push(...f.mesh.children));
            const hitsF = raycaster.intersectObjects(factoryMeshes);
            
            if (hitsF.length > 0) {
                const fac = this.factories.find(f => f.mesh === hitsF[0].object.userData.parentRef);
                if (fac && fac.state === 'ready') {
                    if (this.state.siloCount + 1 > this.state.maxSilo) { 
                        this.spawnFX(x, y, "SILO CHEIO!", "#F44336"); 
                        return; 
                    }
                    
                    if (fac.type === 'bakery') { this.state.inventory.bread++; this.state.xp += this.config.bread.xp; this.spawnFX(x, y, "+1 🍞", "#e67e22"); }
                    if (fac.type === 'dairy') { this.state.inventory.cheese++; this.state.xp += this.config.cheese.xp; this.spawnFX(x, y, "+1 🧀", "#f1c40f"); }
                    if (fac.type === 'trench') { this.state.inventory.silage++; this.state.xp += this.config.silage.xp; this.spawnFX(x, y, "+1 🚜", "#689f38"); }
                    if (fac.type === 'recycler') { this.state.inventory.fertilizer++; this.state.xp += this.config.fertilizer.xp; this.spawnFX(x, y, "+1 🧪", "#2ecc71"); }
                    
                    this.state.siloCount++; 
                    fac.state = 'idle'; 
                    this.checkLevel();
                    this.activeDragTool = null; 
                    this.isDragging = false; 
                    this.hideBubble(); 
                    this.updateUI(); 
                    this.saveToCloud(true);
                }
            } 
            return;
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
             if (hitsLake.length > 0) { 
                 this.startFishing(x, y); 
                 this.activeDragTool = null; 
                 this.isDragging = false; 
                 this.hideBubble(); 
             }
        } else {
            const seedType = this.activeDragTool;
            if (this.config[seedType].isTree) {
                const hitsGrass = raycaster.intersectObject(this.grass);
                if (hitsGrass.length > 0 && Date.now() - this.lastTreePlantTime > 400) { 
                    this.plantTree(hitsGrass[0].point, seedType); 
                    this.lastTreePlantTime = Date.now(); 
                    this.updateBubbleQuantity(seedType); 
                }
            } else {
                const hitsTiles = raycaster.intersectObjects(this.tiles);
                if (hitsTiles.length > 0) { 
                    this.plant(hitsTiles[0].object, seedType); 
                    this.updateBubbleQuantity(seedType); 
                }
            }
        }
    }

    updateBubbleQuantity(tool) {
        const bubbleItem = document.querySelector(`.bubble-item[data-tool="${tool}"] small`);
        if (bubbleItem) { 
            const qty = this.state.inventory[tool]; 
            bubbleItem.innerText = qty; 
            if(qty <= 0) bubbleItem.parentElement.classList.add('locked'); 
        }
    }

    // ==========================================
    // 9. REGRAS DE NEGÓCIO E MISSÕES
    // ==========================================
    harvestAnimal(animalGroup, x, y) {
        const anim = this.animals.find(a => a.mesh === animalGroup);
        if (!anim || anim.state !== 'ready' || this.state.siloCount + 1 > this.state.maxSilo) return;
        
        const prodConf = this.config[anim.product]; 
        this.state.inventory[anim.product]++; 
        this.state.siloCount++; 
        this.state.xp += prodConf.xp;
        
        anim.state = 'hungry'; 
        anim.mesh.position.y = 0; 
        new TWEEN.Tween(anim.mesh.scale).to({x: 0.9, y: 0.8, z: 0.9}, 300).start();
        
        let icon = anim.product === 'egg' ? '🥚' : (anim.product === 'milk' ? '🥛' : '🥓');
        this.spawnFX(x, y, `+1 ${icon}`, "#FFD700"); 
        
        this.checkLevel(); 
        this.updateUI();
    }

    startFishing(x, y) {
        if (this.isFishing) return; 
        if (this.state.inventory.corn <= 0) { 
            this.spawnFX(x, y, "PRECISA DE 1 MILHO", "#F44336"); 
            return; 
        }
        if (this.state.siloCount >= this.state.maxSilo) { 
            this.spawnFX(x, y, "SILO CHEIO!", "#F44336"); 
            return; 
        }

        this.state.inventory.corn--; 
        this.isFishing = true; 
        this.spawnFX(x, y, "PESCANDO...", "#3498db"); 
        this.updateUI();
        
        setTimeout(() => {
            this.isFishing = false; 
            const chance = Math.random();
            
            if (chance > 0.4) { 
                this.state.inventory.fish++; 
                this.state.siloCount++; 
                this.state.xp += this.config.fish.xp; 
                this.spawnFX(x, y - 50, "🎣 PEGOU UM PEIXE!", "#4CAF50"); 
                this.checkLevel(); 
            } else { 
                this.state.inventory.junk++; 
                this.spawnFX(x, y - 50, "🥾 BOTA VELHA (+1 Lixo)", "#9e9e9e"); 
            } 
            this.updateUI(); 
            this.saveToCloud(true);
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
        if(this.state.enclosures.trench) types.push('silage'); 
        
        const type = types[Math.floor(Math.random() * types.length)];
        const qty = (type === 'bread' || type === 'cheese' || type === 'silage') ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 4) + 2; 
        const basePrice = this.config[type] ? this.config[type].sellPrice : 0;
        
        this.state.currentMission = { type, qty, reward: (basePrice * qty) * 2 };
        this.updateUI();
    }

    completeMission() {
        const m = this.state.currentMission;
        if (this.state.inventory[m.type] >= m.qty) {
            this.state.inventory[m.type] -= m.qty; 
            this.state.siloCount -= m.qty;
            this.state.money += m.reward; 
            this.state.xp += 150; 
            
            this.spawnFX(window.innerWidth/2, 100, `ENTREGA FEITA! +$${m.reward}`, "#FFD700");
            this.checkLevel(); 
            this.generateMission(); 
            this.updateUI(); 
            this.saveToCloud(true);
        }
    }

    checkLevel() {
        if (this.state.xp >= this.state.lvl * 300) {
            this.state.lvl++; 
            this.state.xp = 0; 
            this.state.inventory.wheat += 5; 
            this.state.inventory.carrot += 5;
            
            this.spawnFX(window.innerWidth/2, window.innerHeight/2 - 50, `LEVEL ${this.state.lvl}!`, "#4CAF50");
            
            if (this.state.lvl === 2 && !this.state.unlocked.corn) { 
                this.state.unlocked.corn = true; this.state.inventory.corn += 5; 
                setTimeout(() => this.spawnFX(window.innerWidth/2, window.innerHeight/2 + 20, "MILHO LIBERADO!", "#FFD700"), 1000); 
            }
            if (this.state.lvl === 3 && !this.state.unlocked.apple) { 
                this.state.unlocked.apple = true; this.state.inventory.apple += 2; 
                setTimeout(() => this.spawnFX(window.innerWidth/2, window.innerHeight/2 + 20, "MACIEIRA!", "#e74c3c"), 1000); 
            }
            if (this.state.lvl === 4 && !this.state.unlocked.orange) { 
                this.state.unlocked.orange = true; this.state.inventory.orange += 2; 
                setTimeout(() => this.spawnFX(window.innerWidth/2, window.innerHeight/2 + 20, "LARANJEIRA!", "#e67e22"), 1000); 
            }
            this.updateUI();
        }
    }

    feedAnimal(animalGroup, x, y) {
        const anim = this.animals.find(a => a.mesh === animalGroup);
        if (!anim || anim.state !== 'hungry' || this.state.inventory.feed <= 0) return;
        
        this.state.inventory.feed--; 
        anim.state = 'producing'; 
        anim.produceTimer = Date.now(); 
        anim.timer = 0;
        
        new TWEEN.Tween(anim.mesh.scale).to({x: 1, y: 1, z: 1}, 300).easing(TWEEN.Easing.Bounce.Out).start();
        this.spawnFX(x, y, "❤️", "#F44336"); 
        
        this.updateBubbleQuantity('feed'); 
        this.updateUI(); 
        this.saveToCloud(true);
    }

    openMarket() { 
        document.getElementById('market-modal').classList.remove('modal-hidden'); 
        this.updateUI(); 
    }
    
    closeMarket() { 
        document.getElementById('market-modal').classList.add('modal-hidden'); 
    }

    buySeed(type, amount, cost) {
        if (this.state.money >= cost) { 
            if (!this.state.unlocked[type]) { 
                alert("Suba de nível primeiro!"); 
                return; 
            } 
            this.state.money -= cost; 
            this.state.inventory[type] += amount; 
            this.spawnFX(window.innerWidth/2, 200, `+${amount} ${type.toUpperCase()}`, "#4CAF50"); 
            this.updateUI(); 
            this.saveToCloud(true); 
        } else { 
            alert("Dinheiro Insuficiente!"); 
        }
    }

    sellItem(type) {
        if (this.state.inventory[type] > 0) { 
            this.state.inventory[type]--; 
            this.state.siloCount--; 
            this.state.money += this.config[type].sellPrice; 
            this.spawnFX(window.innerWidth/2, 200, `+ $${this.config[type].sellPrice}`, "#FFD700"); 
            this.updateUI(); 
            this.saveToCloud(true); 
        } else { 
            alert(`Estoque vazio!`); 
        }
    }

    spawnFX(x, y, text, color) {
        const el = document.createElement('div'); 
        el.className = 'floating-feedback'; 
        el.innerText = text; 
        el.style.color = color;
        el.style.left = x + 'px'; 
        el.style.top = y + 'px'; 
        document.body.appendChild(el); 
        setTimeout(() => el.remove(), 1000);
    }

    // ==========================================
    // 10. INTERFACE E LOOP DE RENDERIZAÇÃO
    // ==========================================
    updateUI() {
        const setTxt = (id, text) => { 
            try { 
                const el = document.getElementById(id); 
                if (el) el.innerText = text; 
            } catch(e) {} 
        };
        
        setTxt('money', this.state.money); 
        setTxt('silo-text', `${this.state.siloCount}/${this.state.maxSilo}`); 
        setTxt('lvl', this.state.lvl);
        
        try { 
            const xpBar = document.getElementById('xp-bar'); 
            if (xpBar) xpBar.style.width = (this.state.xp / (this.state.lvl * 300)) * 100 + "%"; 
        } catch(e){}

        if (this.state.currentMission) {
            const m = this.state.currentMission; 
            const itemNames = { wheat: 'Trigos', carrot: 'Cenouras', apple: 'Maçãs', orange: 'Laranjas', corn: 'Milhos', egg: 'Ovos', milk: 'Leites', bacon: 'Bacons', fish: 'Peixes', bread: 'Pães', cheese: 'Queijos', silage: 'Silagens' };
            setTxt('mission-text', `Entregar ${m.qty} ${itemNames[m.type] || m.type}`);
        }

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
        setTxt('mkt-qty-silage', this.state.inventory.silage || 0); 
        setTxt('mkt-qty-fertilizer', this.state.inventory.fertilizer || 0); 
        setTxt('mkt-money', this.state.money); 
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));
        if (typeof TWEEN !== 'undefined' && time) TWEEN.update(time);
        this.animations.forEach(fn => fn()); 
        
        this.updateAnimals(); 
        this.updatePets();

        const now = Date.now();

        // === CLIMA ===
        if (now - this.weather.timer > 60000) { 
            this.weather.timer = now;
            this.weather.isRaining = Math.random() > 0.7; 
            const ind = document.getElementById('weather-indicator');
            if (this.weather.isRaining) {
                this.rainParticles.visible = true;
                if(ind) { ind.className = 'weather-rain'; ind.innerText = '🌧️ CHOVENDO (+3x Crescimento)'; }
            } else {
                this.rainParticles.visible = false;
                if(ind) { ind.className = 'weather-clear'; ind.innerText = '☀️ ENSOLARADO'; }
            }
        }

        if (this.weather.isRaining && this.rainParticles) {
            const positions = this.rainParticles.geometry.attributes.position.array;
            for(let i=1; i < positions.length; i+=3) {
                positions[i] -= 1.5; 
                if(positions[i] < 0) positions[i] = 80;
            }
            this.rainParticles.geometry.attributes.position.needsUpdate = true;
        }

        // === DIA E NOITE ===
        if (!this.weather.isRaining) this.timeOfDay += 0.0005; 
        const sunHeight = this.weather.isRaining ? 0.2 : Math.sin(this.timeOfDay);
        this.sun.position.y = sunHeight * 60; 
        this.sun.position.x = Math.cos(this.timeOfDay) * 60;

        if (sunHeight > 0 && !this.weather.isRaining) {
            this.scene.background.lerp(new THREE.Color(0x87CEEB), 0.05); 
            this.scene.fog.color.lerp(new THREE.Color(0x87CEEB), 0.05);
            this.sun.intensity = sunHeight * 1.3; 
            this.ambientLight.intensity = 0.55; 
            this.houseLight.intensity = 0; 
        } else {
            const darkColor = this.weather.isRaining ? 0x5a6e7f : 0x0B1D3A; 
            this.scene.background.lerp(new THREE.Color(darkColor), 0.05); 
            this.scene.fog.color.lerp(new THREE.Color(darkColor), 0.05);
            this.sun.intensity = 0; 
            this.ambientLight.intensity = 0.3; 
            this.houseLight.intensity = 2; 
        }

        // === TRATOR ===
        if (this.tractor.isDriving && this.tractor.mesh && this.tractor.target) {
            this.camera.position.x += (this.tractor.mesh.position.x + 50 - this.camera.position.x) * 0.05;
            this.camera.position.z += (this.tractor.mesh.position.z + 50 - this.camera.position.z) * 0.05;
            
            const dx = this.tractor.target.x - this.tractor.mesh.position.x;
            const dz = this.tractor.target.z - this.tractor.mesh.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist > 1) {
                this.tractor.mesh.position.x += (dx / dist) * 0.3;
                this.tractor.mesh.position.z += (dz / dist) * 0.3;
                this.tractor.mesh.rotation.y = Math.atan2(dx, dz);
                
                // Trator passa por cima e colhe!
                for (let i = this.plants.length - 1; i >= 0; i--) {
                    const p = this.plants[i];
                    if (p.progress >= 1 && !this.config[p.type].isTree) {
                        const pDist = Math.sqrt(Math.pow(p.mesh.position.x - this.tractor.mesh.position.x, 2) + Math.pow(p.mesh.position.z - this.tractor.mesh.position.z, 2));
                        if (pDist < 3) {
                            if (this.state.siloCount + this.config[p.type].yield <= this.state.maxSilo) {
                                this.state.inventory[p.type] += this.config[p.type].yield; 
                                this.state.siloCount += this.config[p.type].yield; 
                                this.state.xp += this.config[p.type].xp;
                                p.tile.userData.occupied = false; 
                                this.scene.remove(p.mesh); 
                                this.plants.splice(i, 1);
                                this.spawnFX(window.innerWidth/2, window.innerHeight/2, "🚜 COLHEITA!", "#FFD700"); 
                                this.updateUI(); 
                                this.checkLevel();
                            }
                        }
                    }
                }
            }
        }

        // === CONSTRUÇÕES ===
        for (let i = this.constructions.length - 1; i >= 0; i--) {
            const c = this.constructions[i];
            if (now - c.timer > c.duration) { 
                this.finishConstruction(c); 
                this.constructions.splice(i, 1); 
            } else { 
                c.mesh.rotation.y = Math.sin(now * 0.01) * 0.05; 
            }
        }

        // === FÁBRICAS ===
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
                    } else if (f.type === 'trench') {
                        const silageMesh = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 3), new THREE.MeshStandardMaterial({color: 0x689f38}));
                        silageMesh.position.set(0, 0.8, 0); silageMesh.name = "product_ready"; f.mesh.add(silageMesh);
                    } else if (f.type === 'recycler') {
                        const fertMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8), new THREE.MeshStandardMaterial({color: 0x2ecc71}));
                        fertMesh.position.set(0, 6, 0); fertMesh.name = "product_ready"; f.mesh.add(fertMesh);
                    }
                } else {
                    if (f.type === 'bakery') f.holeMesh.material.color.setHex(now % 500 < 250 ? 0xff5500 : 0xffaa00);
                }
            } else if (f.state === 'idle') { 
                const oldProd = f.mesh.getObjectByName("product_ready"); 
                if (oldProd) f.mesh.remove(oldProd); 
            }
        });

        // === PLANTAS ===
        const growthMult = this.weather.isRaining ? 3 : 1;
        this.plants.forEach(p => {
            if (p.progress < 1) {
                const conf = this.config[p.type]; 
                p.progress += (growthMult * 16) / conf.time; 
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

window.addEventListener('resize', () => {
    if (window.gameInstance && window.gameInstance.camera) {
        const aspect = window.innerWidth / window.innerHeight;
        window.gameInstance.camera.left = -18 * aspect; 
        window.gameInstance.camera.right = 18 * aspect;
        window.gameInstance.camera.top = 18; 
        window.gameInstance.camera.bottom = -18;
        window.gameInstance.camera.updateProjectionMatrix(); 
        window.gameInstance.renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

window.addEventListener('DOMContentLoaded', () => { 
    window.gameInstance = new NebulaFarmPro(); 
});
