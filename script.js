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
const gameOverScreen = document.getElementById('game-over-screen');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverMsg = document.getElementById('game-over-message');
const restartBtn = document.getElementById('restart-btn');
const upgradePanel = document.getElementById('upgrade-panel');
const upgradeBtn = document.getElementById('upgrade-btn');
const towerLevelEl = document.getElementById('tower-level');

// Configurações do Jogo
const TOWER_COSTS = { Firewall: 40, Router: 30, Antivirus: 50, Criptografador: 60 };
const UPGRADE_COST_BASE = 80;
const NEXT_WAVE_TIMER = 15;
const RETRANSMISSION_COST = 1;

// MUDANÇA CRÍTICA: Coordenadas dos caminhos redesenhadas para preencher o canvas de 1120x700
const LEVELS = {
    1: {
        path: [
            { x: 0, y: 100 }, 
            { x: 300, y: 100 }, 
            { x: 300, y: 550 },
            { x: 820, y: 550 }, 
            { x: 820, y: 250 }, 
            { x: 1120, y: 250 }
        ],
        waves: [
            { packet: 10, virus: 3, worm: 0, ransomware: 0, corruptor: 0 },
            { packet: 12, virus: 5, worm: 2, ransomware: 0, corruptor: 1 },
            { packet: 15, virus: 8, worm: 4, ransomware: 1, corruptor: 2 }
        ]
    },
    2: {
        path: [
            { x: 200, y: 0 }, 
            { x: 200, y: 200 }, 
            { x: 600, y: 200 },
            { x: 600, y: 600 }, 
            { x: 200, y: 600 }, 
            { x: 200, y: 400 },
            { x: 920, y: 400 },
            { x: 920, y: 700 }
        ],
        waves: [
            { packet: 15, virus: 5, worm: 8, ransomware: 2, corruptor: 3 },
            { packet: 20, virus: 8, worm: 10, ransomware: 4, corruptor: 4 },
            { packet: 25, virus: 12, worm: 15, ransomware: 6, corruptor: 5 }
        ]
    }
};

let currentPath;

// Estado do Jogo (sem alteração de lógica)
let gameState;

function setupInitialState() {
    gameState = {
        resources: 120, score: 0, lives: 20, level: 1, wave: 1,
        entities: [], towers: [], projectiles: [], enemyProjectiles: [], floatingTexts: [],
        selectedTowerType: null, selectedTower: null,
        mouse: { x: 0, y: 0 },
        waveInProgress: false, gameOver: false, gameWon: false,
        scoreAtWaveStart: 0,
        nextWaveInterval: null
    };
    currentPath = LEVELS[gameState.level].path;
    updateUI();
}

// ... O RESTANTE DO CÓDIGO JAVASCRIPT PERMANECE EXATAMENTE O MESMO ...
// Nenhuma outra alteração é necessária no resto do arquivo.

// =========================================================================
// CLASSES DO JOGO (Objetos)
// =========================================================================
class Entity {
    constructor(speed, health, resourceReward, livesPenalty = 1) {
        this.x = currentPath[0].x - 20; this.y = currentPath[0].y;
        this.pathIndex = 1; this.speed = speed; this.health = health;
        this.maxHealth = health; this.resourceReward = resourceReward;
        this.livesPenalty = livesPenalty;
        this.effects = {};
    }

    move() {
        if (this.pathIndex >= currentPath.length) return;
        const target = currentPath[this.pathIndex];
        const dx = target.x - this.x; const dy = target.y - this.y;
        const distance = Math.hypot(dx, dy);
        let currentSpeed = this.speed;
        if (this.effects.speedBoost) currentSpeed *= this.effects.speedBoost.multiplier;
        if (this.effects.slow) currentSpeed *= this.effects.slow.multiplier;

        if (distance < currentSpeed) { this.pathIndex++; } 
        else { this.x += (dx / distance) * currentSpeed; this.y += (dy / distance) * currentSpeed; }
    }
    
