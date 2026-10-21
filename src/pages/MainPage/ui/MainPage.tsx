import {Typography} from '@maxhub/max-ui';

import {ChatProvider, useChats} from '@app/providers/ChatProvider/ChatProvider.tsx';
import {useAuth} from '@app/providers/AuthProvider/AuthProvider.tsx';
import {useDocumentTitle} from '@shared/hooks/useDocumentTitle.ts';
import {ChatWidget} from '@widgets/ChatWidget';
import {ChatsListWidget} from '@widgets/ChatsListWidget';

import '../style/style.css';


const MessengerLayout = () => {
	const {selectedChatId} = useChats();
	const {stateInstance} = useAuth();
	useDocumentTitle('Чаты MAX');

	return (
		<div className={selectedChatId ? 'messenger messenger--open' : 'messenger'}>
			{stateInstance === 'suspended' ? (
				<div className="suspended-banner">
					<Typography.Text>
						На аккаунте временные ограничения. Отправка доступна только сохранённым контактам.
					</Typography.Text>
				</div>
			) : null}
			<div className="messenger__body">
				<ChatsListWidget />
				<ChatWidget />
			</div>
		</div>
	);
};

export const MainPage = () => {
	return (
		<ChatProvider>
			<MessengerLayout />
		</ChatProvider>
	);
};
