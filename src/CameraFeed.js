import React, { useEffect, useState, useRef } from 'react';

// Backend runs on local network
const BACKEND_IP = "https://3d74a0e0cdc0.ngrok-free.app"; // ⚠️ CHANGE THIS TO YOUR IP!
const STATUS_URL = `${BACKEND_IP}/status`;
const UPLOAD_URL = `${BACKEND_IP}/process_frame`;

function CameraFeed() {
    const [isServiceRunning, setIsServiceRunning] = useState(false);
    const [status, setStatus] = useState('inactive');
    const [message, setMessage] = useState('Press "Start Attendance" to begin.');
    const [stream, setStream] = useState(null);
    const [debugInfo, setDebugInfo] = useState('');
    const [framesSent, setFramesSent] = useState(0);
    const [facesDetected, setFacesDetected] = useState(0);
    
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const statusIntervalRef = useRef(null);
    const captureIntervalRef = useRef(null);

    // Cleanup camera stream
    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
        }
        if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
        }
    };

    // Start mobile camera
    const startCamera = async () => {
        try {
            setMessage('Starting camera...');
            setDebugInfo('Requesting camera access...');
            
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            
            setIsServiceRunning(true);
            setStatus('active');
            setMessage('Camera active! Position your face and BLINK naturally.');
            setDebugInfo('Camera started successfully ✅');
            setFramesSent(0);
            
            // Start capturing and sending frames
            setTimeout(() => {
                startFrameCapture();
                startStatusCheck();
            }, 1000); // Wait for video to load
            
        } catch (err) {
            console.error("Camera error:", err);
            setMessage(`Camera Error: ${err.name} - ${err.message}`);
            setStatus('error');
            setDebugInfo(`Error: ${err.name}`);
        }
    };

    // Capture and send frames to backend
    const startFrameCapture = () => {
        captureIntervalRef.current = setInterval(() => {
            if (videoRef.current && canvasRef.current && videoRef.current.readyState === 4) {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                
                // Set canvas size to match video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                if (canvas.width === 0 || canvas.height === 0) {
                    setDebugInfo('Waiting for video to load...');
                    return;
                }
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                
                // Convert canvas to blob and send to backend
                canvas.toBlob(blob => {
                    if (blob) {
                        const formData = new FormData();
                        formData.append('frame', blob, 'frame.jpg');
                        
                        fetch(UPLOAD_URL, {
                            method: 'POST',
                            body: formData
                        })
                        .then(res => {
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            return res.json();
                        })
                        .then(data => {
                            setFramesSent(prev => prev + 1);
                            
                            if (data.status) {
                                setStatus(data.status);
                                setMessage(data.message || '');
                                
                                if (data.faces_detected !== undefined) {
                                    setFacesDetected(data.faces_detected);
                                }
                                
                                setDebugInfo(`Frames sent: ${framesSent + 1} | Faces: ${data.faces_detected || 0}`);
                                
                                if (data.status === 'marked') {
                                    stopCamera();
                                    setIsServiceRunning(false);
                                }
                            }
                        })
                        .catch(err => {
                            console.error("Upload error:", err);
                            setDebugInfo(`Upload error: ${err.message}`);
                        });
                    }
                }, 'image/jpeg', 0.8);
            }
        }, 500); // Send frame every 500ms (2 frames per second)
    };

    // Check status periodically
    const startStatusCheck = () => {
        statusIntervalRef.current = setInterval(() => {
            fetch(STATUS_URL)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (data.status === 'marked') {
                        setStatus('marked');
                        setMessage(data.message);
                        stopCamera();
                        setIsServiceRunning(false);
                    }
                })
                .catch(err => {
                    console.error("Status error:", err);
                });
        }, 2000);
    };

    useEffect(() => {
        return () => stopCamera();
    }, []);

    return (
        <div style={{ 
            maxWidth: '800px', 
            margin: '0 auto', 
            padding: '20px',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: '#f5f5f5',
            minHeight: '100vh'
        }}>
            <h1 style={{ 
                textAlign: 'center', 
                color: '#333',
                marginBottom: '10px'
            }}>
                📱 Mobile Attendance System
            </h1>
            
            {/* Status Box */}
            <div style={{
                padding: '20px',
                marginBottom: '20px',
                borderRadius: '10px',
                backgroundColor: status === 'marked' ? '#d4edda' : 
                               status === 'error' ? '#f8d7da' : 
                               status === 'active' ? '#d1ecf1' : '#fff',
                border: `3px solid ${status === 'marked' ? '#28a745' : 
                                     status === 'error' ? '#dc3545' : 
                                     status === 'active' ? '#17a2b8' : '#ddd'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
                <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold',
                    marginBottom: '10px',
                    color: status === 'marked' ? '#155724' : 
                           status === 'error' ? '#721c24' : 
                           status === 'active' ? '#0c5460' : '#666'
                }}>
                    Status: {status.toUpperCase()}
                </div>
                <div style={{ 
                    fontSize: '16px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                }}>
                    {message}
                </div>
                {status === 'active' && (
                    <div style={{ 
                        marginTop: '15px',
                        padding: '10px',
                        backgroundColor: 'rgba(255,255,255,0.7)',
                        borderRadius: '5px',
                        fontSize: '14px'
                    }}>
                        👁️ <strong>Instructions:</strong><br/>
                        1. Position your face in the center<br/>
                        2. Look at the camera<br/>
                        3. BLINK naturally several times<br/>
                        4. Wait for verification
                    </div>
                )}
            </div>

            {/* Debug Info */}
            {debugInfo && (
                <div style={{
                    padding: '10px',
                    marginBottom: '15px',
                    fontSize: '12px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    color: '#856404',
                    border: '1px solid #ffc107'
                }}>
                    🔧 {debugInfo}
                </div>
            )}

            {/* Start/Stop Button */}
            {!isServiceRunning && status !== 'marked' ? (
                <button 
                    onClick={startCamera}
                    style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: '300px',
                        margin: '0 auto 20px',
                        padding: '18px 30px',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(40, 167, 69, 0.3)',
                        transition: 'all 0.3s'
                    }}
                    onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
                    onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                >
                    ▶️ Start Attendance
                </button>
            ) : isServiceRunning && (
                <button 
                    onClick={stopCamera}
                    style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: '300px',
                        margin: '0 auto 20px',
                        padding: '18px 30px',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(220, 53, 69, 0.3)'
                    }}
                >
                    ⏹️ Stop Camera
                </button>
            )}
            
            {/* Video Display */}
            <div style={{ 
                position: 'relative',
                width: '100%',
                maxWidth: '640px',
                margin: '0 auto',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: '#000',
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
            }}>
                {status === 'marked' ? (
                    <div style={{
                        padding: '100px 20px',
                        textAlign: 'center',
                        backgroundColor: '#d4edda',
                        color: '#155724'
                    }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
                        <h2 style={{ fontSize: '28px', margin: '0 0 15px 0' }}>
                            ATTENDANCE MARKED!
                        </h2>
                        <p style={{ fontSize: '18px', margin: 0 }}>
                            Thank you! You may close this window.
                        </p>
                    </div>
                ) : isServiceRunning ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'block',
                                transform: 'scaleX(-1)' ,// Mirror effect
                                minHeight: '480px',
                                objectFit: 'cover',
                                minHeight: '480px'
                            }}
                        />
                        {/* Overlay with face detection guide */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '200px',
                            height: '250px',
                            border: '3px dashed rgba(255,255,255,0.5)',
                            borderRadius: '50%',
                            pointerEvents: 'none'
                        }} />
                        {/* Stats overlay */}
                        <div style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '10px',
                            right: '10px',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            padding: '10px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontFamily: 'monospace'
                        }}>
                            Frames: {framesSent} | Faces Detected: {facesDetected}
                        </div>
                    </>
                ) : (
                    <div style={{
                        padding: '100px 20px',
                        textAlign: 'center',
                        backgroundColor: '#e2e3e5',
                        color: '#6c757d'
                    }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📹</div>
                        <h2 style={{ margin: '0 0 10px 0' }}>Camera Inactive</h2>
                        <p style={{ margin: 0 }}>Click "Start Attendance" to begin</p>
                    </div>
                )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
}

export default CameraFeed;