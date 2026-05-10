// ==========================================
        // 🚨 1. YOUR EXACT FIREBASE CONFIG 🚨
        // ==========================================
        const firebaseConfig = {
            apiKey: "AIzaSyB8hdK8UXUImyLrjvLqjua7h1yKSwTqcsw",
            authDomain: "bsece-reviewer.firebaseapp.com",
            projectId: "bsece-reviewer",
            storageBucket: "bsece-reviewer.firebasestorage.app",
            messagingSenderId: "650770339016",
            appId: "1:650770339016:web:3d1ff80e0118ad3d8fc1fd",
            measurementId: "G-50EVFFMBDS"
        };

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        const auth = firebase.auth();
        const db = firebase.firestore();
        const storage = firebase.storage();

        // ==========================================
        // 🚨 AUDIO MANAGER 🚨
        // ==========================================
        const sfx = {
            click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
            correct: new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'),
            wrong: new Audio('https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3'),
            complete: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'),
            fail: new Audio('https://assets.mixkit.co/active_storage/sfx/2954/2954-preview.mp3')
        };
        // Preload settings
        Object.values(sfx).forEach(audio => {
            audio.volume = 0.5;
            audio.load();
        });

        function playSound(type) {
            if(sfx[type]) {
                sfx[type].currentTime = 0;
                sfx[type].play().catch(e => console.log('Audio play prevented:', e));
            }
        }


        // ==========================================
        // 🚨 HELPER: KATEX MATH RENDERER 🚨
        // ==========================================
        function renderMath(elementId) {
            const el = document.getElementById(elementId);
            if (el && window.renderMathInElement) {
                renderMathInElement(el, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false
                });
            }
        }

        // subjectsConfig removed. Relying purely on Firestore.

        // ==========================================
        // APP STATE
        // ==========================================
        let currentUser = null;
        let userData = { totalScore: 0, maxStreak: 0 };
        
        let appData = []; 
        let screens = ['screen-auth', 'screen-dashboard', 'screen-leaderboard', 'screen-main', 'screen-review', 'screen-mode', 'screen-game', 'screen-end', 'screen-builder'];
        let activeQuestions = [];
        let currentQIndex = 0;
        let selectedMultiChoices = [];
        let gameStyle = 'survival';
        let score = 0, streak = 0, maxStreak = 0;
        let lives = 8;
        const MAX_LIVES = 8;
        const BASE_POINTS = 100;
        let correctAnswersCount = 0, wrongAnswersCount = 0;
        let TIME_LIMIT = 10, timeLeft = TIME_LIMIT, timerInterval;

        let currentSubjectKey = "";
        let currentModeId = "";
        let modeToRestart = null; // Used for tracking restart modal target

        const topicStyles = [
            { icon: "fa-microchip", color: "from-cyan-500 to-blue-500", text: "text-cyan-400" },
            { icon: "fa-memory", color: "from-emerald-500 to-teal-500", text: "text-emerald-400" },
            { icon: "fa-network-wired", color: "from-blue-500 to-indigo-500", text: "text-blue-400" }
        ];

        // ==========================================
        // FIREBASE AUTHENTICATION LOGIC
        // ==========================================
        auth.onAuthStateChanged(user => {
            if (user) {
                currentUser = user;
                const displayName = user.email.split('@')[0];
                document.getElementById('dash-student-id').innerText = displayName;
                fetchUserData(user.uid);
                syncSessionsFromCloud(); // Pull existing sessions from Firebase
                switchScreen('screen-dashboard');
                renderSubjectButtons();
            } else {
                currentUser = null;
                switchScreen('screen-auth');
            }
        });

        async function handleSignUp() {
            const email = document.getElementById('auth-email').value.trim().toLowerCase();
            const pass = document.getElementById('auth-pass').value;
            const btn = document.getElementById('btn-signup');
            
            if(!email || !pass || pass.length < 6) {
                showAuthMessage("Please provide your email and a password (min. 6 characters).");
                return;
            }

            if(!email.endsWith('@cvsu.edu.ph')) {
                showAuthMessage("Please use your official @cvsu.edu.ph email address.");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Registering...`;

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
                const displayName = email.split('@')[0];
                
                await db.collection('users').doc(userCredential.user.uid).set({
                    email: email,
                    displayName: displayName,
                    totalScore: 0,
                    maxStreak: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                document.getElementById('auth-error').classList.add('hidden');
            } catch(error) {
                let msg = "An error occurred.";
                if(error.code === 'auth/email-already-in-use') msg = "Email is already registered.";
                if(error.code === 'auth/invalid-email') msg = "Invalid email format.";
                showAuthMessage(msg);
            }
            btn.disabled = false;
            btn.innerHTML = `Sign Up`;
        }

        async function handleLogin() {
            const email = document.getElementById('auth-email').value.trim().toLowerCase();
            const pass = document.getElementById('auth-pass').value;
            const btn = document.getElementById('btn-login');
            
            if(!email || !pass) { showAuthMessage("Please enter your Email and Password."); return; }

            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Logging in...`;

            try {
                await auth.signInWithEmailAndPassword(email, pass);
                document.getElementById('auth-error').classList.add('hidden');
            } catch(error) {
                showAuthMessage("Incorrect Email or Password.");
            }
            btn.disabled = false;
            btn.innerHTML = `Log In`;
        }

        async function handleForgotPassword() {
            const email = document.getElementById('auth-email').value.trim().toLowerCase();

            if(!email) {
                showAuthMessage("Please enter your Email first to reset password.");
                return;
            }

            try {
                await auth.sendPasswordResetEmail(email);
                showAuthMessage("Reset link sent! Please check your Inbox and SPAM/JUNK folder.", true);
            } catch(error) {
                if(error.code === 'auth/user-not-found') {
                    showAuthMessage("No account found with this email address.");
                } else {
                    showAuthMessage("Error: Could not send reset link. Try again later.");
                }
            }
        }

        function showAuthMessage(msg, isSuccess = false) {
            const msgBox = document.getElementById('auth-error');
            msgBox.innerText = msg;
            msgBox.className = `text-xs font-bold mb-4 text-center py-2 rounded border ${
                isSuccess ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                          : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
            }`;
            msgBox.classList.remove('hidden');
        }

        function handleLogout() {
            auth.signOut();
        }

        async function executeDeleteAccount() {
            if (!currentUser) return;
            const btn = document.getElementById('btn-confirm-delete');
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Deleting...`;

            try {
                // Delete user doc from firestore
                await db.collection('users').doc(currentUser.uid).delete();
                
                // Clear local storage sessions
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.includes(currentUser.uid)) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));

                // Delete auth account
                await currentUser.delete();
                
                document.getElementById('delete-modal').classList.add('hidden');
            } catch (error) {
                console.error(error);
                if (error.code === 'auth/requires-recent-login') {
                    alert("Security Protocol: Please log out and log back in before deleting your account to verify your identity.");
                    document.getElementById('delete-modal').classList.add('hidden');
                } else {
                    alert("Error deleting account. Please try again.");
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = "Delete";
            }
        }

        async function fetchUserData(uid) {
            try {
                const doc = await db.collection('users').doc(uid).get();
                if (doc.exists) {
                    userData = doc.data();
                    document.getElementById('dash-total-score').innerText = userData.totalScore || 0;
                    document.getElementById('dash-max-streak').innerText = userData.maxStreak || 0;
                }
            } catch (err) { console.error("Error fetching user data:", err); }
        }

        // ==========================================
        // LEADERBOARD LOGIC
        // ==========================================
        async function showLeaderboard() {
            switchScreen('screen-leaderboard');
            const listContainer = document.getElementById('leaderboard-list');
            listContainer.innerHTML = `<div class="flex items-center justify-center h-32"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-cyan-500"></i></div>`;

            try {
                // Inalis ang .limit(10) para i-fetch lahat ng students sa section
                const snapshot = await db.collection('users')
                    .orderBy('totalScore', 'desc')
                    .get();

                listContainer.innerHTML = '';
                if(snapshot.empty) {
                    listContainer.innerHTML = `<div class="text-center p-8 text-slate-500">No records found.</div>`;
                    return;
                }

                let rank = 1;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const isCurrentUser = doc.id === currentUser.uid;
                    
                    let rankIcon = `<span class="text-slate-500 font-black text-lg w-8 text-center">${rank}</span>`;
                    if(rank === 1) rankIcon = `<i class="fa-solid fa-trophy text-yellow-400 text-xl w-8 text-center"></i>`;
                    if(rank === 2) rankIcon = `<i class="fa-solid fa-medal text-slate-300 text-xl w-8 text-center"></i>`;
                    if(rank === 3) rankIcon = `<i class="fa-solid fa-medal text-amber-600 text-xl w-8 text-center"></i>`;

                    const displayName = data.displayName || (data.email ? data.email.split('@')[0] : 'Student');

                    const row = document.createElement('div');
                    row.className = `flex items-center justify-between p-4 border-b border-slate-800/50 ${isCurrentUser ? 'bg-cyan-900/20' : 'hover:bg-slate-900'}`;
                    row.innerHTML = `
                        <div class="flex items-center gap-4">
                            ${rankIcon}
                            <div>
                                <p class="text-white font-bold tracking-wider ${isCurrentUser ? 'text-cyan-400' : ''}">${displayName}</p>
                                <p class="text-xs text-slate-500 uppercase">Max Streak: ${data.maxStreak || 0}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-emerald-400 font-black text-xl">${data.totalScore || 0}</p>
                            <p class="text-[10px] text-slate-500 uppercase tracking-widest">PTS</p>
                        </div>
                    `;
                    listContainer.appendChild(row);
                    rank++;
                });

            } catch (err) {
                listContainer.innerHTML = `<div class="text-center p-8 text-rose-500">Failed to load leaderboard.</div>`;
                console.error(err);
            }
        }

        // ==========================================
        // UI & GAME LOGIC
        // ==========================================
        async function renderSubjectButtons() {
            const container = document.getElementById('subject-buttons-container');
            container.innerHTML = '<div class="col-span-full text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin text-2xl"></i><p class="text-xs mt-2">Loading Subjects...</p></div>';
            
            try {
                const snapshot = await db.collection('subjects').get();
                container.innerHTML = '';
                if (snapshot.empty) {
                    container.innerHTML = '<div class="col-span-full text-center text-slate-500">No subjects found. Use the Builder to add some.</div>';
                    return;
                }
                snapshot.forEach(doc => {
                    createSubjectButton(container, doc.id, doc.data());
                });
            } catch (err) { 
                console.error("Error fetching subjects", err); 
                container.innerHTML = '<div class="col-span-full text-center text-rose-500">Error loading subjects.</div>';
            }
        }

        function createSubjectButton(container, subjectKey, config) {
            const btn = document.createElement('button');
            btn.onclick = () => loadSubjectData(subjectKey);
            btn.className = `group bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white p-6 rounded-2xl shadow-md transition-all hover:scale-[1.03] text-left flex flex-col items-center justify-center gap-4`;
            btn.innerHTML = `
                <div class="bg-gradient-to-br ${config.color || 'from-slate-500 to-slate-700'} w-16 h-16 rounded-xl flex items-center justify-center text-3xl shadow-lg shrink-0 group-hover:rotate-6 transition-transform"><i class="fa-solid ${config.icon || 'fa-folder'}"></i></div>
                <div class="text-center w-full"><h4 class="font-bold text-lg text-slate-100 tracking-wider uppercase">${subjectKey}</h4></div>
            `;
            container.appendChild(btn);
        }

        async function loadSubjectData(subjectKey) {
            currentSubjectKey = subjectKey;
            
            let config = null;
            const doc = await db.collection('subjects').doc(subjectKey).get();
            if (doc.exists) config = doc.data();
            if (!config) config = { name: subjectKey, icon: 'fa-folder', color: 'from-slate-500 to-slate-700' };

            document.getElementById('current-subject-title').innerText = config.name;
            document.getElementById('current-subject-icon').innerHTML = `<i class="fa-solid ${config.icon} text-transparent bg-clip-text bg-gradient-to-br ${config.color}"></i>`;
            switchScreen('screen-main');
            document.getElementById('loading-indicator').classList.remove('hidden');
            document.getElementById('error-indicator').classList.add('hidden');
            document.getElementById('main-menu-content').classList.add('hidden');
            
            appData = [];
            try {
                // Fetch custom questions from Firestore
                const snapshot = await db.collection('subjects').doc(subjectKey).collection('questions').get();
                if (!snapshot.empty) {
                    const firestoreData = {};
                    snapshot.forEach(doc => {
                        const q = doc.data();
                        if (!firestoreData[q.topic]) firestoreData[q.topic] = { topic: q.topic, reviewerFacts: [], questions: [] };
                        firestoreData[q.topic].questions.push(q);
                    });
                    appData = appData.concat(Object.values(firestoreData));
                }

                if (appData.length === 0) throw new Error("No data found");
                renderReviewContent();
                renderModeButtons();
                checkResumeSession(); 
                
                document.getElementById('loading-indicator').classList.add('hidden');
                document.getElementById('main-menu-content').classList.remove('hidden');
            } catch (err) {
                document.getElementById('loading-indicator').classList.add('hidden');
                document.getElementById('error-indicator').classList.remove('hidden');
                document.getElementById('error-text').innerHTML = `Failed to fetch data.<br/>Did you create the JSON file?`;
            }
        }

        function switchScreen(screenId) {
            playSound('click');
            screens.forEach(s => document.getElementById(s).classList.add('hidden'));
            document.getElementById(screenId).classList.remove('hidden');
            document.querySelector('.max-w-4xl').scrollTo(0,0);
            
            if (screenId !== 'screen-end') {
                const canvas = document.getElementById('confetti-canvas');
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        function renderReviewContent() {
            const container = document.getElementById('review-content-container');
            container.innerHTML = '';
            let delay = 0;
            appData.forEach((topicData, index) => {
                const style = topicStyles[index % topicStyles.length];
                const section = document.createElement('div');
                section.className = `mb-8 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-inner opacity-0 animate-slide-up`;
                section.style.animationDelay = `${delay}ms`; delay += 150;
                section.innerHTML = `<h3 class="text-lg font-bold mb-4 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r ${style.color}"><i class="fa-solid ${style.icon} ${style.text} mr-2"></i> ${topicData.topic}</h3>`;
                const list = document.createElement('ul');
                list.className = "space-y-4";
                if(topicData.reviewerFacts) {
                    topicData.reviewerFacts.forEach(fact => {
                        const li = document.createElement('li');
                        li.className = "text-slate-300 font-medium text-sm md:text-base flex flex-col gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80";
                        
                        let factText = typeof fact === 'string' ? fact : (fact.text || "");
                        let factImg = typeof fact === 'object' && fact.image ? fact.image : "";
                        let html = '';
                        
                        if (factText) {
                            html += `<div class="flex items-start gap-3 w-full"><i class="fa-solid fa-terminal text-cyan-500 mt-1 shrink-0"></i><span class="flex-grow">${factText}</span></div>`;
                        }
                        if (factImg) {
                            html += `<div class="w-full flex justify-center mt-4 p-2 bg-slate-900 rounded-xl"><img src="${factImg}" class="w-full max-h-96 sm:max-h-[450px] object-contain rounded-lg bg-slate-100"></div>`;
                        }
                        li.innerHTML = html;
                        list.appendChild(li);
                    });
                }
                section.appendChild(list); container.appendChild(section);
            });
            
            // I-render ang mga math equations sa reviewer page
            setTimeout(() => renderMath('review-content-container'), 100);
        }

        function renderModeButtons() {
            const container = document.getElementById('topic-buttons-container');
            container.innerHTML = '';
            appData.forEach((topicData, index) => {
                const style = topicStyles[index % topicStyles.length];
                const btn = document.createElement('button');
                btn.onclick = () => initiateGame(topicData.topic);
                btn.className = `bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white p-5 rounded-2xl shadow-md transition-all hover:scale-[1.02] text-left flex items-center gap-4`;
                btn.innerHTML = `<div class="bg-gradient-to-br ${style.color} w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"><i class="fa-solid ${style.icon}"></i></div>
                    <div><h4 class="font-bold text-sm sm:text-base text-slate-200 uppercase tracking-wider">${topicData.topic}</h4></div>`;
                container.appendChild(btn);
            });
        }

        function setGameStyle(style) {
            gameStyle = style;
            const sBtn = document.getElementById('btn-style-survival'), cBtn = document.getElementById('btn-style-classic');
            if(style === 'survival') {
                sBtn.className = "flex-1 py-2 px-2 rounded-lg font-bold text-xs sm:text-sm bg-cyan-600 text-white border border-cyan-500 uppercase tracking-wider";
                cBtn.className = "flex-1 py-2 px-2 rounded-lg font-bold text-xs sm:text-sm bg-slate-900 text-slate-500 hover:text-white border border-slate-800 uppercase tracking-wider";
            } else {
                cBtn.className = "flex-1 py-2 px-2 rounded-lg font-bold text-xs sm:text-sm bg-cyan-600 text-white border border-cyan-500 uppercase tracking-wider";
                sBtn.className = "flex-1 py-2 px-2 rounded-lg font-bold text-xs sm:text-sm bg-slate-900 text-slate-500 hover:text-white border border-slate-800 uppercase tracking-wider";
            }
            checkResumeSession(); 
        }

        function shuffleArray(array) { let curId = array.length, randId, tmp; while (0 !== curId) { randId = Math.floor(Math.random() * curId); curId -= 1; tmp = array[curId]; array[curId] = array[randId]; array[randId] = tmp; } return array; }

        // ==========================================
        // 🚨 CLOUD SESSION RESUME LOGIC (CROSS-DEVICE) 🚨
        // ==========================================
        async function syncSessionsFromCloud() {
            if (!currentUser) return;
            try {
                // Clear old local cache for sessions
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith(`bsece_resume_${currentUser.uid}`)) keysToRemove.push(key);
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));

                // Download updated sessions from Firestore
                const snapshot = await db.collection('users').doc(currentUser.uid).collection('sessions').get();
                snapshot.forEach(doc => {
                    localStorage.setItem(doc.id, JSON.stringify(doc.data()));
                });
                checkResumeSession(); // Refresh UI if they are on the screen
            } catch (e) {
                console.error("Error syncing sessions from cloud: ", e);
            }
        }

        function saveSession() {
            if (!currentUser || !currentSubjectKey || !currentModeId || activeQuestions.length === 0) return;
            
            if (currentQIndex >= activeQuestions.length || (gameStyle === 'survival' && lives <= 0)) return;

            const sessionData = {
                currentModeId: currentModeId,
                gameStyle: gameStyle,
                currentQIndex: currentQIndex,
                score: score,
                streak: streak,
                maxStreak: maxStreak,
                lives: lives,
                correctAnswersCount: correctAnswersCount,
                wrongAnswersCount: wrongAnswersCount,
                activeQuestions: activeQuestions,
                timeLeft: timeLeft,
                timeLimit: TIME_LIMIT
            };
            
            const localKey = `bsece_resume_${currentUser.uid}_${currentSubjectKey}_${gameStyle}_${currentModeId}`;
            localStorage.setItem(localKey, JSON.stringify(sessionData));
            
            // Upload to Firestore for cross-device support
            db.collection('users').doc(currentUser.uid).collection('sessions').doc(localKey)
              .set(sessionData).catch(e => console.log(e));
              
            checkResumeSession();
        }

        function clearSession(modeId) {
            if (!currentUser || !currentSubjectKey || !modeId) return;
            const localKey = `bsece_resume_${currentUser.uid}_${currentSubjectKey}_${gameStyle}_${modeId}`;
            localStorage.removeItem(localKey);
            
            // Delete from Firestore
            db.collection('users').doc(currentUser.uid).collection('sessions').doc(localKey)
              .delete().catch(e => console.log(e));
              
            checkResumeSession();
        }

        function checkResumeSession() {
            if (!currentUser || !currentSubjectKey) return;
            
            const resumeSec = document.getElementById('resume-section');
            const resumeBtnContainer = document.getElementById('resume-button-container');
            resumeBtnContainer.innerHTML = '';
            
            let hasSavedSessions = false;
            
            const possibleModes = ['all', ...appData.map(t => t.topic)];

            possibleModes.forEach(modeId => {
                const saved = localStorage.getItem(`bsece_resume_${currentUser.uid}_${currentSubjectKey}_${gameStyle}_${modeId}`);
                if (saved) {
                    hasSavedSessions = true;
                    const data = JSON.parse(saved);
                    
                    const modeName = modeId === 'all' ? 'Full System Test' : modeId;
                    const styleIcon = data.gameStyle === 'survival' ? 'fa-battery-quarter text-rose-400' : 'fa-infinity text-cyan-400';
                    const styleLabel = data.gameStyle === 'survival' ? 'Survival' : 'Classic';
                    
                    const wrapper = document.createElement('div');
                    wrapper.className = "flex items-stretch gap-2 sm:gap-3 mb-3 w-full";
                    
                    // Resume Button (Takes most of the space)
                    const resumeBtn = document.createElement('button');
                    resumeBtn.onclick = () => resumeGame(modeId);
                    resumeBtn.className = `flex-grow bg-slate-900 border-2 border-orange-500/50 hover:border-orange-400 text-white p-3 sm:p-5 rounded-xl sm:rounded-2xl shadow-[0_0_15px_rgba(249,115,22,0.15)] transition-transform hover:scale-[1.02] text-left flex items-center gap-3 sm:gap-4 overflow-hidden min-w-0`;
                    resumeBtn.innerHTML = `
                        <div class="bg-orange-500/20 w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-lg sm:text-xl shrink-0 text-orange-400 border border-orange-500/30">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                        </div>
                        <div class="flex-grow min-w-0">
                            <h4 class="font-bold text-xs sm:text-base text-orange-400 uppercase tracking-wider truncate block">${modeName}</h4>
                            <div class="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest truncate">
                                <span class="flex items-center gap-1 shrink-0"><i class="fa-solid ${styleIcon}"></i> ${styleLabel}</span>
                                <span class="shrink-0">|</span>
                                <span class="truncate">Q: ${data.currentQIndex + 1}/${data.activeQuestions.length}</span>
                            </div>
                        </div>
                        <div class="shrink-0 text-right hidden sm:block ml-2">
                            <p class="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest font-bold">Score</p>
                            <p class="text-base sm:text-lg font-black text-emerald-400">${data.score}</p>
                        </div>
                    `;
                    
                    // Restart Button (Square button on the right)
                    const restartBtn = document.createElement('button');
                    restartBtn.onclick = () => promptRestartGame(modeId);
                    restartBtn.className = `shrink-0 bg-slate-900 border-2 border-slate-700 hover:border-rose-500 text-rose-500 hover:text-white hover:bg-rose-600 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center w-14 sm:w-16 shadow-md`;
                    restartBtn.title = "Restart Topic";
                    restartBtn.innerHTML = `<i class="fa-solid fa-rotate-right text-lg sm:text-xl"></i>`;

                    wrapper.appendChild(resumeBtn);
                    wrapper.appendChild(restartBtn);
                    resumeBtnContainer.appendChild(wrapper);
                }
            });

            if (hasSavedSessions) {
                resumeSec.classList.remove('hidden');
            } else {
                resumeSec.classList.add('hidden');
            }
        }

        function resumeGame(modeId) {
            if (!currentUser || !currentSubjectKey) return;
            const saved = localStorage.getItem(`bsece_resume_${currentUser.uid}_${currentSubjectKey}_${gameStyle}_${modeId}`);
            if (!saved) return;

            const data = JSON.parse(saved);
            
            currentModeId = data.currentModeId;
            gameStyle = data.gameStyle;
            currentQIndex = data.currentQIndex;
            score = data.score;
            streak = data.streak;
            maxStreak = data.maxStreak;
            lives = data.lives;
            correctAnswersCount = data.correctAnswersCount;
            wrongAnswersCount = data.wrongAnswersCount;
            activeQuestions = data.activeQuestions;
            timeLeft = data.timeLeft;
            TIME_LIMIT = data.timeLimit;
            
            clearInterval(timerInterval);
            document.getElementById('q-total').innerText = activeQuestions.length;
            
            setGameStyle(gameStyle);
            updateHUD();
            switchScreen('screen-game');
            loadQuestion(true); 
        }
        
        // Modal logic for Restarting Game
        function promptRestartGame(modeId) {
            modeToRestart = modeId;
            document.getElementById('restart-modal').classList.remove('hidden');
        }
        
        function cancelRestart() {
            modeToRestart = null;
            document.getElementById('restart-modal').classList.add('hidden');
        }
        
        function executeRestart() {
            if(modeToRestart) {
                clearSession(modeToRestart);
                document.getElementById('restart-modal').classList.add('hidden');
                initiateGame(modeToRestart);
                modeToRestart = null;
            }
        }

        function initiateGame(mode) {
            currentModeId = mode;
            clearSession(currentModeId); // Clean the slot for this specific topic before starting fresh

            activeQuestions = [];
            if (mode === 'all') {
                appData.forEach(t => { if (t.questions) t.questions.forEach(q => activeQuestions.push({...q, topic: t.topic})); });
                activeQuestions = shuffleArray(activeQuestions);
            } else {
                const tData = appData.find(t => t.topic === mode);
                if (tData && tData.questions) tData.questions.forEach(q => activeQuestions.push({...q, topic: tData.topic}));
            }
            activeQuestions.forEach(q => { q.shuffledChoices = shuffleArray([...q.choices]); });
            currentQIndex = 0; score = 0; streak = 0; maxStreak = 0; lives = MAX_LIVES; correctAnswersCount = 0; wrongAnswersCount = 0;
            clearInterval(timerInterval);
            document.getElementById('q-total').innerText = activeQuestions.length;
            updateHUD();
            switchScreen('screen-game');
            loadQuestion();
        }

        function loadQuestion(isResume = false) {
            const q = activeQuestions[currentQIndex];
            document.getElementById('explanation-box').classList.add('hidden');
            document.getElementById('next-btn').classList.add('hidden');
            document.getElementById('submit-multi-btn').classList.add('hidden');
            selectedMultiChoices = [];
            document.getElementById('question-scroll-area').scrollTop = 0;
            
            const imgEl = document.getElementById('question-image');
            if (q.image) { imgEl.src = q.image; document.getElementById('image-container').classList.remove('hidden'); } 
            else { document.getElementById('image-container').classList.add('hidden'); imgEl.src = ''; }
            
            document.getElementById('q-current').innerText = currentQIndex + 1;
            document.getElementById('topic-display').innerText = q.topic;
            document.getElementById('question-text').innerHTML = q.question;
            
            const badge = document.getElementById('q-type-badge');
            if (q.type === 'multiple') { badge.classList.remove('hidden'); document.getElementById('submit-multi-btn').classList.remove('hidden'); }
            else { badge.classList.add('hidden'); }

            const optsContainer = document.getElementById('options-container');
            optsContainer.innerHTML = '';
            q.shuffledChoices.forEach(opt => {
                const btn = document.createElement('button');
                
                // 🚨 BUGBOX FIX: I-save sa raw text ang choice para hindi madamay sa math rendering
                btn.dataset.raw = opt; 
                
                btn.className = "option-btn w-full text-left bg-slate-800 border-2 border-slate-700 text-slate-200 font-semibold py-4 px-6 rounded-xl flex items-center gap-3";
                const indicator = q.type === 'multiple' ? 'fa-square' : 'fa-circle';
                btn.innerHTML = `<span class="text-slate-500 w-5 flex justify-center option-indicator"><i class="fa-regular ${indicator}"></i></span><span class="option-text">${opt}</span>`;
                btn.onclick = () => handleOptionClick(opt, btn, q);
                optsContainer.appendChild(btn);
            });
            
            if (!isResume) {
                TIME_LIMIT = Math.min(Math.max(10, Math.floor((q.question.length + q.shuffledChoices.join("").length) / 15) + 8) + (q.image ? 15 : 0), 60);
                timeLeft = TIME_LIMIT;
            }

            if (gameStyle === 'survival') { 
                document.getElementById('timer-container').style.display = 'block'; 
                startTimer(); 
            } else { 
                document.getElementById('timer-container').style.display = 'none'; 
            }

            saveSession(); // Auto-save when a new question is loaded
            
            // I-render ang math equations sa tanong at choices
            setTimeout(() => renderMath('question-scroll-area'), 50);
        }

        function startTimer() { 
            clearInterval(timerInterval); 
            updateTimerUI(); 
            timerInterval = setInterval(() => { 
                timeLeft--; 
                updateTimerUI(); 
                if (timeLeft <= 0) { 
                    clearInterval(timerInterval); 
                    handleTimeout(); 
                } 
            }, 1000); 
        }

        function updateTimerUI() { const pct = (timeLeft/TIME_LIMIT)*100; const bar = document.getElementById('timer-bar'); bar.style.width = `${pct}%`; bar.className = `h-full w-full timer-transition ${pct>50 ? 'bg-cyan-400' : pct>25 ? 'bg-yellow-400' : 'bg-rose-500'}`; }

        function handleOptionClick(opt, btn, q) {
            if (btn.disabled) return;
            if (q.type === 'single') {
                clearInterval(timerInterval);
                finalizeQuestion(opt === q.correctAnswer, opt);
            } else if (q.type === 'multiple') {
                if (!q.correctAnswer.includes(opt)) {
                    btn.classList.replace('bg-slate-800', 'bg-rose-900/50'); btn.classList.replace('border-slate-700', 'border-rose-600');
                    btn.querySelector('.option-indicator').innerHTML = `<i class="fa-solid fa-xmark text-rose-500"></i>`; btn.disabled = true;
                    triggerShake();
                    if (gameStyle === 'survival') { lives--; updateHUD(); if (lives <= 0) { clearInterval(timerInterval); finalizeQuestion(false, null, false); return; } }
                } else {
                    if (selectedMultiChoices.includes(opt)) {
                        selectedMultiChoices = selectedMultiChoices.filter(c => c !== opt);
                        btn.classList.remove('selected-multi');
                        btn.querySelector('.option-indicator').innerHTML = `<i class="fa-regular fa-square"></i>`;
                        btn.querySelector('.option-indicator').classList.replace('text-cyan-400', 'text-slate-500');
                    } else {
                        selectedMultiChoices.push(opt);
                        btn.classList.add('selected-multi');
                        btn.querySelector('.option-indicator').innerHTML = `<i class="fa-solid fa-square-check"></i>`;
                        btn.querySelector('.option-indicator').classList.replace('text-slate-500', 'text-cyan-400');
                    }
                }
            }
        }

        function submitMultiAnswer() {
            clearInterval(timerInterval);
            const q = activeQuestions[currentQIndex];
            const isCorrect = (q.correctAnswer.length === selectedMultiChoices.length) && q.correctAnswer.every(c => selectedMultiChoices.includes(c));
            finalizeQuestion(isCorrect, null);
        }

        function handleTimeout() { finalizeQuestion(false, null, true); }

        function finalizeQuestion(isCorrect, singleSelectedOpt = null, isTimeout = false) {
            const q = activeQuestions[currentQIndex];
            document.getElementById('submit-multi-btn').classList.add('hidden');
            document.querySelectorAll('#options-container button').forEach(btn => {
                btn.disabled = true;
                
                // GAMITIN ANG RAW DATASET IMPES NA INNER TEXT PARA HINDI MASIRA NG MATH RENDERER
                const optText = btn.dataset.raw; 
                
                if (!btn.classList.contains('selected-multi') && !btn.classList.contains('border-rose-600')) btn.classList.add('disabled-ans');
                
                let isOptCorrect = q.type === 'single' ? (optText === q.correctAnswer) : q.correctAnswer.includes(optText);
                if (isOptCorrect) {
                    btn.classList.remove('disabled-ans', 'bg-slate-800', 'border-slate-700', 'selected-multi'); btn.classList.add('correct-ans');
                    btn.querySelector('.option-indicator').innerHTML = `<i class="fa-solid ${q.type === 'multiple' ? 'fa-square-check' : 'fa-circle-check'} text-white"></i>`;
                }
                if (q.type === 'single' && !isCorrect && singleSelectedOpt === optText) {
                    btn.classList.remove('disabled-ans', 'bg-slate-800', 'border-slate-700'); btn.classList.add('wrong-ans');
                    btn.querySelector('.option-indicator').innerHTML = `<i class="fa-solid fa-circle-xmark text-white"></i>`;
                }
            });

            if (isCorrect) {
                playSound('correct');
                correctAnswersCount++; streak++;
                if (streak > maxStreak) maxStreak = streak;
                score += Math.round((BASE_POINTS + (gameStyle === 'survival' ? timeLeft * 10 : 0)) * (streak < 3 ? 1 : Math.min(Math.floor(streak / 3) + 1, 4)));
                document.getElementById('score-display').classList.add('text-emerald-400', 'scale-110');
                setTimeout(() => document.getElementById('score-display').classList.remove('text-emerald-400', 'scale-110'), 300);
                if(q.explanation) showExplanation(q.explanation, true);
            } else {
                playSound('wrong');
                wrongAnswersCount++; streak = 0; triggerShake();
                if (gameStyle === 'survival' && lives > 0 && !isTimeout && q.type === 'single') lives--;
                else if (gameStyle === 'survival' && lives > 0 && q.type === 'multiple') lives--; 
                showExplanation(isTimeout ? "TIME'S UP: " + (q.explanation||"") : (q.explanation || "Review the technical documentation."), false);
            }
            updateHUD();
            saveSession(); 
            
            const nextBtn = document.getElementById('next-btn');
            nextBtn.classList.remove('hidden');
            if (gameStyle === 'survival' && lives <= 0) {
                nextBtn.innerHTML = `System Failure <i class="fa-solid fa-triangle-exclamation ml-2"></i>`;
                nextBtn.className = "bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-8 rounded-xl uppercase tracking-widest max-w-3xl mx-auto w-full";
            } else if (currentQIndex >= activeQuestions.length - 1) {
                nextBtn.innerHTML = `Complete Test <i class="fa-solid fa-flag-checkered ml-2"></i>`;
                nextBtn.className = "bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-xl uppercase tracking-widest max-w-3xl mx-auto w-full sm:w-auto";
            } else {
                nextBtn.innerHTML = `Next Sequence <i class="fa-solid fa-angles-right ml-2"></i>`;
                nextBtn.className = "bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-xl uppercase tracking-widest max-w-3xl mx-auto w-full sm:w-auto";
            }
        }

        function triggerShake() { const el = document.getElementById('screen-game'); el.classList.add('animate-shake'); setTimeout(() => el.classList.remove('animate-shake'), 500); }

        function showExplanation(text, isCorrect) {
            const expBox = document.getElementById('explanation-box');
            document.getElementById('explanation-text').innerHTML = text;
            expBox.className = `max-w-3xl mx-auto w-full bg-slate-800/80 border-l-4 rounded-r-xl p-4 mb-6 text-slate-200 shadow-inner animate-pop ${isCorrect ? 'border-emerald-500' : 'border-rose-500'}`;
            expBox.querySelector('i').className = `fa-solid fa-terminal mt-1 text-base sm:text-lg ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`;
            expBox.querySelector('span').className = `font-bold block mb-1 text-sm sm:text-base tracking-wider uppercase ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`;
            expBox.classList.remove('hidden');
            
            // I-render ang math equations sa explanation kung meron
            setTimeout(() => renderMath('explanation-box'), 50);
        }

        function updateHUD() {
            animateValue("score-display", parseInt(document.getElementById("score-display").innerText), score, 500);
            const mult = streak < 3 ? 1 : Math.min(Math.floor(streak / 3) + 1, 4);
            const streakContainer = document.getElementById('streak-container');
            if (streak >= 3) {
                streakContainer.classList.remove('hidden');
                document.getElementById('streak-display').innerText = `SEQ x${mult}`;
                streakContainer.className = `flex items-center gap-1 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-sm border ${mult === 4 ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : mult === 3 ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'}`;
            } else streakContainer.classList.add('hidden');

            const livesDisplay = document.getElementById('lives-display');
            if (gameStyle === 'survival') {
                livesDisplay.style.display = 'flex'; livesDisplay.innerHTML = '';
                for (let i = 0; i < MAX_LIVES; i++) livesDisplay.innerHTML += `<i class="fa-solid fa-battery-${i < lives ? 'full text-emerald-400' : 'empty text-slate-700'} text-[10px] sm:text-base"></i>`;
            } else livesDisplay.style.display = 'none';
        }

        function nextQuestion() {
            if (gameStyle === 'survival' && lives <= 0) { endGame(false); return; }
            currentQIndex++;
            if (currentQIndex >= activeQuestions.length) endGame(true); else loadQuestion();
        }

        function quitGame() { document.getElementById('quit-modal').classList.remove('hidden'); }
        
        function confirmQuit() { 
            saveSession(); 
            document.getElementById('quit-modal').classList.add('hidden'); 
            clearInterval(timerInterval); 
            switchScreen('screen-mode'); 
        }
        
        function cancelQuit() { document.getElementById('quit-modal').classList.add('hidden'); }

        // ==========================================
        // 🚨 FIREBASE DATA SAVING 🚨
        // ==========================================
        async function endGame(survived) {
            clearSession(currentModeId); 
            
            switchScreen('screen-end');
            animateValue("final-score", 0, score, 1000);
            document.getElementById('final-correct').innerText = correctAnswersCount;
            document.getElementById('final-wrong').innerText = wrongAnswersCount;
            document.getElementById('final-streak').innerText = maxStreak;

            const icon = document.getElementById('end-icon'), msg = document.getElementById('end-message'), title = document.getElementById('end-title');
            if (!survived) {
                playSound('fail');
                icon.innerHTML = '<i class="fa-solid fa-skull-crossbones text-rose-500"></i>';
                title.innerText = "System Failure"; title.className = "text-2xl sm:text-4xl font-black mb-2 text-rose-400 uppercase tracking-widest";
                msg.innerText = "Critical error limit reached. Saving progress...";
            } else {
                playSound('complete');
                icon.innerHTML = '<i class="fa-solid fa-microchip text-cyan-400"></i>';
                title.innerText = "Diagnostics Complete"; title.className = "text-2xl sm:text-4xl font-black mb-2 text-white uppercase tracking-widest";
                msg.innerText = "All systems verified. Saving progress...";
                triggerConfetti();
            }

            // Save to Firebase
            if (currentUser && score > 0) {
                try {
                    const newTotal = (userData.totalScore || 0) + score;
                    const newMaxStreak = Math.max(userData.maxStreak || 0, maxStreak);
                    
                    await db.collection('users').doc(currentUser.uid).update({
                        totalScore: firebase.firestore.FieldValue.increment(score),
                        maxStreak: newMaxStreak,
                        lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Update local user data so dashboard reflects it
                    userData.totalScore = newTotal;
                    userData.maxStreak = newMaxStreak;
                    document.getElementById('dash-total-score').innerText = newTotal;
                    document.getElementById('dash-max-streak').innerText = newMaxStreak;
                    
                    msg.innerText = "Progress Saved Successfully!";
                } catch (error) {
                    console.error("Error saving progress:", error);
                    msg.innerText = "Error saving progress. Connection failed.";
                }
            } else {
                msg.innerText = "Test concluded.";
            }
        }

        // ==========================================
        // UTILS
        // ==========================================
        function animateValue(id, start, end, duration) {
            if (start === end) return;
            const obj = document.getElementById(id);
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                obj.innerHTML = Math.floor(progress * (end - start) + start);
                if (progress < 1) window.requestAnimationFrame(step);
            };
            window.requestAnimationFrame(step);
        }

        function triggerConfetti() {
            const canvas = document.getElementById('confetti-canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = window.innerWidth; canvas.height = window.innerHeight;
            const pieces = [], colors = ['#06b6d4', '#10b981', '#3b82f6', '#0ea5e9', '#6366f1'];
            for (let i = 0; i < 150; i++) pieces.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height - canvas.height, size: Math.random()*8+4, color: colors[Math.floor(Math.random()*colors.length)], speed: Math.random()*3+2, angle: Math.random()*Math.PI*2, spin: Math.random()*0.2-0.1 });
            function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height); let active = false;
                pieces.forEach(p => { p.y += p.speed; p.angle += p.spin; if (p.y < canvas.height) { active = true; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore(); } });
                if (active && !document.getElementById('screen-end').classList.contains('hidden')) requestAnimationFrame(animate);
                else ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            animate();
        }
        window.addEventListener('resize', () => { const canvas = document.getElementById('confetti-canvas'); canvas.width = window.innerWidth; canvas.height = window.innerHeight; });