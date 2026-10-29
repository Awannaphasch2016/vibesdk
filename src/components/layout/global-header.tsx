import { useEffect, useState } from 'react';
import { SidebarTrigger, cn, useSidebar } from '@cloudflare/kumo';
import { useAuth } from '@/contexts/auth-context';
import { ChevronRight, AlertCircle } from 'lucide-react';
import { SignInIcon } from '@phosphor-icons/react';
import { usePlatformStatus } from '@/hooks/use-platform-status';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OrangeButton } from '@/components/shared/OrangeButton';

import { useHeaderContent } from './header-context';

async function sharedClerkPublishableKey(): Promise<string | null> {
	const keyResponse = await fetch('/api/auth/clerk', { credentials: 'include' });
	if (!keyResponse.ok) return null;
	const body = await keyResponse.json();
	const publishableKey = body.data?.publishableKey;
	if (typeof publishableKey !== 'string' || !publishableKey.startsWith('pk_test_')) {
		return null;
	}
	return publishableKey;
}

async function sharedClerkToken(): Promise<string | null> {
	try {
		const publishableKey = await sharedClerkPublishableKey();
		if (!publishableKey) return null;
		const frontendApi = atob(publishableKey.slice('pk_test_'.length)).replace(/\$$/, '');
		const browserWindow = window as Window & {
			Clerk?: {
				load: (options: { publishableKey: string }) => Promise<void>;
				session?: { getToken: () => Promise<string | null> } | null;
			};
		};
		if (!browserWindow.Clerk) {
			await new Promise<void>((resolve, reject) => {
				const script = document.createElement('script');
				script.async = true;
				script.crossOrigin = 'anonymous';
				script.src = `https://${frontendApi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
				script.setAttribute('data-clerk-publishable-key', publishableKey);
				script.onload = () => resolve();
				script.onerror = () => reject(new Error('Sign in is not available.'));
				document.head.appendChild(script);
			});
		}
		const clerk = browserWindow.Clerk;
		if (!clerk) return null;
		await clerk.load({ publishableKey });
		return (await clerk.session?.getToken()) ?? null;
	} catch {
		return null;
	}
}

async function startSharedSignIn(): Promise<void> {
	const publishableKey = await sharedClerkPublishableKey();
	if (!publishableKey) return;
	const token = await sharedClerkToken();
	if (token) {
		window.location.reload();
		return;
	}
	const clerk = (window as Window & {
		Clerk?: {
			redirectToSignIn?: (options: {
				redirectUrl: string;
				signInForceRedirectUrl: string;
				signInFallbackRedirectUrl: string;
			}) => Promise<unknown>;
		};
	}).Clerk;
	const back = window.location.href;
	if (!clerk?.redirectToSignIn) return;
	sessionStorage.setItem('vibesdk-shared-pending', '1');
	await clerk.redirectToSignIn({
		redirectUrl: back,
		signInForceRedirectUrl: back,
		signInFallbackRedirectUrl: back,
	});
}
export function GlobalHeader() {
	const { user, isLoading: authLoading } = useAuth();

	const { isMobile } = useSidebar();
	const { content } = useHeaderContent();
	const { status } = usePlatformStatus();
	const [isChangelogOpen, setIsChangelogOpen] = useState(false);
	const hasMaintenanceMessage = Boolean(
		status.hasActiveMessage && status.globalUserMessage.trim().length > 0,
	);
	const hasChangeLogs = Boolean(
		status.changeLogs && status.changeLogs.trim().length > 0,
	);
	const hasPageContent = Boolean(content?.leading || content?.trailing);

	useEffect(() => {
		if (!hasChangeLogs) {
			setIsChangelogOpen(false);
		}
	}, [hasChangeLogs]);

	return (
		<>
			<header className={cn('sticky top-0 z-10')}>
				<div className="relative flex h-12 items-center gap-2 border-b border-kumo-line pl-2 pr-3 md:gap-3 md:px-4">
					{isMobile ? (
						<SidebarTrigger
							aria-label="Toggle sidebar"
							className="shrink-0"
						/>
					) : null}

					<div className="min-w-0 flex-1 flex items-center gap-2">
						{content?.leading ??
							(!hasPageContent && hasMaintenanceMessage && (
								<button
									type="button"
									onClick={
										hasChangeLogs
											? () => setIsChangelogOpen(true)
											: undefined
									}
									disabled={!hasChangeLogs}
									className={`flex max-w-full items-center gap-2 rounded-full border border-brand/40 bg-bg-4/80 px-3 py-1.5 text-xs text-text-primary shadow-sm backdrop-blur hover:bg-brand/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-brand/30 dark:bg-kumo-elevated/80 md:text-sm${!hasChangeLogs ? ' opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
									aria-label="Platform updates"
								>
									<AlertCircle className="h-4 w-4 text-kumo-brand" />
									<span className="truncate max-w-[46ch] md:max-w-[60ch]">
										{status.globalUserMessage}
									</span>
									<ChevronRight className="ml-1 h-4 w-4 text-kumo-brand" />
								</button>
							))}
					</div>

					<div className="flex items-center justify-end gap-1.5 shrink-0">
						{content?.trailing}
						{!authLoading && !user && (
							<OrangeButton
								size="sm"
								onClick={() => {
								void startSharedSignIn();
							}}
								icon={<SignInIcon className="size-4" />}
							>
								Sign In
							</OrangeButton>
						)}
					</div>
				</div>
			</header>

			<Dialog open={isChangelogOpen} onOpenChange={setIsChangelogOpen}>
				{hasChangeLogs && (
					<DialogContent className="max-w-xl">
						<DialogHeader>
							<DialogTitle>Platform updates</DialogTitle>
							{status.globalUserMessage && (
								<DialogDescription className="text-sm text-muted-foreground">
									{status.globalUserMessage}
								</DialogDescription>
							)}
						</DialogHeader>
						<ScrollArea className="max-h-[60vh] pr-4">
							<p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
								{status.changeLogs}
							</p>
						</ScrollArea>
					</DialogContent>
				)}
			</Dialog>
		</>
	);
}
