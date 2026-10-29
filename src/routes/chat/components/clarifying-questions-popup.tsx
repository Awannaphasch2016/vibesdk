import type { ClarifyingQuestion } from '../utils/message-helpers';

export type QuestionAnswer = {
	question: string;
	selected: string[];
	custom: string;
};

interface ClarifyingQuestionsPopupProps {
	questions: ClarifyingQuestion[];
	open: boolean;
	onSubmit: (answers: QuestionAnswer[]) => void;
	onDismiss?: () => void;
}

export function ClarifyingQuestionsPopup(_props: ClarifyingQuestionsPopupProps) {
	return null;
}