    draw() {
        ctx.fillStyle = this.effects.shielded ? '#add8e6' : this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, 12, 0, Math.PI * 2); ctx.fill();
        if (this.health < this.maxHealth) {
            ctx.fillStyle = 'red'; ctx.fillRect(this.x - 12, this.y - 18, 24, 4);
            ctx.fillStyle = 'green'; ctx.fillRect(this.x - 12, this.y - 18, 24 * (this.health / this.maxHealth), 4);
        }
    }
    
    update() {
        for (const key in this.effects) {
            this.effects[key].duration--;
            if (this.effects[key].duration <= 0) delete this.effects[key];
        }
        this.move(); this.draw();
    }
}

class Packet extends Entity { constructor() { super(1.5, 20, 0); this.color = '#2ecc71'; } }
class Virus extends Entity { constructor() { super(1, 60, 5); this.color = '#e74c3c'; } }
class Worm extends Entity { constructor() { super(2.5, 30, 8); this.color = '#9b59b6'; } }
class Ransomware extends Entity { constructor() { super(0.8, 150, 20, 5); this.color = '#34495e'; } }
class Corruptor extends Entity {
    constructor() {
        super(0.7, 80, 15);
        this.color = '#f1c40f'; this.range = 150;
        this.attackSpeed = 120; this.cooldown = 0;
    }
    findTarget() { return gameState.entities.find(e => e instanceof Packet && Math.hypot(this.x - e.x, this.y - e.y) <= this.range); }
    update() {
        if (this.cooldown > 0) this.cooldown--;
        const target = this.findTarget();
        if (target) {
            if (this.cooldown <= 0) {
                gameState.enemyProjectiles.push(new CorruptingProjectile(this.x, this.y, target));
                this.cooldown = this.attackSpeed;
            }
        } else { super.move(); }
        super.draw();
    }
}

class Tower {
    constructor(x, y, range, cost) {
        this.x = x; this.y = y; this.range = range; this.cost = cost;
        this.level = 1; this.cooldown = 0;
    }
    drawRange() {
        const style = (this === gameState.selectedTower) ? 'rgba(255, 255, 0, 0.4)' : 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
        ctx.fillStyle = style; ctx.fill();
    }
    upgrade() {
        const cost = this.getUpgradeCost();
        if (gameState.resources >= cost) {
            gameState.resources -= cost; this.level++; this.range *= 1.1; return true;
        }
        return false;
    }
    getUpgradeCost() { return Math.floor(UPGRADE_COST_BASE * Math.pow(1.5, this.level -1)); }
    update() {
        if (this.cooldown > 0) this.cooldown--;
        this.draw(); this.drawRange();
    }
}

class Firewall extends Tower {
    constructor(x, y) { super(x, y, 120, TOWER_COSTS.Firewall); this.attackSpeed = 60; this.damage = 10; }
    draw() {
        ctx.fillStyle = '#f39c12'; ctx.fillRect(this.x - 15, this.y - 15, 30, 30);
        ctx.fillStyle = '#e67e22'; ctx.fillRect(this.x - 10, this.y - 10, 20, 20);
    }
    upgrade() { if (super.upgrade()) { this.damage += 5; this.attackSpeed = Math.max(20, this.attackSpeed - 5); } }
    update() {
        super.update();
        const target = gameState.entities.find(e => !(e instanceof Packet) && Math.hypot(this.x - e.x, this.y - e.y) <= this.range);
        if (target && this.cooldown <= 0) {
            gameState.projectiles.push(new Projectile(this.x, this.y, target, this.damage));
            this.cooldown = this.attackSpeed; playSound('shoot');
        }
    }
}

