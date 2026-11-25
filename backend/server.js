require("dotenv").config();
const Favorite = require("./models/Favorite");
const mongoose = require("mongoose");

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// CONNECT TO MONGODB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully!");
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error);
    });

// First API route
app.get("/", (req, res) => {
    res.send("SKYCAST Backend is running!");
});

// Health check API
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "SKYCAST server is healthy!",
        project: "SKYCAST"
    });
});



// WEATHER API
app.get("/api/weather", async (req, res) => {
    try {
        const { latitude, longitude } = req.query;

        // Validate coordinates
        if (
            latitude === undefined ||
            longitude === undefined ||
            !Number.isFinite(Number(latitude)) ||
            !Number.isFinite(Number(longitude)) ||
            Number(latitude) < -90 ||
            Number(latitude) > 90 ||
            Number(longitude) < -180 ||
            Number(longitude) > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid latitude and longitude are required"
            });
        }

        const weatherURL = new URL(
            "https://api.open-meteo.com/v1/forecast"
        );

        weatherURL.search = new URLSearchParams({
            latitude,
            longitude,
            current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,is_day,visibility",
            hourly: "temperature_2m,precipitation_probability,weather_code,uv_index,visibility",
            daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
            timezone: "auto",
            forecast_days: "7"
        }).toString();

        const response = await fetch(weatherURL);

        if (!response.ok) {
            throw new Error("Weather service unavailable");
        }

        const weatherData = await response.json();

        res.json({
            success: true,
            weather: weatherData
        });

    } catch (error) {
        console.error("Weather API Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch weather data"
        });
    }
});



 // AIR QUALITY API
app.get("/api/air-quality", async (req, res) => {

    try {

        // Get coordinates from the request
        const { latitude, longitude } = req.query;

        // Validate coordinates
        if (
            latitude === undefined ||
            longitude === undefined ||
            !Number.isFinite(Number(latitude)) ||
            !Number.isFinite(Number(longitude)) ||
            Number(latitude) < -90 ||
            Number(latitude) > 90 ||
            Number(longitude) < -180 ||
            Number(longitude) > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid latitude and longitude are required"
            });
        }

        // Build Air Quality API URL
        const airURL = new URL(
            "https://air-quality-api.open-meteo.com/v1/air-quality"
        );

        airURL.search = new URLSearchParams({
            latitude: latitude,
            longitude: longitude,
            current: "us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone",
            timezone: "auto"
        }).toString();

        // Fetch air quality data
        const airResponse = await fetch(airURL);

        if (!airResponse.ok) {
            throw new Error("Air Quality service unavailable");
        }

        const airData = await airResponse.json();

        // Send response
        res.json({
            success: true,
            location: {
                latitude: Number(latitude),
                longitude: Number(longitude)
            },
            airQuality: airData
        });

    } catch (error) {

        console.error("Air Quality API Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch air quality data"
        });

    }

});


// GEOCODING API
app.get("/api/geocoding", async (req, res) => {
    try {
        const { city } = req.query;

        if (!city || !city.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide a city name"
            });
        }

        const geoURL = new URL(
            "https://geocoding-api.open-meteo.com/v1/search"
        );

        geoURL.search = new URLSearchParams({
            name: city.trim(),
            count: "5",
            language: "en",
            format: "json"
        }).toString();

        const response = await fetch(geoURL);

        if (!response.ok) {
            throw new Error("Geocoding service unavailable");
        }

        const data = await response.json();

        res.json({
            success: true,
            results: data.results || []
        });

    } catch (error) {
        console.error("Geocoding API Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to search for this city"
        });
    }
});


// SAVE A FAVOURITE CITY
app.post("/api/favorites", async (req, res) => {
    try {
        const { city, country, latitude, longitude } = req.body;

        // Validate incoming data
        if (
            typeof city !== "string" ||
            !city.trim() ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid city and coordinates are required"
            });
        }

        // Check if this city is already saved
        const existingFavorite = await Favorite.findOne({
            city: city.trim(),
            country: country || ""
        });

        if (existingFavorite) {
            return res.status(409).json({
                success: false,
                message: "This city is already in your favourites"
            });
        }

        // Create a new favourite
        const favorite = await Favorite.create({
            city: city.trim(),
            country: typeof country === "string" ? country.trim() : "",
            latitude,
            longitude
        });

        res.status(201).json({
            success: true,
            message: "City added to favourites!",
            favorite
        });

    } catch (error) {
        console.error("Save favourite error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to save favourite city"
        });
    }
});


// GET ALL FAVOURITE CITIES
app.get("/api/favorites", async (req, res) => {
    try {
        const favorites = await Favorite.find().sort({
            createdAt: -1
        });

        res.status(200).json({
            success: true,
            count: favorites.length,
            favorites
        });

    } catch (error) {
        console.error("Fetch favourites error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch favourite cities"
        });
    }
});


// DELETE A FAVOURITE CITY
app.delete("/api/favorites/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid favourite ID"
            });
        }

        const favorite = await Favorite.findByIdAndDelete(id);

        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: "Favourite city not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Favourite city removed successfully!"
        });

    } catch (error) {
        console.error("Delete favourite error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete favourite city"
        });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`SKYCAST server running at http://localhost:${PORT}`);
});
