import React from "react";

const PoseDisplay = ({
  level,
  score,
  currentPoseIndex,
  sequence,
  targetTime,
  holdTime,
  challengeComplete,
  isPoseMatched,
  showAlert,
  videoRef,
  canvasRef,
  imageRef,
  imageCanvasRef,
  handleTargetTimeChange,
  resetChallenge,
  moveToNextPose,
  goToPose,
}) => {
  return (
    <div className="container">
      <div className="header">
        <h1 className="title">Yoga Pose Challenge</h1>
        <p style={{ margin: 0, fontSize: "1.2rem" }}>
          Master the poses, level up your practice
        </p>
      </div>

      {/* Score and level display */}
      <div className="score-container">
        <div className="score-item">
          <div className="score-label">LEVEL</div>
          <div className="score-value">{level}</div>
        </div>
        <div className="score-item">
          <div className="score-label">SCORE</div>
          <div className="score-value">{score}</div>
        </div>
        <div className="score-item">
          <div className="score-label">POSE</div>
          <div className="score-value">
            {currentPoseIndex + 1}/{sequence.length}
          </div>
        </div>
      </div>

      {/* Sequence progress */}
      <div className="sequence-container">
        {sequence.map((pose, index) => (
          <div
            key={pose.id}
            onClick={() => goToPose(index)}
            className={`pose-indicator ${
              index === currentPoseIndex
                ? "current"
                : pose.completed
                ? "completed"
                : "default"
            }`}
          >
            {index + 1}
          </div>
        ))}
      </div>

      {/* Current pose name */}
      <h2 className="current-pose-name">{sequence[currentPoseIndex]?.name}</h2>

      {/* Timer settings */}
      <div className="controls-container">
        <label htmlFor="timeSelect" className="controls-label">
          Hold pose for:
        </label>
        <select
          id="timeSelect"
          value={targetTime}
          onChange={handleTargetTimeChange}
          className="select"
        >
          <option value="3">3 seconds</option>
          <option value="5">5 seconds</option>
          <option value="10">10 seconds</option>
          <option value="15">15 seconds</option>
          <option value="30">30 seconds</option>
        </select>
        <button onClick={resetChallenge} className="button reset-button">
          Reset
        </button>

        {challengeComplete && (
          <button onClick={moveToNextPose} className="button next-button">
            Next Pose
          </button>
        )}
      </div>

      {/* Timer progress bar */}
      <div className="progress-bar-container">
        <div className="progress-bar-outer">
          <div
            className={`progress-bar-inner ${
              challengeComplete ? "complete" : "active"
            }`}
            style={{
              width: `${(holdTime / targetTime) * 100}%`,
            }}
          ></div>
        </div>
        <p className="progress-text">
          {challengeComplete
            ? "Challenge complete! 🎉"
            : isPoseMatched
            ? `Holding: ${holdTime.toFixed(1)}s / ${targetTime}s`
            : "Align your pose with the reference image"}
        </p>
      </div>

      <div className="content-container">
        {/* Reference Image */}
        <div className="video-container">
          <h2 className="video-title">Reference Pose</h2>
          <div style={{ position: "relative", width: "100%", height: "auto" }}>
            <img
              ref={imageRef}
              src={sequence[currentPoseIndex]?.imagePath}
              alt={`${sequence[currentPoseIndex]?.name} Reference`}
              style={{ maxWidth: "100%", height: "auto", display: "block" }}
            />
            <canvas ref={imageCanvasRef} className="canvas-overlay" />
          </div>
        </div>

        {/* Webcam Feed */}
        <div className="video-container">
          <h2 className="video-title">
            Your Pose
            {isPoseMatched && (
              <span className="matching-indicator">Matching!</span>
            )}
          </h2>
          <div style={{ position: "relative", width: "100%", height: "auto" }}>
            <video
              ref={videoRef}
              className="video-element"
              muted
              autoPlay
              playsInline
            />
            <canvas ref={canvasRef} className="canvas-overlay flipped" />
          </div>
        </div>
      </div>

      {/* Alert Message */}
      {showAlert && (
        <div className="alert-container">
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
};

export default PoseDisplay;