class Router extends Tower {
    constructor(x, y) { super(x, y, 90, TOWER_COSTS.Router); }
    draw() {
        ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.arc(this.x, this.y, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2980b9'; ctx.beginPath(); ctx.arc(this.x, this.y, 12, 0, Math.PI * 2); ctx.fill();
    }
    update() {
        super.update();
        gameState.entities.forEach(e => {
            if (e instanceof Packet && Math.hypot(this.x - e.x, this.y - e.y) <= this.range) {
                e.effects.speedBoost = { multiplier: 1.5, duration: 10 };
                ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(e.x, e.y);
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'; ctx.stroke();
            }
        });
    }
}

class Antivirus extends Tower {
    constructor(x, y) { super(x, y, 100, TOWER_COSTS.Antivirus); }
    draw() {
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(this.x, this.y, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(this.x, this.y, 12, 0, Math.PI * 2); ctx.fill();
    }
    update() {
        super.update();
        gameState.entities.forEach(e => {
            if (!(e instanceof Packet) && Math.hypot(this.x - e.x, this.y - e.y) <= this.range) {
                e.effects.slow = { multiplier: 0.6, duration: 10 };
            }
        });
    }
}

class Criptografador extends Tower {
    constructor(x,y) { super(x, y, 110, TOWER_COSTS.Criptografador); }
    draw() {
        ctx.fillStyle = '#bdc3c7'; ctx.fillRect(this.x - 15, this.y - 15, 30, 30);
        ctx.fillStyle = '#95a5a6'; ctx.fillRect(this.x - 10, this.y - 10, 20, 20);
    }
    update() {
        super.update();
        gameState.entities.forEach(e => {
            if (e instanceof Packet && Math.hypot(this.x - e.x, this.y - e.y) <= this.range) {
                e.effects.shielded = { duration: 10 };
            }
        });
    }
}

class Projectile {
    constructor(x, y, target, damage) { this.x = x; this.y = y; this.target = target; this.speed = 6; this.damage = damage; }
    update() {
        const dx = this.target.x - this.x; const dy = this.target.y - this.y;
        const distance = Math.hypot(dx, dy);
        if (distance < this.speed || this.target.health <= 0) {
            if (this.target.health > 0) {
                if (!this.target.effects.shielded) { this.target.health -= this.damage; playSound('hit');
                } else { delete this.target.effects.shielded; }
            }
            return true;
        }
        this.x += (dx / distance) * this.speed; this.y += (dy / distance) * this.speed;
        this.draw(); return false;
    }
    draw() { ctx.fillStyle = 'cyan'; ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI * 2); ctx.fill(); }
}

class CorruptingProjectile {
    constructor(x, y, target) { this.x = x; this.y = y; this.target = target; this.speed = 4; this.damage = 10; }
    update() {
        const dx = this.target.x - this.x; const dy = this.target.y - this.y;
        const distance = Math.hypot(dx, dy);
        if (distance < this.speed || this.target.health <= 0) {
            if (this.target.health > 0) {
                if (!this.target.effects.shielded) { this.target.health -= this.damage; playSound('corrupt');
                } else { delete this.target.effects.shielded; }
            }
            return true;
        }
        this.x += (dx / distance) * this.speed; this.y += (dy / distance) * this.speed;
        this.draw(); return false;
    }
    draw() { ctx.fillStyle = 'magenta'; ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); ctx.fill(); }
}

class FloatingText {
    constructor(text, x, y, color = 'gold') {
        this.text = text; this.x = x; this.y = y; this.color = color;
        this.duration = 80; this.opacity = 1;
    }
    update() { this.y -= 0.5; this.duration--; this.opacity -= 1 / 80; }
    draw() {
        ctx.save(); ctx.globalAlpha = this.opacity; ctx.fillStyle = this.color;
        ctx.font = '20px Roboto Mono'; ctx.fillText(this.text, this.x, this.y); ctx.restore();
    }
}

// =========================================================================
// LÓGICA DO JOGO
// =========================================================================
function handleEntities() {
    for (let i = gameState.entities.length - 1; i >= 0; i--) {
        const entity = gameState.entities[i];
        entity.update();
        if (entity.pathIndex >= currentPath.length) {
            if (entity instanceof Packet) gameState.score++;
            else gameState.lives -= entity.livesPenalty;
            gameState.entities.splice(i, 1);
        } else if (entity.health <= 0) {
            if (entity instanceof Packet) {
                if (gameState.resources >= RETRANSMISSION_COST) {
                    gameState.resources -= RETRANSMISSION_COST;
                    gameState.entities.push(new Packet());
                    gameState.floatingTexts.push(new FloatingText("Retransmitindo...", 20, 50, 'orange'));
                }
            } else {
                gameState.resources += entity.resourceReward;
            }
            gameState.entities.splice(i, 1);
        }
    }
}

