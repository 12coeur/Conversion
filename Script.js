// ===============================
// SCRIPT PRINCIPAL - TRACE VISUALIZER 
// ===============================

// État global de l'application
const AppState = {
    currentPage: 'accueil',
    map: null,
    mapPlayeur: null,
    mapInitialized: false,
    mapPlayeurInitialized: false,
    threeScene: null,
    threeRenderer: null,
    threeCamera: null,
    modelTransform: null,
    currentTrace: null,
    currentCoordinates: null,
    currentFileName: null,
    currentFileType: null
};
// ===============================
// TRACE VOLANTE - INSTANCE GLOBALE
// ===============================
let traceVolanteInstance = null;
// Variable globale pour stocker le contenu brut du fichier
let currentRawContent = "";

// ===============================
// FONCTIONS CAMÉRA 
// ===============================

function startPitchCycle(map, cameraState) {
    if (cameraState.pitchCycleInterval) clearInterval(cameraState.pitchCycleInterval);
    if (!map) {
        console.error("Carte non disponible au démarrage du cycle pitch");
        cameraState.isPitchCycling = false;
        return;
    }

    // Angle de départ
    const basePitch = map.getPitch();
    cameraState.isPitchCycling = true;

    // Direction initiale (1 = monte, -1 = descend)
    cameraState.pitchDirection = 1;

    // Amplitude de ±10° autour de l'angle initial
    const amplitude = 10;
    const pitchMin = Math.max(0, basePitch - amplitude);
    const pitchMax = Math.min(80, basePitch + amplitude);

    cameraState.pitchCycleInterval = setInterval(() => {
        if (!cameraState.isPitchCycling) {
            clearInterval(cameraState.pitchCycleInterval);
            return;
        }

        let currentPitch = map.getPitch();
        let newPitch = currentPitch + 1.5 * cameraState.pitchDirection;

        // Inverser la direction aux bornes
        if (newPitch >= pitchMax) {
            newPitch = pitchMax;
            cameraState.pitchDirection = -1;
        } else if (newPitch <= pitchMin) {
            newPitch = pitchMin;
            cameraState.pitchDirection = 1;
        }

        map.easeTo({
            pitch: newPitch,
            duration: 200,
            essential: true
        });

        console.log(`Pitch: ${currentPitch.toFixed(1)}° → ${newPitch.toFixed(1)}°, direction: ${cameraState.pitchDirection}`);
    }, 200);
}

function stopPitchCycle(cameraState) {
    console.log("⏹️ Arrêt du cycle pitch");
    cameraState.isPitchCycling = false;
    if (cameraState.pitchCycleInterval) {
        clearInterval(cameraState.pitchCycleInterval);
        cameraState.pitchCycleInterval = null;
    }
    const pitchCycleBtn = document.getElementById('pitchCycleBtn');
    if (pitchCycleBtn) {
        pitchCycleBtn.classList.remove('active');
        pitchCycleBtn.style.backgroundColor = '';
    }
    showCameraFeedback("Cycle Monte/Baisse", "ARRÊTÉ");
}

function resetPitchCycle(cameraState) {
    console.log("🔄 Réinitialisation du cycle pitch");
    cameraState.isPitchCycling = false;
    if (cameraState.pitchCycleInterval) {
        clearInterval(cameraState.pitchCycleInterval);
        cameraState.pitchCycleInterval = null;
    }
    cameraState.pitchDirection = -1; // Redémarrer en descente
    
    const pitchCycleBtn = document.getElementById('pitchCycleBtn');
    if (pitchCycleBtn) {
        pitchCycleBtn.classList.remove('active');
        pitchCycleBtn.style.backgroundColor = '';
    }
}

function startCameraRotation(map, cameraState) {
    if (cameraState.rotationInterval) {
        clearInterval(cameraState.rotationInterval);
        console.log("🔄 Intervalle rotation précédent effacé");
    }
    
    if (!map) {
        console.error("❌ Carte non disponible au démarrage de la rotation");
        cameraState.isRotating = false;
        showCameraFeedback("Erreur", "Carte non disponible pour la rotation");
        return;
    }
    
    cameraState.rotationInterval = setInterval(() => {
        if (!cameraState.isRotating) {
            console.log("⏹️ Arrêt de la rotation : isRotating est false");
            stopCameraRotation(cameraState);
            return;
        }
        
        try {
            const currentBearing = map.getBearing();
            const newBearing = (currentBearing + (1 * cameraState.currentSpeed)) % 360;
            
            map.easeTo({
                bearing: newBearing,
                duration: 200,
                essential: true
            });
        } catch (error) {
            console.error("❌ Erreur dans startCameraRotation :", error);
        }
    }, 200);
}

function stopCameraRotation(cameraState) {
    console.log("⏹️ Arrêt de la rotation");
    cameraState.isRotating = false;
    if (cameraState.rotationInterval) {
        clearInterval(cameraState.rotationInterval);
        cameraState.rotationInterval = null;
    }
    const rotationBtn = document.getElementById('rotationBtn');
    if (rotationBtn) {
        rotationBtn.classList.remove('active');
        rotationBtn.style.backgroundColor = '';
    }
}

// ===============================
// CONTRÔLES CAMÉRA PRINCIPAUX
// ===============================

// Fonction pour obtenir la carte actuelle
function getCurrentMap() {
    if (AppState.currentPage === 'playeur' && AppState.mapPlayeur) {
        return AppState.mapPlayeur;
    } else if (AppState.currentPage === 'carte' && AppState.map) {
        return AppState.map;
    }
    return null;
}

