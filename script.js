const answerEl = document.getElementById('answer');
const optionsParent = document.getElementById('options');
const btnEasy = document.getElementById('difficulty-easy');
const btnMedium = document.getElementById('difficulty-medium');
const btnHard = document.getElementById('difficulty-hard');
const livesEl = document.getElementById('lives');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highscore');

const MAX_HEARTS = 7;
const NUM_OPTIONS = 6;
const option_html = '<button class="option" tabindex="0"></button>';

optionsParent.innerHTML = option_html.repeat(NUM_OPTIONS);
const options = document.querySelectorAll('.option');

const DIFFICULTIES = {
	easy: {
		min: 40,
		max: 60,
		el: btnEasy,
	},
	medium: {
		min: 20,
		max: 40,
		el: btnMedium,
	},
	hard: {
		min: 10,
		max: 20,
		el: btnHard,
	},
};

/**
 * Reset game
 */
function reset() {
	lives = MAX_HEARTS;
	score = 0;
	streak = 0;
	window.localStorage.removeItem(`gtc-game`);
	chooseColors();
}

/**
 * Save game to local storage
 */
function saveGame() {
	let json = {
		answer,
		colors,
		guessed,
		lives,
		score,
		streak,
	};

	window.localStorage.setItem(`gtc-game`, JSON.stringify(json));
}

/**
 * Load game from local storage
 */
function loadGame() {
	let state = window.localStorage.getItem(`gtc-game`);
	if (!state) return reset();
	state = JSON.parse(state);

	answer = state.answer;
	colors = state.colors;
	guessed = state.guessed;
	lives = state.lives;
	score = state.score;
	streak = state.streak;

	update();
}

/**
 * Change difficulty
 * @param {string} diff Difficulty to change to
 * @param {boolean} [initial=false] Whether this is the initial difficulty change
 */
function setDifficulty(diff, initial) {
	if (difficulty === diff) return;
	if (!initial && (score || (lives && lives !== MAX_HEARTS))) {
		if (!confirm('Are you sure you want to reset?')) return;
	}
	highScore = parseInt(
		window.localStorage.getItem(`gtc-highscore-${diff}`) || 0,
	);
	difficulty = diff;
	window.localStorage.setItem('gtc-mode', diff);
	Object.entries(DIFFICULTIES).forEach(([key, {el}]) => {
		el.classList[diff === key ? 'add' : 'remove']('active');
	});
	highScoreEl.innerText = `High Score: ${highScore.toLocaleString()}`;
	if (!initial) reset();
}

// Mode button handlers

btnEasy.addEventListener('click', () => {
	setDifficulty('easy');
});

btnMedium.addEventListener('click', () => {
	setDifficulty('medium');
});

btnHard.addEventListener('click', () => {
	setDifficulty('hard');
});

/**
 * Get minimum difference for selected difficulty
 * @returns {number} Minimum difference
 */
function getMin() {
	return DIFFICULTIES[difficulty].min;
}

/**
 * Get maximum difference for selected difficulty
 * @returns {number} Maximum difference
 */
function getMax() {
	return DIFFICULTIES[difficulty].max;
}

/**
 * Choose a random RGB color
 * @returns {[number, number, number]} RGB color
 */
function chooseRandomRgb() {
	return new Array(3).fill().map(() => Math.floor(Math.random() * 256));
}

/**
 * Convert RGB to hex
 * @param {[number, number, number]} rgb RGB color
 * @returns {string} hex color
 */
function rgbToHex(rgb) {
	return `#${rgb
		.map(v => v.toString(16).padStart(2, '0'))
		.join('')
		.toUpperCase()}`;
}

/**
 * Convert RGB to LAB
 * @param {[number, number, number]} rgb RGB color
 * @returns {LAB} LAB color configuration object
 */
function rgbToLab([r, g, b]) {
	r /= 255;
	g /= 255;
	b /= 255;

	r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
	g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
	b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

	let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
	let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
	let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

	x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
	y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
	z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

	return {L: 116 * y - 16, A: 500 * (x - y), B: 200 * (y - z)};
}

/**
 * Get difference between 2 hex colors using Delta E
 * @param {[number, number, number]} color1 RGB color
 * @param {[number, number, number]} color2 RGB color
 * @returns {number} difference between colors (0-100)
 */
function getDiff(color1, color2) {
	return (
		Math.round(
			new dE00(rgbToLab(color1), rgbToLab(color2)).getDeltaE() * 100,
		) / 100
	);
}

let answer;
let colors;
let guessed;
let lives;
let score;
let streak;
let highScore;
let difficulty;

/**
 * Choose colors for round
 * @param {[number]} min minimum difference
 * @param {[number]} max maximum difference
 * @returns {[number, number, number][]} RGB colors
 */
