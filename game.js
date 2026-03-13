/**
 * NEBULA FARM PRO - CORE ENGINE (CÓDIGO EXPANDIDO E ORGANIZADO)
 * Arquitetura Sênior de Software
 * - Escopo isolado e hierarquia de classes
 * - Raycasting com filtragem de profundidade para PC
 * - Sistema de persistência em nuvem robusto
 */

window.onerror = function(message, source, lineno) { 
    console.error(`[ENGINE CRASH PREVENTED]: ${message} at line ${lineno}`); 
    return false; 
};

// ==========================================
// 1. CONFIGURAÇÃO DO BANCO DE DADOS
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
} catch (error) {
    console.warn("Firebase offline. Inicializando modo local.", error);
}

// ==========================================
// 2. CLASSE PRINCIPAL DO JOGO
// ==========================================
class NebulaFarmPro {
    constructor() {
        // Core 3D
        this.scene = new THREE.Scene(); 
        this.camera = null; 
        this.renderer = null;
        
        // Entidades do Mundo
        this.grass = null; 
        this.lake = null; 
        this.tiles = []; 
        this.plants = []; 
        this.animations = [];
        this.animals = []; 
        this.pets = []; 
        this.npcs = []; 
        this.factories = []; 
        this.constructions = []; 
        this.obstacles = []; 
        this.decorations = []; 
        this.enclosureFloors = []; 
        
        // Controles de Input e Interação (Mouse/PC)
        this.isDragging = false; 
        this.activeDragTool = null; 
        this.lastTreePlantTime = 0; 
        this.isPanning = false; 
        this.panStart = { x: 0, y: 0 }; 
        this.hasPanned = false; 
        this.pendingBubble = null;
        
        // Sistema de Construção
        this.placementMode = false; 
        this.placementType = null; 
        this.placementCost = 0; 
        this.placementGhost = null; 
        this.placementGrid = null; 
        this.placementIsValid = false;
        
        // Ambiente e Jogador
        this.isFishing = false; 
        this.timeOfDay = 1.5; 
        this.currentUser = null; 
        this.weather = { isRaining: false, timer: 0 }; 
        this.rainParticles = null;
        this.tractor = { active: false, mesh: null, isDriving: false, target: null };

        // ESTADO INICIAL (Inventário zerado, pronto para comprar)
        this.state = {
            money: 1000, 
            xp: 0, 
            lvl: 1, 
            siloCount: 0, 
            maxSilo: 50,
            inventory: { 
                wheat: 0, carrot: 0, corn: 0, apple: 0, orange: 0, 
                egg: 0, milk: 0, bacon: 0, feed: 0, fish: 0, 
                bread: 0, cheese: 0, silage: 0, junk: 0, fertilizer: 0 
            },
            unlocked: { wheat: true, carrot: true, corn: false, apple: false, orange: false },
            enclosures: { coop: false, pigpen: false, corral: false, mill: false, bakery: false, dairy: false, trench: false, doghouse: false, recycler: false, tractor: false },
            gridSize: 6, 
            currentMission: null, 
            savedPlants: [], 
            savedDecorations: [] 
        };

        // Balanceamento de Culturas e Produtos
        this.config = {
            wheat: { color: 0xFFD700, time: 120000, yield: 2, sellPrice: 2, xp: 10, isTree: false }, 
            carrot: { color: 0xFF4500, time: 240000, yield: 2, sellPrice: 5, xp: 20, isTree: false }, 
            corn: { color: 0xFFEB3B, time: 600000, yield: 2, sellPrice: 12, xp: 50, isTree: false },
            apple: { isTree: true, leafColor: 0x27ae60, readyColor: 0xe74c3c, time: 180000, yield: 3, sellPrice: 10, xp: 30 }, 
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
    // 3. SISTEMA DE LOGIN E NUVEM
    // ==========================================
    init() {
        if (!auth) { 
            this.startGame(); 
            return; 
        }

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
                auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => console.error("Erro de Login:", e)); 
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
        
        let hasStarted = false; 
        const safetyTimeout = setTimeout(() => { 
            if(!hasStarted) { 
                hasStarted = true; 
                this.startGame(); 
            } 
        }, 5000);
        
        db.collection("fazendas").doc(this.currentUser.uid).get().then((doc) => {
            if (hasStarted) return;
            
            if (doc.exists) {
                try {
                    const data = doc.data(); 
                    
                    // Limpeza de plantas inválidas do save antigo
                    if (data.savedPlants) {
                        data.savedPlants = data.savedPlants.filter(p => this.config[p.type] !== undefined);
                    }
                    
                    this.state = { ...this.state, ...data }; 
                } catch (err) { 
                    console.error("Falha ao mesclar nuvem. Usando state padrão.", err); 
                }
            } else { 
                this.saveToCloud(true); 
            }
            
            hasStarted = true; 
            clearTimeout(safetyTimeout); 
            this.startGame();
        }).catch((e) => { 
            console.error("Falha de conexão com a nuvem.", e);
            if(!hasStarted) { 
                hasStarted = true; 
                clearTimeout(safetyTimeout); 
                this.startGame(); 
            } 
        });
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
        
        db.collection("fazendas").doc(this.currentUser.uid).set(this.state)
            .then(() => { 
                if (!isAutoSave) {
                    this.spawnFX(window.innerWidth / 2, 80, "💾 SALVO!", "#4CAF50"); 
                }
            })
            .catch((err) => {
                console.error("Erro ao salvar na nuvem:", err);
            });
    }

    // ==========================================
    // 4. INICIALIZAÇÃO DO RENDERIZADOR 3D
    // ==========================================
    startGame() {
        const loader = document.getElementById('loader'); 
        if (loader) { 
            loader.style.opacity = '0'; 
            setTimeout(() => loader.remove(), 500); 
        }
        
        try {
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
            
            // Loop de auto-save
            setInterval(() => { this.saveToCloud(true); }, 30000);
            
            // Inicia o Loop de Renderização
            requestAnimationFrame((time) => this.animate(time));
        } catch (err) { 
            console.error("Erro Crítico ao Montar a Engine:", err); 
        }
    }

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
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
        this.scene.add(this.ambientLight);
        
        this.sun = new THREE.DirectionalLight(0xffffff, 1.2); 
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
        const posArray = new Float32Array(1500 * 3);
        
        for(let i=0; i < 1500 * 3; i+=3) { 
            posArray[i] = (Math.random() - 0.5) * 150; 
            posArray[i+1] = Math.random() * 80; 
            posArray[i+2] = (Math.random() - 0.5) * 150; 
        }
        
        rainGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const rainMat = new THREE.PointsMaterial({color: 0xaaaaaa, size: 0.3, transparent: true, opacity: 0.6});
        
        this.rainParticles = new THREE.Points(rainGeo, rainMat);
        this.scene.add(this.rainParticles); 
        this.rainParticles.visible = false;
    }
    // ==========================================
    // 5. CONSTRUÇÃO DO MUNDO
    // ==========================================
    buildWorld() {
        // Gramado Base (Com Tag para o Raycaster)
        const grassGeo = new THREE.PlaneGeometry(3000, 3000);
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 1 });
        this.grass = new THREE.Mesh(grassGeo, grassMat);
        this.grass.rotation.x = -Math.PI / 2; 
        this.grass.receiveShadow = true; 
        this.grass.userData = { isGrass: true }; 
        this.scene.add(this.grass);
        
        // Registro de Colisões Fixas
        this.obstacles.push(
            { x: -22, z: -15, r: 8 }, 
            { x: 22, z: -10, r: 8 }, 
            { x: 35, z: 25, r: 14 }, 
            { x: 0, z: 0, r: 12 }, 
            { x: -22, z: 10, r: 6 }
        );  
        
        // Estruturas Padrão
        this.createBarn(-22, -15); 
        this.createFarmhouse(22, -10); 
        this.createLake(35, 25); 
        this.createWindmill(-22, 10); 
        
        // Função Auxiliar para Checar Obras Compradas
        const checkBuilt = (structureState, buttonId) => { 
            if (structureState && structureState.built) { 
                const btn = document.getElementById(buttonId); 
                if (btn) btn.style.display = 'none'; 
                return true; 
            } 
            return false; 
        };

        // Renderiza Fábricas e Cercados Comprados
        if (checkBuilt(this.state.enclosures.bakery, 'btn-bakery')) { this.createBakery(this.state.enclosures.bakery.x, this.state.enclosures.bakery.z); this.obstacles.push({ x: this.state.enclosures.bakery.x, z: this.state.enclosures.bakery.z, r: 5 }); }
        if (checkBuilt(this.state.enclosures.dairy, 'btn-dairy')) { this.createDairy(this.state.enclosures.dairy.x, this.state.enclosures.dairy.z); this.obstacles.push({ x: this.state.enclosures.dairy.x, z: this.state.enclosures.dairy.z, r: 5 }); }
        if (checkBuilt(this.state.enclosures.trench, 'btn-trench')) { this.createTrench(this.state.enclosures.trench.x, this.state.enclosures.trench.z); this.obstacles.push({ x: this.state.enclosures.trench.x, z: this.state.enclosures.trench.z, r: 5 }); }
        if (checkBuilt(this.state.enclosures.recycler, 'btn-recycler')) { this.createRecycler(this.state.enclosures.recycler.x, this.state.enclosures.recycler.z); this.obstacles.push({ x: this.state.enclosures.recycler.x, z: this.state.enclosures.recycler.z, r: 4 }); }
        if (checkBuilt(this.state.enclosures.doghouse, 'btn-doghouse')) { this.createDoghouse(this.state.enclosures.doghouse.x, this.state.enclosures.doghouse.z); this.obstacles.push({ x: this.state.enclosures.doghouse.x, z: this.state.enclosures.doghouse.z, r: 3 }); }
        if (checkBuilt(this.state.enclosures.tractor, 'btn-tractor')) { this.createTractor(this.state.enclosures.tractor.x, this.state.enclosures.tractor.z); this.obstacles.push({ x: this.state.enclosures.tractor.x, z: this.state.enclosures.tractor.z, r: 4 }); }
        if (checkBuilt(this.state.enclosures.coop, 'btn-coop')) { this.buildEnclosureOld('coop', this.state.enclosures.coop.x, this.state.enclosures.coop.z); this.obstacles.push({ x: this.state.enclosures.coop.x, z: this.state.enclosures.coop.z, r: 6 }); }
        if (checkBuilt(this.state.enclosures.pigpen, 'btn-pigpen')) { this.buildEnclosureOld('pigpen', this.state.enclosures.pigpen.x, this.state.enclosures.pigpen.z); this.obstacles.push({ x: this.state.enclosures.pigpen.x, z: this.state.enclosures.pigpen.z, r: 6 }); }
        if (checkBuilt(this.state.enclosures.corral, 'btn-corral')) { this.buildEnclosureOld('corral', this.state.enclosures.corral.x, this.state.enclosures.corral.z); this.obstacles.push({ x: this.state.enclosures.corral.x, z: this.state.enclosures.corral.z, r: 8 }); }

        // Renderiza a Horta
        this.renderGrid(); 
        
        // Restaura Plantações Salvas (Protegido por Try/Catch)
        if (this.state.savedPlants && this.state.savedPlants.length > 0) { 
            this.state.savedPlants.forEach(sp => { 
                try { 
                    if (this.config[sp.type] && this.config[sp.type].isTree) { 
                        this.restoreTree(sp); 
                    } else if (this.config[sp.type]) { 
                        this.restoreCrop(sp); 
                    } 
                } catch(e) { 
                    console.warn("Planta ignorada na restauração:", e); 
                }
            }); 
        }

        // Restaura Caminhos e Cercas
        if (this.state.savedDecorations && this.state.savedDecorations.length > 0) { 
            this.state.savedDecorations.forEach(sd => { 
                try { this.placeDecoration(sd.type, sd.x, sd.z, false); } catch(e) {} 
            }); 
        }

        // Gera os NPCs
        this.createNPC('Fazendeiro Zé', -10, 5, 0x2980b9, ["O dia está lindo para plantar!", "Cuidado onde pisa!"]);
        this.createNPC('Visitante Ana', 15, 10, 0x9b59b6, ["Vim comprar no mercado!", "Essa fazenda é gigante!"]);
        this.createNPC('Pescador Tião', 24, 25, 0xf1c40f, ["Peixe bom requer milho bom!", "O lago está calmo hoje."]);
        
        // Gera Pets e Pássaros
        this.createPet('dog', 15, -5); 
        this.createPet('cat', 18, -12);
        
        for (let i=0; i<5; i++) { 
            this.createBird(); 
        }

        // Árvores de Decoração Aleatórias no Mapa
        for (let i=0; i<45; i++) { 
            this.createTree((Math.random()-0.5)*200, (Math.random()-0.5)*200); 
        }
    }

    // ==========================================
    // SISTEMA DE POSICIONAMENTO E CONSTRUÇÃO
    // ==========================================
    buyBuilding(type, cost) {
        if (this.state.money < cost) { 
            alert("Dinheiro Insuficiente!"); 
            return; 
        }
        if (type !== 'path' && type !== 'fence') { 
            if (this.state.enclosures[type] && this.state.enclosures[type].built) { 
                alert("Você já possui esta construção!"); 
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
        
        document.getElementById('placement-ui').classList.remove('hidden');
        
        this.placementGrid = new THREE.GridHelper(200, 50, 0x000000, 0xffffff); 
        this.placementGrid.position.y = 0.2; 
        this.placementGrid.material.opacity = 0.2; 
        this.placementGrid.material.transparent = true; 
        this.scene.add(this.placementGrid);
        
        let ghostSize = (type === 'doghouse' || type === 'recycler' || type === 'tractor') ? 6 : (type === 'path' || type === 'fence' ? 4 : 8); 
        
        const ghostMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
        this.placementGhost = new THREE.Mesh(new THREE.BoxGeometry(ghostSize, 4, ghostSize), ghostMat);
        this.placementGhost.position.set(this.camera.position.x - 50, 2, this.camera.position.z - 50); 
        this.scene.add(this.placementGhost);
        
        this.validatePlacementPosition(this.placementGhost.position.x, this.placementGhost.position.z);
    }

    cancelPlacement() { 
        this.placementMode = false; 
        document.getElementById('placement-ui').classList.add('hidden'); 
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
            let r = (this.placementType === 'doghouse' || this.placementType === 'tractor' || this.placementType === 'recycler') ? 3 : 5;
            this.obstacles.push({ x: px, z: pz, r: r }); 
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
            for (const obs of this.obstacles) { 
                const dist = Math.sqrt(Math.pow(snapX - obs.x, 2) + Math.pow(snapZ - obs.z, 2));
                if (dist < (4 + obs.r)) { 
                    hasCollision = true; 
                    break; 
                } 
            } 
        }
        
        this.placementIsValid = !hasCollision; 
        this.placementGhost.material.color.setHex(hasCollision ? 0xff0000 : 0x00ff00);
        document.getElementById('btn-confirm-place').disabled = hasCollision;
    }

    placeDecoration(type, x, z, save = false) {
        let mesh = null;
        if (type === 'path') { 
            mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 4), new THREE.MeshStandardMaterial({color: 0x95a5a6})); 
            mesh.position.set(x, 0.05, z); 
        } else if (type === 'fence') {
            mesh = new THREE.Group();
            const pMat = new THREE.MeshStandardMaterial({color: 0x8B4513});
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3), pMat); p1.position.set(-1.5, 1, 0);
            const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3), pMat); p2.position.set(1.5, 1, 0);
            const cross = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 0.2), pMat); cross.position.set(0, 1.2, 0);
            mesh.add(p1, p2, cross); 
            mesh.position.set(x, 0, z);
        }
        
        if (mesh) { 
            this.scene.add(mesh); 
            this.decorations.push({ mesh, type, x, z }); 
            if (save) this.saveToCloud(true); 
        }
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
        
        const type = construction.type;
        const x = construction.x;
        const z = construction.z;

        if (type === 'bakery') this.createBakery(x, z); 
        else if (type === 'dairy') this.createDairy(x, z); 
        else if (type === 'trench') this.createTrench(x, z); 
        else if (type === 'recycler') this.createRecycler(x, z); 
        else if (type === 'doghouse') this.createDoghouse(x, z); 
        else if (type === 'tractor') this.createTractor(x, z); 
        else if (type === 'coop') this.buildEnclosureOld('coop', x, z); 
        else if (type === 'pigpen') this.buildEnclosureOld('pigpen', x, z); 
        else if (type === 'corral') this.buildEnclosureOld('corral', x, z);
        
        const btn = document.getElementById(`btn-${type}`); 
        if (btn) btn.style.display = 'none'; 
        this.updateUI();
    }

    // ==========================================
    // MODELOS 3D E FÁBRICAS
    // ==========================================
    createFarmhouse(x, z) {
        const house = new THREE.Group();
        const wallsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6), wallsMat); 
        walls.position.y = 2.5; walls.castShadow = true; walls.receiveShadow = true;
        
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.9 });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.5, 4), roofMat); 
        roof.position.y = 6.75; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
        
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });
        const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.5, 0.2), doorMat); 
        door.position.set(0, 1.75, 3.1); 
        
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8 })); 
        knob.position.set(0.6, 0, 0.15); door.add(knob); 
        
        const winMat = new THREE.MeshStandardMaterial({ color: 0x87CEEB, roughness: 0.1, metalness: 0.8 }); 
        const winBorderMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 }); 
        
        const criarJanela = (wx, wy, wz) => {
            const winGroup = new THREE.Group(); 
            const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.1), winMat);
            const bTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.2), winBorderMat); bTop.position.y = 0.85;
            const bBot = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.2), winBorderMat); bBot.position.y = -0.85;
            const bL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), winBorderMat); bL.position.x = -0.85;
            const bR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), winBorderMat); bR.position.x = 0.85;
            winGroup.add(glass, bTop, bBot, bL, bR); 
            winGroup.position.set(wx, wy, wz); 
            return winGroup;
        };
        
        const janelaEsq = criarJanela(-2.5, 3, 3.1); 
        const janelaDir = criarJanela(2.5, 3, 3.1);
        
        const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.9 });
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, 1.2), chimneyMat); 
        chimney.position.set(-2, 6, -1); chimney.castShadow = true;
        
        house.add(walls, roof, door, janelaEsq, janelaDir, chimney); 
        house.position.set(x, 0, z); 
        house.rotation.y = -Math.PI / 6; 
        
        house.children.forEach(c => { c.userData = { isStructure: true, parentRef: house }; });
        this.scene.add(house);
    }

    createBarn(x, z) {
        const barn = new THREE.Group();
        
        const wallsMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.9 });
        const walls = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), wallsMat);
        walls.position.y = 3; walls.castShadow = true; walls.receiveShadow = true;
        
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
        const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 4, 5), roofMat);
        roof.position.y = 8; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
        
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const door = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.2), doorMat);
        door.position.set(0, 2, 4.1);
        
        const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 0.3), crossMat);
        cross1.rotation.z = Math.PI / 6; cross1.position.set(0, 2, 4.15);
        const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 0.3), crossMat);
        cross2.rotation.z = -Math.PI / 6; cross2.position.set(0, 2, 4.15);
        
        barn.add(walls, roof, door, cross1, cross2);
        barn.position.set(x, 0, z);
        
        barn.children.forEach(c => { c.userData = { isStructure: true, parentRef: barn }; });
        this.scene.add(barn);
    }

    createRecycler(x, z) {
        const recGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({color: 0x2ecc71})); 
        base.position.y = 1.5; base.castShadow = true;
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2, 1, 2), new THREE.MeshStandardMaterial({color: 0x7f8c8d})); 
        funnel.position.y = 4; funnel.castShadow = true;
        
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
        body.position.y = 1.5; body.castShadow = true;
        
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.5), new THREE.MeshStandardMaterial({color: 0xffffff, transparent: true, opacity: 0.5})); 
        cab.position.set(0, 3, -1);
        
        const roof = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 1.8), bodyMat); 
        roof.position.set(0, 3.8, -1);
        
        const w1 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 16), tireMat); w1.rotation.z = Math.PI/2; w1.position.set(1.2, 1, -1);
        const w2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.5, 16), tireMat); w2.rotation.z = Math.PI/2; w2.position.set(-1.2, 1, -1);
        const w3 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16), tireMat); w3.rotation.z = Math.PI/2; w3.position.set(1.2, 0.6, 1.5);
        const w4 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16), tireMat); w4.rotation.z = Math.PI/2; w4.position.set(-1.2, 0.6, 1.5);
        
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
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.5), wallMat); w1.position.set(0, 1, -2); w1.castShadow = true;
        const w2 = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.5), wallMat); w2.position.set(0, 1, 2); w2.castShadow = true;
        const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 4), new THREE.MeshStandardMaterial({color: 0x4e342e})); floor.position.y = 0.25;
        
        trenchGroup.add(w1, w2, floor); 
        trenchGroup.position.set(x, 0, z);
        trenchGroup.children.forEach(c => c.userData = { isFactory: true, parentRef: trenchGroup, type: 'trench' }); 
        
        this.scene.add(trenchGroup);
        this.factories.push({ mesh: trenchGroup, type: 'trench', state: 'idle', timer: 0, duration: 18000, indicator: floor });
    }