function showCameraFeedback(action, value) {
    // Supprimer les anciens feedbacks
    const oldFeedback = document.querySelector('.camera-feedback');
    if (oldFeedback) {
        oldFeedback.remove();
    }
    
    const feedback = document.createElement('div');
    feedback.className = 'camera-feedback';
    feedback.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.85);
        color: #0cff0b;
        padding: 15px 25px;
        border-radius: 25px;
        font-size: 18px;
        font-weight: bold;
        z-index: 10000;
        border: 2px solid #0cff0b;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        box-shadow: 0 5px 25px rgba(12, 255, 11, 0.3);
        backdrop-filter: blur(10px);
    `;
    feedback.textContent = `${action}: ${value}`;
    document.body.appendChild(feedback);
    
    // Animation d'apparition
    setTimeout(() => feedback.style.opacity = '1', 10);
    
    // Disparaître après 1.5 secondes
    setTimeout(() => {
        feedback.style.opacity = '0';
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 300);
    }, 1500);
}

function setupCameraKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ne fonctionne que sur les pages avec carte
        if (AppState.currentPage !== 'playeur' && AppState.currentPage !== 'carte') return;
        
        const pitchUpBtn = document.getElementById('pitchUpBtn');
        const pitchDownBtn = document.getElementById('pitchDownBtn');
        const rotationBtn = document.getElementById('rotationBtn');
        const speedBtn = document.getElementById('speedBtn');
        
        switch(e.key.toLowerCase()) {
            case 'arrowup':
            case 'u':
                e.preventDefault();
                if (pitchUpBtn) pitchUpBtn.click();
                break;
                
            case 'arrowdown':
            case 'd':
                e.preventDefault();
                if (pitchDownBtn) pitchDownBtn.click();
                break;
                
            case 'r':
                e.preventDefault();
                if (rotationBtn) rotationBtn.click();
                break;
                
            case 's':
                e.preventDefault();
                if (speedBtn) speedBtn.click();
                break;
        }
    });
}

// ===============================
// CONTRÔLES CAMÉRA RÉORGANISÉS
// ===============================

function setupCameraControls() {
    console.log("🎥 Configuration des contrôles caméra...");
    
    const pitchCycleBtn = document.getElementById('pitchCycleBtn');
    const rotationBtn = document.getElementById('rotationBtn');
    const speedUpBtn = document.getElementById('speedUpBtn');
    const slowDownBtn = document.getElementById('slowDownBtn');
    
    if (!pitchCycleBtn || !rotationBtn || !speedUpBtn || !slowDownBtn) {
        console.warn("⚠️ Boutons caméra introuvables");
        return;
    }
    
    // État de la caméra (global pour pouvoir le réinitialiser)
    window.cameraState = {
        isRotating: false,
        rotationInterval: null,
        isPitchCycling: false,
        pitchCycleInterval: null,
        pitchDirection: -1,
        currentSpeed: 0.5
    };
    
    // === CYCLE MONTE/BAISSE ===
    pitchCycleBtn.addEventListener('click', function() {
        const map = getCurrentMap();
        if (!map) {
            console.warn("⚠️ Carte non disponible pour démarrer le cycle pitch");
            showCameraFeedback("Erreur", "Carte non disponible");
            return;	
        }
        
        cameraState.isPitchCycling = !cameraState.isPitchCycling;
        
        if (cameraState.isPitchCycling) {
            const currentPitch = map.getPitch();
            // Déterminer la direction initiale intelligemment
            if (currentPitch >= 75) {
                 cameraState.pitchDirection = -1; // trop haut → descendre
                } else if (currentPitch <= 35) {
                     cameraState.pitchDirection = 1;  // trop bas → monter
                            }
            // Sinon garder la direction actuelle
            
            startPitchCycle(map, cameraState);
            pitchCycleBtn.classList.add('active');
            pitchCycleBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.5)';
            console.log("🔀 Cycle pitch activé");
            showCameraFeedback("Cycle Monte/Baisse", "ACTIVÉ");
        } else {
            stopPitchCycle(cameraState);
            pitchCycleBtn.classList.remove('active');
            pitchCycleBtn.style.backgroundColor = '';
            console.log("ℹ️ Cycle pitch désactivé");
            showCameraFeedback("Cycle Monte/Baisse", "ARRÊTÉ");
        }
    });
    
    // === ROTATION AUTOMATIQUE ===
    rotationBtn.addEventListener('click', function() {
        const map = getCurrentMap();
        if (!map) {
            console.warn("⚠️ Carte non disponible pour démarrer la rotation");
            showCameraFeedback("Erreur", "Carte non disponible");
            return;
        }
        
        cameraState.isRotating = !cameraState.isRotating;
        
        if (cameraState.isRotating) {
            startCameraRotation(map, cameraState);
            rotationBtn.classList.add('active');
            rotationBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.5)';
            console.log("🔄 Rotation activée");
            showCameraFeedback("Rotation", "ACTIVÉE");
        } else {
            stopCameraRotation(cameraState);
            rotationBtn.classList.remove('active');
            rotationBtn.style.backgroundColor = '';
            console.log("⏹️ Rotation désactivée");
            showCameraFeedback("Rotation", "ARRÊTÉE");
        }
    });
    
    // === ACCÉLÉRER ===
    speedUpBtn.addEventListener('click', function() {
        if (cameraState.currentSpeed < 2) {
            cameraState.currentSpeed += 0.25;
            console.log(`⏩ Vitesse augmentée: ${cameraState.currentSpeed}x`);
            showCameraFeedback("Vitesse", cameraState.currentSpeed + "x");
            
            if (cameraState.isRotating) {
                const map = getCurrentMap();
                if (map) {
                    stopCameraRotation(cameraState);
                    startCameraRotation(map, cameraState);
                }
            }
            if (cameraState.isPitchCycling) {
                const map = getCurrentMap();
                if (map) {
                    stopPitchCycle(cameraState);
                    startPitchCycle(map, cameraState);
                }
            }
            
            speedUpBtn.style.transform = 'scale(1.1)';
            setTimeout(() => { speedUpBtn.style.transform = 'scale(1)'; }, 200);
        } else {
            showCameraFeedback("Vitesse Max", "2x");
        }
    });
    
    // === DÉCÉLÉRER ===
    slowDownBtn.addEventListener('click', function() {
        if (cameraState.currentSpeed > 0.25) {
            cameraState.currentSpeed -= 0.25;
            console.log(`⏪ Vitesse diminuée: ${cameraState.currentSpeed}x`);
            showCameraFeedback("Vitesse", cameraState.currentSpeed + "x");
            
            if (cameraState.isRotating) {
                const map = getCurrentMap();
                if (map) {
                    stopCameraRotation(cameraState);
                    startCameraRotation(map, cameraState);
                }
            }
            if (cameraState.isPitchCycling) {
                const map = getCurrentMap();
                if (map) {
                    stopPitchCycle(cameraState);
                    startPitchCycle(map, cameraState);
                }
            }
            
            slowDownBtn.style.transform = 'scale(1.1)';
            setTimeout(() => { slowDownBtn.style.transform = 'scale(1)'; }, 200);
        } else {
            showCameraFeedback("Vitesse Min", "0.25x");
        }
    });
    
    // Démarrer la configuration des écouteurs
    setupMapInteractionListeners();
    
    console.log("✅ Contrôles caméra initialisés");
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Initialisation de l'application");
    initializeApp();
});

/**
 * Récupère les données de trace actuellement chargées
 * Convertit les coordonnées au format attendu par TraceConverter
 */
function getLoadedTraceData() {
    if (!AppState.currentCoordinates || AppState.currentCoordinates.length === 0) {
        alert('❌ Aucune trace chargée. Importez d\'abord un fichier.');
        return null;
    }

    // Convertir les coordonnées [lon, lat, alt] en format TraceConverter
    const points = AppState.currentCoordinates.map(coord => ({
        lat: coord[1],
        lon: coord[0],
        elevation: coord[2] || 0,
        timestamp: null
    }));

    return {
        format: AppState.currentFileType.toUpperCase(),
        points: points,
        name: AppState.currentFileName || 'Trace GPS',
        description: `Exportée depuis ${AppState.currentFileType.toUpperCase()}`
    };
}

function downloadFile(content, filename, mimeType) {
    
    // Forcer le mode sol
    if (window.traceVolanteInstance) {
        window.traceVolanteInstance.resetFlightMode();
    }
    try {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log(`✅ Téléchargement: ${filename}`);
        showMessage(`✅ ${filename} téléchargé avec succès`, 'lime');
    } catch (error) {
        console.error('❌ Erreur téléchargement:', error);
        showMessage(`❌ Erreur lors du téléchargement: ${error.message}`, 'red');
    }
}

/**
 * Initialise les événements des boutons d'export
 */
function setupExportButtons() {
    console.log("🔧 Initialisation des boutons d'export...");
    
    const gpxBtn = document.querySelector('.export-button.gpx');
    if (gpxBtn) {
        gpxBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const traceData = getLoadedTraceData();
            if (!traceData) return;
            
            try {
                const gpxContent = TraceConverter.toGPX(traceData);
                downloadFile(gpxContent, 'trace.gpx', 'application/gpx+xml');
            } catch (error) {
                console.error('❌ Erreur conversion GPX:', error);
                showMessage('❌ Erreur conversion GPX', 'red');
            }
        });
    }
    
    const igcBtn = document.querySelector('.export-button.igc');
    if (igcBtn) {
        igcBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const traceData = getLoadedTraceData();
            if (!traceData) return;
            
            try {
                const igcContent = TraceConverter.toIGC(traceData);
                downloadFile(igcContent, 'trace.igc', 'application/igc');
            } catch (error) {
                console.error('❌ Erreur conversion IGC:', error);
                showMessage('❌ Erreur conversion IGC', 'red');
            }
        });
    }
    
    const kmlBtn = document.querySelector('.export-button.kml');
    if (kmlBtn) {
        kmlBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const traceData = getLoadedTraceData();
            if (!traceData) return;
            
            try {
                const kmlContent = TraceConverter.toKML(traceData);
                downloadFile(kmlContent, 'trace.kml', 'application/vnd.google-earth.kml+xml');
            } catch (error) {
                console.error('❌ Erreur conversion KML:', error);
                showMessage('❌ Erreur conversion KML', 'red');
            }
        });
    }
    
    console.log("✅ Boutons d'export initialisés");
}

function initializeApp() {
    console.log("=== INITIALISATION DE L'APPLICATION ===");
    
    // FORCE: Supprimer les anciens écouteurs
    const oldPitchBtn = document.getElementById('pitchCycleBtn');
    if (oldPitchBtn) {
        const newPitchBtn = oldPitchBtn.cloneNode(true);
        oldPitchBtn.parentNode.replaceChild(newPitchBtn, oldPitchBtn);
        console.log("🔄 Bouton pitch cycle réinitialisé");
    }
    
    // ... le reste de l'initialisation ...
    setupNavigation();
    initDropzones();
    setupPlayeurControls();
    setupZScaleControl();
    setupExportButtons();
    setupVolToggle();
    setupRefreshButton(); // ← AJOUTEZ CETTE LIGNE
    setupCameraControls();
    setupCameraKeyboardShortcuts();
    showPage('accueil');
    
    setTimeout(() => {
        showMessage("✅ Application initialisée avec succès !", "lime", 5000);
    }, 1000);
    
    console.log("✅ Application initialisée avec succès");
}

// Et voici la fonction forceRefreshTrace améliorée
function forceRefreshTrace() {
    console.log("🔄 FORÇAGE RAFRAÎCHISSEMENT TRACE");
    
    if (!AppState.currentCoordinates || AppState.currentCoordinates.length === 0) {
        showMessage("❌ Aucune trace chargée à rafraîchir", "red", 3000);
        return;
    }
    
    showMessage("🔄 Actualisation de la trace...", "#0066cc", 2000);
    
    // Animation du bouton
    const refreshBtn = document.getElementById('forceRefreshBtn');
    if (refreshBtn) {
        refreshBtn.style.transform = 'rotate(360deg)';
        refreshBtn.style.transition = 'transform 0.5s ease';
        setTimeout(() => {
            refreshBtn.style.transform = 'rotate(0deg)';
        }, 500);
    }
    
    // Destruction de l'instance existante
    if (traceVolanteInstance) {
        console.log("🗑️ Destruction instance TraceVolante existante");
        traceVolanteInstance.destroy();
        traceVolanteInstance = null;
    }
    
    // Réinitialisation forcée du toggle Vol
    const volToggle = document.getElementById('volToggle');
    if (volToggle && volToggle.checked) {
        console.log("⚡ Toggle Vol était coché → recréation");
        // Le toggle reste coché, mais on recrée l'instance
    }
    
    // Recréer la trace
    setTimeout(() => {
        refreshPlayeurTrace();
        console.log("✅ Rafraîchissement forcé terminé");
        showMessage("✅ Trace rafraîchie avec succès", "lime", 3000);
    }, 300);
}

// Configuration de la navigation
function setupNavigation() {
    console.log("🔧 Configuration de la navigation...");
    
    document.addEventListener('click', function(e) {
        const target = e.target;
        
        if (target.hasAttribute('data-page')) {
            e.preventDefault();
            const pageId = target.getAttribute('data-page');
            console.log("📱 Navigation vers:", pageId);
            showPage(pageId);
            
            // ACTUALISER LA TRACE SUR LE PLAYEUR QUAND ON Y VA
            if (pageId === 'playeur' && AppState.currentCoordinates) {
                setTimeout(() => {
                    refreshPlayeurTrace();
                }, 100);
            }
            return;
        }
        
        if (target.id === 'loadFileBtn' || target.closest('#loadFileBtn')) {
            e.preventDefault();
            console.log("📂 Clic sur bouton Charger");
            triggerFileInput();
            return;
        }
    });
    
    // Menu hamburger mobile
    const hamburger = document.querySelector('.hamburger');
    const menu = document.querySelector('.menu');
    
    if (hamburger && menu) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log("🍔 Toggle menu mobile");
            menu.classList.toggle('active');
        });
    }
    
    document.addEventListener('click', function(e) {
        const menu = document.querySelector('.menu');
        if (menu && menu.classList.contains('active')) {
            if (!e.target.closest('.menu') && !e.target.closest('.hamburger')) {
                menu.classList.remove('active');
            }
        }
    });
}
function showPage(pageId) {
    console.log(`📄 Changement de page: ${pageId}`);  // ✅ Correct
    
    // Gestion de la page export
    if(pageId === 'export') {
        const textarea = document.getElementById('trace-content');
        if(textarea) textarea.value = currentRawContent || "Aucune trace chargée.";
    }
    
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`page-${pageId}`);  // ✅ Correct
    if (targetPage) {
        targetPage.classList.add('active');
        AppState.currentPage = pageId;
        
        document.querySelectorAll('.menu-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-page="${pageId}"]`);  // ✅ Correct
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        const menu = document.querySelector('.menu');
        if (menu) {
            menu.classList.remove('active');
        }
        
        handlePageTransition(pageId);
        
        console.log(`✅ Page ${pageId} affichée`);  // ✅ Correct
    }
}

// ← AJOUTEZ CETTE NOUVELLE FONCTION
function setupVolToggle() {
    const volToggle = document.getElementById('volToggle');
    if (!volToggle) {
        console.warn("⚠️ volToggle introuvable");
        return;
    }
    
    volToggle.checked = false;
    
    volToggle.addEventListener('change', function() {
        console.log("Toggle Vol/Sol:", this.checked ? "VOL" : "SOL");
        if (AppState.currentCoordinates) {
            refreshPlayeurTrace();
        }
    });
    
    console.log("✅ volToggle configuré");
}

