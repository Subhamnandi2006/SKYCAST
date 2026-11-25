
const mongoose = require("mongoose");

// Define the structure of a favourite city
const favoriteSchema = new mongoose.Schema(
    {
        city: {
            type: String,
            required: true,
            trim: true
        },

        country: {
            type: String,
            default: ""
        },

        latitude: {
            type: Number,
            required: true
        },

        longitude: {
            type: Number,
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Create and export the Favourite model
const Favorite = mongoose.model("Favorite", favoriteSchema);

module.exports = Favorite;
