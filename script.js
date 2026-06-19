let abilities = [];
let currentQuestion = null;
let score = 0;
let rounds = 0;
let answered = false;

const questionElement = document.getElementById("question");
const iconElement = document.getElementById("abilityIcon");
const answerInput = document.getElementById("answerInput");
const correctAnswerElement = document.getElementById("correctAnswer");
const resultElement = document.getElementById("result");
const scoreElement = document.getElementById("score");

const checkButton = document.getElementById("checkButton");
const nextButton = document.getElementById("nextButton");

checkButton.addEventListener("click", checkAnswer);
nextButton.addEventListener("click", newQuestion);

async function getLatestVersion() {
  const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions = await response.json();
  return versions[0];
}

async function loadAbilities() {
  const version = await getLatestVersion();

  const championListResponse = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
  );

  const championListData = await championListResponse.json();
  const championIds = Object.keys(championListData.data);

  const championPromises = championIds.map(async (championId) => {
    const response = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${championId}.json`
    );

    const data = await response.json();
    const champion = data.data[championId];

    return {
      champion: champion.name,
      abilities: {
        P: {
          name: champion.passive.name,
          icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${champion.passive.image.full}`
        },
        Q: {
          name: champion.spells[0].name,
          icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${champion.spells[0].image.full}`
        },
        W: {
          name: champion.spells[1].name,
          icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${champion.spells[1].image.full}`
        },
        E: {
          name: champion.spells[2].name,
          icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${champion.spells[2].image.full}`
        },
        R: {
          name: champion.spells[3].name,
          icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${champion.spells[3].image.full}`
        }
      }
    };
  });

  abilities = await Promise.all(championPromises);
  newQuestion();
}

function getAbilityLabel(key) {
  if (key === "P") return "Passive";
  return key;
}

function newQuestion() {
  const champion = abilities[Math.floor(Math.random() * abilities.length)];
  const keys = ["P", "Q", "W", "E", "R"];
  const key = keys[Math.floor(Math.random() * keys.length)];

  currentQuestion = {
    champion: champion.champion,
    key: key,
    answer: champion.abilities[key].name,
    icon: champion.abilities[key].icon
  };

  questionElement.textContent =
    `Champion: ${currentQuestion.champion} | Fähigkeit: ${getAbilityLabel(currentQuestion.key)}`;

  iconElement.src = currentQuestion.icon;
  answerInput.value = "";
  resultElement.textContent = "";

  checkButton.style.display = "inline-block";
  nextButton.style.display = "none";
  answerInput.disabled = false;
  correctAnswerElement.textContent = "";
  resultElement.className = "";
  answered = false;
  answerInput.focus();
}

function getAcceptedAnswers(answer) {
  return answer
    .split("/")
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .concat(answer);
}

answerInput.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    if (nextButton.style.display === "none") {
      checkAnswer();
    } else {
      newQuestion();
    }
  }
});

function checkAnswer() {
  if (!currentQuestion) return;
  if (answered) return;

  answered = true;

  const originalUserAnswer = answerInput.value.trim();
  const userAnswer = normalize(originalUserAnswer);

  const acceptedAnswers = getAcceptedAnswers(currentQuestion.answer);
  const normalizedAcceptedAnswers = acceptedAnswers.map(answer => normalize(answer));

  const exactMatch = normalizedAcceptedAnswers.includes(userAnswer);

  const closestAnswer = acceptedAnswers.reduce((best, answer) => {
    const distance = levenshtein(userAnswer, normalize(answer));

    if (!best || distance < best.distance) {
      return {
        answer: answer,
        distance: distance
      };
    }

    return best;
  }, null);

  const maxDistance =
    closestAnswer.answer.length <= 8 ? 1 : 2;

  rounds++;

  if (exactMatch) {
    score++;
    resultElement.textContent = "Richtig!";
  } else if (closestAnswer.distance <= maxDistance) {
    score++;
    resultElement.textContent = "Fast richtig!";
  } else {
    resultElement.textContent = "Falsch!";
  }

  correctAnswerElement.textContent =
    `Deine Antwort: ${originalUserAnswer || "-"} | Richtige Antwort: ${currentQuestion.answer}`;

  scoreElement.textContent = `Punkte: ${score} / ${rounds}`;

  checkButton.style.display = "none";
  nextButton.style.display = "inline-block";
  answerInput.disabled = true;
}

function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

loadAbilities();