function handlePageTransition(pageId) {
    switch(pageId) {
        case 'carte':
            console.log("🗺️ Transition vers la carte");
            setTimeout(() => {
                if (!AppState.mapInitialized) {
                    initMap();
                } else if (AppState.map) {
                    AppState.map.resize();
                    if (AppState.currentCoordinates && AppState.currentCoordinates.length > 0) {
                        const bounds = new maplibregl.LngLatBounds();
                        AppState.currentCoordinates.forEach(coord => {
                            bounds.extend([coord[0], coord[1]]);
                        });
                        if (!bounds.isEmpty()) {
                            AppState.map.fitBounds(bounds, { 
                                padding: 80,
                                pitch: 30,
                                bearing: 0,
                                maxZoom: 13,
                                duration: 1000
                            });
                        }
                    }
                }
            }, 100);
            break;
            
        case 'playeur':
            console.log("▶️ Transition vers le playeur");
            setTimeout(() => {
                if (!AppState.mapPlayeurInitialized) {
                    initMapPlayeur();
                } else if (AppState.mapPlayeur) {
                    AppState.mapPlayeur.resize();
                    if (AppState.currentCoordinates && AppState.currentCoordinates.length > 0) {
                        refreshPlayeurTrace();
                    }
                }
            }, 100);
            break;
            
        case 'accueil':
            console.log("🏠 Transition vers l'accueil");
            break;
    }
}

// Fonction utilitaire pour animer la rotation
function animatedFitBounds(map, bounds, options = {}) {
    const {
        padding = 80,
        pitch = 30,
        bearing = 0,
        maxZoom = 13,
        duration = 2000,
        rotationDuration = 3000  // Durée de la rotation en ms
    } = options;

    // Étape 1: Faire le zoom/pan sans rotation
    map.fitBounds(bounds, {
        padding: padding,
        pitch: pitch,
        bearing: 0,  // Commencer face au nord
        maxZoom: maxZoom,
        duration: duration,
        animate: true
    });

    // Étape 2: Lancer la rotation après que le zoom soit terminé
    setTimeout(() => {
        animateBearing(map, 0, 120, rotationDuration, pitch);
    }, duration);
}

// Fonction pour animer le bearing (rotation)
function animateBearing(map, startBearing, endBearing, duration, pitch) {
    const startTime = performance.now();
    
    function frame(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Interpolation linéaire
        const currentBearing = startBearing + (endBearing - startBearing) * progress;
        
        map.setBearing(currentBearing);
        
        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            // Vérifier que nous sommes bien à la fin
            map.setBearing(endBearing);
            console.log(`✅ Rotation terminée: ${endBearing}°`);
        }
    }
    
    requestAnimationFrame(frame);
}

// ===============================
// CONTRÔLES DU PLAYEUR
// ===============================

function setupPlayeurControls() {
    console.log("🎮 Configuration des contrôles du playeur...");
    
    const widthSlider = document.getElementById('traceWidth');
    const widthValue = document.getElementById('traceWidthValue');
    if (widthSlider && widthValue) {
        widthSlider.addEventListener('input', function() {
            const width = parseFloat(this.value);
            widthValue.textContent = width.toFixed(1);
            updateTraceProperty('line-width', width);
        });
    }
    
    const opacitySlider = document.getElementById('traceOpacity');
    const opacityValue = document.getElementById('traceOpacityValue');
    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', function() {
            const opacity = parseFloat(this.value);
            opacityValue.textContent = opacity.toFixed(2);
            updateTraceProperty('line-opacity', opacity);
        });
    }
    
    const colorPicker = document.getElementById('traceColor');
    if (colorPicker) {
        colorPicker.addEventListener('input', function() {
            updateTraceProperty('line-color', this.value);
        });
    }
}

function setupZScaleControl() {
    const zScaleInput = document.getElementById('zScale');
    const zScaleValue = document.getElementById('zScaleValue');

    if (zScaleInput && zScaleValue) {
        zScaleInput.addEventListener('input', function() {
            const scale = parseFloat(this.value);
            zScaleValue.textContent = scale.toFixed(1);
            
            console.log(`🎯 Mise à jour échelle Z: ${scale}`);
            
            if (AppState.mapPlayeur && AppState.mapPlayeur.isStyleLoaded()) {
                try {
                    AppState.mapPlayeur.setTerrain({
                        source: "dem-playeur",
                        exaggeration: scale
                    });
                    console.log(`✅ Échelle Z mise à jour: ${scale}`);
                } catch (error) {
                    console.warn("⚠️ Impossible de mettre à jour l'échelle Z:", error);
                }
            }
        });
        console.log("✅ Contrôle Z Scale initialisé");
    }
}

function updateTraceProperty(property, value) {
    if (AppState.mapPlayeur && AppState.mapPlayeur.getLayer('trace-playeur')) {
        AppState.mapPlayeur.setPaintProperty('trace-playeur', property, value);
        console.log(`🎛️ ${property} mis à jour: ${value}`);
    }
}

function refreshPlayeurTrace() {
    if (AppState.currentCoordinates && AppState.currentCoordinates.length > 0) {
        console.log("🔄 Actualisation forcée de la trace playeur");
        displayTraceOnPlayeur(AppState.currentCoordinates, AppState.currentFileName, AppState.currentFileType);
        
        // → À la fin :
        if (document.getElementById('volToggle').checked) {
            initTraceVolante();
            setTimeout(() => {
                if (window.traceVolanteInstance) {
                    window.traceVolanteInstance.safeUpdateTrace();
                }
            }, 600);
        }
    }
}

// ===============================
// GESTION DES FICHIERS
// ===============================

function triggerFileInput() {
    console.log("📤 Déclenchement de l'import de fichier");
    
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".igc,.gpx,.kml,.tcx";
    
    fileInput.addEventListener("change", function(e) {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            console.log("📄 Fichier sélectionné:", file.name);
            handleFile(file);
        }
    });
    
    fileInput.click();
}

function initDropzones() {
    console.log("🔧 Initialisation des zones de dépôt...");
    
    const dropzones = document.querySelectorAll(".dropzone");
    
    dropzones.forEach((dropzone) => {
        dropzone.addEventListener("dragover", function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("dragover");
        });

        dropzone.addEventListener("dragleave", function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!dropzone.contains(e.relatedTarget)) {
                dropzone.classList.remove("dragover");
            }
        });

        dropzone.addEventListener("drop", function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("dragover");
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                console.log("📄 Fichier droppé:", file.name);
                handleFile(file);
            }
        });

        dropzone.addEventListener("click", function(e) {
            e.preventDefault();
            e.stopPropagation();
            triggerFileInput();
        });
    });
}

function handleFile(file) {
    clearTraces();
    console.log("=== 🚀 DÉBUT DU TRAITEMENT DU FICHIER ===");
    
    const ext = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['igc', 'gpx', 'kml', 'fit', 'tcx'];
    
    if (!allowedExtensions.includes(ext)) {
        alert(`❌ Format non supporté: .${ext}. Utilisez ${allowedExtensions.map(e => '.' + e).join(', ')}`);
        return;
    }
    
    showPage('playeur');
    
    const debugDiv = document.querySelector('.debug-info');
    if (debugDiv) {
        debugDiv.innerHTML = '<div style="color: orange;">⏳ Traitement du fichier en cours...</div>';
    }
    
    if (!AppState.mapInitialized) {
        initMap();
        AppState.map.once('load', () => {
            processFile(file);
        });
    } else {
        processFile(file);
    }
}

// ===============================
// CARTE PRINCIPALE (3D avec relief)
// ===============================
function initMap() {
    if (AppState.mapInitialized && AppState.map) {
        return;
    }

    console.log("🗺️ INITIALISATION DE LA CARTE");
    const MAPTILER_KEY = "zv0cJDROvQbyb5SevYhh";

    if (typeof maplibregl === 'undefined') {
        showMessage("❌ MapLibre GL JS non chargé", 'red');
        return;
    }

    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        showMessage("❌ Conteneur #map introuvable", 'red');
        return;
    }

    showMessage("🔄 Création de la carte...", '#0066cc');

    try {
        AppState.map = new maplibregl.Map({
            container: 'map',
            style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
            center: [2.2137, 46.2276],
            zoom: 5,
            pitch: 30,
            bearing: 0,
            antialias: true
        });

        AppState.mapInitialized = true;
        showMessage("✅ Carte créée - Chargement...", 'green');

        AppState.map.on("load", function() {
            console.log("✅ Carte chargée avec succès");
            showMessage("✅ Carte chargée - Prête !", 'green');

            try {
                AppState.map.addSource("dem", {
                    type: "raster-dem",
                    url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
                });

                AppState.map.setTerrain({ source: "dem", exaggeration: 1.5 });

                // Vérifier si un NavigationControl existe déjà
                const existingControls = AppState.map._controls?.filter(
                    ctrl => ctrl instanceof maplibregl.NavigationControl
                );
                if (!existingControls || existingControls.length === 0) {
                    AppState.map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
                }

                showMessage("🎉 Carte 3D initialisée ! Importez un fichier", 'lime');
            } catch (error) {
                showMessage(`⚠️ Carte chargée avec erreurs: ${error.message}`, 'orange');
            }
        });
    } catch (error) {
        showMessage(`❌ Erreur création carte: ${error.message}`, 'red');
        return;
    }
}

// ===============================
// CARTE PLAYEUR
// ===============================

