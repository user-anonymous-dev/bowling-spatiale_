// --- VARIABLES GLOBALES POUR LES EFFETS DE COLLISION ---
let particles = [];
let shockwaves = [];
let screenShake = { x: 0, y: 0, decay: 0 };
let originalBounds = null;

// --- GESTION ULTRA-COMPLEXE DES COLLISIONS ---
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        
        // Calcul de la vélocité relative exacte au point d'impact
        const relVelocity = Vector.sub(bodyA.velocity, bodyB.velocity);
        const speedSq = Vector.magnitudeSquared(relVelocity);
        
        // Approximation de la masse effective (pour éviter des énergies infinies avec les murs statiques)
        const massA = bodyA.isStatic ? bodyB.mass : bodyA.mass;
        const massB = bodyB.isStatic ? bodyA.mass : bodyB.mass;
        const effectiveMass = (massA * massB) / (massA + massB);
        
        // Calcul de l'Énergie Cinétique (Ek = 1/2 * m * v^2)
        const kineticEnergy = 0.5 * effectiveMass * speedSq;

        // On ignore les micro-collisions (objets au repos)
        if (kineticEnergy < 10) return;

        // Récupération du point de contact exact
        const contactPoint = pair.collision.supports[0] || pair.collision.supports[1];
        if (!contactPoint) return;

        // --- 1. MODIFICATEURS PHYSIQUES DYNAMIQUES ---
        
        // Transfert de friction angulaire (Effet Magnus / Spin)
        // Si les objets se frottent fortement, on augmente leur vélocité angulaire
        const tangentVelocity = Vector.cross(relVelocity, pair.collision.normal);
        if (Math.abs(tangentVelocity) > 2) {
            if (!bodyA.isStatic) Body.setAngularVelocity(bodyA, bodyA.angularVelocity + (tangentVelocity * 0.01));
            if (!bodyB.isStatic) Body.setAngularVelocity(bodyB, bodyB.angularVelocity - (tangentVelocity * 0.01));
        }

        // --- 2. RÉACTIONS VISUELLES BASÉES SUR L'ÉNERGIE ---
        
        // A. Étincelles classiques (Énergie Moyenne : > 50)
        if (kineticEnergy > 50) {
            spawnParticles(contactPoint, relVelocity, Math.min(kineticEnergy / 10, 40), 'spark');
        }

        // B. Choc Violent : Ondes de choc, Débris et Bullet Time (Énergie Haute : > 500)
        if (kineticEnergy > 500) {
            // Création d'une onde de choc
            shockwaves.push({ x: contactPoint.x, y: contactPoint.y, radius: 10, alpha: 1, force: kineticEnergy / 100 });
            
            // Génération de gros débris physiques
            spawnParticles(contactPoint, relVelocity, Math.min(kineticEnergy / 50, 15), 'debris');

            // Screen Shake proportionnel à l'impact
            triggerScreenShake(kineticEnergy / 100);

            // Bullet Time dynamique
            const timeScaleTarget = Math.max(0.1, 1 - (kineticEnergy / 5000));
            engine.timing.timeScale = timeScaleTarget;
            
            if (bulletTimeTimeout) clearTimeout(bulletTimeTimeout);
            bulletTimeTimeout = setTimeout(() => {
                // Interpolation douce pour revenir au temps réel
                let interval = setInterval(() => {
                    engine.timing.timeScale += 0.05;
                    if (engine.timing.timeScale >= 1) {
                        engine.timing.timeScale = 1;
                        clearInterval(interval);
                    }
                }, 50);
            }, 300); // Durée du ralenti
        }
    });
});

