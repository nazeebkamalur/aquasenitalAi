// ============================================================
// AQUASENTINEL AI
// ADMIN DASHBOARD
// DYNAMIC GIS + REAL API CONNECTION
// ============================================================

const API_URL = "http://127.0.0.1:8000";

let selectedMode = "SEEDED";
let selectedScenario = null;
let scenarios = [];
let selectedMapLocation = null;


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    const token = localStorage.getItem("access_token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Load user profile
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
        try {

            const user = JSON.parse(storedUser);

            const profile =
                document.getElementById("profileName");

            if (profile) {
                profile.textContent =
                    user.name || "Administrator";
            }

        } catch (error) {

            console.error(
                "Unable to read user:",
                error
            );

        }
    }


    // Verify admin access
    try {

        const response = await fetch(
            `${API_URL}/api/admin/dashboard`,
            {
                method: "GET",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            logout();
            return;

        }


        if (!response.ok) {

            throw new Error(
                `Admin dashboard error: ${response.status}`
            );

        }

        const dashboardData = await response.json();

        updateAdminDashboard(dashboardData);

    } catch (error) {

        console.error(
            "Dashboard connection error:",
            error
        );

        showMessage(
            "⚠️ Unable to connect to AquaSentinel backend.",
            "error"
        );

    }


    // Load seeded scenarios
    await loadScenarios();

}


function updateAdminDashboard(data) {

    const latest = data.latest_prediction;
    const statCards = document.querySelectorAll(".stats-grid .stat-card");

    if (!latest || statCards.length < 3) {
        return;
    }

    const values = [
        `${Number(latest.rainfall_mm ?? 0).toFixed(2)} mm`,
        `${Number(latest.flood_probability ?? 0).toFixed(2)}%`,
        String(latest.risk_level ?? "NO DATA").toUpperCase()
    ];

    values.forEach((value, index) => {
        const element = statCards[index]?.querySelector("strong");

        if (element) {
            element.textContent = value;
        }
    });

    const infrastructure = statCards[3]?.querySelector("strong");

    if (infrastructure) {
        infrastructure.textContent =
            `${data.statistics?.total_predictions ?? 0}`;
    }
}


// ============================================================
// LOAD SEEDED SCENARIOS
// ============================================================

async function loadScenarios() {

    const token =
        localStorage.getItem("access_token");


    if (!token) {

        logout();
        return;

    }


    try {

        showMessage(
            "Loading available AI scenarios...",
            "loading"
        );


        const response =
            await fetch(
                `${API_URL}/api/prediction/scenarios`,
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


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            showMessage(
                "⚠️ Admin authorization expired. Please login again.",
                "error"
            );

            setTimeout(
                logout,
                1500
            );

            return;

        }


        if (!response.ok) {

            throw new Error(
                `Scenario API error: ${response.status}`
            );

        }


        const data =
            await response.json();


        scenarios =
            data.scenarios || [];


        console.log(
            "Loaded scenarios:",
            scenarios
        );


        createScenarioSelector();


        showMessage(
            `${scenarios.length} seeded scenarios loaded.`,
            "success"
        );


    } catch (error) {

        console.error(
            "Scenario loading error:",
            error
        );


        showMessage(
            "⚠️ Failed to load seeded scenarios.",
            "error"
        );

    }

}


// ============================================================
// CREATE SCENARIO SELECTOR
// ============================================================

function createScenarioSelector() {

    const predictionPanel =
        document.getElementById("predictionEngine") ||
        document.querySelector(".panel.large");


    if (!predictionPanel) {
        return;
    }


    if (
        document.getElementById(
            "scenarioSelectorContainer"
        )
    ) {

        return;

    }


    const pipeline =
        predictionPanel.querySelector(".pipeline");


    if (!pipeline) {
        return;
    }


    const container =
        document.createElement("div");


    container.id =
        "scenarioSelectorContainer";


    container.className =
        "scenario-selector-container";


    container.innerHTML = `

        <label
            for="scenarioSelector"
            class="scenario-label"
        >
            🌧️ Select Rainfall Scenario
        </label>


        <select
            id="scenarioSelector"
            class="scenario-selector"
        >

            <option value="">
                Select a scenario...
            </option>

        </select>


        <div
            id="scenarioDetails"
            class="scenario-details"
        ></div>

    `;


    pipeline.parentNode.insertBefore(
        container,
        pipeline
    );


    const selector =
        document.getElementById(
            "scenarioSelector"
        );


    scenarios.forEach(
        scenario => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                scenario.scenario_id;


            option.textContent =
                `${scenario.scenario_name} — ${scenario.rainfall_24h} mm / 24h`;


            selector.appendChild(
                option
            );

        }
    );


    selector.addEventListener(
        "change",
        handleScenarioChange
    );

}


