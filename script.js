// =========================================================================
// SCRIPT.JS COMPLETO - JOGO DEFENSOR DA REDE
// Versão com CORREÇÃO do Botão Iniciar Partida e CORREÇÃO do Preview de Alcance
// =========================================================================

// =========================================================================
// SETUP INICIAL
// =========================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Elementos da UI
const resourcesEl = document.getElementById('resources');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const waveEl = document.getElementById('wave');
const startWaveBtn = document.getElementById('start-wave-btn');
const towerButtons = document.querySelectorAll('.tower-button');
const speedButtons = document.querySelectorAll('.speed-button');

// Telas de Jogo
const mainMenuScreen = document.getElementById('main-menu-screen');
const modeSelectScreen = document.getElementById('mode-select-screen');
const howToPlayScreen = document.getElementById('how-to-play-screen');
const gameOverScreen = document.getElementById('game-over-screen');

// Botões dos Modais
const menuPlayBtn = document.getElementById('menu-play-btn');
const menuHowToPlayBtn = document.getElementById('menu-how-to-play-btn');
const accessibilityToggle = document.getElementById('accessibility-toggle');
const startNormalBtn = document.getElementById('start-normal');
const startAprendizBtn = document.getElementById('start-aprendiz');
const howToPlayCloseBtn = document.getElementById('how-to-play-close-btn');
const restartBtn = document.getElementById('restart-btn');
const pauseBtn = document.getElementById('pause-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');

// Elementos do Menu de Contexto
const towerContextMenu = document.getElementById('tower-context-menu');
const contextCloseBtn = document.getElementById('context-close-btn');
const contextLevel = document.getElementById('context-level');
const contextUpgradeBtn = document.getElementById('context-upgrade-btn');
const contextSellBtn = document.getElementById('context-sell-btn');


// Configurações do Jogo
const TOWER_COSTS = { Firewall: 40, Router: 30, Antivirus: 50, Criptografador: 60 };
// Adicionada constante TOWER_RANGES para melhor organização
const TOWER_RANGES = { Firewall: 120, Router: 90, Antivirus: 100, Criptografador: 110 };
const UPGRADE_COST_BASE = 80;
const SELL_PERCENTAGE = 0.7; // Vende por 70% do valor investido
const NEXT_WAVE_TIMER = 15;
const RETRANSMISSION_COST = 1;
const TOWER_PLACEMENT_RADIUS = 40;
const PATH_HITBOX_WIDTH = 35;

// Coordenadas dos caminhos (1120x700)
const LEVELS = {
    1: { path: [ { x: 0, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 550 }, { x: 820, y: 550 }, { x: 820, y: 250 }, { x: 1120, y: 250 } ], waves: [ { packet: 10, virus: 3, worm: 0, ransomware: 0, corruptor: 0 }, { packet: 12, virus: 5, worm: 2, ransomware: 0, corruptor: 1 }, { packet: 15, virus: 8, worm: 4, ransomware: 1, corruptor: 2 } ] },
    2: { path: [ { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 600 }, { x: 200, y: 600 }, { x: 200, y: 400 }, { x: 920, y: 400 }, { x: 920, y: 700 } ], waves: [ { packet: 15, virus: 5, worm: 8, ransomware: 2, corruptor: 3 }, { packet: 20, virus: 8, worm: 10, ransomware: 4, corruptor: 4 }, { packet: 25, virus: 12, worm: 15, ransomware: 6, corruptor: 5 } ] }
};

let currentPath;
let gameState;
let difficultyMultiplier = 1;

const baseGameState = {
    score: 0, lives: 20, level: 1, wave: 1,
    entities: [], towers: [], projectiles: [], enemyProjectiles: [], floatingTexts: [],
    selectedTowerType: null, selectedTower: null,
    mouse: { x: 0, y: 0 },
    keyCursor: { x: canvas.width / 2, y: canvas.height / 2, speed: 15 },
    waveInProgress: false, gameOver: false, gameWon: false, isPaused: false,
    isGameStarted: false, gameSpeed: 1,
    isAccessibilityMode: false,
    scoreAtWaveStart: 0, nextWaveInterval: null
};

function setupInitialState(mode, isAccessible) {
    if (mode === 'aprendiz') {
        difficultyMultiplier = 0.75;
        gameState = { resources: 200, ...baseGameState };
    } else {
        difficultyMultiplier = 1.0;
        gameState = { resources: 120, ...baseGameState };
    }
    gameState.gameMode = mode;
    gameState.isAccessibilityMode = isAccessible;
    currentPath = LEVELS[gameState.level].path;
    updateUI();
    gameState.isGameStarted = true;
}

gameState = null; 

