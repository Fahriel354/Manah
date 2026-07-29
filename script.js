const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const mainMenu = document.getElementById('main-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const winnerTitle = document.getElementById('winner-title');
const btnVsCpu = document.getElementById('btn-vs-cpu');
const btnVsPlayer = document.getElementById('btn-vs-player');
const btnRestart = document.getElementById('btn-restart');
const btnMenu = document.getElementById('btn-menu');

// Sound Synthesizer (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() { 
    if (!audioCtx) audioCtx = new AudioContext(); 
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'bow') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'gun') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.start(now); osc.stop(now + 0.12);
    } else if (type === 'super') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
    } else if (type === 'item') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    }
}

// Game State & Platforms
let gameRunning = false;
let keys = {};
let projectiles = [];
let particles = [];
let items = [];

const platforms = [
    { x: 0, y: 430, w: 900, h: 70 },       // Tanah Utama
    { x: 100, y: 310, w: 200, h: 16 },     // Platform Kiri
    { x: 600, y: 310, w: 200, h: 16 },     // Platform Kanan
    { x: 350, y: 200, w: 200, h: 16 }      // Platform Tengah
];

class Player {
    constructor(x, y, color, role, isCPU = false) {
        this.x = x;
        this.y = y;
        this.w = 38;
        this.h = 58;
        this.vx = 0;
        this.vy = 0;
        this.color = color;
        this.role = role;
        this.hp = 100;
        this.energy = 0;
        this.isGrounded = false;
        this.facing = role === 'archer' ? 'right' : 'left';
        this.shootCooldown = 0;
        this.isCPU = isCPU;
        this.hitStun = 0;
    }

    update() {
        if (this.hitStun > 0) this.hitStun--;

        this.vy += 0.75;
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.82;

        this.isGrounded = false;
        for (let p of platforms) {
            if (this.x + this.w > p.x && this.x < p.x + p.w &&
                this.y + this.h >= p.y && this.y + this.h <= p.y + p.h + this.vy &&
                this.vy >= 0) {
                this.y = p.y - this.h;
                this.vy = 0;
                this.isGrounded = true;
            }
        }

        if (this.x < 0) this.x = 0;
        if (this.x + this.w > canvas.width) this.x = canvas.width - this.w;

        if (this.shootCooldown > 0) this.shootCooldown--;
        if (this.energy < 100) this.energy += 0.08;
    }

    draw() {
        ctx.fillStyle = this.hitStun > 0 ? '#ffffff' : this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);

        ctx.fillStyle = '#0f172a';
        let eyeX = this.facing === 'right' ? this.x + 24 : this.x + 6;
        ctx.fillRect(eyeX, this.y + 10, 8, 8);

        ctx.fillStyle = this.role === 'archer' ? '#d97706' : '#94a3b8';
        if (this.facing === 'right') {
            ctx.fillRect(this.x + this.w, this.y + 22, 16, 6);
        } else {
            ctx.fillRect(this.x - 16, this.y + 22, 16, 6);
        }
    }

    shoot(isSuper = false) {
        if (this.shootCooldown > 0) return;
        if (isSuper && this.energy < 100) return;

        if (isSuper) {
            this.energy = 0;
            playSound('super');
        } else {
            playSound(this.role === 'archer' ? 'bow' : 'gun');
        }

        this.shootCooldown = isSuper ? 35 : (this.role === 'archer' ? 18 : 12);
        let pVx = this.facing === 'right' ? (isSuper ? 16 : 12) : (isSuper ? -16 : -12);
        let pVy = this.role === 'archer' ? (isSuper ? -2 : -3.5) : (isSuper ? 0 : (Math.random() - 0.5) * 1.5);

        projectiles.push({
            x: this.facing === 'right' ? this.x + this.w + 5 : this.x - 15,
            y: this.y + 22,
            vx: pVx,
            vy: pVy,
            w: isSuper ? 24 : (this.role === 'archer' ? 16 : 10),
            h: isSuper ? 10 : (this.role === 'archer' ? 4 : 6),
            owner: this,
            type: this.role,
            isSuper: isSuper,
            gravity: this.role === 'archer' ? (isSuper ? 0.08 : 0.22) : 0
        });
    }
}

let p1 = new Player(120, 200, '#22c55e', 'archer');
let p2 = new Player(740, 200, '#06b6d4', 'gunner');

function createParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            color,
            life: 18
        });
    }
}

function spawnItem() {
    if (!gameRunning) return;
    if (items.length < 2 && Math.random() < 0.4) {
        items.push({
            x: 150 + Math.random() * 600,
            y: 0,
            type: Math.random() > 0.5 ? 'heal' : 'energy',
            w: 22, h: 22
        });
    }
}
setInterval(spawnItem, 6000);

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.w &&
           r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h &&
           r1.y + r1.h > r2.y;
}

function updateCPU() {
    if (!p2.isCPU) return;

    let dist = p1.x - p2.x;
    if (Math.abs(dist) > 300) {
        p2.vx = dist > 0 ? 3.5 : -3.5;
    } else if (Math.abs(dist) < 120) {
        p2.vx = dist > 0 ? -3.5 : 3.5;
    }
    p2.facing = dist > 0 ? 'right' : 'left';

    if ((p1.y < p2.y - 40 || Math.random() < 0.02) && p2.isGrounded) {
        p2.vy = -13;
    }

    if (Math.abs(p1.y - p2.y) < 80) {
        if (p2.energy >= 100 && Math.random() < 0.08) {
            p2.shoot(true);
        } else if (Math.random() < 0.2) {
            p2.shoot(false);
        }
    }
}