// ============================================================
// SCENARIO CHANGE
// ============================================================

function handleScenarioChange(event) {

    const scenarioId =
        Number(event.target.value);


    selectedScenario =
        scenarios.find(
            scenario =>
                scenario.scenario_id ===
                scenarioId
        );


    const details =
        document.getElementById(
            "scenarioDetails"
        );


    if (!selectedScenario) {

        if (details) {
            details.innerHTML = "";
        }

        return;

    }


    if (details) {

        details.innerHTML = `

            <div class="scenario-info">

                <strong>
                    ${selectedScenario.scenario_name}
                </strong>


                <span>
                    Rainfall:
                    ${selectedScenario.rainfall_24h} mm
                </span>


                <span>
                    Humidity:
                    ${selectedScenario.humidity}%
                </span>


                <span>
                    Soil Moisture:
                    ${selectedScenario.soil_moisture}%
                </span>


                <span>
                    River Level:
                    ${selectedScenario.river_level}%
                </span>


                <span>
                    Drainage Capacity:
                    ${selectedScenario.drainage_capacity}%
                </span>

            </div>

        `;

    }


    showMessage(
        `${selectedScenario.scenario_name} selected.`,
        "success"
    );

}


// ============================================================
// SELECT MODE
// ============================================================

function selectMode(mode) {
    selectedMode = mode;

    const seededButton = document.getElementById("seededModeButton");
    const dynamicButton = document.getElementById("dynamicModeButton");
    const seededControls = document.getElementById("seededControls");
    const dynamicControls = document.getElementById("dynamicControls");
    const scenarioControls = document.getElementById("scenarioSelectorContainer");

    seededButton?.classList.toggle("active-mode", mode === "SEEDED");
    dynamicButton?.classList.toggle("active-mode", mode === "DYNAMIC");
    seededControls?.style.setProperty("display", mode === "SEEDED" ? "block" : "none");
    dynamicControls?.style.setProperty("display", mode === "DYNAMIC" ? "block" : "none");

    if (scenarioControls) {
        scenarioControls.style.display = mode === "SEEDED" ? "block" : "none";
    }

    showMessage(
        mode === "SEEDED"
            ? "🧪 Seeded mode selected. Choose a rainfall scenario."
            : "🌐 Dynamic mode selected. Click any location on the GIS map.",
        mode === "SEEDED" ? "success" : "loading"
    );
}


// ============================================================
// CREATE DYNAMIC LOCATION CONTROLS
// ============================================================

function createDynamicLocationControls() {

    const predictionPanel =
        document.getElementById("predictionEngine") ||
        document.querySelector(".panel.large");


    if (!predictionPanel) {
        return;
    }


    let container =
        document.getElementById(
            "dynamicLocationControls"
        );


    if (!container) {

        const pipeline =
            predictionPanel.querySelector(
                ".pipeline"
            );


        if (!pipeline) {
            return;
        }


        container =
            document.createElement(
                "div"
            );


        container.id =
            "dynamicLocationControls";


        container.className =
            "dynamic-location-controls";


        container.innerHTML = `

            <div class="scenario-info">

                <strong>
                    🌐 Live Location Prediction
                </strong>


                <span>
                    Click anywhere on the GIS map
                    to select a location.
                </span>


                <span>
                    Latitude:
                    <strong id="selectedLatitude">
                        Not selected
                    </strong>
                </span>


                <span>
                    Longitude:
                    <strong id="selectedLongitude">
                        Not selected
                    </strong>
                </span>


                <span>
                    Location:
                    <strong id="selectedLocationName">
                        Not selected
                    </strong>
                </span>

            </div>


            <button
                type="button"
                class="run-button"
                id="predictSelectedLocationButton"
                onclick="runPrediction()"
            >
                🌐 Predict Selected Location
            </button>

        `;


        pipeline.parentNode.insertBefore(
            container,
            pipeline
        );

    }


    container.style.display =
        "block";


    updateSelectedLocationUI();

}


// ============================================================
// UPDATE SELECTED LOCATION UI
// ============================================================