function initMapPlayeur() {
    if (AppState.mapPlayeurInitialized && AppState.mapPlayeur) {
        return;
    }
    console.log("▶️ INITIALISATION DE LA CARTE PLAYEUR");
    const MAPTILER_KEY = "zv0cJDROvQbyb5SevYhh";

    if (typeof maplibregl === 'undefined') {
        console.error("❌ MapLibre GL JS non chargé");
        return;
    }

    const mapContainer = document.getElementById('map-playeur');
    if (!mapContainer) {
        console.error("❌ Conteneur #map-playeur introuvable");
        return;
    }

    let initialCenter = [2.2137, 46.2276];
    let initialZoom = 5;

    if (AppState.currentCoordinates && AppState.currentCoordinates.length > 0) {
        const lngs = AppState.currentCoordinates.map(c => c[0]);
        const lats = AppState.currentCoordinates.map(c => c[1]);
        initialCenter = [
            (Math.min(...lngs) + Math.max(...lngs)) / 2,
            (Math.min(...lats) + Math.max(...lats)) / 2
        ];
        initialZoom = 11;
    }

    try {
        AppState.mapPlayeur = new maplibregl.Map({
            container: 'map-playeur',
            style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
            center: initialCenter,
            zoom: initialZoom,
            pitch: 35,
            bearing: 0,
            antialias: true
        });

        AppState.mapPlayeurInitialized = true;

        AppState.mapPlayeur.on("load", function() {
            console.log("✅ Carte playeur chargée");
            try {
                AppState.mapPlayeur.addSource("dem-playeur", {
                    type: "raster-dem",
                    url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
                });

                const zScaleInput = document.getElementById('zScale');
                const initialZScale = zScaleInput ? parseFloat(zScaleInput.value) : 1.5;

                AppState.mapPlayeur.setTerrain({ 
                    source: "dem-playeur", 
                    exaggeration: initialZScale 
                });

                const existingControls = AppState.mapPlayeur._controls?.filter(
                    ctrl => ctrl instanceof maplibregl.NavigationControl
                );
                if (!existingControls || existingControls.length === 0) {
                    AppState.mapPlayeur.addControl(new maplibregl.NavigationControl(), 'bottom-left');
                }

                console.log("✅ Relief 3D ajouté au playeur");

                // Initialisation de TraceVolante après la carte playeur
                if (typeof TraceVolante !== 'undefined') {
                    window.traceVolanteInstance = new TraceVolante(AppState.mapPlayeur, AppState);
                    console.log("✅ TraceVolante initialisée dans initMapPlayeur");
                } else {
                    console.warn("⚠️ TraceVolante non défini");
                }

                if (AppState.currentCoordinates) {
                    displayTraceOnPlayeur(AppState.currentCoordinates, AppState.currentFileName, AppState.currentFileType);
                }
            } catch (error) {
                console.error("⚠️ Erreur ajout relief playeur:", error);
            }
        });
    } catch (error) {
        console.error(`❌ Erreur création carte playeur: ${error.message}`);
        return;
    }
}

function initTraceVolante() {
    if (typeof TraceVolante === 'undefined') {
        console.error("TraceVolante non chargé ! Vérifie <script src='traceVolante.js'>");
        return null;
    }

    // FORCER UNE NOUVELLE INSTANCE À CHAQUE FOIS
    if (traceVolanteInstance) {
        console.log("🔄 Destruction de l'ancienne instance TraceVolante");
        traceVolanteInstance.destroy();
        traceVolanteInstance = null;
    }

    const map = AppState.mapPlayeur;
    if (!map) {
        console.warn("Map Playeur non prête pour TraceVolante");
        return null;
    }

    traceVolanteInstance = new TraceVolante(map, AppState);
    console.log("🆕 TraceVolante INSTANCIÉE avec succès");

    // Forcer la mise à jour si volToggle déjà coché
    const volToggle = document.getElementById('volToggle');
    if (volToggle?.checked) {
        console.log("⚡ VolToggle coché → mise à jour immédiate");
        setTimeout(() => {
            if (traceVolanteInstance) {
                traceVolanteInstance.safeUpdateTrace();
            }
        }, 500);
    }

    return traceVolanteInstance;
}


function displayTraceOnPlayeur(coordinates, fileName, fileType) {
    if (!AppState.mapPlayeur || !AppState.mapPlayeurInitialized) {
        console.warn("Carte playeur non initialisée");
        return;
    }

    console.log(`🎯 Affichage trace playeur: ${fileName} (${coordinates.length} points)`);

    // === SAUVEGARDER L'ÉCHELLE Z ACTUELLE ===
    const currentZScale = parseFloat(document.getElementById('zScale')?.value) || 1.5;
    console.log(`💾 Échelle Z sauvegardée: ${currentZScale}`);

    AppState.currentCoordinates = coordinates.map(c => [c[0], c[1], c[2] || 0]);
    AppState.currentFileName = fileName;

    const volToggle = document.getElementById("volToggle");
    if (!volToggle) {
        console.warn("volToggle non trouvé → polling...");
        const check = setInterval(() => {
            const toggle = document.getElementById("volToggle");
            if (toggle) {
                clearInterval(check);
                console.log("volToggle trouvé → reprise");
                setTimeout(() => continueDisplay(currentZScale), 100);
            }
        }, 200);
        return;
    }

    const isFlightMode = volToggle.checked;
    console.log(`🔀 Mode vol: ${isFlightMode}, Instance existante: ${!!traceVolanteInstance}`);

    function continueDisplay(savedZScale) {
        if (isFlightMode) {
            console.log("🔄 MODE VOL → Réinitialisation et activation TraceVolante");
            
            // FORCER UNE NOUVELLE INSTANCE
            const tv = initTraceVolante();
            if (tv) {
                setTimeout(() => {
                    console.log("🚀 Lancement mise à jour trace volante");
                    tv.safeUpdateTrace();
                }, 800);
            }
            return;
        }

        // === MODE SOL ===
        console.log(`🏔️ MODE SOL → restauration échelle Z: ${savedZScale}`);

        // Nettoyer les couches 3D volantes
        ['trace-flight-line', 'trace-flight-glow', 'trace-flight-markers'].forEach(id => {
            if (AppState.mapPlayeur.getLayer(id)) {
                AppState.mapPlayeur.removeLayer(id);
            }
            if (AppState.mapPlayeur.getSource(id)) {
                AppState.mapPlayeur.removeSource(id);
            }
        });

        // Réactiver le terrain AVEC l'échelle sauvegardée
        if (AppState.mapPlayeur.getSource('dem-playeur')) {
            AppState.mapPlayeur.setTerrain({
                source: "dem-playeur",
                exaggeration: savedZScale
            });
            console.log(`✅ Relief 3D restauré avec Z=${savedZScale}`);
        }

        // Mettre à jour le slider Z scale
        const zScaleInput = document.getElementById('zScale');
        const zScaleValue = document.getElementById('zScaleValue');
        if (zScaleInput && zScaleValue) {
            zScaleInput.value = savedZScale;
            zScaleValue.textContent = savedZScale.toFixed(1);
        }

        // Recréer la trace 2D
        recreateGroundTrace(coordinates, fileName, savedZScale);
    }

    continueDisplay(currentZScale);
}

function forceRefreshTrace() {
    console.log("🔄 FORÇAGE RAFRAÎCHISSEMENT TRACE");
    
    if (!AppState.currentCoordinates) {
        showMessage("❌ Aucune trace chargée", "red", 3000);
        return;
    }
    
    // Animation simple
    const refreshBtn = document.getElementById('forceRefreshBtn');
    if (refreshBtn) {
        refreshBtn.classList.add('rotating');
        setTimeout(() => refreshBtn.classList.remove('rotating'), 600);
    }
    
    // Votre logique existante...
    if (traceVolanteInstance) {
        traceVolanteInstance.destroy();
        traceVolanteInstance = null;
    }
    
    setTimeout(() => refreshPlayeurTrace(), 300);
}

// Ajoutez cette fonction dans la section d'initialisation
function setupRefreshButton() {
    const refreshBtn = document.getElementById('forceRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("🔄 Bouton de rafraîchissement cliqué");
            forceRefreshTrace();
        });
        
        // Ajouter aussi le raccourci clavier F5
        document.addEventListener('keydown', function(e) {
            if (e.key === 'F5') {
                e.preventDefault();
                console.log("⌨️ Raccourci F5 - Rafraîchissement forcé");
                forceRefreshTrace();
            }
        });
        
        console.log("✅ Bouton de rafraîchissement initialisé");
    }
}
// Ajouter un bouton ou un raccourci pour cette fonction
document.addEventListener('keydown', function(e) {
    if (e.key === 'F5') {
        e.preventDefault();
        forceRefreshTrace();
    }
});

function recreateGroundTrace(coordinates, fileName, zScale) {
    // Nettoyer l'ancienne trace 2D
    if (AppState.mapPlayeur.getSource('trace-playeur')) {
        try {
            AppState.mapPlayeur.removeLayer('trace-playeur');
            AppState.mapPlayeur.removeSource('trace-playeur');
        } catch (e) { console.warn("Erreur nettoyage trace-playeur:", e); }
    }

    // Recréer la source GeoJSON
    const geoJSON = {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            geometry: { type: "LineString", coordinates: coordinates },
            properties: { name: fileName }
        }]
    };

    AppState.mapPlayeur.addSource('trace-playeur', { type: 'geojson', data: geoJSON });

    // Recréer la couche
    const currentColor = document.getElementById('traceColor')?.value || '#ff0000';
    const currentWidth = parseFloat(document.getElementById('traceWidth')?.value) || 4;
    const currentOpacity = parseFloat(document.getElementById('traceOpacity')?.value) || 0.9;

    AppState.mapPlayeur.addLayer({
        id: 'trace-playeur',
        type: 'line',
        source: 'trace-playeur',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
            'line-color': currentColor,
            'line-width': currentWidth,
            'line-opacity': currentOpacity
        }
    });

    console.log(`✅ Trace sol restaurée (Z=${zScale})`);

    // Recréer le marqueur de départ
    if (AppState.startMarker) {
        AppState.startMarker.remove();
        AppState.startMarker = null;
    }

    if (coordinates.length > 0) {
        const startCoord = coordinates[0];
        const mobileIcon = document.getElementById('mobileIconValue')?.textContent || '✈️';
        const markerEl = document.createElement('div');
        markerEl.style.fontSize = '32px';
        markerEl.style.cursor = 'pointer';
        markerEl.textContent = mobileIcon;
        markerEl.title = `Départ - ${mobileIcon}`;
        
        AppState.startMarker = new maplibregl.Marker({ element: markerEl })
            .setLngLat([startCoord[0], startCoord[1]])
            .addTo(AppState.mapPlayeur);
        
        console.log(`📍 Marqueur de départ réaffiché: ${mobileIcon}`);
    }

    // Réinitialiser l'animation
    const animationCoordinates = coordinates.map(c => ({ lng: c[0], lat: c[1], alt: c[2] || 0 }));
    initSimpleAnimation(AppState.mapPlayeur, animationCoordinates);
    console.log(`🔄 Animation réinitialisée avec ${animationCoordinates.length} points`);

    // Ajuster la vue
    const bounds = new maplibregl.LngLatBounds();
    coordinates.forEach(c => bounds.extend([c[0], c[1]]));
    if (!bounds.isEmpty()) {
        AppState.mapPlayeur.fitBounds(bounds, { 
            padding: 80,
            pitch: 35,
            bearing: 0,
            maxZoom: 13,
            duration: 1000
        });
    }
}