function updateUI() {
    resourcesEl.innerHTML = `${gameState.resources} 💰`; 
    scoreEl.innerHTML = `${gameState.score} ⭐`;
    livesEl.innerHTML = `${gameState.lives}/20 ❤️`; 
    levelEl.textContent = gameState.level;
    const wavesInLevel = LEVELS[gameState.level].waves.length;
    waveEl.textContent = gameState.wave > wavesInLevel ? `Final` : gameState.wave;
    
    if (gameState.selectedTower) {
        upgradePanel.classList.remove('hidden');
        towerLevelEl.textContent = gameState.selectedTower.level;
        const cost = gameState.selectedTower.getUpgradeCost();
        upgradeBtn.textContent = `Melhorar (${cost})`;
        upgradeBtn.disabled = gameState.resources < cost;
    } else {
        upgradePanel.classList.add('hidden');
    }
}

function drawPath() {
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)'; ctx.lineWidth = 35;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(currentPath[0].x, currentPath[0].y);
    for (let i = 1; i < currentPath.length; i++) ctx.lineTo(currentPath[i].x, currentPath[i].y);
    ctx.stroke(); ctx.lineWidth = 1;
}

function startNextWaveCountdown() {
    let countdown = NEXT_WAVE_TIMER;
    startWaveBtn.disabled = false;
    startWaveBtn.textContent = `▶ ONDA (${countdown}s)`;

    gameState.nextWaveInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            startWaveBtn.textContent = `▶ ONDA (${countdown}s)`;
        } else {
            clearInterval(gameState.nextWaveInterval);
            gameState.nextWaveInterval = null;
            startWave();
        }
    }, 1000);
}

function handleWaveCompletion() {
    const packetsThisWave = gameState.score - gameState.scoreAtWaveStart;
    const bonusResources = (packetsThisWave * 2) + gameState.lives;
    if (bonusResources > 0) {
        gameState.resources += bonusResources;
        gameState.floatingTexts.push(new FloatingText(`+${bonusResources} Recursos!`, canvas.width / 2 - 100, canvas.height / 2));
    }
    gameState.waveInProgress = false;
    gameState.wave++;
    startNextWaveCountdown();
}

function startWave() {
    if (gameState.nextWaveInterval) {
        clearInterval(gameState.nextWaveInterval);
        gameState.nextWaveInterval = null;
    }
    gameState.scoreAtWaveStart = gameState.score;
    const levelConf = LEVELS[gameState.level];
    
    if (gameState.wave > levelConf.waves.length) {
        if (gameState.level < Object.keys(LEVELS).length) {
            gameState.level++; gameState.wave = 1;
            currentPath = LEVELS[gameState.level].path;
            gameState.towers = [];
            alert(`Nível ${gameState.level}! Prepare-se para um novo desafio.`);
        } else {
            gameState.gameWon = true; return;
        }
    }
    gameState.waveInProgress = true;
    startWaveBtn.textContent = 'EM ANDAMENTO...';
    startWaveBtn.disabled = true;

    const waveConfig = levelConf.waves[gameState.wave - 1];
    let toSpawn = [];
    for(let i=0; i<waveConfig.packet; i++) toSpawn.push('Packet');
    for(let i=0; i<waveConfig.virus; i++) toSpawn.push('Virus');
    for(let i=0; i<waveConfig.worm; i++) toSpawn.push('Worm');
    for(let i=0; i<waveConfig.ransomware; i++) toSpawn.push('Ransomware');
    for(let i=0; i<waveConfig.corruptor; i++) toSpawn.push('Corruptor');
    toSpawn = toSpawn.sort(() => Math.random() - 0.5);

    const spawnInterval = setInterval(() => {
        if (toSpawn.length > 0) {
            const type = toSpawn.pop();
            if (type === 'Packet') gameState.entities.push(new Packet());
            else if (type === 'Virus') gameState.entities.push(new Virus());
            else if (type === 'Worm') gameState.entities.push(new Worm());
            else if (type === 'Ransomware') gameState.entities.push(new Ransomware());
            else if (type === 'Corruptor') gameState.entities.push(new Corruptor());
        } else {
            clearInterval(spawnInterval);
            const checkWaveEnd = setInterval(() => {
                if (gameState.entities.length === 0 && !gameState.gameOver) {
                    clearInterval(checkWaveEnd);
                    handleWaveCompletion();
                }
            }, 1000);
        }
    }, 700);
}

