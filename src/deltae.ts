// From https://github.com/zschuessler/DeltaE/blob/master/src/dE00.js

export interface LAB {
	/** The lightness value, on scale of 0-100. */
	L: number;
	/** The chroma value, on scale of -128 to 128. */
	A: number;
	/** The hue value, on scale of -128 to 128. */
	B: number;
}

interface Weights {
	lightness?: number;
	chroma?: number;
	hue?: number;
}

/**
 * The CIE2000 color difference algorithm.
 * http://en.wikipedia.org/wiki/Color_difference#CIEDE2000
 * @property {object} x1 The LAB color configuration object.
 * @property {object} x2 The LAB color configuration object.
 * @property {object} weights The weights configuration object.
 * @example
 * var deltaE = new dE00(
 *     {L:50, A:50, B:50},
 *     {L:100, A:50, B:50},
 * );
 * console.log(deltaE.getDeltaE());
 */
export class dE00 {
	private x1: LAB;
	private x2: LAB;
	private weights: Weights;
	private ksubL: number;
	private ksubC: number;
	private ksubH: number;
	private deltaLPrime: number;
	private LBar: number;
	private C1: number;
	private C2: number;
	private CBar: number;
	private aPrime1: number;
	private aPrime2: number;
	private CPrime1: number;
	private CPrime2: number;
	private CBarPrime: number;
	private deltaCPrime: number;
	private SsubL: number;
	private SsubC: number;
	private hPrime1: number;
	private hPrime2: number;
	private deltahPrime: number;
	private deltaHPrime: number;
	private HBarPrime: number;
	private T: number;
	private SsubH: number;
	private RsubT: number;

