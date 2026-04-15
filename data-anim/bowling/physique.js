// --- CONFIGURATION AVANCÉE DU MOTEUR ---
const { Engine, Render, Runner, Bodies, Composite, Body, Events, Vector, Bounds } = Matter;

const engine = Engine.create({
    positionIterations: 16, // Précision extrême pour éviter le clipping
    velocityIterations: 16,
    constraintIterations: 8
});
engine.world.gravity.y = 0; // Microgravité spatiale
engine.world.gravity.x = 0;

const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent',
        hasBounds: true // Permet les effets de caméra si besoin
    }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// --- FILTRES DE COLLISION (Optimisation) ---
const CAT_WALL = 0x0001, CAT_PIN = 0x0002, CAT_ASTRE = 0x0004;

// --- GESTION DES EFFETS VISUELS CUSTOM ---
const ctx = render.context;
let particles = [];
let astreTrail = [];
let bulletTimeTimeout = null;
let currentAstre = null;

// --- LIMITES DE LA PISTE ---
const thickness = 100;
const wallOptions = { 
    isStatic: true, 
    restitution: 0.9, // Rebond fort
    friction: 0.1,
    collisionFilter: { category: CAT_WALL }
};
const walls = [
    Bodies.rectangle(window.innerWidth/2, -thickness/2, window.innerWidth * 2, thickness, wallOptions),
    Bodies.rectangle(window.innerWidth/2, window.innerHeight + thickness/2, window.innerWidth * 2, thickness, wallOptions),
    Bodies.rectangle(window.innerWidth + thickness/2, window.innerHeight/2, thickness, window.innerHeight * 2, wallOptions),
    Bodies.rectangle(-thickness/2, window.innerHeight/2, thickness, window.innerHeight * 2, wallOptions)
];
Composite.add(engine.world, walls);

// --- ÉCOUTEUR DE MESSAGES ---
window.addEventListener('message', (e) => {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof e.data === 'string' ? e.data.match(regex) : null;
    if (m) initGame({ kg: parseInt(m[1]), type: m[2].trim(), lvl: parseInt(m[3]), z: parseInt(m[4]) });
});

function initGame(data) {
    // Reset complexe
    const allBodies = Composite.allBodies(engine.world);
    allBodies.forEach(b => { if(!b.isStatic) Composite.remove(engine.world, b); });
    particles = [];
    astreTrail = [];
    engine.timing.timeScale = 1; // Reset bullet time

    // MAJ de l'UI
    document.getElementById('u-kg').innerText = data.kg + " kg";
    document.getElementById('u-type').innerText = data.type;
    document.getElementById('u-lvl').innerText = "Lvl " + data.lvl;
    document.getElementById('u-z').innerText = "Z" + data.z;

    // 1. GÉNÉRATION DES QUILLES COMPLEXES
    const pins = [];
    const pinCount = Math.min(data.z, 50);
    const startX = window.innerWidth * 0.70;
    const startY = window.innerHeight / 2;
    
    for (let i = 0; i < pinCount; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        
        let px = startX + (row * 42);
        let py = startY + (col * 50) - (row * 25);

        // Quille composée : Base lourde rectangulaire + Tête ronde
        const base = Bodies.rectangle(px, py + 8, 20, 24, { render: { visible: false } });
        const head = Bodies.circle(px, py - 12, 10, { render: { visible: false } });
        
        const pin = Body.create({
            parts: [base, head], // Centre de masse dynamique
            restitution: 0.65,
            frictionAir: 0.01,
            density: 0.002,
            collisionFilter: { category: CAT_PIN, mask: CAT_WALL | CAT_PIN | CAT_ASTRE },
            render: {
                fillStyle: '#8B5CF6',
                strokeStyle: '#C4B5FD',
                lineWidth: 2
            }
        });
        pins.push(pin);
    }
    Composite.add(engine.world, pins);

    // 2. GÉNÉRATION DE L'ASTRE (Boule)
    const radius = Math.max(25, Math.min(data.kg / 2.5, 120));
    const name = data.type.toLowerCase().replace(/\s+/g, '-');
    const imgUrl = `https://user-anonymous-dev.github.io/bowling-spatiale_/picture/astres/${name}.png`;

    currentAstre = Bodies.circle(window.innerWidth * 0.1, window.innerHeight / 2, radius, {
        mass: data.kg * 3,
        density: 0.1,
        restitution: 0.3,
        frictionAir: 0.001,
        collisionFilter: { category: CAT_ASTRE, mask: CAT_WALL | CAT_PIN },
        render: { sprite: { texture: imgUrl, xScale: (radius * 2.2) / 100, yScale: (radius * 2.2) / 100 } }
    });

    const img = new Image();
    img.src = imgUrl;
    img.onerror = () => { if (currentAstre.render.sprite) currentAstre.render.sprite.texture = 'https://user-anonymous-dev.github.io/bowling-spatiale_/picture/template-astres.png'; };

    Composite.add(engine.world, currentAstre);

    // 3. PROPULSION (Avec effet de spin)
    const forceMagnitude = (data.lvl * currentAstre.mass) / 3000;
    setTimeout(() => {
        Body.applyForce(currentAstre, currentAstre.position, { 
            x: forceMagnitude, 
            y: (Math.random() - 0.5) * (forceMagnitude * 0.1)
        });
        Body.setAngularVelocity(currentAstre, 0.2);
    }, 500);
}

