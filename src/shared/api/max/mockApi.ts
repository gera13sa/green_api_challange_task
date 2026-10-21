import type {
	AuthorizationFlowResponse,
	AuthorizationPasswordResponse,
	ChatHistoryItem,
	ChatSummary,
	ChatType,
	GetChatHistoryRequest,
	InstanceState,
	MaxApi,
	MaxSession,
	MessageStatus,
	Notification,
	NotificationBody,
	ReadChatRequest,
	SendMessageRequest,
} from './types';

export const MOCK_CLOUD_PASSWORD = '123456';
export const MOCK_SMS_CODE = '123456';

interface MockData {
	state: InstanceState;
	requirePassword: boolean;
	phoneAuthStarted: boolean;
	nextReceiptId: number;
	queue: Notification[];
	chats: ChatSummary[];
	history: Record<string, ChatHistoryItem[]>;
	activity: Record<string, number>;
}

interface MockRuntime {
	session: MaxSession;
	data: MockData;
}

const runtimes = new Map<string, MockRuntime>();
const LATENCY_MS = 180;
let messageSeq = 0;

function storageKey(session: MaxSession): string {
	return `max-mock:${session.idInstance}:${session.apiTokenInstance}`;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function persist(runtime: MockRuntime): void {
	try {
		sessionStorage.setItem(storageKey(runtime.session), JSON.stringify(runtime.data));
	} catch {
		return;
	}
}

function messageId(): string {
	messageSeq += 1;
	return `${Date.now()}-${messageSeq}`;
}

function instanceData(session: MaxSession): NonNullable<NotificationBody['instanceData']> {
	const numeric = Number(session.idInstance);
	return {
		idInstance: Number.isFinite(numeric) ? numeric : 0,
		wid: '79990001122@c.us',
		typeInstance: 'v3',
	};
}

function textItem(
	chatId: string,
	chatType: ChatType,
	type: 'incoming' | 'outgoing',
	text: string,
	timestamp: number,
	senderName?: string,
	status?: MessageStatus,
): ChatHistoryItem {
	return {
		type,
		idMessage: messageId(),
		timestamp,
		statusMessage: status,
		sendByApi: type === 'outgoing' ? true : undefined,
		typeMessage: 'textMessage',
		chatId,
		chatType,
		senderName,
		senderType: type === 'incoming' ? 'user' : undefined,
		senderContactName: senderName,
		textMessage: text,
	};
}

function createSeed(): MockData {
	const now = Math.floor(Date.now() / 1000);
	const personal = textItem(
		'10000000',
		'user',
		'incoming',
		'Привет! Напиши сюда — ответ придёт через очередь ReceiveNotification.',
		now - 300,
		'Ходабрыш Пробешёлов',
	);
	const personalOut = textItem(
		'10000000',
		'user',
		'outgoing',
		'Добрый день. Проверяю SendMessage и статусы доставки.',
		now - 4800,
		undefined,
		'read',
	);
	const personalIn = textItem(
		'10000000',
		'user',
		'incoming',
		'Историю этого чата отдаёт getChatHistory.',
		now - 5000,
		'Ходабрыш Пробешёлов',
	);
	const ivanOut = textItem(
		'10000001',
		'user',
		'outgoing',
		'Иван, это сообщение из журнала чата.',
		now - 90000,
		undefined,
		'delivered',
	);
	const ivanIn = textItem(
		'10000001',
		'user',
		'incoming',
		'Вижу. Можно ответить прямо из интерфейса.',
		now - 89000,
		'Иван Царевич',
	);
	const ivanPhoto: ChatHistoryItem = {
		type: 'incoming',
		idMessage: messageId(),
		timestamp: now - 88000,
		typeMessage: 'imageMessage',
		chatId: '10000001',
		chatType: 'user',
		senderName: 'Иван Царевич',
		senderType: 'user',
		senderContactName: 'Иван Царевич',
		caption: 'Схема подключения инстанса',
		fileName: 'scheme.png',
	};
	const groupA = textItem(
		'-10000000000000',
		'group',
		'incoming',
		'Соберёмся в этом чате.',
		now - 8000,
		'Ходабрыш Пробешёлов',
	);
	const groupB = textItem(
		'-10000000000000',
		'group',
		'incoming',
		'У меня инстанс уже в статусе authorized.',
		now - 7800,
		'Иван Царевич',
	);
	const groupOut = textItem(
		'-10000000000000',
		'group',
		'outgoing',
		'Список чатов забираю методом getChats.',
		now - 7600,
		undefined,
		'read',
	);
	const bot = textItem(
		'10000002',
		'bot',
		'incoming',
		'Я бот GREEN-API. Отправьте текст, и я отвечу входящим уведомлением.',
		now - 20000,
		'Green-API bot',
	);

	return {
		state: 'notAuthorized',
		requirePassword: false,
		phoneAuthStarted: false,
		nextReceiptId: 1000,
		queue: [],
		chats: [
			{chatId: '10000000', name: 'Ходабрыш Пробешёлов', type: 'user', phoneNumber: 79876543210, unreadCount: 1},
			{chatId: '10000001', name: 'Иван Царевич', type: 'user', phoneNumber: 0, unreadCount: 0},
			{chatId: '-10000000000000', name: 'Название группы', type: 'group', phoneNumber: 0, unreadCount: 0},
			{chatId: '10000002', name: 'Green-API bot', type: 'bot', phoneNumber: 0, unreadCount: 0},
		],
		history: {
			'10000000': [personalIn, personalOut, personal],
			'10000001': [ivanOut, ivanIn, ivanPhoto],
			'-10000000000000': [groupA, groupB, groupOut],
			'10000002': [bot],
		},
		activity: {
			'10000000': personal.timestamp,
			'10000001': ivanIn.timestamp,
			'-10000000000000': groupOut.timestamp,
			'10000002': bot.timestamp,
		},
	};
}

function isMockData(value: unknown): value is MockData {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const record = value as Partial<MockData>;
	return typeof record.state === 'string'
		&& Array.isArray(record.chats)
		&& Array.isArray(record.queue)
		&& !!record.history
		&& !!record.activity;
}

function loadData(session: MaxSession): MockData | null {
	try {
		const raw = sessionStorage.getItem(storageKey(session));
		if (!raw) {
			return null;
		}
		const parsed: unknown = JSON.parse(raw);
		if (!isMockData(parsed)) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function getRuntime(session: MaxSession): MockRuntime {
	const key = storageKey(session);
	let runtime = runtimes.get(key);
	if (!runtime) {
		const data = loadData(session) ?? createSeed();
		data.phoneAuthStarted = data.phoneAuthStarted ?? false;
		runtime = {
			session,
			data,
		};
		runtimes.set(key, runtime);
	}
	runtime.session = session;
	runtime.data.requirePassword = session.requirePassword;
	runtime.data.phoneAuthStarted = runtime.data.phoneAuthStarted ?? false;
	return runtime;
}

function enqueue(runtime: MockRuntime, body: NotificationBody): void {
	runtime.data.queue.push({
		receiptId: runtime.data.nextReceiptId,
		body,
	});
	runtime.data.nextReceiptId += 1;
	persist(runtime);
}

function ensureChat(data: MockData, chatId: string, name?: string): ChatSummary {
	const found = data.chats.find((chat) => chat.chatId === chatId);
	if (found) {
		return found;
	}
	const created: ChatSummary = {
		chatId,
		name: name || chatId,
		type: chatId.startsWith('-') ? 'group' : 'user',
		phoneNumber: 0,
		unreadCount: 0,
	};
	data.chats.push(created);
	data.history[chatId] = data.history[chatId] ?? [];
	return created;
}

function pushHistory(runtime: MockRuntime, item: ChatHistoryItem): void {
	const items = runtime.data.history[item.chatId] ?? [];
	items.push(item);
	runtime.data.history[item.chatId] = items;
	runtime.data.activity[item.chatId] = item.timestamp;
}

function createQrPayload(seed: number): string {
	const size = 29;
	const cell = 8;
	const canvas = document.createElement('canvas');
	canvas.width = size * cell;
	canvas.height = size * cell;
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Не удалось нарисовать QR-код');
	}

	context.fillStyle = '#ffffff';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = '#0a2540';

	const finder = (x: number, y: number) => {
		context.fillStyle = '#0a2540';
		context.fillRect(x * cell, y * cell, 7 * cell, 7 * cell);
		context.fillStyle = '#ffffff';
		context.fillRect((x + 1) * cell, (y + 1) * cell, 5 * cell, 5 * cell);
		context.fillStyle = '#0a2540';
		context.fillRect((x + 2) * cell, (y + 2) * cell, 3 * cell, 3 * cell);
	};

	finder(1, 1);
	finder(size - 8, 1);
	finder(1, size - 8);

	let value = seed || 1;
	for (let y = 1; y < size - 1; y += 1) {
		for (let x = 1; x < size - 1; x += 1) {
			const inFinder = (x < 9 && y < 9) || (x > size - 10 && y < 9) || (x < 9 && y > size - 10);
			if (inFinder) {
				continue;
			}
			value = (value * 1103515245 + 12345) % 2147483648;
			if (value % 3 !== 0) {
				context.fillStyle = '#0a2540';
				context.fillRect(x * cell, y * cell, cell - 1, cell - 1);
			}
		}
	}

	return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

function failPassword(reason: string): AuthorizationPasswordResponse {
	return {
		status: false,
		data: {status: 'fail', reason},
	};
}

function failAuthFlow(reason: string, retryAfter?: number): AuthorizationFlowResponse {
	return {
		status: false,
		data: {status: 'fail', reason, retryAfter},
	};
}

function isValidMockPhone(phoneNumber: number): boolean {
	const digits = String(phoneNumber);
	return /^7\d{10}$/.test(digits) || /^375\d{9}$/.test(digits);
}

function scheduleStatus(runtime: MockRuntime, chatId: string, id: string, status: MessageStatus, delay: number): void {
	window.setTimeout(() => {
		if (runtime.data.state !== 'authorized' && runtime.data.state !== 'suspended') {
			return;
		}
		const item = (runtime.data.history[chatId] ?? []).find((entry) => entry.idMessage === id);
		if (item) {
			item.statusMessage = status;
		}
		enqueue(runtime, {
			typeWebhook: 'outgoingMessageStatus',
			timestamp: Math.floor(Date.now() / 1000),
			idMessage: id,
			chatId,
			status,
			instanceData: instanceData(runtime.session),
		});
	}, delay);
}

function scheduleReply(runtime: MockRuntime, chat: ChatSummary, sourceText: string): void {
	window.setTimeout(() => {
		if (runtime.data.state !== 'authorized' && runtime.data.state !== 'suspended') {
			return;
		}
		const timestamp = Math.floor(Date.now() / 1000);
		const senderName = chat.type === 'group' ? 'Ходабрыш Пробешёлов' : chat.name;
		const text = sourceText.trim().endsWith('?')
			? 'Да. Это входящее уведомление incomingMessageReceived.'
			: `Принял: «${sourceText.trim().slice(0, 80)}»`;
		const item = textItem(chat.chatId, chat.type, 'incoming', text, timestamp, senderName);
		pushHistory(runtime, item);
		chat.unreadCount += 1;
		enqueue(runtime, {
			typeWebhook: 'incomingMessageReceived',
			instanceData: instanceData(runtime.session),
			timestamp,
			idMessage: item.idMessage,
			senderData: {
				chatId: chat.chatId,
				chatName: chat.name,
				chatType: chat.type,
				sender: chat.chatId,
				senderName,
				senderType: 'user',
				senderContactName: senderName,
				senderPhoneNumber: chat.phoneNumber || undefined,
			},
			messageData: {
				typeMessage: 'textMessage',
				textMessageData: {textMessage: text},
			},
		});
	}, 1200);
}

export function createMockMaxApi(session: MaxSession): MaxApi {
	const runtime = getRuntime(session);

	return {
		async getStateInstance() {
			await sleep(LATENCY_MS);
			return {stateInstance: runtime.data.state};
		},

		async getQr() {
			await sleep(LATENCY_MS);
			if (runtime.data.state !== 'notAuthorized') {
				return {
					type: 'already_registered',
					message: 'instance account already authorized',
				};
			}
			return {
				type: 'qrCode',
				message: createQrPayload(Date.now()),
			};
		},

		async simulateQrScan() {
			await sleep(LATENCY_MS);
			if (runtime.data.state === 'authorized' || runtime.data.state === 'suspended') {
				return;
			}
			runtime.data.phoneAuthStarted = false;
			runtime.data.state = runtime.data.requirePassword ? 'pendingPassword' : 'authorized';
			enqueue(runtime, {
				typeWebhook: 'stateInstanceChanged',
				timestamp: Math.floor(Date.now() / 1000),
				stateInstance: runtime.data.state,
				instanceData: instanceData(runtime.session),
			});
		},

		async startAuthorization(phoneNumber) {
			await sleep(LATENCY_MS);
			if (runtime.data.state === 'authorized' || runtime.data.state === 'suspended') {
				return failAuthFlow('already_registered');
			}
			if (runtime.data.state !== 'notAuthorized') {
				return failAuthFlow('authorization_not_started');
			}
			if (!Number.isFinite(phoneNumber) || !isValidMockPhone(phoneNumber)) {
				return failAuthFlow('invalid_phone_number');
			}
			runtime.data.phoneAuthStarted = true;
			persist(runtime);
			return {
				status: true,
				data: {status: 'success', reason: ''},
			};
		},

		async sendAuthorizationCode(code) {
			await sleep(LATENCY_MS);
			if (runtime.data.state === 'authorized' || runtime.data.state === 'suspended') {
				return failAuthFlow('already_registered');
			}
			if (!runtime.data.phoneAuthStarted || runtime.data.state !== 'notAuthorized') {
				return failAuthFlow('authorization_not_started');
			}
			if (code.trim() !== MOCK_SMS_CODE) {
				return failAuthFlow('invalid_code');
			}
			runtime.data.phoneAuthStarted = false;
			runtime.data.state = runtime.data.requirePassword ? 'pendingPassword' : 'authorized';
			enqueue(runtime, {
				typeWebhook: 'stateInstanceChanged',
				timestamp: Math.floor(Date.now() / 1000),
				stateInstance: runtime.data.state,
				instanceData: instanceData(runtime.session),
			});
			return {
				status: true,
				data: {status: 'success', reason: ''},
			};
		},

		async sendAuthorizationPassword(password) {
			await sleep(LATENCY_MS);
			if (runtime.data.state === 'authorized') {
				return failPassword('already_registered');
			}
			if (runtime.data.state !== 'pendingPassword') {
				return failPassword('authorization_not_started');
			}
			if (password !== MOCK_CLOUD_PASSWORD) {
				return failPassword('invalid_password');
			}
			runtime.data.state = 'authorized';
			enqueue(runtime, {
				typeWebhook: 'stateInstanceChanged',
				timestamp: Math.floor(Date.now() / 1000),
				stateInstance: 'authorized',
				instanceData: instanceData(runtime.session),
			});
			return {
				status: true,
				data: {status: 'success', reason: ''},
			};
		},

		async logout() {
			await sleep(LATENCY_MS);
			runtime.data.state = 'notAuthorized';
			runtime.data.phoneAuthStarted = false;
			runtime.data.queue = [];
			persist(runtime);
			return {isLogout: true};
		},

		async sendMessage(body: SendMessageRequest) {
			await sleep(LATENCY_MS);
			const chatId = body.chatId?.trim();
			const message = body.message ?? '';
			if (!chatId) {
				throw new Error('Validation failed. Details: \'chatId\' must be a string');
			}
			if (!message.trim()) {
				throw new Error('Validation failed. Details: \'message\' must be a string');
			}
			if (message.length > 4000) {
				throw new Error('Validation failed. Details: message is longer than 4000 characters');
			}

			const chat = ensureChat(runtime.data, chatId);
			const timestamp = Math.floor(Date.now() / 1000);
			const item = textItem(chat.chatId, chat.type, 'outgoing', message, timestamp, undefined, 'sent');
			pushHistory(runtime, item);
			persist(runtime);

			enqueue(runtime, {
				typeWebhook: 'outgoingAPIMessageReceived',
				instanceData: instanceData(runtime.session),
				timestamp,
				idMessage: item.idMessage,
				senderData: {
					chatId: chat.chatId,
					chatName: chat.name,
					chatType: chat.type,
					sender: '79990001122',
					senderName: 'Вы',
				},
				messageData: {
					typeMessage: 'textMessage',
					textMessageData: {textMessage: message},
				},
			});
			scheduleStatus(runtime, chat.chatId, item.idMessage, 'delivered', 700);
			scheduleStatus(runtime, chat.chatId, item.idMessage, 'read', 1800);
			scheduleReply(runtime, chat, message);

			return {idMessage: item.idMessage};
		},

		async receiveNotification(receiveTimeout = 5, signal) {
			const deadline = Date.now() + receiveTimeout * 1000;
			while (Date.now() < deadline) {
				if (signal?.aborted) {
					return null;
				}
				const head = runtime.data.queue[0];
				if (head) {
					return structuredClone(head);
				}
				await sleep(200);
			}
			if (signal?.aborted) {
				return null;
			}
			const head = runtime.data.queue[0];
			return head ? structuredClone(head) : null;
		},

		async deleteNotification(receiptId) {
			await sleep(40);
			const head = runtime.data.queue[0];
			if (!head || head.receiptId !== receiptId) {
				return {result: false, reason: 'Notification not found'};
			}
			runtime.data.queue.shift();
			persist(runtime);
			return {result: true, reason: ''};
		},

		async getChats(count) {
			await sleep(LATENCY_MS);
			const chats = [...runtime.data.chats].sort(
				(left, right) => (runtime.data.activity[right.chatId] ?? 0) - (runtime.data.activity[left.chatId] ?? 0),
			);
			const limited = typeof count === 'number' ? chats.slice(0, count) : chats;
			return limited.map((chat) => ({...chat}));
		},

		async getChatHistory(body: GetChatHistoryRequest) {
			await sleep(LATENCY_MS);
			if (!body.chatId) {
				throw new Error('Validation failed. Details: \'chatId\' must be a string');
			}
			const count = body.count ?? 100;
			return [...(runtime.data.history[body.chatId] ?? [])]
				.sort((left, right) => right.timestamp - left.timestamp)
				.slice(0, count)
				.map((item) => ({...item}));
		},

		async readChat(body: ReadChatRequest) {
			await sleep(LATENCY_MS);
			const chat = runtime.data.chats.find((item) => item.chatId === body.chatId);
			if (!chat) {
				throw new Error('Validation failed. Details: chat not found');
			}
			chat.unreadCount = 0;
			persist(runtime);
			return {setRead: true};
		},
	};
}