function updateSelectedLocationUI() {

    const latitudeElement =
        document.getElementById(
            "selectedLatitude"
        );


    const longitudeElement =
        document.getElementById(
            "selectedLongitude"
        );


    const nameElement =
        document.getElementById(
            "selectedLocationName"
        );


    if (!selectedMapLocation) {

        if (latitudeElement) {

            latitudeElement.textContent =
                "Not selected";

        }


        if (longitudeElement) {

            longitudeElement.textContent =
                "Not selected";

        }


        if (nameElement) {

            nameElement.textContent =
                "Not selected";

        }


        return;

    }


    if (latitudeElement) {

        latitudeElement.textContent =
            selectedMapLocation.latitude;

    }


    if (longitudeElement) {

        longitudeElement.textContent =
            selectedMapLocation.longitude;

    }


    if (nameElement) {

        nameElement.textContent =
            selectedMapLocation.region ||
            "Selected Location";

    }

}


// ============================================================
// MAP LOCATION SELECTED
// ============================================================

document.addEventListener(
    "aqua-location-selected",
    function(event) {

        if (!event.detail) {
            return;
        }


        selectedMapLocation = {

            latitude:
                Number(
                    event.detail.latitude
                ),

            longitude:
                Number(
                    event.detail.longitude
                ),

            region:
                event.detail.region ||
                "Selected Location"

        };


        console.log(
            "Selected map location:",
            selectedMapLocation
        );


        updateSelectedLocationUI();


        if (
            selectedMode ===
            "DYNAMIC"
        ) {

            showMessage(
                `📍 Location selected: ${selectedMapLocation.latitude}, ${selectedMapLocation.longitude}. Click Predict Selected Location.`,
                "success"
            );

        }

    }
);


// ============================================================
// MAP PREDICTION REQUEST
// ============================================================

document.addEventListener(
    "aqua-run-location-prediction",
    function(event) {

        if (event.detail) {

            selectedMapLocation = {

                latitude:
                    Number(
                        event.detail.latitude
                    ),

                longitude:
                    Number(
                        event.detail.longitude
                    ),

                region:
                    event.detail.region ||
                    "Selected Location"

            };

        }


        selectedMode =
            "DYNAMIC";


        selectMode(
            "DYNAMIC"
        );


        runPrediction();

    }
);


// ============================================================
// RUN AI PREDICTION
// ============================================================

async function runPrediction() {

    const token =
        localStorage.getItem(
            "access_token"
        );


    if (!token) {

        logout();
        return;

    }


    // ========================================================
    // DYNAMIC PREDICTION
    // ========================================================

    if (
        selectedMode ===
        "DYNAMIC"
    ) {

        const latitudeInput = document.getElementById("dynamicLatitude");
        const longitudeInput = document.getElementById("dynamicLongitude");
        const regionInput = document.getElementById("dynamicRegion");

        if (latitudeInput?.value && longitudeInput?.value) {
            selectedMapLocation = {
                latitude: Number(latitudeInput.value),
                longitude: Number(longitudeInput.value),
                region: regionInput?.value.trim() || "Selected Location"
            };
        }

        if (!selectedMapLocation) {

            showMessage(
                "⚠️ Please click a location on the GIS map first.",
                "error"
            );

            return;

        }


        const latitude =
            Number(
                selectedMapLocation.latitude
            );


        const longitude =
            Number(
                selectedMapLocation.longitude
            );


        if (
            !Number.isFinite(
                latitude
            ) ||
            !Number.isFinite(
                longitude
            )
        ) {

            showMessage(
                "⚠️ Invalid map coordinates.",
                "error"
            );

            return;

        }


        const button =
            document.getElementById("dynamicPredictionButton") ||
            document.getElementById("predictSelectedLocationButton");


        if (button) {

            button.disabled =
                true;

            button.textContent =
                "⏳ Running Live Prediction...";

        }


        try {

            showMessage(
                `🌐 Fetching live weather and satellite data for ${latitude}, ${longitude}...`,
                "loading"
            );


            await animatePipeline();


            const response =
                await fetch(
                    `${API_URL}/api/dynamic/predict`,
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

                        body:
                            JSON.stringify({

                                region:
                                    selectedMapLocation.region ||
                                    "Selected Location",

                                latitude:
                                    latitude,

                                longitude:
                                    longitude

                            })

                    }
                );


            if (
                response.status === 401 ||
                response.status === 403
            ) {

                showMessage(
                    "⚠️ Admin authorization expired. Please login again.",
                    "error"
                );


                setTimeout(
                    logout,
                    1500
                );


                return;

            }


            const data =
                await response.json();


            console.log(
                "Dynamic prediction API response:",
                data
            );


            if (!response.ok) {

                let errorMessage =
                    `Dynamic prediction API error: ${response.status}`;


                if (data.detail) {

                    if (
                        typeof data.detail ===
                        "string"
                    ) {

                        errorMessage =
                            data.detail;

                    } else {

                        errorMessage =
                            JSON.stringify(
                                data.detail
                            );

                    }

                }


                throw new Error(
                    errorMessage
                );

            }


            const result =
                data.prediction ||
                data.result;


            if (!result) {

                throw new Error(
                    "Prediction result was not returned by the backend."
                );

            }


            displayDynamicPredictionResult(
                result,
                data
            );


            showMessage(
                "✓ Live dynamic prediction completed successfully.",
                "success"
            );


        } catch (error) {

            console.error(
                "Dynamic prediction error:",
                error
            );


            showMessage(
                `❌ Dynamic prediction failed: ${error.message}`,
                "error"
            );


        } finally {

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "🌐 Predict Selected Location";

            }

        }


        return;

    }


    // ========================================================
    // SEEDED PREDICTION
    // ========================================================

    if (!selectedScenario) {

        showMessage(
            "⚠️ Please select a rainfall scenario first.",
            "error"
        );

        return;

    }


    const button =
        document.querySelector(
            ".run-button"
        );


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "⏳ Running AI Prediction...";

    }


    try {

        showMessage(
            `🤖 Running AI prediction for ${selectedScenario.scenario_name}...`,
            "loading"
        );


        await animatePipeline();


        const response =
            await fetch(
                `${API_URL}/api/prediction/seeded`,
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

                    body:
                        JSON.stringify({

                            scenario_id:
                                selectedScenario.scenario_id

                        })

                }
            );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            showMessage(
                "⚠️ Admin authorization expired. Please login again.",
                "error"
            );


            setTimeout(
                logout,
                1500
            );


            return;

        }


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                `Prediction API error: ${response.status}`
            );

        }


        displayPredictionResult(
            data.result
        );


        showMessage(
            "✓ AI prediction completed successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Prediction error:",
            error
        );


        showMessage(
            `❌ Prediction failed: ${error.message}`,
            "error"
        );


    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "▶ Run AI Prediction";

        }

    }

}


