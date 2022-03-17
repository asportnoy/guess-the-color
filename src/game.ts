import {dE00, LAB} from './deltae';

type RGB = [
	/** Red */
	number,
	/**	Green */
	number,
	/** Blue */
	number,
];

const MAX_HEARTS = 7;
const NUM_OPTIONS = 6;

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

export type Difficulty = keyof typeof DIFFICULTIES;

export function isDifficulty(difficulty: unknown): difficulty is Difficulty {
	if (typeof difficulty !== 'string') return false;
	return Object.keys(DIFFICULTIES).includes(difficulty as string);
}

/**
 * Choose a random RGB color
 */
export function chooseRandomRgb(): RGB {
	return new Array(3)
		.fill(0)
		.map(() => Math.floor(Math.random() * 256)) as RGB;
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(rgb: RGB): string {
	return `#${rgb
		.map(v => v.toString(16).padStart(2, '0'))
		.join('')
		.toUpperCase()}`;
}

export class Game {
	answer: RGB = [0, 0, 0];
	colors: RGB[] = [];
	guessed: boolean[] = [];
	lives: number = MAX_HEARTS;
	score: number = 0;
	difficulty: Difficulty;

	constructor(difficulty: Difficulty = 'medium') {
		this.difficulty = difficulty;
		this.chooseColors();
	}

	/**
	 * Check if the game is over
	 */
	isOver(): boolean {
		return this.lives <= 0;
	}

	/**
	 * Get minimum difference for selected difficulty
	 */
	private getMin(): number {
		return DIFFICULTIES[this.difficulty].min;
	}

	/**
	 * Get maximum difference for selected difficulty
	 */
	private getMax(): number {
		return DIFFICULTIES[this.difficulty].max;
	}

	/**
	 * Convert RGB to LAB
	 */
	private rgbToLab([r, g, b]: RGB): LAB {
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
	 * @returns 0-100
	 */
	private getDiff(color1: RGB, color2: RGB): number {
		return (
			Math.round(
				new dE00(
					this.rgbToLab(color1),
					this.rgbToLab(color2),
				).getDeltaE() * 100,
			) / 100
		);
	}

	/**
	 * Choose colors for round
	 */
	chooseColors(
		min: number = this.getMin(),
		max: number = this.getMax(),
	): void {
		this.answer = chooseRandomRgb();

		this.colors = [this.answer];

		// Choose rest of colors
		let i = 0;
		while (this.colors.length < NUM_OPTIONS) {
			let color = chooseRandomRgb();
			let answerDiff = this.getDiff(color, this.answer);
			let allDiffs = this.colors.map(c => this.getDiff(color, c));

			// Check that color is not too similar to answer or other colors
			if (
				answerDiff > min &&
				answerDiff < max &&
				allDiffs.every(diff => diff > 10)
			)
				this.colors.push(color);
			i++;
			if (i > 10000) return this.chooseColors(min, max); // Got stuck generating colors, start over.
		}

		// Randomize array
		this.colors = this.colors.sort(() => Math.random() - 0.5);

		this.guessed = new Array(NUM_OPTIONS).fill(false);
	}

	/**
	 * Handle guess
	 * @returns Whether the guess was correct, or null if invalid
	 */
	guess(index: number): boolean | null {
		if (this.guessed[index]) return null; // Button was disabled
		if (this.answer.every((x, i) => x === this.colors[index][i])) {
			// Correct
			this.score++;
			this.chooseColors();
			return true;
		} else {
			// Disable button
			this.guessed[index] = true;
			// Reduce lives
			this.lives--;

			if (this.lives <= 0) {
				// Game over
			}
			return false;
		}
	}
}
