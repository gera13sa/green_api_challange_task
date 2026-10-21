import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';

import {LoginPage} from '@pages/LoginPage';
import {MainPage} from '@pages/MainPage';
import {ProtectedRoute} from './ProtectedRoute.tsx';

export const AppRouting = () => {
	return (
		<BrowserRouter>
			<Routes>
				<Route element={<ProtectedRoute />}>
					<Route path="/" element={<MainPage />} />
				</Route>
				<Route path="/login" element={<LoginPage />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
};
