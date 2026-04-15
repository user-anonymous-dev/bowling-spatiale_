/**
 * SPATIAL BOWLING - V5 (SYSTEME DE NIVEAU & ECHEC)
 * Z = Niveau de difficulté / Résistance des quilles
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
let isSimulationActive = false;

// --- CONFIGURATION DU NIVEAU (SCENE) ---
function setupScene(data) {
    World.clear(engine.world);
    particles = [];
    astreTrail = [];
    isSimulationActive = true;
    
    // 1. LES QUILLES (Difficulté basée sur Z)
    currentPins = [];
    const pinCount = 10 + Math.floor(data.z / 2); // Plus de quilles avec le niveau
    const pinResistance = 0.001 + (data.z * 0.0005); // Les quilles deviennent "plus lourdes" avec Z
    
    for (let i = 0; i < pinCount; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        
        const pin = Bodies.rectangle(
            window.innerWidth * 0.7 + (row * 40), 
            window.innerHeight / 2 + (col * 50) - (row * 25),
            22, 45, { 
                restitution: 0.4, 
                frictionAir: 0.05, // Friction spatiale
                density: pinResistance, // Plus Z est haut, plus elles sont dures à bouger
                render: { color: '#8B5CF6' }
            }
        );
        currentPins.push(pin);
    }
    Composite.add(engine.world, currentPins);

    // 2. L'ASTRE (Puissance basée sur KG et LVL)
    const radius = Math.max(25, Math.min(data.kg / 2.5, 100));
    currentAstre = Bodies.circle(150, window.innerHeight / 2, radius, {
        mass: data.kg, 
        restitution: 0.5,
        frictionAir: 0.002
    });
    
    Composite.add(engine.world, currentAstre);

    // 3. LANCEMENT (Vecteur de force proportionnel au LVL)
    setTimeout(() => {
        // La force dépend du niveau de l'astre
        const forceMagnitude = (data.lvl * data.kg) / 5000; 
        Body.applyForce(currentAstre, currentAstre.position, { 
            x: forceMagnitude, 
            y: (Math.random() - 0.5) * 0.01 
        });
    }, 600);
}

// --- DETECTION DE COLLISION ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
        // Calcul de l'énergie de l'impact
        const speed = Vector.magnitude(pair.bodyA.velocity);
        if (speed > 2) {
            spawnParticles(pair.collision.supports[0], speed);
        }
    });
});

function spawnParticles(pos, intensity) {
    for (let i = 0; i < intensity * 2; i++) {
        particles.push({
            x: pos.x, y: pos.y,
            vx: (Math.random() - 0.5) * intensity,
            vy: (Math.random() - 0.5) * intensity,
            life: 1,
            color: '#06B6D4'
        });
    }
}

// --- BOUCLE DE RENDU ---
function draw() {
    Engine.update(engine);

    // Fond Space
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Traînée de l'astre
    if (currentAstre && isSimulationActive) {
        astreTrail.push({ x: currentAstre.position.x, y: currentAstre.position.y });
        if (astreTrail.length > 20) astreTrail.shift();
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.lineWidth = currentAstre.circleRadius;
        ctx.lineCap = 'round';
        astreTrail.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    }

    // Dessin des Particules
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
        if (p.life <= 0) particles.splice(i, 1);
    });
    ctx.globalAlpha = 1;

    // Dessin des Quilles (Violets si debout, gris si tombées)
    currentPins.forEach(pin => {
        ctx.save();
        ctx.translate(pin.position.x, pin.position.y);
        ctx.rotate(pin.angle);
        
        // Si la quille a beaucoup tourné ou bougé, elle change de couleur
        const isDown = Math.abs(pin.angle) > 0.5 || pin.position.x > window.innerWidth * 0.8;
        ctx.fillStyle = isDown ? '#4B5563' : '#8B5CF6';
        
        ctx.fillRect(-10, -22, 20, 44);
        ctx.restore();
    });

    // Dessin de l'Astre (Glow effect)
    if (currentAstre) {
        ctx.save();
        ctx.translate(currentAstre.position.x, currentAstre.position.y);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#06B6D4';
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.arc(0, 0, currentAstre.circleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    requestAnimationFrame(draw);
}

// --- INTERFACE DE MESSAGES ---
window.addEventListener('message', (e) => {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof e.data === 'string' ? e.data.match(regex) : null;
    if (m) setupScene({ kg: +m[1], type: m[2], lvl: +m[3], z: +m[4] });
});

draw();

// Simulation de test au chargement :
// Si Z est élevé (ex: 50) et LVL bas (ex: 2), l'astre va galérer !
setupScene({ kg: 40, type: 'Test', lvl: 5, z: 20 });
