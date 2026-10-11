const express = require("express");
const {
  listSpeakers,
  getSpeaker,
  createSpeaker,
  deleteSpeaker,
} = require("../controllers/speakerController");
const {
  listReferences,
  addReference,
  deleteReference,
} = require("../controllers/referenceController");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

// All speaker/reference management requires an authenticated admin.
router.use(authenticate, requireAdmin);

router.get("/", listSpeakers);
router.post("/", upload.single("file"), createSpeaker);
router.get("/:id", getSpeaker);
router.delete("/:id", deleteSpeaker);

router.get("/:id/references", listReferences);
router.post("/:id/references", upload.single("file"), addReference);
router.delete("/:id/references/:referenceId", deleteReference);

module.exports = router;
