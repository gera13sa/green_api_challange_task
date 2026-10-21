export type InstanceState =
	| 'notAuthorized'
	| 'authorized'
	| 'blocked'
	| 'starting'
	| 'suspended'
	| 'pendingPassword';

export type ChatType = 'user' | 'group' | 'channel' | 'bot';

export type MessageStatus = 'sent' | 'delivered' | 'read';

export type QrResponseType = 'qrCode' | 'error' | 'already_registered' | 'alreadyLogged';

export interface MaxSession {
	idInstance: string;
	apiTokenInstance: string;
	apiUrl: string;
	useMocks: boolean;
	requirePassword: boolean;
}

export interface StateInstanceResponse {
	stateInstance: InstanceState;
}

export interface QrResponse {
	type: QrResponseType;
	message: string;
}

export interface AuthorizationPasswordResponse {
	status: boolean;
	data: {
		status: 'success' | 'fail';
		reason: string;
	};
}

export interface AuthorizationFlowResponse {
	status: boolean;
	data: {
		status: 'success' | 'fail' | 'succes';
		reason: string;
		retryAfter?: number;
	};
}

export interface LogoutResponse {
	isLogout: boolean;
}

export interface SendMessageRequest {
	chatId: string;
	message: string;
	typingTime?: number;
	quotedMessageId?: string;
}

export interface SendMessageResponse {
	idMessage: string;
}

export interface SenderData {
	chatId: string;
	chatName?: string;
	chatType?: ChatType;
	sender?: string;
	senderName?: string;
	senderType?: ChatType;
	senderContactName?: string;
	senderPhoneNumber?: number;
}

export interface MessageData {
	typeMessage: string;
	textMessageData?: {
		textMessage?: string;
	};
	extendedTextMessageData?: {
		text?: string;
		description?: string;
	};
	fileMessageData?: {
		caption?: string;
		fileName?: string;
		downloadUrl?: string;
	};
}

export interface NotificationBody {
	typeWebhook: string;
	instanceData?: {
		idInstance: number;
		wid: string;
		typeInstance: string;
	};
	timestamp?: number;
	idMessage?: string;
	chatId?: string;
	status?: string;
	stateInstance?: InstanceState;
	senderData?: SenderData;
	messageData?: MessageData;
}

export interface Notification {
	receiptId: number;
	body: NotificationBody;
}

export interface DeleteNotificationResponse {
	result: boolean;
	reason: string;
}

export interface ChatSummary {
	chatId: string;
	name: string;
	type: ChatType;
	phoneNumber: number;
	unreadCount: number;
}

export interface GetChatHistoryRequest {
	chatId: string;
	count?: number;
}

export interface ReadChatRequest {
	chatId: string;
	idMessage?: string;
}

export interface ReadChatResponse {
	setRead: boolean;
}

export interface ChatHistoryItem {
	type: 'incoming' | 'outgoing';
	idMessage: string;
	timestamp: number;
	statusMessage?: MessageStatus;
	sendByApi?: boolean;
	typeMessage: string;
	chatId: string;
	chatType?: ChatType;
	senderName?: string;
	senderType?: ChatType;
	senderContactName?: string;
	isForwarded?: boolean;
	forwardingScore?: number;
	textMessage?: string;
	downloadUrl?: string;
	caption?: string;
	fileName?: string;
}

export interface MaxApi {
	getStateInstance: () => Promise<StateInstanceResponse>;
	getQr: () => Promise<QrResponse>;
	startAuthorization: (phoneNumber: number) => Promise<AuthorizationFlowResponse>;
	sendAuthorizationCode: (code: string) => Promise<AuthorizationFlowResponse>;
	sendAuthorizationPassword: (password: string) => Promise<AuthorizationPasswordResponse>;
	logout: () => Promise<LogoutResponse>;
	sendMessage: (body: SendMessageRequest) => Promise<SendMessageResponse>;
	receiveNotification: (receiveTimeout?: number, signal?: AbortSignal) => Promise<Notification | null>;
	deleteNotification: (receiptId: number) => Promise<DeleteNotificationResponse>;
	getChats: (count?: number) => Promise<ChatSummary[]>;
	getChatHistory: (body: GetChatHistoryRequest) => Promise<ChatHistoryItem[]>;
	readChat: (body: ReadChatRequest) => Promise<ReadChatResponse>;
	simulateQrScan?: () => Promise<void>;
}
