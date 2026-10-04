const API_URL = "http://127.0.0.1:8000";

let latestPredictionId = null;
let currentLocation = null;
let currentWeather = null;
let currentLocationName = "Your Current Location";

/* =========================================================
   START DASHBOARD
   ========================================================= */

async function loadDashboard() {
    const token = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("user");

    if (!token) {
        window.location.href = "/templates/login.html";
        return;
    }

    /* USER INFORMATION */
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);

            setText("userName", user.name || "User");
            setText("profileName", user.name || "Aqua User");
        } catch (error) {
            console.error("User information error:", error);
        }
    }

    /*
     * IMPORTANT:
     * Start location/weather independently so the existing
     * prediction and alert APIs continue working.
     */
    createCurrentWeatherPanel();

    await Promise.allSettled([
        loadCurrentLocationAndWeather(),
        loadLatestAlert(),
        loadLatestPrediction()
    ]);
}


/* =========================================================
   CURRENT LOCATION + WEATHER
   ========================================================= */

async function loadCurrentLocationAndWeather() {
    setLocationStatus("Requesting your current location...");

    if (!navigator.geolocation) {
        setLocationStatus("Geolocation is not supported by this browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                currentLocation = {
                    latitude,
                    longitude,
                    accuracy: position.coords.accuracy
                };

                localStorage.setItem(
                    "current_latitude",
                    latitude.toString()
                );

                localStorage.setItem(
                    "current_longitude",
                    longitude.toString()
                );

                updateLocationCoordinates(latitude, longitude);

                setLocationStatus("Finding your location...");

                const locationName = await getLocationName(
                    latitude,
                    longitude
                );

                currentLocationName =
                    locationName || "Your Current Location";

                localStorage.setItem(
                    "current_location_name",
                    currentLocationName
                );

                updateCurrentLocationUI(
                    currentLocationName,
                    latitude,
                    longitude
                );

                setLocationStatus(
                    `Current location detected: ${currentLocationName}`
                );

                await loadCurrentWeather(
                    latitude,
                    longitude
                );

                /*
                 * Save location for other dashboards/components.
                 */
                localStorage.setItem(
                    "aqua_current_location",
                    JSON.stringify({
                        latitude,
                        longitude,
                        region: currentLocationName,
                        timestamp: new Date().toISOString()
                    })
                );

                /*
                 * Inform other UI components.
                 */
                document.dispatchEvent(
                    new CustomEvent("aqua-current-location", {
                        detail: {
                            latitude,
                            longitude,
                            region: currentLocationName
                        }
                    })
                );

            } catch (error) {
                console.error(
                    "Current location/weather error:",
                    error
                );

                setLocationStatus(
                    "Location detected, but weather could not be loaded."
                );
            }
        },

        (error) => {
            console.warn(
                "Geolocation error:",
                error
            );

            let message =
                "Unable to access your current location.";

            if (error.code === 1) {
                message =
                    "Location permission was denied. Please allow location access in your browser.";
            } else if (error.code === 2) {
                message =
                    "Your location could not be determined.";
            } else if (error.code === 3) {
                message =
                    "Location request timed out.";
            }

            setLocationStatus(message);

            /*
             * Do NOT break the dashboard if the user
             * denies location permission.
             */
        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000
        }
    );
}


/* =========================================================
   CURRENT WEATHER - OPEN METEO
   ========================================================= */

