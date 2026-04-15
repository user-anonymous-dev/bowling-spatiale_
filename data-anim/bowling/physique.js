/**
 * SPATIAL BOWLING - V10 (PRECISION & IMPACT)
 */

const { Engine, Bodies, Composite, Body, Events, Vector } = Matter;

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
    Composite.clear(engine.world);
    particles = []; astreTrail = []; gameResult = "";
    gameState = "WAITING";
    
    // 1. L'ASTRE (Placé au centre vertical)
    const radius = Math.max(30, Math.min(data.kg / 2.2, 100));
    currentAstre = Bodies.circle(100, canvas.height / 2, radius, {
        mass: data.kg, restitution: 0.4, frictionAir: 0.005
    });

    // 2. LES QUILLES (Recentrées pour être impossibles à louper)
    currentPins = [];
    const pinCount = Math.min(15 + Math.floor(data.z / 500), 50); // On limite le nombre pour éviter le lag
    const pinMass = (data.kg / 5) * (1 + (data.z / 1000)); 

    const startX = canvas.width * 0.6;
    const centerY = canvas.height / 2;

    for (let i = 0; i < pinCount; i++) {
        // Formation en triangle mais resserrée sur l'axe Y
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        
        const pin = Bodies.rectangle(
            startX + (row * 35), 
            centerY + (col * 45) - (row * 22.5),
            20, 42, { restitution: 0.3, friction: 0.8 }
        );
        Body.setMass(pin, pinMass);
        currentPins.push(pin);
    }
    
    Composite.add(engine.world, [currentAstre, ...currentPins]);

    // 3. LANCEMENT (Visée laser sur le centre des quilles)
    setTimeout(() => {
        gameState = "LAUNCHED";
        // Force calculée pour être plus impactante
        const forceMagnitude = (data.lvl * data.kg) / 4000;
        
        // On pousse l'astre pile vers le centre des quilles
        Body.applyForce(currentAstre, currentAstre.position, { x: forceMagnitude, y: 0 });
        timerResult = Date.now() + 5000;
    }, 800);
}

// Rendu des explosions d'impact
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
        const pos = pair.collision.supports[0];
        if (pos) {
            for (let i = 0; i < 8; i++) {
                particles.push({
                    x: pos.x, y: pos.y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    life: 1, color: '#22D3EE'
                });
            }
        }
    });
});

function draw() {
    Engine.update(engine, 16.66);
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Traînée
    if (currentAstre && gameState === "LAUNCHED") {
        astreTrail.push({ x: currentAstre.position.x, y: currentAstre.position.y });
        if (astreTrail.length > 20) astreTrail.shift();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
        ctx.lineWidth = currentAstre.circleRadius;
        astreTrail.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    }

    // Dessin Objets
    currentPins.forEach(pin => {
        const isDown = Math.abs(pin.angle) > 1.0;
        ctx.save();
        ctx.translate(pin.position.x, pin.position.y);
        ctx.rotate(pin.angle);
        ctx.fillStyle = isDown ? '#334155' : '#8B5CF6';
        ctx.fillRect(-10, -21, 20, 42);
        ctx.restore();
    });

    if (currentAstre) {
        ctx.save();
        ctx.translate(currentAstre.position.x, currentAstre.position.y);
        ctx.shadowBlur = 15; ctx.shadowColor = '#22D3EE';
        ctx.fillStyle = '#22D3EE';
        ctx.beginPath(); ctx.arc(0, 0, currentAstre.circleRadius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    // Particules
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
        if (p.life <= 0) particles.splice(i, 1);
    });
    ctx.globalAlpha = 1;

    // Logique de fin
    if (gameState === "LAUNCHED" && Date.now() > timerResult) {
        let fallen = currentPins.filter(p => Math.abs(p.angle) > 1.0 || p.position.x > canvas.width * 0.8).length;
        const ratio = fallen / currentPins.length;
        if (ratio >= 0.9) gameResult = "STRIKE !";
        else if (ratio > 0.1) gameResult = "IMPACT !";
        else gameResult = "LOUPE...";
        gameState = "ENDED";
    }

    if (gameState === "ENDED") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center"; ctx.fillStyle = "white";
        ctx.font = "bold 50px sans-serif";
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
