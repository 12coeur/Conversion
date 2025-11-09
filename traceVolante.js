// traceVolante.js - Mode Vol 3D stable et robuste
console.log("traceVolante.js chargé");

class TraceVolante {
    constructor(map, appState) {
        this.map = map;
        this.appState = appState;
        this.volToggle = null;
        this.isUpdating = false;
        this.cleanupTimeout = null;
        this.coordinates = null; // AJOUTÉ : stocke les coordonnées

        this.findToggleAndBind();
        this.startPolling();
        this.setupEventListeners();
    }

    findToggleAndBind() {
        this.volToggle = document.getElementById('volToggle');
        if (this.volToggle) {
            console.log("volToggle trouvé → écouteur attaché");
            this.bindEvents();
            this.checkInitialState();
        } else {
            console.warn("volToggle pas dans le DOM → polling");
        }
    }

    startPolling() {
        const interval = setInterval(() => {
            if (document.getElementById('volToggle')) {
                clearInterval(interval);
                console.log("volToggle détecté via polling");
                this.findToggleAndBind();
            }
        }, 500);
    }

    bindEvents() {
        this.volToggle.addEventListener('change', () => {
            console.log(`Mode vol ${this.volToggle.checked ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
            this.safeUpdateTrace();
        });
    }

    checkInitialState() {
        if (this.volToggle.checked && this.appState.currentCoordinates) {
            console.log("volToggle coché au démarrage → mise à jour");
            this.safeUpdateTrace();
        }
    }

    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            this.findToggleAndBind();
        });
        document.addEventListener('volToggleReplaced', () => {
            this.findToggleAndBind();
        });
    }

    safeUpdateTrace() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }

        if (!this.map || !this.map.isStyleLoaded()) {
            this.map.once('styledata', () => {
                this.isUpdating = false;
                this.updateTrace();
            });
            return;
        }

        this.updateTrace();
        this.isUpdating = false;
    }

    updateTrace() {
        console.log("MISE À JOUR TRACE VOLANTE");

        this.volToggle = document.getElementById('volToggle');
        const isFlightMode = this.volToggle?.checked || false;

        // SYNCHRONISATION DES COORDONNÉES
        this.coordinates = this.appState.currentCoordinates;

        if (!isFlightMode) {
            this.cleanupTimeout = setTimeout(() => {
                this.cleanupVolLayers();
                this.restoreBackgroundOpacity();
                this.restoreTerrain();
            }, 500);
            return;
        }

        this.cleanupVolLayers();

        if (!this.coordinates || this.coordinates.length < 2) {
            console.warn("Pas assez de points pour le mode vol");
            return;
        }

        this.createFlightTrace();
        this.reduceBackgroundOpacity();
        this.disableTerrain();
    }

    cleanupVolLayers() {
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }

        const ids = ['trace-flight-line', 'trace-flight-glow', 'trace-flight-markers', 'trace-flight-topline'];
        ids.forEach(id => {
            try {
                if (this.map.getLayer(id)) this.map.removeLayer(id);
                if (this.map.getSource(id)) this.map.removeSource(id);
            } catch (error) {
                console.warn(`Erreur nettoyage ${id}:`, error);
            }
        });
    }

    disableTerrain() {
        if (this.map.getTerrain()) {
            this.map.setTerrain(null);
            console.log("Terrain désactivé pour mode vol");
        }
    }

    restoreTerrain() {
        const zScaleInput = document.getElementById('zScale');
        const currentZScale = zScaleInput ? parseFloat(zScaleInput.value) : 1.5;

        if (this.map.getSource('dem-playeur') && !this.map.getTerrain()) {
            this.map.setTerrain({
                source: "dem-playeur",
                exaggeration: currentZScale
            });
            console.log(`Terrain restauré avec Z=${currentZScale}`);
        }
    }

    createFlightTrace() {
        console.log("Création trace volante 3D (ruban jaune uniquement)...");

        if (!this.coordinates || this.coordinates.length < 2) {
            console.warn("Pas assez de points pour créer une trace volante");
            return;
        }

        if (!this.map.isStyleLoaded()) {
            setTimeout(() => this.createFlightTrace(), 100);
            return;
        }

        try {
            const topHeightOffset = 5;
            const yellowSegments = [];

            for (let i = 0; i < this.coordinates.length - 1; i++) {
                const c1 = this.coordinates[i];
                const c2 = this.coordinates[i + 1];
                const z1 = (c1[2] || 0) + topHeightOffset;
                const z2 = (c2[2] || 0) + topHeightOffset;

                const width = 0.00002;
                const dx = c2[0] - c1[0];
                const dy = c2[1] - c1[1];
                const len = Math.sqrt(dx * dx + dy * dy);
                const ux = -dy / len * width;
                const uy = dx / len * width;

                const poly = [
                    [c1[0] - ux, c1[1] - uy],
                    [c1[0] + ux, c1[1] + uy],
                    [c2[0] + ux, c2[1] + uy],
                    [c2[0] - ux, c2[1] - uy],
                    [c1[0] - ux, c1[1] - uy]
                ];

                yellowSegments.push({
                    type: "Feature",
                    geometry: { type: "Polygon", coordinates: [poly] },
                    properties: {
                        base: Math.min(z1, z2),
                        top: Math.max(z1, z2) + 0.2
                    }
                });
            }

            const yellowGeoJSON = {
                type: "FeatureCollection",
                features: yellowSegments
            };

            if (!this.map.getSource('trace-flight-topline')) {
                this.map.addSource('trace-flight-topline', { type: 'geojson', data: yellowGeoJSON });
            } else {
                this.map.getSource('trace-flight-topline').setData(yellowGeoJSON);
            }

            if (!this.map.getLayer('trace-flight-topline')) {
                this.map.addLayer({
                    id: 'trace-flight-topline',
                    type: 'fill-extrusion',
                    source: 'trace-flight-topline',
                    paint: {
                        'fill-extrusion-color': '#ffff00',
                        'fill-extrusion-height': ['get', 'top'],
                        'fill-extrusion-base': ['get', 'base'],
                        'fill-extrusion-opacity': 1.0
                    }
                });
            }

            console.log(`Ruban jaune 3D créé (${this.coordinates.length} points)`);

        } catch (error) {
            console.error("Erreur création trace volante:", error);
        }
    }

    /**
     * Met à jour la position du marqueur mobile en 3D (mode vol)
     * @param {maplibregl.Marker} marker
     * @param {number} index
     */
    updateMarkerPosition(marker, index) {
        if (!this.coordinates || index >= this.coordinates.length || !this.map || !marker) return;

        const [lng, lat, alt] = this.coordinates[index];
        const zScale = parseFloat(document.getElementById('zScale')?.value) || 1.5;

        let terrainElevation = 0;
        try {
            terrainElevation = this.map.queryTerrainElevation([lng, lat]) || 0;
        } catch (e) {
            // Terrain désactivé en mode vol → normal
        }

        const totalHeight = terrainElevation + (alt || 0) * zScale;
        const projected = this.map.project([lng, lat]);

        const el = marker.getElement();
        if (el) {
            el.style.transform = `translate(${projected.x}px, ${projected.y - totalHeight}px) translate(-50%, -50%)`;
            el.style.zIndex = '1000';
            el.style.pointerEvents = 'none';
        }
    }

    reduceBackgroundOpacity() {
        setTimeout(() => {
            try {
                const style = this.map.getStyle();
                style?.layers.forEach(layer => {
                    if (layer.type === 'raster' || layer.type === 'background') {
                        this.map.setPaintProperty(layer.id, 'raster-opacity', 0.33);
                        this.map.setPaintProperty(layer.id, 'background-opacity', 0.33);
                    }
                });
                console.log("Opacité fond réduite");
            } catch (error) {
                console.warn("Impossible de réduire l'opacité du fond:", error);
            }
        }, 100);
    }

    restoreBackgroundOpacity() {
        try {
            const style = this.map.getStyle();
            style?.layers.forEach(layer => {
                if (layer.type === 'raster' || layer.type === 'background') {
                    this.map.setPaintProperty(layer.id, 'raster-opacity', 1.0);
                    this.map.setPaintProperty(layer.id, 'background-opacity', 1.0);
                }
            });
            console.log("Opacité fond restaurée");
        } catch (error) {
            console.warn("Impossible de restaurer l'opacité du fond:", error);
        }
    }

    resetFlightMode() {
        console.log("Forçage mode sol");
        if (this.volToggle) {
            this.volToggle.checked = false;
        }
        this.cleanupVolLayers();
        this.restoreBackgroundOpacity();
        this.restoreTerrain();
    }

    refresh() {
        this.safeUpdateTrace();
    }

    destroy() {
        if (this.cleanupTimeout) clearTimeout(this.cleanupTimeout);
        this.cleanupVolLayers();
        this.restoreBackgroundOpacity();
        this.restoreTerrain();

        if (this.volToggle) {
            const newToggle = this.volToggle.cloneNode(true);
            this.volToggle.parentNode.replaceChild(newToggle, this.volToggle);
        }
    }
}

// Export global
window.TraceVolante = TraceVolante;
