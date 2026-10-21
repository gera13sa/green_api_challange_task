import axios from 'axios';

export function extractErrorMessage(error: unknown): string {
	if (axios.isAxiosError(error)) {
		if (error.response?.status === 429) {
			return 'Превышен лимит запросов';
		}

		const data = error.response?.data;
		if (typeof data === 'string' && data.trim()) {
			return data;
		}

		if (data && typeof data === 'object') {
			const record = data as Record<string, unknown>;
			if (typeof record.message === 'string' && record.message) {
				return record.message;
			}
			if (typeof record.error === 'string' && record.error) {
				return record.error;
			}
		}

		if (error.code === 'ERR_CANCELED') {
			return 'Запрос отменён';
		}

		return error.message || 'Ошибка запроса к MAX API';
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return 'Неизвестная ошибка MAX API';
}
