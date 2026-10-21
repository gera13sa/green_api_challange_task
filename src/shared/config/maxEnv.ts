import type {MaxSession} from '@shared/api/max';

function flag(value: string | undefined, fallback: boolean): boolean {
	if (!value || !value.trim()) {
		return fallback;
	}
	return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

export function readMaxEnvDefaults(): Pick<MaxSession, 'apiUrl' | 'idInstance' | 'apiTokenInstance' | 'useMocks' | 'requirePassword'> {
	return {
		apiUrl: (import.meta.env.VITE_MAX_API_URL?.trim() || 'https://3100.api.green-api.com').replace(/\/+$/, ''),
		idInstance: import.meta.env.VITE_MAX_ID_INSTANCE?.trim() ?? '',
		apiTokenInstance: import.meta.env.VITE_MAX_API_TOKEN_INSTANCE?.trim() ?? '',
		useMocks: flag(import.meta.env.VITE_MAX_USE_MOCKS, true),
		requirePassword: flag(import.meta.env.VITE_MAX_REQUIRE_PASSWORD, false),
	};
}
