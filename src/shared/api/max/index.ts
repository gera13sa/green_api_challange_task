export {createMaxApi} from './createMaxApi';
export {extractErrorMessage} from './errors';
export {MOCK_CLOUD_PASSWORD, MOCK_SMS_CODE} from './mockApi';
export {interpretNotification, mapHistoryItem} from './mapMessage';
export type {UiMessage} from './mapMessage';
export type {
	ChatHistoryItem,
	ChatSummary,
	ChatType,
	InstanceState,
	MaxApi,
	MessageStatus,
	MaxSession,
	Notification,
	QrResponse,
} from './types';
