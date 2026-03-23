/**
 * NEON CROSS - Core Game Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const nextBtn = document.getElementById('next-level-btn');
const menuOverlay = document.getElementById('menu-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const winOverlay = document.getElementById('win-overlay');

const levelVal = document.getElementById('level-val');
const scoreVal = document.getElementById('score-val');
const livesVal = document.getElementById('lives-val');
const finalScoreVal = document.getElementById('final-score');
const winScoreVal = document.getElementById('win-score');

// New UI Elements
const controlRestartBtn = document.getElementById('control-restart-btn');
const difficultySlider = document.getElementById('difficulty-slider');
const difficultyVal = document.getElementById('diff-val');
const infLivesToggle = document.getElementById('inf-lives-toggle');
const colorPicker = document.getElementById('player-color-picker');

// Game constants
const LANES = 8;
const LANE_HEIGHT = 80;
const PLAYER_SIZE = 30;
const OBSTACLE_HEIGHT = 40;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Colors
const COLORS = {
    cyan: '#00f3ff',
    magenta: '#ff00ff',
    yellow: '#fff200',
    green: '#39ff14',
    red: '#ff3131',
    bg: '#0a0a0c'
};

// Game State
let gameState = 'MENU';
let level = 1;
let score = 0;
let lives = 3;
let player;
let obstacles = [];
let particles = [];
let keys = {};

// Feature settings
let infiniteLives = false;
let baseDifficulty = 1;

// --- Classes ---

class Player {
    constructor() {
        this.reset();
    }

    reset() {
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.x = CANVAS_WIDTH / 2 - this.width / 2;
        this.y = CANVAS_HEIGHT - LANE_HEIGHT / 2 - this.height / 2;
        this.speed = 5;
        this.color = this.color || COLORS.cyan;
        this.reachedTop = false;
    }

    update() {
        if (keys['ArrowUp'] || keys['w']) this.y -= this.speed;
        if (keys['ArrowDown'] || keys['s']) this.y += this.speed;
        if (keys['ArrowLeft'] || keys['a']) this.x -= this.speed;
        if (keys['ArrowRight'] || keys['d']) this.x += this.speed;

        // Keep in bounds
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > CANVAS_WIDTH) this.x = CANVAS_WIDTH - this.width;
        if (this.y + this.height > CANVAS_HEIGHT) this.y = CANVAS_HEIGHT - this.height;

        // Check win (cross top boundary)
        if (this.y < 40 && !this.reachedTop) {
            this.reachedTop = true;
            winGame();
        }
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Inner detail
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
        ctx.restore();
    }
}

class Obstacle {
    constructor(lane) {
        this.lane = lane;
        this.width = Math.random() * 60 + 40;
        this.height = OBSTACLE_HEIGHT;
        this.y = lane * LANE_HEIGHT + (LANE_HEIGHT - this.height) / 2;
        
        
        // Direction based on lane (alternating)
        this.direction = (lane % 2 === 0) ? 1 : -1;
        
        // Incorporate base difficulty from slider (1-10)
        const difficultyMultiplier = 1 + (baseDifficulty - 1) * 0.15;
        this.speed = (Math.random() * 2 + 1.5) * (1 + (level - 1) * 0.2) * difficultyMultiplier;
        
        if (this.direction === 1) {
            this.x = -this.width - Math.random() * 300;
        } else {
            this.x = CANVAS_WIDTH + Math.random() * 300;
        }

        const colors = [COLORS.magenta, COLORS.yellow, COLORS.red];
        this.color = colors[lane % colors.length];
    }

    update() {
        this.x += this.speed * this.direction;

        // Wrap around
        if (this.direction === 1 && this.x > CANVAS_WIDTH) {
            this.x = -this.width - Math.random() * 200;
            this.speed = (Math.random() * 2 + 1.5) * (1 + (level - 1) * 0.2);
        } else if (this.direction === -1 && this.x + this.width < 0) {
            this.x = CANVAS_WIDTH + Math.random() * 200;
            this.speed = (Math.random() * 2 + 1.5) * (1 + (level - 1) * 0.2);
        }
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        
        // Use roundRect if available, otherwise fallback
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(this.x, this.y, this.width, this.height, 5);
            ctx.fill();
        } else {
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        
        // Glow effect inner
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, 5);
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- Game Functions ---

function init() {
    player = new Player();
    obstacles = [];
    // Lanes 1 to 7 are for obstacles (0 is top goal, 8 is bottom starting)
    for (let i = 1; i < LANES; i++) {
        // 2-3 obstacles per lane
        const count = Math.floor(Math.random() * 2) + 2;
        for (let j = 0; j < count; j++) {
            obstacles.push(new Obstacle(i));
        }
    }
}

function handleInput() {
    window.onkeydown = (e) => keys[e.key] = true;
    window.onkeyup = (e) => keys[e.key] = false;
}

function checkCollisions() {
    for (let obs of obstacles) {
        if (player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y) {
            handleHit();
        }
    }
}

function handleHit() {
    // Create explosion
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(player.x + player.width / 2, player.y + player.height / 2, player.color));
    }
    
    if (!infiniteLives) {
        lives--;
        livesVal.innerText = lives;
    } else {
        livesVal.innerText = '∞';
    }
    
    if (lives <= 0) {
        endGame();
    } else {
        player.reset();
    }
}

function winGame() {
    gameState = 'WIN';
    score += level * 100;
    scoreVal.innerText = score;
    winScoreVal.innerText = score;
    winOverlay.classList.remove('hidden');
}

function endGame() {
    gameState = 'GAMEOVER';
    finalScoreVal.innerText = score;
    gameOverOverlay.classList.remove('hidden');
}

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    level = 1;
    lives = infiniteLives ? '∞' : 3;
    scoreVal.innerText = score;
    levelVal.innerText = level;
    livesVal.innerText = lives;
    menuOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    winOverlay.classList.add('hidden');
    player.reset();
    init();
}

function nextLevel() {
    level++;
    levelVal.innerText = level;
    gameState = 'PLAYING';
    winOverlay.classList.add('hidden');
    player.reset();
    init(); // Regenerate obstacles with higher speed
}

function drawBackground() {
    // Basic lanes
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let i = 0; i <= LANES; i++) {
        const y = i * LANE_HEIGHT;
        
        // Lane markers
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.setLineDash([20, 20]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Goal zone
        if (i === 0) {
            ctx.fillStyle = 'rgba(57, 255, 20, 0.1)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, 40);
            ctx.strokeStyle = COLORS.green;
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, CANVAS_WIDTH, 40);
        }
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBackground();

    if (gameState === 'PLAYING') {
        player.update();
        checkCollisions();
        
        obstacles.forEach(obs => {
            obs.update();
            obs.draw();
        });
        
        player.draw();
    } else {
        // Keep drawing obstacles in background
        obstacles.forEach(obs => {
            obs.update();
            obs.draw();
        });
    }

    // Particles always updated
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---

startBtn.onclick = startGame;
restartBtn.onclick = startGame;
nextBtn.onclick = nextLevel;

// New logic event listeners
controlRestartBtn.onclick = startGame;

difficultySlider.oninput = (e) => {
    baseDifficulty = parseInt(e.target.value);
    difficultyVal.innerText = baseDifficulty;
    // Update existing obstacles speeds
    obstacles.forEach(obs => {
        const difficultyMultiplier = 1 + (baseDifficulty - 1) * 0.15;
        obs.speed = (Math.random() * 2 + 1.5) * (1 + (level - 1) * 0.2) * difficultyMultiplier;
    });
};

infLivesToggle.onchange = (e) => {
    infiniteLives = e.target.checked;
    if (infiniteLives) {
        livesVal.innerText = '∞';
    } else {
        if (typeof lives !== 'number') lives = 3; // Reset if it was infinity
        livesVal.innerText = lives;
    }
};

colorPicker.oninput = (e) => {
    if (player) {
        player.color = e.target.value;
    }
};

handleInput();
init();
gameLoop();
