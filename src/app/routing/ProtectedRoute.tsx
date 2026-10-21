import {Navigate, Outlet} from 'react-router-dom';
import {Loader} from '@widgets/Loader';
import {useAuth} from '../providers/AuthProvider/AuthProvider.tsx';

export const ProtectedRoute = () => {
	const {isAuth, isLoading} = useAuth();

	if (isLoading) {
		return <div className="screen-loader"><Loader /></div>;
	}

	if (!isAuth) {
		return <Navigate to="/login" replace/>;
	}

	return <Outlet/>;
};