function chooseColors(min = getMin(), max = getMax()) {
	let bgColor = document.body.style.backgroundColor
		? window
				.getComputedStyle(document.body)
				.backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, \d+)?\)/)
				.slice(1)
				.map(x => parseInt(x))
		: [255, 255, 255];
	answer = chooseRandomRgb();
	if (getDiff(answer, bgColor) < 10) return chooseRandomRgb(min, max);
	colors = [answer];

	// Choose rest of colors
	let i = 0;
	while (colors.length < NUM_OPTIONS) {
		let color = chooseRandomRgb();
		let answerDiff = getDiff(color, answer);
		let allDiffs = colors.map(c => getDiff(color, c));

		let bgDiff = getDiff(color, bgColor);
		// Check that color is not too similar to answer or other colors
		if (
			answerDiff > min &&
			answerDiff < max &&
			allDiffs.every(diff => diff > 10) &&
			bgDiff > 10
		)
			colors.push(color);
		i++;
		if (i > 10000) return chooseRandomRgb(min, max); // Got stuck generating colors, start over.
	}

	// Randomize array
	colors = colors.sort(() => Math.random() - 0.5);

	guessed = new Array(NUM_OPTIONS).fill(false);

	update();
}

/**
 * Update game elements
 */
function update() {
	// Set element colors
	for (let [i, option] of options.entries()) {
		option.style.backgroundColor = rgbToHex(colors[i]);
		let {L} = rgbToLab(colors[i]);
		option.style.color = L > 50 ? 'black' : 'white';
		if (guessed[i]) {
			option.textContent = rgbToHex(colors[i]);
			option.setAttribute('disabled', true);
		} else {
			option.textContent = i + 1;
			option.removeAttribute('disabled');
		}
	}

	// Update HTML
	answerEl.innerText = rgbToHex(answer);
	heartHTML(lives);
	scoreEl.textContent = `Score: ${score.toLocaleString()}`;
	if (score > highScore) {
		highScore = score;
		highScoreEl.innerText = `High Score: ${highScore.toLocaleString()}`;
		window.localStorage.setItem(`gtc-highscore-${difficulty}`, highScore);
	}
}

let stopShakeTimeout;
/**
 * Handle clicks from guess elements
 * @param {number} index The index of the button
 * @param {HTMLElement} element The button that was clicked
 */
function onClick(index, element) {
	if (guessed[index]) return; // Button was disabled
	focusIndex = index;
	if (answer.every((x, i) => x === colors[index][i])) {
		// Correct
		score++;
		// Give life back if 5 in a row correct
		streak++;
		if (streak >= 5 && lives < MAX_HEARTS) {
			lives++;
			streak = 0;
		}
		chooseColors();
	} else {
		// Disable button
		guessed[index] = true;
		// Reduce lives
		lives--;
		// Reset streak
		streak = 0;

		update();

		if (lives <= 0) {
			// Game over
			alert(`Game Over! Score: ${score.toLocaleString()}`);
			reset();
		} else {
			// Shake hearts
			clearTimeout(stopShakeTimeout);
			livesEl.classList.remove('shake');
			livesEl.classList.add('shake');
			stopShakeTimeout = setTimeout(
				() => livesEl.classList.remove('shake'),
				1000,
			);
		}
	}

	saveGame();
}

// Add event listeners
for (let [i, option] of options.entries()) {
	option.addEventListener('click', () => onClick(i, option));
	option.addEventListener('focus', () => (focusIndex = i));
}

// Keypress event listener
let keys = ['1', '2', '3', '4', '5', '6'];
let focusIndex;
window.addEventListener('keydown', e => {
	if (keys.includes(e.key)) {
		focusIndex = keys.indexOf(e.key);
		options[focusIndex].focus();
	}

	if (e.key === 'ArrowRight') {
		if (focusIndex == null) focusIndex = 0;
		else {
			do {
				focusIndex++;
				if (focusIndex >= options.length) focusIndex = 0;
			} while (guessed[focusIndex]);
		}
		options[focusIndex].focus();
	}

	if (e.key === 'ArrowLeft') {
		if (focusIndex == null) focusIndex = options.length - 1;
		else {
			do {
				focusIndex--;
				if (focusIndex < 0) focusIndex = options.length - 1;
			} while (guessed[focusIndex]);
		}
		options[focusIndex].focus();
	}
});

/**
 * Update heart display
 * @param {number} [count] Number of hearts left
 */
function heartHTML(count = MAX_HEARTS) {
	let html = '';
	for (let i = 0; i < MAX_HEARTS; i++) {
		html += `<span style="opacity: ${
			i >= count ? 0.25 : 1
		};">\u2665</span>`;
	}
	livesEl.innerHTML = html;
}

// Start game
setDifficulty(window.localStorage.getItem('gtc-mode') || 'medium', true);
loadGame();