async function loadCurrentWeather(latitude, longitude) {
    try {
        setWeatherStatus("Loading live weather...");

        const url =
            "https://api.open-meteo.com/v1/forecast" +
            `?latitude=${encodeURIComponent(latitude)}` +
            `&longitude=${encodeURIComponent(longitude)}` +
            "&current=temperature_2m,relative_humidity_2m,rain,precipitation,wind_speed_10m,weather_code" +
            "&hourly=rain,precipitation_probability" +
            "&timezone=auto";

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Weather API returned ${response.status}`
            );
        }

        const data = await response.json();

        const current = data.current || {};

        currentWeather = {
            temperature: Number(
                current.temperature_2m ?? 0
            ),

            humidity: Number(
                current.relative_humidity_2m ?? 0
            ),

            rainfall: Number(
                current.rain ?? current.precipitation ?? 0
            ),

            precipitation: Number(
                current.precipitation ?? 0
            ),

            windSpeed: Number(
                current.wind_speed_10m ?? 0
            ),

            weatherCode: Number(
                current.weather_code ?? 0
            ),

            timezone:
                data.timezone || "auto"
        };

        updateWeatherUI(currentWeather);

        /*
         * Rainfall card on existing dashboard.
         * This represents the current weather observation.
         */
        setText(
            "rainfallValue",
            `${currentWeather.rainfall.toFixed(2)} mm`
        );

        /*
         * Update rainfall visualization.
         */
        updateRainfallBars(currentWeather.rainfall);

        setWeatherStatus(
            `Live weather updated · ${formatWeatherTime(current.timezone)}`
        );

        /*
         * Optional location-based prediction call.
         * We only attempt this if the backend exposes the
         * dynamic prediction endpoint.
         */
        await requestLocationPrediction(
            latitude,
            longitude,
            currentWeather
        );

    } catch (error) {
        console.error(
            "Weather API error:",
            error
        );

        setWeatherStatus(
            "Live weather is temporarily unavailable."
        );
    }
}


/* =========================================================
   LOCATION-BASED PREDICTION
   ========================================================= */

async function requestLocationPrediction(
    latitude,
    longitude,
    weather
) {
    const token =
        localStorage.getItem("access_token");

    if (!token) {
        return;
    }

    /*
     * Do not replace the existing prediction system.
     *
     * The current backend may have different dynamic endpoint
     * parameters, so first try the known AquaSentinel dynamic
     * endpoint.
     */

    const endpoints = [
        `${API_URL}/api/dynamic/predict`,
        `${API_URL}/api/prediction/dynamic`
    ];

    const payload = {
        latitude: latitude,
        longitude: longitude,

        rainfall_mm:
            Number(weather.rainfall || 0),

        temperature_c:
            Number(weather.temperature || 0),

        humidity:
            Number(weather.humidity || 0),

        wind_speed_kmh:
            Number(weather.windSpeed || 0),

        region:
            currentLocationName
    };

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                continue;
            }

            const data =
                await response.json();

            console.log(
                "LOCATION PREDICTION:",
                data
            );

            const prediction =
                extractPrediction(data);

            if (!prediction) {
                continue;
            }

            applyPredictionToDashboard(
                prediction
            );

            return;
        } catch (error) {
            console.warn(
                `Dynamic prediction endpoint failed: ${endpoint}`,
                error
            );
        }
    }

    /*
     * If dynamic prediction endpoint isn't available,
     * the normal /api/prediction/latest call continues
     * to provide the dashboard prediction.
     */
}


/* =========================================================
   APPLY PREDICTION
   ========================================================= */

function applyPredictionToDashboard(prediction) {
    if (!prediction) {
        return;
    }

    latestPredictionId =
        prediction.prediction_id ??
        prediction.predictionId ??
        prediction.id ??
        latestPredictionId;

    const rainfall = Number(
        prediction.rainfall_mm ??
        prediction.rainfall ??
        prediction.predicted_rainfall_mm ??
        currentWeather?.rainfall ??
        0
    );

    const floodProbability = Number(
        prediction.flood_probability ??
        prediction.floodProbability ??
        0
    );

    const inundationArea = Number(
        prediction.inundation_area_km2 ??
        prediction.inundationArea ??
        0
    );

    const riskScore = Number(
        prediction.risk_score ??
        prediction.riskScore ??
        0
    );

    const confidence = Number(
        prediction.confidence ??
        0
    );

    const riskLevel = String(
        prediction.risk_level ??
        prediction.riskLevel ??
        calculateRiskLevel(riskScore)
    ).toUpperCase();

    setText(
        "rainfallValue",
        `${rainfall.toFixed(2)} mm`
    );

    setText(
        "floodProbability",
        `${floodProbability.toFixed(2)}%`
    );

    setText(
        "safetyLevel",
        riskLevel
    );

    setText(
        "riskLevel",
        riskLevel
    );

    setText(
        "riskCircleValue",
        `${floodProbability.toFixed(0)}%`
    );

    setText(
        "riskScore",
        riskScore.toFixed(2)
    );

    setText(
        "confidence",
        `${confidence.toFixed(2)}%`
    );

    setText(
        "inundationArea",
        `${inundationArea.toFixed(2)} km²`
    );

    setText(
        "mapRisk",
        `${riskLevel} Risk Zone`
    );

    if (currentLocationName) {
        setText(
            "mapRegion",
            currentLocationName
        );
    }

    const riskLabel =
        document.getElementById("riskLabel");

    if (riskLabel) {
        riskLabel.textContent =
            `${riskLevel} RISK`;

        riskLabel.className =
            `risk-label ${getRiskClass(riskLevel)}`;
    }

    const badge =
        document.getElementById("alertBadge");

    if (badge) {
        badge.textContent =
            riskLevel;

        badge.className =
            `status-badge ${getRiskClass(riskLevel)}`;
    }

    updateRainfallBars(rainfall);

    /*
     * Store latest prediction location.
     */
    if (
        currentLocation &&
        Number.isFinite(currentLocation.latitude) &&
        Number.isFinite(currentLocation.longitude)
    ) {
        setText(
            "mapLocationCoordinates",
            `${currentLocation.latitude.toFixed(6)}° N, ` +
            `${currentLocation.longitude.toFixed(6)}° E`
        );
    }
}


/* =========================================================
   WEATHER PANEL
   ========================================================= */

function createCurrentWeatherPanel() {
    /*
     * If a weather panel already exists in HTML,
     * do not create another one.
     */
    if (
        document.getElementById(
            "currentWeatherPanel"
        )
    ) {
        return;
    }

    const riskSection =
        document.getElementById(
            "riskMapSection"
        );

    const panel =
        document.createElement("section");

    panel.id =
        "currentWeatherPanel";

    panel.className =
        "panel aqua-current-weather-panel";

    panel.innerHTML = `
        <div class="panel-header">
            <div>
                <h2>📍 Current Location & Weather</h2>
                <p id="locationStatus">
                    Requesting your current location...
                </p>
            </div>

            <span
                id="weatherStatus"
                class="live"
            >
                ● LIVE WEATHER
            </span>
        </div>

        <div
            class="current-location-card"
            style="
                display:grid;
                grid-template-columns:
                    repeat(auto-fit,minmax(180px,1fr));
                gap:14px;
                margin-top:18px;
            "
        >

            <div class="weather-info-box">
                <small>Current Location</small>
                <strong id="currentLocationName">
                    Detecting...
                </strong>
            </div>

            <div class="weather-info-box">
                <small>Temperature</small>
                <strong id="currentTemperature">
                    -- °C
                </strong>
            </div>

            <div class="weather-info-box">
                <small>Rainfall</small>
                <strong id="currentRainfall">
                    -- mm
                </strong>
            </div>

            <div class="weather-info-box">
                <small>Humidity</small>
                <strong id="currentHumidity">
                    -- %
                </strong>
            </div>

            <div class="weather-info-box">
                <small>Wind Speed</small>
                <strong id="currentWind">
                    -- km/h
                </strong>
            </div>

            <div class="weather-info-box">
                <small>Coordinates</small>
                <strong
                    id="currentCoordinates"
                    style="font-size:13px;"
                >
                    --
                </strong>
            </div>

        </div>

        <div
            id="weatherCondition"
            style="
                margin-top:15px;
                padding:12px 14px;
                border-radius:12px;
                background:#f8fafc;
                color:#475569;
                font-size:14px;
            "
        >
            Waiting for weather data...
        </div>
    `;

    /*
     * Put weather panel before the map.
     */
    if (riskSection && riskSection.parentNode) {
        riskSection.parentNode.insertBefore(
            panel,
            riskSection
        );
    } else {
        document
            .querySelector("main")
            ?.appendChild(panel);
    }

    injectWeatherStyles();
}


/* =========================================================
   WEATHER UI
   ========================================================= */

function updateWeatherUI(weather) {
    if (!weather) {
        return;
    }

    setText(
        "currentTemperature",
        `${weather.temperature.toFixed(1)} °C`
    );

    setText(
        "currentRainfall",
        `${weather.rainfall.toFixed(2)} mm`
    );

    setText(
        "currentHumidity",
        `${weather.humidity.toFixed(0)} %`
    );

    setText(
        "currentWind",
        `${weather.windSpeed.toFixed(1)} km/h`
    );

    setText(
        "weatherCondition",
        getWeatherDescription(
            weather.weatherCode
        )
    );
}


function updateCurrentLocationUI(
    locationName,
    latitude,
    longitude
) {
    setText(
        "currentLocationName",
        locationName
    );

    setText(
        "currentCoordinates",
        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    );

    setText(
        "mapRegion",
        locationName
    );

    setText(
        "mapLocationCoordinates",
        `${latitude.toFixed(6)}° N, ` +
        `${longitude.toFixed(6)}° E`
    );
}


function updateLocationCoordinates(
    latitude,
    longitude
) {
    setText(
        "currentCoordinates",
        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    );

    setText(
        "mapLocationCoordinates",
        `${latitude.toFixed(6)}° N, ` +
        `${longitude.toFixed(6)}° E`
    );
}


function setLocationStatus(message) {
    setText(
        "locationStatus",
        message
    );
}


function setWeatherStatus(message) {
    setText(
        "weatherStatus",
        `● ${message}`
    );
}


/* =========================================================
   WEATHER DESCRIPTION
   ========================================================= */

function getWeatherDescription(code) {
    const descriptions = {
        0: "☀️ Clear sky",
        1: "🌤️ Mainly clear",
        2: "⛅ Partly cloudy",
        3: "☁️ Overcast",

        45: "🌫️ Fog",
        48: "🌫️ Depositing rime fog",

        51: "🌦️ Light drizzle",
        53: "🌦️ Moderate drizzle",
        55: "🌧️ Dense drizzle",

        56: "🌧️ Light freezing drizzle",
        57: "🌧️ Dense freezing drizzle",

        61: "🌧️ Slight rain",
        63: "🌧️ Moderate rain",
        65: "🌧️ Heavy rain",

        66: "🌧️ Light freezing rain",
        67: "🌧️ Heavy freezing rain",

        71: "🌨️ Slight snowfall",
        73: "🌨️ Moderate snowfall",
        75: "❄️ Heavy snowfall",

        77: "🌨️ Snow grains",

        80: "🌦️ Slight rain showers",
        81: "🌧️ Moderate rain showers",
        82: "⛈️ Violent rain showers",

        85: "🌨️ Slight snow showers",
        86: "🌨️ Heavy snow showers",

        95: "⛈️ Thunderstorm",
        96: "⛈️ Thunderstorm with hail",
        99: "⛈️ Severe thunderstorm with hail"
    };

    return (
        descriptions[code] ||
        "🌦️ Weather conditions detected"
    );
}


/* =========================================================
   RAINFALL BARS
   ========================================================= */

function updateRainfallBars(rainfall) {
    const bars = [
        "rainBar1",
        "rainBar2",
        "rainBar3",
        "rainBar4",
        "rainBar5",
        "rainBar6",
        "rainBar7"
    ];

    const intensity =
        Math.min(
            Math.max(
                Number(rainfall || 0) / 20,
                0
            ),
            1
        );

    bars.forEach((id, index) => {
        const bar =
            document.getElementById(id);

        if (!bar) {
            return;
        }

        const multiplier =
            0.35 +
            (index / bars.length) * 0.65;

        const height =
            Math.max(
                15,
                Math.round(
                    20 +
                    intensity *
                    multiplier *
                    80
                )
            );

        bar.style.height =
            `${height}px`;
    });
}


/* =========================================================
   LOAD LATEST ALERT
   ========================================================= */

async function loadLatestAlert() {
    const token =
        localStorage.getItem("access_token");

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
                            `Bearer ${token}`,

                        "Accept":
                            "application/json"
                    }
                }
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
            "LATEST ALERT:",
            data
        );

        if (!data.alert) {
            return;
        }

        const alert =
            data.alert;

        const rainfall =
            Number(
                alert.rainfall_mm ?? 0
            );

        const floodProbability =
            Number(
                alert.flood_probability ?? 0
            );

        const inundationArea =
            Number(
                alert.inundation_area_km2 ?? 0
            );

        const riskLevel =
            String(
                alert.risk_level ??
                "MINIMAL"
            ).toUpperCase();

        if (alert.prediction_id) {
            latestPredictionId =
                alert.prediction_id;
        }

        setText(
            "rainfallValue",
            `${rainfall.toFixed(2)} mm`
        );

        setText(
            "floodProbability",
            `${floodProbability.toFixed(2)}%`
        );

        setText(
            "safetyLevel",
            riskLevel
        );

        setText(
            "riskLevel",
            riskLevel
        );

        setText(
            "riskCircleValue",
            `${floodProbability.toFixed(0)}%`
        );

        setText(
            "inundationArea",
            `${inundationArea.toFixed(2)} km²`
        );

        setText(
            "alertTitle",
            alert.title ||
            "Weather Risk Alert"
        );

        setText(
            "alertMessage",
            alert.message ||
            "Current weather conditions are being monitored."
        );

        const badge =
            document.getElementById(
                "alertBadge"
            );

        if (badge) {
            badge.textContent =
                riskLevel;

            badge.className =
                `status-badge ${getRiskClass(
                    riskLevel
                )}`;
        }

        const riskLabel =
            document.getElementById(
                "riskLabel"
            );

        if (riskLabel) {
            riskLabel.textContent =
                `${riskLevel} RISK`;

            riskLabel.className =
                `risk-label ${getRiskClass(
                    riskLevel
                )}`;
        }

        setText(
            "mapRisk",
            `${riskLevel} Risk Zone`
        );

    } catch (error) {
        console.error(
            "Alert loading error:",
            error
        );
    }
}


/* =========================================================
   LOAD LATEST PREDICTION
   ========================================================= */

async function loadLatestPrediction() {
    const token =
        localStorage.getItem("access_token");

    if (!token) {
        return;
    }

    try {
        const response =
            await fetch(
                `${API_URL}/api/prediction/latest`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "application/json"
                    }
                }
            );

        if (!response.ok) {
            console.warn(
                "Prediction history returned:",
                response.status
            );
            return;
        }

        const data =
            await response.json();

        console.log(
            "PREDICTION HISTORY:",
            data
        );

        const prediction =
            findPrediction(data);

        if (!prediction) {
            console.warn(
                "No prediction record found."
            );
            return;
        }

        console.log(
            "LATEST PREDICTION:",
            prediction
        );

        latestPredictionId =
            prediction.prediction_id ??
            prediction.predictionId ??
            prediction.id ??
            latestPredictionId;

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

        const region =
            prediction.region ??
            prediction.location ??
            null;

        const latitude =
            Number(
                prediction.latitude ??
                prediction.lat
            );

        const longitude =
            Number(
                prediction.longitude ??
                prediction.lon ??
                prediction.lng
            );

        const rainfall =
            Number(
                prediction.rainfall_mm ??
                prediction.rainfall ??
                prediction.predicted_rainfall_mm ??
                0
            );

        const floodProbability =
            Number(
                prediction.flood_probability ??
                prediction.floodProbability ??
                0
            );

        const inundationArea =
            Number(
                prediction.inundation_area_km2 ??
                prediction.inundationArea ??
                0
            );

        const riskLevel =
            String(
                prediction.risk_level ??
                prediction.riskLevel ??
                calculateRiskLevel(riskScore)
            ).toUpperCase();

        setText(
            "riskScore",
            riskScore.toFixed(2)
        );

        setText(
            "confidence",
            `${confidence.toFixed(2)}%`
        );

        /*
         * Only use backend region when it exists.
         * Otherwise current browser location remains.
         */
        if (region) {
            setText(
                "mapRegion",
                region
            );
        }

        if (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
        ) {
            setText(
                "mapLocationCoordinates",
                `${latitude.toFixed(6)}° N, ` +
                `${longitude.toFixed(6)}° E`
            );
        }

        /*
         * Update risk values from prediction.
         */
        setText(
            "floodProbability",
            `${floodProbability.toFixed(2)}%`
        );

        setText(
            "riskCircleValue",
            `${floodProbability.toFixed(0)}%`
        );

        setText(
            "riskLevel",
            riskLevel
        );

        setText(
            "safetyLevel",
            riskLevel
        );

        setText(
            "inundationArea",
            `${inundationArea.toFixed(2)} km²`
        );

        setText(
            "mapRisk",
            `${riskLevel} Risk Zone`
        );

        /*
         * If current weather is available, do not overwrite
         * the live weather rainfall with old prediction data.
         */
        if (!currentWeather) {
            setText(
                "rainfallValue",
                `${rainfall.toFixed(2)} mm`
            );
        }

        const riskLabel =
            document.getElementById(
                "riskLabel"
            );

        if (riskLabel) {
            riskLabel.textContent =
                `${riskLevel} RISK`;

            riskLabel.className =
                `risk-label ${getRiskClass(
                    riskLevel
                )}`;
        }

        if (latestPredictionId) {
            await loadFloodMap(
                latestPredictionId
            );
        }

    } catch (error) {
        console.error(
            "Prediction history error:",
            error
        );
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
        typeof data === "object"
    ) {
        const hasPredictionId =
            data.prediction_id !== undefined ||
            data.predictionId !== undefined;

        const hasRiskData =
            data.flood_probability !== undefined ||
            data.risk_score !== undefined ||
            data.confidence !== undefined;

        const hasRainfall =
            data.rainfall !== undefined ||
            data.rainfall_mm !== undefined ||
            data.predicted_rainfall_mm !== undefined;

        if (
            hasPredictionId ||
            hasRiskData ||
            hasRainfall
        ) {
            return data;
        }

        const keys = [
            "latest_prediction",
            "prediction",
            "latest",
            "result",
            "data",
            "predictions",
            "history"
        ];

        for (const key of keys) {
            if (
                data[key] !== undefined &&
                data[key] !== null
            ) {
                const result =
                    findPrediction(data[key]);

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
    }

    return null;
}


/* =========================================================
   EXTRACT PREDICTION
   ========================================================= */

function extractPrediction(data) {
    if (!data) {
        return null;
    }

    if (
        data.prediction &&
        typeof data.prediction === "object"
    ) {
        return findPrediction(
            data.prediction
        );
    }

    return findPrediction(data);
}


/* =========================================================
   LOAD GIS FLOOD MAP
   ========================================================= */

async function loadFloodMap(
    predictionId
) {
    const token =
        localStorage.getItem("access_token");

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
                            `Bearer ${token}`,

                        "Accept":
                            "application/json"
                    }
                }
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
            "FLOOD MAP:",
            data
        );

        const center =
            data.map?.center;

        const latitude =
            Number(
                center?.latitude
            );

        const longitude =
            Number(
                center?.longitude
            );

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return;
        }

        const inundation =
            data.map?.inundation || {};

        const riskLevel =
            String(
                inundation.risk_level ||
                data.risk_level ||
                "UNKNOWN"
            ).toUpperCase();

        let locationName =
            data.region ||
            data.location ||
            data.map?.zone?.zone_name ||
            null;

        if (
            !locationName ||
            locationName === "Selected Location"
        ) {
            locationName =
                await getLocationName(
                    latitude,
                    longitude
                );
        }

        /*
         * Prefer actual browser location if it is available
         * and is close to the GIS prediction location.
         */
        if (
            currentLocation &&
            distanceBetweenCoordinates(
                currentLocation.latitude,
                currentLocation.longitude,
                latitude,
                longitude
            ) < 5
        ) {
            locationName =
                currentLocationName;
        }

        setText(
            "mapRegion",
            locationName
        );

        setText(
            "mapLocationCoordinates",
            `${latitude.toFixed(6)}° N, ` +
            `${longitude.toFixed(6)}° E`
        );

        setText(
            "mapRisk",
            `${riskLevel} Risk Zone`
        );

        localStorage.setItem(
            "prediction_region",
            locationName
        );

        localStorage.setItem(
            "prediction_latitude",
            latitude
        );

        localStorage.setItem(
            "prediction_longitude",
            longitude
        );

    } catch (error) {
        console.error(
            "GIS error:",
            error
        );
    }
}


/* =========================================================
   REVERSE GEOCODING
   ========================================================= */

async function getLocationName(
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
                            "application/json"
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

        const area =
            address.city ||
            address.town ||
            address.municipality ||
            address.village ||
            address.county ||
            address.state_district ||
            "Selected Location";

        const state =
            address.state ||
            "";

        const country =
            address.country ||
            "";

        let result = area;

        if (
            state &&
            area !== state
        ) {
            result =
                `${area}, ${state}`;
        }

        if (
            country &&
            country.toLowerCase() === "india"
        ) {
            result =
                `${result}, India`;
        }

        return result;

    } catch (error) {
        console.warn(
            "Unable to determine location name:",
            error
        );

        return "Selected Location";
    }
}


/* =========================================================
   DISTANCE BETWEEN COORDINATES
   ========================================================= */

function distanceBetweenCoordinates(
    lat1,
    lon1,
    lat2,
    lon2
) {
    const earthRadiusKm = 6371;

    const dLat =
        degreesToRadians(lat2 - lat1);

    const dLon =
        degreesToRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(
            degreesToRadians(lat1)
        ) *
        Math.cos(
            degreesToRadians(lat2)
        ) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadiusKm * c;
}


function degreesToRadians(degrees) {
    return degrees *
        (Math.PI / 180);
}


/* =========================================================
   RISK LEVEL
   ========================================================= */

function calculateRiskLevel(
    riskScore
) {
    const score =
        Number(riskScore || 0);

    if (score >= 80) {
        return "CRITICAL";
    }

    if (score >= 60) {
        return "HIGH";
    }

    if (score >= 40) {
        return "MODERATE";
    }

    if (score >= 20) {
        return "LOW";
    }

    return "MINIMAL";
}


/* =========================================================
   SECTION NAVIGATION
   ========================================================= */

function scrollToSection(
    sectionId,
    button
) {
    const section =
        document.getElementById(
            sectionId
        );

    if (!section) {
        return;
    }

    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    document
        .querySelectorAll(
            ".sidebar .nav-item"
        )
        .forEach(
            item =>
                item.classList.remove(
                    "active"
                )
        );

    button?.classList.add(
        "active"
    );
}


/* =========================================================
   OPEN MAP
   ========================================================= */

async function openMap() {
    if (!latestPredictionId) {
        alert(
            "No prediction map is available yet."
        );

        return;
    }

    const token =
        localStorage.getItem(
            "access_token"
        );

    if (!token) {
        logout();
        return;
    }

    const mapWindow =
        window.open(
            "",
            "_blank"
        );

    if (!mapWindow) {
        alert(
            "Allow pop-ups to open the flood risk map."
        );

        return;
    }

    mapWindow.document.write(`
        <!doctype html>

        <html lang="en">

        <head>

            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            >

            <title>
                AquaSentinel AI | Flood Risk Map
            </title>

            <link
                rel="stylesheet"
                href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            >

            <style>

                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    font-family:
                        "Segoe UI",
                        sans-serif;
                    color: #1e293b;
                }

                header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 16px 22px;
                    border-bottom:
                        1px solid #e2e8f0;
                }

                header p {
                    margin: 4px 0 0;
                    color: #64748b;
                    font-size: 13px;
                }

                h1 {
                    margin: 0;
                    font-size: 20px;
                }

                #risk {
                    font-weight: 700;
                }

                #map {
                    width: 100%;
                    height:
                        calc(100vh - 112px);
                    min-height: 320px;
                }

                #status {
                    padding: 8px 22px;
                    color: #64748b;
                    font-size: 12px;
                }

            </style>

        </head>

        <body>

            <header>

                <div>

                    <h1 id="mapTitle">
                        Flood Risk Map
                    </h1>

                    <p id="mapSummary">
                        Loading prediction map...
                    </p>

                </div>

                <span id="risk"></span>

            </header>

            <div id="map"></div>

            <div id="status">
                Prototype zone estimate;
                not a parcel-level
                inundation boundary.
            </div>

        </body>

        </html>
    `);

    mapWindow.document.close();

    try {
        const response =
            await fetch(
                `${API_URL}/api/gis/flood-map/${latestPredictionId}`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "application/json"
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                `Map request failed: ${response.status}`
            );
        }

        const center =
            data.map?.center;

        const inundation =
            data.map?.inundation;

        const latitude =
            Number(
                center?.latitude
            );

        const longitude =
            Number(
                center?.longitude
            );

        const radiusKm =
            Number(
                inundation?.estimated_radius_km
            );

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            !Number.isFinite(radiusKm)
        ) {
            throw new Error(
                "The prediction did not include valid map coordinates."
            );
        }

        const riskLevel =
            String(
                inundation.risk_level ||
                data.risk_level ||
                "UNKNOWN"
            ).toUpperCase();

        let zoneName =
            data.region ||
            data.location ||
            data.map?.zone?.zone_name ||
            null;

        if (
            !zoneName ||
            zoneName === "Selected Location"
        ) {
            zoneName =
                await getLocationName(
                    latitude,
                    longitude
                );
        }

        const riskColors = {
            CRITICAL: "#dc2626",
            HIGH: "#ea580c",
            MODERATE: "#d97706",
            LOW: "#16a34a",
            MINIMAL: "#0284c7"
        };

        const color =
            riskColors[riskLevel] ||
            "#475569";

        const mapDocument =
            mapWindow.document;

        mapDocument.title =
            `AquaSentinel AI | ${zoneName}`;

        mapDocument
            .getElementById("mapTitle")
            .textContent =
            zoneName;

        mapDocument
            .getElementById("mapSummary")
            .textContent =
            `${data.scenario_name || "Prediction"} · ` +
            `${data.rainfall_mm ?? data.predicted_rainfall_mm ?? "--"} mm rainfall · ` +
            `${data.flood_probability ?? "--"}% flood probability`;

        mapDocument
            .getElementById("risk")
            .textContent =
            riskLevel;

        mapDocument
            .getElementById("risk")
            .style.color =
            color;

        mapDocument
            .getElementById("status")
            .textContent =
            `Location: ${zoneName} · ` +
            `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} · ` +
            `Estimated inundation radius: ${radiusKm.toFixed(2)} km. ` +
            `Prototype zone estimate; not a parcel-level boundary.`;

        const leafletScript =
            mapDocument.createElement(
                "script"
            );

        leafletScript.src =
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

        leafletScript.onload =
            () => {
                if (mapWindow.closed) {
                    return;
                }

                const map =
                    mapWindow.L
                        .map("map")
                        .setView(
                            [
                                latitude,
                                longitude
                            ],
                            12
                        );

                mapWindow.L
                    .tileLayer(
                        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        {
                            maxZoom: 19,

                            attribution:
                                "&copy; OpenStreetMap contributors"
                        }
                    )
                    .addTo(map);

                const zone =
                    mapWindow.L.circle(
                        [
                            latitude,
                            longitude
                        ],
                        {
                            radius:
                                radiusKm * 1000,

                            color:
                                color,

                            fillColor:
                                color,

                            fillOpacity:
                                0.25
                        }
                    )
                    .addTo(map);

                zone.bindPopup(
                    `${zoneName}: ${riskLevel} risk`
                ).openPopup();

                /*
                 * Show exact current location too,
                 * when browser location is available.
                 */
                if (currentLocation) {
                    const currentMarker =
                        mapWindow.L.marker([
                            currentLocation.latitude,
                            currentLocation.longitude
                        ])
                        .addTo(map);

                    currentMarker.bindPopup(
                        `<strong>Your Current Location</strong><br>` +
                        `${currentLocationName}<br>` +
                        `${currentLocation.latitude.toFixed(6)}, ` +
                        `${currentLocation.longitude.toFixed(6)}`
                    );
                }
            };

        leafletScript.onerror =
            () => {
                mapDocument
                    .getElementById(
                        "status"
                    )
                    .textContent =
                    "Map library could not load. Check your internet connection.";
            };

        mapDocument.head.appendChild(
            leafletScript
        );

    } catch (error) {
        mapWindow.document
            .getElementById(
                "status"
            )
            .textContent =
            `Unable to load flood map: ${error.message}`;
    }
}


/* =========================================================
   WEATHER STYLES
   ========================================================= */

function injectWeatherStyles() {
    if (
        document.getElementById(
            "aquaWeatherStyles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "aquaWeatherStyles";

    style.textContent = `
        .aqua-current-weather-panel {
            margin-bottom: 24px;
        }

        .weather-info-box {
            background:
                linear-gradient(
                    135deg,
                    #ffffff,
                    #f8fafc
                );

            border:
                1px solid #e2e8f0;

            border-radius: 14px;

            padding: 16px;

            min-height: 86px;

            display: flex;

            flex-direction: column;

            justify-content: center;

            gap: 7px;

            box-shadow:
                0 4px 12px
                rgba(15, 23, 42, 0.04);
        }

        .weather-info-box small {
            color: #64748b;

            font-size: 12px;

            font-weight: 600;

            text-transform: uppercase;

            letter-spacing: .04em;
        }

        .weather-info-box strong {
            color: #0f172a;

            font-size: 18px;

            line-height: 1.25;
        }

        #currentLocationName {
            color: #2563eb;
        }

        #locationStatus {
            margin-top: 5px;
        }
    `;

    document.head.appendChild(style);
}


/* =========================================================
   WEATHER TIME
   ========================================================= */

function formatWeatherTime(timezone) {
    try {
        return new Intl.DateTimeFormat(
            "en-IN",
            {
                timeZone:
                    timezone || undefined,

                hour: "2-digit",

                minute: "2-digit",

                hour12: true
            }
        ).format(
            new Date()
        );
    } catch {
        return new Date()
            .toLocaleTimeString();
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
   SET TEXT
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

    localStorage.removeItem(
        "prediction_region"
    );

    localStorage.removeItem(
        "prediction_latitude"
    );

    localStorage.removeItem(
        "prediction_longitude"
    );

    localStorage.removeItem(
        "current_latitude"
    );

    localStorage.removeItem(
        "current_longitude"
    );

    localStorage.removeItem(
        "current_location_name"
    );

    localStorage.removeItem(
        "aqua_current_location"
    );

    window.location.href =
        "/templates/login.html";
}


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState === "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        loadDashboard
    );
} else {
    loadDashboard();
}