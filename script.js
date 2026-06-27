// --- 1. FIREBASE KONFIGURATION (HIER DEINE DATEN EINTRAGEN!) ---
const firebaseConfig = {

  apiKey: "AIzaSyAnrRxAsw6gL1vuoC7FgBLssPI5D8EvQD0",

  authDomain: "leagueabilityquiz.firebaseapp.com",

  projectId: "leagueabilityquiz",

  storageBucket: "leagueabilityquiz.firebasestorage.app",

  messagingSenderId: "176820071797",

  appId: "1:176820071797:web:06b55e989f82b32f5f773c"

};


// Firebase initialisieren
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// ---------------------------------------------------------------

const MAX_ROUNDS = 10;

let abilities = [];
let currentQuestion = null;
let score = 0;
let rounds = 0;
let answered = false;
let selectedKey = null; 
let proMetaChampions = [];
let usedQuestions = [];
let useProMetaOnly = false;
let currentModeString = "";

let settings = { champ: true, key: true, ability: true };
let activeOptionsCount = 3; 

const setupScreen = document.getElementById("setupScreen");
const quizScreen = document.getElementById("quizScreen");
const endScreen = document.getElementById("endScreen");
const leaderboardScreen = document.getElementById("leaderboardScreen");

const startButton = document.getElementById("startButton");
const checkButton = document.getElementById("checkButton");
const nextButton = document.getElementById("nextButton");
const showLeaderboardBtn = document.getElementById("showLeaderboardBtn");
const submitScoreBtn = document.getElementById("submitScoreBtn");
const skipScoreBtn = document.getElementById("skipScoreBtn");
const backToSetupBtn = document.getElementById("backToSetupBtn");

const questionElement = document.getElementById("question");
const iconElement = document.getElementById("abilityIcon");
const championInput = document.getElementById("championInput");
const answerInput = document.getElementById("answerInput");
const abilityButtons = document.querySelectorAll(".ability-btn");
const correctAnswerElement = document.getElementById("correctAnswer");
const resultElement = document.getElementById("result");
const scoreElement = document.getElementById("score");
const playerNameInput = document.getElementById("playerNameInput");

// NEU: Dropdown für Leaderboard
const leaderboardModeSelect = document.getElementById("leaderboardModeSelect");

// Generiert alle möglichen Modus-Kombinationen für das Dropdown
function initLeaderboardSelect() {
  const combos = [
    "Champ", "Taste", "Fähigkeit",
    "Champ + Taste", "Champ + Fähigkeit", "Taste + Fähigkeit",
    "Champ + Taste + Fähigkeit"
  ];
  combos.forEach(c => {
    leaderboardModeSelect.add(new Option(c, c));
    leaderboardModeSelect.add(new Option(c + " (Pro)", c + " (Pro)"));
  });
}
initLeaderboardSelect();

// Liest den aktuellen Modus live aus den Checkboxen aus
function getCurrentModeFromUI() {
  let parts = [];
  if (document.getElementById("checkChamp").checked) parts.push("Champ");
  if (document.getElementById("checkKey").checked) parts.push("Taste");
  if (document.getElementById("checkAbility").checked) parts.push("Fähigkeit");
  if (parts.length === 0) parts.push("Champ"); // Fallback
  let mode = parts.join(" + ");
  if (document.getElementById("checkProMeta").checked) mode += " (Pro)";
  return mode;
}

// Wenn ein anderer Modus im Dropdown gewählt wird -> neu laden
leaderboardModeSelect.addEventListener("change", loadLeaderboard);

checkButton.addEventListener("click", checkAnswer);

nextButton.addEventListener("click", () => {
  if (rounds >= MAX_ROUNDS) {
    quizScreen.style.display = "none";
    endScreen.style.display = "block";
    const maxScore = MAX_ROUNDS * activeOptionsCount;
    document.getElementById("finalScoreText").textContent = `Du hast ${score} von ${maxScore} Punkten erreicht! (${currentModeString})`;
    playerNameInput.focus();
  } else {
    newQuestion();
  }
});

