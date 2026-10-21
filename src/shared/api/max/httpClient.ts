import axios from 'axios';

import {extractErrorMessage} from './errors';
import {MethodThrottle} from './throttle';
import type {
	MaxApi,
	MaxSession,
	QrResponse,
	ChatSummary,
	Notification,
	LogoutResponse,
	ReadChatRequest,
	ChatHistoryItem,
	ReadChatResponse,
	SendMessageRequest,
	SendMessageResponse,
	StateInstanceResponse,
	GetChatHistoryRequest,
	DeleteNotificationResponse,
	AuthorizationFlowResponse,
	AuthorizationPasswordResponse,
} from './types';

const http = axios.create({
	timeout: 20000,
	headers: {'Content-Type': 'application/json'},
});

// TODO длительность ограничения запросов к бэку
const ONE_RPS_MS = 1100;

function endpoint(session: MaxSession, method: string, suffix = ''): string {
	const base = session.apiUrl.replace(/\/+$/, '');
	const idInstance = encodeURIComponent(session.idInstance);
	const apiTokenInstance = encodeURIComponent(session.apiTokenInstance);
	return `${base}/waInstance${idInstance}/${method}/${apiTokenInstance}${suffix}`;
}

function unwrap<T>(request: Promise<{ data: T }>): Promise<T> {
	return request.then((response) => response.data).catch((error: unknown) => {
		throw new Error(extractErrorMessage(error), {cause: error});
	});
}

export function createHttpMaxApi(session: MaxSession): MaxApi {
	const account = new MethodThrottle(ONE_RPS_MS);
	const journals = new MethodThrottle(ONE_RPS_MS);
	const chats = new MethodThrottle(ONE_RPS_MS);
	const marks = new MethodThrottle(ONE_RPS_MS);

	return {
		getStateInstance() {
			return account.schedule(() => unwrap<StateInstanceResponse>(
				http.get(endpoint(session, 'getStateInstance')),
			));
		},

		getQr() {
			return account.schedule(() => unwrap<QrResponse>(
				http.get(endpoint(session, 'qr')),
			));
		},

		startAuthorization(phoneNumber) {
			return account.schedule(() => unwrap<AuthorizationFlowResponse>(http.post(
				endpoint(session, 'startAuthorization'),
				{phoneNumber},
			)));
		},

		sendAuthorizationCode(code) {
			return account.schedule(() => unwrap<AuthorizationFlowResponse>(http.post(
				endpoint(session, 'sendAuthorizationCode'),
				{code},
			)));
		},

		sendAuthorizationPassword(password) {
			return account.schedule(() => unwrap<AuthorizationPasswordResponse>(http.post(
				endpoint(session, 'sendAuthorizationPassword'),
				{password},
			)));
		},

		logout() {
			return account.schedule(() => unwrap<LogoutResponse>(
				http.get(endpoint(session, 'logout')),
			));
		},

		sendMessage(body: SendMessageRequest) {
			return unwrap<SendMessageResponse>(http.post(endpoint(session, 'sendMessage'), body));
		},

		async receiveNotification(receiveTimeout = 5, signal) {
			try {
				const response = await http.get<Notification | null | ''>(
					endpoint(session, 'receiveNotification'),
					{
						params: {receiveTimeout},
						timeout: (receiveTimeout + 15) * 1000,
						signal,
					},
				);
				if (response.data == null || response.data === '') {
					return null;
				}
				return response.data;
			} catch (error) {
				if (axios.isAxiosError(error) && (error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED')) {
					return null;
				}
				throw new Error(extractErrorMessage(error), {cause: error});
			}
		},

		deleteNotification(receiptId) {
			return unwrap<DeleteNotificationResponse>(http.delete(
				endpoint(session, 'deleteNotification', `/${encodeURIComponent(String(receiptId))}`),
			));
		},

		getChats(count) {
			return chats.schedule(() => unwrap<ChatSummary[]>(http.get(endpoint(session, 'getChats'), {
				params: count ? {count} : undefined,
			})));
		},

		getChatHistory(body: GetChatHistoryRequest) {
			return journals.schedule(() => unwrap<ChatHistoryItem[]>(
				http.post(endpoint(session, 'getChatHistory'), body),
			));
		},

		readChat(body: ReadChatRequest) {
			return marks.schedule(() => unwrap<ReadChatResponse>(
				http.post(endpoint(session, 'readChat'), body),
			));
		},
	};
}
