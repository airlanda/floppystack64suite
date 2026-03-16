const express = require("express");
const router = express.Router();
const mongoose = require("mongoose")

const ItemModel = require("../../models/Items");
const {
    getDiskDataset,
    getMergedEnabledDiskDataset,
    listDiskDatasetKeys,
    removeDiskFromDataset,
    updateDiskGameTitles,
} = require("../../data/diskDatasets");
const {
    makeRatingKey,
    readRatingsStore,
    upsertRating,
    removeRating,
} = require("../../data/ratingsStore");

//@route GET api/items
//@desc get all items
//@access public
router.get("/", (req, res) => {
    ItemModel.find()
    .sort({date:-1})
    .then(items => res.json(items))
});

router.get("/disks", (req, res) => {
    const requestedDataset = req.query.set || req.query.dataset || "default";
    const useMerged = !req.query.set && !req.query.dataset;
    const datasetLookup = useMerged
        ? getMergedEnabledDiskDataset()
        : getDiskDataset(requestedDataset);
    const key = useMerged ? "default" : datasetLookup.key;
    const data = datasetLookup.data;

    if (!data) {
        return res.status(400).json({
            error: "Unknown dataset",
            allowed: listDiskDatasetKeys(),
        });
    }
    readRatingsStore()
        .then((ratingsStore) => {
            const merged = data.map((disk) => {
                if (!disk || typeof disk !== "object") return disk;

                const nextDisk = { ...disk };

                ["sideA", "sideB"].forEach((sideKey) => {
                    const games = Array.isArray(disk[sideKey]) ? disk[sideKey] : [];

                    nextDisk[sideKey] = games.map((game, index) => {
                        const gameName =
                            game && typeof game === "object" ? game.gameName : game;

                        const ratingKey = makeRatingKey({
                            dataset: disk.datasetKey || key,
                            diskId: disk._id,
                            side: sideKey,
                            gameIndex: index,
                            gameName,
                        });

                        const override = ratingsStore[ratingKey];
                        if (!override || typeof override.rating !== "number") {
                            return game;
                        }

                        if (game && typeof game === "object") {
                            return { ...game, rating: override.rating };
                        }

                        return { gameName, rating: override.rating };
                    });
                });

                return nextDisk;
            });

            res.json(merged);
        })
        .catch((error) => {
            console.error("Failed to merge ratings overrides:", error);
            res.status(500).json({ error: "Failed to load disks" });
        });
});

//@route PATCH api/items/ratings
//@desc update rating override for a specific game on a disk side
//@access public
router.patch("/ratings", async (req, res) => {
    try {
        const {
            dataset = "default",
            diskId,
            side,
            gameIndex,
            gameName,
            rating,
        } = req.body || {};

        const validSides = new Set(["sideA", "sideB"]);
        const numericRating = Number(rating);
        const numericIndex = Number(gameIndex);

        if (!diskId || !validSides.has(side) || !gameName || !Number.isInteger(numericIndex)) {
            return res.status(400).json({ error: "Invalid rating target" });
        }

        if (Number.isNaN(numericRating) || numericRating < 0 || numericRating > 5) {
            return res.status(400).json({ error: "Rating must be between 0 and 5" });
        }

        const payload = {
            dataset,
            diskId,
            side,
            gameIndex: numericIndex,
            gameName,
            rating: Math.round(numericRating * 2) / 2,
        };

        if (payload.rating <= 0) {
            await removeRating(payload);
            return res.json({ success: true, cleared: true, ...payload });
        }

        await upsertRating(payload);
        return res.json({ success: true, ...payload });
    } catch (error) {
        console.error("Failed to save rating:", error);
        return res.status(500).json({ error: "Failed to save rating" });
    }
});

//@route PATCH api/items/titles
//@desc update game titles for a disk side in the source dataset
//@access public
router.patch("/titles", async (req, res) => {
    try {
        const { dataset = "default", diskId, side, titles } = req.body || {};

        if (!diskId || !["sideA", "sideB"].includes(side) || !Array.isArray(titles)) {
            return res.status(400).json({ error: "Invalid title update payload" });
        }

        const result = updateDiskGameTitles({
            datasetKey: dataset,
            diskId,
            side,
            titles,
        });

        return res.json({ success: true, ...result });
    } catch (error) {
        console.error("Failed to update game titles:", error);
        return res.status(500).json({ error: error.message || "Failed to update game titles" });
    }
});

//@route DELETE api/items/disks/:diskId
//@desc delete a disk from a specific source dataset
//@access public
router.delete("/disks/:diskId", async (req, res) => {
    try {
        const dataset = req.query.dataset || req.body?.dataset || "default";
        const diskId = req.params.diskId;

        const result = removeDiskFromDataset({
            datasetKey: dataset,
            diskId,
        });

        return res.json({ success: true, ...result });
    } catch (error) {
        console.error("Failed to delete disk:", error);
        return res.status(400).json({ error: error.message || "Failed to delete disk" });
    }
});



//@route DELETE api/items/:id
//@desc delete an item
//@access public
router.delete("/:id", (req, res) => {
    ItemModel.findById(req.params.id)
    .then(item => item.deleteOne().then(()=>res.json({success:true})))
    .catch(error => res.status(404).json())
})


//@route POST api/items
//@desc create an item (save)
//@access public
router.post("/", (req, res) => {
    const newItem = new ItemModel({
        name: req.body.name // using the body parser allows us to do this
    })

    newItem.save().then(item => res.json(item));
});




module.exports = router;

