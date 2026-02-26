
const videoElement = document.getElementById('video');

// Initial auth check for the exam context
if (typeof checkAuth === 'function') {
    checkAuth('student');
}

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  console.log("Proctoring: Media access granted.");
  if (videoElement) videoElement.srcObject = stream;
  monitorAudio(stream);
  startStreaming(); // New function for live streaming
}).catch(err => {
  console.error("Proctoring: Camera/Microphone access denied:", err);
  // Access globals from exam.js defensively
  const currentAttemptId = window.attemptId || (typeof attemptId !== 'undefined' ? attemptId : null);
  if (currentAttemptId) {
      reportViolation("Camera/Microphone disabled");
  } else {
      console.warn("Proctoring: Could not report Camera violation yet (attemptId missing)");
  }
});

let socket;
let isStreamingStarted = false;

// Rate limiting for violation reports: prevent the same type from being sent more than once per 15s
const violationCooldowns = {};
function canReportViolation(type) {
    const now = Date.now();
    if (violationCooldowns[type] && (now - violationCooldowns[type]) < 15000) {
        return false; // Still in cooldown
    }
    violationCooldowns[type] = now;
    return true;
}

function startStreaming() {
    console.log('Proctoring: Initializing live streaming...');
    if (typeof io === 'undefined') {
        console.warn('Socket.io not loaded');
        return;
    }

    if (!socket) {
        const socketUrl = (typeof config !== 'undefined' && config.SOCKET_URL) ? config.SOCKET_URL : window.location.origin;
        console.log('Proctoring: Connecting to socket at:', socketUrl);
        socket = io(socketUrl);

        socket.on('connect', () => {
            console.log('Proctoring: Socket connected. ID:', socket.id);
            const dot = document.getElementById('socket-status-dot');
            const text = document.getElementById('socket-status-text');
            if (dot) dot.className = 'size-2 bg-emerald-500 rounded-full animate-pulse';
            const examMetaForDisplay = JSON.parse(localStorage.getItem('currentExam'));
            const displayId = (examMetaForDisplay && examMetaForDisplay.test_code) ? examMetaForDisplay.test_code : '?';
            if (text) {
                text.textContent = `Proctoring Live (Room: ${displayId})`;
                text.className = 'text-emerald-600 dark:text-emerald-400';
            }
            // Once connected, try to run the join logic immediately
            runJoinLogic();
        });

        socket.on('connect_error', (error) => {
            console.error('Proctoring: Socket connection error:', error);
            const text = document.getElementById('socket-status-text');
            if (text) text.textContent = 'Proctoring Connection Error';
        });

        socket.on('disconnect', () => {
            console.log('Proctoring: Socket disconnected.');
            const dot = document.getElementById('socket-status-dot');
            const text = document.getElementById('socket-status-text');
            if (dot) dot.className = 'size-2 bg-slate-300 rounded-full';
            if (text) {
                text.textContent = 'Proctoring Offline';
                text.className = '';
            }
        });
    }

    runJoinLogic();
}

function runJoinLogic() {
    if (isStreamingStarted) return;

    const urlParams = new URLSearchParams(window.location.search);
    const examMeta = JSON.parse(localStorage.getItem('currentExam'));
    
    // Standardize: Use test_code for Socket.io room
    const examId = (examMeta && examMeta.test_code) ? examMeta.test_code : urlParams.get('id');
    
    const userData = JSON.parse(localStorage.getItem('user'));
    const currentAttemptId = window.attemptId || (typeof attemptId !== 'undefined' ? attemptId : null);

    if (!examId || !userData) return;

    if (!currentAttemptId) {
        console.warn('Proctoring: attemptId missing, retrying in 2s...');
        setTimeout(runJoinLogic, 2000);
        return;
    }

    if (!socket || !socket.connected) {
        console.log('Proctoring: Waiting for socket connection to join room...');
        return; // Will be called again by connect listener
    }

    console.log('Proctoring: Joining exam room:', examId);
    socket.emit('join-exam', examId);
    isStreamingStarted = true;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 160;
    canvas.height = 120;

    let frameCount = 0;
    setInterval(() => {
        if (videoElement && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
            context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const frame = canvas.toDataURL('image/jpeg', 0.5);
            socket.emit('video-frame', {
                examId,
                studentId: userData.id,
                studentName: userData.name,
                frame
            });
            if (frameCount < 3) {
                console.log('Proctoring: Streaming frames...');
                frameCount++;
            }
        }
    }, 2000);
}

function monitorAudio(stream) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const mic = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    mic.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    setInterval(() => {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        analyser.getByteFrequencyData(data);
        let volume = data.reduce((a, b) => a + b) / data.length;

        if(volume > 50){
            reportViolation("Talking detected");
        }
    }, 2000);
  } catch (e) {
      console.error("Audio monitoring failed:", e);
  }
}

async function reportViolation(type) {
  // Rate limit: only fire once per 15 seconds per violation type
  if (!canReportViolation(type)) {
      return;
  }

  // Use metadata from exam.js if available
  const examMeta = JSON.parse(localStorage.getItem('currentExam'));
  const currentAttemptId = window.attemptId || (typeof attemptId !== 'undefined' ? attemptId : null);

  if (!examMeta || !currentAttemptId) {
      console.warn('Proctoring: Cannot report violation, missing exam metadata or attemptId:', { examMeta: !!examMeta, currentAttemptId });
      return;
  }

  console.log(`Proctoring: Reporting violation: ${type}`);

  // Use the hardened apiCall if available
  if (typeof apiCall === 'function') {
      try {
          const response = await apiCall('/violation', 'POST', {
              attempt_id: currentAttemptId,
              test_id: examMeta.id,
              type: type,
              timestamp: Date.now()
          });
          if (!response.success) {
              console.warn('Violation reporting failed:', response.message);
          }
      } catch (e) {
          console.error("Violation report error:", e);
      }
      return;
  }

  // Fallback to basic fetch if apiCall is missing (though it shouldn't be)
  const token = localStorage.getItem('token');
  if (!token) return;

  let url = "/api/violation";
  if (typeof config !== 'undefined' && config.API_BASE_URL) {
      url = `${config.API_BASE_URL}/violation`;
  }

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      attempt_id: currentAttemptId,
      test_id: examMeta.id,
      type: type,
      timestamp: Date.now()
    })
  }).catch(err => console.error("Could not report violation fallback:", err));
}

// MediaPipe Face Detection
if (typeof FaceDetection !== 'undefined') {
    const faceDetection = new FaceDetection({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
      }
    });

    faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5
    });

    faceDetection.onResults(results => {
      if(!results.detections || results.detections.length === 0) {
         reportViolation("No face detected");
      } else if(results.detections.length > 1) {
         reportViolation("Multiple faces detected");
      }
    });

    if (videoElement && typeof Camera !== 'undefined') {
        const camera = new Camera(videoElement, {
          onFrame: async () => {
            await faceDetection.send({image: videoElement});
          },
          width: 640,
          height: 480
        });
        camera.start();
    }
}

// Document visibility & Fullscreen listeners
document.addEventListener("visibilitychange", () => {
  if(document.hidden){
    reportViolation("Tab switched");
  }
});

document.addEventListener("fullscreenchange", () => {
  if(!document.fullscreenElement){
    reportViolation("Exited fullscreen");
  }
});
