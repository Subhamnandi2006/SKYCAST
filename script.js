const BACKEND_URL = "https://skycast-backend-qkkk.onrender.com/";

/* ==========================================
   SKYCAST - REAL WEATHER API INTEGRATION
   Provider: Open-Meteo
========================================== */

const GEOCODING_API =
    "https://geocoding-api.open-meteo.com/v1/search";

const WEATHER_API =
    "https://api.open-meteo.com/v1/forecast";

const AIR_QUALITY_API =
    "https://air-quality-api.open-meteo.com/v1/air-quality";

let currentCity = "Kolkata";
let currentLocation = {
    latitude: 22.57,
    longitude: 88.36,
    name: "Kolkata",
    country: "India"
};

let isCelsius = true;
let temperatureChart = null;
let weatherCache = null;


// ==========================================
// 1. WEATHER CONDITION MAPPING
// ==========================================

function getWeatherInfo(code, isDay = true) {

    const conditions = {
        0: ["Clear Sky", isDay ? "sun" : "moon"],
        1: ["Mainly Clear", isDay ? "sun" : "moon"],
        2: ["Partly Cloudy", "cloud-sun"],
        3: ["Overcast", "cloud"],
        45: ["Fog", "cloud-fog"],
        48: ["Rime Fog", "cloud-fog"],
        51: ["Light Drizzle", "cloud-drizzle"],
        53: ["Drizzle", "cloud-drizzle"],
        55: ["Heavy Drizzle", "cloud-drizzle"],
        61: ["Light Rain", "cloud-rain"],
        63: ["Moderate Rain", "cloud-rain"],
        65: ["Heavy Rain", "cloud-rain"],
        71: ["Light Snow", "cloud-snow"],
        73: ["Snow", "cloud-snow"],
        75: ["Heavy Snow", "cloud-snow"],
        80: ["Rain Showers", "cloud-rain"],
        81: ["Moderate Showers", "cloud-rain"],
        82: ["Heavy Showers", "cloud-rain"],
        95: ["Thunderstorm", "cloud-lightning"],
        96: ["Thunderstorm with Hail", "cloud-lightning"],
        99: ["Heavy Thunderstorm", "cloud-lightning"]
    };

    return conditions[code] || ["Unknown", "cloud"];
}


// ==========================================
// 2. TEMPERATURE CONVERSION
// ==========================================

function convertTemperature(temp) {

    if (temp === null || temp === undefined) {
        return "--";
    }

    const value = isCelsius
        ? temp
        : (temp * 9 / 5) + 32;

    return Math.round(value) + "°";

}


// ==========================================
// 3. API REQUEST HANDLER
// ==========================================

async function fetchJSON(url) {

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(data.reason || "Weather API failed");
    }

    return data;

}



async function loadAirQuality(lat, lon) {
    try {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon
        });

        // Request AQI from our own backend
        const data = await fetchJSON(
            `http://localhost:5000/api/air-quality?${params.toString()}`
        );

        // Extract the actual Open-Meteo air-quality data
        const air = data.airQuality.current;

        const aqi = air.us_aqi;
        const pm25 = air.pm2_5;
        const pm10 = air.pm10;

        let status = "Unknown";

        if (aqi !== null && aqi !== undefined) {
            if (aqi <= 50) {
                status = "Good";
            } else if (aqi <= 100) {
                status = "Moderate";
            } else if (aqi <= 150) {
                status = "Unhealthy for sensitive groups";
            } else if (aqi <= 200) {
                status = "Unhealthy";
            } else if (aqi <= 300) {
                status = "Very Unhealthy";
            } else {
                status = "Hazardous";
            }
        }

        const aqiElement = document.getElementById("aqi");

        if (aqiElement) {
            aqiElement.textContent = aqi ?? "--";

            const description = aqiElement.nextElementSibling;

            if (description) {
                description.textContent =
                    `US AQI: ${status} | PM2.5: ${pm25 ?? "--"} µg/m³ | PM10: ${pm10 ?? "--"} µg/m³`;
            }
        }

        console.log("Air quality data:", air);

    } catch (error) {
        console.error("Air quality error:", error);

        const aqiElement = document.getElementById("aqi");

        if (aqiElement) {
            aqiElement.textContent = "--";

            const description = aqiElement.nextElementSibling;

            if (description) {
                description.textContent =
                    "Air quality data currently unavailable";
            }
        }
    }
}




// ==========================================
// 4. SEARCH CITY USING GEOCODING API
// ==========================================

