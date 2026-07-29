window.addEventListener('DOMContentLoaded', () => {
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

    // Audio Context
    let audioCtx = null;

    function initAudio() { 
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playSound(type) {
        if (!audioCtx || audioCtx.state !== 'running') return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            const now = audioCtx.currentTime;

            if (type === 'bow') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(500, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.start(now); osc.stop(now + 0.08);
            } else if (type === 'gun') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(900, now);
                osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
                osc.start(now); osc.stop(now + 0.05);
            } else if (type === 'hit') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(250, now);
                osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
            } else if (type === 'super') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
                osc.start(now); osc.stop(now + 0.2);
            } else if (type === 'item') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(950, now + 0.12);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
                osc.start(now); osc.stop(now + 0.12);
            }
        } catch (e) {
            console.error(e);
        }
    }

    // Game Variables
    let gameRunning = false;
    let keys = {};
    let projectiles = [];
    let particles = [];
    let items = [];

    const MAX_HP = 10; // Total 10 Nyawa/Peluru Kena

    const platforms = [
        { x: 0, y: 430, w: 900, h: 70 },
        { x: 100, y: 310, w: 200, h: 16 },
        { x: 600, y: 310, w: 200, h: 16 },
        { x: 350, y: 200, w: 200, h: 16 }
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
            this.hp = MAX_HP; // Menggunakan sistem jumlah hit
            this.energy = 0;
            this.isGrounded = false;
            this.facing = role === 'archer' ? 'right' : 'left';
            this.shootCooldown = 0;
            this.isCPU = isCPU;
            this.hitStun = 0;
            this.invincible = 0; // Waktu kebal sesaat setelah kena hit
        }

        update() {
            if (this.hitStun > 0) this.hitStun--;
            if (this.invincible > 0) this.invincible--;

            // FISIKA TEMPO CEPAT: Gravitasi & Pergerakan lebih responsif
            this.vy += 0.95; 
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.84;

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
            if (this.energy < 100) this.energy += 0.25; // Isi energy lebih cepat
        }

        draw() {
            // Efek kedip saat kebal / hit
            if (this.invincible % 4 > 2) return;

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

            // TEMPO CEPAT: Cooldown tembak dipersingkat
            this.shootCooldown = isSuper ? 25 : (this.role === 'archer' ? 10 : 7);
            
            // Peluru bergerak jauh lebih cepat
            let pVx = this.facing === 'right' ? (isSuper ? 22 : 18) : (isSuper ? -22 : -18);
            let pVy = this.role === 'archer' ? (isSuper ? -1.5 : -2.5) : (isSuper ? 0 : (Math.random() - 0.5) * 2);

            projectiles.push({
                x: this.facing === 'right' ? this.x + this.w + 5 : this.x - 15,
                y: this.y + 22,
                vx: pVx,
                vy: pVy,
                w: isSuper ? 28 : (this.role === 'archer' ? 18 : 12),
                h: isSuper ? 12 : (this.role === 'archer' ? 5 : 6),
                owner: this,
                type: this.role,
                isSuper: isSuper,
                damage: isSuper ? 2 : 1, // Super = minus 2 nyawa, Biasa = minus 1 nyawa
                gravity: this.role === 'archer' ? (isSuper ? 0.05 : 0.15) : 0
            });
        }
    }

    let p1 = new Player(120, 200, '#22c55e', 'archer');
    let p2 = new Player(740, 200, '#06b6d4', 'gunner');

    function createParticles(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                color,
                life: 14
            });
        }
    }

    function spawnItem() {
        if (!gameRunning) return;
        if (items.length < 2 && Math.random() < 0.5) {
            items.push({
                x: 150 + Math.random() * 600,
                y: 0,
                type: Math.random() > 0.4 ? 'heal' : 'energy',
                w: 22, h: 22
            });
        }
    }
    setInterval(spawnItem, 4000); // Item muncul lebih sering

    function checkCollision(r1, r2) {
        return r1.x < r2.x + r2.w &&
               r1.x + r1.w > r2.x &&
               r1.y < r2.y + r2.h &&
               r1.y + r1.h > r2.y;
    }

    function updateCPU() {
        if (!p2.isCPU) return;

        let dist = p1.x - p2.x;
        // CPU LEBIH AGRESIF & GESIT
        if (Math.abs(dist) > 220) {
            p2.vx = dist > 0 ? 5.5 : -5.5;
        } else if (Math.abs(dist) < 90) {
            p2.vx = dist > 0 ? -5.5 : 5.5;
        }
        p2.facing = dist > 0 ? 'right' : 'left';

        if ((p1.y < p2.y - 40 || Math.random() < 0.04) && p2.isGrounded) {
            p2.vy = -15;
        }

        if (Math.abs(p1.y - p2.y) < 100) {
            if (p2.energy >= 100 && Math.random() < 0.15) {
                p2.shoot(true);
            } else if (Math.random() < 0.35) {
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
        // TEMPO CEPAT: Kecepatan lari ditingkatkan (8px/frame)
        if (keys['KeyA']) { p1.vx = -8; p1.facing = 'left'; }
        if (keys['KeyD']) { p1.vx = 8; p1.facing = 'right'; }
        if (keys['KeyW'] && p1.isGrounded) p1.vy = -15;
        if (keys['KeyF']) p1.shoot(false);

        if (!p2.isCPU) {
            if (keys['ArrowLeft']) { p2.vx = -8; p2.facing = 'left'; }
            if (keys['ArrowRight']) { p2.vx = 8; p2.facing = 'right'; }
            if (keys['ArrowUp'] && p2.isGrounded) p2.vy = -15;
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

        // Gambar Platform
        ctx.fillStyle = '#334155';
        platforms.forEach(p => {
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = '#475569';
            ctx.fillRect(p.x, p.y, p.w, 4);
            ctx.fillStyle = '#334155';
        });

        // Gambar Items
        items.forEach((item, index) => {
            item.y += 3.5;
            platforms.forEach(p => {
                if (checkCollision(item, p)) item.y = p.y - item.h;
            });

            ctx.fillStyle = item.type === 'heal' ? '#22c55e' : '#eab308';
            ctx.fillRect(item.x, item.y, item.w, item.h);

            [p1, p2].forEach(p => {
                if (checkCollision(item, p)) {
                    if (item.type === 'heal') p.hp = Math.min(MAX_HP, p.hp + 2); // Tambah +2 nyawa
                    if (item.type === 'energy') p.energy = Math.min(100, p.energy + 50);
                    playSound('item');
                    createParticles(item.x + 11, item.y + 11, item.type === 'heal' ? '#22c55e' : '#eab308', 15);
                    items.splice(index, 1);
                }
            });
        });

        // Update Peluru
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
            // Deteksi Kena Hit
            if (target.invincible <= 0 && checkCollision(proj, target)) {
                target.hp -= proj.damage; // Mengurangi jumlah nyawa
                target.vx = proj.vx > 0 ? 10 : -10;
                target.vy = -5;
                target.hitStun = 6;
                target.invincible = 12; // Waktu kebal singkat agar tidak langsung habis sekaligus
                proj.owner.energy = Math.min(100, proj.owner.energy + 20);

                playSound('hit');
                createParticles(target.x + 19, target.y + 29, '#ef4444', 18);
                projectiles.splice(pIndex, 1);
            }

            if (proj.x < -50 || proj.x > canvas.width + 50 || proj.y > canvas.height + 50) {
                projectiles.splice(pIndex, 1);
            }
        });

        // Particles
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
        // --- UI PEMAIN 1 (KIRI) ---
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('🏹 ARCHER (P1)', 20, 20);

        // Frame Bar HP P1
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(20, 28, 260, 32);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 28, 260, 32);

        // Isi Bar HP P1 (Berdasarkan jumlah nyawa 0-10)
        let hpWidthP1 = Math.max(0, (p1.hp / MAX_HP) * 256);
        ctx.fillStyle = p1.hp > 3 ? '#22c55e' : '#ef4444';
        ctx.fillRect(22, 30, hpWidthP1, 28);

        // Teks Sisa Nyawa (Satu Peluru = 1 Nyawa)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`Nyawa: ${Math.max(0, p1.hp)} / ${MAX_HP}`, 30, 49);

        // Bar Energi P1
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(20, 64, 260, 10);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(20, 64, (p1.energy / 100) * 260, 10);


        // --- UI PEMAIN 2 / CPU (KANAN) ---
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(p2.isCPU ? '🔫 GUNNER (CPU)' : '🔫 GUNNER (P2)', 880, 20);

        // Frame Bar HP P2
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(620, 28, 260, 32);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.strokeRect(620, 28, 260, 32);

        // Isi Bar HP P2
        let hpWidthP2 = Math.max(0, (p2.hp / MAX_HP) * 256);
        ctx.fillStyle = p2.hp > 3 ? '#22c55e' : '#ef4444';
        ctx.fillRect(878 - hpWidthP2, 30, hpWidthP2, 28);

        // Teks Sisa Nyawa P2
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`Nyawa: ${Math.max(0, p2.hp)} / ${MAX_HP}`, 870, 49);

        // Bar Energi P2
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(620, 64, 260, 10);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(880 - ((p2.energy / 100) * 260), 64, (p2.energy / 100) * 260, 10);

        ctx.textAlign = 'left';
    }

    function startGame(vsCPU) {
        initAudio();
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

    if (btnVsCpu) btnVsCpu.onclick = () => startGame(true);
    if (btnVsPlayer) btnVsPlayer.onclick = () => startGame(false);
    if (btnRestart) btnRestart.onclick = () => startGame(p2.isCPU);
    if (btnMenu) btnMenu.onclick = () => {
        gameOverMenu.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    };
});
