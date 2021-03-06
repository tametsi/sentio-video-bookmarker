import Sentio from '../lib/sentio/sentio';
import events from './events';
import { BrowserRuntimeBackgroundEventData } from '../types';

// browser.runtime.onStartup.addListener(async () => {
// });

(function () {
	window.sentio = new Sentio();
})();

// content-script-message => LINK src/background/events/index.ts
browser.runtime.onMessage.addListener(
	(msg: BrowserRuntimeBackgroundEventData, sender, res) => {
		events
			.filter(event => event.name === msg[0])
			.forEach(event =>
				event.execute(sender, res, window.sentio, ...msg.slice(1))
			);
	}
);

browser.windows.onFocusChanged.addListener(async () => {
	// window-focus changed
	const activeTab = await getActiveTab();
	sendTabInfo(activeTab.id ?? 0, activeTab?.url);
});
browser.tabs.onActivated.addListener(async info => {
	// tab-focus changed
	const activeTab = await getActiveTab();

	if (activeTab.id !== info.tabId) return;

	sendTabInfo(info.tabId, activeTab.url);
});
browser.tabs.onUpdated.addListener(async (tabId, change) => {
	// tab updated
	const activeTabId = (await getActiveTab())?.id;

	if (activeTabId !== tabId || !change.url) return;

	sendTabInfo(activeTabId, change.url);
});

/** @returns The active tab in the current window */
async function getActiveTab() {
	return (
		await browser.tabs.query({
			active: true,
			currentWindow: true,
		})
	)?.[0];
}

function sendTabInfo(tabId: number, url?: string) {
	window.sentio?.activePage.setActiveTab(tabId, url);
}
