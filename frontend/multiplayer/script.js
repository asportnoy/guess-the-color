const pageHome = document.getElementById('home');
const pageGame = document.getElementById('game');
const answerEl = document.getElementById('answer');
const optionsParent = document.getElementById('options');
const btnEasy = document.getElementById('difficulty-easy');
const btnMedium = document.getElementById('difficulty-medium');
const btnHard = document.getElementById('difficulty-hard');
const formJoin = document.getElementById('join');
const inputCode = document.getElementById('code');
const joinMessage = document.getElementById('join-message');
const btnPlay = document.getElementById('btn-play');
const btnHome = document.getElementById('btn-home');
const difficultyEl = document.getElementById('difficulty');
const codeEl = document.getElementById('display-code');
const livesEl = document.getElementById('lives');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highscore');
const noticeEl = document.getElementById('notice');

const MAX_HEARTS = 7;
const NUM_OPTIONS = 6;
const option_html = '<button class="option" tabindex="0"></button>';

optionsParent.innerHTML = option_html.repeat(NUM_OPTIONS);
const options = document.querySelectorAll('.option');

const DIFFICULTIES = {
	easy: {
		el: btnEasy,
	},
	medium: {
		el: btnMedium,
	},
	hard: {
		el: btnHard,
	},
};

/**
 * Start game
 */
function start() {
	pageHome.style.display = 'none';
	pageGame.style.display = '';
}

/**
 * Reset game
 */
function reset() {
	if (socket) socket.close();
	connected = false;
	inputCode.value = '';

	pageHome.style.display = '';
	pageGame.style.display = 'none';
	btnPlay.removeAttribute('disabled');
	formJoin.removeAttribute('disabled');
	inputCode.removeAttribute('readonly');
	joinMessage.style.display = 'none';
	Object.values(DIFFICULTIES).forEach(({el}) => {
		el.setAttribute('disabled', false);
	});
}

/**
 * Change difficulty
 * @param {string} diff Difficulty to change to
 * @param {boolean} updateSetting Update local storage setting
 */
function setDifficulty(diff, updateSetting) {
	difficulty = diff;
	if (updateSetting)
		window.localStorage.setItem('gtc-multiplayer-mode', diff);
	Object.entries(DIFFICULTIES).forEach(([key, {el}]) => {
		el.classList[diff === key ? 'add' : 'remove']('button-green');
	});
	difficultyEl.textContent = `Difficulty: ${difficulty}`;
}

// Mode button handlers

btnEasy.addEventListener('click', () => {
	setDifficulty('easy', true);
});

btnMedium.addEventListener('click', () => {
	setDifficulty('medium', true);
});

btnHard.addEventListener('click', () => {
	setDifficulty('hard', true);
});

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

let answer;
let colors;
let guessed;
let lives;
let score;
let difficulty;

/**
 * Update game elements
 */
function update() {
	// Set element colors
	if (colors) {
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
	}

	// Update HTML
	answerEl.innerText = answer ? rgbToHex(answer) : '';
	heartHTML(lives);
	scoreEl.textContent = `Score: ${score.toLocaleString()}`;
}

let noticeTimeout;
/**
 * Display notice text
 * @param {string} text Text to display
 */
function notice(text) {
	noticeEl.textContent = text;
	noticeEl.classList.remove('fade-out');
	noticeEl.classList.add('fade-in');
	noticeEl.style.opacity = 1;
	clearTimeout(noticeTimeout);
	setTimeout(() => {
		noticeEl.classList.add('fade-out');
		noticeEl.classList.remove('fade-in');
		noticeEl.style.opacity = 0;
	}, 5000);
}

// Add event listeners
for (let [i, option] of options.entries()) {
	option.addEventListener('click', () => {
		sendJSON({
			type: 'guess',
			index: i,
		});
	});
	option.addEventListener('focus', () => (focusIndex = i));
}

// Keypress event listener
let keys = ['1', '2', '3', '4', '5', '6'];
let focusIndex;
window.addEventListener('keydown', e => {
	if (!host) return;

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

// Home button
btnHome.addEventListener('click', () => {
	if (score || (lives && lives !== MAX_HEARTS)) {
		if (!confirm('Are you sure you want to reset?')) return;
	}

	reset();
});

let socket;
let host;
let connected = false;

function sendJSON(data) {
	socket.send(JSON.stringify(data));
}

function close() {
	socket = null;
	reset();
}

/**
 * Start game
 * @param {string | null} code The code to join, or null if you are not the host
 */
function game(code) {
	host = code === null;
	let started = false;

	if (socket) {
		socket.removeEventListener('close', close);
		socket.close();
		connected = false;
	}
	socket = new WebSocket(
		`${window.location.protocol == 'http:' ? 'ws' : 'wss'}://${
			window.location.host
		}${window.location.pathname}`,
	);

	socket.addEventListener('open', () => {
		if (host) {
			sendJSON({
				type: 'create',
				difficulty,
			});
		} else {
			sendJSON({
				type: 'join',
				roomCode: code,
			});
		}
	});

	socket.addEventListener('close', close);

	socket.addEventListener('message', message => {
		let json = JSON.parse(message.data);

		switch (json.type) {
			case 'error':
				alert(json.message);
				break;
			case 'connect':
				inputCode.value = json.code;
				window.location.hash = json.code;
				codeEl.textContent = `Game code: ${json.code}`;
				connected = true;

				if (host) {
					joinMessage.style.display = '';
					formJoin.setAttribute('disabled', true);
					btnPlay.setAttribute('disabled', true);
					inputCode.setAttribute('readonly', true);
					Object.values(DIFFICULTIES).forEach(({el}) => {
						el.setAttribute('disabled', true);
					});
				}
				break;
			case 'state':
				start();
				started = true;
				score = json.score;
				lives = json.lives;
				colors = json.colors;
				answer = json.answer;
				guessed = new Array(NUM_OPTIONS).fill(false);
				setDifficulty(json.difficulty);
				update();
				break;
			case 'guess':
				score = json.score;
				lives = json.lives;
				if (host) {
					if (json.correct) {
						notice('Correct!');
					} else {
						guessed[json.index] = true;
						notice('Incorrect!');
					}
				} else {
					if (json.correct) {
						notice('Host guessed correctly!');
					} else {
						notice(
							`Host incorrectly guessed ${rgbToHex(json.color)}!`,
						);
					}
				}
				update();
				break;
			case 'gameover':
				started = false;
				notice('Game Over!');
				if (host) sendJSON({type: 'start'});
				break;
			case 'join':
				if (host && !started) sendJSON({type: 'start'});
				else notice('Someone joined the game!');
				break;
			case 'leave':
				notice('Someone left the game.');
				break;
		}
	});
}

formJoin.addEventListener('submit', e => {
	e.preventDefault();
	if (connected) return;
	let code = inputCode.value;
	game(code);

	answerEl.style.display = '';
	optionsParent.style.display = 'none';
});

btnPlay.addEventListener('click', () => {
	game(null);

	answerEl.style.display = 'none';
	optionsParent.style.display = '';
});

setDifficulty(window.localStorage.getItem('gtc-multiplayer-mode') || 'medium');

if (window.location.hash.match(/^#[0-9A-F]{6}$/)) {
	inputCode.value = window.location.hash.slice(1);
	game(window.location.hash.slice(1));

	answerEl.style.display = '';
	optionsParent.style.display = 'none';
}