// ===============================
// ANALYSE DES TRACES
// ===============================

function parseIGCLine(line, index) {
    if (!line.startsWith('B') || line.length < 35) {
        return null;
    }
    
    try {
        const latStr = line.substring(7, 15);
        const lonStr = line.substring(15, 24);
        const altPressureStr = line.substring(25, 30);
        const altGPSStr = line.substring(30, 35);
        
        const latDeg = parseInt(latStr.substring(0, 2), 10);
        const latMinStr = latStr.substring(2, 7);
        const latMin = parseFloat(latMinStr) / 1000;
        const latDir = latStr.substring(7);
        
        if (isNaN(latDeg) || isNaN(latMin) || !['N', 'S'].includes(latDir)) {
            throw new Error(`Latitude invalide à la ligne ${index + 1}`);
        }
        
        let latitude = latDeg + (latMin / 60);
        if (latDir === 'S') latitude = -latitude;
        
        const lonDeg = parseInt(lonStr.substring(0, 3), 10);
        const lonMinStr = lonStr.substring(3, 8);
        const lonMin = parseFloat(lonMinStr) / 1000;
        const lonDir = lonStr.substring(8);
        
        if (isNaN(lonDeg) || isNaN(lonMin) || !['E', 'W'].includes(lonDir)) {
            throw new Error(`Longitude invalide à la ligne ${index + 1}`);
        }
        
        let longitude = lonDeg + (lonMin / 60);
        if (lonDir === 'W') longitude = -longitude;
        
        let altitude = 0;
        const altGPS = parseInt(altGPSStr, 10);
        const altPressure = parseInt(altPressureStr, 10);
        
        if (!isNaN(altGPS) && altGPS >= -500 && altGPS <= 15000) {
            altitude = altGPS;
        } else if (!isNaN(altPressure) && altPressure >= -500 && altPressure <= 15000) {
            altitude = altPressure;
        }
        
        if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            throw new Error(`Coordonnées hors limites à la ligne ${index + 1}`);
        }
        
        return {
            longitude,
            latitude,
            altitude,
            valid: altitude > 0
        };
        
    } catch (error) {
        console.warn(`Erreur parsing ligne IGC ${index + 1}:`, error.message);
        return null;
    }
}

function getAltitudes(coordinates) {
    const altitudes = [];
    coordinates.forEach(coord => {
        if (coord[2] !== undefined && coord[2] > 0) {
            altitudes.push(coord[2]);
        }
    });
    return altitudes;
}

function calculateElevationGain(altitudes) {
    let totalGain = 0;
    for (let i = 1; i < altitudes.length; i++) {
        const diff = altitudes[i] - altitudes[i-1];
        if (diff > 0) {
            totalGain += diff;
        }
    }
    return totalGain;
}

function calculateElevationLoss(altitudes) {
    let totalLoss = 0;
    for (let i = 1; i < altitudes.length; i++) {
        const diff = altitudes[i] - altitudes[i-1];
        if (diff < 0) {
            totalLoss += Math.abs(diff);
        }
    }
    return totalLoss;
}

function detectFlightPattern(coordinates) {
    if (coordinates.length < 10) return false;
    
    const altitudes = coordinates.map(coord => coord[2] || 0);
    const validAltitudes = altitudes.filter(alt => alt > 0 && alt < 10000);
    
    if (validAltitudes.length < 5) return false;
    
    const minAlt = Math.min(...validAltitudes);
    const maxAlt = Math.max(...validAltitudes);
    const altRange = maxAlt - minAlt;
    
    let ascendingSections = 0;
    let totalAscend = 0;
    
    for (let i = 1; i < validAltitudes.length; i++) {
        const diff = validAltitudes[i] - validAltitudes[i-1];
        if (diff > 50) {
            ascendingSections++;
            totalAscend += diff;
        }
    }
    
    const isFlight = (
        altRange > 200 &&
        ascendingSections > 3 &&
        totalAscend > 300 &&
        maxAlt > 500
    );
    
    return isFlight;
}

function analyzeAltitudes(coordinates) {
    const altitudes = getAltitudes(coordinates);
    
    if (altitudes.length === 0) {
        return {
            hasAltitude: false,
            message: "Aucune donnée d'altitude trouvée"
        };
    }
    
    const isFlight = detectFlightPattern(coordinates);
    
    return {
        hasAltitude: true,
        isFlight: isFlight,
        count: altitudes.length,
        min: Math.min(...altitudes),
        max: Math.max(...altitudes),
        avg: Math.round(altitudes.reduce((a,b) => a+b) / altitudes.length),
        totalGain: Math.round(calculateElevationGain(altitudes)),
        totalLoss: Math.round(calculateElevationLoss(altitudes)),
        amplitude: Math.max(...altitudes) - Math.min(...altitudes)
    };
}

function displayAltitudeStats(stats, fileName) {
    if (!stats.hasAltitude) {
        console.log(`${fileName}: ${stats.message}`);
        return;
    }
    
    console.log(`\n=== ANALYSE ALTITUDE - ${fileName} ===`);
    console.log(`📊 Points avec altitude: ${stats.count}`);
    console.log(`🏔️ Altitude min: ${stats.min}m`);
    console.log(`⛰️ Altitude max: ${stats.max}m`);
    console.log(`📈 Altitude moyenne: ${stats.avg}m`);
    console.log(`📏 Amplitude: ${stats.amplitude}m`);
    console.log(`⬆️ Dénivelé positif: ${stats.totalGain}m`);
    console.log(`⬇️ Dénivelé négatif: ${stats.totalLoss}m`);
    console.log(`✈️ Détecté comme vol: ${stats.isFlight ? 'OUI' : 'NON'}`);
    
    const debugDiv = document.querySelector('.debug-info');
    if (debugDiv) {
        const altInfo = `<div style="font-size: 12px; margin-top: 10px; color: #00ff00;">
            <strong>Analyse Altitude:</strong><br>
            Min/Max: ${stats.min}m - ${stats.max}m<br>
            Dénivelé +/-: ${stats.totalGain}m / ${stats.totalLoss}m<br>
            Type: ${stats.isFlight ? 'VOL ✈️' : 'TRACE TERRESTRE 🚶'}
        </div>`;
        debugDiv.innerHTML += altInfo;
    }
}

// ===============================
// TRAITEMENT DES FICHIERS
// ===============================
function processFile(file) {
    const debugDiv = document.querySelector('.debug-info');
    showMessage(`📂 Traitement de ${file.name}...`, '#0066cc');

    const reader = new FileReader();

    reader.onload = function(event) {
        currentRawContent = typeof event.target.result === 'string' ? event.target.result : '';

        try {
            const ext = file.name.split('.').pop().toLowerCase();
            let coordinates = [];
            let geoJSON = null;

            if (ext === "gpx") {
                console.log("Traitement GPX...");
                const xml = new DOMParser().parseFromString(event.target.result, "text/xml");
                geoJSON = toGeoJSON.gpx(xml);

            } else if (ext === "kml") {
                console.log("Traitement KML...");
                const xml = new DOMParser().parseFromString(event.target.result, "text/xml");
                geoJSON = toGeoJSON.kml(xml);

            } else if (ext === "igc") {
                console.log("Traitement IGC...");
                const lines = event.target.result.split('\n');
                coordinates = [];

                lines.forEach((line, index) => {
                    const parsed = parseIGCLine(line, index);
                    if (parsed) coordinates.push([parsed.longitude, parsed.latitude, parsed.altitude]);
                });

                if (coordinates.length === 0) throw new Error("Aucun point valide trouvé dans le fichier IGC");

                geoJSON = {
                    type: "FeatureCollection",
                    features: [{
                        type: "Feature",
                        geometry: { type: "LineString", coordinates },
                        properties: { name: file.name }
                    }]
                };

            } else if (ext === "tcx") {
                console.log("Traitement TCX...");
                const xml = new DOMParser().parseFromString(event.target.result, "text/xml");
                const points = xml.getElementsByTagNameNS("*", "Trackpoint");
                coordinates = [];

                for (let i = 0; i < points.length; i++) {
                    const lat = parseFloat(points[i].getElementsByTagName("LatitudeDegrees")[0]?.textContent);
                    const lon = parseFloat(points[i].getElementsByTagName("LongitudeDegrees")[0]?.textContent);
                    const alt = parseFloat(points[i].getElementsByTagName("AltitudeMeters")[0]?.textContent) || 0;
                    if (!isNaN(lat) && !isNaN(lon)) coordinates.push([lon, lat, alt]);
                }

                if (coordinates.length === 0) throw new Error("Aucun point valide trouvé dans le TCX");

                geoJSON = {
                    type: "FeatureCollection",
                    features: [{
                        type: "Feature",
                        geometry: { type: "LineString", coordinates },
                        properties: { name: file.name }
                    }]
                };

            } else if (ext === "fit") {
                console.log("Traitement FIT...");
                showMessage("⏳ Analyse du fichier FIT en cours...", '#0066cc');

                if (event.target.result instanceof ArrayBuffer) {
                    try {
                        if (typeof FitParser !== 'undefined') {
                            const fitParser = new FitParser({
                                force: true,
                                speedUnit: 'km/h',
                                lengthUnit: 'm',
                                elapsedRecordField: true
                            });

                            fitParser.parse(event.target.result, (error, data) => {
                                if (error) {
                                    console.error("Erreur FIT parser:", error);
                                    fallbackFitProcessing(event.target.result, file, ext);
                                    return;
                                }
                                processFitData(data, file, ext);
                            });
                        } else {
                            fallbackFitProcessing(event.target.result, file, ext);
                        }
                    } catch (error) {
                        console.error("Erreur FIT parser:", error);
                        fallbackFitProcessing(event.target.result, file, ext);
                    }
                } else {
                    showMessage("❌ Format de fichier FIT non supporté", 'red');
                }
                return;
            } else {
                throw new Error(`Format ${ext} non supporté. Utilisez GPX, KML, IGC, TCX ou FIT.`);
            }

            if (ext !== 'fit') {
                coordinates = extractCoordinatesFromGeoJSON(geoJSON);
                if (coordinates.length === 0) throw new Error("Aucune coordonnée valide trouvée dans le fichier");
            }

            finalizeTraceProcessing(geoJSON, coordinates, file, ext);

        } catch (error) {
            console.error("❌ Erreur traitement fichier:", error);
            showMessage(`❌ Erreur lors du traitement de ${file.name}: ${error.message}`, 'red');
        }
    };

    reader.onerror = function() {
        showMessage(`❌ Erreur de lecture du fichier ${file.name}`, 'red');
    };

    if (file.name.toLowerCase().endsWith('.fit')) {
        console.log("📖 Lecture FIT en ArrayBuffer");
        reader.readAsArrayBuffer(file);
    } else {
        console.log("📖 Lecture en texte");
        reader.readAsText(file);
    }
}

