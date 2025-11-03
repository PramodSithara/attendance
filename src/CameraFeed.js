import React, { useState, useEffect, useRef, useCallback } from 'react';
// Assuming your Flask backend is running on the same machine on port 5000
// When deploying, replace 'localhost' with your public HTTPS/Ngrok URL (e.g., 'https://your-ngrok-domain.app')
const BACKEND_URL = 'https://3d74a0e0cdc0.ngrok-free.app'; 
const VIDEO_FEED_URL = `${BACKEND_URL}/video_feed`;
const STATUS_URL = `${BACKEND_URL}/status`;
const STATUS_INTERVAL_MS = 1000; // Check status every 1 second

function CameraFeed() {
    const [isServiceRunning, setIsServiceRunning] = useState(false);
    const [status, setStatus] = useState('inactive');
    const [message, setMessage] = useState('Press "Start Attendance" to launch the service.');
    
    // Ref for the status polling interval
    const statusIntervalRef = useRef(null);

    // --- Status Polling Logic ---
    const checkStatus = useCallback(async () => {
        try {
            const response = await fetch(STATUS_URL);
            if (!response.ok) {
                throw new Error(`HTTP status ${response.status}`);
            }
            const data = await response.json();
            
            setStatus(data.status);
            setMessage(data.message);

            // Logic to stop the service after attendance is marked
            if (data.status === 'marked' || data.status === 'error') {
                clearInterval(statusIntervalRef.current);
                setIsServiceRunning(false);
            }
        } catch (error) {
            console.error("Status check error:", error);
            // If the backend is completely offline (e.g., CORS/Network failure)
            setMessage('Backend service connection lost. Please check Flask server.');
            setStatus('error');
            clearInterval(statusIntervalRef.current);
            setIsServiceRunning(false);
        }
    }, []);

    // --- Service Control & Status Polling Effect ---
    useEffect(() => {
        if (isServiceRunning) {
            setMessage('Service is starting... Waiting for video stream.');
            
            // Start polling the backend status
            statusIntervalRef.current = setInterval(checkStatus, STATUS_INTERVAL_MS);
        } else {
            // Cleanup: stop polling when the service is inactive
            clearInterval(statusIntervalRef.current);
        }

        // Cleanup function on unmount
        return () => {
            clearInterval(statusIntervalRef.current);
        };
    }, [isServiceRunning, checkStatus]);

    // --- Handlers ---
    const handleStartService = () => {
        setIsServiceRunning(true);
        setStatus('starting');
        setMessage('Attempting to connect to the video feed...');
    };

    const handleStopService = () => {
        // Manually stop the service
        setIsServiceRunning(false);
        setStatus('inactive');
        setMessage('Service manually stopped. Press "Start Attendance" to relaunch.');
    };

    // --- Render Component ---
    return (
        <div className="camera-container" style={styles.container}>
            <h1>Live Attendance Stream</h1>
            
            <div 
                className={`status-box ${status}`} 
                style={{...styles.statusBox, backgroundColor: status === 'active' ? '#4CAF50' : status === 'marked' ? '#2196F3' : '#F44336'}}
            >
                Status: <strong>{status.toUpperCase()}</strong>
                <p>{message}</p>
            </div>

            <div style={styles.buttonGroup}>
                {!isServiceRunning ? (
                    <button 
                        onClick={handleStartService} 
                        style={styles.startButton}
                        disabled={status === 'starting'}
                    >
                        ▶️ Start Attendance Service
                    </button>
                ) : (
                    <button 
                        onClick={handleStopService} 
                        style={styles.stopButton}
                    >
                        ⏹️ Stop Service
                    </button>
                )}
            </div>
            
            <div style={styles.videoFeed}>
                {isServiceRunning && status !== 'error' ? (
                    // The core MJPEG implementation: The <img> tag consumes the /video_feed route
                    <img
                        src={VIDEO_FEED_URL}
                        alt="Live Video Stream"
                        style={styles.liveStream}
                        // The 'key' forces the image to reload if the URL changes, 
                        // though here it helps ensure a fresh stream connection.
                        key={isServiceRunning} 
                    />
                ) : (
                    <div style={styles.placeholder}>
                        <h2>{status === 'marked' ? "ATTENDANCE MARKED" : "Service Offline"}</h2>
                        <p>{status === 'marked' ? "System shut down." : "Press Start to begin stream."}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Basic Inline Styles for clarity (You should move this to a CSS file)
const styles = {
    container: { textAlign: 'center', padding: '20px', fontFamily: 'Arial, sans-serif' },
    statusBox: { padding: '10px', margin: '20px auto', width: '80%', maxWidth: '500px', borderRadius: '5px', color: 'white' },
    buttonGroup: { margin: '20px 0' },
    startButton: { padding: '10px 20px', fontSize: '16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
    stopButton: { padding: '10px 20px', fontSize: '16px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
    videoFeed: { margin: '20px auto', maxWidth: '640px', border: '1px solid #ccc', borderRadius: '5px' },
    liveStream: { width: '100%', height: 'auto', display: 'block' },
    placeholder: { padding: '50px 20px', backgroundColor: '#eee', borderRadius: '5px' }
};

export default CameraFeed;