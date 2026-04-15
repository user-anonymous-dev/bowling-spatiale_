/**
 * SPATIAL BOWLING - MOTEUR PHYSIQUE AVANCÉ
 * Focus : Collisions réalistes, Énergie cinétique et Effets visuels
 */

// --- 1. CONFIGURATION ET EXTRACTION DES OUTILS ---
// Correction de l'erreur : On extrait explicitement Events et Vector depuis Matter
const { 
    Engine, Render, Runner, Bodies, Composite, 
    Body, Events, Vector, Bounds 
} = Matter;

const engine = Engine.create({
    positionIterations: 16, // Haute précision pour éviter que les objets passent à travers les murs
    velocityIterations: 16
});
engine.world.gravity.y = 0; // Environnement spatial

const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent' // Le fond est géré par le CSS
    }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// --- 2. VARIABLES D'ÉTAT ET FILTRES ---
const CAT_WALL = 0x0001, CAT_PIN = 0x0002, CAT_ASTRE = 0x0004;
const ctx = render.context;

let particles = [];
let shockwaves = [];
let astreTrail = [];
let screenShake = { x: 0, y: 0, decay: 0 };
let currentAstre = null;
let bulletTimeTimeout = null;

// --- 3. LIMITES DE LA PISTE ---
const wallOptions = { 
    isStatic: true, 
    restitution: 0.9, 
    friction: 0.05,
    collisionFilter: { category: CAT_WALL }
};
const thickness = 100;
const walls = [
    Bodies.rectangle(window.innerWidth/2, -thickness/2, window.innerWidth * 2, thickness, wallOptions),
    Bodies.rectangle(window.innerWidth/2, window.innerHeight + thickness/2, window.innerWidth * 2, thickness, wallOptions),
    Bodies.rectangle(window.innerWidth + thickness/2, window.innerHeight/2, thickness, window.innerHeight * 2, wallOptions),
    Bodies.rectangle(-thickness/2, window.innerHeight/2, thickness, window.innerHeight * 2, wallOptions)
];
Composite.add(engine.world, walls);

// --- 4. LOGIQUE DE JEU ---
window.addEventListener('message', (e) => {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof e.data === 'string' ? e.data.match(regex) : null;
    if (m) initGame({ kg: parseInt(m[1]), type: m[2].trim(), lvl: parseInt(m[3]), z: parseInt(m[4]) });
});

function initGame(data) {
    // Nettoyage complet
    const allBodies = Composite.allBodies(engine.world);
    allBodies.forEach(b => { if(!b.isStatic) Composite.remove(engine.world, b); });
    particles = []; shockwaves = []; astreTrail = [];
    engine.timing.timeScale = 1;

    // UI
    document.getElementById('u-kg').innerText = data.kg + " kg";
    document.getElementById('u-type').innerText = data.type;
    document.getElementById('u-lvl').innerText = "Lvl " + data.lvl;
    document.getElementById('u-z').innerText = "Z" + data.z;

    // Création des quilles composites (plus réalistes au basculement)
    const pins = [];
    const pinCount = Math.min(data.z, 45);
    const startX = window.innerWidth * 0.7;
    const startY = window.innerHeight / 2;

    for (let i = 0; i < pinCount; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        let px = startX + (row * 40), py = startY + (col * 48) - (row * 24);

        const base = Bodies.rectangle(px, py + 8, 20, 24);
        const head = Bodies.circle(px, py - 12, 10);
        
        const pin = Body.create({
            parts: [base, head],
            restitution: 0.6,
            frictionAir: 0.012,
            collisionFilter: { category: CAT_PIN },
            render: { fillStyle: '#8B5CF6', strokeStyle: '#C4B5FD', lineWidth: 2 }
        });
        pins.push(pin);
    }
    Composite.add(engine.world, pins);

    // Création de l'Astre
    const radius = Math.max(25, Math.min(data.kg / 2.5, 110));
    const name = data.type.toLowerCase().replace(/\s+/g, '-');
    const imgUrl = `https://user-anonymous-dev.github.io/bowling-spatiale_/picture/astres/${name}.png`;

    currentAstre = Bodies.circle(window.innerWidth * 0.1, window.innerHeight / 2, radius, {
        mass: data.kg * 2.5,
        density: 0.08,
        restitution: 0.4,
        collisionFilter: { category: CAT_ASTRE },
        render: { sprite: { texture: imgUrl, xScale: (radius * 2.2) / 100, yScale: (radius * 2.2) / 100 } }
    });

    Composite.add(engine.world, currentAstre);

    // Lancement
    const forceMagnitude = (data.lvl * currentAstre.mass) / 3200;
    setTimeout(() => {
        Body.applyForce(currentAstre, currentAstre.position, { 
            x: forceMagnitude, 
            y: (Math.random() - 0.5) * (forceMagnitude * 0.1) 
        });
        Body.setAngularVelocity(currentAstre, 0.15);
    }, 500);
}

