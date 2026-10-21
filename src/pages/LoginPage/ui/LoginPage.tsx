import {type FormEvent, useEffect, useState} from 'react';
import {Navigate} from 'react-router-dom';
import toast from 'react-hot-toast';
import {
	Button,
	Flex,
	Input,
	Panel,
	Typography,
} from '@maxhub/max-ui';

import {useAuth} from '@app/providers/AuthProvider/AuthProvider.tsx';
import {Loader} from '@widgets/Loader';
import {
	extractErrorMessage,
	MOCK_CLOUD_PASSWORD,
	type QrResponse,
} from '@shared/api/max';
import {readMaxEnvDefaults} from '@shared/config/maxEnv.ts';
import {useDocumentTitle} from '@shared/hooks/useDocumentTitle.ts';

import '../styles/style.css';

const PASSWORD_REASONS: Record<string, string> = {
	invalid_password: 'Неверный пароль',
	rate_limit_exceeded: 'Слишком много попыток, попробуйте позже',
	authorization_not_started: 'Сначала получите QR-код',
	timeout: 'Время ожидания пароля истекло',
	already_registered: 'Инстанс уже авторизован',
	attempts_exceeded: 'Превышено число попыток',
	time_limit_expired_logout: 'Время ввода пароля истекло',
};

function passwordReason(reason: string): string {
	return PASSWORD_REASONS[reason] || reason || 'Не удалось подтвердить пароль';
}

function qrImageSrc(message: string): string {
	const trimmed = message.trim();
	if (trimmed.startsWith('data:')) {
		return trimmed;
	}
	return `data:image/png;base64,${trimmed}`;
}


