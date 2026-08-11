import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const isConfigured =
  firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

let app, auth, db;
if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  document.getElementById("setupBanner").classList.remove("hidden");
}

const toastStack = document.getElementById("toast-stack");
function showToast(message, type = "info") {
  const icons = { success: "✓", error: "⚠", info: "ℹ" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="icon">${icons[type] || ""}</span><span>${message}</span>`;
  toastStack.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 200);
  }, 3200);
}

// ----------------------------------------------------
// SESSION EXPIRATION (Inactivity Timeout: 15 Minutes)
// ----------------------------------------------------
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
let idleTimer = null;

function resetIdleTimer() {
  if (!auth || !auth.currentUser) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    try {
      await signOut(auth);
      showToast("Session expired due to inactivity.", "info");
    } catch (e) {
      // ignore
    }
  }, INACTIVITY_TIMEOUT);
}

// Setup activity listeners when logged in
["mousemove", "mousedown", "keypress", "touchstart", "scroll"].forEach(
  (evt) => {
    window.addEventListener(evt, resetIdleTimer, { passive: true });
  },
);

const authView = document.getElementById("authView");
const dashView = document.getElementById("dashView");
const userChip = document.getElementById("userChip");
const userNameDisplay = document.getElementById("userNameDisplay");
const authForm = document.getElementById("authForm");
const nameField = document.getElementById("nameField");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authTitle = document.getElementById("authTitle");
const authSub = document.getElementById("authSub");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const switchToSignup = document.getElementById("switchToSignup");
const authToggle = document.getElementById("authToggle");
const forgotLink = document.getElementById("forgotLink");
const googleBtn = document.getElementById("googleBtn");
const logoutBtn = document.getElementById("logoutBtn");

let mode = "login";

function setMode(next) {
  mode = next;
  if (mode === "signup") {
    authTitle.textContent = "Create your account";
    authSub.textContent = "Start tracking your cycle";
    authSubmitBtn.textContent = "Sign up";
    nameField.classList.remove("hidden");
    authName.setAttribute("required", "true");
    authToggle.innerHTML = `Already have an account? <a href="#" id="switchToLogin">Log in</a>`;
    document.getElementById("switchToLogin").addEventListener("click", (e) => {
      e.preventDefault();
      setMode("login");
    });
  } else {
    authTitle.textContent = "Welcome back";
    authSub.textContent = "Log in to see your cycle";
    authSubmitBtn.textContent = "Log in";
    nameField.classList.add("hidden");
    authName.removeAttribute("required");
    authToggle.innerHTML = `New here? <a href="#" id="switchToSignup2">Create an account</a>`;
    document
      .getElementById("switchToSignup2")
      .addEventListener("click", (e) => {
        e.preventDefault();
        setMode("signup");
      });
  }
  authError.classList.add("hidden");
}
switchToSignup.addEventListener("click", (e) => {
  e.preventDefault();
  setMode("signup");
});

forgotLink.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!isConfigured) return showToast("Connect Firebase first.", "error");
  const email = authEmail.value.trim();
  if (!email) return showToast("Enter your email above first.", "error");
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset email sent.", "success");
  } catch (err) {
    showToast(friendlyError(err), "error");
  }
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isConfigured)
    return showToast("Connect Firebase first — see the banner above.", "error");
  authError.classList.add("hidden");
  authSubmitBtn.disabled = true;
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const name = authName.value.trim();

  try {
    if (mode === "signup") {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      if (name) {
        await updateProfile(userCredential.user, { displayName: name });
        await setDoc(
          doc(db, "users", userCredential.user.uid, "settings", "profile"),
          {
            displayName: name,
          },
          { merge: true },
        );
      }
      showToast("Account created — welcome!", "success");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Logged in.", "success");
    }
  } catch (err) {
    authError.textContent = friendlyError(err);
    authError.classList.remove("hidden");
  } finally {
    authSubmitBtn.disabled = false;
  }
});

googleBtn.addEventListener("click", async () => {
  if (!isConfigured) return showToast("Connect Firebase first.", "error");
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    const user = result.user;
    if (user.displayName) {
      await setDoc(
        doc(db, "users", user.uid, "settings", "profile"),
        {
          displayName: user.displayName,
        },
        { merge: true },
      );
    }
    showToast("Logged in with Google.", "success");
  } catch (err) {
    showToast(friendlyError(err), "error");
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showToast("Logged out.", "info");
});

function friendlyError(err) {
  const code = err && err.code ? err.code : "";
  const map = {
    "auth/invalid-email": "That email address looks invalid.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account already exists with that email.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

const DAY_MS = 24 * 60 * 60 * 1000;
function toDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function daysBetween(a, b) {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / DAY_MS);
}
function fmt(date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtShort(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function computeAvgCycleLength(entries) {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort(
    (a, b) => toDate(a.startDate) - toDate(b.startDate),
  );
  const diffs = [];
  for (let i = 1; i < sorted.length; i++) {
    diffs.push(
      daysBetween(toDate(sorted[i - 1].startDate), toDate(sorted[i].startDate)),
    );
  }
  const valid = diffs.filter((d) => d >= 15 && d <= 60);
  if (!valid.length) return null;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return Math.round(avg);
}

function computeCycleData(entries, settings) {
  if (!entries.length) return null;
  const sorted = [...entries].sort(
    (a, b) => toDate(b.startDate) - toDate(a.startDate),
  );
  const last = sorted[0];
  const lastStart = toDate(last.startDate);
  const today = new Date();

  const autoAvg = computeAvgCycleLength(entries);
  const cycleLength =
    settings.autoCalc && autoAvg ? autoAvg : settings.cycleLength || 28;
  const periodLength = settings.periodLength || last.length || 5;

  const nextPeriodDate = addDays(lastStart, cycleLength);
  const lutealPhase = 14;
  const ovulationDate = addDays(nextPeriodDate, -lutealPhase);
  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd = addDays(ovulationDate, 1);

  let cycleDay = daysBetween(lastStart, today) + 1;
  if (cycleDay < 1) cycleDay = 1;
  const daysUntilNextPeriod = daysBetween(today, nextPeriodDate);

  let phase = "Follicular";
  if (cycleDay <= periodLength) phase = "Menstrual";
  else if (today >= fertileStart && today <= fertileEnd)
    phase = "Fertile window";
  else if (daysBetween(today, ovulationDate) === 0) phase = "Ovulation";
  else if (cycleDay > cycleLength - lutealPhase) phase = "Luteal";

  return {
    lastStart,
    cycleLength,
    periodLength,
    nextPeriodDate,
    ovulationDate,
    fertileStart,
    fertileEnd,
    cycleDay,
    daysUntilNextPeriod,
    phase,
    autoAvg,
  };
}

const wheelRing = document.getElementById("wheelRing");
const wheelMarker = document.getElementById("wheelMarker");
const wheelDay = document.getElementById("wheelDay");
const wheelMoon = document.getElementById("wheelMoon");
const wheelPhase = document.getElementById("wheelPhase");
const wheelCountdown = document.getElementById("wheelCountdown");

const MOON = {
  Menstrual: "🌑",
  Follicular: "🌒",
  "Fertile window": "🌖",
  Ovulation: "🌕",
  Luteal: "🌘",
};

function renderWheel(data) {
  if (!data) {
    wheelRing.style.background = "conic-gradient(var(--line) 0 100%)";
    wheelMarker.style.transform = "rotate(0deg)";
    wheelDay.textContent = "–";
    wheelMoon.textContent = "🌑";
    wheelPhase.textContent = "No data yet";
    wheelCountdown.textContent = "Log a period to get started.";
    return;
  }
  const {
    cycleLength,
    periodLength,
    cycleDay,
    phase,
    daysUntilNextPeriod,
    fertileStart,
    fertileEnd,
    lastStart,
    ovulationDate,
  } = data;

  const fertStartIdx = daysBetween(lastStart, fertileStart);
  const fertEndIdx = daysBetween(lastStart, fertileEnd);

  const pct = (n) => Math.max(0, Math.min(100, (n / cycleLength) * 100));
  const periodEndPct = pct(periodLength);
  const fertStartPct = pct(Math.max(fertStartIdx, periodLength));
  const fertEndPct = pct(fertEndIdx + 1);
  const lutealStartPct = fertEndPct;

  wheelRing.style.background = `conic-gradient(
    var(--rose) 0% ${periodEndPct}%,
    var(--plum-soft) ${periodEndPct}% ${fertStartPct}%,
    var(--sage) ${fertStartPct}% ${fertEndPct}%,
    var(--amber) ${lutealStartPct}% 100%
  )`;

  const angle = ((cycleDay - 1) / cycleLength) * 360;
  wheelMarker.style.transform = `rotate(${angle}deg)`;

  wheelDay.textContent = cycleDay;
  wheelMoon.textContent = MOON[phase] || "🌑";
  wheelPhase.textContent = phase;

  if (daysUntilNextPeriod >= 0) {
    wheelCountdown.innerHTML =
      daysUntilNextPeriod === 0
        ? `Your period is expected <b>today</b>.`
        : `<b>${daysUntilNextPeriod}</b> day${daysUntilNextPeriod === 1 ? "" : "s"} until your next period.`;
  } else {
    wheelCountdown.innerHTML = `Your period is <b>${Math.abs(daysUntilNextPeriod)}</b> day${Math.abs(daysUntilNextPeriod) === 1 ? "" : "s"} late. Consider logging it.`;
  }
}

// --- Interactive Calendar Controller ---
let currentCalDate = new Date();

const calMonthTitle = document.getElementById("calMonthTitle");
const calendarGrid = document.getElementById("calendarGrid");
const calPrevBtn = document.getElementById("calPrevBtn");
const calNextBtn = document.getElementById("calNextBtn");
const calTodayBtn = document.getElementById("calTodayBtn");

calPrevBtn.addEventListener("click", () => {
  currentCalDate.setMonth(currentCalDate.getMonth() - 1);
  renderCalendar();
});

calNextBtn.addEventListener("click", () => {
  currentCalDate.setMonth(currentCalDate.getMonth() + 1);
  renderCalendar();
});

calTodayBtn.addEventListener("click", () => {
  currentCalDate = new Date();
  renderCalendar();
});

function renderCalendar() {
  if (!calendarGrid) return;
  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();

  calMonthTitle.textContent = currentCalDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  calendarGrid.innerHTML = `
    <div class="cal-weekday">Su</div>
    <div class="cal-weekday">Mo</div>
    <div class="cal-weekday">Tu</div>
    <div class="cal-weekday">We</div>
    <div class="cal-weekday">Th</div>
    <div class="cal-weekday">Fr</div>
    <div class="cal-weekday">Sa</div>
  `;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();
  const todayStr = new Date().toDateString();

  const cycleData = computeCycleData(currentEntries, currentSettings);

  // Define expected period range windows
  let expectedStart, expectedEnd;
  if (cycleData) {
    expectedStart = cycleData.nextPeriodDate;
    expectedEnd = addDays(cycleData.nextPeriodDate, cycleData.periodLength - 1);
  }
  const normalize = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  for (let i = firstDayIndex; i > 0; i--) {
    const dayNum = prevTotalDays - i + 1;
    const cell = document.createElement("div");
    cell.className = "cal-day other-month";
    cell.textContent = dayNum;
    calendarGrid.appendChild(cell);
  }

  for (let i = 1; i <= totalDays; i++) {
    // Create local date at midnight to prevent timezone shifts
    const cellDate = new Date(year, month, i, 0, 0, 0, 0);
    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.textContent = i;

    if (cellDate.toDateString() === todayStr) {
      cell.classList.add("today");
    }

    if (cycleData) {
      const isPeriod = currentEntries.some((entry) => {
        // Parse start date safely into local time midnight
        const [y, m, d] = entry.startDate.split("-").map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        const len = entry.length || 5;
        const end = new Date(y, m - 1, d + len - 1, 0, 0, 0, 0);
        return cellDate >= start && cellDate <= end;
      });

      const cellTime = normalize(cellDate);
      const inRange = (start, end) =>
        start &&
        end &&
        cellTime >= normalize(start) &&
        cellTime <= normalize(end);

      const isFertile = inRange(cycleData.fertileStart, cycleData.fertileEnd);
      const isOvulation =
        cycleData.ovulationDate &&
        cellTime === normalize(cycleData.ovulationDate);
      const isExpectedPeriod = !isPeriod && inRange(expectedStart, expectedEnd);

      if (isPeriod) {
        cell.classList.add("is-period");
      } else if (isExpectedPeriod) {
        cell.classList.add("is-expected-period");
      } else if (isOvulation) {
        cell.classList.add("is-ovulation");
      } else if (isFertile) {
        cell.classList.add("is-fertile");
      }
    }

    calendarGrid.appendChild(cell);
  }

  const remainingCells = 42 - calendarGrid.children.length;
  for (let i = 1; i <= remainingCells; i++) {
    const cell = document.createElement("div");
    cell.className = "cal-day other-month";
    cell.textContent = i;
    calendarGrid.appendChild(cell);
  }
}

function renderStats(data) {
  const nextEl = document.getElementById("statNextPeriod");
  const nextSub = document.getElementById("statNextPeriodSub");
  const ovEl = document.getElementById("statOvulation");
  const fertEl = document.getElementById("statFertile");
  const avgEl = document.getElementById("statAvgLen");
  const avgSub = document.getElementById("statAvgLenSub");

  if (!data) {
    nextEl.textContent = "–";
    nextSub.textContent = "";
    ovEl.textContent = "–";
    fertEl.textContent = "–";
    avgEl.textContent = "–";
    avgSub.textContent = "Log a period to begin";
    return;
  }
  nextEl.textContent = fmt(data.nextPeriodDate);
  nextSub.textContent =
    data.daysUntilNextPeriod >= 0
      ? `in ${data.daysUntilNextPeriod} days`
      : `${Math.abs(data.daysUntilNextPeriod)} days late`;
  ovEl.textContent = fmt(data.ovulationDate);
  fertEl.textContent = `${fmtShort(data.fertileStart)} – ${fmtShort(data.fertileEnd)}`;
  avgEl.textContent = `${data.cycleLength} days`;
  avgSub.textContent = data.autoAvg
    ? "Auto-calculated from your logs"
    : "Manual setting";
}

const entryListEl = document.getElementById("entryList");
function renderHistory(entries, onDelete) {
  if (!entries.length) {
    entryListEl.innerHTML = `<div class="empty-state">No periods logged yet. Tap "+ Log period" to add your first one.</div>`;
    return;
  }
  const sorted = [...entries].sort(
    (a, b) => toDate(b.startDate) - toDate(a.startDate),
  );
  entryListEl.innerHTML = "";
  sorted.forEach((entry) => {
    const start = toDate(entry.startDate);
    const end = addDays(start, (entry.length || 5) - 1);
    const div = document.createElement("div");
    div.className = "entry-item";
    div.innerHTML = `
      <div>
        <div class="dates">${fmt(start)} → ${fmtShort(end)}</div>
        <div class="meta">${entry.length || 5} days · ${entry.flow || "medium"} flow${entry.notes ? " · " + escapeHtml(entry.notes) : ""}</div>
      </div>
      <button class="del">Delete</button>
    `;
    div
      .querySelector(".del")
      .addEventListener("click", () => onDelete(entry.id));
    entryListEl.appendChild(div);
  });
}
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

const logModal = document.getElementById("logModal");
const logForm = document.getElementById("logForm");
const logPeriodBtn = document.getElementById("logPeriodBtn");
const logCancelBtn = document.getElementById("logCancelBtn");
const logStart = document.getElementById("logStart");
const logLength = document.getElementById("logLength"); // <--- Add this reference

logPeriodBtn.addEventListener("click", () => {
  logStart.value = new Date().toISOString().slice(0, 10);

  // ---> Sync modal's period length input with current settings default length
  if (logLength && currentSettings && currentSettings.periodLength) {
    logLength.value = currentSettings.periodLength;
  }

  logModal.classList.remove("hidden");
});
logCancelBtn.addEventListener("click", () => logModal.classList.add("hidden"));
logModal.addEventListener("click", (e) => {
  if (e.target === logModal) logModal.classList.add("hidden");
});

let currentUser = null;
let currentEntries = [];
let currentSettings = {
  cycleLength: 28,
  periodLength: 5,
  autoCalc: true,
  displayName: "",
};
let unsubEntries = null;

function refreshDashboard() {
  const data = computeCycleData(currentEntries, currentSettings);
  renderWheel(data);
  renderStats(data);
  renderCalendar();
  renderHistory(currentEntries, deleteEntry);
}

async function deleteEntry(id) {
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "entries", id));
    showToast("Entry deleted.", "info");
  } catch (err) {
    showToast("Couldn't delete that entry.", "error");
  }
}

// logForm.addEventListener("submit", async (e) => {
//   e.preventDefault();
//   if (!currentUser) return;

//   const startDate = document.getElementById("logStart").value;
//   const length = parseInt(document.getElementById("logLength").value, 10) || 5;
//   const flow = document.getElementById("logFlow").value;
//   const notes = document.getElementById("logNotes").value.trim();

//   if (!startDate) {
//     showToast("Please select a start date.", "error");
//     return;
//   }

//   try {
//     const entryRef = doc(db, "users", currentUser.uid, "entries", startDate);
//     const existingEntry = await getDoc(entryRef);

//     if (existingEntry.exists()) {
//       showToast("This date has already been logged.", "error");
//       return;
//     }

//     await setDoc(entryRef, {
//       startDate,
//       length,
//       flow,
//       notes,
//       createdAt: serverTimestamp(),
//     });

//     logModal.classList.add("hidden");
//     logForm.reset();

//     showToast("Period logged successfully.", "success");
//   } catch (err) {
//     console.error("Error saving entry:", err);
//     showToast("Couldn't save that entry.", "error");
//   }
// });

logForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const startDate = document.getElementById("logStart").value;
  const length = parseInt(document.getElementById("logLength").value, 10) || 5;
  const flow = document.getElementById("logFlow").value;
  const notes = document.getElementById("logNotes").value.trim();

  if (!startDate) {
    showToast("Please select a start date.", "error");
    return;
  }

  try {
    const entryRef = doc(db, "users", currentUser.uid, "entries", startDate);
    const existingEntry = await getDoc(entryRef);

    if (existingEntry.exists()) {
      showToast("This date has already been logged.", "error");
      return;
    }

    await setDoc(entryRef, {
      startDate,
      length,
      flow,
      notes,
      createdAt: serverTimestamp(),
    });

    // ---> SYNC LOGIC: Update settings state & UI input when length changes
    if (currentSettings.periodLength !== length) {
      currentSettings.periodLength = length;
      const setPeriodLen = document.getElementById("setPeriodLen");
      if (setPeriodLen) setPeriodLen.value = length;

      // Save updated settings profile to Firestore automatically
      await setDoc(
        doc(db, "users", currentUser.uid, "settings", "profile"),
        { periodLength: length },
        { merge: true },
      );
    }
    // <--- END SYNC LOGIC

    logModal.classList.add("hidden");
    logForm.reset();

    showToast("Period logged successfully.", "success");
  } catch (err) {
    console.error("Error saving entry:", err);
    showToast("Couldn't save that entry.", "error");
  }
});

const setCycleLen = document.getElementById("setCycleLen");
const setPeriodLen = document.getElementById("setPeriodLen");
const setAuto = document.getElementById("setAuto");
document
  .getElementById("saveSettingsBtn")
  .addEventListener("click", async () => {
    if (!currentUser) return;
    currentSettings = {
      ...currentSettings,
      cycleLength: parseInt(setCycleLen.value, 10) || 28,
      periodLength: parseInt(setPeriodLen.value, 10) || 5,
      autoCalc: setAuto.checked,
    };
    try {
      await setDoc(
        doc(db, "users", currentUser.uid, "settings", "profile"),
        currentSettings,
        { merge: true },
      );
      showToast("Settings saved.", "success");
      refreshDashboard();
    } catch (err) {
      showToast("Couldn't save settings.", "error");
    }
  });

document.querySelectorAll(".info-icon").forEach((icon) => {
  let tooltip = null;

  icon.addEventListener("mouseenter", (e) => {
    tooltip = document.createElement("div");
    tooltip.className = "custom-tooltip";
    tooltip.innerText = icon.getAttribute("data-tooltip");
    document.body.appendChild(tooltip);

    const rect = icon.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    let left = rect.left + window.scrollX + rect.width / 2 - tipRect.width / 2;
    left = Math.max(
      8,
      Math.min(left, window.scrollX + window.innerWidth - tipRect.width - 8),
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
  });

  icon.addEventListener("mouseleave", () => {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  });
});

function applySettingsToForm(s) {
  setCycleLen.value = s.cycleLength || 28;
  setPeriodLen.value = s.periodLength || 5;
  setAuto.checked = s.autoCalc !== false;
}

if (isConfigured) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      authView.classList.add("hidden");
      dashView.classList.remove("hidden");
      userChip.classList.remove("hidden");

      // Start session idle timeout timer
      resetIdleTimer();

      try {
        const settingsSnap = await getDoc(
          doc(db, "users", user.uid, "settings", "profile"),
        );
        if (settingsSnap.exists()) {
          currentSettings = {
            cycleLength: 28,
            periodLength: 5,
            autoCalc: true,
            ...settingsSnap.data(),
          };
        }
      } catch (err) {
        /* use defaults */
      }

      let nameToDisplay = currentSettings.displayName || user.displayName;
      if (!nameToDisplay && user.email) {
        nameToDisplay = user.email.split("@")[0];
      }
      userNameDisplay.textContent = nameToDisplay || "Account";

      applySettingsToForm(currentSettings);

      if (unsubEntries) unsubEntries();
      const q = query(
        collection(db, "users", user.uid, "entries"),
        orderBy("startDate", "desc"),
      );
      unsubEntries = onSnapshot(
        q,
        (snap) => {
          currentEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          refreshDashboard();
        },
        () => showToast("Couldn't load your history.", "error"),
      );
    } else {
      currentUser = null;
      currentEntries = [];
      clearTimeout(idleTimer);
      if (unsubEntries) {
        unsubEntries();
        unsubEntries = null;
      }
      dashView.classList.add("hidden");
      userChip.classList.add("hidden");
      authView.classList.remove("hidden");
      setMode("login");
    }
  });
} else {
  authView.classList.remove("hidden");
}
