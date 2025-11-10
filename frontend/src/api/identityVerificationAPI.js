import apiClient from "./apiClient.js";


// Face capture api
export async function uploadFaceCapture(attemptId, imageFile) {
  try {
    // Create FormData for multipart/form-data
    const formData = new FormData();
    // candidateId is now extracted from JWT token on backend
    formData.append("faceImage", imageFile);

    // Make API call
    const response = await apiClient.post(
      `/identity-verification/${attemptId}/face-capture`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Face capture upload failed:", error);
    throw new Error(
      error.response?.data?.message || "Failed to upload face image"
    );
  }
}

// Audio recording api

export async function uploadAudioRecording(
  attemptId,
  audioFile,
  originalText,
  transcription = ""
) {
  try {
    // Create FormData for multipart/form-data
    const formData = new FormData();
    // candidateId is now extracted from JWT token on backend
    formData.append("audioFile", audioFile);
    formData.append("originalText", originalText);
    if (transcription) {
      formData.append("transcription", transcription);
    }

    // Make API call
    const response = await apiClient.post(
      `/identity-verification/${attemptId}/audio-recording`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Audio recording upload failed:", error);
    throw new Error(
      error.response?.data?.message || "Failed to upload audio recording"
    );
  }
}

/**
 * Retry audio recording (wrapper around uploadAudioRecording)
 * @param {string} attemptId - Assessment attempt ID
 * @param {string} candidateId - Candidate ID
 * @param {File} audioFile - New audio file
 * @param {string} originalText - Original text
 * @param {string} transcription - New transcription
 * @returns {Promise<object>}
 */
export async function retryAudioRecording(
  attemptId,
  audioFile,
  originalText,
  transcription
) {
  return uploadAudioRecording(
    attemptId,
    audioFile,
    originalText,
    transcription
  );
}
