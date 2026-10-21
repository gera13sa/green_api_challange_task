export function normalizeUnix(timestamp: number): number {
	return timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
}

export function formatMessageTime(timestamp: number): string {
	return new Date(normalizeUnix(timestamp)).toLocaleTimeString('ru-RU', {
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function formatChatListTime(timestamp: number): string {
	const date = new Date(normalizeUnix(timestamp));
	const now = new Date();
	if (date.toDateString() === now.toDateString()) {
		return formatMessageTime(timestamp);
	}
	return date.toLocaleDateString('ru-RU', {day: '2-digit', month: 'short'});
}

export function formatDayLabel(timestamp: number): string {
	const date = new Date(normalizeUnix(timestamp));
	const now = new Date();
	if (date.toDateString() === now.toDateString()) {
		return 'Сегодня';
	}
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (date.toDateString() === yesterday.toDateString()) {
		return 'Вчера';
	}
	return date.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'});
}

export function formatPhone(phone: number): string {
	if (!phone) {
		return '';
	}
	const digits = String(phone);
	if (digits.length === 11 && digits.startsWith('7')) {
		return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
	}
	return `+${digits}`;
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
	const letters = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
	return letters || '?';
}

const AVATAR_COLORS = ['#007aff', '#5856d6', '#32ade6', '#0a4f9c', '#5ac8fa', '#1c4e80'];
const AVATAR_GRADIENTS = ['blue', 'purple', 'green', 'orange', 'red'] as const;

export type AvatarGradient = (typeof AVATAR_GRADIENTS)[number];

function hashId(id: string, modulo: number): number {
	let hash = 0;
	for (const char of id) {
		hash = (hash + char.charCodeAt(0)) % modulo;
	}
	return hash;
}

export function avatarColor(id: string): string {
	return AVATAR_COLORS[hashId(id, AVATAR_COLORS.length)] ?? AVATAR_COLORS[0];
}

export function avatarGradient(id: string): AvatarGradient {
	return AVATAR_GRADIENTS[hashId(id, AVATAR_GRADIENTS.length)] ?? 'blue';
}

export function chatKindLabel(type: string): string {
	if (type === 'group') {
		return 'Группа';
	}
	if (type === 'channel') {
		return 'Канал';
	}
	if (type === 'bot') {
		return 'Бот';
	}
	return 'Личный чат';
}
