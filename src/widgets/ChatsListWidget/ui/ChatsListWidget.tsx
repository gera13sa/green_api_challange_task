import {type FormEvent, useMemo, useState} from 'react';
import {
	Avatar,
	Button,
	CellHeader,
	CellList,
	CellSimple,
	Counter,
	Flex,
	Icon16SearchOutline,
	Input,
	Typography,
} from '@maxhub/max-ui';

import {useAuth} from '@app/providers/AuthProvider/AuthProvider.tsx';
import {useChats} from '@app/providers/ChatProvider/ChatProvider.tsx';
import {
	avatarGradient,
	chatKindLabel,
	formatChatListTime,
	formatPhone,
	initials,
} from '@shared/lib/format.ts';

import '../styles/style.css';

export const ChatsListWidget = () => {
	const {session, logout} = useAuth();
	const {chats, chatsLoading, selectedChatId, selectChat, openChat} = useChats();
	const [query, setQuery] = useState('');
	const [draftId, setDraftId] = useState('');
	const [composerOpen, setComposerOpen] = useState(false);

	const visibleChats = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) {
			return chats;
		}
		return chats.filter((chat) => {
			const phone = formatPhone(chat.phoneNumber);
			return chat.name.toLowerCase().includes(normalized)
				|| chat.chatId.toLowerCase().includes(normalized)
				|| phone.includes(normalized);
		});
	}, [chats, query]);

	const onOpenChat = (event: FormEvent) => {
		event.preventDefault();
		openChat(draftId);
		setDraftId('');
		setComposerOpen(false);
	};

	return (
		<aside className="chat-list">
			<Flex direction="column" gap={12} className="chat-list__top">
				<Flex style={{width: '100%'}} direction="row" justify="space-between" gap={12}>
					<Flex direction="column" gap={2}>
						<Typography.Headline variant="medium">Чаты</Typography.Headline>
						<Typography.Text color="secondary" variant="note">
							{session?.useMocks ? 'Мок' : `Инстанс ${session?.idInstance ?? ''}`}
						</Typography.Text>
					</Flex>
					<Flex gap={8}>
						<Button
							size="small"
							variant={!composerOpen ? 'primary' : 'secondary'}
							type="button"
							onClick={() => setComposerOpen((open) => !open)}
						>
							Новый
						</Button>
						<Button
							size="small"
							variant="destructive"
							type="button"
							onClick={() => void logout()}
						>
							Выйти
						</Button>
					</Flex>
				</Flex>

				{composerOpen ? (
					<form style={{width: '100%'}} className="new-chat" onSubmit={onOpenChat}>
						<Input
							value={draftId}
							onChange={(event) => setDraftId(event.target.value)}
							placeholder="chatId, например 10000000"
							withClearButton
						/>
						<Button type="submit" size="medium" disabled={!draftId.trim()}>
							Написать
						</Button>
					</form>
				) : null}
			</Flex>

			<div className='chat-list__top'>
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Поиск по имени, телефону или chatId"
					iconBefore={<Icon16SearchOutline/>}
					aria-label="Поиск чатов"
				/>
			</div>

			<div className="chat-list__items">
				{chatsLoading && chats.length === 0 ? (
					<Typography.Text color="secondary" className="chat-list__empty">
						Загружаем чаты…
					</Typography.Text>
				) : null}
				{!chatsLoading && visibleChats.length === 0 ? (
					<Typography.Text color="secondary" className="chat-list__empty">
						Чатов нет
					</Typography.Text>
				) : null}

				<CellList mode="full-width">
					{visibleChats.length > 0 ? (
						<CellHeader titleStyle="normal">Диалоги</CellHeader>
					) : null}
					{visibleChats.map((chat) => {
						const subtitle = chat.preview || formatPhone(chat.phoneNumber) || chatKindLabel(chat.type);
						return (
							<CellSimple
								key={chat.chatId}
								as="button"
								className={chat.chatId === selectedChatId ? 'chat-row chat-row--active' : 'chat-row'}
								title={chat.name}
								subtitle={subtitle}
								before={(
									<Avatar.Container size={44}>
										<Avatar.Text gradient={avatarGradient(chat.chatId)}>
											{initials(chat.name)}
										</Avatar.Text>
									</Avatar.Container>
								)}
								after={(
									<Flex direction="column" align="flex-end" gap={4}>
										{chat.previewTime ? (
											<Typography.Text color="tertiary" variant="note">
												{formatChatListTime(chat.previewTime)}
											</Typography.Text>
										) : null}
										{chat.unreadCount > 0 ? (
											<Counter value={chat.unreadCount} variant="primary" rounded/>
										) : null}
									</Flex>
								)}
								onClick={() => selectChat(chat.chatId)}
							/>
						);
					})}
				</CellList>
			</div>
		</aside>
	);
};
