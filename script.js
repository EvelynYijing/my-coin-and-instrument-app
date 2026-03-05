// --- Firebase v9+ Setup ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: 替换为你的 Firebase 配置！
const firebaseConfig = {
    apiKey: "AIzaSyAuBtnskC_7Zy9pt0Gwz6mCyOeMO8zo4X8",
    authDomain: "hackathon-d2f04.firebaseapp.com",
    projectId: "hackathon-d2f04",
    storageBucket: "hackathon-d2f04.firebasestorage.app",
    messagingSenderId: "590832688885",
    appId: "1:590832688885:web:f6f79485166b826fb02fbc",
    measurementId: "G-X1JEY9FH6G"
};

// 初始化 Firebase (忽略报错如果没配好的话)
let app, auth, db, provider;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();
} catch (e) {
    console.warn("Firebase not correctly initialized yet. Please replace the firebaseConfig.", e);
}

// --- 用户状态 ---
let currentUser = null;
let currentHighScore = 0;

// --- DOM 节点追加 ---
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const highscoreDisplay = document.getElementById('highscore-display');
const highscoreVal = document.getElementById('highscore-val');

// --- 状态管理 ---
let score = 0;
let combo = 1;
let comboTimer = null;
let comboTimeLeft = 0;
const COMBO_MAX_TIME = 1500; // ms

// --- DOM 节点 ---
const scoreEl = document.getElementById('score');
const comboTracker = document.getElementById('combo-tracker');
const comboEl = document.getElementById('combo');
const comboBar = document.getElementById('combo-bar');
const coreWrapper = document.getElementById('core-wrapper');
const coreCenter = document.getElementById('core-center');
const fxLayer = document.getElementById('fx-layer');
const ambientGlow = document.getElementById('ambient-glow');

// --- 颜色配置 ---
const themeColors = {
    china: { hex: '#c98b5a', rgba: 'rgba(201,139,90,0.3)' },
    rome: { hex: '#e0e6ed', rgba: 'rgba(224,230,237,0.3)' },
    egypt: { hex: '#ffd700', rgba: 'rgba(255,215,0,0.3)' }
};

// --- Web Audio 合成器 ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

/**
 * 高级音频合成：带有环境混响和动态音高
 */
function playQuantumSound(type, comboMultiplier) {
    initAudio();
    const t = audioCtx.currentTime;

    // 根据 Combo 动态提高音调
    const pitchShift = 1 + (comboMultiplier - 1) * 0.15;

    let freqs = [];
    let decay = 0;
    let waveType = 'sine';

    // 根据古代硬币的特性设计音效
    if (type === 'egypt') {
        // 埃及金币 (黄金)：清脆、空灵感的高频
        freqs = [1200, 1800, 2400, 4800];
        decay = 1.2;
    } else if (type === 'rome') {
        // 罗马银币：银币质感的标准清脆振声
        freqs = [800, 1200, 2000];
        decay = 0.7;
    } else {
        // 中国铜钱：实心青铜摩擦的重低音感
        freqs = [400, 600, 1000];
        decay = 0.5;
        waveType = 'triangle'; // 增加青铜的厚实泛音
    }

    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);

    masterGain.gain.setValueAtTime(0, t);
    // 快速 Attack
    masterGain.gain.linearRampToValueAtTime(0.4, t + 0.02);
    // 科幻感的长尾衰减
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + decay);

    freqs.forEach((baseFreq, index) => {
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();

        // 应用 combo 的 pitch shift
        const freq = baseFreq * pitchShift;

        oscGain.gain.value = 1 / (index + 1); // 谐波音量递减
        osc.type = waveType;

        osc.frequency.setValueAtTime(freq, t);
        // 使频率有一个极微小的滑音以增加“能量注入”的感觉
        osc.frequency.exponentialRampToValueAtTime(freq * 0.95, t + decay);

        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start(t);
        osc.stop(t + decay + 0.1);
    });
}

