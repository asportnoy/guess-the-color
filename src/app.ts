import express from 'express';
import expressWs from 'express-ws';
import * as ws from 'ws';
import {v4 as uuidv4} from 'uuid';
import {Difficulty, Game, isDifficulty} from './game';
const app = express();
const wsServer = expressWs(app);
app.listen(process.env.PORT || 8000);
const BASE_PATH = process.env.BASE_PATH || '/';
const router = express.Router();
app.use(BASE_PATH, router);

router.use(express.static('frontend'));

let games = new Map<
	string,
	{
		game: Game | undefined;
		players: Set<{uuid: string; socket: ws; host: boolean}>;
	}
>();

/**
 * Generate game code that's not in use
 * @returns 6 digit number (as string)
 */
function generateGameCode(): string {
	let code = Math.floor(Math.random() * 1000000)
		.toString()
		.padStart(6, '0');
	if (games.has(code)) return generateGameCode();
	return code.toString();
}

router.ws('/multiplayer', socket => {
	try {
		let uuid = uuidv4();
		let room: string | undefined;
		let host = false;
		let game: Game | undefined;
		let difficulty: Difficulty;

		function sendJSON(json: any, ws = socket) {
			ws.send(JSON.stringify(json));
		}

		function sendToRoom(json: any, includeMe = true) {
			if (!room) return;
			games.get(room)!.players.forEach(({socket, uuid: socketUuid}) => {
				if (includeMe || uuid !== socketUuid) sendJSON(json, socket);
			});
		}

		/**
		 * Start game
		 */
		function startGame() {
			if (!room) return;
			game = new Game(difficulty);
			games.get(room)!.game = game;
			sendGameState();
		}

		/**
		 * Send game state to players
		 * @param onlyMe Send only to me
		 */
		function sendGameState(onlyMe = false) {
			if (!room || !game) return;
			games
				.get(room)!
				.players.forEach(({socket, host, uuid: socketUuid}) => {
					if (onlyMe && uuid !== socketUuid) return;
					if (!game) return;
					sendJSON(
						{
							type: 'state',
							score: game.score,
							lives: game.lives,
							difficulty: game.difficulty,
							answer: host ? null : game.answer,
							colors: host ? game.colors : null,
						},
						socket,
					);
				});
		}

		/**
		 * Guess
		 * @param guess Guess index
		 */
		function guess(guess: number) {
			if (!room || !game) return;
			let correct = game.guess(guess);
			if (correct == null)
				return sendJSON({
					type: 'error',
					message: 'Invalid guess.',
				});
			sendToRoom({
				type: 'guess',
				correct,
				index: guess,
				color: correct ? game.answer : game.colors[guess],
				answer: correct ? null : game.answer,
				score: game.score,
				lives: game.lives,
			});
			if (correct) sendGameState();
			if (game.isOver()) {
				sendToRoom({
					type: 'gameover',
					score: game.score,
				});
				game = undefined;
				games.get(room)!.game = undefined;
			}
		}

		/**
		 * Leave room and delete game
		 */
		function leave() {
			if (!room) return;
			if (!games.has(room)) return;
			games.get(room)!.players.forEach(socket => {
				if (socket.uuid === uuid) {
					games.get(room!)!.players.delete(socket);
				}
			});
			// Alert other players that this player left if you are the host
			if (host) {
				sendToRoom({
					type: 'error',
					message: 'The host left the game.',
				});

				games.get(room)!.players.forEach(({socket}) => {
					socket.close();
				});
				games.delete(room);
			}
			// Alert host if you were the last guest
			else if (games.get(room)!.players.size === 1) {
				sendToRoom({
					type: 'error',
					message: 'All guessers left the game.',
				});
			} else {
				sendToRoom({
					type: 'leave',
				});
			}

			socket.close();
		}

		/**
		 * Join room
		 * @param roomCode Room code
		 */
		function join(roomCode: string) {
			if (room)
				return sendJSON({
					type: 'error',
					message: 'You are already in a game.',
				});
			if (!games.has(roomCode))
				return sendJSON({
					type: 'error',
					message: 'Invalid game code.',
				});
			room = roomCode;

			games.get(roomCode)!.players.add({uuid, socket, host});

			sendJSON({
				type: 'connect',
				code: roomCode,
			});

			sendToRoom(
				{
					type: 'join',
				},
				false,
			);

			game = games.get(roomCode)!.game;
			if (game) sendGameState(true);
		}

		/**
		 * Create room
		 */
		function create(diff: Difficulty) {
			if (room)
				return sendJSON({
					type: 'error',
					message: 'You are already in a game.',
				});
			let roomCode = generateGameCode();
			difficulty = diff;
			host = true;
			games.set(roomCode, {game: undefined, players: new Set()});
			join(roomCode);
		}

		socket.on('message', message => {
			let string = message.toString();
			let data = JSON.parse(string);
			if (!data.type || typeof data.type !== 'string') return;
			switch (data.type) {
				case 'create':
					if (!data.difficulty || typeof data.difficulty !== 'string')
						return sendJSON({
							type: 'error',
							message: 'No difficulty specified.',
						});
					if (!isDifficulty(data.difficulty))
						return sendJSON({
							type: 'error',
							message: 'Invalid difficulty.',
						});
					create(data.difficulty);
					break;
				case 'join':
					if (!data.roomCode || typeof data.roomCode !== 'string')
						return sendJSON({
							type: 'error',
							message: 'No game code specified.',
						});
					join(data.roomCode);
					break;
				case 'start':
					if (!host || !room)
						return sendJSON({
							type: 'error',
							message: 'You are not the host.',
						});
					if (game)
						return sendJSON({
							type: 'error',
							message: 'Game already started.',
						});
					startGame();
					break;
				case 'guess':
					if (!host || !room)
						return sendJSON({
							type: 'error',
							message: 'You are not the host.',
						});
					if (!game)
						return sendJSON({
							type: 'error',
							message: 'Game not started.',
						});
					if (typeof data.index !== 'number')
						return sendJSON({
							type: 'error',
							message: 'No guess specified.',
						});
					guess(data.index);
					break;
				default:
					sendJSON({
						type: 'error',
						message: 'Invalid message type.',
					});
			}

			if (room && (!game || game.isOver())) game = games.get(room)!.game;
		});

		socket.on('close', leave);
	} catch (e) {
		try {
			socket.close();
		} catch (e) {}
	}
});