// =========================================================================
// CLASSES DO JOGO (COM ACESSIBILIDADE CONDICIONAL)
// =========================================================================
class Entity {
    constructor(speed, health, resourceReward, livesPenalty = 1) {
        this.baseSpeed = speed;
        this.speed = speed * difficultyMultiplier;
        this.x = currentPath[0].x - 20; this.y = currentPath[0].y;
        this.pathIndex = 1; this.health = health;
        this.maxHealth = health; this.resourceReward = resourceReward;
        this.livesPenalty = livesPenalty; this.effects = {};
    }
    move() {
        if (this.pathIndex >= currentPath.length) return;
        const target = currentPath[this.pathIndex];
        const dx = target.x - this.x; const dy = target.y - this.y;
        const distance = Math.hypot(dx, dy);
        let currentSpeed = this.speed * gameState.gameSpeed;
        if (this.effects.speedBoost) currentSpeed *= this.effects.speedBoost.multiplier;
        if (this.effects.slow) currentSpeed *= this.effects.slow.multiplier;
        if (distance < currentSpeed) { this.pathIndex++; } 
        else { this.x += (dx / distance) * currentSpeed; this.y += (dy / distance) * currentSpeed; }
    }
    drawHealthBar() { if (this.health < this.maxHealth) { ctx.fillStyle = '#ff4757'; ctx.fillRect(this.x - 12, this.y - 22, 24, 5); ctx.fillStyle = '#2ed573'; ctx.fillRect(this.x - 12, this.y - 22, 24 * (this.health / this.maxHealth), 5); } }
    drawHitEffect() { if (this.effects.isHit) { ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; this.drawShape(true); } }
    update() { for (const key in this.effects) { this.effects[key].duration--; if (this.effects[key].duration <= 0) delete this.effects[key]; } if (!gameState.isPaused) this.move(); this.draw(); }
}

class Packet extends Entity {
    constructor() { super(1.5, 20, 0); this.color = '#2ecc71'; }
    drawShape(isHitEffect = false) { if (!isHitEffect) ctx.fillStyle = this.effects.shielded ? '#add8e6' : this.color; ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.fill(); }
    draw() { this.drawShape(); this.drawHitEffect(); this.drawHealthBar(); }
}

class Virus extends Entity {
    constructor() { super(1, 60, 5); this.color = '#e74c3c'; }
    drawShape(isHitEffect = false) {
        if (!isHitEffect) ctx.fillStyle = this.color;
        if (gameState && gameState.isAccessibilityMode) {
            ctx.beginPath(); ctx.moveTo(this.x, this.y - 10); ctx.lineTo(this.x - 10, this.y + 7); ctx.lineTo(this.x + 10, this.y + 7); ctx.closePath(); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.fill();
        }
    }
    draw() { this.drawShape(); this.drawHitEffect(); this.drawHealthBar(); }
}

class Worm extends Entity {
    constructor() { super(2.5, 30, 8); this.color = '#9b59b6'; }
    drawShape(isHitEffect = false) {
        if (!isHitEffect) ctx.fillStyle = this.color;
        if (gameState && gameState.isAccessibilityMode) {
            ctx.beginPath(); ctx.moveTo(this.x, this.y - 12); ctx.lineTo(this.x + 10, this.y); ctx.lineTo(this.x, this.y + 12); ctx.lineTo(this.x - 10, this.y); ctx.closePath(); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.fill();
        }
    }
    draw() { this.drawShape(); this.drawHitEffect(); this.drawHealthBar(); }
}

class Ransomware extends Entity {
    constructor() { super(0.8, 150, 20, 5); this.color = '#34495e'; }
    drawShape(isHitEffect = false) {
        if (!isHitEffect) ctx.fillStyle = this.color;
        if (gameState && gameState.isAccessibilityMode) {
            const s = 12; ctx.beginPath(); for (let i = 0; i < 6; i++) { ctx.lineTo(this.x + s * Math.cos(i * 2 * Math.PI / 6), this.y + s * Math.sin(i * 2 * Math.PI / 6)); } ctx.closePath(); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, 12, 0, Math.PI * 2); ctx.fill();
        }
    }
    draw() { this.drawShape(); this.drawHitEffect(); this.drawHealthBar(); }
}

