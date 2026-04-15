/**
 * SPATIAL BOWLING ENGINE V4 - CINEMATIC VISUALS
 * Focus : Moteur de rendu custom, Sprites, Glowing Trails, Particle Systems.
 */

const { Engine, Bodies, Composite, Body, Events, Vector, World } = Matter;

// --- CONFIGURATION MOTEUR HAUTE PRÉCISION ---
const engine = Engine.create({ positionIterations: 12, velocityIterations: 12 });
engine.world.gravity.y = 0; // Microgravité spatiale

// --- CONFIGURATION CANVAS CUSTOM (Désactivation du Render par défaut) ---
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);

// --- SYSTÈMES VISUELS GLOBAUX ---
let particles = [];
let astreTrail = [];
let currentAstre = null;
let currentPins = [];
const PRELOADED_SPRITES = {}; // Banque d'images

// URLs des images (sprites)
const URL_PINS = 'https://user-anonymous-dev.github.io/bowling-spatiale_/picture/quilles-space.png'; // Remplace par ta quille
const URL_NEBULA = 'https://user-anonymous-dev.github.io/bowling-spatiale_/picture/deep-space-nebula.jpg'; // Fond détaillé

// --- CHARGEMENT DES ASSETS ---
function preloadSprites(types) {
    const imagesToLoad = [URL_PINS, URL_NEBULA];
    types.forEach(t => imagesToLoad.push(`https://user-anonymous-dev.github.io/bowling-spatiale_/picture/astres/${t.toLowerCase().replace(/\s+/g, '-')}.png`));

    imagesToLoad.forEach(url => {
        const img = new Image();
        img.src = url;
        PRELOADED_SPRITES[url] = img;
    });
}

// --- LOGIQUE DE JEU ---
window.addEventListener('message', (e) => {
    const data = parseMessage(e.data);
    if (data) {
        preloadSprites([data.type]);
        setupScene(data);
    }
});

function parseMessage(msg) {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof msg === 'string' ? msg.match(regex) : null;
    return m ? { kg: +m[1], type: m[2].trim().toLowerCase(), lvl: +m[3], z: +m[4] } : null;
}

function setupScene(data) {
    // Nettoyage
    World.clear(engine.world);
    Engine.clear(engine);
    particles = []; astreTrail = []; currentAstre = null; currentPins = [];

    // 1. GÉNÉRATION DES QUILLES (Physique uniquement)
    currentPins = [];
    const spacing = 45;
    const startX = window.innerWidth * 0.7;
    const startY = window.innerHeight / 2;
    for (let i = 0; i < data.z; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        
        const pin = Bodies.rectangle(
            startX + (row * spacing), 
            startY + (col * spacing * 1.1) - (row * spacing * 0.55),
            22, 48, { restitution: 0.6, frictionAir: 0.012, density: 0.005 }
        );
        currentPins.push(pin);
    }
    Composite.add(engine.world, currentPins);

    // 2. CRÉATION DE L'ASTRE (Physique uniquement)
    const radius = Math.max(30, Math.min(data.kg / 3, 110));
    currentAstre = Bodies.circle(150, window.innerHeight / 2, radius, {
        mass: data.kg * 2.5, density: 0.08, restitution: 0.4, frictionAir: 0.005,
    });
    currentAstre.spriteUrl = `https://user-anonymous-dev.github.io/bowling-spatiale_/picture/astres/${data.type.replace(/\s+/g, '-')}.png`;
    
    Composite.add(engine.world, currentAstre);

    // 3. LANCEMENT
    const force = (data.lvl * currentAstre.mass) / 3000;
    setTimeout(() => {
        Body.applyForce(currentAstre, currentAstre.position, { x: force, y: (Math.random() - 0.5) * (force * 0.15) });
        Body.setAngularVelocity(currentAstre, 0.1);
    }, 500);
}

// --- SYSTÈME DE COLLISION VISUEL ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
        const energy = 0.5 * pair.bodyA.mass * Math.pow(Vector.magnitude(pair.bodyA.velocity), 2);
        if (energy > 50) {
            const pos = pair.collision.supports[0] || pair.collision.supports[1];
            if (pos) createImpactEffect(pos, energy);
        }
    });
});

function createImpactEffect(pos, energy) {
    // Éclats (additive blending pour le glow)
    const count = Math.min(energy / 15, 40);
    for (let i = 0; i < count; i++) {
        particles.push({
            x: pos.x, y: pos.y,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            life: 1, size: Math.random() * 4 + 1,
            color: (Math.random() > 0.5) ? '#06B6D4' : '#8B5CF6' // Cyan/Purple
        });
    }
}

// --- BOUCLE DE RENDU CINÉMATIQUE CUSTOM ---
function gameLoop() {
    // 1. Mise à jour physique
    Engine.update(engine);

    // 2. Effacer le canvas (Noir)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Dessiner le fond Nebula (si chargé)
    if (PRELOADED_SPRITES[URL_NEBULA]) {
        ctx.drawImage(PRELOADED_SPRITES[URL_NEBULA], 0, 0, canvas.width, canvas.height);
    }

    // 4. Dessiner la Traînée lumineuse de l'Astre (Mode Additif)
    ctx.globalCompositeOperation = 'lighter'; // GLOW
    if (currentAstre) {
        astreTrail.push({ ...currentAstre.position, a: 1 });
        if (astreTrail.length > 25) astreTrail.shift();
        
        ctx.beginPath();
        ctx.moveTo(astreTrail[0].x, astreTrail[0].y);
        for (let i = 1; i < astreTrail.length; i++) {
            ctx.lineTo(astreTrail[i].x, astreTrail[i].y);
            astreTrail[i].a -= 0.04; // Fade out
        }
        ctx.strokeStyle = '#06B6D4'; // Cyan
        ctx.lineWidth = currentAstre.circleRadius * 0.8;
        ctx.lineCap = 'round'; ctx.stroke();
    }

    // 5. Dessiner les Particules (GLOW)
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        if (p.life <= 0) particles.splice(i, 1);
    });

    // 6. Dessiner les Objets (sprites normaux)
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Dessiner l'Astre (Sprite Rotated)
    if (currentAstre && PRELOADED_SPRITES[currentAstre.spriteUrl]) {
        const img = PRELOADED_SPRITES[currentAstre.spriteUrl];
        const r = currentAstre.circleRadius;
        ctx.save();
        ctx.translate(currentAstre.position.x, currentAstre.position.y);
        ctx.rotate(currentAstre.angle);
        ctx.drawImage(img, -r * 1.1, -r * 1.1, r * 2.2, r * 2.2);
        ctx.restore();
    }

    // Dessiner les Quilles (Sprite Rotated)
    if (PRELOADED_SPRITES[URL_PINS]) {
        const img = PRELOADED_SPRITES[URL_PINS];
        currentPins.forEach(pin => {
            // On récupère les dimensions réelles définies en physique
            const w = pin.bounds.max.x - pin.bounds.min.x;
            const h = pin.bounds.max.y - pin.bounds.min.y;
            ctx.save();
            ctx.translate(pin.position.x, pin.position.y);
            ctx.rotate(pin.angle);
            // On dessine l'image avec un léger offset pour centrer
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
        });
    }

    requestAnimationFrame(gameLoop);
}

// Lancement de la boucle
gameLoop();

// Resize dynamique
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
