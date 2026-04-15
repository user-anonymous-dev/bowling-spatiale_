/**
 * SPATIAL BOWLING - V9 (DEBUG & POWER)
 * Si c'est noir, vérifie la console (F12)
 */

// On s'assure que Matter est chargé
if (typeof Matter === 'undefined') {
    console.error("ERREUR : Matter.js n'est pas chargé ! Vérifie ton fichier HTML.");
}

const { Engine, Bodies, Composite, Body, Events, Vector } = Matter;

const engine = Engine.create();
engine.world.gravity.y = 0;

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

// Style pour que le canvas soit bien visible
canvas.style.position = "fixed";
canvas.style.top = "0";
canvas.style.left = "0";
canvas.style.background = "#050508";

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

console.log("Moteur physique prêt.");

function setupScene(data) {
    console.log("Initialisation scène :", data);
    Composite.clear(engine.world);
    particles = [];
    astreTrail = [];
    gameResult = "";
    gameState = "WAITING";
    
    // 1. L'ASTRE
    const radius = Math.max(25, Math.min(data.kg / 2.5, 90));
    currentAstre = Bodies.circle(150, window.innerHeight / 2, radius, {
        mass: data.kg, 
        restitution: 0.5, 
        frictionAir: 0.005,
        label: "Astre"
    });

    // 2. LES QUILLES (Le mur Z)
    currentPins = [];
    const pinCount = Math.min(10 + Math.floor(data.z / 15), 40);
    // Résistance augmentée pour le challenge
    const pinMass = (data.kg / 8) * (1 + (data.z / 100)); 

    for (let i = 0; i < pinCount; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        const pin = Bodies.rectangle(
            window.innerWidth * 0.7 + (row * 45), 
            window.innerHeight / 2 + (col * 55) - (row * 27),
            20, 45, { restitution: 0.4, friction: 0.5 }
        );
        Body.setMass(pin, pinMass);
        currentPins.push(pin);
    }
    
    Composite.add(engine.world, [currentAstre, ...currentPins]);

    // 3. LANCEMENT
    setTimeout(() => {
        gameState = "LAUNCHED";
        const forceMagnitude = (data.lvl * data.kg) / 2500;
        Body.applyForce(currentAstre, currentAstre.position, { x: forceMagnitude, y: 0 });
        timerResult = Date.now() + 5000;
    }, 800);
}

// Détection des chocs pour les particules
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
        const impactPos = pair.collision.supports[0];
        if (impactPos) {
            for (let i = 0; i < 5; i++) {
                particles.push({
                    x: impactPos.x, y: impactPos.y,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    life: 1,
                    color: '#22D3EE'
                });
            }
        }
    });
});

function draw() {
    Engine.update(engine, 16.66);

    // Effacement
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Traînée
    if (currentAstre && gameState !== "ENDED") {
        astreTrail.push({ x: currentAstre.position.x, y: currentAstre.position.y });
        if (astreTrail.length > 20) astreTrail.shift();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
        ctx.lineWidth = currentAstre.circleRadius;
        astreTrail.forEach((p, i) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    }

    // Particules
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.03;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
        if (p.life <= 0) particles.splice(i, 1);
    });
    ctx.globalAlpha = 1;

    // Quilles
    currentPins.forEach(pin => {
        const isDown = Math.abs(pin.angle) > 0.6;
        ctx.save();
        ctx.translate(pin.position.x, pin.position.y);
        ctx.rotate(pin.angle);
        ctx.fillStyle = isDown ? '#334155' : '#8B5CF6';
        ctx.fillRect(-10, -22, 20, 44);
        ctx.restore();
    });

    // Astre
    if (currentAstre) {
        ctx.save();
        ctx.translate(currentAstre.position.x, currentAstre.position.y);
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#22D3EE';
        ctx.fillStyle = '#22D3EE';
        ctx.beginPath();
        ctx.arc(0, 0, currentAstre.circleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // UI Score
    if (gameState === "LAUNCHED" && Date.now() > timerResult) {
        let fallen = currentPins.filter(p => Math.abs(p.angle) > 0.6 || p.position.x > window.innerWidth * 0.8).length;
        const ratio = fallen / currentPins.length;
        gameResult = ratio >= 0.9 ? "STRIKE !" : (ratio > 0.4 ? "BIEN !" : "ÉCHEC");
        gameState = "ENDED";
    }

    if (gameState === "ENDED") {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "bold 50px Arial";
        ctx.fillText(gameResult, canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(draw);
}

window.addEventListener('message', (e) => {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof e.data === 'string' ? e.data.match(regex) : null;
    if (m) setupScene({ kg: +m[1], type: m[2], lvl: +m[3], z: +m[4] });
});

draw();

// Test immédiat (Lvl 1 vs Z458)
setupScene({ kg: 120, type: 'Terre', lvl: 1, z: 458 });