async function searchCity(city) {

    if (!city.trim()) {
        alert("Please enter a city name.");
        return;
    }

    const searchBtn = document.getElementById("searchBtn");

    searchBtn.disabled = true;
    searchBtn.textContent = "Searching...";

    try {

        const data = await fetchJSON(
            `http://localhost:5000/api/geocoding?city=${encodeURIComponent(city)}`
        );

        if (!data.results || data.results.length === 0) {
            throw new Error("City not found. Try another city.");
        }

        // Select the first matching location.
        const location = data.results[0];

        currentCity = location.name;

        currentLocation = {
            latitude: location.latitude,
            longitude: location.longitude,
            name: location.name,
            country: location.country || ""
        };

        await loadWeather(
            currentLocation.latitude,
            currentLocation.longitude
        );

        document.getElementById("cityInput").value = "";

    } catch (error) {

        alert(error.message);

        console.error("City search error:", error);

    } finally {

        searchBtn.disabled = false;
        searchBtn.textContent = "Search";

    }

}


// ==========================================
// 5. FETCH WEATHER DATA
// ==========================================


async function loadWeather(latitude, longitude) {
    try {
        showLoading(true);

        const params = new URLSearchParams({
            latitude,
            longitude
        });

        // Request weather from our own backend
        const data = await fetchJSON(
            `http://localhost:5000/api/weather?${params.toString()}`
        );

        // Backend wraps the Open-Meteo response in "weather"
        weatherCache = data.weather;

        updateDashboard(weatherCache);

        // Load AQI through our backend too
        await loadAirQuality(latitude, longitude);

    } catch (error) {
        console.error("Weather fetching error:", error);

        alert(
            "Unable to load weather information. " +
            "Please check your backend server and internet connection."
        );

    } finally {
        showLoading(false);
    }
}



// ==========================================
// 6. LOADING STATE
// ==========================================

function showLoading(isLoading) {

    const cityName = document.getElementById("cityName");

    if (isLoading) {
        cityName.textContent = "Loading weather...";
    }

}


// ==========================================
// 7. UPDATE COMPLETE DASHBOARD
// ==========================================

function updateDashboard(data) {

    const current = data.current;
    const hourly = data.hourly;
    const daily = data.daily;

    const location = currentLocation;

    document.getElementById("cityName").textContent =
        `${location.name}, ${location.country}`;

    document.getElementById("currentDate").textContent =
        new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

    document.getElementById("temperature").textContent =
        convertTemperature(current.temperature_2m);

    document.getElementById("feelsLike").textContent =
        convertTemperature(current.apparent_temperature);

    const weather = getWeatherInfo(
        current.weather_code,
        current.is_day === 1
    );

    document.getElementById("weatherDescription").textContent =
        weather[0];

    document.getElementById("maxTemp").textContent =
        convertTemperature(daily.temperature_2m_max[0]);

    document.getElementById("minTemp").textContent =
        convertTemperature(daily.temperature_2m_min[0]);


    // Weather highlights

    document.getElementById("humidity").textContent =
        current.relative_humidity_2m + "%";

    document.getElementById("windSpeed").textContent =
        Math.round(current.wind_speed_10m) + " km/h";

    document.getElementById("pressure").textContent =
        Math.round(current.pressure_msl) + " hPa";

    document.getElementById("visibility").textContent =
        (current.visibility / 1000).toFixed(1) + " km";


    // UV index: nearest hourly reading

    const hourIndex = getCurrentHourIndex(hourly.time);

    const uv = hourly.uv_index[hourIndex];

    document.getElementById("uvIndex").textContent =
        uv !== undefined ? uv.toFixed(1) : "--";



    // Update weather icons

    document.querySelector(".weather-circle").innerHTML =
        `<i data-lucide="${weather[1]}"></i>`;

    document.querySelector(".main-weather-icon").innerHTML =
        `<i data-lucide="${weather[1]}"></i>`;


    // Update all forecasts

    generateHourlyForecast(hourly);

    generateWeeklyForecast(daily);

    generateTemperatureChart(hourly);

    lucide.createIcons();

}


// ==========================================
// 8. FIND CURRENT HOURLY INDEX
// ==========================================

function getCurrentHourIndex(times) {

    const now = new Date();

    let index = times.findIndex(time => {
        return new Date(time) >= now;
    });

    return index === -1 ? 0 : index;

}


// ==========================================
// 9. HOURLY FORECAST
// ==========================================

