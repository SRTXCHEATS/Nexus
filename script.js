import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    signInWithPhoneNumber, RecaptchaVerifier, updatePassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, collection, onSnapshot, query, orderBy, addDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Core Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAdzFbFCyXB4hwAx16_NNefjZG8FAGBR0w",
  authDomain: "openai-b22b7.firebaseapp.com",
  projectId: "openai-b22b7",
  storageBucket: "openai-b22b7.firebasestorage.app",
  messagingSenderId: "603292350539",
  appId: "1:603292350539:web:81f0e12ac1ab6c2a85b5ce",
  measurementId: "G-DP803BRLGV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

auth.useDeviceLanguage();

let currentUserData = null;
let activeConfirmationResult = null;
let unsubscribeUserHistory = null;

// 📢 Enter your operational Groq API Key inside the quotes:
const GROQ_API_KEY = "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"; 

// --- AUTHENTICATION INTERFACE MANAGER ---
window.switchAuthTab = function(type) {
    document.getElementById('tabEmail').classList.toggle('active', type === 'email');
    document.getElementById('tabPhone').classList.toggle('active', type === 'phone');
    document.getElementById('emailAuthSection').classList.toggle('hidden', type !== 'email');
    document.getElementById('phoneAuthSection').classList.toggle('hidden', type === 'email');
};

function toggleInterface(isLoggedIn) {
    if(isLoggedIn) {
        document.getElementById('authContainer').classList.remove('show');
        document.getElementById('appContainer').classList.remove('hidden');
    } else {
        document.getElementById('authContainer').classList.add('show');
        document.getElementById('appContainer').classList.add('hidden');
        document.getElementById('banOverlay').classList.add('hidden');
    }
}

// --- EMAIL & PASSWORD ACCESS ROUTINES ---
window.handleEmailAuth = async function(mode) {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if(!email || !password) return alert("All credentials mandatory.");
    
    try {
        if(mode === 'register') {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", credential.user.uid), {
                uid: credential.user.uid,
                name: email.split('@')[0],
                phone: "",
                status: "active",
                role: "user"
            });
            alert("Registration validated! Launching Core Ecosystem.");
            toggleInterface(true);
        } else if(mode === 'login') {
            await signInWithEmailAndPassword(auth, email, password);
            alert("Access authorized. Syncing node...");
            toggleInterface(true);
        }
    } catch(err) { 
        if (err.code === "auth/email-already-in-use") {
            alert("This email is already registered. Please sign in.");
        } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
            alert("Invalid email credentials or password mapping.");
        } else {
            alert("System Alert: " + err.message);
        }
    }
};

// --- SECURE PHONE AUTHORIZATION ---
window.handlePhoneAuth = async function() {
    if (window.location.protocol === 'file:') {
        return alert("ERROR: Phone Auth running from local file system is restricted.");
    }
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'sign-in-button', { 'size': 'invisible' });
    }
    const phoneNumber = document.getElementById('authPhone').value.trim();
    if(!phoneNumber.startsWith('+')) return alert("Country code mapping required: +97798xxxxxxxx");

    try {
        activeConfirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
        document.getElementById('verificationCode').classList.remove('hidden');
        document.getElementById('verifyOtpBtn').classList.remove('hidden');
        alert("OTP secure string dispatched.");
    } catch(err) { alert("Matrix Fault: " + err.message); }
};

window.handleOtpVerification = async function() {
    const code = document.getElementById('verificationCode').value.trim();
    try {
        const result = await activeConfirmationResult.confirm(code);
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        if(!userDoc.exists()) {
            await setDoc(doc(db, "users", result.user.uid), {
                uid: result.user.uid,
                name: "Node_" + result.user.uid.substring(0,5),
                phone: result.user.phoneNumber,
                status: "active",
                role: "user"
            });
        }
        toggleInterface(true);
    } catch(err) { alert("Invalid OTP Verification code."); }
};

// --- SECURITY OBSERVER & INTERCEPT ROUTINES ---
onAuthStateChanged(auth, async (user) => {
    if(user) {
        onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if(!docSnap.exists()) return;
            const data = docSnap.data();
            currentUserData = data;

            if(data.status === "blocked" || data.status === "banned") {
                document.getElementById('banMessage').innerText = `Your terminal has been isolated. Status: [${data.status.toUpperCase()}].`;
                document.getElementById('banOverlay').classList.remove('hidden');
                document.getElementById('appContainer').classList.add('hidden');
                document.getElementById('authContainer').classList.add('hidden');
                return;
            }

            document.getElementById('banOverlay').classList.add('hidden');
            document.getElementById('navUserName').innerText = data.name;
            document.getElementById('userRoleBadge').innerText = data.role.toUpperCase();
            document.getElementById('profileName').value = data.name;
            document.getElementById('profilePhone').value = data.phone || "";
            
            // Fixed Vector User Circle Element Injection (No Crown, No Emojis)
            const iconHtml = `<i class="fas fa-user-circle" style="color: #00f2fe; font-size: 1.3rem;"></i>`;
            document.getElementById('navAvatarIcon').innerHTML = iconHtml;
            document.getElementById('modalAvatarIcon').innerHTML = iconHtml;

            if(data.role === "admin") {
                document.getElementById('adminPanelLink').classList.remove('hidden');
            }

            toggleInterface(true);
            loadActiveChatHistory(user.uid);
        });
    } else {
        toggleInterface(false);
    }
});