// --- PHYSIQUE CUSTOM : GRAVITÉ DE L'ASTRE ---
Events.on(engine, 'beforeUpdate', () => {
    if (!currentAstre) return;
    
    // Si l'astre est assez lourd, il attire les quilles proches
    const allBodies = Composite.allBodies(engine.world);
    allBodies.forEach(body => {
        if (body.collisionFilter.category === CAT_PIN) {
            const distanceVector = Vector.sub(currentAstre.position, body.position);
            const distanceSq = Vector.magnitudeSquared(distanceVector);
            
            // Rayon d'attraction
            if (distanceSq < 200000 && distanceSq > 1000) {
                const force = Vector.mult(Vector.normalise(distanceVector), (currentAstre.mass * 0.000005) / distanceSq);
                Body.applyForce(body, body.position, force);
            }
        }
    });

    // Enregistrement de la position pour la traînée
    if (Vector.magnitude(currentAstre.velocity) > 2) {
        astreTrail.push({ x: currentAstre.position.x, y: currentAstre.position.y, alpha: 1 });
        if (astreTrail.length > 20) astreTrail.shift(); // Longueur max de la traînée
    }
});

// --- GESTION DES IMPACTS (Bullet Time & Particules) ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
        const isPin = (pair.bodyA.collisionFilter.category === CAT_PIN || pair.bodyB.collisionFilter.category === CAT_PIN);
        const isAstre = (pair.bodyA === currentAstre || pair.bodyB === currentAstre);
        
        // Impact majeur (Boule vs Quille)
        if (isPin && isAstre) {
            const impactVelocity = Vector.magnitude(Vector.sub(pair.bodyA.velocity, pair.bodyB.velocity));
            
            // Déclenchement d'un système de particules
            if (impactVelocity > 5) spawnParticles(pair.collision.supports[0], impactVelocity);

            // Déclenchement du "Bullet Time" si impact extrêmement fort
            if (impactVelocity > 15) {
                engine.timing.timeScale = 0.2; // Ralenti à 20%
                if (bulletTimeTimeout) clearTimeout(bulletTimeTimeout);
                bulletTimeTimeout = setTimeout(() => {
                    // Retour progressif à la vitesse normale (simplifié)
                    engine.timing.timeScale = 1; 
                }, 800); // 800ms en temps réel
            }
        }
    });
});

// --- RENDU CUSTOM (Canvas API directe) ---
function spawnParticles(point, force) {
    if (!point) return;
    const count = Math.min(Math.floor(force * 2), 30);
    for (let i = 0; i < count; i++) {
        particles.push({
            x: point.x, y: point.y,
            vx: (Math.random() - 0.5) * force,
            vy: (Math.random() - 0.5) * force,
            life: 1.0,
            size: Math.random() * 4 + 1
        });
    }
}

Events.on(render, 'afterRender', () => {
    // 1. Dessiner la traînée de l'astre
    if (astreTrail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(astreTrail[0].x, astreTrail[0].y);
        for (let i = 1; i < astreTrail.length; i++) {
            ctx.lineTo(astreTrail[i].x, astreTrail[i].y);
            astreTrail[i].alpha -= 0.05; // Fade out
        }
        ctx.strokeStyle = `rgba(6, 182, 212, ${astreTrail[astreTrail.length-1].alpha})`;
        ctx.lineWidth = currentAstre ? currentAstre.circleRadius * 0.8 : 10;
        ctx.lineCap = 'round';
        ctx.stroke();
        // Nettoyage des vieux segments
        astreTrail = astreTrail.filter(t => t.alpha > 0);
    }

    // 2. Dessiner et mettre à jour les particules (étincelles d'impact)
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = '#06B6D4'; // Cyan
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#06B6D4';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
});

// Resize dynamique
window.addEventListener('resize', () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    Bounds.update(render.bounds, [{x:0, y:0}, {x:window.innerWidth, y:window.innerHeight}]);
});
