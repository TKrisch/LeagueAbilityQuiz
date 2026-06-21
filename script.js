let abilities = [];
let currentQuestion = null;
let score = 0;
let rounds = 0;
let answered = false;
let selectedKey = null; 
let proMetaChampions = [];
let useProMetaOnly = false;

// Speichert, welche Optionen aktiv sind
let settings = {
  champ: true,
  key: true,
  ability: true
};
let activeOptionsCount = 3; // Wie viele Punkte es pro Runde maximal gibt

const setupScreen = document.getElementById("setupScreen");
const quizScreen = document.getElementById("quizScreen");
const startButton = document.getElementById("startButton");

const questionElement = document.getElementById("question");
const iconElement = document.getElementById("abilityIcon");
const championInput = document.getElementById("championInput");
const answerInput = document.getElementById("answerInput");
const abilityButtons = document.querySelectorAll(".ability-btn");
const correctAnswerElement = document.getElementById("correctAnswer");
const resultElement = document.getElementById("result");
const scoreElement = document.getElementById("score");

const checkButton = document.getElementById("checkButton");
const nextButton = document.getElementById("nextButton");

checkButton.addEventListener("click", checkAnswer);
nextButton.addEventListener("click", newQuestion);

// Start-Button Logik
startButton.addEventListener("click", () => {
  settings.champ = document.getElementById("checkChamp").checked;
  settings.key = document.getElementById("checkKey").checked;
  settings.ability = document.getElementById("checkAbility").checked;
  useProMetaOnly = document.getElementById("checkProMeta").checked;

  // Validierung: Mindestens ein Haken muss gesetzt sein
  if (!settings.champ && !settings.key && !settings.ability) {
    alert("Bitte wähle mindestens eine Sache aus, die du erraten möchtest!");
    return;
  }

  // Berechne maximale Punktzahl pro Runde
  activeOptionsCount = (settings.champ ? 1 : 0) + (settings.key ? 1 : 0) + (settings.ability ? 1 : 0);

  // Wechsle den Bildschirm
  setupScreen.style.display = "none";
  quizScreen.style.display = "block";
  
  newQuestion();
});

// Zuweisung der Tasten-Auswahl
abilityButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (answered) return;
    abilityButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedKey = btn.getAttribute("data-key");
  });
});

async function loadProMeta() {
  try {
    const response = await fetch("pro-meta.json");

    if (!response.ok) {
      throw new Error("pro-meta.json konnte nicht geladen werden");
    }

    const data = await response.json();
    proMetaChampions = data.champions.map(entry => entry.champion);

    console.log("Pro-Play-Champions geladen:", proMetaChampions);
  } catch (error) {
    console.warn("Pro-Play-Meta konnte nicht geladen werden:", error);
    proMetaChampions = [];
  }
}

