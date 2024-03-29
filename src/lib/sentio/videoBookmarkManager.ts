import OptionsManager from './options/optionsManager';
import VideoBookmark, { VideoData } from './videoBookmark';

export default class VideoBookmarkManager {
	private _data: Map<string, VideoBookmark>;

	constructor(private _options: OptionsManager) {
		// initialize
		this._data = new Map();

		this.load();
	}

	/**
	 * Create a new VideoBookmark.
	 *
	 * ***The VideoBookmarks are unique by their src-attribute!***
	 * @param videoData The video data, the VideoBookmark is created on.
	 */
	async create(videoData: VideoData) {
		if (!videoData) return;

		if (
			this._options.get('video-manage-browser-bookmark') &&
			(await browser.permissions.contains({
				permissions: ['bookmarks'],
			}))
		) {
			videoData.browserBookmarkId = (
				await browser.bookmarks.create({
					url: videoData.baseUrl,
					type: 'bookmark',
					title: this._options
						.get('video-browser-bookmark-base')
						.replace(/\$title/gi, videoData.title ?? ''),
					parentId: (await this.getBrowserBookmarkParent())?.id,
				})
			).id;
		}

		this.set(new VideoBookmark(videoData));
	}
	/**
	 * Delete a VideoBookmark by its src-attribute.
	 * @param src The src-attribute of the VideoBookmark to delete.
	 */
	async delete(src: string) {
		const videoBookmark = this._data.get?.(src);
		if (
			videoBookmark?.browserBookmarkId &&
			(await browser.permissions.contains({
				permissions: ['bookmarks'],
			}))
		)
			browser.bookmarks.remove(videoBookmark.browserBookmarkId).catch();

		this._data.delete?.(src);

		this.save();
	}
	/**
	 * Deletes all VideoBookmarks.
	 * @returns A Promise, resolving when all VideoBookmarks are deleted.
	 */
	deleteAll() {
		const p: Promise<void>[] = [];
		this._data.forEach(videoBookmark =>
			p.push(this.delete(videoBookmark.src))
		);
		return Promise.allSettled(p);
	}
	/** Toggles the video-bookmark: Deletes the video-bookmark if present, creates if not. */
	toggle(video: VideoData) {
		if (this.isBookmark(video))
			return this.delete(this.getGuessedSrc(video));
		return this.create(video);
	}
	/**
	 * Updates a given VideoBookmark
	 * @param videoBookmark
	 * @returns Whether or not the VideoBookmark was present && updated.
	 */
	async update(videoBookmark: VideoBookmark): Promise<boolean> {
		if (
			!this._data.has(videoBookmark.src) ||
			this._data.get(videoBookmark.src)?.duration !==
				videoBookmark.duration
		)
			return false;

		if (
			!videoBookmark.browserBookmarkId &&
			this._data.get(videoBookmark.src)?.browserBookmarkId
		)
			videoBookmark.browserBookmarkId = this._data.get(
				videoBookmark.src
			)?.browserBookmarkId;

		this.set(videoBookmark);

		if (
			videoBookmark.browserBookmarkId &&
			(await browser.permissions.contains({ permissions: ['bookmarks'] }))
		)
			browser.bookmarks.update(videoBookmark.browserBookmarkId, {
				title: this._options
					.get('video-browser-bookmark-base')
					.replace(/\$title/gi, videoBookmark.title ?? ''),
				url: videoBookmark.baseUrl,
			});

		// delete if wished && activated
		if (
			this._options.get('video-auto-delete') &&
			(videoBookmark.duration === videoBookmark.timestamp ||
				// check for the auto-delete time
				(videoBookmark.timestamp >=
					videoBookmark.duration -
						this._options.get('video-auto-delete-time') &&
					// && only if the vid is long enough
					videoBookmark.duration >
						this._options.get('video-auto-delete-time')))
		)
			this.delete(videoBookmark.src);

		return true;
	}
	private set(videoBookmark: VideoBookmark) {
		this._data.set(videoBookmark.src, videoBookmark);

		this.save();
	}
	has(src: string): boolean {
		return this._data.has(src);
	}
	get(src: string) {
		return this._data.get(src);
	}

	/** Query the VideoBookmarks */
	query(q: Partial<VideoData>): VideoBookmark[] {
		const qEntries = Object.entries(q);

		return [...this._data.values()]
			.filter(vidBookmark => {
				let failed = false;
				qEntries.forEach(entry => {
					if (
						vidBookmark.export()[entry[0] as keyof VideoData] !==
						entry[1]
					) {
						failed = true;
					}
				});
				return !failed;
			})
			.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
	}

	/** Determines whether the provided data is detected as a video-bookmark */
	isBookmark(video: VideoData) {
		if (this.has(video.src)) return true;
		if (
			this._options.get('video-enable-guessing') &&
			this.query({ duration: video.duration, baseUrl: video.baseUrl })
				.length >= 1
		)
			return true;

		return false;
	}

	getGuessedSrc(video: VideoData): string {
		if (
			!this._options.get('video-enable-guessing') ||
			!this.isBookmark(video)
		)
			return '';

		return this.query({
			duration: video.duration,
			baseUrl: video.baseUrl,
		})?.[0]?.src;
	}

	/**
	 * Export the video-bookmarks
	 */
	export(): VideoData[] {
		return [...this._data.values()].map(x => x.export());
	}
	/**
	 * Imports data to the VideoData
	 * @param arr The array of objects to import
	 * @param {boolean} [clear=true] Determines whether all bookmarks should be cleared first or not. Default `true`
	 */
	import(arr: VideoBookmark[], clear?: boolean): void;
	/**
	 * Imports data to the VideoData
	 * @param arr The array of objects to import
	 * @param {boolean} [clear=true] Determines whether all bookmarks should be cleared first or not. Default `true`
	 */
	import(arr: VideoData[], clear?: boolean): void;
	import(arr: (VideoBookmark | VideoData)[], clear = true): void {
		if (clear) this._data.clear();

		arr?.forEach?.(x =>
			this.set(x instanceof VideoBookmark ? x : new VideoBookmark(x))
		);
	}

	/**
	 * Saves the videobookmark-data to the local extension storage.
	 *
	 * Should be called after each modification.
	 */
	async save(): Promise<void> {
		await browser.storage.local.set({ data: this.export() });
	}
	/** Loads the videobookmark-data from the local extension storage and tries to import the data */
	async load(): Promise<void> {
		try {
			this.import((await browser.storage.local.get('data'))?.['data']);
		} catch (error) {
			// console.error(error);
		}
	}
	/** Clears the extion´s data (VideoBookmark) storage */
	async clear() {
		this._data.clear();
		return browser.storage.local.remove('data');
	}

	private async getBrowserBookmarkParent() {
		if (
			!(await browser.permissions.contains({
				permissions: ['bookmarks'],
			}))
		)
			throw 'Missing Permissions!';

		return (
			(
				await browser.bookmarks.search({
					title: this._options.get(
						'video-browser-bookmark-folder-name'
					),
				})
			)?.filter(x => x.type === 'folder')?.[0] ??
			// create the folder if not available
			(await browser.bookmarks.create({
				title: this._options.get('video-browser-bookmark-folder-name'),
				type: 'folder',
			}))
		);
	}
}
