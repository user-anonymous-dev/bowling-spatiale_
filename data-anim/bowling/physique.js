/**
 * SPATIAL BOWLING - V4 VISUELLE (CORRIGÉE)
 */

const { Engine, Bodies, Composite, Body, Events, Vector, World } = Matter;

// --- INITIALISATION DU MOTEUR ---
const engine = Engine.create();
engine.world.gravity.y = 0;

// --- CANVAS ---
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- VARIABLES ---
let particles = [];
let astreTrail = [];
let currentAstre = null;
let currentPins = [];
const IMAGES = {};

// --- CHARGEMENT D'IMAGES (Optionnel) ---
function loadImg(url) {
    if (IMAGES[url]) return IMAGES[url];
    const img = new Image();
    img.src = url;
    IMAGES[url] = img;
    return img;
}

// --- CONFIGURATION DE LA SCÈNE ---
function setupScene(data) {
    World.clear(engine.world);
    particles = [];
    astreTrail = [];
    
    // 1. QUILLES
    currentPins = [];
    for (let i = 0; i < data.z; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        const pin = Bodies.rectangle(
            window.innerWidth * 0.7 + (row * 40), 
            window.innerHeight / 2 + (col * 50) - (row * 25),
            20, 40, { restitution: 0.5, frictionAir: 0.02 }
        );
        currentPins.push(pin);
    }
    Composite.add(engine.world, currentPins);

    // 2. ASTRE
    const radius = Math.max(30, Math.min(data.kg / 2, 100));
    currentAstre = Bodies.circle(150, window.innerHeight / 2, radius, {
        mass: data.kg, restitution: 0.6, frictionAir: 0.005
    });
    currentAstre.color = "#06B6D4"; // Couleur de secours
    currentAstre.sprite = data.type; // Pour le chargement d'image
    
    Composite.add(engine.world, currentAstre);

    // 3. LANCEMENT
    setTimeout(() => {
        const force = (data.lvl * currentAstre.mass) / 2000;
        Body.applyForce(currentAstre, currentAstre.position, { x: force, y: 0 });
    }, 500);
}

// --- BOUCLE DE RENDU ---
function draw() {
    Engine.update(engine);

    // Fond
    ctx.fillStyle = '#0a0a0f'; // Bleu nuit très foncé
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Effet de Glow (Traînée)
    if (currentAstre) {
        astreTrail.push({ x: currentAstre.position.x, y: currentAstre.position.y, a: 1 });
        if (astreTrail.length > 20) astreTrail.shift();
        
        ctx.beginPath();
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = currentAstre.circleRadius;
        ctx.lineCap = 'round';
        astreTrail.forEach((p, i) => {
            ctx.globalAlpha = i / astreTrail.length;
            ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Dessiner les Quilles
    ctx.fillStyle = '#8B5CF6';
    currentPins.forEach(pin => {
        ctx.save();
        ctx.translate(pin.position.x, pin.position.y);
        ctx.rotate(pin.angle);
        ctx.fillRect(-10, -20, 20, 40); // Rectangle simple si pas d'image
        ctx.restore();
    });

    // Dessiner l'Astre
    if (currentAstre) {
        ctx.save();
        ctx.translate(currentAstre.position.x, currentAstre.position.y);
        ctx.rotate(currentAstre.angle);
        
        // Cercle stylisé (Glow)
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#06B6D4';
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.arc(0, 0, currentAstre.circleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    requestAnimationFrame(draw);
}

// --- GESTIONNAIRE DE MESSAGES ---
window.addEventListener('message', (e) => {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof e.data === 'string' ? e.data.match(regex) : null;
    if (m) setupScene({ kg: +m[1], type: m[2].trim(), lvl: +m[3], z: +m[4] });
});

// --- DÉMARRAGE ---
draw();

// FONCTION DE TEST (S'exécute tout de suite pour vérifier que ça marche)
setupScene({ kg: 50, type: 'Neutron', lvl: 10, z: 15 });