class Corruptor extends Entity {
    constructor() {
        super(0.9, 80, 15); // Velocidade base 0.9
        this.color = '#f1c40f'; this.range = 150;
        this.attackSpeed = 120; this.cooldown = 0;
    }
    findTarget() { return gameState.entities.find(e => e instanceof Packet && Math.hypot(this.x - e.x, this.y - e.y) <= this.range); }
    update() { 
        if (gameState.isPaused) { this.draw(); return; } 
        if (this.cooldown > 0) this.cooldown -= gameState.gameSpeed; 
        
        const target = this.findTarget(); 
        if (target) {
            this.speed = this.baseSpeed * difficultyMultiplier * 0.4; // Anda mais devagar ao atirar
            if (this.cooldown <= 0) { 
                gameState.enemyProjectiles.push(new CorruptingProjectile(this.x, this.y, target)); 
                this.cooldown = this.attackSpeed; 
            } 
        } else { 
            this.speed = this.baseSpeed * difficultyMultiplier; // Velocidade normal
        } 
        this.move(); 
        this.draw(); 
    }
    drawShape(isHitEffect = false) {
        if (!isHitEffect) ctx.fillStyle = this.color;
        if (gameState && gameState.isAccessibilityMode) {
            ctx.beginPath(); ctx.moveTo(this.x, this.y - 12); ctx.lineTo(this.x + 12, this.y); ctx.lineTo(this.x, this.y + 12); ctx.lineTo(this.x - 12, this.y); ctx.closePath(); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.fill();
        }
    }
    draw() { this.drawShape(); this.drawHitEffect(); this.drawHealthBar(); }
}

