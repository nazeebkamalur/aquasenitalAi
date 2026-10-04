(function () {
    "use strict";

    /*
     * =========================================================
     * AQUASENTINEL AI
     * INDIA-WIDE FLOOD RISK MAP
     * =========================================================
     *
     * Features:
     * 1. India-wide default map
     * 2. Click anywhere on the map
     * 3. Get latitude and longitude
     * 4. Reverse geocode coordinates
     * 5. Display city / state / country
     * 6. Send real region name to admin.js
     * 7. Display selected location marker
     * 8. Display flood-risk zones
     * 9. Keep existing AquaSentinel events
     * 10. Compatible with dashboard.css / map.css
     * =========================================================
     */

    const API_URL = "http://127.0.0.1:8000";

    let aquaMap = null;
    let selectedMarker = null;
    let floodRiskZone = null;

    let selectedLocation = {
        latitude: null,
        longitude: null,
        region: null,
        city: null,
        state: null,
        country: null
    };


    /* =========================================================
       ADD MAP CSS
       ========================================================= */

    function addMapCSS() {

        if (
            document.getElementById(
                "aquasentinel-map-css"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "aquasentinel-map-css";

        style.textContent = `

            #adminMap {
                width: 100% !important;
                height: 520px !important;
                min-height: 520px !important;
                position: relative !important;
                overflow: hidden !important;
                z-index: 1;
            }

            #adminMap .leaflet-container {
                width: 100%;
                height: 100%;
                font-family: Arial, sans-serif;
            }

            #adminMap .leaflet-tile {
                max-width: none !important;
                max-height: none !important;
            }

            #adminMap img.leaflet-tile {
                max-width: none !important;
            }

            #adminMap img {
                max-width: none;
            }

            .aqua-location-marker {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #8b5cf6;
                border: 4px solid #ffffff;
                box-shadow:
                    0 0 0 5px rgba(139, 92, 246, 0.25),
                    0 4px 12px rgba(15, 23, 42, 0.25);
            }

            .aqua-location-marker-wrapper {
                background: transparent;
                border: none;
            }

            .aqua-flood-zone {
                border-radius: 50%;
                pointer-events: none;
            }

            .aqua-flood-zone.minimal {
                background: rgba(34, 197, 94, 0.20);
                border: 2px solid rgba(34, 197, 94, 0.70);
            }

            .aqua-flood-zone.low {
                background: rgba(132, 204, 22, 0.22);
                border: 2px solid rgba(132, 204, 22, 0.70);
            }

            .aqua-flood-zone.moderate {
                background: rgba(234, 179, 8, 0.24);
                border: 2px solid rgba(234, 179, 8, 0.75);
            }

            .aqua-flood-zone.high {
                background: rgba(249, 115, 22, 0.27);
                border: 2px solid rgba(249, 115, 22, 0.78);
            }

            .aqua-flood-zone.critical {
                background: rgba(239, 68, 68, 0.30);
                border: 2px solid rgba(239, 68, 68, 0.82);
            }

            .aqua-map-popup {
                font-family: Arial, sans-serif;
                min-width: 190px;
            }

            .aqua-map-popup-title {
                font-size: 15px;
                font-weight: 800;
                color: #1e293b;
                margin-bottom: 8px;
            }

            .aqua-map-popup-row {
                font-size: 12px;
                color: #64748b;
                margin: 4px 0;
            }

            .aqua-map-popup-row strong {
                color: #334155;
            }

            @media (max-width: 650px) {

                #adminMap {
                    height: 430px !important;
                    min-height: 430px !important;
                }

            }

        `;

        document.head.appendChild(style);
    }


    /* =========================================================
       HTML ESCAPE
       ========================================================= */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================================================
       REVERSE GEOCODING
       LATITUDE + LONGITUDE → REGION NAME
       ========================================================= */

    async function getRegionName(
        latitude,
        longitude
    ) {

        try {

            const url =
                "https://nominatim.openstreetmap.org/reverse" +
                `?format=jsonv2` +
                `&lat=${encodeURIComponent(latitude)}` +
                `&lon=${encodeURIComponent(longitude)}` +
                `&zoom=10` +
                `&addressdetails=1`;

            const response =
                await fetch(
                    url,
                    {
                        method: "GET",
                        headers: {
                            "Accept":
                                "application/json",
                            "Accept-Language":
                                "en"
                        }
                    }
                );

            if (!response.ok) {

                throw new Error(
                    `Reverse geocoding failed: ${response.status}`
                );
            }

            const data =
                await response.json();

            const address =
                data.address || {};

            const city =
                address.city ||
                address.town ||
                address.village ||
                address.municipality ||
                address.suburb ||
                address.county ||
                "";

            const state =
                address.state || "";

            const country =
                address.country ||
                "India";

            /*
             * Create human-readable region name.
             */

            let region = "";

            if (
                city &&
                state &&
                country
            ) {

                region =
                    `${city}, ${state}, ${country}`;

            } else if (
                city &&
                state
            ) {

                region =
                    `${city}, ${state}`;

            } else if (state) {

                region =
                    `${state}, ${country}`;

            } else if (city) {

                region =
                    `${city}, ${country}`;

            } else {

                region =
                    country;
            }

            return {

                region: region,

                city: city,

                state: state,

                country: country,

                latitude: latitude,

                longitude: longitude
            };

        } catch (error) {

            console.error(
                "AquaSentinel reverse geocoding error:",
                error
            );

            return {

                region:
                    "Location unavailable",

                city: "",

                state: "",

                country: "India",

                latitude: latitude,

                longitude: longitude
            };
        }
    }


    /* =========================================================
       CREATE SELECTED LOCATION MARKER
       ========================================================= */

    function createSelectedMarker(
        latitude,
        longitude
    ) {

        const icon =
            L.divIcon({

                className:
                    "aqua-location-marker-wrapper",

                html:
                    `<div class="aqua-location-marker"></div>`,

                iconSize: [
                    20,
                    20
                ],

                iconAnchor: [
                    10,
                    10
                ],

                popupAnchor: [
                    0,
                    -10
                ]
            });

        return L.marker(
            [
                latitude,
                longitude
            ],
            {
                icon: icon
            }
        );
    }


    /* =========================================================
       UPDATE LOCATION UI
       ========================================================= */

    function updateLocationUI(
        latitude,
        longitude,
        region
    ) {

        const latitudeElement =
            document.getElementById(
                "mapLatitude"
            );

        const longitudeElement =
            document.getElementById(
                "mapLongitude"
            );

        const regionElement =
            document.getElementById(
                "mapRegion"
            );

        const selectedCard =
            document.getElementById(
                "mapSelectedLocation"
            );

        if (latitudeElement) {

            latitudeElement.textContent =
                Number(latitude).toFixed(6);
        }

        if (longitudeElement) {

            longitudeElement.textContent =
                Number(longitude).toFixed(6);
        }

        if (regionElement) {

            regionElement.textContent =
                region;
        }

        if (selectedCard) {

            selectedCard.classList.add(
                "active"
            );
        }


        /*
         * Dynamic prediction fields
         */

        const latitudeInput =
            document.getElementById(
                "dynamicLatitude"
            );

        const longitudeInput =
            document.getElementById(
                "dynamicLongitude"
            );

        const regionInput =
            document.getElementById(
                "dynamicRegion"
            );

        if (latitudeInput) {

            latitudeInput.value =
                Number(latitude).toFixed(6);
        }

        if (longitudeInput) {

            longitudeInput.value =
                Number(longitude).toFixed(6);
        }

        if (regionInput) {

            regionInput.value =
                region;
        }


        /*
         * Prediction message
         */

        const message =
            document.getElementById(
                "predictionMessage"
            );

        if (message) {

            message.textContent =
                `📍 ${region} — ` +
                `${Number(latitude).toFixed(6)}, ` +
                `${Number(longitude).toFixed(6)}`;

            message.classList.add(
                "active"
            );
        }
    }


    /* =========================================================
       HANDLE MAP LOCATION SELECTION
       ========================================================= */

    async function handleMapClick(
        event
    ) {

        const latitude =
            Number(
                event.latlng.lat.toFixed(6)
            );

        const longitude =
            Number(
                event.latlng.lng.toFixed(6)
            );

        console.log(
            "AquaSentinel selected coordinates:",
            latitude,
            longitude
        );


        /*
         * Remove old marker
         */

        if (selectedMarker) {

            aquaMap.removeLayer(
                selectedMarker
            );

            selectedMarker = null;
        }


        /*
         * Remove previous risk zone
         */

        if (floodRiskZone) {

            aquaMap.removeLayer(
                floodRiskZone
            );

            floodRiskZone = null;
        }


        /*
         * Create temporary marker
         */

        selectedMarker =
            createSelectedMarker(
                latitude,
                longitude
            );

        selectedMarker
            .addTo(aquaMap);


        /*
         * Temporary popup
         */

        selectedMarker
            .bindPopup(
                `
                <div class="aqua-map-popup">

                    <div class="aqua-map-popup-title">
                        📍 Finding location...
                    </div>

                    <div class="aqua-map-popup-row">
                        <strong>Latitude:</strong>
                        ${latitude.toFixed(6)}
                    </div>

                    <div class="aqua-map-popup-row">
                        <strong>Longitude:</strong>
                        ${longitude.toFixed(6)}
                    </div>

                </div>
                `
            )
            .openPopup();


        /*
         * Update UI immediately
         */

        updateLocationUI(
            latitude,
            longitude,
            "Finding location..."
        );


        /*
         * Reverse geocode
         */

        const location =
            await getRegionName(
                latitude,
                longitude
            );


        console.log(
            "AquaSentinel resolved region:",
            location
        );


        /*
         * Save selected location
         */

        selectedLocation = {

            latitude:
                latitude,

            longitude:
                longitude,

            region:
                location.region,

            city:
                location.city,

            state:
                location.state,

            country:
                location.country
        };


        /*
         * Update popup
         */

        if (selectedMarker) {

            selectedMarker
                .bindPopup(
                    `
                    <div class="aqua-map-popup">

                        <div class="aqua-map-popup-title">
                            📍 ${escapeHTML(
                                location.region
                            )}
                        </div>

                        <div class="aqua-map-popup-row">
                            <strong>Latitude:</strong>
                            ${latitude.toFixed(6)}
                        </div>

                        <div class="aqua-map-popup-row">
                            <strong>Longitude:</strong>
                            ${longitude.toFixed(6)}
                        </div>

                    </div>
                    `
                )
                .openPopup();
        }


        /*
         * Update dashboard
         */

        updateLocationUI(
            latitude,
            longitude,
            location.region
        );


        /*
         * Save to localStorage
         */

        localStorage.setItem(
            "aqua_selected_location",
            JSON.stringify(
                selectedLocation
            )
        );


        /*
         * Notify admin.js
         */

        document.dispatchEvent(
            new CustomEvent(
                "aqua-location-selected",
                {
                    detail: {

                        latitude:
                            latitude,

                        longitude:
                            longitude,

                        region:
                            location.region,

                        city:
                            location.city,

                        state:
                            location.state,

                        country:
                            location.country
                    }
                }
            )
        );


        console.log(
            "AquaSentinel location event dispatched:",
            selectedLocation
        );
    }


    /* =========================================================
       INITIALIZE MAP
       ========================================================= */

    function initializeAquaMap() {

        addMapCSS();


        const mapElement =
            document.getElementById(
                "adminMap"
            );

        if (!mapElement) {

            console.error(
                "AquaSentinel: adminMap element not found."
            );

            return;
        }


        if (
            typeof L === "undefined"
        ) {

            console.error(
                "AquaSentinel: Leaflet is not loaded."
            );

            return;
        }


        /*
         * Prevent duplicate initialization
         */

        if (aquaMap) {

            setTimeout(
                function () {

                    aquaMap.invalidateSize(
                        true
                    );

                },
                200
            );

            return;
        }


        /*
         * INDIA-WIDE MAP
         */

        aquaMap =
            L.map(
                "adminMap",
                {
                    center: [
                        22.5,
                        79.0
                    ],

                    zoom: 5,

                    zoomControl: true,

                    minZoom: 4,

                    maxZoom: 18
                }
            );


        /*
         * OpenStreetMap base layer
         */

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,

                attribution:
                    "&copy; OpenStreetMap contributors"
            }
        ).addTo(
            aquaMap
        );


        /*
         * Map click
         */

        aquaMap.on(
            "click",
            handleMapClick
        );


        /*
         * Resize fixes
         */

        setTimeout(
            function () {

                aquaMap.invalidateSize(
                    true
                );

            },
            100
        );

        setTimeout(
            function () {

                aquaMap.invalidateSize(
                    true
                );

            },
            500
        );

        setTimeout(
            function () {

                aquaMap.invalidateSize(
                    true
                );

            },
            1000
        );


        console.log(
            "AquaSentinel India-wide flood risk map initialized."
        );
    }


    /* =========================================================
       SHOW FLOOD RISK ZONE
       ========================================================= */

    function showFloodRiskZone(
        latitude,
        longitude,
        riskLevel,
        inundationArea
    ) {

        if (!aquaMap) {

            console.warn(
                "AquaSentinel map is not initialized."
            );

            return;
        }


        /*
         * Remove previous zone
         */

        if (floodRiskZone) {

            aquaMap.removeLayer(
                floodRiskZone
            );

            floodRiskZone = null;
        }


        const risk =
            String(
                riskLevel || "MINIMAL"
            ).toLowerCase();


        /*
         * Convert km² to approximate
         * circular radius.
         *
         * radius =
         * sqrt(area / pi)
         */

        const area =
            Math.max(
                Number(
                    inundationArea || 0.1
                ),
                0.1
            );

        const radiusKm =
            Math.sqrt(
                area / Math.PI
            );

        const radiusMeters =
            radiusKm * 1000;


        /*
         * Keep visual radius reasonable
         */

        const visualRadius =
            Math.max(
                500,
                Math.min(
                    radiusMeters,
                    15000
                )
            );


        floodRiskZone =
            L.circle(
                [
                    latitude,
                    longitude
                ],
                {
                    radius:
                        visualRadius,

                    className:
                        `aqua-flood-zone ${risk}`,

                    color:
                        getRiskColor(
                            risk
                        ),

                    fillColor:
                        getRiskColor(
                            risk
                        ),

                    fillOpacity:
                        getRiskOpacity(
                            risk
                        ),

                    weight: 3
                }
            );


        floodRiskZone.addTo(
            aquaMap
        );


        /*
         * Bring selected marker above zone
         */

        if (selectedMarker) {

            selectedMarker
                .bringToFront();
        }


        console.log(
            "AquaSentinel flood-risk zone displayed:",
            {
                latitude,
                longitude,
                riskLevel,
                inundationArea
            }
        );
    }


    /* =========================================================
       RISK COLORS
       ========================================================= */

    function getRiskColor(
        risk
    ) {

        switch (
            String(
                risk || ""
            ).toLowerCase()
        ) {

            case "critical":
                return "#ef4444";

            case "high":
                return "#f97316";

            case "moderate":
                return "#eab308";

            case "low":
                return "#84cc16";

            case "minimal":
            default:
                return "#22c55e";
        }
    }


    function getRiskOpacity(
        risk
    ) {

        switch (
            String(
                risk || ""
            ).toLowerCase()
        ) {

            case "critical":
                return 0.32;

            case "high":
                return 0.29;

            case "moderate":
                return 0.25;

            case "low":
                return 0.22;

            case "minimal":
            default:
                return 0.20;
        }
    }


    /* =========================================================
       CLEAR FLOOD RISK ZONE
       ========================================================= */

    function clearFloodRiskZone() {

        if (
            aquaMap &&
            floodRiskZone
        ) {

            aquaMap.removeLayer(
                floodRiskZone
            );

            floodRiskZone = null;
        }
    }


    /* =========================================================
       OPEN MAP
       ========================================================= */

    function openAquaMap() {

        const section =
            document.getElementById(
                "gisSection"
            );

        if (section) {

            section.scrollIntoView(
                {
                    behavior: "smooth",
                    block: "start"
                }
            );
        }


        setTimeout(
            function () {

                if (aquaMap) {

                    aquaMap.invalidateSize(
                        true
                    );
                }

            },
            500
        );
    }


    /* =========================================================
       REFRESH MAP
       ========================================================= */

    function refreshAquaMap() {

        if (aquaMap) {

            aquaMap.invalidateSize(
                true
            );
        }
    }


    /* =========================================================
       GET SELECTED LOCATION
       ========================================================= */

    function getSelectedLocation() {

        return {
            ...selectedLocation
        };
    }


    /* =========================================================
       EXPOSE PUBLIC FUNCTIONS
       ========================================================= */

    window.initializeAquaMap =
        initializeAquaMap;

    window.openAquaMap =
        openAquaMap;

    window.refreshAquaMap =
        refreshAquaMap;

    window.showFloodRiskZone =
        showFloodRiskZone;

    window.clearFloodRiskZone =
        clearFloodRiskZone;

    window.getSelectedAquaLocation =
        getSelectedLocation;


    /* =========================================================
       START
       ========================================================= */

    function start() {

        if (
            typeof L === "undefined"
        ) {

            console.error(
                "AquaSentinel: Leaflet is unavailable."
            );

            return;
        }

        initializeAquaMap();
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start
        );

    } else {

        start();
    }

})();