startButton.addEventListener("click", () => {
  settings.champ = document.getElementById("checkChamp").checked;
  settings.key = document.getElementById("checkKey").checked;
  settings.ability = document.getElementById("checkAbility").checked;
  useProMetaOnly = document.getElementById("checkProMeta").checked;

  if (!settings.champ && !settings.key && !settings.ability) {
    alert("Bitte wähle mindestens eine Sache aus!"); return;
  }

  currentModeString = getCurrentModeFromUI();
  activeOptionsCount = (settings.champ ? 1 : 0) + (settings.key ? 1 : 0) + (settings.ability ? 1 : 0);

  score = 0; rounds = 0;
  usedQuestions = [];
  setupScreen.style.display = "none";
  quizScreen.style.display = "block";
  nextButton.textContent = "Nächste Frage"; 
  newQuestion();
});

abilityButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (answered) return;
    abilityButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedKey = btn.getAttribute("data-key");
  });
});

showLeaderboardBtn.addEventListener("click", () => {
  leaderboardModeSelect.value = getCurrentModeFromUI(); // Dropdown auf aktuelle Auswahl setzen
  setupScreen.style.display = "none";
  loadLeaderboard();
});

skipScoreBtn.addEventListener("click", () => {
  leaderboardModeSelect.value = currentModeString;
  endScreen.style.display = "none";
  loadLeaderboard();
});

backToSetupBtn.addEventListener("click", () => {
  leaderboardScreen.style.display = "none";
  setupScreen.style.display = "block";
});

submitScoreBtn.addEventListener("click", async () => {
  const name = playerNameInput.value.trim() || "Anonym";
  submitScoreBtn.disabled = true;
  submitScoreBtn.textContent = "Speichere...";

  try {
    // NEU: Speichert in einer separaten Tabelle pro Modus!
    await db.collection("leaderboards").doc(currentModeString).collection("scores").add({
      name: name,
      score: score,
      maxScore: MAX_ROUNDS * activeOptionsCount,
      rounds: rounds,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    alert("Score konnte nicht gespeichert werden.");
  }

  submitScoreBtn.disabled = false;
  submitScoreBtn.textContent = "Score eintragen";
  playerNameInput.value = "";
  
  leaderboardModeSelect.value = currentModeString;
  endScreen.style.display = "none";
  loadLeaderboard();
});

// --- LEADERBOARD LOGIK ---
async function loadLeaderboard() {
  leaderboardScreen.style.display = "block";
  const tbody = document.getElementById("leaderboardBody");
  tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Lade Ranking...</td></tr>";

  const selectedMode = leaderboardModeSelect.value;

  try {
    // Holt die Scores NUR für den ausgewählten Modus
    const snapshot = await db.collection("leaderboards").doc(selectedMode).collection("scores")
                             .orderBy("score", "desc")
                             .limit(10)
                             .get();
                             
    tbody.innerHTML = "";
    let rank = 1;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const tr = document.createElement("tr");
      
      let rankDisplay = rank;
      if (rank === 1) rankDisplay = "🥇";
      if (rank === 2) rankDisplay = "🥈";
      if (rank === 3) rankDisplay = "🥉";
      
      tr.innerHTML = `
        <td>${rankDisplay}</td>
        <td><strong>${data.name}</strong></td>
        <td>${data.score} <span style="font-size: 0.8em; color: #888;">/ ${data.maxScore || '?'}</span></td>
      `;
      tbody.appendChild(tr);
      rank++;
    });

    if (snapshot.empty) {
      tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Noch keine Einträge für diesen Modus!</td></tr>";
    }
  } catch (error) {
    console.error("Fehler beim Laden:", error);
    tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Fehler beim Laden.</td></tr>";
  }
}

