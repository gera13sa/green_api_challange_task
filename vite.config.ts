import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(() => {
	return {
		plugins: [react()],
		resolve: {
			alias: {
				'@app': path.resolve(__dirname, 'src/app'),
				'@pages': path.resolve(__dirname, 'src/pages'),
				'@assets': path.resolve(__dirname, 'src/assets'),
				'@widgets': path.resolve(__dirname, 'src/widgets'),
				'@entities': path.resolve(__dirname, 'src/entities'),
				'@features': path.resolve(__dirname, 'src/features'),
				'@shared': path.resolve(__dirname, 'src/shared'),
			},
		},
	};
});
