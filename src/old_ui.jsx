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

  // Gamification state
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [sequence, setSequence] = useState([
    {
      id: 1,
      name: "Tree Pose",
      imagePath: "/tree-pose.jpg",
      completed: false,
      points: 100,
      difficultyMultiplier: 1.0,
    },
    {
      id: 2,
      name: "Warrior Pose II",
      imagePath: "/warrior-pose.jpg",
      completed: false,
      points: 150,
      difficultyMultiplier: 1.2,
    },
    {
      id: 3,
      name: "Downward Dog",
      imagePath: "/downward-dog.jpg",
      completed: false,
      points: 200,
      difficultyMultiplier: 1.5,
    },
    {
      id: 4,
      name: "Upward Dog",
      imagePath: "/upward-dog.jpg",
      completed: false,
      points: 250,
      difficultyMultiplier: 1.8,
    },
  ]);

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

  // Process the reference image whenever the currentPoseIndex changes
  useEffect(() => {
    if (
      !poseLandmarker ||
      !imageRef.current ||
      !imageCanvasRef.current ||
      !imageDrawingUtilsRef.current
    )
      return;

    // Reset challenge state when changing poses
    setChallengeComplete(false);
    setHoldTime(0);
    setTimerActive(false);
    setReferencePose(null);

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
  }, [poseLandmarker, currentPoseIndex]);

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
            // Mark pose as completed and award points
            const currentPose = sequence[currentPoseIndex];
            const pointsEarned = Math.round(
              currentPose.points *
                currentPose.difficultyMultiplier *
                (targetTime / 5) // Time multiplier - longer holds are worth more
            );

            // Update the sequence state
            setSequence((prev) => {
              const updated = [...prev];
              updated[currentPoseIndex] = {
                ...updated[currentPoseIndex],
                completed: true,
              };
              return updated;
            });

            // Add points to score
            setScore((prev) => prev + pointsEarned);

            // Show completion alert with points
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
  }, [
    isPoseMatched,
    timerActive,
    challengeComplete,
    targetTime,
    sequence,
    currentPoseIndex,
  ]);

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
    const MATCH_THRESHOLD = 0.8;
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

  // Utility: get the 3D angle at point B formed by points A–B–C
  function getAngle(A, B, C) {
    const AB = { x: A.x - B.x, y: A.y - B.y };
    const CB = { x: C.x - B.x, y: C.y - B.y };
    const dot = AB.x * CB.x + AB.y * CB.y;
    const magAB = Math.hypot(AB.x, AB.y);
    const magCB = Math.hypot(CB.x, CB.y);
    if (magAB === 0 || magCB === 0) return 0;
    const cosAngle = dot / (magAB * magCB);
    // Clamp float errors
    const angle = Math.acos(Math.min(1, Math.max(-1, cosAngle)));
    return (angle * 180) / Math.PI; // in degrees
  }

  // Normalize pose: translate to mid-hip at (0,0) and scale so torso length = 1
  function normalizePose(landmarks) {
    const lh = landmarks[23]; // left hip
    const rh = landmarks[24]; // right hip
    const ls = landmarks[11]; // left shoulder
    const rs = landmarks[12]; // right shoulder

    // Center = mid-hip
    const center = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    // Torso length = distance between mid-hip and mid-shoulder
    const shoulderMid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const torsoLen =
      Math.hypot(shoulderMid.x - center.x, shoulderMid.y - center.y) || 1;

    return landmarks.map((pt) => ({
      x: (pt.x - center.x) / torsoLen,
      y: (pt.y - center.y) / torsoLen,
      z: pt.z != null ? pt.z / torsoLen : 0,
    }));
  }

  // Compare two poses by joint angles
  function comparePoses(pose1, pose2) {
    if (!pose1 || !pose2) return 0;
    // Normalize both
    const P1 = normalizePose(pose1);
    const P2 = normalizePose(pose2);

    // List of triplets [A, B, C] for key joints
    const joints = [
      [11, 13, 15], // left shoulder: elbow
      [12, 14, 16], // right shoulder: elbow
      [13, 11, 23], // left elbow: shoulder
      [14, 12, 24], // right elbow: shoulder
      [23, 25, 27], // left hip: knee
      [24, 26, 28], // right hip: knee
      [25, 23, 11], // left knee: hip
      [26, 24, 12], // right knee: hip
    ];

    let totalDiff = 0;
    joints.forEach(([a, b, c]) => {
      const angle1 = getAngle(P1[a], P1[b], P1[c]);
      const angle2 = getAngle(P2[a], P2[b], P2[c]);
      totalDiff += Math.abs(angle1 - angle2);
    });

    const avgDiff = totalDiff / joints.length; // in degrees
    const maxTolerance = 45; // allow up to 45° avg difference
    const similarity = Math.max(0, 1 - avgDiff / maxTolerance);
    return similarity; // 0 (no match) to 1 (perfect)
  }

  // Reset the current challenge
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

  // Move to the next pose in the sequence
  const moveToNextPose = () => {
    if (currentPoseIndex < sequence.length - 1) {
      setCurrentPoseIndex(currentPoseIndex + 1);
      resetChallenge();
    } else {
      // Complete the level if at the end of the sequence
      setLevel(level + 1);

      // Reset the sequence for the next level
      setSequence((prev) =>
        prev.map((pose) => ({
          ...pose,
          completed: false,
          // Increase difficulty for the next level
          difficultyMultiplier: pose.difficultyMultiplier * 1.2,
        }))
      );

      setCurrentPoseIndex(0);
      resetChallenge();

      // Show level completion message
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000);
    }
  };

  // Go to a specific pose in the sequence
  const goToPose = (index) => {
    if (index < sequence.length) {
      setCurrentPoseIndex(index);
      resetChallenge();
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h1>Yoga Pose Challenge - Level {level}</h1>

      {/* Score display */}
      <div
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          margin: "10px 0",
          color: "#1976d2",
        }}
      >
        Score: {score}
      </div>

      {/* Sequence progress */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          margin: "15px 0",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        {sequence.map((pose, index) => (
          <div
            key={pose.id}
            onClick={() => goToPose(index)}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor:
                index === currentPoseIndex
                  ? "#1976d2"
                  : pose.completed
                  ? "#4caf50"
                  : "#e0e0e0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color:
                index === currentPoseIndex || pose.completed
                  ? "white"
                  : "black",
              fontWeight: "bold",
              border: index === currentPoseIndex ? "2px solid #1976d2" : "none",
              boxShadow:
                index === currentPoseIndex
                  ? "0 0 5px rgba(25, 118, 210, 0.5)"
                  : "none",
            }}
          >
            {index + 1}
          </div>
        ))}
      </div>

      {/* Current pose name */}
      <h2 style={{ color: "#1976d2", marginBottom: "20px" }}>
        {sequence[currentPoseIndex]?.name}
      </h2>

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
            marginRight: "10px",
          }}
        >
          Reset
        </button>

        {challengeComplete && (
          <button
            onClick={moveToNextPose}
            style={{
              padding: "5px 15px",
              fontSize: "16px",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Next Pose
          </button>
        )}
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
              src={sequence[currentPoseIndex]?.imagePath}
              alt={`${sequence[currentPoseIndex]?.name} Reference`}
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

      {/* Alert Message */}
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
          {challengeComplete ? (
            <>
              Challenge Complete!
              <br />+
              {Math.round(
                sequence[currentPoseIndex].points *
                  sequence[currentPoseIndex].difficultyMultiplier *
                  (targetTime / 5)
              )}{" "}
              Points
            </>
          ) : (
            <>Level {level} Complete! All poses mastered!</>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