// --- DATEN LADEN & QUIZ LOGIK (Rest bleibt identisch) ---
async function loadProMeta() {
  try {
    const response = await fetch("pro-meta.json");
    if (!response.ok) throw new Error("pro-meta.json konnte nicht geladen werden");
    const data = await response.json();
    proMetaChampions = data.champions.map(entry => entry.champion);
  } catch (error) {
    console.warn("Pro-Play-Meta konnte nicht geladen werden:", error);
    proMetaChampions = [];
  }
}

async function loadAbilities() {
  const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions = await versionResponse.json();
  const version = versions[0];
  const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/championFull.json`);
  const data = await response.json();

  abilities = Object.values(data.data).map(champion => {
    return {
      champion: champion.name,
      abilities: {
        P: { name: champion.passive.name, icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${champion.passive.image.full}` },
        Q: { name: champion.spells[0].name, icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${champion.spells[0].image.full}` },
        W: { name: champion.spells[1].name, icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${champion.spells[1].image.full}` },
        E: { name: champion.spells[2].name, icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${champion.spells[2].image.full}` },
        R: { name: champion.spells[3].name, icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${champion.spells[3].image.full}` }
      }
    };
  });
}

function getAbilityLabel(key) { return key === "P" ? "Passive" : key; }

function getQuestionPool() {
  if (!useProMetaOnly) return abilities;
  const filtered = abilities.filter(champion => proMetaChampions.includes(champion.champion));
  if (filtered.length === 0) return abilities;
  return filtered;
}

function newQuestion() {
  const questionPool = getQuestionPool();
  const keys = ["P", "Q", "W", "E", "R"];

  const allPossibleQuestions = [];

  questionPool.forEach(champion => {
    keys.forEach(key => {
      allPossibleQuestions.push({
        champion,
        key,
        id: `${champion.champion}-${key}`
      });
    });
  });

  let availableQuestions = allPossibleQuestions.filter(question =>
    !usedQuestions.includes(question.id)
  );

  // Falls alle Kombinationen schon benutzt wurden, wieder von vorne anfangen.
  // Bei 10 Runden passiert das normalerweise nicht.
  if (availableQuestions.length === 0) {
    usedQuestions = [];
    availableQuestions = allPossibleQuestions;
  }

  const selectedQuestion =
    availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

  const champion = selectedQuestion.champion;
  const key = selectedQuestion.key;

  usedQuestions.push(selectedQuestion.id);

  currentQuestion = {
    champion: champion.champion, key: key, answer: champion.abilities[key].name, icon: champion.abilities[key].icon
  };

  let promptParts = [];
  if (settings.champ) promptParts.push("den Champion");
  if (settings.key) promptParts.push("die Taste");
  if (settings.ability) promptParts.push("den Namen der Fähigkeit");

  let promptText = "Errate ";
  if (promptParts.length === 1) promptText += promptParts[0];
  else if (promptParts.length === 2) promptText += promptParts[0] + " und " + promptParts[1];
  else promptText += promptParts[0] + ", " + promptParts[1] + " und " + promptParts[2];
  promptText += "!";

  let hints = [];
  if (!settings.champ) hints.push(`Champion: ${currentQuestion.champion}`);
  if (!settings.key) hints.push(`Taste: ${getAbilityLabel(currentQuestion.key)}`);
  if (!settings.ability) hints.push(`Fähigkeit: ${currentQuestion.answer}`);
  if (hints.length > 0) promptText += ` (${hints.join(" | ")})`;
  
  questionElement.textContent = promptText;
  iconElement.src = currentQuestion.icon;
  
  championInput.style.display = settings.champ ? "block" : "none";
  document.getElementById("abilityButtons").style.display = settings.key ? "flex" : "none";
  answerInput.style.display = settings.ability ? "block" : "none";

  championInput.value = ""; answerInput.value = ""; resultElement.textContent = "";

  selectedKey = null;
  abilityButtons.forEach(b => { b.classList.remove("selected"); b.disabled = false; });

  checkButton.style.display = "inline-block"; nextButton.style.display = "none";
  championInput.disabled = false; answerInput.disabled = false;
  correctAnswerElement.textContent = ""; resultElement.className = ""; answered = false;
  
  if (settings.champ) championInput.focus();
  else if (settings.ability) answerInput.focus();
}