function generateHourlyForecast(hourly) {

    const container =
        document.getElementById("hourlyForecast");

    container.innerHTML = "";

    const startIndex = getCurrentHourIndex(hourly.time);

    for (
        let i = startIndex;
        i < Math.min(startIndex + 6, hourly.time.length);
        i++
    ) {

        const date = new Date(hourly.time[i]);

        const timeLabel = i === startIndex
            ? "Now"
            : date.toLocaleTimeString("en-IN", {
                hour: "numeric",
                hour12: true
            });

        const weather = getWeatherInfo(
            hourly.weather_code[i]
        );

        const temperature = convertTemperature(
            hourly.temperature_2m[i]
        );

        const rain = hourly.precipitation_probability[i];

        const card = document.createElement("div");

        card.className = "hour-card";

        card.innerHTML = `
            <p>${timeLabel}</p>

            <i data-lucide="${weather[1]}"></i>

            <h3>${temperature}</h3>

            <p style="margin-top:9px">
                ${rain ?? "--"}% rain
            </p>
        `;

        container.appendChild(card);

    }

    lucide.createIcons();

}


// ==========================================
// 10. WEEKLY FORECAST
// ==========================================

function generateWeeklyForecast(daily) {

    const container =
        document.getElementById("weeklyForecast");

    container.innerHTML = "";

    daily.time.forEach((date, index) => {

        const day = index === 0
            ? "Today"
            : new Date(date + "T12:00:00").toLocaleDateString(
                "en-IN",
                { weekday: "long" }
            );

        const weather = getWeatherInfo(
            daily.weather_code[index]
        );

        const high = convertTemperature(
            daily.temperature_2m_max[index]
        );

        const low = convertTemperature(
            daily.temperature_2m_min[index]
        );

        const rain =
            daily.precipitation_probability_max[index];

        const row = document.createElement("div");

        row.className = "week-row";

        row.innerHTML = `
            <span>${day}</span>

            <div class="week-condition">
                <i data-lucide="${weather[1]}"></i>
                ${weather[0]}
            </div>

            <span class="week-temp">
                ${high}
                <span>${low}</span>
            </span>

            <span style="text-align:right;color:#91a0b8">
                ${rain ?? "--"}% rain
            </span>
        `;

        container.appendChild(row);

    });

    lucide.createIcons();

}


// ==========================================
// 11. TEMPERATURE CHART
// ==========================================