// ============================================================
// DISPLAY DYNAMIC RESULT
// ============================================================

function displayDynamicPredictionResult(
    result,
    fullData
) {

    if (!result) {

        console.error(
            "No dynamic prediction result:",
            fullData
        );

        return;

    }


    let resultContainer =
        document.getElementById(
            "predictionResult"
        );


    if (!resultContainer) {

        const panel =
            document.getElementById("predictionEngine") ||
            document.querySelector(".panel.large");


        if (!panel) {
            return;
        }


        resultContainer =
            document.createElement(
                "div"
            );


        resultContainer.id =
            "predictionResult";


        resultContainer.className =
            "prediction-result";


        panel.appendChild(
            resultContainer
        );

    }


    const risk =
        String(
            result.risk_level ||
            "UNKNOWN"
        ).toLowerCase();


    const region =
        fullData.region ||
        "Selected Location";


    const latitude =
        fullData.location?.latitude ??
        fullData.latitude ??
        selectedMapLocation?.latitude ??
        "-";


    const longitude =
        fullData.location?.longitude ??
        fullData.longitude ??
        selectedMapLocation?.longitude ??
        "-";


    const weatherProvider =
        fullData.data_sources?.weather?.provider ||
        "Open-Meteo";


    const satelliteProvider =
        fullData.data_sources?.satellite?.provider ||
        "NASA GPM IMERG";


    const satelliteStatus =
        fullData.data_sources?.satellite?.status ||
        "LIVE";


    resultContainer.innerHTML = `

        <div class="result-header">

            <div>

                <span class="eyebrow">
                    LIVE AI PREDICTION
                </span>


                <h3>
                    ${region}
                </h3>


                <small>
                    📍 ${latitude},
                    ${longitude}
                </small>

            </div>


            <span
                class="risk-badge risk-${risk}"
            >
                ${result.risk_level || "UNKNOWN"}
            </span>

        </div>


        <div class="result-grid">

            <div class="result-card">

                <span>
                    🌧️ Predicted Rainfall
                </span>

                <strong>
                    ${result.predicted_rainfall_mm ?? "-"}
                    <small>mm</small>
                </strong>

            </div>


            <div class="result-card">

                <span>
                    🌊 Flood Probability
                </span>

                <strong>
                    ${result.flood_probability ?? "-"}
                    <small>%</small>
                </strong>

            </div>


            <div class="result-card">

                <span>
                    🗺️ Inundation Area
                </span>

                <strong>
                    ${result.inundation_area_km2 ?? "-"}
                    <small>km²</small>
                </strong>

            </div>


            <div class="result-card">

                <span>
                    📊 Risk Score
                </span>

                <strong>
                    ${result.risk_score ?? "-"}
                    <small>/100</small>
                </strong>

            </div>


            <div class="result-card">

                <span>
                    🎯 Confidence
                </span>

                <strong>
                    ${result.confidence ?? "-"}
                    <small>%</small>
                </strong>

            </div>


            <div class="result-card">

                <span>
                    🆔 Prediction ID
                </span>

                <strong>
                    ${fullData.prediction_id ?? "-"}
                </strong>

            </div>

        </div>


        <div class="scenario-info">

            <strong>
                Live Data Sources
            </strong>


            <span>
                🌦️ Weather:
                ${weatherProvider}
            </span>


            <span>
                🛰️ Satellite:
                ${satelliteProvider}
            </span>


            <span>
                📡 Satellite Status:
                ${satelliteStatus}
            </span>


            <span>
                🗺️ Location:
                ${region}
            </span>

        </div>

    `;


    resultContainer.classList.add("active");

    resultContainer.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}