function checkGameOver() {
    if (gameState.lives <= 0 && !gameState.gameOver) {
        gameState.gameOver = true;
        gameOverTitle.textContent = "Fim de Jogo";
        gameOverMsg.textContent = "Os vírus sobrecarregaram a rede. Tente novamente!";
        gameOverScreen.classList.remove('hidden');
        playSound('gameover');
    }
    if (gameState.gameWon && gameState.entities.length === 0 && !gameState.gameOver) {
        gameState.gameOver = true;
        gameOverTitle.textContent = "Vitória!";
        gameOverMsg.textContent = `Você defendeu a rede com sucesso! Pontuação Final: ${gameState.score}`;
        gameOverScreen.classList.remove('hidden');
    }
}

// =========================================================================
// GAME LOOP PRINCIPAL
// =========================================================================
function gameLoop() {
    if (gameState.gameOver) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPath();
    gameState.towers.forEach(t => t.update());
    
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
        if (gameState.projectiles[i].update()) gameState.projectiles.splice(i, 1);
    }
    for (let i = gameState.enemyProjectiles.length - 1; i >= 0; i--) {
        if (gameState.enemyProjectiles[i].update()) gameState.enemyProjectiles.splice(i, 1);
    }
    handleEntities();
    for (let i = gameState.floatingTexts.length - 1; i >= 0; i--) {
        const text = gameState.floatingTexts[i];
        text.update(); text.draw();
        if (text.duration <= 0) gameState.floatingTexts.splice(i, 1);
    }
    
    if (gameState.selectedTowerType) {
        const cost = TOWER_COSTS[gameState.selectedTowerType];
        ctx.beginPath();
        const range = {Firewall: 120, Router: 90, Antivirus: 100, Criptografador: 110}[gameState.selectedTowerType];
        ctx.arc(gameState.mouse.x, gameState.mouse.y, range, 0, Math.PI * 2);
        ctx.fillStyle = gameState.resources >= cost ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255, 0, 0, 0.2)';
        ctx.fill();
    }
    
    updateUI(); checkGameOver();
    requestAnimationFrame(gameLoop);
}

// =========================================================================
// EVENT LISTENERS E SONS
// =========================================================================
function playSound(id) {
    try {
        const sound = document.getElementById(`sound-${id}`);
        sound.currentTime = 0; sound.volume = 0.5;
        sound.play();
    } catch (e) { /* silent fail */ }
}

towerButtons.forEach(button => {
    button.addEventListener('click', () => {
        const type = button.dataset.towerType;
        if (gameState.selectedTowerType === type) {
            gameState.selectedTowerType = null; button.classList.remove('selected');
        } else {
            towerButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            gameState.selectedTowerType = type; gameState.selectedTower = null;
        }
    });
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    gameState.mouse.x = e.clientX - rect.left;
    gameState.mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('click', () => {
    if (gameState.selectedTowerType) {
        const cost = TOWER_COSTS[gameState.selectedTowerType];
        if (gameState.resources >= cost) {
            gameState.resources -= cost;
            let newTower;
            if (gameState.selectedTowerType === 'Firewall') newTower = new Firewall(gameState.mouse.x, gameState.mouse.y);
            else if (gameState.selectedTowerType === 'Router') newTower = new Router(gameState.mouse.x, gameState.mouse.y);
            else if (gameState.selectedTowerType === 'Antivirus') newTower = new Antivirus(gameState.mouse.x, gameState.mouse.y);
            else if (gameState.selectedTowerType === 'Criptografador') newTower = new Criptografador(gameState.mouse.x, gameState.mouse.y);
            gameState.towers.push(newTower); playSound('place');
        } else { alert("Recursos insuficientes!"); }
        towerButtons.forEach(btn => btn.classList.remove('selected'));
        gameState.selectedTowerType = null;
    } else {
        gameState.selectedTower = null;
        for (const tower of gameState.towers) {
            if (Math.hypot(gameState.mouse.x - tower.x, gameState.mouse.y - tower.y) < 20) {
                gameState.selectedTower = tower; break;
            }
        }
    }
});

upgradeBtn.addEventListener('click', () => {
    if (gameState.selectedTower) { gameState.selectedTower.upgrade(); }
});

startWaveBtn.addEventListener('click', () => {
    if (!gameState.waveInProgress) { startWave(); }
});
restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    if (gameState.nextWaveInterval) clearInterval(gameState.nextWaveInterval);
    setupInitialState(); gameLoop();
});

// =========================================================================
// INICIAR O JOGO
// =========================================================================
setupInitialState();
gameLoop();