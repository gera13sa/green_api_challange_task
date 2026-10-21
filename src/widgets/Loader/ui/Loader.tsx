import {type FC} from 'react';
import {Spinner} from '@maxhub/max-ui';

import '../style/style.css';

interface LoaderProps {
	size?: number;
	isModal?: boolean;
}

export const Loader: FC<LoaderProps> = ({
	size = 40,
	isModal = false,
}) => {
	const spinner = <Spinner size={size} appearance="themed" />;

	if (isModal) {
		return (
			<div className="loader-modal-overlay">
				<div className="loader-modal-box">
					{spinner}
				</div>
			</div>
		);
	}

	return (
		<div className="spinner-loader-container">
			{spinner}
		</div>
	);
};