// --- SYSTÈME DE PARTICULES & EFFETS ---
function spawnParticles(point, relVel, count, type) {
    for (let i = 0; i < count; i++) {
        // Dispersion conique basée sur le vecteur de collision
        const angleOffset = (Math.random() - 0.5) * Math.PI; // 180 degrés de dispersion
        const speed = Math.random() * (type === 'debris' ? 8 : 15);
        
        // Rotation du vecteur vitesse
        const vx = relVel.x * Math.cos(angleOffset) - relVel.y * Math.sin(angleOffset);
        const vy = relVel.x * Math.sin(angleOffset) + relVel.y * Math.cos(angleOffset);
        
        // Normalisation et application de la vitesse
        const norm = Math.sqrt(vx*vx + vy*vy) || 1;

        particles.push({
            x: point.x, y: point.y,
            vx: (vx / norm) * speed * 0.5,
            vy: (vy / norm) * speed * 0.5,
            life: 1.0,
            decay: type === 'debris' ? 0.01 : 0.03 + (Math.random() * 0.02),
            size: type === 'debris' ? Math.random() * 6 + 3 : Math.random() * 3 + 1,
            color: type === 'debris' ? '#8B5CF6' : '#06B6D4' // Débris violets (quilles), Étincelles cyans
        });
    }
}

function triggerScreenShake(intensity) {
    const cappedIntensity = Math.min(intensity, 25); // Limite le tremblement max
    screenShake.x = (Math.random() - 0.5) * cappedIntensity;
    screenShake.y = (Math.random() - 0.5) * cappedIntensity;
    screenShake.decay = cappedIntensity;
    if (!originalBounds) originalBounds = { min: { x: 0, y: 0 }, max: { x: window.innerWidth, y: window.innerHeight } };
}

// --- BOUCLE DE RENDU CUSTOM (Moteur Graphique Indépendant) ---
Events.on(render, 'afterRender', () => {
    // 1. Gestion du Screen Shake (Déplacement de la caméra)
    if (screenShake.decay > 0.1) {
        screenShake.x = (Math.random() - 0.5) * screenShake.decay;
        screenShake.y = (Math.random() - 0.5) * screenShake.decay;
        screenShake.decay *= 0.9; // Amortissement

        Bounds.translate(render.bounds, { x: screenShake.x, y: screenShake.y });
    } else if (originalBounds) {
        // Retour progressif à la normale
        Bounds.update(render.bounds, [originalBounds.min, originalBounds.max]);
    }

    // 2. Traînée de l'astre (Code précédent conservé)
    if (currentAstre && Vector.magnitude(currentAstre.velocity) > 2) {
        astreTrail.push({ x: currentAstre.position.x, y: currentAstre.position.y, alpha: 1 });
        if (astreTrail.length > 25) astreTrail.shift();
    }
    if (astreTrail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(astreTrail[0].x, astreTrail[0].y);
        for (let i = 1; i < astreTrail.length; i++) {
            ctx.lineTo(astreTrail[i].x, astreTrail[i].y);
            astreTrail[i].alpha -= 0.04;
        }
        ctx.strokeStyle = `rgba(6, 182, 212, ${astreTrail[astreTrail.length-1].alpha})`;
        ctx.lineWidth = currentAstre ? currentAstre.circleRadius * 0.6 : 10;
        ctx.lineCap = 'round';
        ctx.stroke();
        astreTrail = astreTrail.filter(t => t.alpha > 0);
    }

    // 3. Rendu des Ondes de Choc (Shockwaves)
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i];
        sw.radius += sw.force * 2; // Expansion de l'onde
        sw.alpha -= 0.05;          // Dissipation
        
        if (sw.alpha <= 0) {
            shockwaves.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = sw.alpha;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = sw.force * sw.alpha;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    // 4. Rendu des Particules (Étincelles & Débris)
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        // Physique des particules (Inertie + Légère friction spatiale)
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= p.decay;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        
        // Effet de lueur uniquement pour les étincelles rapides
        if (p.color === '#06B6D4') {
            ctx.shadowBlur = 15;
            ctx.shadowColor = p.color;
        } else {
            ctx.shadowBlur = 0; // Les débris ne brillent pas
        }

        ctx.beginPath();
        // Dessin étiré selon la vélocité pour simuler le motion blur
        const stretch = Math.max(1, Math.sqrt(p.vx*p.vx + p.vy*p.vy) * 0.5);
        ctx.ellipse(p.x, p.y, p.size * stretch, p.size, Math.atan2(p.vy, p.vx), 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // Reset du contexte canvas
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
});