window.addEventListener('keydown', (e) => {
    initAudio();
    keys[e.code] = true;

    if (e.code === 'KeyG') p1.shoot(true);
    if (e.code === 'KeyL' && !p2.isCPU) p2.shoot(true);
});

window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function handleInput() {
    if (keys['KeyA']) { p1.vx = -5; p1.facing = 'left'; }
    if (keys['KeyD']) { p1.vx = 5; p1.facing = 'right'; }
    if (keys['KeyW'] && p1.isGrounded) p1.vy = -13.5;
    if (keys['KeyF']) p1.shoot(false);

    if (!p2.isCPU) {
        if (keys['ArrowLeft']) { p2.vx = -5; p2.facing = 'left'; }
        if (keys['ArrowRight']) { p2.vx = 5; p2.facing = 'right'; }
        if (keys['ArrowUp'] && p2.isGrounded) p2.vy = -13.5;
        if (keys['Enter']) p2.shoot(false);
    }
}

function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    handleInput();
    updateCPU();

    p1.update();
    p2.update();

    ctx.fillStyle = '#334155';
    platforms.forEach(p => {
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#475569';
        ctx.fillRect(p.x, p.y, p.w, 4);
        ctx.fillStyle = '#334155';
    });

    items.forEach((item, index) => {
        item.y += 2.5;
        platforms.forEach(p => {
            if (checkCollision(item, p)) item.y = p.y - item.h;
        });

        ctx.fillStyle = item.type === 'heal' ? '#22c55e' : '#eab308';
        ctx.fillRect(item.x, item.y, item.w, item.h);

        [p1, p2].forEach(p => {
            if (checkCollision(item, p)) {
                if (item.type === 'heal') p.hp = Math.min(100, p.hp + 30);
                if (item.type === 'energy') p.energy = Math.min(100, p.energy + 60);
                playSound('item');
                createParticles(item.x + 11, item.y + 11, item.type === 'heal' ? '#22c55e' : '#eab308', 15);
                items.splice(index, 1);
            }
        });
    });

    projectiles.forEach((proj, pIndex) => {
        proj.x += proj.vx;
        proj.vy += proj.gravity;
        proj.y += proj.vy;

        ctx.fillStyle = proj.isSuper ? '#f59e0b' : (proj.type === 'archer' ? '#f97316' : '#38bdf8');
        ctx.fillRect(proj.x, proj.y, proj.w, proj.h);

        platforms.forEach(p => {
            if (checkCollision(proj, p)) {
                createParticles(proj.x, proj.y, '#94a3b8', 6);
                projectiles.splice(pIndex, 1);
            }
        });

        let target = proj.owner === p1 ? p2 : p1;
        if (checkCollision(proj, target)) {
            let dmg = proj.isSuper ? 32 : (proj.type === 'archer' ? 14 : 10);
            target.hp -= dmg;
            target.vx = proj.vx > 0 ? 8 : -8;
            target.vy = -4;
            target.hitStun = 8;
            proj.owner.energy = Math.min(100, proj.owner.energy + 12);

            playSound('hit');
            createParticles(target.x + 19, target.y + 29, '#ef4444', 16);
            projectiles.splice(pIndex, 1);
        }

        if (proj.x < -50 || proj.x > canvas.width + 50 || proj.y > canvas.height + 50) {
            projectiles.splice(pIndex, 1);
        }
    });

    particles.forEach((pt, index) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life--;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, 4, 4);
        if (pt.life <= 0) particles.splice(index, 1);
    });

    p1.draw();
    p2.draw();

    drawUI();

    if (p1.hp <= 0 || p2.hp <= 0) {
        gameRunning = false;
        gameOverMenu.classList.remove('hidden');
        if (p1.hp <= 0 && p2.hp <= 0) winnerTitle.innerText = "SERI!";
        else if (p1.hp <= 0) winnerTitle.innerText = p2.isCPU ? "CPU Penembak Menang!" : "Pemain 2 Menang!";
        else winnerTitle.innerText = "Pemanah (P1) Menang!";
    }

    requestAnimationFrame(gameLoop);
}

function drawUI() {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(20, 20, 220, 22);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(20, 20, Math.max(0, p1.hp * 2.2), 22);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(20, 48, p1.energy * 2.2, 8);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('🏹 ARCHER (P1)', 20, 15);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(660, 20, 220, 22);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(660, 20, Math.max(0, p2.hp * 2.2), 22);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(660, 48, p2.energy * 2.2, 8);

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(p2.isCPU ? '🔫 GUNNER (CPU)' : '🔫 GUNNER (P2)', 660, 15);
}

function startGame(vsCPU) {
    p1 = new Player(120, 200, '#22c55e', 'archer');
    p2 = new Player(740, 200, '#06b6d4', 'gunner', vsCPU);
    projectiles = [];
    items = [];
    particles = [];
    gameRunning = true;
    mainMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

btnVsCpu.addEventListener('click', () => startGame(true));
btnVsPlayer.addEventListener('click', () => startGame(false));
btnRestart.addEventListener('click', () => startGame(p2.isCPU));
btnMenu.addEventListener('click', () => {
    gameOverMenu.classList.add('hidden');
    mainMenu.classList.remove('hidden');
});
