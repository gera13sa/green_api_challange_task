import {createHttpMaxApi} from './httpClient';
import {createMockMaxApi} from './mockApi';
import type {MaxApi, MaxSession} from './types';

export function createMaxApi(session: MaxSession): MaxApi {
	if (session.useMocks) {
		return createMockMaxApi(session);
	}
	return createHttpMaxApi(session);
}
