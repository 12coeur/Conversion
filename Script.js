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

// Variable globale pour stocker le contenu brut du fichier
let currentRawContent = "";

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

/**
 * Télécharge un fichier avec le contenu fourni
 * @param {string} content - Contenu du fichier
 * @param {string} filename - Nom du fichier de destination
 * @param {string} mimeType - Type MIME du fichier
 */
function downloadFile(content, filename, mimeType) {
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
    setupNavigation();
    initDropzones();
    setupPlayeurControls();
    setupZScaleControl();
    setupExportButtons();  // ← AJOUTEZ CETTE LIGNE
	setupVolToggle();  // ← AJOUTEZ CETTE LIGNE
    showPage('accueil');
    console.log("✅ Application initialisée avec succès");
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
    console.log(`📄 Changement de page: ${pageId}`);
    
    // Gestion de la page export
    if(pageId === 'export') {
        const textarea = document.getElementById('trace-content');
        if(textarea) textarea.value = currentRawContent || "Aucune trace chargée.";
    }
    
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
        AppState.currentPage = pageId;
        
        document.querySelectorAll('.menu-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-page="${pageId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        const menu = document.querySelector('.menu');
        if (menu) {
            menu.classList.remove('active');
        }
        
        handlePageTransition(pageId);
		
        
        console.log(`✅ Page ${pageId} affichée`);
    }
}

    // 
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
                                pitch: 70,
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
        pitch = 70,
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
    const debugDiv = document.querySelector('.debug-info');
    
    function showMessage(msg, color = '#0066cc') {
        if (debugDiv) {
            debugDiv.innerHTML = `<div style="color: ${color};">${msg}</div>`;
        }
    }
    
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
            pitch: 60,
            bearing: 0,
            antialias: true
        });
        
        AppState.mapInitialized = true;
        showMessage("✅ Carte créée - Chargement...", 'green');
        
    } catch (error) {
        showMessage(`❌ Erreur création carte: ${error.message}`, 'red');
        return;
    }
    
    AppState.map.on("load", function() {
        console.log("✅ Carte chargée avec succès");
        showMessage("✅ Carte chargée - Prête !", 'green');
        
        try {
            AppState.map.addSource("dem", {
                type: "raster-dem",
                url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
            });
            
            AppState.map.setTerrain({ source: "dem", exaggeration: 1.5 });
 /*           
            AppState.map.addLayer({
                id: "sky",
                type: "sky",
                paint: {
                    "sky-type": "atmosphere",
                    "sky-atmosphere-sun": [0.0, 90.0],
                    "sky-atmosphere-sun-intensity": 15
                }
            });
  */          
            AppState.map.addControl(new maplibregl.NavigationControl());
            
            showMessage("🎉 Carte 3D initialisée ! Importez un fichier", 'lime');
            
        } catch (error) {
            showMessage(`⚠️ Carte chargée avec erreurs: ${error.message}`, 'orange');
        }
    });
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
            pitch: 75,
            bearing: 0,
            antialias: true
        });
        
        AppState.mapPlayeurInitialized = true;
        
    } catch (error) {
        console.error(`❌ Erreur création carte playeur: ${error.message}`);
        return;
    }
    
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
  /*          
            AppState.mapPlayeur.addLayer({
                id: "sky-playeur",
                type: "sky",
                paint: {
                    "sky-type": "atmosphere",
                    "sky-atmosphere-sun": [0.0, 90.0],
                    "sky-atmosphere-sun-intensity": 15
                }
            });
    */        
            AppState.mapPlayeur.addControl(new maplibregl.NavigationControl());
            
            console.log("✅ Relief 3D ajouté au playeur");
            
        } catch (error) {
            console.error("⚠️ Erreur ajout relief playeur:", error);
        }
        
        if (AppState.currentCoordinates) {
            displayTraceOnPlayeur(AppState.currentCoordinates, AppState.currentFileName, AppState.currentFileType);
        }
    });
}
// -------------------------------------------------------------
function displayTraceOnPlayeur(coordinates, fileName, fileType) {
    if (!AppState.mapPlayeur || !AppState.mapPlayeurInitialized) {
        console.warn("Carte playeur non initialisée");
        return;
    }

    console.log(`📍 Affichage trace playeur: ${fileName} (${coordinates.length} points)`);

    const geoJSON = {
        type: "FeatureCollection",
        features: [{
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: coordinates
            },
            properties: {
                name: fileName
            }
        }]
    };

    // Nettoyage de l'ancienne trace
    if (AppState.mapPlayeur.getSource('trace-playeur')) {
        try {
            AppState.mapPlayeur.removeLayer('trace-playeur');
            AppState.mapPlayeur.removeSource('trace-playeur');
            console.log("🧹 Ancienne trace playeur supprimée");
        } catch (e) {
            console.warn("Erreur nettoyage:", e);
        }
    }

    // Supprimer l'ancien marqueur s'il existe
    if (AppState.startMarker) {
        AppState.startMarker.remove();
    }

    try {
        AppState.mapPlayeur.addSource('trace-playeur', {
            type: 'geojson',
            data: geoJSON
        });

        const colorPicker = document.getElementById('traceColor');
        const currentColor = colorPicker ? colorPicker.value : '#ff0000';

        AppState.mapPlayeur.addLayer({
            id: 'trace-playeur',
            type: 'line',
            source: 'trace-playeur',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': currentColor,
                'line-width': 4,
                'line-opacity': 0.9
            }
        });

        // --- Gestion du mode vol / sol ---
        const volToggle = document.getElementById("volToggle");
        const zScale = parseFloat(document.getElementById("zScale")?.value || 1.5);

        if (volToggle && volToggle.checked) {
            // Mode VOL : relief conservé + altitude réelle + surélévation légère
            try {
                AppState.mapPlayeur.setTerrain({
                    source: "dem-playeur",
                    exaggeration: zScale
                });

                const elevatedCoords = coordinates.map(coord => [
                    coord[0],
                    coord[1],
                    (coord[2] || 0) + 50 // +50 m au-dessus du relief
                ]);

                AppState.mapPlayeur.getSource("trace-playeur").setData({
                    type: "FeatureCollection",
                    features: [{
                        type: "Feature",
                        geometry: { type: "LineString", coordinates: elevatedCoords },
                        properties: { name: fileName }
                    }]
                });

                console.log("✈️ Mode VOL actif : relief conservé, trace surélevée de +50m");
            } catch (error) {
                console.warn("⚠️ Erreur application du mode VOL :", error);
            }

        } else {
            // Mode SOL : plaquée sur le relief
            try {
                AppState.mapPlayeur.setTerrain({
                    source: "dem-playeur",
                    exaggeration: zScale
                });
                console.log("🚶 Mode SOL actif : trace plaquée sur le relief");
            } catch (error) {
                console.warn("Erreur lors de la réactivation du terrain DEM :", error);
            }
        }

        // --- Actualisation immédiate du volToggle ---
        if (volToggle) {
            volToggle.addEventListener("change", () => {
                if (AppState.currentCoordinates) {
                    refreshPlayeurTrace();
                }
            });
        }

        // ===== AJOUT DU MARQUEUR DE DÉPART =====
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

            console.log(`✅ Marqueur de départ ajouté: ${mobileIcon} à (${startCoord[1]}, ${startCoord[0]})`);
        }

        // ===== AJOUT DE L'ANIMATION =====
        const animationCoordinates = coordinates.map(coord => ({
            lng: coord[0],
            lat: coord[1],
            alt: coord[2] || 0
        }));

        initSimpleAnimation(AppState.mapPlayeur, animationCoordinates);
        console.log(`🎬 Animation initialisée avec ${animationCoordinates.length} points`);

        // Ajustement de la vue
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend([coord[0], coord[1]]));
        if (!bounds.isEmpty()) {
            animatedFitBounds(AppState.mapPlayeur, bounds, {
                padding: 80,
                pitch: 75,
                bearing: 0,
                maxZoom: 13,
                duration: 2000,
                rotationDuration: 4000
            });
        }

        console.log(`✅ Trace affichée sur playeur: ${coordinates.length} points`);
    } catch (error) {
        console.error("❌ Erreur affichage trace playeur:", error);
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

function fallbackFitProcessing(arrayBuffer, file, ext) {
    console.log("Utilisation de la méthode corrigée pour FIT");
    showMessage("🔄 Analyse corrigée du fichier FIT...", 'orange');
    
    try {
        const dataView = new DataView(arrayBuffer);
        let coordinates = [];
        
        // CORRECTION : Bonne conversion semicircles -> degrees
        function semicirclesToDegrees(semicircles) {
            // Formule officielle Garmin
            return semicircles * (180 / 2147483648); // 2^31
        }
        
        // Analyser l'en-tête FIT
        const headerSize = dataView.getUint8(0);
        console.log(`📋 Header size: ${headerSize}`);
        
        let position = headerSize;
        let recordCount = 0;
        
        // Parcourir le fichier à la recherche des records
        while (position < arrayBuffer.byteLength - 12) {
            try {
                // Essayer d'extraire des paires lat/lon
                const lat = dataView.getInt32(position, true);
                const lon = dataView.getInt32(position + 4, true);
                
                // Appliquer la conversion CORRIGÉE
                const latDeg = semicirclesToDegrees(lat);
                const lonDeg = semicirclesToDegrees(lon);
                
                // Validation PLUS STRICTE
                if (isValidFitCoordinate(latDeg, lonDeg)) {
                    const alt = tryGetAltitude(dataView, position + 8);
                    coordinates.push([lonDeg, latDeg, alt]);
                    recordCount++;
                    
                    // Avancer de la taille d'un record typique
                    position += 20;
                } else {
                    position += 1;
                }
                
                // Limiter le nombre de points pour éviter la surcharge
                if (recordCount > 1000) break;
                
            } catch (e) {
                position += 1;
            }
        }
        
        console.log(`📍 ${coordinates.length} points bruts trouvés`);
        
        if (coordinates.length > 0) {
            // CORRECTION : Meilleur filtrage géographique
            const filteredCoords = filterAndSortCoordinates(coordinates);
            
            if (filteredCoords.length > 10) {
                const geoJSON = {
                    type: "FeatureCollection",
                    features: [{
                        type: "Feature",
                        geometry: { type: "LineString", coordinates: filteredCoords },
                        properties: { name: file.name }
                    }]
                };
                
                showMessage(`✅ FIT chargé: ${filteredCoords.length} points (France)`, 'green');
                finalizeTraceProcessing(geoJSON, filteredCoords, file, ext);
            } else {
                // Essayer une autre méthode de conversion
                const alternativeCoords = tryAlternativeConversion(arrayBuffer);
                if (alternativeCoords.length > 10) {
                    const geoJSON = {
                        type: "FeatureCollection",
                        features: [{
                            type: "Feature", 
                            geometry: { type: "LineString", coordinates: alternativeCoords },
                            properties: { name: file.name }
                        }]
                    };
                    showMessage(`✅ FIT chargé (méthode alt.): ${alternativeCoords.length} points`, 'green');
                    finalizeTraceProcessing(geoJSON, alternativeCoords, file, ext);
                } else {
                    showMessage("❌ Trace trop courte ou hors zone", 'red');
                    debugCoordinates(coordinates); // Pour debug
                }
            }
        } else {
            showMessage("❌ Aucune coordonnée valide trouvée", 'red');
        }
        
    } catch (error) {
        console.error("Erreur méthode FIT:", error);
        showMessage("❌ Erreur traitement FIT", 'red');
    }
}

// CORRECTION : Validation spécifique France/Europe
function isValidFitCoordinate(lat, lon) {
    // Coordonnées plausibles pour la France/Europe
    const isInFrance = lat >= 41.0 && lat <= 51.5 && lon >= -5.0 && lon <= 9.5;
    
    return !isNaN(lat) && !isNaN(lon) && 
           Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
           lat !== 0 && lon !== 0 &&
           isInFrance; // FILTRE FRANCE SEULEMENT
}

function tryAlternativeConversion(arrayBuffer) {
    console.log("🔄 Essai méthode alternative de conversion...");
    const dataView = new DataView(arrayBuffer);
    const coordinates = [];
    
    // Essayer avec un facteur de conversion différent
    function alternativeConversion(semicircles) {
        return semicircles * (180 / 2147483648); // Même formule mais essayons d'autres approches
    }
    
    // Essayer en big endian
    for (let i = 0; i < arrayBuffer.byteLength - 8; i += 4) {
        try {
            const lat = dataView.getInt32(i, false); // Big endian
            const lon = dataView.getInt32(i + 4, false);
            
            const latDeg = alternativeConversion(lat);
            const lonDeg = alternativeConversion(lon);
            
            if (isValidFitCoordinate(latDeg, lonDeg)) {
                coordinates.push([lonDeg, latDeg, 0]);
            }
        } catch (e) {
            // Continuer
        }
    }
    
    return coordinates;
}

// CORRECTION : Filtrage et tri intelligent
function filterAndSortCoordinates(coordinates) {
    if (coordinates.length === 0) return [];
    
    // Calculer le centre de masse
    const avgLon = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
    const avgLat = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
    
    console.log(`🎯 Centre approximatif: ${avgLat.toFixed(4)}, ${avgLon.toFixed(4)}`);
    
    // Filtrer les points proches du centre
    const filtered = coordinates.filter(coord => {
        const distLon = Math.abs(coord[0] - avgLon);
        const distLat = Math.abs(coord[1] - avgLat);
        return distLon < 2.0 && distLat < 2.0; // Dans un rayon de 2 degrés
    });
    
    // Trier par timestamp implicite (ordre dans le fichier)
    console.log(`📊 Après filtrage: ${filtered.length} points`);
    
    return filtered;
}

function tryGetAltitude(dataView, position) {
    try {
        // Essayer différents formats d'altitude
        const alt1 = dataView.getUint16(position, true);
        const alt2 = dataView.getInt16(position, true);
        
        if (alt1 > 0 && alt1 < 5000) return alt1;
        if (alt2 > 0 && alt2 < 5000) return alt2;
        
        return 0;
    } catch (e) {
        return 0;
    }
}

// Fonction de debug
function debugCoordinates(coordinates) {
    console.log("🐛 Debug des coordonnées extraites:");
    coordinates.slice(0, 10).forEach((coord, i) => {
        console.log(`Point ${i}: ${coord[1].toFixed(6)}, ${coord[0].toFixed(6)}`);
    });
    
    // Statistiques
    const lats = coordinates.map(c => c[1]);
    const lons = coordinates.map(c => c[0]);
    console.log(`📈 Latitudes: ${Math.min(...lats).toFixed(2)} à ${Math.max(...lats).toFixed(2)}`);
    console.log(`📈 Longitudes: ${Math.min(...lons).toFixed(2)} à ${Math.max(...lons).toFixed(2)}`);
}
function isValidCoordinate(lat, lon) {
    return !isNaN(lat) && !isNaN(lon) && 
           Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
           lat !== 0 && lon !== 0; // Exclure les coordonnées nulles
}

function advancedFitSearch(arrayBuffer) {
    console.log("🔍 Recherche avancée dans le fichier FIT...");
    const dataView = new DataView(arrayBuffer);
    const coordinates = [];
    const foundPoints = new Set(); // Pour éviter les doublons
    
    // Chercher des patterns de coordonnées plausibles
    for (let i = 0; i < arrayBuffer.byteLength - 8; i += 4) {
        try {
            // Essayer différentes interprétations des données
            const lat1 = dataView.getInt32(i, true);
            const lon1 = dataView.getInt32(i + 4, true);
            
            const latDeg1 = lat1 * (180 / Math.pow(2, 31));
            const lonDeg1 = lon1 * (180 / Math.pow(2, 31));
            
            if (isValidCoordinate(latDeg1, lonDeg1)) {
                const key = `${latDeg1.toFixed(6)},${lonDeg1.toFixed(6)}`;
                if (!foundPoints.has(key)) {
                    foundPoints.add(key);
                    coordinates.push([lonDeg1, latDeg1, 0]);
                }
            }
            
            // Essayer en big endian aussi
            const lat2 = dataView.getInt32(i, false);
            const lon2 = dataView.getInt32(i + 4, false);
            
            const latDeg2 = lat2 * (180 / Math.pow(2, 31));
            const lonDeg2 = lon2 * (180 / Math.pow(2, 31));
            
            if (isValidCoordinate(latDeg2, lonDeg2)) {
                const key = `${latDeg2.toFixed(6)},${lonDeg2.toFixed(6)}`;
                if (!foundPoints.has(key)) {
                    foundPoints.add(key);
                    coordinates.push([lonDeg2, latDeg2, 0]);
                }
            }
            
        } catch (e) {
            // Continuer en cas d'erreur
        }
    }
    
    return coordinates;
}

function filterValidTrack(coordinates) {
    if (coordinates.length === 0) return [];
    
    // Trier par longitude pour avoir un ordre cohérent
    coordinates.sort((a, b) => a[0] - b[0]);
    
    // Regrouper les points qui sont géographiquement proches
    const clusters = [];
    let currentCluster = [coordinates[0]];
    
    for (let i = 1; i < coordinates.length; i++) {
        const lastPoint = currentCluster[currentCluster.length - 1];
        const currentPoint = coordinates[i];
        
        // Calculer la distance approximative
        const latDiff = Math.abs(lastPoint[1] - currentPoint[1]);
        const lonDiff = Math.abs(lastPoint[0] - currentPoint[0]);
        const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
        
        if (distance < 1.0) { // Points à moins de 1 degré
            currentCluster.push(currentPoint);
        } else {
            if (currentCluster.length > 5) { // Cluster valide s'il a au moins 5 points
                clusters.push(currentCluster);
            }
            currentCluster = [currentPoint];
        }
    }
    
    // Prendre le plus grand cluster
    if (clusters.length > 0) {
        clusters.sort((a, b) => b.length - a.length);
        console.log(`📊 Meilleure trace: ${clusters[0].length} points`);
        return clusters[0];
    }
    
    // Sinon retourner les coordonnées originales
    return coordinates;
}
function processFitData(data, file, ext) {
    console.log("Traitement des données FIT...");
    let coordinates = [];
    
    // Fonction de conversion
    function semicirclesToDegrees(semicircles) {
        return semicircles * (180 / Math.pow(2, 31));
    }
    
    // Extraction depuis records
    if (data.records && data.records.length > 0) {
        data.records.forEach(record => {
            if (record.position_lat !== undefined && record.position_long !== undefined) {
                const lat = semicirclesToDegrees(record.position_lat);
                const lon = semicirclesToDegrees(record.position_long);
                const alt = record.altitude || record.enhanced_altitude || 0;
                
                if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                    coordinates.push([lon, lat, alt]);
                }
            }
        });
    }
    
    if (coordinates.length === 0) {
        showMessage("❌ Aucune coordonnée trouvée dans le fichier FIT", 'red');
        return;
    }
    
    const geoJSON = {
        type: "FeatureCollection",
        features: [{
            type: "Feature", 
            geometry: { type: "LineString", coordinates },
            properties: { name: file.name }
        }]
    };
    
    finalizeTraceProcessing(geoJSON, coordinates, file, ext);
}
    
    function showMessage(msg, color = 'black') {
        console.log(msg);
        if (debugDiv) {
            debugDiv.innerHTML = `<div style="color: ${color};">${msg}</div>`;
        }
    }
    
    showMessage(`Traitement de ${file.name}...`, '#0066cc');
    
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
                    if (parsed) {
                        coordinates.push([parsed.longitude, parsed.latitude, parsed.altitude]);
                    }
                });
                
                if (coordinates.length === 0) {
                    throw new Error("Aucun point valide trouvé dans le fichier IGC");
                }
                
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
    showMessage("⏳ Analyse du fichier FIT en cours (méthode alternative)...", '#0066cc');
    
    // Méthode alternative sans dépendance externe
    if (event.target.result instanceof ArrayBuffer) {
        try {
            // Essayer d'utiliser la bibliothèque si disponible
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
            console.error("Erreur avec FIT parser:", error);
            fallbackFitProcessing(event.target.result, file, ext);
        }
    } else {
        showMessage("❌ Format de fichier FIT non supporté", 'red');
    }
    return;
} else {
                throw new Error(`Format ${ext} non supporté. Utilisez GPX, KML, IGC, TCX ou FIT.`);
            }

            // Pour tous les formats SAUF FIT (qui est asynchrone)
            if (ext !== 'igc' && ext !== 'fit' && ext !== 'tcx') {
                coordinates = extractCoordinatesFromGeoJSON(geoJSON);
                if (coordinates.length === 0) {
                    throw new Error("Aucune coordonnée valide trouvée dans le fichier");
                }
            }

            console.log("GeoJSON généré:", geoJSON);
            console.log(`Coordonnées extraites: ${coordinates.length} points`);

            finalizeTraceProcessing(geoJSON, coordinates, file, ext);

        } catch (error) {
            console.error("❌ Erreur traitement fichier:", error);
            showMessage(`❌ Erreur lors du traitement de ${file.name}: ${error.message}`, 'red');
        }
    };

    reader.onerror = function() {
        showMessage(`❌ Erreur de lecture du fichier ${file.name}`, 'red');
    };

    // Lecture selon le type de fichier
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
                pitch: 70,
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

