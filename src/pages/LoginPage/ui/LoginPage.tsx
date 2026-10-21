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
	MOCK_SMS_CODE,
	type QrResponse,
} from '@shared/api/max';
import {readMaxEnvDefaults} from '@shared/config/maxEnv.ts';
import {useDocumentTitle} from '@shared/hooks/useDocumentTitle.ts';

import '../styles/style.css';

type AuthMode = 'qr' | 'phone' | 'code';

const PASSWORD_REASONS: Record<string, string> = {
	invalid_password: 'Неверный пароль',
	rate_limit_exceeded: 'Слишком много попыток, попробуйте позже',
	authorization_not_started: 'Сначала получите QR-код',
	timeout: 'Время ожидания пароля истекло',
	already_registered: 'Инстанс уже авторизован',
	attempts_exceeded: 'Превышено число попыток',
	time_limit_expired_logout: 'Время ввода пароля истекло',
};

const AUTH_FLOW_REASONS: Record<string, string> = {
	invalid_phone_number: 'Некорректный номер телефона',
	invalid_code: 'Неверный код из SMS',
	rate_limit_exceeded: 'Слишком много попыток, попробуйте позже',
	authorization_not_started: 'Сначала запросите код по номеру телефона',
	already_registered: 'Инстанс уже авторизован',
	attempts_exceeded: 'Превышено число попыток',
	timeout: 'Время ожидания истекло',
};

function passwordReason(reason: string): string {
	return PASSWORD_REASONS[reason] || reason || 'Не удалось подтвердить пароль';
}

function authFlowReason(reason: string): string {
	return AUTH_FLOW_REASONS[reason] || reason || 'Не удалось выполнить авторизацию';
}

function isAuthFlowSuccess(status: string): boolean {
	return status === 'success' || status === 'succes';
}

function qrImageSrc(message: string): string {
	const trimmed = message.trim();
	if (trimmed.startsWith('data:')) {
		return trimmed;
	}
	return `data:image/png;base64,${trimmed}`;
}

function normalizePhoneDigits(value: string): string {
	return value.replace(/\D/g, '');
}

function parsePhoneNumber(value: string): number | null {
	const digits = normalizePhoneDigits(value);
	if (!/^7\d{10}$/.test(digits) && !/^375\d{9}$/.test(digits)) {
		return null;
	}
	return Number(digits);
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
	const [authMode, setAuthMode] = useState<AuthMode>('qr');
	const [phone, setPhone] = useState('');
	const [smsCode, setSmsCode] = useState('');
	const [phoneLoading, setPhoneLoading] = useState(false);
	const [codeLoading, setCodeLoading] = useState(false);


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
		if (!api || stateInstance !== 'notAuthorized' || authMode !== 'qr') {
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
	}, [api, stateInstance, refreshState, authMode]);

	useEffect(() => {
		if (stateInstance !== 'notAuthorized') {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setAuthMode('qr');
			setPhone('');
			setSmsCode('');
		}
	}, [stateInstance]);

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

	const onStartPhoneAuth = async (event: FormEvent) => {
		event.preventDefault();
		if (!api) {
			return;
		}
		const phoneNumber = parsePhoneNumber(phone);
		if (phoneNumber == null) {
			toast.error('Введите номер в формате 79XXXXXXXXX или 375XXXXXXXXX');
			return;
		}
		setPhoneLoading(true);
		try {
			const response = await api.startAuthorization(phoneNumber);
			if (!response.status || !isAuthFlowSuccess(response.data.status)) {
				toast.error(authFlowReason(response.data.reason));
				return;
			}
			setSmsCode('');
			setAuthMode('code');
			toast.success('Код отправлен в SMS');
		} catch (error: unknown) {
			toast.error(extractErrorMessage(error));
		} finally {
			setPhoneLoading(false);
		}
	};

	const onSendCode = async (event: FormEvent) => {
		event.preventDefault();
		if (!api) {
			return;
		}
		const code = smsCode.trim();
		if (!code) {
			toast.error('Введите код из SMS');
			return;
		}
		setCodeLoading(true);
		try {
			const response = await api.sendAuthorizationCode(code);
			if (!response.status || !isAuthFlowSuccess(response.data.status)) {
				toast.error(authFlowReason(response.data.reason));
				return;
			}
			await refreshState();
		} catch (error: unknown) {
			toast.error(extractErrorMessage(error));
		} finally {
			setCodeLoading(false);
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

	const backToQr = () => {
		setAuthMode('qr');
		setSmsCode('');
	};

	const showCredentials = !session || stateInstance === null;
	const showQr = stateInstance === 'notAuthorized' && authMode === 'qr';
	const showPhone = stateInstance === 'notAuthorized' && authMode === 'phone';
	const showCode = stateInstance === 'notAuthorized' && authMode === 'code';
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
							<Button
								variant="secondary"
								stretched
								onClick={() => setAuthMode('phone')}
							>
								Войти по номеру телефона
							</Button>
							<Button variant="ghost" stretched onClick={clearSession}>Другой инстанс</Button>
						</Flex>
					) : null}

					{showPhone ? (
						<form className="auth-form" onSubmit={(event) => void onStartPhoneAuth(event)}>
							<Flex direction="column" gap={12}>
								<Typography.Text color="secondary">
									Введите номер телефона без «+». Метод StartAuthorization отправит SMS с кодом.
								</Typography.Text>
								<label className="field">
									<Typography.Label variant="small-strong">Номер телефона</Typography.Label>
									<Input
										value={phone}
										inputMode="tel"
										autoComplete="tel"
										placeholder="79001234567"
										onChange={(event) => setPhone(event.target.value)}
										withClearButton
									/>
								</label>
								<Button
									type="submit"
									stretched
									loading={phoneLoading}
									disabled={!normalizePhoneDigits(phone)}
								>
									Получить код
								</Button>
								<Button variant="ghost" stretched type="button" onClick={backToQr}>
									Назад к QR
								</Button>
							</Flex>
						</form>
					) : null}

					{showCode ? (
						<form className="auth-form" onSubmit={(event) => void onSendCode(event)}>
							<Flex direction="column" gap={12}>
								<Typography.Text color="secondary">
									Введите код из SMS. Он будет отправлен методом SendAuthorizationCode.
								</Typography.Text>
								{session?.useMocks ? (
									<Typography.Label variant="small-strong" className="auth-note">
										Мок-код: {MOCK_SMS_CODE}
									</Typography.Label>
								) : null}
								<label className="field">
									<Typography.Label variant="small-strong">Код из SMS</Typography.Label>
									<Input
										value={smsCode}
										inputMode="numeric"
										autoComplete="one-time-code"
										placeholder="123456"
										onChange={(event) => setSmsCode(event.target.value)}
										withClearButton
									/>
								</label>
								<Button
									type="submit"
									stretched
									loading={codeLoading}
									disabled={!smsCode.trim()}
								>
									Подтвердить код
								</Button>
								<Button
									variant="ghost"
									stretched
									type="button"
									onClick={() => setAuthMode('phone')}
								>
									Изменить номер
								</Button>
								<Button variant="ghost" stretched type="button" onClick={backToQr}>
									Назад к QR
								</Button>
							</Flex>
						</form>
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