function extractCoordinatesFromGeoJSON(geoJSON) {
    const coordinates = [];
    
    if (!geoJSON || !geoJSON.features) {
        return coordinates;
    }
    
    geoJSON.features.forEach(feature => {
        if (feature.geometry) {
            if (feature.geometry.type === "LineString" && feature.geometry.coordinates) {
                feature.geometry.coordinates.forEach(coord => {
                    if (coord.length >= 2) {
                        const lng = coord[0];
                        const lat = coord[1];
                        const alt = coord[2] || 0;
                        coordinates.push([lng, lat, alt]);
                    }
                });
            } else if (feature.geometry.type === "Point" && feature.geometry.coordinates) {
                const coord = feature.geometry.coordinates;
                if (coord.length >= 2) {
                    const lng = coord[0];
                    const lat = coord[1];
                    const alt = coord[2] || 0;
                    coordinates.push([lng, lat, alt]);
                }
            }
        }
    });
    
    return coordinates;
}

function finalizeTraceProcessing(geoJSON, coordinates, file, ext) {
    console.log(`🎯 Finalisation du traitement: ${file.name} (${coordinates.length} points)`);
    
    AppState.currentCoordinates = coordinates;
    AppState.currentFileName = file.name;
    AppState.currentFileType = ext;

    const stats = analyzeAltitudes(coordinates);
    displayAltitudeStats(stats, file.name);
    displayTraceOnMap(coordinates, file.name, ext, stats.isFlight);
    
    // Rafraîchir le playeur si on y est déjà
    if (AppState.currentPage === 'playeur') {
        refreshPlayeurTrace();
    }
    
    console.log("✅ Traitement finalisé avec succès");
    const debugDiv = document.querySelector('.debug-info');
    if (debugDiv) {
        debugDiv.innerHTML = `
            <div style="color: lime; font-weight: bold;">
                ✅ Trace chargée : ${file.name}
            </div>
        `;
    }
}

function displayTraceOnMap(coordinates, fileName, fileType, isFlight) {
    const debugDiv = document.querySelector('.debug-info');
    
    if (!AppState.map) {
        showMessage("❌ Carte non disponible", 'red');
        return;
    }
    
    const geoJSON = {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: coordinates
            },
            properties: {
                name: fileName,
                type: fileType
            }
        }]
    };
    
    if (AppState.map.getSource('trace')) {
        AppState.map.removeLayer('trace-layer');
        AppState.map.removeSource('trace');
    }
    
    try {
        AppState.map.addSource('trace', {
            type: 'geojson',
            data: geoJSON
        });
        
        const colors = {
            igc: '#00ff00',
            kml: '#0000ff', 
            gpx: '#ff0000',
            tcx: '#ff00ff',
            fit: '#ffff00'
        };
        
        AppState.map.addLayer({
            id: 'trace-layer',
            type: 'line',
            source: 'trace',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': colors[fileType] || '#ff0000',
                'line-width': 4,
                'line-opacity': 0.9
            }
        });
        
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach(coord => {
            bounds.extend([coord[0], coord[1]]);
        });
        
        if (!bounds.isEmpty()) {
            AppState.map.fitBounds(bounds, { 
                padding: 80,
                pitch: 30,
                bearing: 0,
                maxZoom: 13,
                duration: 2000
            });
        }
        
        const flightInfo = isFlight ? " ✈️ VOL" : " 🚶 Trace terrestre";
        const successMessage = `
            <div style="color: lime; font-weight: bold;">
                ✅ ${fileName} chargé avec succès !${flightInfo}<br>
                📍 ${coordinates.length} points affichés
            </div>
        `;
        
        debugDiv.innerHTML = successMessage;
        
        console.log(`✅ Trace affichée: ${coordinates.length} points`);
        
    } catch (error) {
        console.error("❌ Erreur affichage trace:", error);
        showMessage("❌ Erreur lors de l'affichage de la trace", 'red');
    }
}

// ===============================
// AFFICHAGE TEMPORISÉ DES MESSAGES DANS debug-info
// ===============================

function showMessage(msg, color = 'red', duration = 5000) {
    console.log("📢:", msg);
    
    // Créer un message positionné plus bas
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        bottom: 120px;  /* ← */
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.55);  /* ← PLUS TRANSPARENT */
        color: ${color};
        padding: 20px 30px;
        border-radius: 50px;  /* ← COINS ARRONDIS */
        z-index: 99999;
        font-size: 18px;
        font-weight: bold;
        border: 2px solid ${color};
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
        text-align: center;
        min-width: 280px;
        max-width: 80%;
        backdrop-filter: blur(15px);  /* ← EFFET FLOU */
        font-family: Arial, sans-serif;
        opacity: 0;
        transition: all 0.4s ease;
    `;
    messageDiv.innerHTML = `
        <div>${msg}</div>
        <div style="font-size: 11px; margin-top: 8px; opacity: 0.6;">
            (fermeture dans ${duration/1000}s)
        </div>
    `;
    
    // Supprimer les anciens messages
    const oldMessages = document.querySelectorAll('[id^="debug-message"]');
    oldMessages.forEach(msg => msg.remove());
    
    messageDiv.id = 'debug-message-' + Date.now();
    document.body.appendChild(messageDiv);
    
    // Animation d'entrée
    setTimeout(() => {
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    // Supprimer après la durée
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 400);
    }, duration);
}

// ===============================
// NETTOYAGE
// ===============================

function clearTraces() {
    console.log("🧹 Nettoyage complet des traces et états...");

    // 🛑 DÉTRUIRE L'INSTANCE TRACE VOLANTE
    if (traceVolanteInstance) {
        traceVolanteInstance.destroy();
        traceVolanteInstance = null;
        console.log("🗑️ Instance TraceVolante détruite");
    }

    // 🛑 Arrêter toute animation en cours
    if (window.simpleAnimationPlayer && window.simpleAnimationPlayer.animationInterval) {
        clearInterval(window.simpleAnimationPlayer.animationInterval);
        window.simpleAnimationPlayer.animationInterval = null;
        console.log("⏹️ Animation stoppée");
    }

    // 🔄 RÉINITIALISER LE CYCLE PITCH
    if (window.cameraState) {
        resetPitchCycle(window.cameraState);
        console.log("🔄 Cycle pitch réinitialisé");
    }

    // 🔊 Réinitialiser le toggle Vol
    const volToggle = document.getElementById("volToggle");
    if (volToggle) {
        volToggle.checked = false; // FORCER LE MODE SOL
        const newToggle = volToggle.cloneNode(true);
        volToggle.parentNode.replaceChild(newToggle, volToggle);
        console.log("♻️ volToggle réinitialisé (forcé en mode SOL)");
    }

    // 🧭 Supprimer le marqueur de départ
    if (AppState.startMarker) {
        AppState.startMarker.remove();
        AppState.startMarker = null;
    }

    // 🗺️ Nettoyer la carte principale
    if (AppState.map && AppState.map.getSource) {
        ["trace", "trace-layer"].forEach(id => {
            try {
                if (AppState.map.getLayer(id)) AppState.map.removeLayer(id);
                if (AppState.map.getSource(id)) AppState.map.removeSource(id);
            } catch (e) { console.warn("⚠️ Erreur nettoyage carte:", e); }
        });
    }

    // 🎮 Nettoyer la carte playeur - TOUTES LES COUCHES
    if (AppState.mapPlayeur && AppState.mapPlayeur.getSource) {
        const layersToRemove = [
            "trace-playeur", 
            "trace-playeur-layer",
            "trace-flight-line", 
            "trace-flight-glow", 
            "trace-flight-markers"
        ];
        
        layersToRemove.forEach(id => {
            try {
                if (AppState.mapPlayeur.getLayer(id)) {
                    AppState.mapPlayeur.removeLayer(id);
                    console.log(`🗑️ Couche ${id} supprimée`);
                }
                if (AppState.mapPlayeur.getSource(id)) {
                    AppState.mapPlayeur.removeSource(id);
                    console.log(`🗑️ Source ${id} supprimée`);
                }
            } catch (e) { 
                console.warn(`⚠️ Erreur nettoyage ${id}:`, e); 
            }
        });

        // RESTAURER LE TERRAIN 3D
        if (AppState.mapPlayeur.getSource('dem-playeur')) {
            try {
                AppState.mapPlayeur.setTerrain({
                    source: "dem-playeur",
                    exaggeration: 1.5
                });
                console.log("🏔️ Terrain 3D restauré");
            } catch (e) {
                console.warn("⚠️ Erreur restauration terrain:", e);
            }
        }
    }

    // 🔄 Réinitialiser l'état global
    Object.assign(AppState, {
        currentTrace: null,
        currentCoordinates: null,
        currentFileName: null,
        currentFileType: null
    });
    currentRawContent = "";

    // 🧽 Nettoyer la zone debug
    const debugDiv = document.querySelector('.debug-info');
    if (debugDiv) {
        debugDiv.innerHTML = "✅ Système nettoyé - prêt pour un nouveau chargement.";
    }

    console.log("✅ Nettoyage terminé");
}
// CHANGEMENT DE STYLE DE CARTE
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  const styleSelector = document.getElementById('mapStyleSelect');
  if (styleSelector) {
    styleSelector.addEventListener('change', (e) => {
      const newStyle = e.target.value;
      console.log(`🎨 Changement de fond de carte : ${newStyle}`);

      // Carte principale
      if (AppState.map) {
        try {
          AppState.map.setStyle(newStyle);
        } catch (err) {
          console.error("❌ Erreur changement style (carte principale):", err);
        }
      }

      // Carte Playeur
      if (AppState.mapPlayeur) {
        try {
          AppState.mapPlayeur.setStyle(newStyle);
        } catch (err) {
          console.error("❌ Erreur changement style (carte playeur):", err);
        }
      }
    });
  }
});

// ===============================
// GESTION DU CHOIX DU FOND DE CARTE
// ===============================

const MAPTILER_KEY = "zv0cJDROvQbyb5SevYhh";
const mapStyles = {
  hybrid: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
  streets: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`,
  topo: `https://api.maptiler.com/maps/topo/style.json?key=${MAPTILER_KEY}`,
  outdoor: `https://api.maptiler.com/maps/outdoor/style.json?key=${MAPTILER_KEY}`,
  toner: `https://api.maptiler.com/maps/toner/style.json?key=${MAPTILER_KEY}`
};

