// --- CONFIGURATION DU MOTEUR ---
const { Engine, Render, Runner, Bodies, Composite, Body, Events } = Matter;

const engine = Engine.create();
// Augmentation de la précision pour gérer les impacts violents sans "bug" de collision
engine.positionIterations = 12; 
engine.velocityIterations = 12;
engine.world.gravity.y = 0; // Gravité zéro (espace)

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

// --- LIMITES DE LA PISTE (Murs invisibles) ---
const wallOptions = { 
    isStatic: true, 
    render: { visible: false }, 
    restitution: 0.8, // Bon rebond sur les murs
    friction: 0
};
const thickness = 60;
const walls = [
    Bodies.rectangle(window.innerWidth/2, -thickness/2, window.innerWidth * 2, thickness, wallOptions),
    Bodies.rectangle(window.innerWidth/2, window.innerHeight + thickness/2, window.innerWidth * 2, thickness, wallOptions),
    Bodies.rectangle(window.innerWidth + thickness/2, window.innerHeight/2, thickness, window.innerHeight * 2, wallOptions),
    Bodies.rectangle(-thickness/2, window.innerHeight/2, thickness, window.innerHeight * 2, wallOptions)
];
Composite.add(engine.world, walls);

// --- GESTION DU MESSAGE EXTERNE ---
window.addEventListener('message', (e) => {
    const regex = /(\d+)kg\s*\|\s*Type\s*:\s*([^|]+)\s*\|\s*(\d+)lvl\s*\|\s*Z(\d+)/i;
    const m = typeof e.data === 'string' ? e.data.match(regex) : null;
    if (m) {
        initGame({ kg: parseInt(m[1]), type: m[2].trim(), lvl: parseInt(m[3]), z: parseInt(m[4]) });
    }
});

function initGame(data) {
    // Nettoyage de l'espace (sauf les murs)
    const allBodies = Composite.allBodies(engine.world);
    allBodies.forEach(b => { if(!b.isStatic) Composite.remove(engine.world, b); });

    // Mise à jour de l'Interface UI
    document.getElementById('u-kg').innerText = data.kg + " kg";
    document.getElementById('u-type').innerText = data.type;
    document.getElementById('u-lvl').innerText = "Lvl " + data.lvl;
    document.getElementById('u-z').innerText = "Z" + data.z;

    // 1. GÉNÉRATION DES QUILLES (Formation triangle)
    const pins = [];
    const pinCount = Math.min(data.z, 40); // Limite raisonnable
    const startX = window.innerWidth * 0.75; // Placés à 75% de l'écran
    const startY = window.innerHeight / 2;
    
    for (let i = 0; i < pinCount; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        
        // Forme améliorée : Bords arrondis pour des rebonds complexes
        const pin = Bodies.rectangle(
            startX + (row * 38), 
            startY + (col * 48) - (row * 24), 
            22, 48, {
                chamfer: { radius: 8 }, // Bords lisses (très important pour le réalisme)
                restitution: 0.6,       // Rebond élastique
                frictionAir: 0.015,     // Résistance du vide pour ralentir les débris
                density: 0.001,         // Assez léger par rapport à l'astre
                render: { 
                    fillStyle: '#8B5CF6',
                    strokeStyle: '#C4B5FD',
                    lineWidth: 2
                }
            }
        );
        pins.push(pin);
    }
    Composite.add(engine.world, pins);

    // 2. GÉNÉRATION DE L'ASTRE (La Boule)
    const radius = Math.max(30, Math.min(data.kg / 3, 100)); // Limite de taille
    const name = data.type.toLowerCase().replace(/\s+/g, '-');
    const imgUrl = `https://user-anonymous-dev.github.io/bowling-spatiale_/picture/astres/${name}.png`;

    const astre = Bodies.circle(window.innerWidth * 0.1, window.innerHeight / 2, radius, {
        mass: data.kg * 2,    // Masse élevée pour défoncer les quilles
        density: 0.05,        // Très dense
        restitution: 0.2,     // La boule absorbe l'impact sans trop rebondir en arrière
        frictionAir: 0.002,   // Conserve bien son élan
        render: {
            sprite: {
                texture: imgUrl,
                xScale: (radius * 2.2) / 100,
                yScale: (radius * 2.2) / 100
            }
        }
    });

    // Gestion de l'image cassée
    const img = new Image();
    img.src = imgUrl;
    img.onerror = () => {
        if (astre.render.sprite) {
            astre.render.sprite.texture = 'https://user-anonymous-dev.github.io/bowling-spatiale_/picture/template-astres.png';
        }
    };

    Composite.add(engine.world, astre);

    // 3. LANCEMENT PHYSIQUE (Réaliste)
    // Force de propulsion basée sur le Level ET la masse de la boule
    const forceMagnitude = (data.lvl * astre.mass) / 3500;
    
    setTimeout(() => {
        // applyForce donne une impulsion plus physique qu'un setVelocity brutal
        Body.applyForce(astre, astre.position, { 
            x: forceMagnitude, 
            y: (Math.random() - 0.5) * (forceMagnitude * 0.05) // Légère variation sur Y
        });
        // On donne un spin à la planète pour l'esthétique
        Body.setAngularVelocity(astre, 0.15);
    }, 600);
}

// 4. EFFETS D'IMPACT (Flash visuel)
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
        // Filtrer pour trouver les quilles par leur couleur d'origine
        const isPinA = pair.bodyA.render.fillStyle === '#8B5CF6' || pair.bodyA.render.fillStyle === '#06B6D4';
        const isPinB = pair.bodyB.render.fillStyle === '#8B5CF6' || pair.bodyB.render.fillStyle === '#06B6D4';

        // Si l'impact est assez fort (depth > 1.5), on fait flasher la quille
        if (isPinA && pair.collision.depth > 1.5) flashPin(pair.bodyA);
        if (isPinB && pair.collision.depth > 1.5) flashPin(pair.bodyB);
    });
});

function flashPin(body) {
    if (!body.render) return;
    const originalColor = '#8B5CF6';
    body.render.fillStyle = '#06B6D4'; // Flash Cyan
    body.render.strokeStyle = '#FFFFFF';
    
    setTimeout(() => { 
        if(body.render) {
            body.render.fillStyle = originalColor;
            body.render.strokeStyle = '#C4B5FD';
        }
    }, 150);
}

// Mise à jour de la taille du canvas quand la fenêtre change
window.addEventListener('resize', () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
});
