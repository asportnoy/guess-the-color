const answerEl = document.getElementById('answer');
const optionsParent = document.getElementById('options');
const btnEasy = document.getElementById('difficulty-easy');
const btnMedium = document.getElementById('difficulty-medium');
const btnHard = document.getElementById('difficulty-hard');
const livesEl = document.getElementById('lives');
const scoreEl = document.getElementById('score');

const MAX_HEARTS = 7;
const NUM_OPTIONS = 5;
const option_html = '<div class="option" role="button"></div>';

optionsParent.innerHTML = option_html.repeat(NUM_OPTIONS);
const options = document.querySelectorAll('.option');

const DIFFICULTIES = {
	easy: {
		min: 40,
		max: 60,
	},
	medium: {
		min: 20,
		max: 40,
	},
	hard: {
		min: 10,
		max: 20,
	},
};

let difficulty = 'medium';

function checkReset() {
	if (score !== 0 || lives !== MAX_HEARTS) {
		if (!confirm('Are you sure you want to reset?')) return false;
		lives = MAX_HEARTS;
		score = 0;
	}
	return true;
}

btnEasy.addEventListener('click', () => {
	if (difficulty === 'easy') return;
	if (!checkReset()) return;
	difficulty = 'easy';
	btnEasy.classList.add('active');
	btnMedium.classList.remove('active');
	btnHard.classList.remove('active');
	chooseColors();
});

btnMedium.addEventListener('click', () => {
	if (difficulty === 'medium') return;
	if (!checkReset()) return;
	difficulty = 'medium';
	btnEasy.classList.remove('active');
	btnMedium.classList.add('active');
	btnHard.classList.remove('active');
	chooseColors();
});

btnHard.addEventListener('click', () => {
	if (difficulty === 'hard') return;
	if (!checkReset()) return;
	difficulty = 'hard';
	btnEasy.classList.remove('active');
	btnMedium.classList.remove('active');
	btnHard.classList.add('active');
	chooseColors();
});

function getMin() {
	return DIFFICULTIES[difficulty].min;
}

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
let lives = MAX_HEARTS;
let score = 0;
/**
 * Choose colors for game
 * @param {[number]} min minimum difference
 * @param {[number]} max maximum difference
 * @returns {[number, number, number][]} RGB colors
 */
function chooseColors(min = getMin(), max = getMax()) {
	answer = chooseRandomRgb();
	answerEl.innerText = rgbToHex(answer);
	colors = [answer];

	// Choose rest of colors
	while (colors.length < NUM_OPTIONS) {
		let color = chooseRandomRgb();
		let diff = getDiff(color, answer);
		if (diff > min && diff < max) colors.push(color);
	}

	// Randomize array
	colors = colors.sort(() => Math.random() - 0.5);

	// Set colors
	for (let [i, option] of options.entries()) {
		option.style.backgroundColor = rgbToHex(colors[i]);
		option.style.color = '';
		option.textContent = '';
		option.removeAttribute('disabled');
	}

	heartHTML(lives);
	scoreEl.textContent = `Score: ${score.toLocaleString()}`;
}

chooseColors();

let stopShakeTimeout;
function onClick(index, element) {
	if (colors[index] == null) return;
	if (answer === colors[index]) {
		score++;
		chooseColors();
	} else {
		let {L} = rgbToLab(colors[index]);
		element.style.color = L > 50 ? 'black' : 'white';
		element.textContent = rgbToHex(colors[index]);
		element.setAttribute('disabled', true);
		colors[index] = null;
		lives--;
		heartHTML(lives);
		if (lives <= 0) {
			alert(`Game Over! Score: ${score.toLocaleString()}`);
			lives = MAX_HEARTS;
			score = 0;
			chooseColors();
		} else {
			clearTimeout(stopShakeTimeout);
			livesEl.classList.remove('shake');
			livesEl.classList.add('shake');
			stopShakeTimeout = setTimeout(
				() => livesEl.classList.remove('shake'),
				1000,
			);
		}
	}
	document.body.focus();
}

for (let [i, option] of options.entries()) {
	option.addEventListener('click', () => onClick(i, option));
}

function heartHTML(count = MAX_HEARTS) {
	let html = '';
	for (let i = 0; i < MAX_HEARTS; i++) {
		html += `<span style="opacity: ${
			i >= count ? 0.25 : 1
		};">\u2665</span>`;
	}
	livesEl.innerHTML = html;
}