// --- 5. SYSTÈME DE COLLISION AVANCÉ ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
        const { bodyA, bodyB, collision } = pair;
        const contactPoint = collision.supports[0];
        if (!contactPoint) return;

        // Calcul de l'énergie cinétique relative
        const relVel = Vector.sub(bodyA.velocity, bodyB.velocity);
        const speedSq = Vector.magnitudeSquared(relVel);
        const energy = 0.5 * ((bodyA.mass * bodyB.mass) / (bodyA.mass + bodyB.mass)) * speedSq;

        if (energy > 30) {
            // Étincelles
            spawnParticles(contactPoint, relVel, energy / 15, 'spark');
            
            // Si l'impact est massif (Astre vs Quille)
            if (energy > 400) {
                shockwaves.push({ x: contactPoint.x, y: contactPoint.y, radius: 5, alpha: 1, force: energy / 80 });
                triggerScreenShake(energy / 120);
                
                // Bullet Time
                engine.timing.timeScale = Math.max(0.15, 1 - (energy / 4000));
                if (bulletTimeTimeout) clearTimeout(bulletTimeTimeout);
                bulletTimeTimeout = setTimeout(() => engine.timing.timeScale = 1, 400);
            }
        }
    });
});

// --- 6. PHYSIQUE GLOBALE ET RENDU ---
Events.on(engine, 'beforeUpdate', () => {
    if (!currentAstre) return;
    
    // Gravité orbitale légère
    Composite.allBodies(engine.world).forEach(body => {
        if (body.collisionFilter.category === CAT_PIN) {
            const diff = Vector.sub(currentAstre.position, body.position);
            const distSq = Vector.magnitudeSquared(diff);
            if (distSq < 150000 && distSq > 500) {
                const f = Vector.mult(Vector.normalise(diff), (currentAstre.mass * 0.000004) / distSq);
                Body.applyForce(body, body.position, f);
            }
        }
    });

    // Trail de l'astre
    if (Vector.magnitude(currentAstre.velocity) > 1.5) {
        astreTrail.push({ ...currentAstre.position, alpha: 1 });
        if (astreTrail.length > 20) astreTrail.shift();
    }
});

Events.on(render, 'afterRender', () => {
    // Screen Shake
    if (screenShake.decay > 0.1) {
        const sx = (Math.random() - 0.5) * screenShake.decay;
        const sy = (Math.random() - 0.5) * screenShake.decay;
        Bounds.translate(render.bounds, { x: sx, y: sy });
        screenShake.decay *= 0.92;
    }

    // Shockwaves
    shockwaves.forEach((sw, i) => {
        sw.radius += 5; sw.alpha -= 0.04;
        ctx.strokeStyle = `rgba(255,255,255,${sw.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI*2); ctx.stroke();
        if (sw.alpha <= 0) shockwaves.splice(i, 1);
    });

    // Particules
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        if (p.life <= 0) particles.splice(i, 1);
    });
    ctx.globalAlpha = 1;
});

function spawnParticles(pos, vel, count, type) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: pos.x, y: pos.y,
            vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
            life: 1, size: Math.random() * 3 + 1,
            color: type === 'spark' ? '#06B6D4' : '#8B5CF6'
        });
    }
}

function triggerScreenShake(amt) { screenShake.decay = Math.min(amt, 20); }

window.addEventListener('resize', () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
});
