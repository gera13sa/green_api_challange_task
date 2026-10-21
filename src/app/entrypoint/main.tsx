import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Toaster} from 'react-hot-toast';
import {MaxUI, Panel} from '@maxhub/max-ui';

import {AuthProvider} from '@app/providers/AuthProvider/AuthProvider.tsx';
import {AppRouting} from '@app/routing/AppRouting.tsx';

import '@maxhub/max-ui/dist/styles.css';
import '../../index.css';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<MaxUI colorScheme="light" platform="ios">
			<Panel mode="primary" style={{height: '100%', minHeight: '100%'}}>
				<AuthProvider>
					<AppRouting />
					<Toaster position="top-center" />
				</AuthProvider>
			</Panel>
		</MaxUI>
	</StrictMode>,
);