function generateTemperatureChart(hourly) {

    const canvas =
        document.getElementById("temperatureChart");

    if (temperatureChart) {
        temperatureChart.destroy();
    }

    const startIndex = getCurrentHourIndex(hourly.time);

    const labels = [];
    const temperatures = [];

    for (
        let i = startIndex;
        i < Math.min(startIndex + 12, hourly.time.length);
        i++
    ) {

        labels.push(
            new Date(hourly.time[i]).toLocaleTimeString(
                "en-IN",
                { hour: "numeric", hour12: true }
            )
        );

        const temp = hourly.temperature_2m[i];

        temperatures.push(
            isCelsius
                ? Math.round(temp)
                : Math.round(temp * 9 / 5 + 32)
        );

    }

    temperatureChart = new Chart(canvas, {

        type: "line",

        data: {

            labels,

            datasets: [{

                label: "Temperature",

                data: temperatures,

                borderColor: "#70b5ff",

                backgroundColor: "rgba(112,181,255,0.12)",

                fill: true,

                tension: 0.4,

                borderWidth: 3,

                pointRadius: 3

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {

                x: {
                    ticks: { color: "#91a0b8" },
                    grid: { color: "rgba(255,255,255,0.04)" }
                },

                y: {
                    ticks: {
                        color: "#91a0b8",
                        callback: value => value + "°"
                    },
                    grid: { color: "rgba(255,255,255,0.05)" }
                }

            }

        }

    });

}


async function loadFavorites() {
    try {
        const response = await fetch(
            `${BACKEND_URL}/api/favorites`
        );

        if (!response.ok) {
            throw new Error("Unable to load favourites");
        }

        const data = await response.json();

        const container = document.getElementById("favoriteList");

        container.innerHTML = "";

        if (data.favorites.length === 0) {
            container.textContent = "No favourite cities yet.";
            container.className = "empty-favorites";
            return;
        }

        container.className = "";

        data.favorites.forEach(favorite => {
            const cityRow = document.createElement("div");
            cityRow.className = "favorite-city";

            const cityButton = document.createElement("button");
            cityButton.className = "location-item city-name";
            cityButton.textContent = favorite.city;

            if (favorite.country) {
                cityButton.title = favorite.country;
            }

            cityButton.addEventListener("click", async () => {
                currentCity = favorite.city;

                currentLocation = {
                    latitude: favorite.latitude,
                    longitude: favorite.longitude,
                    name: favorite.city,
                    country: favorite.country || ""
                };

                await loadWeather(
                    favorite.latitude,
                    favorite.longitude
                );
            });

            const deleteButton = document.createElement("button");
            deleteButton.className = "remove-favorite";
            deleteButton.innerHTML = '<i data-lucide="trash-2"></i>';
            deleteButton.title = "Remove favourite";

            deleteButton.addEventListener("click", async () => {
                await deleteFavorite(favorite._id);
            });

            cityRow.appendChild(cityButton);
            cityRow.appendChild(deleteButton);

            container.appendChild(cityRow);
        });

        lucide.createIcons();

    } catch (error) {
        console.error("Loading favourites error:", error);
    }
}


async function saveFavorite() {
    try {
        if (!currentLocation) {
            alert("Please select a city first.");
            return;
        }

        const response = await fetch(
            `${BACKEND_URL}/api/favorites`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    city: currentLocation.name,
                    country: currentLocation.country,
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to save city");
        }

        alert("City added to favourites!");

        await loadFavorites();

    } catch (error) {
        alert(error.message);
        console.error("Save favourite error:", error);
    }
}


async function deleteFavorite(id) {
    try {
        const response = await fetch(
            `${BACKEND_URL}/api/favorites/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to delete favourite");
        }

        await loadFavorites();

    } catch (error) {
        alert(error.message);
        console.error("Delete favourite error:", error);
    }
}



// ==========================================
// 12. CITY SEARCH EVENTS
// ==========================================

document.getElementById("searchBtn")
    .addEventListener("click", () => {

        const city = document.getElementById("cityInput").value;

        searchCity(city);

    });


document.getElementById("cityInput")
    .addEventListener("keydown", event => {

        if (event.key === "Enter") {

            searchCity(event.target.value);

        }

    });


// ==========================================
// 13. TEMPERATURE UNIT SWITCH
// ==========================================

document.getElementById("unitToggle")
    .addEventListener("click", function () {

        isCelsius = !isCelsius;

        this.textContent = isCelsius ? "°C" : "°F";

        if (weatherCache) {
            updateDashboard(weatherCache);
        }

    });


// ==========================================
// 14. DARK / LIGHT MODE
// ==========================================

document.getElementById("themeToggle")
    .addEventListener("click", function () {

        document.body.classList.toggle("light-theme");

        const isLight =
            document.body.classList.contains("light-theme");

        this.innerHTML = isLight
            ? '<i data-lucide="sun"></i>'
            : '<i data-lucide="moon"></i>';

        lucide.createIcons();

    });


// ==========================================
// 15. FAVORITE CITY SHORTCUTS
// ==========================================

document.querySelectorAll(".location-item")
    .forEach(button => {

        button.addEventListener("click", function () {

            const city = this.dataset.city;

            searchCity(city);

        });

    });


// ==========================================
// 16. GEOLOCATION
// ==========================================

document.getElementById("locationBtn")
    .addEventListener("click", function () {

        if (!navigator.geolocation) {

            alert("Geolocation is not supported.");

            return;

        }

        const button = this;

        button.disabled = true;
        button.textContent = "Detecting...";

        navigator.geolocation.getCurrentPosition(

            async position => {

                try {

                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;

                    currentCity = "My Location";

                    currentLocation = {
                        latitude,
                        longitude,
                        name: "My Location",
                        country: ""
                    };

                    await loadWeather(latitude, longitude);

                } finally {

                    button.disabled = false;
                    button.innerHTML =
                        '<i data-lucide="crosshair"></i> My Location';

                    lucide.createIcons();

                }

            },

            error => {

                alert("Location access denied or unavailable.");

                button.disabled = false;
                button.innerHTML =
                    '<i data-lucide="crosshair"></i> My Location';

                lucide.createIcons();

            }

        );

    });


// ==========================================
// 17. AI ASSISTANT PLACEHOLDER
// ==========================================

document.getElementById("assistantBtn")
    .addEventListener("click", () => {

        alert("AI Weather Assistant will be developed in a later phase.");

    });


// ==========================================
// 18. INITIALIZE SKYCAST
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    lucide.createIcons();
    await loadFavorites();

    try {

        await loadWeather(
            currentLocation.latitude,
            currentLocation.longitude
        );

        console.log("SKYCAST connected to Open-Meteo!");

    } catch (error) {

        console.error("Application initialization failed:", error);

    }

});


// FAVOURITE BUTTON EVENT

document.getElementById("favoriteBtn")
    .addEventListener("click", saveFavorite);