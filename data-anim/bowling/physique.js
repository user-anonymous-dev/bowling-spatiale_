<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Spatial Bowling - Correction</title>
    <style>
        /* Supprime les marges et force le fond noir */
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #050508;
            font-family: 'Segoe UI', Arial, sans-serif;
        }
        canvas {
            display: block;
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>
</head>
<body>

<script>
/**
 * SPATIAL BOWLING - V11 (CORRECTIF QUILLES GRISES & HTML COMPLET)
 */

const { Engine, Bodies, Composite, Body, Events, Vector } = Matter;

const engine = Engine.create();
engine.world.gravity.y = 0; // Zéro gravité

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Variables globales
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
    
    // 1. L'ASTRE
    const radius = Math.max(30, Math.min(data.kg / 2.2, 100));
    currentAstre = Bodies.circle(100, canvas.height / 2, radius, {
        mass: data.kg, restitution: 0.4, frictionAir: 0.005
    });

    // 2. LES QUILLES
    currentPins = [];
    const pinCount = Math.min(15 + Math.floor(data.z / 500), 50);
    const pinMass = (data.kg / 5) * (1 + (data.z / 1000)); 

    const startX = canvas.width * 0.6;
    const centerY = canvas.height / 2;

    for (let i = 0; i < pinCount; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        
        const pin = Bodies.rectangle(
            startX + (row * 35), 
            centerY + (col * 45) - (row * 22.5),
            20, 42, { restitution: 0.3, friction: 0.8 }
        );
        Body.setMass(pin, pinMass);
        
        // --- LE FIX EST ICI ---
        // On mémorise la position de départ de la quille et son état
        pin.startX = pin.position.x;
        pin.isDead = false; 

        currentPins.push(pin);
    }
    
    Composite.add(engine.world, [currentAstre, ...currentPins]);

    // 3. LANCEMENT
    setTimeout(() => {
        gameState = "LAUNCHED";
        const forceMagnitude = (data.lvl * data.kg) / 4000;
        Body.applyForce(currentAstre, currentAstre.position, { x: forceMagnitude, y: 0 });
        timerResult = Date.now() + 5000;
    }, 800);
}

// Étincelles à l'impact
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
    
    // Fond d'écran
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Traînée de l'astre
    if (currentAstre && gameState === "LAUNCHED") {
        astreTrail.push({ x: currentAstre.position.x, y: currentAstre.position.y });
        if (astreTrail.length > 20) astreTrail.shift();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
        ctx.lineWidth = currentAstre.circleRadius;
        astreTrail.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    }

    // --- DESSIN DES QUILLES (ET VÉRIFICATION DE LEUR MORT) ---
    currentPins.forEach(pin => {
        // FIX : Une quille est "morte" si elle a tourné OU si elle a reculé de 40 pixels !
        if (Math.abs(pin.angle) > 0.5 || Math.abs(pin.position.x - pin.startX) > 40) {
            pin.isDead = true; 
        }

        ctx.save();
        ctx.translate(pin.position.x, pin.position.y);
        ctx.rotate(pin.angle);
        
        // Si elle est morte, elle devient grise. Sinon, elle reste violette.
        ctx.fillStyle = pin.isDead ? '#334155' : '#8B5CF6';
        
        // Effet de halo lumineux seulement pour les quilles en vie
        if (!pin.isDead) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#8B5CF6';
        }

        ctx.fillRect(-10, -21, 20, 42);
        ctx.restore();
    });

    // Dessin de l'Astre
    if (currentAstre) {
        ctx.save();
        ctx.translate(currentAstre.position.x, currentAstre.position.y);
        ctx.shadowBlur = 20; 
        ctx.shadowColor = '#22D3EE';
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

    // Logique de fin basée EXACTEMENT sur les quilles "mortes" (isDead)
    if (gameState === "LAUNCHED" && Date.now() > timerResult) {
        let fallen = currentPins.filter(p => p.isDead).length;
        const ratio = fallen / currentPins.length;
        
        if (ratio >= 0.95) gameResult = "🚀 STRIKE !";
        else if (ratio > 0.1) gameResult = "⭐ IMPACT !";
        else gameResult = "🚫 LOUPE...";
        
        gameState = "ENDED";
    }

    // Écran de résultat
    if (gameState === "ENDED") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center"; 
        
        ctx.fillStyle = gameResult.includes("LOUPE") ? "#F87171" : "#34D399";
        ctx.font = "bold 55px sans-serif";
        ctx.fillText(gameResult, canvas.width / 2, canvas.height / 2);
        
        ctx.font = "20px sans-serif";
        ctx.fillStyle = "white";
        ctx.fillText("Nouveau message pour rejouer", canvas.width / 2, canvas.height / 2 + 50);
    }

    requestAnimationFrame(draw);
}

// Écoute des messages
window.addEventListener('message', (e) => {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof e.data === 'string' ? e.data.match(regex) : null;
    if (m) setupScene({ kg: +m[1], type: m[2], lvl: +m[3], z: +m[4] });
});

// Lance la boucle de rendu
draw();

// Test initial
setupScene({ kg: 120, type: 'Terre', lvl: 133, z: 44145 });
</script>
</body>
</html>
