/**
 * SPATIAL BOWLING - V7 (BALANCED EDITION)
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

let particles = [];
let astreTrail = [];
let currentAstre = null;
let currentPins = [];
let gameState = "WAITING";
let gameResult = "";
let timerResult = 0;

function setupScene(data) {
    World.clear(engine.world);
    particles = [];
    astreTrail = [];
    gameResult = "";
    gameState = "WAITING";
    
    // --- EQUILIBRAGE DES QUILLES (Z) ---
    currentPins = [];
    const pinCount = Math.min(10 + Math.floor(data.z / 4), 35);
    
    // Formule corrigée : la densité augmente moins violemment
    const pinDensity = 0.001 + (Math.log10(data.z + 1) * 0.002); 
    
    for (let i = 0; i < pinCount; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        const pin = Bodies.rectangle(
            window.innerWidth * 0.7 + (row * 42), 
            window.innerHeight / 2 + (col * 52) - (row * 26),
            22, 44, { 
                restitution: 0.7, // Plus de rebond pour aider à la réaction en chaîne
                density: pinDensity,
                frictionAir: 0.03
            }
        );
        currentPins.push(pin);
    }
    Composite.add(engine.world, currentPins);

    // --- EQUILIBRAGE DE L'ASTRE (KG / LVL) ---
    const radius = Math.max(30, Math.min(data.kg / 2.2, 100));
    currentAstre = Bodies.circle(150, window.innerHeight / 2, radius, {
        mass: data.kg, 
        restitution: 0.6, 
        frictionAir: 0.002
    });
    Composite.add(engine.world, currentAstre);

    // --- LANCEMENT (Plus de punch au démarrage) ---
    setTimeout(() => {
        gameState = "LAUNCHED";
        // Ajout d'une force de base (+10 au niveau) pour éviter le côté "mou"
        const forceMagnitude = ((data.lvl + 10) * data.kg) / 3500;
        Body.applyForce(currentAstre, currentAstre.position, { x: forceMagnitude, y: 0 });
        
        timerResult = Date.now() + 5000; // 5 secondes pour le verdict
    }, 1000);
}

function checkScore() {
    let fallen = 0;
    currentPins.forEach(p => {
        // Une quille est "tombée" si elle a bougé de son axe d'origine ou basculé
        const isFallen = Math.abs(p.angle) > 0.5 || p.position.x > window.innerWidth * 0.75;
        if (isFallen) fallen++;
    });

    const ratio = fallen / currentPins.length;
    
    if (ratio >= 0.9) gameResult = "🚀 PERFECT STRIKE!";
    else if (ratio > 0.5) gameResult = "⭐ GREAT SHOT!";
    else if (ratio > 0.1) gameResult = "☄️ JUST A NUDGE";
    else gameResult = "🚫 MISSION FAILED";

    gameState = "ENDED";
}

function draw() {
    Engine.update(engine);

    // Rendu Space
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Trail dynamique
    if (currentAstre && gameState !== "ENDED") {
        astreTrail.push({ x: currentAstre.position.x, y: currentAstre.position.y });
        if (astreTrail.length > 25) astreTrail.shift();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.lineWidth = currentAstre.circleRadius * 1.5;
        ctx.lineCap = 'round';
        astreTrail.forEach((p, i) => {
            ctx.globalAlpha = i / astreTrail.length;
            ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Dessin Quilles
    currentPins.forEach(pin => {
        const isDown = Math.abs(pin.angle) > 0.5;
        ctx.save();
        ctx.translate(pin.position.x, pin.position.y);
        ctx.rotate(pin.angle);
        ctx.fillStyle = isDown ? '#4B5563' : '#A78BFA';
        ctx.shadowBlur = isDown ? 0 : 15;
        ctx.shadowColor = '#8B5CF6';
        ctx.fillRect(-11, -22, 22, 44);
        ctx.restore();
    });

    // Dessin Astre
    if (currentAstre) {
        ctx.save();
        ctx.translate(currentAstre.position.x, currentAstre.position.y);
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#22D3EE';
        ctx.fillStyle = '#22D3EE';
        ctx.beginPath(); ctx.arc(0, 0, currentAstre.circleRadius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    // Gestion de l'UI
    if (gameState === "LAUNCHED" && Date.now() > timerResult) checkScore();

    if (gameState === "ENDED") {
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = "bold 50px 'Segoe UI', Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = gameResult.includes("FAILED") ? "#F87171" : "#34D399";
        ctx.fillText(gameResult, canvas.width / 2, canvas.height / 2);
        
        ctx.font = "18px Arial";
        ctx.fillStyle = "#94A3B8";
        ctx.fillText("Nouveau message pour rejouer", canvas.width / 2, canvas.height / 2 + 50);
    }

    requestAnimationFrame(draw);
}

window.addEventListener('message', (e) => {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof e.data === 'string' ? e.data.match(regex) : null;
    if (m) setupScene({ kg: +m[1], type: m[2], lvl: +m[3], z: +m[4] });
});

draw();
