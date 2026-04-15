/**
 * SPATIAL BOWLING - V6 (FINALE : WIN/LOSS SYSTEM)
 */

const { Engine, Bodies, Composite, Body, Events, Vector, World } = Matter;

const engine = Engine.create();
engine.world.gravity.y = 0;

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- VARIABLES DE JEU ---
let particles = [];
let astreTrail = [];
let currentAstre = null;
let currentPins = [];
let gameState = "WAITING"; // WAITING, LAUNCHED, SCORING, ENDED
let gameResult = "";
let timerResult = 0;

// --- INITIALISATION DU NIVEAU ---
function setupScene(data) {
    World.clear(engine.world);
    particles = [];
    astreTrail = [];
    gameResult = "";
    gameState = "WAITING";
    
    // 1. GÉNÉRATION DES QUILLES
    currentPins = [];
    const pinCount = Math.min(10 + Math.floor(data.z / 3), 40);
    const pinResistance = 0.001 + (data.z * 0.0006);
    
    for (let i = 0; i < pinCount; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        const pin = Bodies.rectangle(
            window.innerWidth * 0.7 + (row * 42), 
            window.innerHeight / 2 + (col * 52) - (row * 26),
            20, 44, { 
                restitution: 0.4, 
                density: pinResistance,
                frictionAir: 0.04
            }
        );
        currentPins.push(pin);
    }
    Composite.add(engine.world, currentPins);

    // 2. GÉNÉRATION DE L'ASTRE
    const radius = Math.max(30, Math.min(data.kg / 2.2, 100));
    currentAstre = Bodies.circle(150, window.innerHeight / 2, radius, {
        mass: data.kg, restitution: 0.5, frictionAir: 0.005
    });
    Composite.add(engine.world, currentAstre);

    // 3. LANCEMENT AUTOMATIQUE
    setTimeout(() => {
        gameState = "LAUNCHED";
        const forceMagnitude = (data.lvl * data.kg) / 4500;
        Body.applyForce(currentAstre, currentAstre.position, { x: forceMagnitude, y: 0 });
        
        // On déclenche le calcul du score après 6 secondes
        timerResult = Date.now() + 6000;
    }, 1000);
}

// --- LOGIQUE DE SCORE ---
function checkScore() {
    let fallen = 0;
    currentPins.forEach(p => {
        // Une quille est tombée si elle a basculé (> 45°) ou si elle a été éjectée loin
        const isFallen = Math.abs(p.angle) > 0.7 || p.position.x > window.innerWidth * 0.85 || p.position.y < 50 || p.position.y > window.innerHeight - 50;
        if (isFallen) fallen++;
    });

    const ratio = fallen / currentPins.length;
    
    if (ratio === 1) gameResult = "PERFECT STRIKE!";
    else if (ratio > 0.6) gameResult = "GREAT SHOT!";
    else if (ratio > 0.3) gameResult = "NOT BAD...";
    else gameResult = "MISSION FAILED";

    gameState = "ENDED";
}

// --- RENDU ---
function draw() {
    Engine.update(engine);

    // Background
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Particules & Trail
    if (currentAstre && gameState !== "ENDED") {
        astreTrail.push({ x: currentAstre.position.x, y: currentAstre.position.y });
        if (astreTrail.length > 20) astreTrail.shift();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.lineWidth = currentAstre.circleRadius;
        astreTrail.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    }

    // Dessin Quilles
    currentPins.forEach(pin => {
        const isDown = Math.abs(pin.angle) > 0.7;
        ctx.save();
        ctx.translate(pin.position.x, pin.position.y);
        ctx.rotate(pin.angle);
        ctx.fillStyle = isDown ? '#4B5563' : '#8B5CF6';
        ctx.shadowBlur = isDown ? 0 : 10;
        ctx.shadowColor = '#8B5CF6';
        ctx.fillRect(-10, -22, 20, 44);
        ctx.restore();
    });

    // Dessin Astre
    if (currentAstre) {
        ctx.save();
        ctx.translate(currentAstre.position.x, currentAstre.position.y);
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#06B6D4';
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath(); ctx.arc(0, 0, currentAstre.circleRadius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    // --- UI OVERLAY ---
    if (gameState === "LAUNCHED" && Date.now() > timerResult) {
        checkScore();
    }

    if (gameState === "ENDED") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = "bold 60px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = gameResult.includes("FAILED") ? "#EF4444" : "#10B981";
        ctx.shadowBlur = 20;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(gameResult, canvas.width / 2, canvas.height / 2);
        
        ctx.font = "20px Arial";
        ctx.fillStyle = "white";
        ctx.fillText("Envoyez un nouveau message pour rejouer", canvas.width / 2, canvas.height / 2 + 60);
    }

    requestAnimationFrame(draw);
}

// --- MESSAGES ---
window.addEventListener('message', (e) => {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof e.data === 'string' ? e.data.match(regex) : null;
    if (m) setupScene({ kg: +m[1], type: m[2], lvl: +m[3], z: +m[4] });
});

draw();

// Test initial
setupScene({ kg: 60, type: 'Neutron', lvl: 8, z: 15 });