window.logout = () => signOut(auth);

// --- CORE NEXUS AI PIPELINE (GROQ ASSISTANT DRIVER) ---
async function loadActiveChatHistory(uid) {
    const q = query(collection(db, `users/${uid}/chats`), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        const chatContainer = document.getElementById('chatContainer');
        const systemInitMsg = chatContainer.querySelector('.system-init');
        chatContainer.innerHTML = "";
        if(systemInitMsg) chatContainer.appendChild(systemInitMsg);
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            appendMessageUI(data.text, data.sender);
        });
    });
}

function appendMessageUI(text, sender) {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.innerText = text;
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('userInput').addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

async function sendMessage() {
    const input = document.getElementById("userInput");
    const text = input.value.trim();

    if (!text || !auth.currentUser) return;

    input.value = "";

    await addDoc(
        collection(db, `users/${auth.currentUser.uid}/chats`),
        {
            text,
            sender: "user",
            timestamp: Date.now()
        }
    );

    const loader = document.getElementById("aiTypingIndicator");
    loader.classList.remove("hidden");

    try {

        if (!GROQ_API_KEY || GROQ_API_KEY.length < 20) {
            throw new Error("Groq API Key missing.");
        }

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "system",
                            content: "You are SRT Nexus AI Assistant."
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1024
                })
            }
        );

        const data = await response.json();

        console.log("Groq Response:", data);

        if (!response.ok) {
            throw new Error(
                data.error?.message ||
                `HTTP ${response.status}`
            );
        }

        const aiReply =
            data?.choices?.[0]?.message?.content ||
            "No response generated.";

        await addDoc(
            collection(db, `users/${auth.currentUser.uid}/chats`),
            {
                text: aiReply,
                sender: "ai",
                timestamp: Date.now()
            }
        );

    } catch (err) {

        console.error("Groq Error:", err);

        await addDoc(
            collection(db, `users/${auth.currentUser.uid}/chats`),
            {
                text: `SYSTEM ERROR: ${err.message}`,
                sender: "ai",
                timestamp: Date.now()
            }
        );

    } finally {
        loader.classList.add("hidden");
    }
}


