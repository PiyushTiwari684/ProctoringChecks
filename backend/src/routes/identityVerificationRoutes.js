import express from "express";
import {
  uploadFaceCapture,
  uploadAudioRecording,
} from "../controllers/identityVerificationController.js";
import { uploadFaceImage, uploadAudio } from "../config/multer.config.js";
import { authenticateCandidate } from "../middlewares/auth.js";

const router = express.Router();

/**
 * Identity Verification Routes
 * All routes require candidate authentication
 */

// ============================================================
// FACE CAPTURE ENDPOINT
// ============================================================
// POST /api/v1/identity-verification/:attemptId/face-capture
// Upload face image for identity verification
router.post(
  "/:attemptId/face-capture",
  authenticateCandidate, // Requires valid JWT token
  uploadFaceImage.single("faceImage"), // Multer middleware (accepts single file named "faceImage")
  uploadFaceCapture // Controller function
);

// ============================================================
// AUDIO RECORDING ENDPOINT
// ============================================================
// POST /api/v1/identity-verification/:attemptId/audio-recording
// Upload audio recording for voice verification
router.post(
  "/:attemptId/audio-recording",
  authenticateCandidate, // Requires valid JWT token
  uploadAudio.single("audioFile"), // Multer middleware (accepts single file named "audioFile")
  uploadAudioRecording // Controller function
);

export default router;

