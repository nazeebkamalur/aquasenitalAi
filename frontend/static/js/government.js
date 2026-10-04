(function () {

    "use strict";

    /* =========================================================
       AQUASENTINEL AI
       GOVERNMENT FLOOD EARLY WARNING PORTAL
       ========================================================= */

    const API_URL = "http://127.0.0.1:8000";

    let latestPredictionId = null;

    /* =========================================================
       GOVERNMENT LEAFLET MAP VARIABLES
       ========================================================= */

    let governmentRiskMap = null;
    let governmentMapMarker = null;
    let governmentFloodCircle = null;


    /* =========================================================
       NAVIGATION
       ========================================================= */

    function navigateGovernment(sectionId, button) {

        const section =
            document.getElementById(sectionId);

        if (!section) {
            return;
        }

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        document
            .querySelectorAll(
                ".government-sidebar .nav-item"
            )
            .forEach(function (item) {

                item.classList.remove("active");

            });

        if (button) {
            button.classList.add("active");
        }
    }


    /* =========================================================
       LOAD GOVERNMENT DASHBOARD
       ========================================================= */

    async function loadGovernmentDashboard() {

        const token =
            localStorage.getItem("access_token");

        const storedUser =
            localStorage.getItem("user");

        if (!token) {

            window.location.href =
                "/templates/login.html";

            return;
        }


        if (storedUser) {

            try {

                const user =
                    JSON.parse(storedUser);

                setText(
                    "profileName",
                    user.name ||
                    "Government Official"
                );

            } catch (error) {

                console.error(
                    "User information error:",
                    error
                );
            }
        }


        initializeGovernmentRiskMap();

        await loadGovernmentData();

        await loadLatestAlert();
    }


    /* =========================================================
       LOAD GOVERNMENT DATA
       ========================================================= */

    async function loadGovernmentData() {

        const token =
            localStorage.getItem(
                "access_token"
            );

        if (!token) {
            return;
        }


        try {

            const response =
                await fetch(
                    `${API_URL}/api/government/dashboard`,
                    {
                        method: "GET",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        }
                    }
                );


            console.log(
                "GOVERNMENT DASHBOARD STATUS:",
                response.status
            );


            const data =
                response.ok
                    ? await response.json()
                    : await loadLatestPredictionFallback(
                        token
                    );


            console.log(
                "GOVERNMENT DASHBOARD:",
                data
            );


            const prediction =
                findPrediction(data);


            if (prediction) {

                console.log(
                    "GOVERNMENT LATEST PREDICTION:",
                    prediction
                );

                await updateGovernmentPrediction(
                    prediction
                );

            } else {

                console.warn(
                    "No prediction found in government dashboard."
                );
            }


        } catch (error) {

            console.error(
                "Government dashboard error:",
                error
            );
        }
    }


    /* =========================================================
       FALLBACK LATEST PREDICTION
       ========================================================= */

    async function loadLatestPredictionFallback(
        token
    ) {

        try {

            const response =
                await fetch(
                    `${API_URL}/api/prediction/latest`,
                    {
                        method: "GET",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        }
                    }
                );


            if (!response.ok) {

                console.warn(
                    "Latest prediction fallback returned:",
                    response.status
                );

                return null;
            }


            return await response.json();

        } catch (error) {

            console.error(
                "Prediction fallback error:",
                error
            );

            return null;
        }
    }


    /* =========================================================
       FIND PREDICTION
       ========================================================= */

    function findPrediction(data) {

        if (!data) {
            return null;
        }


        if (Array.isArray(data)) {

            for (
                let i = data.length - 1;
                i >= 0;
                i--
            ) {

                const result =
                    findPrediction(data[i]);

                if (result) {
                    return result;
                }
            }

            return null;
        }


        if (
            typeof data !== "object"
        ) {

            return null;
        }


        if (
            data.flood_probability !== undefined ||
            data.risk_level !== undefined ||
            data.risk_score !== undefined ||
            data.predicted_rainfall_mm !== undefined ||
            data.rainfall !== undefined
        ) {

            return data;
        }


        const possibleKeys = [

            "latest_prediction",

            "prediction",

            "latest",

            "result",

            "data",

            "predictions",

            "history"

        ];


        for (
            const key of possibleKeys
        ) {

            if (
                data[key] !== undefined &&
                data[key] !== null
            ) {

                const result =
                    findPrediction(
                        data[key]
                    );

                if (result) {
                    return result;
                }
            }
        }


        for (
            const key of Object.keys(data)
        ) {

            const value =
                data[key];

            if (
                typeof value === "object" &&
                value !== null
            ) {

                const result =
                    findPrediction(value);

                if (result) {
                    return result;
                }
            }
        }


        return null;
    }


    /* =========================================================
       UPDATE GOVERNMENT PREDICTION
       ========================================================= */

    async function updateGovernmentPrediction(
        prediction
    ) {

        if (!prediction) {
            return;
        }


        latestPredictionId =
            prediction.prediction_id ??
            prediction.predictionId ??
            prediction.id ??
            null;


        const rainfall =
            Number(
                prediction.rainfall ??
                prediction.rainfall_mm ??
                prediction.predicted_rainfall_mm ??
                0
            );


        const floodProbability =
            Number(
                prediction.flood_probability ??
                prediction.floodProbability ??
                0
            );


        const riskLevel =
            String(
                prediction.risk_level ??
                prediction.riskLevel ??
                "MINIMAL"
            ).toUpperCase();


        const riskScore =
            Number(
                prediction.risk_score ??
                prediction.riskScore ??
                0
            );


        const confidence =
            Number(
                prediction.confidence ??
                0
            );


        const inundationArea =
            Number(
                prediction.inundation_area ??
                prediction.inundation_area_km2 ??
                prediction.inundationArea ??
                0
            );


        const region =
            prediction.region ??
            prediction.scenario_name ??
            prediction.scenarioName ??
            "Monitored Region";


        /*
         * =====================================================
         * GET PREDICTION COORDINATES
         * =====================================================
         */

        let latitude =
            getPredictionLatitude(
                prediction
            );

        let longitude =
            getPredictionLongitude(
                prediction
            );


        /*
         * If backend prediction does not contain coordinates,
         * try the location selected in the Admin map.
         */

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {

            const storedLocation =
                getStoredAquaLocation();


            if (storedLocation) {

                latitude =
                    Number(
                        storedLocation.latitude
                    );

                longitude =
                    Number(
                        storedLocation.longitude
                    );
            }
        }


        console.log(
            "GOVERNMENT PREDICTION VALUES:",
            {
                rainfall,
                floodProbability,
                riskLevel,
                riskScore,
                confidence,
                inundationArea,
                region,
                latitude,
                longitude
            }
        );


        /* =====================================================
           UPDATE PREDICTION REPORT
           ===================================================== */

        updatePredictionReport(
            prediction,
            rainfall,
            floodProbability,
            riskLevel,
            riskScore,
            confidence,
            inundationArea,
            region
        );


        /* =====================================================
           UPDATE STAT CARDS
           ===================================================== */

        const statCards =
            document.querySelectorAll(
                ".stats-grid .stat-card"
            );


        /*
         * CARD 1 - RAINFALL
         */

        if (statCards.length >= 1) {

            const rainfallCard =
                statCards[0];

            const strong =
                rainfallCard.querySelector(
                    "strong"
                );

            const small =
                rainfallCard.querySelector(
                    "small"
                );


            if (strong) {

                strong.textContent =
                    `${rainfall.toFixed(2)} mm`;
            }


            if (small) {

                small.textContent =
                    "Latest prediction";
            }
        }


        /*
         * CARD 2 - FLOOD PROBABILITY
         */

        if (statCards.length >= 2) {

            const floodCard =
                statCards[1];

            const strong =
                floodCard.querySelector(
                    "strong"
                );

            const small =
                floodCard.querySelector(
                    "small"
                );


            if (strong) {

                strong.textContent =
                    `${floodProbability.toFixed(2)}%`;
            }


            if (small) {

                small.textContent =
                    `${riskLevel} risk`;
            }
        }


        /*
         * CARD 3 - RISK LEVEL
         */

        if (statCards.length >= 3) {

            const riskCard =
                statCards[2];

            const strong =
                riskCard.querySelector(
                    "strong"
                );

            const small =
                riskCard.querySelector(
                    "small"
                );


            if (strong) {

                strong.textContent =
                    riskLevel;
            }


            if (small) {

                small.textContent =
                    "Current AI assessment";
            }
        }


        /*
         * CARD 4 - RISK SCORE
         */

        if (statCards.length >= 4) {

            const riskScoreCard =
                statCards[3];

            const label =
                riskScoreCard.querySelector(
                    "span"
                );

            const strong =
                riskScoreCard.querySelector(
                    "strong"
                );

            const small =
                riskScoreCard.querySelector(
                    "small"
                );


            if (label) {

                label.textContent =
                    "🎯 Risk Score";
            }


            if (strong) {

                strong.textContent =
                    `${riskScore.toFixed(2)} / 100`;
            }


            if (small) {

                small.textContent =
                    `${riskLevel} AI risk assessment`;
            }
        }


        /* =====================================================
           OTHER COMPONENTS
           ===================================================== */

        updateGovernmentAlert(
            riskLevel,
            floodProbability,
            region
        );


        updatePriorityZones(
            riskLevel,
            region
        );


        /* =====================================================
           UPDATE REAL LEAFLET MAP
           ===================================================== */

        updateGovernmentMap(
            riskLevel,
            region,
            latitude,
            longitude,
            riskScore,
            inundationArea,
            rainfall,
            floodProbability
        );


        /* =====================================================
           LOAD GIS INFORMATION
           ===================================================== */

        if (latestPredictionId) {

            await loadFloodMap(
                latestPredictionId
            );
        }
    }


    /* =========================================================
       GET LATITUDE FROM PREDICTION
       ========================================================= */

    function getPredictionLatitude(
        prediction
    ) {

        const candidates = [

            prediction.latitude,

            prediction.lat,

            prediction.location?.latitude,

            prediction.coordinates?.latitude,

            prediction.location_data?.latitude,

            prediction.data?.latitude

        ];


        for (
            const value of candidates
        ) {

            const number =
                Number(value);

            if (
                Number.isFinite(number) &&
                number >= -90 &&
                number <= 90
            ) {

                return number;
            }
        }


        return NaN;
    }


    /* =========================================================
       GET LONGITUDE FROM PREDICTION
       ========================================================= */

    function getPredictionLongitude(
        prediction
    ) {

        const candidates = [

            prediction.longitude,

            prediction.lon,

            prediction.lng,

            prediction.location?.longitude,

            prediction.coordinates?.longitude,

            prediction.location_data?.longitude,

            prediction.data?.longitude

        ];


        for (
            const value of candidates
        ) {

            const number =
                Number(value);

            if (
                Number.isFinite(number) &&
                number >= -180 &&
                number <= 180
            ) {

                return number;
            }
        }


        return NaN;
    }


    /* =========================================================
       GET SAVED ADMIN MAP LOCATION
       ========================================================= */

    function getStoredAquaLocation() {

        try {

            const raw =
                localStorage.getItem(
                    "aqua_selected_location"
                );


            if (!raw) {
                return null;
            }


            const location =
                JSON.parse(raw);


            if (
                location &&
                Number.isFinite(
                    Number(location.latitude)
                ) &&
                Number.isFinite(
                    Number(location.longitude)
                )
            ) {

                return location;
            }


        } catch (error) {

            console.warn(
                "Could not read aqua_selected_location:",
                error
            );
        }


        return null;
    }


    /* =========================================================
       PREDICTION REPORT
       ========================================================= */

    function updatePredictionReport(
        prediction,
        rainfall,
        floodProbability,
        riskLevel,
        riskScore,
        confidence,
        inundationArea,
        region
    ) {

        setText(
            "reportRegion",
            `${region} — ${riskLevel} risk`
        );


        setText(
            "reportMode",
            `${prediction.mode ?? "UNKNOWN"} REPORT`
        );


        setText(
            "reportRainfall",
            `${rainfall.toFixed(2)} mm`
        );


        setText(
            "reportFloodProbability",
            `${floodProbability.toFixed(2)}%`
        );


        setText(
            "reportRiskScore",
            riskScore.toFixed(2)
        );


        setText(
            "reportConfidence",
            `${confidence.toFixed(2)}%`
        );


        setText(
            "reportInundationArea",
            `${inundationArea.toFixed(2)} km²`
        );


        setText(
            "reportPredictionId",
            latestPredictionId ?? "--"
        );


        setText(
            "reportUpdatedAt",
            formatReportTime(
                prediction.updated_at ??
                prediction.created_at
            )
        );
    }


    /* =========================================================
       FORMAT TIME
       ========================================================= */

    function formatReportTime(
        value
    ) {

        if (!value) {
            return "Time not available";
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(value);
        }


        return date.toLocaleString();
    }


    /* =========================================================
       GOVERNMENT ALERT
       ========================================================= */

    function updateGovernmentAlert(
        riskLevel,
        floodProbability,
        region
    ) {

        const alertCard =
            document.querySelector(
                ".alert-card"
            );


        if (!alertCard) {
            return;
        }


        const title =
            alertCard.querySelector(
                "strong"
            );


        const message =
            alertCard.querySelector(
                "p"
            );


        const badge =
            alertCard.querySelector(
                ".status-badge"
            );


        if (title) {

            if (
                riskLevel === "CRITICAL"
            ) {

                title.textContent =
                    "Critical Flood Risk Detected";

            } else if (
                riskLevel === "HIGH"
            ) {

                title.textContent =
                    "High Flood Risk Detected";

            } else if (
                riskLevel === "MODERATE"
            ) {

                title.textContent =
                    "Moderate Flood Risk Detected";

            } else {

                title.textContent =
                    "Current Flood Risk Assessment";
            }
        }


        if (message) {

            message.textContent =
                `${riskLevel} flood risk detected in ${region}. ` +
                `Current predicted flood probability is ` +
                `${floodProbability.toFixed(2)}%.`;
        }


        if (badge) {

            badge.textContent =
                riskLevel;

            badge.className =
                `status-badge ${getRiskClass(
                    riskLevel
                )}`;
        }


        alertCard.classList.remove(
            "critical",
            "high",
            "moderate",
            "low",
            "minimal"
        );


        alertCard.classList.add(
            getRiskClass(
                riskLevel
            )
        );
    }


    /* =========================================================
       PRIORITY ZONES
       ========================================================= */

    function updatePriorityZones(
        riskLevel,
        region
    ) {

        const rows =
            document.querySelectorAll(
                ".zone-row"
            );


        if (!rows.length) {
            return;
        }


        if (rows[0]) {

            const name =
                rows[0].querySelector(
                    "span"
                );

            const status =
                rows[0].querySelector(
                    "strong"
                );


            if (name) {

                name.textContent =
                    region;
            }


            if (status) {

                status.textContent =
                    riskLevel;

                status.className =
                    getRiskTextClass(
                        riskLevel
                    );
            }
        }


        if (rows[1]) {

            const name =
                rows[1].querySelector(
                    "span"
                );

            const status =
                rows[1].querySelector(
                    "strong"
                );


            if (name) {

                name.textContent =
                    "Other monitored zone";
            }


            if (status) {

                status.textContent =
                    "MONITORING";

                status.className =
                    "warning-text";
            }
        }


        if (rows[2]) {

            const name =
                rows[2].querySelector(
                    "span"
                );

            const status =
                rows[2].querySelector(
                    "strong"
                );


            if (name) {

                name.textContent =
                    "Regional monitoring";
            }


            if (status) {

                status.textContent =
                    "MONITORING";

                status.className =
                    "warning-text";
            }
        }


        if (rows[3]) {

            const name =
                rows[3].querySelector(
                    "span"
                );

            const status =
                rows[3].querySelector(
                    "strong"
                );


            if (name) {

                name.textContent =
                    "Infrastructure";
            }


            if (status) {

                status.textContent =
                    "DATA PENDING";

                status.className =
                    "safe-text";
            }
        }
    }


    /* =========================================================
       RISK COLOR
       ========================================================= */

    function getGovernmentRiskColor(
        riskLevel
    ) {

        const risk =
            String(
                riskLevel ||
                "MINIMAL"
            ).toUpperCase();


        switch (risk) {

            case "CRITICAL":
                return "#ef4444";

            case "HIGH":
                return "#f97316";

            case "MODERATE":
                return "#eab308";

            case "LOW":
                return "#84cc16";

            case "MINIMAL":
            default:
                return "#22c55e";
        }
    }


    /* =========================================================
       INITIALIZE INDIA-WIDE GOVERNMENT MAP
       ========================================================= */

    function initializeGovernmentRiskMap() {

        const mapElement =
            document.getElementById(
                "governmentRiskMap"
            );


        if (!mapElement) {

            console.warn(
                "governmentRiskMap element not found."
            );

            return;
        }


        if (
            typeof L === "undefined"
        ) {

            console.error(
                "Leaflet is not loaded. " +
                "Add Leaflet CSS and JS to government_dashboard.html."
            );

            return;
        }


        if (governmentRiskMap) {

            setTimeout(
                function () {

                    governmentRiskMap.invalidateSize();

                },
                200
            );

            return;
        }


        /*
         * INDIA-WIDE MAP
         */

        governmentRiskMap =
            L.map(
                "governmentRiskMap",
                {
                    center: [
                        22.5,
                        79.0
                    ],

                    zoom: 5,

                    minZoom: 4,

                    maxZoom: 18,

                    zoomControl: true
                }
            );


        /*
         * OPEN STREET MAP
         */

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,

                attribution:
                    "&copy; OpenStreetMap contributors"
            }
        ).addTo(
            governmentRiskMap
        );


        /*
         * INDIA BOUNDS
         */

        const indiaBounds =
            L.latLngBounds(
                [6.0, 68.0],
                [37.5, 97.5]
            );


        governmentRiskMap.fitBounds(
            indiaBounds,
            {
                padding: [
                    10,
                    10
                ]
            }
        );


        /*
         * Fix Leaflet sizing
         */

        setTimeout(
            function () {

                if (
                    governmentRiskMap
                ) {

                    governmentRiskMap.invalidateSize();
                }

            },
            500
        );


        console.log(
            "AquaSentinel India-wide Government Map initialized."
        );
    }


    /* =========================================================
       UPDATE GOVERNMENT MAP
       ========================================================= */

    function updateGovernmentMap(
        riskLevel,
        region,
        latitude,
        longitude,
        riskScore,
        inundationArea,
        rainfall,
        floodProbability
    ) {

        /*
         * Always initialize map first.
         */

        initializeGovernmentRiskMap();


        if (
            !governmentRiskMap
        ) {

            return;
        }


        const lat =
            Number(latitude);

        const lon =
            Number(longitude);


        /*
         * Update location text even
         * when coordinates are unavailable.
         */

        const regionElement =
            document.getElementById(
                "governmentMapRegion"
            );


        if (regionElement) {

            regionElement.textContent =
                region ||
                "Location unavailable";
        }


        /*
         * If coordinates are unavailable,
         * keep India-wide map visible.
         */

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
        ) {

            console.warn(
                "Government prediction has no valid coordinates."
            );

            return;
        }


        const risk =
            String(
                riskLevel ||
                "MINIMAL"
            ).toUpperCase();


        const riskColor =
            getGovernmentRiskColor(
                risk
            );


        /*
         * Remove previous marker
         */

        if (
            governmentMapMarker
        ) {

            governmentRiskMap.removeLayer(
                governmentMapMarker
            );

            governmentMapMarker =
                null;
        }


        /*
         * Remove previous flood zone
         */

        if (
            governmentFloodCircle
        ) {

            governmentRiskMap.removeLayer(
                governmentFloodCircle
            );

            governmentFloodCircle =
                null;
        }


        /* =====================================================
           LOCATION MARKER
           ===================================================== */

        const markerIcon =
            L.divIcon(
                {
                    className:
                        "government-location-marker-wrapper",

                    html:
                        '<div class="government-location-marker"></div>',

                    iconSize: [
                        26,
                        26
                    ],

                    iconAnchor: [
                        13,
                        13
                    ],

                    popupAnchor: [
                        0,
                        -13
                    ]
                }
            );


        governmentMapMarker =
            L.marker(
                [
                    lat,
                    lon
                ],
                {
                    icon:
                        markerIcon
                }
            ).addTo(
                governmentRiskMap
            );


        /* =====================================================
           INUNDATION AREA
           ===================================================== */

        let area =
            Number(
                inundationArea ||
                0
            );


        if (
            !Number.isFinite(area) ||
            area <= 0
        ) {

            area = 0.5;
        }


        /*
         * Approximate circular radius:
         *
         * Area = πr²
         *
         * r = sqrt(Area / π)
         */

        let radiusKm =
            Math.sqrt(
                area /
                Math.PI
            );


        /*
         * Keep visualization practical.
         */

        radiusKm =
            Math.max(
                0.5,
                Math.min(
                    radiusKm,
                    15
                )
            );


        const radiusMeters =
            radiusKm * 1000;


        /* =====================================================
           FLOOD RISK CIRCLE
           ===================================================== */

        governmentFloodCircle =
            L.circle(
                [
                    lat,
                    lon
                ],
                {
                    radius:
                        radiusMeters,

                    color:
                        riskColor,

                    weight: 3,

                    opacity: 0.9,

                    fillColor:
                        riskColor,

                    fillOpacity: 0.25
                }
            ).addTo(
                governmentRiskMap
            );


        /* =====================================================
           POPUP
           ===================================================== */

        const popupHTML = `

            <div class="government-map-popup">

                <h4>
                    ${region || "Selected Location"}
                </h4>

                <p>
                    <strong>Risk Level:</strong>
                    ${risk}
                </p>

                <p>
                    <strong>Risk Score:</strong>
                    ${Number(
                        riskScore || 0
                    ).toFixed(2)} / 100
                </p>

                <p>
                    <strong>Rainfall:</strong>
                    ${Number(
                        rainfall || 0
                    ).toFixed(2)} mm
                </p>

                <p>
                    <strong>Flood Probability:</strong>
                    ${Number(
                        floodProbability || 0
                    ).toFixed(2)}%
                </p>

                <p>
                    <strong>Inundation Area:</strong>
                    ${area.toFixed(2)} km²
                </p>

                <p>
                    <strong>Coordinates:</strong>
                    ${lat.toFixed(5)},
                    ${lon.toFixed(5)}
                </p>

            </div>

        `;


        governmentMapMarker
            .bindPopup(
                popupHTML
            )
            .openPopup();


        /* =====================================================
           UPDATE MAP INFORMATION
           ===================================================== */

        const riskElement =
            document.getElementById(
                "governmentMapRisk"
            );


        if (riskElement) {

            riskElement.textContent =
                risk;

            riskElement.style.color =
                riskColor;
        }


        const scoreElement =
            document.getElementById(
                "governmentMapRiskScore"
            );


        if (scoreElement) {

            scoreElement.textContent =
                Number(
                    riskScore || 0
                ).toFixed(2);
        }


        /* =====================================================
           ZOOM TO LOCATION
           ===================================================== */

        governmentRiskMap.flyTo(
            [
                lat,
                lon
            ],
            9,
            {
                duration: 1.2
            }
        );


        console.log(
            "GOVERNMENT FLOOD MAP UPDATED:",
            {
                region,
                latitude: lat,
                longitude: lon,
                risk,
                riskScore,
                rainfall,
                floodProbability,
                inundationArea
            }
        );
    }


    /* =========================================================
       LOAD GIS FLOOD MAP
       ========================================================= */

    async function loadFloodMap(
        predictionId
    ) {

        const token =
            localStorage.getItem(
                "access_token"
            );


        if (
            !token ||
            !predictionId
        ) {

            return;
        }


        try {

            const response =
                await fetch(
                    `${API_URL}/api/gis/flood-map/${predictionId}`,
                    {
                        method: "GET",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        }
                    }
                );


            console.log(
                "GOVERNMENT GIS STATUS:",
                response.status
            );


            if (!response.ok) {

                console.warn(
                    "GIS API returned:",
                    response.status
                );

                return;
            }


            const data =
                await response.json();


            console.log(
                "GOVERNMENT FLOOD MAP:",
                data
            );


        } catch (error) {

            console.error(
                "Government GIS error:",
                error
            );
        }
    }


    /* =========================================================
       LOAD LATEST ALERT
       ========================================================= */

    async function loadLatestAlert() {

        const token =
            localStorage.getItem(
                "access_token"
            );


        if (!token) {
            return;
        }


        try {

            const response =
                await fetch(
                    `${API_URL}/api/alerts/latest`,
                    {
                        method: "GET",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`
                        }
                    }
                );


            console.log(
                "GOVERNMENT ALERT STATUS:",
                response.status
            );


            if (!response.ok) {

                console.warn(
                    "Alert API returned:",
                    response.status
                );

                return;
            }


            const data =
                await response.json();


            console.log(
                "GOVERNMENT LATEST ALERT:",
                data
            );


            if (!data.alert) {
                return;
            }


            const alert =
                data.alert;


            const riskLevel =
                String(
                    alert.risk_level ??
                    "MINIMAL"
                ).toUpperCase();


            const floodProbability =
                Number(
                    alert.flood_probability ??
                    0
                );


            const region =
                alert.region ??
                "Monitored Region";


            updateGovernmentAlert(
                riskLevel,
                floodProbability,
                region
            );


        } catch (error) {

            console.error(
                "Government alert error:",
                error
            );
        }
    }


    /* =========================================================
       RISK CLASS
       ========================================================= */

    function getRiskClass(
        riskLevel
    ) {

        const risk =
            String(
                riskLevel || ""
            ).toUpperCase();


        switch (risk) {

            case "CRITICAL":
                return "critical";

            case "HIGH":
                return "high";

            case "MODERATE":
                return "moderate";

            case "LOW":
                return "low";

            case "MINIMAL":
                return "minimal";

            default:
                return "minimal";
        }
    }


    /* =========================================================
       RISK TEXT CLASS
       ========================================================= */

    function getRiskTextClass(
        riskLevel
    ) {

        const risk =
            String(
                riskLevel || ""
            ).toUpperCase();


        switch (risk) {

            case "CRITICAL":

            case "HIGH":

                return "danger-text";


            case "MODERATE":

                return "warning-text";


            case "LOW":

            case "MINIMAL":

                return "safe-text";


            default:

                return "warning-text";
        }
    }


    /* =========================================================
       SET TEXT HELPER
       ========================================================= */

    function setText(
        elementId,
        value
    ) {

        const element =
            document.getElementById(
                elementId
            );


        if (element) {

            element.textContent =
                value;
        }
    }


    /* =========================================================
       LOGOUT
       ========================================================= */

    function logout() {

        localStorage.removeItem(
            "access_token"
        );

        localStorage.removeItem(
            "user"
        );

        localStorage.removeItem(
            "role"
        );


        window.location.href =
            "/templates/login.html";
    }


    /* =========================================================
       EXPOSE FUNCTIONS
       ========================================================= */

    window.loadGovernmentDashboard =
        loadGovernmentDashboard;


    window.navigateGovernment =
        navigateGovernment;


    window.logout =
        logout;


    window.initializeGovernmentRiskMap =
        initializeGovernmentRiskMap;


    window.updateGovernmentMap =
        updateGovernmentMap;


    /* =========================================================
       INITIALIZE
       ========================================================= */

    function initializeGovernmentPage() {

        /*
         * Initialize map first.
         */

        initializeGovernmentRiskMap();


        /*
         * Then load dashboard data.
         */

        loadGovernmentDashboard();
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeGovernmentPage
        );

    } else {

        initializeGovernmentPage();
    }


})();