import express from "express";
import {
  generateAssessment,
  getAssessmentForAttempt,
  startAssessment,
  getAttemptDetails,
} from "../controllers/assessmentController.js";
import { authenticateCandidate } from "../middlewares/auth.js";

const router = express.Router();

router.post("/start", authenticateCandidate, startAssessment);
router.post("/generate", authenticateCandidate, generateAssessment);
router.get("/attempt/:attemptId", authenticateCandidate, getAttemptDetails);
router.get("/:assessmentId/attempt/:attemptId",authenticateCandidate,getAssessmentForAttempt);

export default router;
