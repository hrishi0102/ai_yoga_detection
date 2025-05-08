import React, { useRef, useEffect, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [poseLandmarker, setPoseLandmarker] = useState(null);

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

  useEffect(() => {
    const startCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    };

    startCamera();
  }, []);

  useEffect(() => {
    if (!poseLandmarker || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const drawingUtils = new DrawingUtils(ctx);

    let animationId;

    const detect = async () => {
      if (video.readyState < 2) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const results = await poseLandmarker.detectForVideo(
        video,
        performance.now()
      );

      if (results.landmarks) {
        for (const landmark of results.landmarks) {
          drawingUtils.drawConnectors(
            landmark,
            PoseLandmarker.POSE_CONNECTIONS,
            { color: "#00FF00", lineWidth: 2 }
          );
          drawingUtils.drawLandmarks(landmark, {
            color: "#FF0000",
            radius: 3,
          });
        }
      }

      animationId = requestAnimationFrame(detect);
    };

    video.onloadeddata = () => {
      detect();
    };

    return () => cancelAnimationFrame(animationId);
  }, [poseLandmarker]);

  return (
    <div style={{ textAlign: "center" }}>
      <h1>Pose Detection Demo</h1>
      <div style={{ position: "relative", display: "inline-block" }}>
        <video
          ref={videoRef}
          width="640"
          height="480"
          muted
          autoPlay
          playsInline
          style={{ transform: "scaleX(-1)" }} // mirror for selfie view
        />
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: "scaleX(-1)", // match video mirroring
          }}
        />
      </div>
    </div>
  );
}

export default App;