// Appliquer le style sauvegardé (si disponible)
document.addEventListener("DOMContentLoaded", () => {
  const styleSelect = document.getElementById("mapStyleSelect");
  if (!styleSelect) return;

  // Charger le style sauvegardé
  const savedStyle = localStorage.getItem("selectedMapStyle") || "hybrid";
  styleSelect.value = savedStyle;

  // Quand l'utilisateur change de fond
  styleSelect.addEventListener("change", (e) => {
    const selected = e.target.value;
    localStorage.setItem("selectedMapStyle", selected);
    updateAllMapsStyle(selected);
  });

  // Appliquer dès le chargement
  updateAllMapsStyle(savedStyle);
});

function updateAllMapsStyle(styleKey) {
    const newStyle = mapStyles[styleKey];
    if (!newStyle) return;

    console.log(`🎨 Application du fond : ${styleKey}`);

    const applyToMap = (map, config = {}) => {
        const {
            traceSourceId = "trace",
            traceLayerId = "trace",
            demSourceId = "dem",
            isPlayeur = false
        } = config;

        if (!map || !map.isStyleLoaded()) return;

        try {
            // 📦 SAUVEGARDE DE L'ÉTAT ACTUEL
            const existingTraceData = map.getSource(traceSourceId)?.serialize?.().data || null;
            
            // Sauvegarder les propriétés de style de la trace
            let traceColor = "#ff0000";
            let traceWidth = 4;
            let traceOpacity = 0.9;
            
            if (map.getLayer(traceLayerId)) {
                traceColor = map.getPaintProperty(traceLayerId, 'line-color') || traceColor;
                traceWidth = map.getPaintProperty(traceLayerId, 'line-width') || traceWidth;
                traceOpacity = map.getPaintProperty(traceLayerId, 'line-opacity') || traceOpacity;
            }
            
            // Récupérer l'échelle Z actuelle (spécifique à chaque carte)
            const currentZScale = isPlayeur 
                ? parseFloat(document.getElementById('zScale')?.value || 1.5)
                : 1.5;
            
            // Sauvegarder la position de la caméra
            const camera = {
                center: map.getCenter(),
                zoom: map.getZoom(),
                bearing: map.getBearing(),
                pitch: map.getPitch()
            };

            console.log(`💾 Sauvegarde état ${isPlayeur ? 'playeur' : 'carte'} - Z:${currentZScale}`);

            // 🔄 CHANGEMENT DE STYLE
            map.setStyle(newStyle);

            // 🎯 RÉAPPLICATION APRÈS CHARGEMENT
            map.once("styledata", () => {
                console.log(`📥 Style chargé pour ${isPlayeur ? 'playeur' : 'carte'}`);
                
                try {
                    // 1️⃣ RESTAURER LA POSITION DE LA CAMÉRA
                    map.jumpTo({
                        center: camera.center,
                        zoom: camera.zoom,
                        bearing: camera.bearing,
                        pitch: camera.pitch
                    });

                    // 2️⃣ RÉAPPLIQUER LE TERRAIN DEM (CRITIQUE!)
                    if (!map.getSource(demSourceId)) {
                        map.addSource(demSourceId, {
                            type: "raster-dem",
                            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
                        });
                    }
                    
                    // Appliquer le terrain avec la bonne exagération
                    map.setTerrain({ 
                        source: demSourceId, 
                        exaggeration: currentZScale
                    });
                    
                    console.log(`✅ Terrain 3D réappliqué (Z=${currentZScale})`);

                    // 3️⃣ RÉAFFICHER LA TRACE SI ELLE EXISTE
                    if (existingTraceData) {
                        // Nettoyer l'ancienne trace si elle existe
                        if (map.getLayer(traceLayerId)) {
                            map.removeLayer(traceLayerId);
                        }
                        if (map.getSource(traceSourceId)) {
                            map.removeSource(traceSourceId);
                        }

                        // Ajouter la source
                        map.addSource(traceSourceId, {
                            type: "geojson",
                            data: existingTraceData,
                        });

                        // Ajouter la couche avec les propriétés sauvegardées
                        map.addLayer({
                            id: traceLayerId,
                            type: "line",
                            source: traceSourceId,
                            layout: {
                                'line-join': 'round',
                                'line-cap': 'round'
                            },
                            paint: {
                                "line-color": traceColor,
                                "line-width": traceWidth,
                                "line-opacity": traceOpacity,
                            },
                        });

                        console.log(`✅ Trace réaffichée (couleur: ${traceColor}, largeur: ${traceWidth})`);
                    }

                    // 5️⃣ AJOUTER LES CONTRÔLES DE NAVIGATION (si pas déjà présents)
                    if (!map._controls || map._controls.length === 0) {
                        map.addControl(new maplibregl.NavigationControl());
                    }

                } catch (err) {
                    console.error(`❌ Erreur réapplication ${isPlayeur ? 'playeur' : 'carte'}:`, err);
                }
            });

        } catch (e) {
            console.error(`❌ Erreur changement style ${isPlayeur ? 'playeur' : 'carte'}:`, e);
        }
    };

    // 🗺️ APPLIQUER AUX DEUX CARTES AVEC CONFIGS SPÉCIFIQUES
    if (AppState.map) {
        applyToMap(AppState.map, {
            traceSourceId: "trace",
            traceLayerId: "trace-layer",
            demSourceId: "dem",
            isPlayeur: false
        });
    }

    if (AppState.mapPlayeur) {
        applyToMap(AppState.mapPlayeur, {
            traceSourceId: "trace-playeur",
            traceLayerId: "trace-playeur",
            demSourceId: "dem-playeur",
            isPlayeur: true
        });
    }

    // Mémoriser le style courant
    AppState.currentMapStyle = styleKey;
    
    console.log(`🎉 Changement de fond terminé : ${styleKey}`);
}

// Script pour gérer la sélection du moyen de mobilité
document.addEventListener('DOMContentLoaded', function() {
    const mobileSelector = document.getElementById('mobileSelector');
    const mobileIconValue = document.getElementById('mobileIconValue');
    
    // Mise à jour quand la sélection change
    mobileSelector.addEventListener('change', function() {
        const selectedIcon = this.value;
        mobileIconValue.textContent = selectedIcon;
        console.log("Moyen de mobilité sélectionné:", selectedIcon);
        
        // Ici vous pouvez ajouter la logique pour mettre à jour la visualisation
        // en fonction du moyen de mobilité sélectionné
    });
});

// ===============================
// FONCTIONS MANQUANTES
// ===============================

function setupMapInteractionListeners() {
    console.log("🔧 Configuration des écouteurs d'interaction carte...");
    // Cette fonction peut être vide pour l'instant ou contenir votre logique
}

function fallbackFitProcessing(arrayBuffer, file, ext) {
    console.warn("⚠️ Fallback FIT processing non implémenté");
    showMessage("❌ Traitement FIT non disponible", 'red');
}

function processFitData(data, file, ext) {
    console.warn("⚠️ Process FIT data non implémenté");
    showMessage("❌ Traitement FIT data non disponible", 'red');
}

// Export pour debug
window.App = {
    state: AppState,
    showPage: showPage,
    clearTraces: clearTraces,
    refreshPlayeurTrace: refreshPlayeurTrace
};

console.log("🎯 Script chargé - Système de pages actif");

// =============================================================================
// ANIMATION PLAYER SIMPLE (à ajouter à la fin du fichier)
// =============================================================================

class SimpleAnimationPlayer {
    constructor() {
        this.isPlaying = false;
        this.isLooping = false;
        this.currentPosition = 0;
        this.traceCoordinates = [];
        this.mobileMarker = null;
        this.map = null;
        this.animationInterval = null;
        this.setupEventListeners();
        this.isPlaying = false;
        this.isLooping = false;
        this.currentPosition = 0;
        this.traceCoordinates = [];
        this.mobileMarker = null;
        this.map = null;
        this.animationInterval = null;
        
        // === NOUVELLES PROPRIÉTÉS POUR AVANCE RAPIDE ===
        this.isFastForward = false;
        this.fastForwardFactor = 1;
        this.wasPlaying = false;
    }

    setupEventListeners() {
        // Utiliser les boutons existants sans modifier le HTML
        const buttons = document.querySelectorAll('.ctrl-btn');
        
        if (buttons[0]) buttons[0].addEventListener('click', () => this.rewind());
        if (buttons[1]) buttons[1].addEventListener('click', () => this.togglePlayPause());
        if (buttons[2]) buttons[2].addEventListener('click', () => this.fastForward());
        if (buttons[3]) buttons[3].addEventListener('click', () => this.toggleLoop());
    }

    init(map, coordinates) {
        this.map = map;
        this.traceCoordinates = coordinates;
        this.currentPosition = 0;
        
        this.createMobileMarker();
    }

    createMobileMarker() {
        // Supprimer l'ancien marqueur s'il existe
        if (this.mobileMarker) {
            this.mobileMarker.remove();
        }

        const el = document.createElement('div');
        el.className = 'mobile-marker';
        const mobileIcon = document.getElementById('mobileIconValue');
        el.innerHTML = mobileIcon ? mobileIcon.textContent : '🥾';
        el.style.fontSize = '24px';
        el.style.textAlign = 'center';
        
        this.mobileMarker = new maplibregl.Marker({
            element: el
        })
        .setLngLat([0, 0])
        .addTo(this.map);
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (this.traceCoordinates.length === 0) return;
        
        this.isPlaying = true;
        const buttons = document.querySelectorAll('.ctrl-btn');
        if (buttons[1]) buttons[1].innerHTML = '⏸️';
        
        // ===== FAIRE DISPARAÎTRE LE MARQUEUR DE DÉPART =====
        if (AppState.startMarker) {
            AppState.startMarker.remove();
            AppState.startMarker = null;
            console.log("🗑️ Marqueur de départ supprimé");
        }
        // ===== FIN SUPPRESSION MARQUEUR =====
        
        this.animationInterval = setInterval(() => {
            this.moveToNextPosition();
        }, 100);
    }