function showMessage(msg, color = 'black') {
    console.log(msg);
    const debugDiv = document.querySelector('.debug-info');
    if (debugDiv) {
        debugDiv.innerHTML = `<div style="color: ${color};">${msg}</div>`;
    }
}

// ===============================
// NETTOYAGE
// ===============================
function clearTraces() {
    console.log("🧹 Nettoyage des traces...");
    
    // Supprimer le marqueur de départ
    if (AppState.startMarker) {
        AppState.startMarker.remove();
        AppState.startMarker = null;
    }
    
    if (AppState.map && AppState.map.getSource) {
        try {
            if (AppState.map.getSource('trace')) {
                AppState.map.removeLayer('trace-layer');
                AppState.map.removeSource('trace');
            }
        } catch (e) {
            console.warn("Erreur nettoyage:", e);
        }
    }
    
    if (AppState.mapPlayeur && AppState.mapPlayeur.getSource) {
        try {
            if (AppState.mapPlayeur.getSource('trace-playeur')) {
                AppState.mapPlayeur.removeLayer('trace-playeur');
                AppState.mapPlayeur.removeSource('trace-playeur');
            }
        } catch (e) {
            console.warn("Erreur nettoyage playeur:", e);
        }
    }
    
    AppState.currentTrace = null;
    AppState.currentCoordinates = null;
    AppState.currentFileName = null;
    AppState.currentFileType = null;
    currentRawContent = "";
    
    const debugDiv = document.querySelector('.debug-info');
    if (debugDiv) {
        debugDiv.innerHTML = "✅ Système nettoyé - Prêt pour un nouveau chargement...";
    }
}// ===============================
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
   /*   skyLayerId = "sky",*/
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

          // 3️⃣ AJOUTER LA COUCHE SKY
    /*      if (!map.getLayer(skyLayerId)) {
            map.addLayer({
              id: skyLayerId,
              type: "sky",
              paint: {
                "sky-type": "atmosphere",
                "sky-atmosphere-sun": [0.0, 90.0],
                "sky-atmosphere-sun-intensity": 15
              }
            });
          }
  */
          // 4️⃣ RÉAFFICHER LA TRACE SI ELLE EXISTE
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
    /*  skyLayerId: "sky",*/
      isPlayeur: false
    });
  }

  if (AppState.mapPlayeur) {
    applyToMap(AppState.mapPlayeur, {
      traceSourceId: "trace-playeur",
      traceLayerId: "trace-playeur",
      demSourceId: "dem-playeur",
   /*   skyLayerId: "sky-playeur", */
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
    
    // === NOUVELLES PROPRIÉTES POUR AVANCE RAPIDE ===
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

stopFastForward() {
    this.isFastForward = false;
    this.fastForwardFactor = 1;
    
    // Restaurer l'apparence du bouton
    const buttons = document.querySelectorAll('.ctrl-btn');
    if (buttons[2]) {
        buttons[2].innerHTML = '⏭️';
        buttons[2].style.backgroundColor = '';
    }
    
    this.pause();
    
    // Si on était en lecture avant l'avance rapide, reprendre la lecture normale
    if (this.wasPlaying) {
        setTimeout(() => {
            this.play();
        }, 100);
    }
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

  document.querySelectorAll(controlsSelector).forEach(el => {
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
  });
}

function showControls() {
  document.querySelectorAll(controlsSelector).forEach(el => {
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
  });
  resetInactivityTimer();
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => hideControls(), 5000); // 5 s d'inactivité
}

['mousemove', 'mousedown', 'touchstart', 'click', 'keydown'].forEach(evt => {
  document.addEventListener(evt, showControls, { passive: true });
});

resetInactivityTimer();