// --- Combo 系统逻辑 ---
let lastTime = performance.now();
function updateComboBar(currentTime) {
    if (combo > 1) {
        const dt = currentTime - lastTime;
        comboTimeLeft -= dt;

        if (comboTimeLeft <= 0) {
            // Combo 重置
            combo = 1;
            comboTimeLeft = 0;
            comboTracker.classList.remove('active');
            scoreEl.style.color = '#fff';
            scoreEl.style.textShadow = '0 0 20px rgba(255,255,255,0.2)';
            ambientGlow.style.background = 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)';
        } else {
            const ratio = comboTimeLeft / COMBO_MAX_TIME;
            comboBar.style.transform = `scaleX(${ratio})`;
        }
    }
    lastTime = currentTime;
    requestAnimationFrame(updateComboBar);
}
requestAnimationFrame(updateComboBar);

function registerHit(type) {
    if (comboTimeLeft > 0) {
        combo = Math.min(combo + 0.5, 5.0); // 最大 5x
    } else {
        combo = 1.5;
    }

    comboTimeLeft = COMBO_MAX_TIME;
    comboTracker.classList.add('active');

    // 更新 Combo 视觉
    comboEl.innerText = combo.toFixed(1) + 'x';
    comboEl.style.transform = 'scale(1.3)';
    setTimeout(() => { comboEl.style.transform = 'scale(1)'; }, 100);

    // 修改总体氛围颜色
    ambientGlow.style.background = `radial-gradient(circle, ${themeColors[type].rgba} 0%, transparent 60%)`;
    scoreEl.style.color = themeColors[type].hex;
    scoreEl.style.textShadow = `0 0 40px ${themeColors[type].hex}`;

    return combo;
}

// --- 数字动画 ---
function animateScore(oldVal, newVal) {
    const duration = 400;
    const start = performance.now();

    scoreEl.style.transform = 'scale(1.1)';

    function update(time) {
        const progress = Math.min((time - start) / duration, 1);
        const easeOutQuint = 1 - Math.pow(1 - progress, 5);

        scoreEl.innerText = Math.floor(oldVal + (newVal - oldVal) * easeOutQuint);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            scoreEl.style.transform = 'scale(1)';
        }
    }
    requestAnimationFrame(update);

    // 更新最高分
    if (currentUser && newVal > currentHighScore) {
        currentHighScore = newVal;
        highscoreVal.innerText = currentHighScore;
        saveHighScoreToFirestore(currentHighScore);
    }
}