// ============================================================
// DISPLAY SEEDED RESULT
// ============================================================

function displayPredictionResult(
    result
) {

    if (!result) {
        return;
    }


    let resultContainer =
        document.getElementById(
            "predictionResult"
        );


    if (!resultContainer) {

        const panel =
            document.getElementById("predictionEngine") ||
            document.querySelector(".panel.large");


        if (!panel) {
            return;
        }


        resultContainer =
            document.createElement(
                "div"
            );


        resultContainer.id =
            "predictionResult";


        resultContainer.className =
            "prediction-result";


        panel.appendChild(
            resultContainer
        );

    }


    const risk =
        String(
            result.risk_level ||
            "UNKNOWN"
        ).toLowerCase();


    resultContainer.innerHTML = `

        <div class="result-header">

            <div>

                <span class="eyebrow">
                    SEEDED AI PREDICTION
                </span>


                <h3>
                    ${result.scenario_name}
                </h3>

            </div>


            <span
                class="risk-badge risk-${risk}"
            >
                ${result.risk_level}
            </span>

        </div>


        <div class="result-grid">

            <div class="result-card">

                <span>
                    🌧️ Predicted Rainfall
                </span>

                <strong>
                    ${result.predicted_rainfall_mm}
                    <small>mm</small>
                </strong>

            </div>


            <div class="result-card">

                <span>
                    🌊 Flood Probability
                </span>

                <strong>
                    ${result.flood_probability}
                    <small>%</small>
                </strong>

            </div>


            <div class="result-card">

                <span>
                    🗺️ Inundation Area
                </span>

                <strong>
                    ${result.inundation_area_km2}
                    <small>km²</small>
                </strong>

            </div>


            <div class="result-card">

                <span>
                    📊 Risk Score
                </span>

                <strong>
                    ${result.risk_score}
                    <small>/100</small>
                </strong>

            </div>


            <div class="result-card">

                <span>
                    🎯 Confidence
                </span>

                <strong>
                    ${result.confidence}
                    <small>%</small>
                </strong>

            </div>

        </div>

    `;


    resultContainer.classList.add("active");

    resultContainer.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}


// ============================================================
// PIPELINE ANIMATION
// ============================================================

async function animatePipeline() {

    const steps =
        document.querySelectorAll(
            ".pipeline-step"
        );


    steps.forEach(
        step => {

            step.classList.remove(
                "active"
            );

        }
    );


    for (
        let i = 0;
        i < steps.length;
        i++
    ) {

        steps[i].classList.add(
            "active"
        );


        await sleep(300);

    }

}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(
    message,
    type = "success"
) {

    const element =
        document.getElementById(
            "predictionMessage"
        );


    if (!element) {

        console.log(
            message
        );

        return;

    }


    element.textContent =
        message;


    element.className =
        `prediction-message ${type}`;

}


// ============================================================
// SLEEP
// ============================================================

function sleep(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    localStorage.removeItem(
        "access_token"
    );


    localStorage.removeItem(
        "user"
    );


    window.location.href =
        "login.html";

}


window.loadDashboard = loadDashboard;
window.selectMode = selectMode;
window.runPrediction = runPrediction;
window.logout = logout;


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        loadDashboard();

    }
);