export const LoginPage = () => {
	useDocumentTitle('Вход в MAX');

	const {
		session,
		stateInstance,
		api,
		isAuth,
		isLoading,
		connect,
		refreshState,
		clearSession,
	} = useAuth();

	const envDefaults = readMaxEnvDefaults();
	const [idInstance, setIdInstance] = useState(session?.idInstance ?? envDefaults.idInstance);
	const [apiTokenInstance, setApiTokenInstance] = useState(
		session?.apiTokenInstance ?? envDefaults.apiTokenInstance,
	);
	const [connecting, setConnecting] = useState(false);
	const [connectError, setConnectError] = useState('');
	const [qr, setQr] = useState<QrResponse | null>(null);
	const [qrError, setQrError] = useState('');
	const [scanning, setScanning] = useState(false);
	const [password, setPassword] = useState('');
	const [passwordLoading, setPasswordLoading] = useState(false);


	useEffect(() => {
		const waiting = stateInstance === 'notAuthorized'
			|| stateInstance === 'pendingPassword'
			|| stateInstance === 'starting';

		if (!session || !waiting) {
			return;
		}

		const timer = window.setInterval(() => {
			void refreshState().catch(() => undefined);
		}, 8000);
		return () => window.clearInterval(timer);
	}, [session, stateInstance, refreshState]);

	useEffect(() => {
		if (!api || stateInstance !== 'notAuthorized') {
			return;
		}

		let cancelled = false;
		let inFlight = false;

		const loadQr = () => {
			if (inFlight) {
				return;
			}

			inFlight = true;

			void api.getQr()
				.then((response) => {
					if (cancelled) {
						return;
					}
					setQr(response);
					setQrError('');
					if (response.type === 'already_registered' || response.type === 'alreadyLogged') {
						void refreshState().catch(() => undefined);
					}
				})
				.catch((error: unknown) => {
					if (!cancelled) {
						setQrError(extractErrorMessage(error));
					}
				})
				.finally(() => {
					inFlight = false;
				});
		};

		loadQr();
		const timer = window.setInterval(loadQr, 6000);

		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [api, stateInstance, refreshState]);

	if (isLoading) {
		return <div className="screen-loader"><Loader/></div>;
	}

	if (isAuth) {
		return <Navigate to="/" replace/>;
	}

	const onConnect = async (event: FormEvent) => {
		event.preventDefault();
		setConnectError('');
		setConnecting(true);
		try {
			await connect({
				apiUrl: envDefaults.apiUrl,
				idInstance: idInstance.trim(),
				apiTokenInstance: apiTokenInstance.trim(),
				useMocks: envDefaults.useMocks,
				requirePassword: envDefaults.useMocks && envDefaults.requirePassword,
			});
		} catch (error: unknown) {
			const message = extractErrorMessage(error);
			setConnectError(message);
			toast.error(message);
		} finally {
			setConnecting(false);
		}
	};

	const onScan = async () => {
		if (!api?.simulateQrScan) {
			return;
		}
		setScanning(true);
		try {
			await api.simulateQrScan();
			await refreshState();
		} catch (error: unknown) {
			toast.error(extractErrorMessage(error));
		} finally {
			setScanning(false);
		}
	};

	const onPassword = async (event: FormEvent) => {
		event.preventDefault();
		if (!api) {
			return;
		}
		setPasswordLoading(true);
		try {
			const response = await api.sendAuthorizationPassword(password);
			if (!response.status || response.data.status !== 'success') {
				toast.error(passwordReason(response.data.reason));
				return;
			}
			await refreshState();
		} catch (error: unknown) {
			toast.error(extractErrorMessage(error));
		} finally {
			setPasswordLoading(false);
		}
	};

	const logoutInstance = async () => {
		if (!api) {
			clearSession();
			return;
		}
		try {
			await api.logout();
			await refreshState();
		} catch (error: unknown) {
			toast.error(extractErrorMessage(error));
			clearSession();
		}
	};

	const showCredentials = !session || stateInstance === null;
	const showQr = stateInstance === 'notAuthorized';
	const showPassword = stateInstance === 'pendingPassword';
	const showStarting = stateInstance === 'starting';
	const showBlocked = stateInstance === 'blocked';

	return (
		<main className="auth-screen">
			<Panel mode="secondary" className="auth-card" centeredX centeredY>
				<Flex direction="column" gap={16}>
					<Flex direction="column" gap={8}>
						<Typography.Headline variant="large-strong">Вход в инстанс</Typography.Headline>
						{showCredentials &&
							<Typography.Text color="secondary">
								Введите idInstance и apiTokenInstance.
							</Typography.Text>
						}
					</Flex>

					{showCredentials ? (
						<form className="auth-form" onSubmit={(event) => void onConnect(event)}>
							<Flex direction="column" gap={16}>
								<label className="field">
									<Typography.Label variant="small-strong">idInstance</Typography.Label>
									<Input
										value={idInstance}
										autoComplete="off"
										onChange={(event) => setIdInstance(event.target.value)}
										placeholder="310000000001"
										withClearButton
									/>
								</label>
								<label className="field">
									<Typography.Label variant="small-strong">apiTokenInstance</Typography.Label>
									<Input
										value={apiTokenInstance}
										autoComplete="off"
										placeholder=""
										onChange={(event) => setApiTokenInstance(event.target.value)}
										withClearButton
									/>
								</label>
								{connectError ? (
									<Typography.Text className="form-error">{connectError}</Typography.Text>
								) : null}
								<Button
									type="submit"
									stretched
									loading={connecting}
									disabled={!idInstance.trim() || !apiTokenInstance.trim()}
								>
									Продолжить
								</Button>

								<a style={{alignSelf: 'center'}} href={'https://console.green-api.com/'}
								   target={'_blank'}>Создать инстанс</a>
							</Flex>
						</form>
					) : null}

					{showQr ? (
						<Flex direction="column" gap={12} align="center" className="qr-panel">
							<Typography.Text color="secondary">
								Инстанс не авторизован. Отсканируйте QR в приложении MAX. Код обновляется каждые 5
								секунд.
							</Typography.Text>
							{qr?.type === 'qrCode' ? (
								<img className="qr-image" src={qrImageSrc(qr.message)} alt="QR-код авторизации MAX"/>
							) : (
								<div className="qr-placeholder">
									<Typography.Text color="secondary">
										{qrError || qr?.message || 'Генерация QR…'}
									</Typography.Text>
								</div>
							)}
							{session?.useMocks ? (
								<Button stretched loading={scanning} onClick={() => void onScan()}>
									Имитировать сканирование
								</Button>
							) : null}
							<div>или</div>
							<Button variant={'secondary'} stretched>Войти по номеру телефона</Button>
							<Button variant="ghost" stretched onClick={clearSession}>Другой инстанс</Button>
						</Flex>
					) : null}

					{showPassword ? (
						<form className="auth-form" onSubmit={(event) => void onPassword(event)}>
							<Flex direction="column" gap={12}>
								<Typography.Text color="secondary">
									На аккаунте включён облачный пароль. Отправьте его методом
									SendAuthorizationPassword.
								</Typography.Text>
								{session?.useMocks ? (
									<Typography.Label variant="small-strong" className="auth-note">
										Мок-пароль: {MOCK_CLOUD_PASSWORD}
									</Typography.Label>
								) : null}
								<label className="field">
									<Typography.Label variant="small-strong">Облачный пароль</Typography.Label>
									<Input
										type="password"
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										autoComplete="current-password"
										withClearButton
									/>
								</label>
								<Button
									type="submit"
									stretched
									loading={passwordLoading}
									disabled={!password.trim()}
								>
									Подтвердить
								</Button>
								<Button variant="ghost" stretched type="button" onClick={() => void logoutInstance()}>
									Выйти
								</Button>
							</Flex>
						</form>
					) : null}

					{showStarting ? (
						<Flex direction="column" gap={12} align="center" className="qr-panel">
							<Loader size={28}/>
							<Typography.Text color="secondary">
								Инстанс запускается. Это может занять несколько минут.
							</Typography.Text>
							<Button variant="ghost" stretched onClick={clearSession}>Другой инстанс</Button>
						</Flex>
					) : null}

					{showBlocked ? (
						<Flex direction="column" gap={12} className="qr-panel">
							<Typography.Text color="secondary">
								Аккаунт MAX заблокирован. После выхода инстанс перейдёт в notAuthorized.
							</Typography.Text>
							<Button stretched onClick={() => void logoutInstance()}>Разлогинить</Button>
						</Flex>
					) : null}
				</Flex>
			</Panel>
		</main>
	);
};