class Tower {
    constructor(x, y, range, cost) {
        this.x = x; this.y = y; this.range = range; this.cost = cost;
        this.level = 1; this.cooldown = 0;
        this.totalCostInvested = cost;
    }
    drawRange() { const style = (this === gameState.selectedTower) ? 'rgba(255, 255, 0, 0.4)' : 'rgba(255, 255, 255, 0.2)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2); ctx.fillStyle = style; ctx.fill(); }
    upgrade() {
        const cost = this.getUpgradeCost();
        if (gameState.resources >= cost) {
            gameState.resources -= cost;
            this.level++;
            this.range *= 1.1;
            this.totalCostInvested += cost;
            return true;
        }
        return false;
    }
    getUpgradeCost() { return Math.floor(UPGRADE_COST_BASE * Math.pow(1.5, this.level -1)); }
    getSellPrice() { return Math.floor(this.totalCostInvested * SELL_PERCENTAGE); }
    update() { if (!gameState.isPaused && this.cooldown > 0) this.cooldown -= gameState.gameSpeed; this.draw(); this.drawRange(); }
}

class Firewall extends Tower {
    constructor(x, y) { super(x, y, TOWER_RANGES.Firewall, TOWER_COSTS.Firewall); this.attackSpeed = 60; this.damage = 10; }
    draw() { ctx.fillStyle = '#f39c12'; ctx.fillRect(this.x - 15, this.y - 15, 30, 30); ctx.fillStyle = '#e67e22'; ctx.fillRect(this.x - 10, this.y - 10, 20, 20); }
    upgrade() { if (super.upgrade()) { this.damage += 5; this.attackSpeed = Math.max(20, this.attackSpeed - 5); } }
    update() { super.update(); if (gameState.isPaused) return; const target = gameState.entities.find(e => !(e instanceof Packet) && Math.hypot(this.x - e.x, this.y - e.y) <= this.range); if (target && this.cooldown <= 0) { gameState.projectiles.push(new Projectile(this.x, this.y, target, this.damage)); this.cooldown = this.attackSpeed; playSound('shoot'); } }
}

class Router extends Tower {
    constructor(x, y) { super(x, y, TOWER_RANGES.Router, TOWER_COSTS.Router); }
    draw() { ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.arc(this.x, this.y, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2980b9'; ctx.beginPath(); ctx.arc(this.x, this.y, 12, 0, Math.PI * 2); ctx.fill(); }
    update() { super.update(); if (gameState.isPaused) return; gameState.entities.forEach(e => { if (e instanceof Packet && Math.hypot(this.x - e.x, this.y - e.y) <= this.range) { e.effects.speedBoost = { multiplier: 1.5, duration: 10 }; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(e.x, e.y); ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'; ctx.stroke(); } }); }
}

class Antivirus extends Tower {
    constructor(x, y) { super(x, y, TOWER_RANGES.Antivirus, TOWER_COSTS.Antivirus); }
    draw() { ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(this.x, this.y, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(this.x, this.y, 12, 0, Math.PI * 2); ctx.fill(); }
    update() { super.update(); if (gameState.isPaused) return; gameState.entities.forEach(e => { if (!(e instanceof Packet) && Math.hypot(this.x - e.x, this.y - e.y) <= this.range) { e.effects.slow = { multiplier: 0.6, duration: 10 }; } }); }
}

class Criptografador extends Tower {
    constructor(x,y) { super(x, y, TOWER_RANGES.Criptografador, TOWER_COSTS.Criptografador); }
    draw() { ctx.fillStyle = '#bdc3c7'; ctx.fillRect(this.x - 15, this.y - 15, 30, 30); ctx.fillStyle = '#95a5a6'; ctx.fillRect(this.x - 10, this.y - 10, 20, 20); }
    update() { super.update(); if (gameState.isPaused) return; gameState.entities.forEach(e => { if (e instanceof Packet && Math.hypot(this.x - e.x, this.y - e.y) <= this.range) { e.effects.shielded = { duration: 10 }; } }); }
}

class Projectile {
    constructor(x, y, target, damage) { this.x = x; this.y = y; this.target = target; this.baseSpeed = 6; this.damage = damage; }
    update() { const dx = this.target.x - this.x; const dy = this.target.y - this.y; const distance = Math.hypot(dx, dy); const speed = this.baseSpeed * gameState.gameSpeed; if (distance < speed || this.target.health <= 0) { if (this.target.health > 0) { this.target.effects.isHit = { duration: 5 }; if (!this.target.effects.shielded) { this.target.health -= this.damage; playSound('hit'); } else { delete this.target.effects.shielded; } } return true; } this.x += (dx / distance) * speed; this.y += (dy / distance) * speed; this.draw(); return false; }
    draw() { ctx.fillStyle = 'cyan'; ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2); ctx.fill(); }
}

class CorruptingProjectile {
    constructor(x, y, target) { this.x = x; this.y = y; this.target = target; this.baseSpeed = 4; this.damage = 10; }
    update() { const dx = this.target.x - this.x; const dy = this.target.y - this.y; const distance = Math.hypot(dx, dy); const speed = this.baseSpeed * gameState.gameSpeed; if (distance < speed || this.target.health <= 0) { if (this.target.health > 0) { this.target.effects.isHit = { duration: 5 }; if (!this.target.effects.shielded) { this.target.health -= this.damage; playSound('corrupt'); } else { delete this.target.effects.shielded; } } return true; } this.x += (dx / distance) * speed; this.y += (dy / distance) * speed; this.draw(); return false; }
   draw() { ctx.fillStyle = 'magenta'; ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); ctx.fill(); }
}

class FloatingText {
    constructor(text, x, y, color = 'gold') { this.text = text; this.x = x; this.y = y; this.color = color; this.duration = 80; this.opacity = 1; }
    update() { if (!gameState.isPaused) { this.y -= 0.5 * gameState.gameSpeed; this.duration--; this.opacity -= 1 / 80; } }
    draw() { ctx.save(); ctx.globalAlpha = this.opacity; ctx.fillStyle = this.color; ctx.font = '20px Roboto Mono'; ctx.fillText(this.text, this.x, this.y); ctx.restore(); }
}

// =========================================================================
// LÓGICA DO JOGO E MENU DE CONTEXTO
// =========================================================================
function isLocationOnPath(x, y) {
    if (!currentPath) return false;
    ctx.beginPath();
    ctx.moveTo(currentPath[0].x, currentPath[0].y);
    for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
    }
    ctx.lineWidth = PATH_HITBOX_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx.isPointInStroke(x, y);
}

function placeTower(x, y) {
    if (!gameState.selectedTowerType) return;
    
    hideTowerContextMenu();

    if (isLocationOnPath(x, y)) {
        alert("Você não pode construir sobre o caminho!");
        return;
    }
    for (const tower of gameState.towers) {
        const distance = Math.hypot(x - tower.x, y - tower.y);
        if (distance < TOWER_PLACEMENT_RADIUS) {
            alert("Você não pode construir tão perto de outra torre!");
            return;
        }
    }
    const cost = TOWER_COSTS[gameState.selectedTowerType];
    if (gameState.resources < cost) {
        alert("Recursos insuficientes!");
        return;
    }
    gameState.resources -= cost;
    let newTower;
    if (gameState.selectedTowerType === 'Firewall') newTower = new Firewall(x, y);
    else if (gameState.selectedTowerType === 'Router') newTower = new Router(x, y);
    else if (gameState.selectedTowerType === 'Antivirus') newTower = new Antivirus(x, y);
    else if (gameState.selectedTowerType === 'Criptografador') newTower = new Criptografador(x, y);
    gameState.towers.push(newTower);
    playSound('place');
    towerButtons.forEach(btn => btn.classList.remove('selected'));
    gameState.selectedTowerType = null;
}

function showTowerContextMenu(event, tower) {
    gameState.selectedTower = tower;
    
    contextLevel.textContent = tower.level;
    const upgradeCost = tower.getUpgradeCost();
    contextUpgradeBtn.textContent = `Melhorar (Custo: ${upgradeCost})`;
    contextUpgradeBtn.disabled = gameState.resources < upgradeCost;
    
    const sellPrice = tower.getSellPrice();
    contextSellBtn.textContent = `Vender (Ganho: ${sellPrice})`;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    let menuX = x + 20;
    let menuY = y - 20;
    
    towerContextMenu.style.top = `${menuY + rect.top}px`;
    towerContextMenu.style.left = `${menuX + rect.left}px`;
    
    towerContextMenu.classList.remove('hidden');

    const menuRect = towerContextMenu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        towerContextMenu.style.left = `${x - menuRect.width - 20 + rect.left}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
        towerContextMenu.style.top = `${y - menuRect.height + 20 + rect.top}px`;
    }
}

function hideTowerContextMenu() {
    towerContextMenu.classList.add('hidden');
    gameState.selectedTower = null;
}

function handleUpgradeClick() {
    if (!gameState.selectedTower) return;
    
    const tower = gameState.selectedTower;
    if (tower.upgrade()) {
        contextLevel.textContent = tower.level;
        const upgradeCost = tower.getUpgradeCost();
        contextUpgradeBtn.textContent = `Melhorar (Custo: ${upgradeCost})`;
        contextUpgradeBtn.disabled = gameState.resources < upgradeCost;
        const sellPrice = tower.getSellPrice();
        contextSellBtn.textContent = `Vender (Ganho: ${sellPrice})`;
    } else {
        alert("Recursos insuficientes para melhorar!");
        contextUpgradeBtn.disabled = true;
    }
    updateUI();
}

function handleSellClick() {
    if (!gameState.selectedTower) return;
    
    const tower = gameState.selectedTower;
    const sellPrice = tower.getSellPrice();
    gameState.resources += sellPrice;
    
    const towerIndex = gameState.towers.indexOf(tower);
    if (towerIndex > -1) {
        gameState.towers.splice(towerIndex, 1);
    }
    
    hideTowerContextMenu();
    updateUI();
}


function handleEntities() { for (let i = gameState.entities.length - 1; i >= 0; i--) { const entity = gameState.entities[i]; entity.update(); if (!gameState.isPaused) { if (entity.pathIndex >= currentPath.length) { if (entity instanceof Packet) gameState.score++; else gameState.lives -= entity.livesPenalty; gameState.entities.splice(i, 1); } else if (entity.health <= 0) { if (entity instanceof Packet) { if (gameState.resources >= RETRANSMISSION_COST) { gameState.resources -= RETRANSMISSION_COST; gameState.entities.push(new Packet()); gameState.floatingTexts.push(new FloatingText("Retransmitindo...", 20, 50, 'orange')); } } else { gameState.resources += entity.resourceReward; } gameState.entities.splice(i, 1); } } } }
function updateUI() { if (!gameState || !gameState.isGameStarted) return; resourcesEl.innerHTML = `${gameState.resources} 💰`; scoreEl.innerHTML = `${gameState.score} ⭐`; livesEl.innerHTML = `${gameState.lives}/20 ❤️`; levelEl.textContent = gameState.level; const wavesInLevel = LEVELS[gameState.level].waves.length; waveEl.textContent = gameState.wave > wavesInLevel ? `Final` : gameState.wave; }
function drawPath() { ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)'; ctx.lineWidth = PATH_HITBOX_WIDTH; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(currentPath[0].x, currentPath[0].y); for (let i = 1; i < currentPath.length; i++) ctx.lineTo(currentPath[i].x, currentPath[i].y); ctx.stroke(); ctx.lineWidth = 1; }
function startNextWaveCountdown() { let countdown = NEXT_WAVE_TIMER; startWaveBtn.disabled = false; startWaveBtn.textContent = `▶ ONDA (${countdown}s)`; gameState.nextWaveInterval = setInterval(() => { if (!gameState.isPaused) { countdown--; if (countdown > 0) { startWaveBtn.textContent = `▶ ONDA (${countdown}s)`; } else { clearInterval(gameState.nextWaveInterval); gameState.nextWaveInterval = null; startWave(); } } }, 1000 / gameState.gameSpeed); }
function handleWaveCompletion() { const packetsThisWave = gameState.score - gameState.scoreAtWaveStart; const bonusResources = (packetsThisWave * 2) + gameState.lives; if (bonusResources > 0) { gameState.resources += bonusResources; gameState.floatingTexts.push(new FloatingText(`+${bonusResources} Recursos!`, canvas.width / 2 - 100, canvas.height / 2)); } gameState.waveInProgress = false; gameState.wave++; startNextWaveCountdown(); }
function startWave() { if (gameState.nextWaveInterval) { clearInterval(gameState.nextWaveInterval); gameState.nextWaveInterval = null; } gameState.scoreAtWaveStart = gameState.score; const levelConf = LEVELS[gameState.level]; if (gameState.wave > levelConf.waves.length) { if (gameState.level < Object.keys(LEVELS).length) { gameState.level++; gameState.wave = 1; currentPath = LEVELS[gameState.level].path; gameState.towers = []; alert(`Nível ${gameState.level}! Prepare-se para um novo desafio.`); } else { gameState.gameWon = true; return; } } gameState.waveInProgress = true; startWaveBtn.textContent = 'EM ANDAMENTO...'; startWaveBtn.disabled = true; const waveConfig = levelConf.waves[gameState.wave - 1]; let toSpawn = []; for(let i=0; i<waveConfig.packet; i++) toSpawn.push('Packet'); for(let i=0; i<waveConfig.virus; i++) toSpawn.push('Virus'); for(let i=0; i<waveConfig.worm; i++) toSpawn.push('Worm'); for(let i=0; i<waveConfig.ransomware; i++) toSpawn.push('Ransomware'); for(let i=0; i<waveConfig.corruptor; i++) toSpawn.push('Corruptor'); toSpawn = toSpawn.sort(() => Math.random() - 0.5); let spawnIndex = 0; const spawnInterval = setInterval(() => { if (!gameState.isPaused) { if (spawnIndex < toSpawn.length) { const type = toSpawn[spawnIndex]; if (type === 'Packet') gameState.entities.push(new Packet()); else if (type === 'Virus') gameState.entities.push(new Virus()); else if (type === 'Worm') gameState.entities.push(new Worm()); else if (type === 'Ransomware') gameState.entities.push(new Ransomware()); else if (type === 'Corruptor') gameState.entities.push(new Corruptor()); spawnIndex++; } else { clearInterval(spawnInterval); const checkWaveEnd = setInterval(() => { if (gameState.entities.length === 0 && !gameState.gameOver) { clearInterval(checkWaveEnd); handleWaveCompletion(); } }, 1000 / gameState.gameSpeed); } } }, 700 / gameState.gameSpeed); }
function checkGameOver() { if (gameState.lives <= 0 && !gameState.gameOver) { gameState.gameOver = true; hideTowerContextMenu(); gameOverTitle.textContent = "Fim de Jogo"; gameOverMsg.textContent = "Os vírus sobrecarregaram a rede. Tente novamente!"; gameOverScreen.classList.remove('hidden'); playSound('gameover'); } if (gameState.gameWon && gameState.entities.length === 0 && !gameState.gameOver) { gameState.gameOver = true; hideTowerContextMenu(); gameOverTitle.textContent = "Vitória!"; gameOverMsg.textContent = `Você defendeu a rede com sucesso! Pontuação Final: ${gameState.score}`; gameOverScreen.classList.remove('hidden'); } }
function drawKeyCursor() { if (gameState.isAccessibilityMode && gameState.selectedTowerType) { const x = gameState.keyCursor.x; const y = gameState.keyCursor.y; ctx.strokeStyle = 'yellow'; ctx.lineWidth = 3; ctx.strokeRect(x - 15, y - 15, 30, 30); const range = TOWER_RANGES[gameState.selectedTowerType]; ctx.beginPath(); ctx.arc(x, y, range, 0, Math.PI * 2); const onPath = isLocationOnPath(x, y); const onTower = gameState.towers.some(t => Math.hypot(x - t.x, y - t.y) < TOWER_PLACEMENT_RADIUS); ctx.fillStyle = (onPath || onTower) ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 255, 0.2)'; ctx.fill(); } }
function drawLowHealthWarning() { if (gameState.lives > 0 && gameState.lives <= 5) { if (Date.now() % 1000 < 500) { ctx.save(); ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, canvas.width, canvas.height); ctx.restore(); } } }
function togglePause(pauseState) { if (!gameState || gameState.gameOver) return; gameState.isPaused = pauseState; if (gameState.isPaused) { pauseBtn.textContent = "RETOMAR (P)"; backToMenuBtn.classList.remove('hidden'); hideTowerContextMenu(); } else { pauseBtn.textContent = "PAUSAR (P)"; backToMenuBtn.classList.add('hidden'); } }
function drawPauseScreen() { if (gameState.isPaused) { ctx.save(); ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'white'; ctx.font = 'bold 60px Roboto Mono'; ctx.textAlign = 'center'; ctx.fillText('PAUSADO', canvas.width / 2, canvas.height / 2); ctx.font = '20px Roboto Mono'; ctx.fillText('Pressione (P) para retomar', canvas.width / 2, (canvas.height / 2) + 40); ctx.restore(); } }

// =========================================================================
// GAME LOOP PRINCIPAL
// =========================================================================
function gameLoop() {
    if (!gameState || !gameState.isGameStarted) { 
        requestAnimationFrame(gameLoop); 
        return; 
    }
    if (gameState.gameOver) { 
        requestAnimationFrame(gameLoop);
        return; 
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPath();
    gameState.towers.forEach(t => t.update());
    
    if (!gameState.isPaused) {
        for (let i = gameState.projectiles.length - 1; i >= 0; i--) { if (gameState.projectiles[i].update()) gameState.projectiles.splice(i, 1); }
        for (let i = gameState.enemyProjectiles.length - 1; i >= 0; i--) { if (gameState.enemyProjectiles[i].update()) gameState.enemyProjectiles.splice(i, 1); }
    }
    handleEntities();
    for (let i = gameState.floatingTexts.length - 1; i >= 0; i--) { const text = gameState.floatingTexts[i]; text.update(); text.draw(); if (text.duration <= 0) gameState.floatingTexts.splice(i, 1); }
    
    // =======================================================
    // !! INÍCIO DA CORREÇÃO DO PREVIEW DE ALCANCE !!
    // =======================================================
    if (gameState.selectedTowerType) { 
        // 1. Pega os dados do preview (Mouse)
        const mouseX = gameState.mouse.x;
        const mouseY = gameState.mouse.y;
        const range = TOWER_RANGES[gameState.selectedTowerType]; 
        
        // 2. Faz as VERIFICAÇÕES LÓGICAS primeiro
        const onPath = isLocationOnPath(mouseX, mouseY);
        const onTower = gameState.towers.some(t => Math.hypot(mouseX - t.x, mouseY - t.y) < TOWER_PLACEMENT_RADIUS);
        
        // 3. Define a cor baseada nas verificações
        const previewColor = (onPath || onTower) ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 255, 0.2)';
        
        // 4. Agora, DESENHA o preview do mouse com segurança
        ctx.fillStyle = previewColor;
        ctx.beginPath(); 
        ctx.arc(mouseX, mouseY, range, 0, Math.PI * 2); 
        ctx.fill(); 
        
        // 5. Desenha o preview do TECLADO (KeyCursor) por cima se o modo de acessibilidade estiver ativo
        drawKeyCursor(); 
    }
    // =======================================================
    // !! FIM DA CORREÇÃO DO PREVIEW DE ALCANCE !!
    // =======================================================
    
    drawLowHealthWarning();
    updateUI(); checkGameOver();
    drawPauseScreen();
    
    requestAnimationFrame(gameLoop);
}

// =========================================================================
// EVENT LISTENERS E LÓGICA DE INÍCIO
// =========================================================================
function playSound(id) { try { const sound = document.getElementById(`sound-${id}`); sound.currentTime = 0; sound.volume = 0.5; sound.play(); } catch (e) {} }

/**
 * ESTA É A FUNÇÃO CORRIGIDA que inicia o jogo.
 */
function startGame(mode) {
    modeSelectScreen.classList.add('hidden');
    const isAccessible = accessibilityToggle.checked;
    setupInitialState(mode, isAccessible);
    startWaveBtn.disabled = false; // <-- Habilita o botão
    updateUI(); // Garante que a UI inicial seja exibida
}

// Listeners do Menu Principal
menuPlayBtn.addEventListener('click', () => {
    mainMenuScreen.classList.add('hidden');
    modeSelectScreen.classList.remove('hidden');
});
menuHowToPlayBtn.addEventListener('click', () => {
    howToPlayScreen.classList.remove('hidden');
});
howToPlayCloseBtn.addEventListener('click', () => {
    howToPlayScreen.classList.add('hidden');
});

// Listeners dos Modos de Jogo
startNormalBtn.addEventListener('click', () => startGame('normal'));
startAprendizBtn.addEventListener('click', () => startGame('aprendiz'));

// Listeners dos Botões de Torre e Tooltips
towerButtons.forEach(button => { 
    button.addEventListener('click', () => { 
        if (!gameState) return;
        const type = button.dataset.towerType; 
        if (gameState.selectedTowerType === type) { 
            gameState.selectedTowerType = null; button.classList.remove('selected'); 
        } else { 
            towerButtons.forEach(btn => btn.classList.remove('selected')); 
            button.classList.add('selected'); 
            gameState.selectedTowerType = type; gameState.selectedTower = null; 
            hideTowerContextMenu();
        } 
    });
    
    const tooltip = document.getElementById(button.dataset.tooltipId);
    if(tooltip) {
        button.addEventListener('mouseenter', (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            tooltip.style.display = 'block';
            tooltip.style.top = `${rect.top - (tooltip.offsetHeight / 2) + (rect.height / 2)}px`; 
            tooltip.style.opacity = '1';
        });
        button.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
            setTimeout(() => tooltip.style.display = 'none', 200); 
        });
    }
});

// Listeners do Canvas e Ações
canvas.addEventListener('mousemove', (e) => { if (!gameState) return; const rect = canvas.getBoundingClientRect(); gameState.mouse.x = e.clientX - rect.left; gameState.mouse.y = e.clientY - rect.top; });
canvas.addEventListener('click', (e) => { 
    if (!gameState || gameState.isPaused) return; 
    
    const rect = canvas.getBoundingClientRect(); 
    const clickX = e.clientX - rect.left; 
    const clickY = e.clientY - rect.top; 
    
    if (gameState.selectedTowerType) { 
        placeTower(clickX, clickY); 
    } else {
        let towerClicked = false;
        for (const tower of gameState.towers) { 
            if (Math.hypot(clickX - tower.x, clickY - tower.y) < 20) { 
                showTowerContextMenu(e, tower);
                towerClicked = true;
                break; 
            } 
        }
        if (!towerClicked) {
Note:           hideTowerContextMenu();
        }
    } 
});

// Listener do Botão de Iniciar Onda (Adicionado na correção anterior)
startWaveBtn.addEventListener('click', () => {
    // Só inicia a onda se o jogo estiver rodando e não houver uma onda em progresso
    if (gameState && !gameState.waveInProgress) {
        startWave();
    }
});


// Listener do Botão de Reiniciar
restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden'); 
    mainMenuScreen.classList.remove('hidden'); 
    modeSelectScreen.classList.add('hidden');
    hideTowerContextMenu();
    if (gameState.nextWaveInterval) clearInterval(gameState.nextWaveInterval); 
    gameState = null; 
    pauseBtn.textContent = "PAUSAR (P)";
    backToMenuBtn.classList.add('hidden');
    startWaveBtn.disabled = true;
    startWaveBtn.textContent = "▶ INICIAR ONDA";
});

// Listeners de Pausa
pauseBtn.addEventListener('click', () => {
    togglePause(!gameState.isPaused);
});
backToMenuBtn.addEventListener('click', () => {
    togglePause(false); 
    hideTowerContextMenu();
    if (gameState.nextWaveInterval) clearInterval(gameState.nextWaveInterval); 
    gameState = null; 
    mainMenuScreen.classList.remove('hidden'); 
    modeSelectScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseBtn.textContent = "PAUSAR (P)";
    backToMenuBtn.classList.add('hidden');
    startWaveBtn.disabled = true;
    startWaveBtn.textContent = "▶ INICIAR ONDA";
});

// Listeners do Menu de Contexto
contextUpgradeBtn.addEventListener('click', handleUpgradeClick);
contextSellBtn.addEventListener('click', handleSellClick);
contextCloseBtn.addEventListener('click', hideTowerContextMenu);

// Listener dos Botões de Velocidade
speedButtons.forEach(button => { 
    button.addEventListener('click', () => { 
        if (!gameState) return;
        speedButtons.forEach(btn => btn.classList.remove('active')); 
        button.classList.add('active'); 
        gameState.gameSpeed = parseFloat(button.dataset.speed); 
    }); 
});

// Listener de Teclado (com WASD e Espaço)
window.addEventListener('keydown', (e) => { 
    if (!gameState || !gameState.isGameStarted) return;
    
    if (e.key.toLowerCase() === 'p') { 
        togglePause(!gameState.isPaused); 
    } 
    
    if (gameState.isPaused && e.key.toLowerCase() !== 'p') return; 

    if (gameState.isAccessibilityMode) {
        if (e.key >= '1' && e.key <= '4') { 
            const index = parseInt(e.key) - 1; 
            if (towerButtons[index]) { 
                towerButtons[index].click(); 
            } 
        } 
        if (gameState.selectedTowerType) { 
           const key = e.key.toLowerCase();
            switch (key) { 
                case 'arrowup': case 'w':
                    e.preventDefault();
                    gameState.keyCursor.y = Math.max(0, gameState.keyCursor.y - gameState.keyCursor.speed); 
                    break; 
                case 'arrowdown': case 's':
                    e.preventDefault();
                    gameState.keyCursor.y = Math.min(canvas.height, gameState.keyCursor.y + gameState.keyCursor.speed); 
                    break; 
                case 'arrowleft': case 'a':
                    e.preventDefault();
                    gameState.keyCursor.x = Math.max(0, gameState.keyCursor.x - gameState.keyCursor.speed); 
                    break; 
                case 'arrowright': case 'd':
                     e.preventDefault();
                    gameState.keyCursor.x = Math.min(canvas.width, gameState.keyCursor.x + gameState.keyCursor.speed); 
                    break; 
                case 'enter': case ' ':
                    e.preventDefault(); 
                    placeTower(gameState.keyCursor.x, gameState.keyCursor.y); 
                    break; 
            } 
        }
    }
});

// =========================================================================
// INICIAR O GAME LOOP (AGUARDANDO ESCOLHA NO MENU)
// =========================================================================
gameLoop();