	constructor(x1: LAB, x2: LAB, weights?: Weights) {
		var sqrt = Math.sqrt;
		var pow = Math.pow;

		this.x1 = x1;
		this.x2 = x2;

		this.weights = weights || {};
		this.ksubL = this.weights.lightness || 1;
		this.ksubC = this.weights.chroma || 1;
		this.ksubH = this.weights.hue || 1;

		// Delta L Prime
		this.deltaLPrime = x2.L - x1.L;

		// L Bar
		this.LBar = (x1.L + x2.L) / 2;

		// C1 & C2
		this.C1 = sqrt(pow(x1.A, 2) + pow(x1.B, 2));
		this.C2 = sqrt(pow(x2.A, 2) + pow(x2.B, 2));

		// C Bar
		this.CBar = (this.C1 + this.C2) / 2;

		// A Prime 1
		this.aPrime1 =
			x1.A +
			(x1.A / 2) *
				(1 -
					sqrt(pow(this.CBar, 7) / (pow(this.CBar, 7) + pow(25, 7))));

		// A Prime 2
		this.aPrime2 =
			x2.A +
			(x2.A / 2) *
				(1 -
					sqrt(pow(this.CBar, 7) / (pow(this.CBar, 7) + pow(25, 7))));

		// C Prime 1
		this.CPrime1 = sqrt(pow(this.aPrime1, 2) + pow(x1.B, 2));

		// C Prime 2
		this.CPrime2 = sqrt(pow(this.aPrime2, 2) + pow(x2.B, 2));

		// C Bar Prime
		this.CBarPrime = (this.CPrime1 + this.CPrime2) / 2;

		// Delta C Prime
		this.deltaCPrime = this.CPrime2 - this.CPrime1;

		// S sub L
		this.SsubL =
			1 +
			(0.015 * pow(this.LBar - 50, 2)) /
				sqrt(20 + pow(this.LBar - 50, 2));

		// S sub C
		this.SsubC = 1 + 0.045 * this.CBarPrime;

		/**
		 * Properties set in getDeltaE method, for access to convenience functions
		 */
		// h Prime 1
		this.hPrime1 = 0;

		// h Prime 2
		this.hPrime2 = 0;

		// Delta h Prime
		this.deltahPrime = 0;

		// Delta H Prime
		this.deltaHPrime = 0;

		// H Bar Prime
		this.HBarPrime = 0;

		// T
		this.T = 0;

		// S sub H
		this.SsubH = 0;

		// R sub T
		this.RsubT = 0;
	}
	/**
	 * Returns the deltaE value.
	 */
	getDeltaE(): number {
		var sqrt = Math.sqrt;
		var sin = Math.sin;
		var pow = Math.pow;

		// h Prime 1
		this.hPrime1 = this.gethPrime1();

		// h Prime 2
		this.hPrime2 = this.gethPrime2();

		// Delta h Prime
		this.deltahPrime = this.getDeltahPrime();

		// Delta H Prime
		this.deltaHPrime =
			2 *
			sqrt(this.CPrime1 * this.CPrime2) *
			sin(this.degreesToRadians(this.deltahPrime) / 2);

		// H Bar Prime
		this.HBarPrime = this.getHBarPrime();

		// T
		this.T = this.getT();

		// S sub H
		this.SsubH = 1 + 0.015 * this.CBarPrime * this.T;

		// R sub T
		this.RsubT = this.getRsubT();

		// Put it all together!
		var lightness = this.deltaLPrime / (this.ksubL * this.SsubL);
		var chroma = this.deltaCPrime / (this.ksubC * this.SsubC);
		var hue = this.deltaHPrime / (this.ksubH * this.SsubH);

		return sqrt(
			pow(lightness, 2) +
				pow(chroma, 2) +
				pow(hue, 2) +
				this.RsubT * chroma * hue,
		);
	}
	/**
	 * Returns the RT variable calculation.
	 */
	getRsubT(): number {
		var sin = Math.sin;
		var sqrt = Math.sqrt;
		var pow = Math.pow;
		var exp = Math.exp;

		return (
			-2 *
			sqrt(
				pow(this.CBarPrime, 7) / (pow(this.CBarPrime, 7) + pow(25, 7)),
			) *
			sin(
				this.degreesToRadians(
					60 * exp(-pow((this.HBarPrime - 275) / 25, 2)),
				),
			)
		);
	}
	/**
	 * Returns the T variable calculation.
	 */
	getT(): number {
		var cos = Math.cos;

		return (
			1 -
			0.17 * cos(this.degreesToRadians(this.HBarPrime - 30)) +
			0.24 * cos(this.degreesToRadians(2 * this.HBarPrime)) +
			0.32 * cos(this.degreesToRadians(3 * this.HBarPrime + 6)) -
			0.2 * cos(this.degreesToRadians(4 * this.HBarPrime - 63))
		);
	}
	/**
	 * Returns the H Bar Prime variable calculation.
	 */
	getHBarPrime(): number {
		var abs = Math.abs;

		if (abs(this.hPrime1 - this.hPrime2) > 180) {
			return (this.hPrime1 + this.hPrime2 + 360) / 2;
		}

		return (this.hPrime1 + this.hPrime2) / 2;
	}
	/**
	 * Returns the Delta h Prime variable calculation.
	 */
	getDeltahPrime(): number {
		var abs = Math.abs;

		// When either C′1 or C′2 is zero, then Δh′ is irrelevant and may be set to
		// zero.
		if (0 === this.C1 || 0 === this.C2) {
			return 0;
		}

		if (abs(this.hPrime1 - this.hPrime2) <= 180) {
			return this.hPrime2 - this.hPrime1;
		}

		if (this.hPrime2 <= this.hPrime1) {
			return this.hPrime2 - this.hPrime1 + 360;
		} else {
			return this.hPrime2 - this.hPrime1 - 360;
		}
	}
	/**
	 * Returns the h Prime 1 variable calculation.
	 */
	gethPrime1(): number {
		return this._gethPrimeFn(this.x1.B, this.aPrime1);
	}
	/**
	 * Returns the h Prime 2 variable calculation.}
	 */
	gethPrime2(): number {
		return this._gethPrimeFn(this.x2.B, this.aPrime2);
	}
	/**
	 * A helper function to calculate the h Prime 1 and h Prime 2 values.
	 */
	private _gethPrimeFn(x: number, y: number): number {
		var hueAngle;

		if (x === 0 && y === 0) {
			return 0;
		}

		hueAngle = this.radiansToDegrees(Math.atan2(x, y));

		if (hueAngle >= 0) {
			return hueAngle;
		} else {
			return hueAngle + 360;
		}
	}
	/**
	 * Gives the radian equivalent of a specified degree angle.
	 */
	radiansToDegrees(radians: number): number {
		return radians * (180 / Math.PI);
	}
	/**
	 * Gives the degree equivalent of a specified radian.
	 */
	degreesToRadians(degrees: number): number {
		return degrees * (Math.PI / 180);
	}
}