window.appendMessageUI = function(text, sender) {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    
    // स्पिकर र कपि बटनको लागि HTML (AI म्यासेजमा मात्र)
    let actionButtons = "";
    if (sender === 'ai') {
        const escapedText = text.replace(/'/g, "\\'"); // quote error हटाउन
        actionButtons = `
            <div class="message-actions">
                <button onclick="speakText('${escapedText}')" title="Listen"><i class="fas fa-volume-up"></i></button>
                <button onclick="copyMessage('${escapedText}')" title="Copy"><i class="fas fa-copy"></i></button>
            </div>
        `;
    }
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${text}</p>
            ${actionButtons}
        </div>
    `;
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

// --- LIVE COMMUNICATION ORB ---
window.startLiveCommunication = async function() {
    document.getElementById('liveCommOverlay').classList.remove('hidden');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const orb = document.getElementById('orb');

    function animate() {
        if (document.getElementById('liveCommOverlay').classList.contains('hidden')) return;
        analyser.getByteFrequencyData(dataArray);
        let vol = dataArray.reduce((a, b) => a + b) / dataArray.length;
        orb.style.transform = `scale(${1 + vol / 50})`;
        requestAnimationFrame(animate);
    }
    animate();
};

window.toggleMute = function() {
    alert("माइक म्युट/अनम्युट गरियो।");
};

window.closeLiveComm = function() {
    document.getElementById('liveCommOverlay').classList.add('hidden');
};
// --- USER PROFILE MANAGEMENT ---
window.toggleProfileModal = () => document.getElementById('profileModal').classList.toggle('show');

window.saveProfileChanges = async function() {
    const name = document.getElementById('profileName').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    if(!name) return alert("System Identity parameter required.");
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { name: name, phone: phone });
        if(password) await updatePassword(auth.currentUser, password);
        alert("Ecosystem configuration rewritten.");
        toggleProfileModal();
    } catch(err) { alert(err.message); }
};

// --- CENTRAL ADMINISTRATIVE PANEL SYSTEM ---
window.openAdminPanel = function() {
    document.getElementById('adminPanel').classList.add('show');
    onSnapshot(collection(db, "users"), (snapshot) => {
        const listContainer = document.getElementById('adminUserList');
        listContainer.innerHTML = "";
        snapshot.forEach((userDoc) => {
            const data = userDoc.data();
            if(data.uid === auth.currentUser.uid) return;

            const card = document.createElement('div');
            card.classList.add('admin-user-card');
            card.innerHTML = `
                <div style="color: #00f2fe; padding:5px;"><i class="fas fa-user"></i></div>
                <div style="flex:1;">
                    <div><b>${data.name}</b></div>
                    <span class="usr-badge badge-${data.status}">${data.status.toUpperCase()}</span>
                    <span class="usr-badge" style="background:#1a2438; color:#00f2fe;">${data.role.toUpperCase()}</span>
                </div>
            `;
            card.onclick = () => loadUserInAdminConsole(data.uid);
            listContainer.appendChild(card);
        });
    });
};

window.closeAdminPanel = () => document.getElementById('adminPanel').classList.remove('show');

async function loadUserInAdminConsole(targetUid) {
    const userDoc = await getDoc(doc(db, "users", targetUid));
    if(!userDoc.exists()) return;
    const data = userDoc.data();

    const pane = document.getElementById('userDetailsPane');
    pane.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px; margin-bottom:15px;">
            <div style="color: #00f2fe; font-size:1.5rem;"><i class="fas fa-user-circle"></i></div>
            <div>
                <h2>${data.name}</h2>
                <p style="color:#aaa; font-size:0.8rem;">UID: ${data.uid}</p>
                <p style="color:#888; font-size:0.8rem;">Phone Connection: ${data.phone || 'None linked'}</p>
            </div>
        </div>
        
        <div class="admin-actions-grid">
            <button class="btn-block" onclick="changeStatus('${data.uid}', 'blocked')">Block Node</button>
            <button class="btn-ban" onclick="changeStatus('${data.uid}', 'banned')">Ban Terminal</button>
            <button class="btn-unblock" onclick="changeStatus('${data.uid}', 'active')">Restore Node</button>
        </div>

        <h3 style="margin-top:20px; font-family:'Orbitron'; color:#ff3b30; font-size:0.85rem;">Live Matrix Wiretap Sync</h3>
        <div class="adm-history-box" id="admHistoryBox">Intercepting system lines...</div>
    `;

    const q = query(collection(db, `users/${targetUid}/chats`), orderBy("timestamp", "asc"));
    if(unsubscribeUserHistory) unsubscribeUserHistory();
    unsubscribeUserHistory = onSnapshot(q, (snapshot) => {
        const histBox = document.getElementById('admHistoryBox');
        histBox.innerHTML = "";
        snapshot.forEach((m) => {
            const msg = m.data();
            const color = msg.sender === 'user' ? '#00f2fe' : '#fff';
            histBox.innerHTML += `<p style="color:${color}; margin-bottom: 4px;"><b>[${msg.sender.toUpperCase()}]:</b> ${msg.text}</p>`;
        });
        histBox.scrollTop = histBox.scrollHeight;
    });
}

window.changeStatus = async function(uid, status) {
    await updateDoc(doc(db, "users", uid), { status: status });
    alert(`Target operational cluster updated to: -> ${status.toUpperCase()}`);
    loadUserInAdminConsole(uid);
};


window.startLiveCommunication = function() {
    // ओभरले देखाउनुहोस्
    document.getElementById('liveCommOverlay').classList.remove('hidden');
    document.getElementById('liveCommOverlay').classList.add('show');
    
    // इनपुट बक्स बन्द गर्ने
    document.getElementById('userInput').disabled = true;
    document.getElementById('sendBtn').disabled = true;
};

window.closeLiveComm = function() {
    // ओभरले बन्द गर्ने
    document.getElementById('liveCommOverlay').classList.add('hidden');
    document.getElementById('liveCommOverlay').classList.remove('show');
    
    // इनपुट बक्स सुचारु गर्ने
    document.getElementById('userInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
};


const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ne-NP'; // नेपाली भाषाको लागि

window.startLiveCommunication = async function() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        document.getElementById('liveCommOverlay').classList.remove('hidden');
        recognition.start();
    } catch (err) {
        alert("माइक्रोफोनको पहुँच दिनुहोस्। ब्राउजर सेटिङमा 'Allow' मा क्लिक गर्नुहोस्।");
    }
};

recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('userInput').value = transcript;
    closeLiveComm();
    sendMessage(); // रेकर्ड भएको आवाजलाई सन्देशको रूपमा पठाउने
};

