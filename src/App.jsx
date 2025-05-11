import React, { useRef, useEffect, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [referencePose, setReferencePose] = useState(null);
  const [isPoseMatched, setIsPoseMatched] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const drawingUtilsRef = useRef(null);
  const imageDrawingUtilsRef = useRef(null);

  // Timer state variables
  const [holdTime, setHoldTime] = useState(0); // Current hold time in seconds
  const [targetTime, setTargetTime] = useState(5); // Target time to hold (5 seconds default)
  const [timerActive, setTimerActive] = useState(false); // Whether timer is currently running
  const [challengeComplete, setChallengeComplete] = useState(false); // Whether challenge is complete

  // Load the MediaPipe model
  useEffect(() => {
    const loadModel = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU", // fallback handled internally
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
      });

      setPoseLandmarker(landmarker);
    };

    loadModel();
  }, []);

  // Start the webcam
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing webcam:", error);
      }
    };

    startCamera();

    return () => {
      // Clean up video stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // Initialize canvases once elements are ready
  useEffect(() => {
    if (canvasRef.current) {
      const videoCanvas = canvasRef.current;
      const ctx = videoCanvas.getContext("2d");
      drawingUtilsRef.current = new DrawingUtils(ctx);
    }

    if (imageCanvasRef.current) {
      const imageCanvas = imageCanvasRef.current;
      const ctx = imageCanvas.getContext("2d");
      imageDrawingUtilsRef.current = new DrawingUtils(ctx);
    }
  }, []);

  // Process the reference image once the model is loaded
  useEffect(() => {
    if (
      !poseLandmarker ||
      !imageRef.current ||
      !imageCanvasRef.current ||
      !imageDrawingUtilsRef.current
    )
      return;

    const analyzeReferenceImage = async () => {
      // Wait for the image to load
      if (!imageRef.current.complete) {
        imageRef.current.onload = analyzeReferenceImage;
        return;
      }

      const imageWidth = imageRef.current.naturalWidth;
      const imageHeight = imageRef.current.naturalHeight;

      // Set canvas dimensions to match the image
      imageCanvasRef.current.width = imageWidth;
      imageCanvasRef.current.height = imageHeight;

      // Clear the canvas
      const ctx = imageCanvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, imageWidth, imageHeight);

      try {
        // Change to IMAGE mode for single image detection
        await poseLandmarker.setOptions({ runningMode: "IMAGE" });
        const results = await poseLandmarker.detect(imageRef.current);

        // Store the reference pose landmarks
        if (results.landmarks && results.landmarks.length > 0) {
          setReferencePose(results.landmarks[0]);

          // Draw landmarks on the reference image
          imageDrawingUtilsRef.current.drawConnectors(
            results.landmarks[0],
            PoseLandmarker.POSE_CONNECTIONS,
            { color: "#00FF00", lineWidth: 2 }
          );
          imageDrawingUtilsRef.current.drawLandmarks(results.landmarks[0], {
            color: "#FF0000",
            radius: 3,
          });
        }

        // Change back to VIDEO mode for webcam
        await poseLandmarker.setOptions({ runningMode: "VIDEO" });
      } catch (error) {
        console.error("Error analyzing reference image:", error);
      }
    };

    analyzeReferenceImage();
  }, [poseLandmarker]);

  // Timer effect to track hold time
  useEffect(() => {
    let interval;

    if (isPoseMatched && !challengeComplete) {
      if (!timerActive) {
        setTimerActive(true);
        setHoldTime(0); // Reset timer when pose is initially matched
      }

      // Start the timer interval
      interval = setInterval(() => {
        setHoldTime((prevTime) => {
          const newTime = prevTime + 0.1; // Increment by 0.1 seconds

          // Check if target time reached
          if (newTime >= targetTime && !challengeComplete) {
            setChallengeComplete(true);
            setShowAlert(true);
            setTimeout(() => setShowAlert(false), 3000);
            clearInterval(interval);
          }

          return newTime;
        });
      }, 100); // Update every 100ms for smoother progress
    } else {
      // If pose is no longer matched, reset timer
      if (timerActive && !challengeComplete) {
        setTimerActive(false);
        setHoldTime(0);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPoseMatched, timerActive, challengeComplete, targetTime]);

  // Process video frames
  useEffect(() => {
    if (
      !poseLandmarker ||
      !videoRef.current ||
      !canvasRef.current ||
      !referencePose ||
      !drawingUtilsRef.current
    )
      return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let animationId;
    const MATCH_THRESHOLD = 0.75;
    let lastVideoTime = -1;

    const detect = async () => {
      if (video.readyState < 2) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      // Only process if video time has changed
      if (lastVideoTime === video.currentTime) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      lastVideoTime = video.currentTime;

      // Ensure canvas matches video dimensions
      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        const results = await poseLandmarker.detectForVideo(
          video,
          performance.now()
        );

        if (results.landmarks && results.landmarks.length > 0) {
          // Draw landmarks
          drawingUtilsRef.current.drawConnectors(
            results.landmarks[0],
            PoseLandmarker.POSE_CONNECTIONS,
            { color: "#00FF00", lineWidth: 2 }
          );
          drawingUtilsRef.current.drawLandmarks(results.landmarks[0], {
            color: "#FF0000",
            radius: 3,
          });

          // Compare with reference pose
          const similarity = comparePoses(results.landmarks[0], referencePose);
          const currentMatch = similarity > MATCH_THRESHOLD;

          setIsPoseMatched(currentMatch);
        }
      } catch (error) {
        console.error("Error in pose detection:", error);
      }

      // Continue the detection loop
      animationId = requestAnimationFrame(detect);
    };

    // Start detection
    detect();

    // Cleanup function
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [poseLandmarker, referencePose]);

  // Compare two poses and return a similarity score between 0 and 1
  const comparePoses = (pose1, pose2) => {
    if (!pose1 || !pose2) return 0;

    // Key landmarks for yoga pose comparison
    const keyLandmarkIndices = [
      11,
      12, // shoulders
      23,
      24, // hips
      25,
      26, // knees
      27,
      28, // ankles
      15,
      16, // wrists
    ];

    let totalDistance = 0;
    let maxDistance = 0;

    // Calculate the normalized distance between corresponding landmarks
    keyLandmarkIndices.forEach((index) => {
      const landmark1 = pose1[index];
      const landmark2 = pose2[index];

      if (landmark1 && landmark2) {
        // Calculate Euclidean distance for normalized coordinates
        const dist = Math.sqrt(
          Math.pow(landmark1.x - landmark2.x, 2) +
            Math.pow(landmark1.y - landmark2.y, 2)
        );

        totalDistance += dist;
        maxDistance += 1.0; // Maximum possible distance for normalized coordinates
      }
    });

    // Return similarity score (1 - normalized distance)
    return maxDistance > 0 ? 1 - totalDistance / maxDistance : 0;
  };

  // Reset the challenge
  const resetChallenge = () => {
    setChallengeComplete(false);
    setHoldTime(0);
    setTimerActive(false);
  };

  // Change the target time
  const handleTargetTimeChange = (e) => {
    setTargetTime(parseInt(e.target.value, 10));
    resetChallenge();
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h1>Yoga Pose Challenge</h1>

      {/* Timer settings */}
      <div style={{ margin: "20px 0" }}>
        <label htmlFor="timeSelect">Hold pose for: </label>
        <select
          id="timeSelect"
          value={targetTime}
          onChange={handleTargetTimeChange}
          style={{
            padding: "5px 10px",
            fontSize: "16px",
            borderRadius: "4px",
            margin: "0 10px",
          }}
        >
          <option value="3">3 seconds</option>
          <option value="5">5 seconds</option>
          <option value="10">10 seconds</option>
          <option value="15">15 seconds</option>
          <option value="30">30 seconds</option>
        </select>
        <button
          onClick={resetChallenge}
          style={{
            padding: "5px 15px",
            fontSize: "16px",
            backgroundColor: "#4285f4",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Reset Challenge
        </button>
      </div>

      {/* Timer progress bar */}
      <div style={{ margin: "15px auto", width: "80%", maxWidth: "500px" }}>
        <div
          style={{
            width: "100%",
            backgroundColor: "#e0e0e0",
            borderRadius: "10px",
            height: "20px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(holdTime / targetTime) * 100}%`,
              height: "100%",
              backgroundColor: challengeComplete ? "#4caf50" : "#2196f3",
              transition: "width 0.1s ease-in-out",
            }}
          ></div>
        </div>
        <p style={{ margin: "5px 0" }}>
          {challengeComplete
            ? "Challenge complete!"
            : isPoseMatched
            ? `Holding: ${holdTime.toFixed(1)}s / ${targetTime}s`
            : "Align your pose"}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        {/* Reference Image */}
        <div style={{ position: "relative", width: "480px", height: "auto" }}>
          <h2>Reference Pose</h2>
          <div style={{ position: "relative", width: "100%", height: "auto" }}>
            <img
              ref={imageRef}
              src="/tree-pose.jpg"
              alt="Tree Pose Reference"
              style={{ maxWidth: "100%", height: "auto", display: "block" }}
            />
            <canvas
              ref={imageCanvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Webcam Feed */}
        <div style={{ position: "relative", width: "480px", height: "auto" }}>
          <h2>
            Your Pose{" "}
            {isPoseMatched && (
              <span style={{ color: "#4caf50" }}>- Matching!</span>
            )}
          </h2>
          <div style={{ position: "relative", width: "100%", height: "auto" }}>
            <video
              ref={videoRef}
              style={{
                transform: "scaleX(-1)",
                maxWidth: "100%",
                height: "auto",
                display: "block",
              }}
              muted
              autoPlay
              playsInline
            />
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                transform: "scaleX(-1)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Perfect Form Alert */}
      {showAlert && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#4CAF50",
            color: "white",
            padding: "15px 30px",
            borderRadius: "5px",
            fontSize: "24px",
            fontWeight: "bold",
            zIndex: 1000,
          }}
        >
          Challenge Complete! Perfect Form!
        </div>
      )}
    </div>
  );
}

export default App;