    pause() {
        this.isPlaying = false;
        const buttons = document.querySelectorAll('.ctrl-btn');
        if (buttons[1]) buttons[1].innerHTML = '⏯️';
        
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    rewind() {
        this.pause();
        this.currentPosition = 0;
        
        // ===== RÉAFFICHER LE MARQUEUR DE DÉPART =====
        if (AppState.currentCoordinates && AppState.currentCoordinates.length > 0 && !AppState.startMarker) {
            const startCoord = AppState.currentCoordinates[0];
            const mobileIcon = document.getElementById('mobileIconValue')?.textContent || '✈️';
            
            const markerEl = document.createElement('div');
            markerEl.style.fontSize = '32px';
            markerEl.style.cursor = 'pointer';
            markerEl.textContent = mobileIcon;
            markerEl.title = `Départ - ${mobileIcon}`;
            
            AppState.startMarker = new maplibregl.Marker({ element: markerEl })
                .setLngLat([startCoord[0], startCoord[1]])
                .addTo(this.map);
            
            console.log(`📍 Marqueur de départ réaffiché: ${mobileIcon}`);
        }
        // ===== FIN RÉAFFICHAGE MARQUEUR =====
        
        this.updateMarkerPosition();
    }

    fastForward() {
        if (this.traceCoordinates.length === 0) return;
        
        // Si déjà en avance rapide, augmenter le facteur ou revenir à la normale
        if (this.isFastForward) {
            if (this.fastForwardFactor < 16) {
                // Augmenter le facteur
                this.fastForwardFactor = Math.min(this.fastForwardFactor * 2, 16);
            } else {
                // Revenir à la vitesse normale après 16x
                this.stopFastForward();
                return;
            }
        } else {
            // Première activation de l'avance rapide
            this.isFastForward = true;
            this.fastForwardFactor = 2; // Commence à 2x
            this.wasPlaying = this.isPlaying; // Sauvegarder l'état de lecture
        }
        
        console.log(`⏭️ Avance rapide: ${this.fastForwardFactor}x`);
        
        // Mettre à jour l'apparence du bouton
        const buttons = document.querySelectorAll('.ctrl-btn');
        if (buttons[2]) {
            buttons[2].innerHTML = `⏭️${this.fastForwardFactor}x`;
            buttons[2].style.backgroundColor = '#4CAF50';
            buttons[2].title = `Avance rapide ${this.fastForwardFactor}x`;
        }
        
        // Si pas déjà en lecture, démarrer l'avance rapide
        if (!this.isPlaying) {
            this.playFastForward();
        } else {
            // Si déjà en lecture, ajuster la vitesse
            this.adjustAnimationSpeed();
        }
    }

    stopFastForward() {
        this.isFastForward = false;
        this.fastForwardFactor = 1;
        
        // Restaurer l'apparence du bouton
        const buttons = document.querySelectorAll('.ctrl-btn');
        if (buttons[2]) {
            buttons[2].innerHTML = '⏭️';
            buttons[2].style.backgroundColor = '';
            buttons[2].title = 'Avance rapide';
        }
        
        console.log("⏭️ Retour à la vitesse normale");
        
        this.pause();
        
        // Si on était en lecture avant l'avance rapide, reprendre la lecture normale
        if (this.wasPlaying) {
            setTimeout(() => {
                this.play();
            }, 100);
        }
    }

    playFastForward() {
        this.isPlaying = true;
        const buttons = document.querySelectorAll('.ctrl-btn');
        if (buttons[1]) buttons[1].innerHTML = '⏸️';
        
        // Supprimer le marqueur de départ si présent
        if (AppState.startMarker) {
            AppState.startMarker.remove();
            AppState.startMarker = null;
        }
        
        this.animationInterval = setInterval(() => {
            this.moveToNextPositionFast();
        }, 100 / this.fastForwardFactor); // Vitesse ajustée selon le facteur
    }

    moveToNextPositionFast() {
        this.currentPosition += this.fastForwardFactor;
        
        if (this.currentPosition >= this.traceCoordinates.length) {
            if (this.isLooping) {
                this.currentPosition = 0;
            } else {
                this.stopFastForward();
                return;
            }
        }
        
        this.updateMarkerPosition();
    }

    adjustAnimationSpeed() {
        // Redémarrer l'animation avec la nouvelle vitesse
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = setInterval(() => {
                this.moveToNextPositionFast();
            }, 100 / this.fastForwardFactor);
        }
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;
        const buttons = document.querySelectorAll('.ctrl-btn');
        if (buttons[3]) {
            buttons[3].style.backgroundColor = this.isLooping ? '#4CAF50' : '';
        }
    }

    moveToNextPosition() {
        this.currentPosition += 1;
        
        if (this.currentPosition >= this.traceCoordinates.length) {
            if (this.isLooping) {
                this.currentPosition = 0;
            } else {
                this.pause();
                return;
            }
        }
        
        this.updateMarkerPosition();
    }

    updateMarkerPosition() {
        if (this.currentPosition < this.traceCoordinates.length && this.mobileMarker) {
            const coord = this.traceCoordinates[this.currentPosition];
            this.mobileMarker.setLngLat([coord.lng, coord.lat]);
            
            // Centrer la carte sur la position si le recentrage est enable)
            if (this.isRecenterEnabled) {
                this.map.flyTo({ center: [coord.lng, coord.lat], essential: true, duration: 500 });
            }
            this.updateMobileIcon();
        }
    }

    updateMobileIcon() {
        if (this.mobileMarker && this.mobileMarker.getElement()) {
            const mobileIcon = document.getElementById('mobileIconValue');
            if (mobileIcon) {
                this.mobileMarker.getElement().innerHTML = mobileIcon.textContent;
            }
        }
    }

    setTraceCoordinates(coordinates) {
        this.traceCoordinates = coordinates;
        this.currentPosition = 0;
        
        if (coordinates.length > 0 && this.mobileMarker) {
            this.updateMarkerPosition();
        }
    }
}

// Variable globale
let simpleAnimationPlayer = null;

// Fonction d'initialisation
function initSimpleAnimation(map, coordinates) {
    if (!simpleAnimationPlayer) {
        simpleAnimationPlayer = new SimpleAnimationPlayer();
    }
    simpleAnimationPlayer.init(map, coordinates);
}

// ===============================
// MASQUER LES PANNEAUX LATERAUX ET CONTROLES APRÈS INACTIVITÉ
// AVEC EFFET DE GLISSEMENT VERS L'EXTERIEUR
// ===============================

let inactivityTimer = null;

const controlsSelector = `
    .ctrl-btn,
    .debug-info,
    .slider-container,
    .control-panel,
    .player-controls,
    .toolbar,
    .left-panel,
    .right-panel,
    .controls,
    .controls-left,
    .controls-right,
    .panel-background,
    #traceWidth, #traceWidthValue, label[for="traceWidth"],
    #traceColor, label[for="traceColor"],
    #traceOpacity, #traceOpacityValue, label[for="traceOpacity"],
    #mobileSelector, #mobileIconValue, label[for="mobileSelector"],
    #zScale, #zScaleValue, label[for="zScale"],
    .maplibregl-ctrl-top-left,
    .maplibregl-ctrl-top-right,
    .maplibregl-ctrl-bottom-left,
    .maplibregl-ctrl-bottom-right
    `;

function hideControls() {
    if (AppState.currentPage !== 'playeur') return;

    // Étape 1 : 3 secondes - faire glisser vers l'exterieur
    document.querySelectorAll(controlsSelector).forEach(el => {
        // Détecter si c'est un panneau de gauche ou droite
        const isLeftPanel = el.classList.contains('controls-left') || 
                            el.classList.contains('left-panel') ||
                            el.classList.contains('maplibregl-ctrl-top-left') ||
                            el.classList.contains('maplibregl-ctrl-bottom-left');
        
        const isRightPanel = el.classList.contains('controls-right') || 
                            el.classList.contains('right-panel') ||
                            el.classList.contains('maplibregl-ctrl-top-right') ||
                            el.classList.contains('maplibregl-ctrl-bottom-right');

        // Appliquer l'animation de glissement
        el.style.transition = 'transform 3s ease-in-out, opacity 2s ease-in-out 3s';
        el.style.opacity = '0';
    
        if (isLeftPanel) {
            el.style.transform = 'translateX(-120%)';
        } else if (isRightPanel) {
            el.style.transform = 'translateX(120%)';
        }
        
        // Transparence après 3 secondes
        el.style.opacity = '0';
    });

    // Étape 2 : après 5 secondes total - complètement disparu
    setTimeout(() => {
        document.querySelectorAll(controlsSelector).forEach(el => {
            el.style.pointerEvents = 'none';
        });
    }, 5000);
}

function showControls() {
    document.querySelectorAll(controlsSelector).forEach(el => {
        el.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        el.style.transform = 'translateX(0)';
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
    });
    resetInactivityTimer();
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => hideControls(), 5000); // 5 s d'inactivité
}

// Dans votre Script.js - fonction pour mettre à jour les couleurs dynamiquement
function updateControlColors(color) {
    // Mettre à jour les curseurs avec la nouvelle couleur
    const traceWidth = document.getElementById('traceWidth');
    const traceOpacity = document.getElementById('traceOpacity');
    const traceColor = document.getElementById('traceColor');
    
    // Convertir la couleur hex en RGB pour les dégradés
    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };
    
    const rgb = hexToRgb(color);
    
    // Mettre à jour les dégradés des curseurs
    traceWidth.style.background = `linear-gradient(to right, 
        rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3), 
        rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)
    )`;
    
    traceOpacity.style.background = `linear-gradient(to right, 
        rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1), 
        rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)
    )`;
    
    // Mettre à jour les thumbs des curseurs
    const style = document.createElement('style');
    style.id = 'dynamic-slider-styles';
    style.textContent = `
        #traceWidth::-webkit-slider-thumb { background: ${color}; }
        #traceWidth::-moz-range-thumb { background: ${color}; }
        #traceOpacity::-webkit-slider-thumb { background: ${color}; }
        #traceOpacity::-moz-range-thumb { background: ${color}; }
    `;
    
    // Supprimer l'ancien style s'il existe
    const oldStyle = document.getElementById('dynamic-slider-styles');
    if (oldStyle) oldStyle.remove();
    
    // Ajouter le nouveau style
    document.head.appendChild(style);
}

// Écouter les changements de couleur
document.getElementById('traceColor').addEventListener('input', function(e) {
    updateControlColors(e.target.value);
});

// Initialiser avec la couleur par défaut
document.addEventListener('DOMContentLoaded', function() {
    updateControlColors('#ff0000'); // Rouge par défaut
});

['mousemove', 'mousedown', 'touchstart', 'click', 'keydown'].forEach(evt => {
    document.addEventListener(evt, showControls, { passive: true });
});

resetInactivityTimer();
