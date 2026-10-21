import {
	createContext,
	type FC,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react';
import toast from 'react-hot-toast';

import {createMaxApi, extractErrorMessage, type InstanceState, type MaxApi, type MaxSession} from '@shared/api/max';

const SESSION_KEY = 'max-session';

interface AuthContextType {
	session: MaxSession | null;
	stateInstance: InstanceState | null;
	api: MaxApi | null;
	isAuth: boolean;
	isLoading: boolean;
	connect: (session: MaxSession) => Promise<InstanceState>;
	refreshState: () => Promise<InstanceState>;
	setInstanceState: (state: InstanceState) => void;
	logout: () => Promise<void>;
	clearSession: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function readSession(): MaxSession | null {
	const raw = localStorage.getItem(SESSION_KEY);
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as Partial<MaxSession>;
		if (!parsed.idInstance || !parsed.apiTokenInstance || !parsed.apiUrl) {
			return null;
		}
		return {
			idInstance: String(parsed.idInstance),
			apiTokenInstance: String(parsed.apiTokenInstance),
			apiUrl: String(parsed.apiUrl),
			useMocks: Boolean(parsed.useMocks),
			requirePassword: Boolean(parsed.requirePassword),
		};
	} catch {
		localStorage.removeItem(SESSION_KEY);
		return null;
	}
}

function storeSession(session: MaxSession | null): void {
	if (!session) {
		localStorage.removeItem(SESSION_KEY);
		return;
	}
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export const AuthProvider: FC<{children: ReactNode}> = ({children}) => {
	const [session, setSession] = useState<MaxSession | null>(readSession);
	const [stateInstance, setStateInstance] = useState<InstanceState | null>(null);
	const [isLoading, setIsLoading] = useState(() => readSession() !== null);

	const api = useMemo(() => (session ? createMaxApi(session) : null), [session]);

	useEffect(() => {
		if (!api) {
			return;
		}

		let cancelled = false;
		api.getStateInstance()
			.then((response) => {
				if (!cancelled) {
					setStateInstance(response.stateInstance);
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setStateInstance(null);
					toast.error(extractErrorMessage(error));
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [api]);

	const setInstanceState = useCallback((state: InstanceState) => {
		setStateInstance(state);
	}, []);

	const connect = useCallback(async (next: MaxSession) => {
		const normalized: MaxSession = {
			apiUrl: next.apiUrl.trim().replace(/\/+$/, ''),
			idInstance: next.idInstance.trim(),
			apiTokenInstance: next.apiTokenInstance.trim(),
			useMocks: next.useMocks,
			requirePassword: next.requirePassword,
		};
		if (!normalized.apiUrl || !normalized.idInstance || !normalized.apiTokenInstance) {
			throw new Error('Заполните idInstance и apiTokenInstance');
		}

		const client = createMaxApi(normalized);
		const response = await client.getStateInstance();
		storeSession(normalized);
		setSession(normalized);
		setStateInstance(response.stateInstance);
		return response.stateInstance;
	}, []);

	const refreshState = useCallback(async () => {
		if (!api) {
			throw new Error('Сессия не создана');
		}
		const response = await api.getStateInstance();
		setStateInstance(response.stateInstance);
		return response.stateInstance;
	}, [api]);

	const clearSession = useCallback(() => {
		storeSession(null);
		setSession(null);
		setStateInstance(null);
		setIsLoading(false);
	}, []);

	const logout = useCallback(async () => {
		try {
			await api?.logout();
		} catch (error: unknown) {
			toast.error(extractErrorMessage(error));
		} finally {
			clearSession();
		}
	}, [api, clearSession]);

	const contextValue = useMemo<AuthContextType>(() => ({
		session,
		stateInstance,
		api,
		isAuth: stateInstance === 'authorized' || stateInstance === 'suspended',
		isLoading,
		connect,
		refreshState,
		setInstanceState,
		logout,
		clearSession,
	}), [
		session,
		stateInstance,
		api,
		isLoading,
		connect,
		refreshState,
		setInstanceState,
		logout,
		clearSession,
	]);

	return (
		<AuthContext.Provider value={contextValue}>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used inside AuthProvider');
	}
	return context;
};
