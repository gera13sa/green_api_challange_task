import type {ChatHistoryItem, InstanceState, MessageStatus, NotificationBody} from './types';

export interface UiMessage {
	idMessage: string;
	chatId: string;
	text: string;
	timestamp: number;
	direction: 'incoming' | 'outgoing';
	status?: MessageStatus;
	senderName?: string;
	pending?: boolean;
	failed?: boolean;
}

export type InterpretedNotification =
	| {kind: 'message'; message: UiMessage}
	| {kind: 'status'; idMessage: string; chatId?: string; status: MessageStatus}
	| {kind: 'state'; state: InstanceState}
	| {kind: 'ignore'};

const TYPE_LABELS: Record<string, string> = {
	imageMessage: 'Изображение',
	videoMessage: 'Видео',
	documentMessage: 'Документ',
	audioMessage: 'Аудио',
	stickerMessage: 'Стикер',
	locationMessage: 'Геолокация',
	contactMessage: 'Контакт',
	pollMessage: 'Опрос',
	reactionMessage: 'Реакция',
	quotedMessage: 'Цитата',
};

export function asMessageStatus(value: unknown): MessageStatus | undefined {
	if (value === 'sent' || value === 'delivered' || value === 'read') {
		return value;
	}
	return undefined;
}

function typeLabel(typeMessage: string | undefined): string {
	if (!typeMessage) {
		return 'Сообщение';
	}
	return TYPE_LABELS[typeMessage] ?? 'Сообщение';
}

function historyText(item: ChatHistoryItem): string {
	if (item.textMessage) {
		return item.textMessage;
	}
	if (item.caption) {
		return item.caption;
	}
	if (item.fileName) {
		return item.fileName;
	}
	return typeLabel(item.typeMessage);
}

function webhookText(body: NotificationBody): string {
	const data = body.messageData;
	const text = data?.textMessageData?.textMessage
		?? data?.extendedTextMessageData?.text
		?? data?.fileMessageData?.caption
		?? data?.fileMessageData?.fileName;
	if (text) {
		return text;
	}
	return typeLabel(data?.typeMessage);
}

export function mapHistoryItem(item: ChatHistoryItem): UiMessage {
	return {
		idMessage: item.idMessage,
		chatId: item.chatId,
		text: historyText(item),
		timestamp: item.timestamp,
		direction: item.type === 'outgoing' ? 'outgoing' : 'incoming',
		status: item.statusMessage,
		senderName: item.senderName ?? item.senderContactName,
	};
}

export function interpretNotification(body: NotificationBody): InterpretedNotification {
	if (body.typeWebhook === 'stateInstanceChanged' && body.stateInstance) {
		return {kind: 'state', state: body.stateInstance};
	}

	if (body.typeWebhook === 'outgoingMessageStatus' && body.idMessage) {
		const status = asMessageStatus(body.status);
		if (!status) {
			return {kind: 'ignore'};
		}
		return {
			kind: 'status',
			idMessage: body.idMessage,
			chatId: body.chatId ?? body.senderData?.chatId,
			status,
		};
	}

	const isMessage = body.typeWebhook === 'incomingMessageReceived'
		|| body.typeWebhook === 'outgoingMessageReceived'
		|| body.typeWebhook === 'outgoingAPIMessageReceived';

	if (!isMessage || !body.idMessage) {
		return {kind: 'ignore'};
	}

	const chatId = body.senderData?.chatId ?? body.chatId;
	if (!chatId) {
		return {kind: 'ignore'};
	}

	const direction = body.typeWebhook === 'incomingMessageReceived' ? 'incoming' : 'outgoing';

	return {
		kind: 'message',
		message: {
			idMessage: body.idMessage,
			chatId,
			text: webhookText(body),
			timestamp: body.timestamp ?? Math.floor(Date.now() / 1000),
			direction,
			status: direction === 'outgoing' ? 'sent' : undefined,
			senderName: body.senderData?.senderName ?? body.senderData?.chatName,
		},
	};
}
