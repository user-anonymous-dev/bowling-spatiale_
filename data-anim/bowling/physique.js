function setupScene(data) {
    World.clear(engine.world);
    particles = [];
    astreTrail = [];
    gameResult = "";
    gameState = "WAITING";
    
    // 1. L'ASTRE (On définit sa masse d'abord)
    const radius = Math.max(30, Math.min(data.kg / 2.2, 100));
    currentAstre = Bodies.circle(150, window.innerHeight / 2, radius, {
        mass: data.kg, 
        restitution: 0.4, 
        frictionAir: 0.005
    });

    // 2. LES QUILLES (Équilibrage dynamique)
    currentPins = [];
    const pinCount = Math.min(10 + Math.floor(data.z / 10), 40);
    
    // NOUVELLE FORMULE : La quille pèse un % de l'astre basé sur Z
    // Si Z est haut, chaque quille devient un obstacle majeur.
    const resistanceFactor = (data.z / 100); 
    const pinMass = (data.kg / 10) * (1 + resistanceFactor); 

    for (let i = 0; i < pinCount; i++) {
        let row = Math.floor(Math.sqrt(2 * i + 0.25) - 0.5);
        let col = i - (row * (row + 1) / 2);
        
        const pin = Bodies.rectangle(
            window.innerWidth * 0.7 + (row * 42), 
            window.innerHeight / 2 + (col * 52) - (row * 26),
            22, 44, { 
                restitution: 0.5,
                friction: 0.5, // Plus de grip au sol
                frictionAir: 0.05
            }
        );
        
        // On force la masse de la quille pour qu'elle résiste à l'impact
        Body.setMass(pin, pinMass); 
        currentPins.push(pin);
    }
    
    Composite.add(engine.world, [currentAstre, ...currentPins]);

    // 3. LANCEMENT (Le LVL 1 doit être VRAIMENT faible)
    setTimeout(() => {
        gameState = "LAUNCHED";
        // Si LVL est 1, la force est ridicule. 
        // Il faut au moins un certain niveau pour bouger une masse importante.
        const speedMultiplier = data.lvl * 0.5; 
        const forceMagnitude = (speedMultiplier * data.kg) / 2000;
        
        Body.applyForce(currentAstre, currentAstre.position, { x: forceMagnitude, y: 0 });
        timerResult = Date.now() + 6000; 
    }, 1000);
}
