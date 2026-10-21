import {
	createContext,
	type FC,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import toast from 'react-hot-toast';

import {useAuth} from '@app/providers/AuthProvider/AuthProvider.tsx';
import {
	extractErrorMessage,
	interpretNotification,
	mapHistoryItem,
	type ChatSummary,
	type Notification,
	type UiMessage,
} from '@shared/api/max';

export interface ChatListItem extends ChatSummary {
	preview: string;
	previewTime?: number;
}

interface ChatContextType {
	chats: ChatListItem[];
	chatsLoading: boolean;
	selectedChatId: string | null;
	selectedChat: ChatListItem | null;
	messages: UiMessage[];
	messagesLoading: boolean;
	sending: boolean;
	selectChat: (chatId: string) => void;
	clearSelection: () => void;
	openChat: (chatId: string) => void;
	sendMessage: (text: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve();
			return;
		}
		const timer = window.setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			window.clearTimeout(timer);
			resolve();
		};
		signal?.addEventListener('abort', onAbort, {once: true});
	});
}

function mergeMessages(remote: UiMessage[], local: UiMessage[]): UiMessage[] {
	const byId = new Map(remote.map((message) => [message.idMessage, message]));
	for (const message of local) {
		if (message.pending || message.failed || !byId.has(message.idMessage)) {
			byId.set(message.idMessage, message);
		}
	}
	return [...byId.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function withPreview(chat: ChatSummary, preview = '', previewTime?: number): ChatListItem {
	return {...chat, preview, previewTime};
}

export const ChatProvider: FC<{children: ReactNode}> = ({children}) => {
	const {api, setInstanceState} = useAuth();
	const [chats, setChats] = useState<ChatListItem[]>([]);
	const [chatsLoading, setChatsLoading] = useState(true);
	const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
	const [messagesByChat, setMessagesByChat] = useState<Record<string, UiMessage[]>>({});
	const [historyReadyId, setHistoryReadyId] = useState<string | null>(null);
	const [sending, setSending] = useState(false);
	const selectedRef = useRef<string | null>(null);

	useEffect(() => {
		selectedRef.current = selectedChatId;
	}, [selectedChatId]);

	useEffect(() => {
		if (!api) {
			return;
		}
		let cancelled = false;

		api.getChats(50)
			.then((items) => {
				if (cancelled) {
					return;
				}
				setChats(items.map((chat) => withPreview(chat)));
				setSelectedChatId((current) => {
					if (current && items.some((chat) => chat.chatId === current)) {
						return current;
					}
					if (window.matchMedia('(max-width: 860px)').matches) {
						return null;
					}
					return items[0]?.chatId ?? null;
				});
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					toast.error(extractErrorMessage(error));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setChatsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [api]);

	useEffect(() => {
		if (!api || !selectedChatId) {
			return;
		}
		let cancelled = false;
		api.getChatHistory({chatId: selectedChatId, count: 100})
			.then((items) => {
				if (cancelled) {
					return;
				}
				const mapped = items.map(mapHistoryItem).reverse();
				setMessagesByChat((prev) => ({
					...prev,
					[selectedChatId]: mergeMessages(mapped, prev[selectedChatId] ?? []),
				}));
				const last = mapped[mapped.length - 1];
				setHistoryReadyId(selectedChatId);
				setChats((prev) => prev.map((chat) => {
					if (chat.chatId !== selectedChatId) {
						return chat;
					}
					return {
						...chat,
						unreadCount: 0,
						preview: last?.text ?? chat.preview,
						previewTime: last?.timestamp ?? chat.previewTime,
					};
				}));
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setHistoryReadyId(selectedChatId);
					toast.error(extractErrorMessage(error));
				}
			});

		void api.readChat({chatId: selectedChatId}).catch(() => undefined);

		return () => {
			cancelled = true;
		};
	}, [api, selectedChatId]);

	useEffect(() => {
		if (!api) {
			return;
		}
		const controller = new AbortController();
		const seen = new Set<number>();
		let stopped = false;
		let lastError = '';

		const handleNotification = (notification: Notification) => {
			if (seen.has(notification.receiptId)) {
				return;
			}
			seen.add(notification.receiptId);
			const interpreted = interpretNotification(notification.body);
			if (interpreted.kind === 'state') {
				setInstanceState(interpreted.state);
				return;
			}
			if (interpreted.kind === 'ignore') {
				return;
			}
			if (interpreted.kind === 'status') {
				setMessagesByChat((prev) => {
					let changed = false;
					const next: Record<string, UiMessage[]> = {};
					for (const [chatId, list] of Object.entries(prev)) {
						if (interpreted.chatId && chatId !== interpreted.chatId) {
							next[chatId] = list;
							continue;
						}
						next[chatId] = list.map((message) => {
							if (message.idMessage !== interpreted.idMessage) {
								return message;
							}
							changed = true;
							return {...message, status: interpreted.status, pending: false};
						});
					}
					return changed ? next : prev;
				});
				return;
			}

			const message = interpreted.message;
			setMessagesByChat((prev) => {
				const list = prev[message.chatId] ?? [];
				if (list.some((item) => item.idMessage === message.idMessage)) {
					return prev;
				}
				return {
					...prev,
					[message.chatId]: [...list, message].sort((left, right) => left.timestamp - right.timestamp),
				};
			});
			setChats((prev) => {
				const existing = prev.find((chat) => chat.chatId === message.chatId);
				const isOpen = selectedRef.current === message.chatId;
				const unreadCount = message.direction === 'incoming'
					? (isOpen ? 0 : (existing?.unreadCount ?? 0) + 1)
					: (existing?.unreadCount ?? 0);
				const item: ChatListItem = {
					chatId: message.chatId,
					name: existing?.name ?? (message.direction === 'incoming' ? message.senderName : undefined) ?? message.chatId,
					type: existing?.type ?? (message.chatId.startsWith('-') ? 'group' : 'user'),
					phoneNumber: existing?.phoneNumber ?? 0,
					unreadCount,
					preview: message.text,
					previewTime: message.timestamp,
				};
				return [item, ...prev.filter((chat) => chat.chatId !== message.chatId)];
			});
			if (message.direction === 'incoming' && selectedRef.current === message.chatId) {
				void api.readChat({chatId: message.chatId}).catch(() => undefined);
			}
		};

		const loop = async () => {
			let backoffMs = 2000;
			while (!stopped) {
				try {
					const notification = await api.receiveNotification(20, controller.signal);
					if (stopped) {
						break;
					}
					if (!notification) {
						continue;
					}
					handleNotification(notification);
					await api.deleteNotification(notification.receiptId);
					backoffMs = 2000;
				} catch (error: unknown) {
					if (stopped) {
						break;
					}
					const message = extractErrorMessage(error);
					const isRateLimited = message.toLowerCase().includes('лимит')
						|| message.includes('429');
					if (message !== lastError) {
						toast.error(message);
						lastError = message;
					}
					await sleep(isRateLimited ? backoffMs : 4000, controller.signal);
					if (isRateLimited) {
						backoffMs = Math.min(backoffMs * 2, 60000);
					}
				}
			}
		};

		void loop();
		return () => {
			stopped = true;
			controller.abort();
		};
	}, [api, setInstanceState]);

	const selectChat = useCallback((chatId: string) => {
		setSelectedChatId(chatId);
	}, []);

	const clearSelection = useCallback(() => {
		setSelectedChatId(null);
	}, []);

	const openChat = useCallback((chatId: string) => {
		const trimmed = chatId.trim();
		if (!trimmed) {
			return;
		}
		setChats((prev) => {
			if (prev.some((chat) => chat.chatId === trimmed)) {
				return prev;
			}
			return [
				withPreview({
					chatId: trimmed,
					name: trimmed,
					type: trimmed.startsWith('-') ? 'group' : 'user',
					phoneNumber: 0,
					unreadCount: 0,
				}),
				...prev,
			];
		});
		setSelectedChatId(trimmed);
	}, []);

	const sendMessage = useCallback(async (text: string) => {
		if (!api || !selectedChatId) {
			return;
		}
		const trimmed = text.trim();
		if (!trimmed) {
			return;
		}
		if (trimmed.length > 4000) {
			toast.error('Сообщение длиннее 4000 символов');
			return;
		}

		const chatId = selectedChatId;
		const tempId = `local-${Date.now()}`;
		const optimistic: UiMessage = {
			idMessage: tempId,
			chatId,
			text: trimmed,
			timestamp: Math.floor(Date.now() / 1000),
			direction: 'outgoing',
			status: 'sent',
			pending: true,
		};

		setMessagesByChat((prev) => ({
			...prev,
			[chatId]: [...(prev[chatId] ?? []), optimistic],
		}));
		setChats((prev) => {
			const existing = prev.find((chat) => chat.chatId === chatId);
			const next = existing
				? {...existing, preview: trimmed, previewTime: optimistic.timestamp}
				: withPreview({
					chatId,
					name: chatId,
					type: chatId.startsWith('-') ? 'group' : 'user',
					phoneNumber: 0,
					unreadCount: 0,
				}, trimmed, optimistic.timestamp);
			return [next, ...prev.filter((chat) => chat.chatId !== chatId)];
		});

		setSending(true);
		try {
			const response = await api.sendMessage({chatId, message: trimmed});
			setMessagesByChat((prev) => {
				const list = prev[chatId] ?? [];
				if (list.some((message) => message.idMessage === response.idMessage)) {
					return {
						...prev,
						[chatId]: list.filter((message) => message.idMessage !== tempId),
					};
				}
				return {
					...prev,
					[chatId]: list.map((message) => (
						message.idMessage === tempId
							? {...message, idMessage: response.idMessage, pending: false}
							: message
					)),
				};
			});
		} catch (error: unknown) {
			toast.error(extractErrorMessage(error));
			setMessagesByChat((prev) => ({
				...prev,
				[chatId]: (prev[chatId] ?? []).map((message) => (
					message.idMessage === tempId
						? {...message, pending: false, failed: true}
						: message
				)),
			}));
		} finally {
			setSending(false);
		}
	}, [api, selectedChatId]);

	const selectedChat = chats.find((chat) => chat.chatId === selectedChatId) ?? null;
	const messages = selectedChatId ? messagesByChat[selectedChatId] ?? [] : [];
	const messagesLoading = Boolean(selectedChatId) && historyReadyId !== selectedChatId;

	const contextValue = useMemo<ChatContextType>(() => ({
		chats,
		chatsLoading,
		selectedChatId,
		selectedChat,
		messages,
		messagesLoading,
		sending,
		selectChat,
		clearSelection,
		openChat,
		sendMessage,
	}), [
		chats,
		chatsLoading,
		selectedChatId,
		selectedChat,
		messages,
		messagesLoading,
		sending,
		selectChat,
		clearSelection,
		openChat,
		sendMessage,
	]);

	return (
		<ChatContext.Provider value={contextValue}>
			{children}
		</ChatContext.Provider>
	);
};

export const useChats = () => {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error('useChats must be used inside ChatProvider');
	}
	return context;
};
