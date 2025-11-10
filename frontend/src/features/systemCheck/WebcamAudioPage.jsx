import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import WebCamCheck from "./WebCamCheck";
import AudioCheck from "./AudioCheck";
import apiClient from "../../api/apiClient";

const WebcamAudioPage = () => {
  const { attemptId, systemCheckId } = useParams(); // Get both from URL params
  const navigate = useNavigate();
  const originalText = "The quick brown fox jumps over the lazy dog"; // Text for audio verification

  // Debug: Log attemptId
  console.log('WebcamAudioPage - attemptId:', attemptId);
  console.log('WebcamAudioPage - systemCheckId:', systemCheckId);

  const [faceDone, setFaceDone] = useState(false);
  const [audioDone, setAudioDone] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Handle success from Webcam (face capture)
  const handleFaceSuccess = () => {
    setFaceDone(true);
    // Optionally feedback/confirmation for user
  };

  // Handle success from AudioCheck
  const handleAudioSuccess = () => {
    setAudioDone(true);
    // Optionally feedback, or proceed next
  };

  // Handle Start Assessment button click
  const handleStartAssessment = async () => {
    try {
      setIsStarting(true);
      console.log("Assessment getting started");
      console.log("Attempt ID:", attemptId);

      // Fetch the attempt to get the assessmentId
      const response = await apiClient.get(`/assessments/attempt/${attemptId}`);

      console.log("API Response:", response);

      if (response.data.success) {
        const { assessmentId } = response.data.data;
        console.log("Assessment ID:", assessmentId);
        // Navigate to assessment page
        navigate(`/assessment/${assessmentId}/${attemptId}`);
      } else {
        console.error('API returned unsuccessful response:', response.data);
        alert('Failed to start assessment. Please try again.');
      }
    } catch (error) {
      console.error('Error starting assessment:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      alert(`Failed to start assessment: ${error.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  // You could add logic to only enable "Proceed" when both checks passed
  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Identity Verification</h1>
      
      <div className="mb-8">
        <WebCamCheck
          attemptId={attemptId}
          onSuccess={handleFaceSuccess}
        />
        {faceDone && (
          <div className="text-green-700 font-medium mt-2">
            Face photo verified!
          </div>
        )}
      </div>

      <div className="mb-8">
        <AudioCheck
          attemptId={attemptId}
          originalText={originalText}
          onSuccess={handleAudioSuccess}
        />
        {audioDone && (
          <div className="text-green-700 font-medium mt-2">
            Audio verified!
          </div>
        )}
      </div>
      
      {(faceDone && audioDone) && (
        <div className="mt-6 space-y-4">
          <div className="p-3 border rounded text-green-800 bg-green-100 font-bold text-center">
            All checks completed! You may proceed.
          </div>
          <button
            onClick={handleStartAssessment}
            disabled={isStarting}
            className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isStarting ? 'Starting Assessment...' : 'Start'}
          </button>
        </div>
      )}
    </div>
  );
};

export default WebcamAudioPage;
