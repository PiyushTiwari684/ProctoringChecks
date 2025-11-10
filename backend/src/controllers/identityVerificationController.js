import prisma from "../config/db.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import {
  checkImageBlur,
  getImageMetadata,
  resizeImage,
} from "../utils/imageProcessor.js";
import { processAudio, getAudioDuration } from "../utils/audioProcessor.js";
import {
  transcribeAudio,
  isAssemblyAIConfigured,
} from "../services/assemblyAiServices.js";
import { checkMatch } from "../utils/stringSimilarity.js";
import fs from "fs";
import path from "path";

// ============================================================
// FACE CAPTURE ENDPOINT
// ============================================================

export const uploadFaceCapture = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const candidateId = req.candidate.id; // Get from JWT token via authenticateCandidate middleware

  // 1. Validate required fields
  if (!attemptId) {
    return sendError(res, "Attempt ID is required", 400);
  }

  // 2. Check if file was uploaded
  if (!req.file) {
    return sendError(res, "Face image is required", 400);
  }

  try {
    // 3. Check if candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      // Delete uploaded file if candidate not found
      fs.unlinkSync(req.file.path);
      return sendError(res, "Candidate not found", 404);
    }

    // 4. Check if identity verification record exists
    let verification = await prisma.identityVerification.findUnique({
      where: { attemptId },
    });

    // 5. Read uploaded image
    const imageBuffer = fs.readFileSync(req.file.path);

    // 6. Check image quality (blur detection)
    const blurCheck = await checkImageBlur(imageBuffer);

    if (blurCheck.isBlurry) {
      // Delete blurry image
      fs.unlinkSync(req.file.path);
      return sendError(
        res,
        `Image is too blurry (sharpness: ${blurCheck.sharpness}). Please retake with better lighting.`,
        400
      );
    }

    // 7. Get image metadata
    const metadata = await getImageMetadata(imageBuffer);

    // 8. Resize image if too large (save storage)
    let finalImagePath = req.file.path;
    if (metadata.width > 1280 || metadata.height > 720) {
      const resizedBuffer = await resizeImage(imageBuffer);
      fs.writeFileSync(req.file.path, resizedBuffer);
      console.log(`Image resized from ${metadata.width}x${metadata.height}`);
    }

    // 9. Store relative path (not absolute)
    const relativePath = path.relative(process.cwd(), finalImagePath);

    // 10. Create or update identity verification record
    if (verification) {
      // Update existing record
      verification = await prisma.identityVerification.update({
        where: { attemptId },
        data: {
          faceImagePath: relativePath,
          faceDetectedInitial: true,
          faceQualityScore: blurCheck.sharpness / 1000, // Normalize to 0-1 scale
          verificationStatus: "IN_PROGRESS",
        },
      });
    } else {
      // Create new record
      verification = await prisma.identityVerification.create({
        data: {
          candidateId,
          attemptId,
          faceImagePath: relativePath,
          faceDetectedInitial: true,
          faceQualityScore: blurCheck.sharpness / 1000,
          verificationStatus: "IN_PROGRESS",
        },
      });
    }

    return sendSuccess(
      res,
      {
        verification,
        imageQuality: {
          sharpness: blurCheck.sharpness,
          isSharp: !blurCheck.isBlurry,
          dimensions: `${metadata.width}x${metadata.height}`,
        },
      },
      "Face captured successfully"
    );
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw error;
  }
});

// ============================================================
// AUDIO RECORDING ENDPOINT
// ============================================================

export const uploadAudioRecording = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const candidateId = req.candidate.id; // Get from JWT token via authenticateCandidate middleware
  const { originalText, transcription } = req.body;

  // 1. Validate required fields
  if (!attemptId || !originalText) {
    return sendError(
      res,
      "Attempt ID and original text are required",
      400
    );
  }

  // 2. Check if file was uploaded
  if (!req.file) {
    return sendError(res, "Audio file is required", 400);
  }

  try {
    // 3. Check if candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      fs.unlinkSync(req.file.path);
      return sendError(res, "Candidate not found", 404);
    }

    // 4. Get identity verification record
    let verification = await prisma.identityVerification.findUnique({
      where: { attemptId },
    });

    if (!verification) {
      fs.unlinkSync(req.file.path);
      return sendError(
        res,
        "Identity verification not found. Please complete face capture first.",
        404
      );
    }

    // 5. Check retry limit (max 3 attempts)
    if (verification.audioAttemptCount >= 3) {
      fs.unlinkSync(req.file.path);
      return sendError(
        res,
        "Maximum audio recording attempts (3) exceeded",
        400
      );
    }

    // 6. Process audio (compress if needed)
    const audioResult = await processAudio(req.file.path);
    const finalAudioPath = audioResult.filePath;

    // 7. Get audio duration
    const duration = await getAudioDuration(finalAudioPath);

    // 8. Get transcription
    let finalTranscription = transcription; // From frontend (Web Speech API)

    // If no transcription provided, use AssemblyAI as fallback
    if (!finalTranscription || finalTranscription.trim() === "") {
      console.log(
        "No transcription from frontend. Using AssemblyAI fallback..."
      );

      if (!isAssemblyAIConfigured()) {
        fs.unlinkSync(finalAudioPath);
        return sendError(res, "Transcription service not configured", 500);
      }

      const assemblyResult = await transcribeAudio(finalAudioPath);
      finalTranscription = assemblyResult.text;
    }

    // 9. Calculate match score
    const matchResult = checkMatch(originalText, finalTranscription, 80);

    // 10. Store relative path
    const relativePath = path.relative(process.cwd(), finalAudioPath);

    // 11. Update identity verification record
    const updatedVerification = await prisma.identityVerification.update({
      where: { attemptId },
      data: {
        audioRecordingPath: relativePath,
        audioTranscription: finalTranscription,
        audioOriginalText: originalText,
        audioMatchScore: matchResult.score,
        audioVerified: matchResult.isMatch,
        audioAttemptCount: verification.audioAttemptCount + 1,
      },
    });

    // 12. Prepare response
    const response = {
      verification: updatedVerification,
      audioValidation: {
        transcription: finalTranscription,
        originalText: originalText,
        matchScore: matchResult.score,
        isMatch: matchResult.isMatch,
        threshold: matchResult.threshold,
        attemptsUsed: updatedVerification.audioAttemptCount,
        attemptsRemaining: 3 - updatedVerification.audioAttemptCount,
      },
      audioInfo: {
        duration,
        compressed: audioResult.compressed,
        fileSize: audioResult.size,
      },
    };

    // 13. Check if warning needed (2nd failed attempt)
    if (!matchResult.isMatch && updatedVerification.audioAttemptCount === 2) {
      response.warning =
        "This is your 2nd failed attempt. You have 1 more try remaining.";
    }

    return sendSuccess(res, response, "Audio recorded successfully");
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw error;
  }
});
