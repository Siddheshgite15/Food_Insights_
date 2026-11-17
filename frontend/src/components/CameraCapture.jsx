import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, SwitchCamera, Aperture, VideoOff } from 'lucide-react';

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const isMountedRef = useRef(true);
  const streamRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // rear camera default
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [flashEffect, setFlashEffect] = useState(false);
  const [isStarting, setIsStarting] = useState(true);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing) => {
    // Stop any existing stream first
    stopTracks();

    setError(null);
    setIsStarting(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      if (!isMountedRef.current) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // Ignore harmless AbortError if component unmounts or video was detached
          if (playErr.name !== 'AbortError') {
            throw playErr;
          }
        }
      }

      if (isMountedRef.current) {
        setIsStarting(false);
      }
    } catch (err) {
      if (!isMountedRef.current || err.name === 'AbortError') {
        // Modal was closed while request was in-flight, ignore cleanly
        return;
      }

      console.error('Camera error:', err);
      setIsStarting(false);

      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError(`Unable to access camera: ${err.message}`);
      }
    }
  }, [stopTracks]);

  useEffect(() => {
    isMountedRef.current = true;
    startCamera(facingMode);

    return () => {
      isMountedRef.current = false;
      stopTracks();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchCamera = () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  const handleCapture = () => {
    setCountdown(0);
    captureFrame();
    setCountdown(null);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Flash effect
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 300);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');

    // Mirror if front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `camera_capture_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });

          // Stop camera before handing off
          stopTracks();

          onCapture(file);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleClose = () => {
    stopTracks();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 rounded-3xl overflow-hidden bg-gray-950 border border-white/10 shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-900/80 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Camera size={16} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Camera Capture</h3>
              <p className="text-[10px] text-gray-500">Position the banana specimen in frame</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-all border border-white/5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Video Feed */}
        <div className="relative aspect-[4/3] bg-black overflow-hidden">
          {isStarting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <p className="text-xs text-gray-400 font-medium">Initializing camera...</p>
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center z-10">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <VideoOff size={28} className="text-rose-400" />
              </div>
              <p className="text-sm text-rose-300 font-semibold max-w-sm">{error}</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="mt-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              style={{ display: isStarting ? 'none' : 'block' }}
            />
          )}

          {/* Viewfinder overlay */}
          {!error && !isStarting && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner brackets */}
              <div className="absolute top-6 left-6 w-12 h-12 border-l-2 border-t-2 border-amber-400/60 rounded-tl-lg" />
              <div className="absolute top-6 right-6 w-12 h-12 border-r-2 border-t-2 border-amber-400/60 rounded-tr-lg" />
              <div className="absolute bottom-6 left-6 w-12 h-12 border-l-2 border-b-2 border-amber-400/60 rounded-bl-lg" />
              <div className="absolute bottom-6 right-6 w-12 h-12 border-r-2 border-b-2 border-amber-400/60 rounded-br-lg" />

              {/* Center crosshair */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-5 h-[1px] bg-white/30 absolute top-1/2 left-1/2 -translate-x-1/2" />
                <div className="w-[1px] h-5 bg-white/30 absolute top-1/2 left-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
              <span className="text-8xl font-black text-amber-400 animate-pulse drop-shadow-2xl">
                {countdown}
              </span>
            </div>
          )}

          {/* Flash effect */}
          {flashEffect && (
            <div className="absolute inset-0 bg-white z-30 animate-pulse" />
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 px-5 py-5 bg-gray-900/80 border-t border-white/5">
          {/* Switch camera */}
          <button
            onClick={handleSwitchCamera}
            disabled={!!error || isStarting}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Switch Camera"
          >
            <SwitchCamera size={20} />
          </button>

          {/* Capture button */}
          <button
            onClick={handleCapture}
            disabled={!!error || isStarting || countdown !== null}
            className="group relative w-[72px] h-[72px] rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
            title="Capture Photo"
          >
            <div className="absolute inset-[3px] rounded-full border-2 border-black/20" />
            <Aperture size={28} className="text-black/80 group-hover:text-black transition-colors" />
          </button>

          {/* Cancel */}
          <button
            onClick={handleClose}
            className="p-3 rounded-2xl bg-white/5 hover:bg-rose-500/10 text-gray-300 hover:text-rose-400 border border-white/10 transition-all"
            title="Cancel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tip */}
        <div className="px-5 py-2.5 bg-amber-500/5 border-t border-amber-500/10 text-center">
          <p className="text-[10px] text-amber-400/70 font-medium">
            💡 Ensure good lighting · Position banana centrally · Avoid shadows for best Resnet accuracy
          </p>
        </div>
      </div>
    </div>
  );
}