// --- 吸收动画与波纹特效 ---
function triggerAbsorption(color) {
    // 1. 核心视觉收缩
    coreCenter.classList.add('absorbing');
    coreWrapper.style.transform = 'scale(0.95)';

    setTimeout(() => {
        coreCenter.classList.remove('absorbing');
        coreWrapper.style.transform = 'scale(1.02)';
        setTimeout(() => { coreWrapper.style.transform = 'scale(1)'; }, 150);
    }, 100);

    // 2. 发射冲击波 (Ripple)
    const coreRect = coreCenter.getBoundingClientRect();
    const cx = coreRect.left + coreRect.width / 2;
    const cy = coreRect.top + coreRect.height / 2;

    const ripple = document.createElement('div');
    ripple.classList.add('ripple');
    ripple.style.left = cx + 'px';
    ripple.style.top = cy + 'px';
    ripple.style.borderColor = color;
    ripple.style.width = coreRect.width + 'px';
    ripple.style.height = coreRect.height + 'px';

    fxLayer.appendChild(ripple);

    // 下一帧触发动画
    requestAnimationFrame(() => {
        ripple.classList.add('expand');
    });

    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// --- 核心交互：发射能量币 ---
function fireEnergy(btnElement, type, baseValue) {
    initAudio();

    // 计算起点 (按钮中心)
    const btnRect = btnElement.getBoundingClientRect();
    const startX = btnRect.left + btnRect.width / 2;
    const startY = btnRect.top + btnRect.height / 2;

    // 计算终点 (核心中心)
    const coreRect = coreCenter.getBoundingClientRect();
    const endX = coreRect.left + coreRect.width / 2;
    const endY = coreRect.top + coreRect.height / 2;

    const colorHex = themeColors[type].hex;

    // 1. 创建飞行能量球 (克隆硬币图标)
    const energy = document.createElement('div');
    energy.classList.add('flying-energy');

    const coinObj = btnElement.querySelector('.coin-icon').cloneNode(true);
    energy.appendChild(coinObj);

    energy.style.left = startX + 'px';
    energy.style.top = startY + 'px';
    energy.style.boxShadow = `0 0 20px ${colorHex}, 0 0 40px ${colorHex}`;
    fxLayer.appendChild(energy);

    // 2. 开始飞行
    // 给一点延迟让 DOM 渲染，保证 CSS transition 生效
    setTimeout(() => {
        energy.style.left = endX + 'px';
        energy.style.top = endY + 'px';
        energy.classList.add('absorbed');
    }, 10);

    // 3. 到达核心后触发逻辑 (动画时长 0.5s，我们取 0.45s 以提前响应，显得更跟手)
    setTimeout(() => {
        energy.remove();

        // 注册命中，获取当前 Combo
        const currentCombo = registerHit(type);

        // 计算最终分数
        const finalValue = Math.floor(baseValue * currentCombo);
        const newScore = score + finalValue;

        animateScore(score, newScore);
        score = newScore;

        playQuantumSound(type, currentCombo);
        triggerAbsorption(colorHex);

    }, 450);
}

// --- 绑定事件 ---
document.querySelectorAll('.coin-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
        // 给按钮添加瞬间反馈光效
        const type = btn.getAttribute('data-type');
        const value = parseInt(btn.getAttribute('data-value'), 10);

        fireEnergy(btn, type, value);
    });

    // 支持触摸
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault(); // 防止双重触发
        const type = btn.getAttribute('data-type');
        const value = parseInt(btn.getAttribute('data-value'), 10);
        fireEnergy(btn, type, value);
    });
});

// --- Firebase 验证与云端同步逻辑 ---
if (auth) {
    // 监听认证状态
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            loginBtn.classList.add('hidden');
            userInfo.classList.remove('hidden');
            userName.innerText = user.displayName;
            userAvatar.src = user.photoURL;
            highscoreDisplay.classList.remove('hidden');

            // 从 Firestore 获取最高分
            fetchHighScoreFromFirestore();
        } else {
            currentUser = null;
            loginBtn.classList.remove('hidden');
            userInfo.classList.add('hidden');
            highscoreDisplay.classList.add('hidden');
            currentHighScore = 0;
            score = 0; // 登出重置当前分数
            scoreEl.innerText = 0;
            highscoreVal.innerText = 0;
        }
    });

    // 登录事件
    loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch(error => {
            console.error("Login failed:", error);
            alert("登录失败，请检查控制台或 Firebase 配置。");
        });
    });

    // 登出事件
    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
}

async function fetchHighScoreFromFirestore() {
    if (!currentUser || !db) return;
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            currentHighScore = docSnap.data().highScore || 0;
            highscoreVal.innerText = currentHighScore;
        } else {
            currentHighScore = 0;
            highscoreVal.innerText = 0;
        }
        // 同步当前的 score 如果本地已经更高了
        if (score > currentHighScore) {
            saveHighScoreToFirestore(score);
        }
    } catch (e) {
        console.error("Error fetching high score:", e);
    }
}

// 节流处理保存最高分，避免频繁写入 Firestore
let saveTimeout = null;
function saveHighScoreToFirestore(newHighScore) {
    if (!currentUser || !db) return;
    if (saveTimeout) clearTimeout(saveTimeout);

    saveTimeout = setTimeout(async () => {
        try {
            await setDoc(doc(db, "users", currentUser.uid), {
                highScore: newHighScore,
                lastUpdated: new Date()
            }, { merge: true });
            console.log("High score saved to Firestore!");
        } catch (e) {
            console.error("Error saving high score:", e);
        }
    }, 2000); // 2秒后保存（由于点击可能非常快）
}