async function loadAbilities() {
  const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions = await versionResponse.json();
  const version = versions[0];

  const response = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/championFull.json`
  );

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

function getAbilityLabel(key) {
  if (key === "P") return "Passive";
  return key;
}

function getQuestionPool() {
  if (!useProMetaOnly) {
    return abilities;
  }

  const filtered = abilities.filter(champion =>
    proMetaChampions.includes(champion.champion)
  );

  if (filtered.length === 0) {
    console.warn("Keine Pro-Play-Champions gefunden. Nutze alle Champions.");
    return abilities;
  }

  return filtered;
}

function newQuestion() {
  const questionPool = getQuestionPool();
  const champion = questionPool[Math.floor(Math.random() * questionPool.length)];
  const keys = ["P", "Q", "W", "E", "R"];
  const key = keys[Math.floor(Math.random() * keys.length)];

  currentQuestion = {
    champion: champion.champion,
    key: key,
    answer: champion.abilities[key].name,
    icon: champion.abilities[key].icon
  };

  // 1. Fragetext dynamisch generieren je nach Auswahl
  let promptParts = [];
  if (settings.champ) promptParts.push("den Champion");
  if (settings.key) promptParts.push("die Taste");
  if (settings.ability) promptParts.push("den Namen der Fähigkeit");

  let promptText = "Errate ";
  if (promptParts.length === 1) promptText += promptParts[0];
  else if (promptParts.length === 2) promptText += promptParts[0] + " und " + promptParts[1];
  else promptText += promptParts[0] + ", " + promptParts[1] + " und " + promptParts[2];
  promptText += "!";

  // 2. Hilfestellungen für nicht gewählte Optionen einblenden
  let hints = [];
  if (!settings.champ) hints.push(`Champion: ${currentQuestion.champion}`);
  if (!settings.key) hints.push(`Taste: ${getAbilityLabel(currentQuestion.key)}`);
  if (!settings.ability) hints.push(`Fähigkeit: ${currentQuestion.answer}`);

  if (hints.length > 0) {
    promptText += ` (${hints.join(" | ")})`;
  }
  
  questionElement.textContent = promptText;
  iconElement.src = currentQuestion.icon;
  
  // Inputs ein- oder ausblenden
  championInput.style.display = settings.champ ? "block" : "none";
  document.getElementById("abilityButtons").style.display = settings.key ? "flex" : "none";
  answerInput.style.display = settings.ability ? "block" : "none";

  championInput.value = "";
  answerInput.value = "";
  resultElement.textContent = "";

  selectedKey = null;
  abilityButtons.forEach(b => {
    b.classList.remove("selected");
    b.disabled = false;
  });

  checkButton.style.display = "inline-block";
  nextButton.style.display = "none";
  
  championInput.disabled = false;
  answerInput.disabled = false;
  correctAnswerElement.textContent = "";
  resultElement.className = "";
  answered = false;
  
  // Fokus setzen auf das erste sichtbare Eingabefeld
  if (settings.champ) championInput.focus();
  else if (settings.ability) answerInput.focus();
}

function getAcceptedAnswers(answer) {
  return answer.split("/").map(part => part.trim()).filter(part => part.length > 0).concat(answer);
}

function handleEnter(event) {
  if (event.key === "Enter") {
    if (nextButton.style.display === "none") {
      checkAnswer();
    } else {
      newQuestion();
    }
  }
}

championInput.addEventListener("keydown", handleEnter);
answerInput.addEventListener("keydown", handleEnter);

function checkAnswer() {
  if (!currentQuestion) return;
  if (answered) return;

  answered = true;
  let pointsThisRound = 0;
  let userDetails = [];
  let correctDetails = [];

  // 1. Champion prüfen (falls aktiv)
  if (settings.champ) {
    const originalUserChamp = championInput.value.trim();
    const userChamp = normalize(originalUserChamp);
    const acceptedChamp = normalize(currentQuestion.champion);
    const champDistance = levenshtein(userChamp, acceptedChamp);
    const isChampCorrect = champDistance <= (acceptedChamp.length <= 8 ? 1 : 2);
    
    if (isChampCorrect) pointsThisRound++;
    userDetails.push(`${originalUserChamp || "Leer"} (${isChampCorrect ? "✓" : "✗"})`);
    correctDetails.push(currentQuestion.champion);
  }

  // 2. Taste prüfen (falls aktiv)
  if (settings.key) {
    const isKeyCorrect = selectedKey === currentQuestion.key;
    if (isKeyCorrect) pointsThisRound++;
    userDetails.push(`${selectedKey || "Keine"} (${isKeyCorrect ? "✓" : "✗"})`);
    correctDetails.push(currentQuestion.key);
  }

  // 3. Fähigkeitsname prüfen (falls aktiv)
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

  score += pointsThisRound;
  rounds++;
  const maxPossibleScore = rounds * activeOptionsCount;

  // Ergebnis-Text bestimmen
  resultElement.textContent = `Ergebnis: ${pointsThisRound} von ${activeOptionsCount} Punkten erhalten!`;
  if (pointsThisRound === activeOptionsCount) {
    resultElement.className = "correct";
  } else if (pointsThisRound === 0) {
    resultElement.className = "wrong";
  } else {
    resultElement.className = "close";
  }

  // Auflösung anzeigen
  correctAnswerElement.innerHTML = `
    <strong>Deine Antwort:</strong> ${userDetails.join(" | ")} <br><br>
    <strong>Richtige Antwort:</strong> ${correctDetails.join(" | ")}
  `;

  scoreElement.textContent = `Punkte: ${score} / ${maxPossibleScore}`;

  checkButton.style.display = "none";
  nextButton.style.display = "inline-block";
  championInput.disabled = true;
  answerInput.disabled = true;
  abilityButtons.forEach(b => b.disabled = true);
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
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

startGame();

async function startGame() {
  await loadAbilities();
  await loadProMeta();
}