function getAcceptedAnswers(answer) {
  return answer.split("/").map(part => part.trim()).filter(part => part.length > 0).concat(answer);
}

function handleEnter(event) {
  if (event.key === "Enter") {
    if (nextButton.style.display === "none") checkAnswer();
    else if (rounds < MAX_ROUNDS) newQuestion();
  }
}

championInput.addEventListener("keydown", handleEnter);
answerInput.addEventListener("keydown", handleEnter);

function checkAnswer() {
  if (!currentQuestion || answered) return;

  answered = true;
  let pointsThisRound = 0;
  let userDetails = [];
  let correctDetails = [];

  if (settings.champ) {
    const originalUserChamp = championInput.value.trim();
    const userChamp = normalize(originalUserChamp);
    const acceptedChamp = normalize(currentQuestion.champion);
    const isChampCorrect = levenshtein(userChamp, acceptedChamp) <= (acceptedChamp.length <= 8 ? 1 : 2);
    if (isChampCorrect) pointsThisRound++;
    userDetails.push(`${originalUserChamp || "Leer"} (${isChampCorrect ? "✓" : "✗"})`);
    correctDetails.push(currentQuestion.champion);
  }

  if (settings.key) {
    const isKeyCorrect = selectedKey === currentQuestion.key;
    if (isKeyCorrect) pointsThisRound++;
    userDetails.push(`${selectedKey || "Keine"} (${isKeyCorrect ? "✓" : "✗"})`);
    correctDetails.push(currentQuestion.key);
  }

  if (settings.ability) {
    const originalUserAbility = answerInput.value.trim();
    const userAbility = normalize(originalUserAbility);
    const acceptedAnswers = getAcceptedAnswers(currentQuestion.answer);
    const closestAbility = acceptedAnswers.reduce((best, answer) => {
      const distance = levenshtein(userAbility, normalize(answer));
      if (!best || distance < best.distance) return { answer: answer, distance: distance };
      return best;
    }, null);
    const isAbilityCorrect = closestAbility && closestAbility.distance <= (closestAbility.answer.length <= 8 ? 1 : 2);
    if (isAbilityCorrect) pointsThisRound++;
    userDetails.push(`${originalUserAbility || "Leer"} (${isAbilityCorrect ? "✓" : "✗"})`);
    correctDetails.push(currentQuestion.answer);
  }

  score += pointsThisRound; rounds++;

  resultElement.textContent = `Ergebnis: ${pointsThisRound} von ${activeOptionsCount} Punkten erhalten!`;
  if (pointsThisRound === activeOptionsCount) resultElement.className = "correct";
  else if (pointsThisRound === 0) resultElement.className = "wrong";
  else resultElement.className = "close";

  correctAnswerElement.innerHTML = `<strong>Deine Antwort:</strong> ${userDetails.join(" | ")} <br><br><strong>Richtige Antwort:</strong> ${correctDetails.join(" | ")}`;
  scoreElement.textContent = `Punkte: ${score} / ${rounds * activeOptionsCount}`;

  checkButton.style.display = "none"; nextButton.style.display = "inline-block";
  if (rounds >= MAX_ROUNDS) nextButton.textContent = "Ergebnis ansehen";

  championInput.disabled = true; answerInput.disabled = true; abilityButtons.forEach(b => b.disabled = true);
}

function normalize(text) {
  return text.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’`´]/g, "").replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

startGame();

async function startGame() { await loadAbilities(); await loadProMeta(); }