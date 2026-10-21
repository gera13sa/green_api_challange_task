import {type KeyboardEvent, useEffect, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import {
	Avatar,
	Button,
	Flex,
	Icon16Chevron,
	Textarea,
	Typography,
} from '@maxhub/max-ui';

import {useChats} from '@app/providers/ChatProvider/ChatProvider.tsx';
import {Loader} from '@widgets/Loader';
import type {MessageStatus, UiMessage} from '@shared/api/max';
import {
	avatarGradient,
	chatKindLabel,
	formatDayLabel,
	formatMessageTime,
	formatPhone,
	initials,
} from '@shared/lib/format.ts';

import '../styles/style.css';

function statusMark(status: MessageStatus | undefined, pending?: boolean, failed?: boolean): string {
	if (failed) {
		return '!';
	}
	if (pending) {
		return '…';
	}
	if (status === 'read' || status === 'delivered') {
		return '✓✓';
	}
	if (status === 'sent') {
		return '✓';
	}
	return '';
}

function groupMessages(messages: UiMessage[]): Array<{ label: string; items: UiMessage[] }> {
	const groups: Array<{ label: string; items: UiMessage[] }> = [];
	for (const message of messages) {
		const label = formatDayLabel(message.timestamp);
		const last = groups[groups.length - 1];
		if (!last || last.label !== label) {
			groups.push({label, items: [message]});
		} else {
			last.items.push(message);
		}
	}
	return groups;
}

const Composer = ({
	                  sending,
	                  onSend,
}: {
	sending: boolean;
	onSend: (text: string) => void;
}) => {
	const [draft, setDraft] = useState('');

	const submit = () => {
		const text = draft;
		if (!text.trim() || sending) {
			return;
		}
		if (text.trim().length > 4000) {
			toast.error('Сообщение длиннее 4000 символов');
			return;
		}
		setDraft('');
		onSend(text);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	};

	return (
		<form
			className="composer"
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<Textarea
				mode="secondary"
				value={draft}
				rows={1}
				style={{minHeight: '32px !important'}}
				placeholder="Сообщение"
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={onKeyDown}
			/>
			<Button
				type="submit"
				size="small"
				loading={sending}
				disabled={!draft.trim()}
			>
				Отправить
			</Button>
		</form>
	);
};

export const ChatWidget = () => {
	const {selectedChat, messages, messagesLoading, sending, sendMessage, clearSelection} = useChats();
	const bottomRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({block: 'end'});
	}, [messages, selectedChat?.chatId]);

	if (!selectedChat) {
		return (
			<section className="chat-panel chat-panel--empty">
				<Typography.Text color="secondary">
					Выберите чат слева, чтобы читать и отправлять сообщения.
				</Typography.Text>
			</section>
		);
	}

	const subtitle = [chatKindLabel(selectedChat.type), formatPhone(selectedChat.phoneNumber)]
		.filter(Boolean)
		.join(' · ');

	return (
		<section className="chat-panel">
			<header className="chat-panel__header">
				<Button
					size="small"
					variant="ghost"
					type="button"
					aria-label="Назад"
					onClick={clearSelection}
				>
					<span className="back-icon"><Icon16Chevron/></span>
				</Button>
				<Flex gap={12} style={{alignItems: 'center'}}>
					<Avatar.Container size={40}>
						<Avatar.Text gradient={avatarGradient(selectedChat.chatId)}>
							{initials(selectedChat.name)}
						</Avatar.Text>
					</Avatar.Container>
					<Flex direction="column" gap={0} className="chat-panel__header-text">
						<Typography.Title variant="medium-strong">{selectedChat.name}</Typography.Title>
						<Typography.Text color="secondary" variant="description">{subtitle}</Typography.Text>
					</Flex>
				</Flex>
			</header>

			<div className="chat-panel__messages">
				{messagesLoading && messages.length === 0 ? <Loader/> : null}
				{groupMessages(messages).map((group) => (
					<div key={group.label} className="day-group">
						<Typography.Label variant="small" className="day-label">
							{group.label}
						</Typography.Label>
						{group.items.map((message) => (
							<article
								key={message.idMessage}
								className={message.direction === 'outgoing' ? 'bubble bubble--out' : 'bubble bubble--in'}
							>
								{message.direction === 'incoming' && selectedChat.type !== 'user' && message.senderName ? (
									<Typography.Label variant="small-strong" className="bubble__author">
										{message.senderName}
									</Typography.Label>
								) : null}
								<Typography.Body variant="medium">{message.text}</Typography.Body>
								<span className="bubble__meta">
									<time>{formatMessageTime(message.timestamp)}</time>
									{message.direction === 'outgoing' ? (
										<em className={message.status === 'read' ? 'status status--read' : 'status'}>
											{statusMark(message.status, message.pending, message.failed)}
										</em>
									) : null}
								</span>
							</article>
						))}
					</div>
				))}
				<div ref={bottomRef}/>
			</div>

			<Composer
				key={selectedChat.chatId}
				sending={sending}
				onSend={(text) => void sendMessage(text)}
			/>
		</section>
	);
};