// साइडबार मेनु खोल्ने र बन्द गर्ने फंक्सन
function toggleMenu() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
        sidebar.classList.toggle("active");
    }
}

// बाहिर क्लिक गर्दा साइडबार बन्द गर्ने (वैकल्पिक तर उपयोगी)
window.onclick = function(event) {
    const sidebar = document.getElementById("sidebar");
    if (event.target !== sidebar && !sidebar.contains(event.target) && !event.target.classList.contains('menu-trigger')) {
        sidebar.classList.remove("active");
    }
}

window.toggleMenu = toggleMenu;


// २. Text-to-Speech (साउन्ड प्ले गर्ने)
// म्यासेज पढ्ने मुख्य फंक्सन
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US'; // आवश्यकता अनुसार 'ne-NP' पनि गर्न सकिन्छ
        window.speechSynthesis.speak(utterance);
    } else {
        alert("Sorry, your browser doesn't support Text-to-Speech!");
    }
}

// AI म्यासेज बनाउँदा यो बटन थप्नुहोस्
function addAiMessage(text) {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${text}</p>
            <button class="speak-btn" onclick="speakText('${text.replace(/'/g, "\\'")}')">
                <i class="fas fa-volume-up"></i>
            </button>
        </div>
    `;
    chatContainer.appendChild(messageDiv);
}

// ३. Copy Text
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => alert("Copied!"));
}

// ४. Chat मा बटन थप्ने लजिक (तपाईंको म्यासेज पठाउने फंक्सन भित्र)
// म्यासेज डिस्प्ले गर्दा यो ढाँचा प्रयोग गर्नुहोस्:
function displayMessage(message) {
    // नाम जाँच गर्ने लजिक
    let msg = message;
    if (message.toLowerCase().includes("what is your name")) {
        msg = "My name is SRT Nexus, created by SRT X CHITS.";
    }

    const chat = document.getElementById("chatContainer");
    chat.innerHTML += `
        <div class="msg">
            ${msg}
            <button onclick="copyToClipboard('${msg}')"><i class="fas fa-copy"></i></button>
            <button onclick="speakText('${msg}')"><i class="fas fa-volume-up"></i></button>
        </div>
    `;
}

// ५. भाषा अनुवाद (कमाण्ड लजिक)
// म्यासेज पठाउने ठाउँमा यो थप्नुहोस्:
let currentMode = "normal"; // normal, nepali, english

function handleCommand(input) {
    if (input.startsWith("/nepali")) {
        currentMode = "nepali";
        return "Mode switched to Nepali";
    } else if (input.startsWith("/english")) {
        currentMode = "english";
        return "Mode switched to English";
    }
}
// १. च्याट सेसनहरू स्टोर गर्ने एरे
let chatSessions = JSON.parse(localStorage.getItem('chatSessions')) || [
    { id: Date.now(), name: "Chat 1", messages: [] }
];
let currentSessionId = chatSessions[0].id;

// २. 'New Chat' क्लिक गर्दा चल्ने फंक्सन
function startNewChat() {
    const newSession = {
        id: Date.now(), // युनिक आईडी
        name: `Chat ${chatSessions.length + 1}`,
        messages: []
    };
    
    chatSessions.push(newSession);
    currentSessionId = newSession.id;
    
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    
    // च्याट इन्टरफेस खाली गर्ने
    document.getElementById('chatContainer').innerHTML = `
        <div class="message ai-message system-init">
            <div class="message-content"><p>SYSTEM: New connection established. Ready.</p></div>
        </div>`;
    
    renderHistory(); // हिस्ट्री अपडेट गर्ने
    toggleMenu(); // मेनु बन्द गर्ने
}

// ३. हिस्ट्री लिस्ट र रिनेम फंक्सन
function renderHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = "";
    
    chatSessions.forEach(session => {
        historyList.innerHTML += `
            <div class="history-item">
                <span onclick="loadSession(${session.id})">${session.name}</span>
                <i class="fas fa-edit" onclick="renameChat(${session.id})"></i>
            </div>`;
    });
}

// ४. रिनेम लजिक
function renameChat(id) {
    const newName = prompt("Enter new name for this chat:");
    if (newName) {
        const session = chatSessions.find(s => s.id === id);
        if (session) {
            session.name = newName;
            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
            renderHistory();
        }
    }
}

// ५. च्याट लोड गर्ने लजिक
function loadSession(id) {
    currentSessionId = id;
    const session = chatSessions.find(s => s.id === id);
    
    // यहाँ तपाईंको पुरानो च्याट म्यासेजहरूलाई DOM मा लोड गर्ने कोड राख्नुहोस्
    alert("Loading: " + session.name);
    toggleMenu();
}

// सुरुमा पेज लोड हुँदा हिस्ट्री देखाउने
renderHistory();

