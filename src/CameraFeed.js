import React, { useEffect, useState, useRef, useCallback } from 'react';
// Assuming your original CSS is in './App.css'
import './App.css'; 

// --- Configuration Constants ---
// NOTE: Ngrok runs the web server on a standard HTTPS port (443), so you typically 
// don't include the Flask port (5000) in the URL itself.
// The Ngrok URL must be the one mapping to your Flask server (port 5000).
const NG_ROK_DOMAIN = "3d74a0e0cdc0.ngrok-free.app"; // Replace with your current Ngrok domain (e.g., xxx.ngrok-free.app)

// All endpoints must use HTTPS.
const UPLOAD_URL = `https://${NG_ROK_DOMAIN}/process_frame`; 

// Frame rate control (e.g., 5 frames per second = 200ms interval)
const FRAME_INTERVAL_MS = 200; 
// ------------------------------------

function CameraFeed() {
    const [isServiceRunning, setIsServiceRunning] = useState(false); 
    const [status, setStatus] = useState('inactive');
    const [message, setMessage] = useState('Press "Start Service" to begin attendance checks.');
    const [framesSent, setFramesSent] = useState(0);
    
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const captureIntervalRef = useRef(null); 

    // --- FUNCTION TO CAPTURE AND SEND A SINGLE FRAME VIA POST ---
    const sendFrame = useCallback(async () => {
        if (!isServiceRunning || status === 'marked') {
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (!video || !canvas || video.paused || video.ended) {
            return;
        }

        // 1. Capture frame from video to canvas
        const context = canvas.getContext('2d');
        // Use video dimensions for accurate capture
        canvas.width = video.videoWidth; 
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 2. Convert canvas image to Blob object (JPEG format)
        canvas.toBlob(async (blob) => {
            if (!blob) {
                console.error("Failed to create Blob from canvas.");
                return;
            }

            // 3. Create FormData object to send as a file
            const formData = new FormData();
            formData.append('frame', blob, 'frame.jpg');

            try {
                // 4. Send the frame to the Flask server
                const response = await fetch(UPLOAD_URL, {
                    method: 'POST',
                    body: formData,
                    // Note: Browser automatically sets Content-Type: multipart/form-data
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                // 5. Update UI based on server response
                setStatus(data.status);
                setMessage(data.message);
                setFramesSent(prev => prev + 1);

                if (data.status === 'marked') {
                    // Stop the service once marked
                    clearInterval(captureIntervalRef.current);
                    setIsServiceRunning(false); 
                }

            } catch (e) {
                console.error("Frame upload error:", e);
                setMessage(`[ERROR] Server connection failed or processing error: ${e.message}`);
            }
        }, 'image/jpeg'); // Specify output format
    }, [isServiceRunning, status]);

    // --- EFFECT: CAMERA ACCESS & CAPTURE LOOP ---
    useEffect(() => {
        if (!isServiceRunning) {
            // Cleanup: Stop the stream and interval
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            clearInterval(captureIntervalRef.current);
            return;
        }

        async function startCameraAndCaptureLoop() {
            try {
                // 1. Request camera access
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        // Try simplifying the request first for better compatibility
                        video: true, 
                        // Fallback/Option: facingMode: 'environment' 
                    }
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                
                // 2. Start the continuous capture and send loop
                // Wait for the video to start playing before capturing frames
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                    captureIntervalRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS);
                };

                setMessage('Camera opened successfully. Analyzing frames...');

            } catch (err) {
                console.error("Error accessing the camera: ", err);
                setMessage("ERROR: Camera access denied. Check browser permissions and secure (HTTPS) context.");
                setStatus('error');
                setIsServiceRunning(false);
            }
        }
        
        startCameraAndCaptureLoop();
        
        return () => {
            // Cleanup on unmount/stop
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            clearInterval(captureIntervalRef.current);
        };
    }, [isServiceRunning, sendFrame]);

    // Handler for the Start button
    const handleStartService = () => {
        setIsServiceRunning(true);
        setStatus('active');
        setMessage('System is initializing... Attempting to open mobile camera.');
    };
    
    // --- RENDER FUNCTION ---
    return (
        <div className="camera-container">
            <h1>Attendance Mark System</h1>
            
            <div className={`status-box ${status}`}>
                Status: <strong>{status.toUpperCase()}</strong>
                <p>{message}</p>
                <p>Frames Sent: {framesSent}</p>
                {status === 'active' && <p>Please ensure your face is visible and blink for the liveness check.</p>}
            </div>

            {!isServiceRunning && status !== 'marked' && status !== 'error' && (
                <button 
                    onClick={handleStartService} 
                    className="start-button"
                >
                    ▶️ Start Attendance Service
                </button>
            )}
            
            <div className="video-feed" style={{ position: 'relative' }}>
                {isServiceRunning ? (
                    // 1. Video element shows the live stream from the mobile camera
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline 
                        muted 
                        className="live-stream"
                        style={{ width: '100%', maxWidth: '500px', borderRadius: '5px' }}
                    />
                ) : (
                    <div className="placeholder">
                        <h2>Service Stopped</h2>
                    </div>
                )}
            </div>
            
            {/* 2. Hidden Canvas for capturing frames */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
}

export default CameraFeed;