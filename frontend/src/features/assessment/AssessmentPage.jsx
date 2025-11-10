import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";

const AssessmentPage = () => {
  const { assessmentId, attemptId } = useParams(); // From route params
  const navigate = useNavigate();

  // Assessment state
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Navigation state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Answers state (store candidate answers)
  const [answers, setAnswers] = useState({});

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(null); // in seconds - null means not initialized

  // Fetch assessment on mount
  useEffect(() => {
    fetchAssessment();
  }, [assessmentId, attemptId]);

  const fetchAssessment = async () => {
    try {
      const response = await apiClient.get(
        `/assessments/${assessmentId}/attempt/${attemptId}`
      );

      if (response.data.success) {
        setAssessment(response.data.data);
        setTimeRemaining(response.data.data.totalDuration * 60); // Convert minutes to seconds
        setLoading(false);
      } else {
        setError(response.data.message || "Failed to load assessment");
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "Error loading assessment");
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    // Don't start timer if not initialized yet
    if (timeRemaining === null || timeRemaining === undefined) {
      return;
    }

    if (timeRemaining <= 0) {
      handleAutoSubmit();
      return;
    }
    const timer = setTimeout(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeRemaining]);

  const handleAutoSubmit = () => {
    alert("Time's up! Submitting assessment...");
    // Submit all answers to backend
    navigate("/assessment-complete");
  };

  // Navigation handlers
  const handleNextQuestion = () => {
    const currentSection = assessment.sections[currentSectionIndex];
    if (currentQuestionIndex < currentSection.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentSectionIndex < assessment.sections.length - 1) {
      // Move to next section
      setCurrentSectionIndex(currentSectionIndex + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentSectionIndex > 0) {
      // Move to previous section
      setCurrentSectionIndex(currentSectionIndex - 1);
      const prevSection = assessment.sections[currentSectionIndex - 1];
      setCurrentQuestionIndex(prevSection.questions.length - 1);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleSubmitAssessment = async () => {
    // TODO: Submit to backend in next step
    console.log("Submitting assessment with answers:", answers);
    alert("Assessment submitted!");
    navigate("/assessment-complete");
  };

  // Format time remaining (MM:SS)
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) {
      return "Loading...";
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) return <div className="p-8 text-center">Loading assessment...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!assessment) return null;

  // Check if assessment has sections and questions
  if (!assessment.sections || assessment.sections.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Assessment is being generated. Please wait...</p>
        <div className="mt-4 inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const currentSection = assessment.sections[currentSectionIndex];

  // Check if current section has questions
  if (!currentSection || !currentSection.questions || currentSection.questions.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Assessment questions are being generated. Please wait...</p>
        <div className="mt-4 inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const currentQuestion = currentSection.questions[currentQuestionIndex];
  const isLastQuestion =
    currentSectionIndex === assessment.sections.length - 1 &&
    currentQuestionIndex === currentSection.questions.length - 1;
  const isFirstQuestion = currentSectionIndex === 0 && currentQuestionIndex === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with timer */}
      <div className="bg-blue-600 text-white p-4 shadow">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">{assessment.title}</h1>
          <div className="text-lg font-mono">
            Time Remaining: {formatTime(timeRemaining)}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded shadow p-6 mb-4">
          {/* Section header */}
          <h2 className="text-xl font-bold mb-2">
            Section {currentSectionIndex + 1}: {currentSection.name}
          </h2>
          <p className="text-sm text-gray-600 mb-4">{currentSection.description}</p>

          {/* Question display */}
          <div className="mb-6">
            <div className="mb-2 text-sm text-gray-500">
              Question {currentQuestionIndex + 1} of {currentSection.questions.length}
            </div>
            <div className="text-lg font-medium mb-4">{currentQuestion.questionText}</div>

            {/* Answer input (textarea for now, we'll customize by type later) */}
            <textarea
              className="w-full border rounded p-3 min-h-[150px]"
              placeholder="Type your answer here..."
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
            />
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between items-center">
            <button
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded disabled:opacity-50"
              onClick={handlePreviousQuestion}
              disabled={isFirstQuestion}
            >
              Previous
            </button>

            {isLastQuestion ? (
              <button
                className="px-6 py-2 bg-green-600 text-white rounded font-bold"
                onClick={handleSubmitAssessment}
              >
                Submit Assessment
              </button>
            ) : (
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={handleNextQuestion}
              >
                Next
              </button>
            )}
          </div>
        </div>

        {/* Section progress indicator */}
        <div className="bg-white rounded shadow p-4">
          <h3 className="font-bold mb-2">Progress</h3>
          <div className="flex gap-2">
            {assessment.sections.map((section, idx) => (
              <div
                key={section.id}
                className={`flex-1 h-2 rounded ${
                  idx === currentSectionIndex
                    ? "bg-blue-600"
                    : idx < currentSectionIndex
                    ? "bg-green-600"
                    : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentPage;
