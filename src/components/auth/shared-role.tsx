import { useEffect, useState } from 'react';

export function SharedRole() {
	const [label, setLabel] = useState('');
	useEffect(() => {
		setLabel(sessionStorage.getItem('vibesdk-shared-role') ?? '');
	}, []);
	if (!label) return null;
	return <span className="block text-xs text-kumo-subtle">{label}</span>;
}
