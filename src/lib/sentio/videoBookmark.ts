export interface VideoData {
	title?: string;
	timestamp: number;
	duration: number;
	baseUrl: string;
	src: string;
}
export default class VideoBookmark {
	private _data: VideoData;

	constructor(data: VideoData) {
		this._data = { ...data };

		// fix not allowed floats while editing
		// should be precise enough ;)
		this._data.duration = Math.round(this._data.duration);
		this._data.timestamp = Math.round(this._data.timestamp);
	}

	get title() {
		return this._data.title;
	}
	get src() {
		return this._data.src;
	}
	get baseUrl() {
		return this._data.baseUrl;
	}
	get timestamp() {
		return this._data.timestamp;
	}
	get duration() {
		return this._data.duration;
	}

	export(): VideoData {
		return {
			title: this.title,
			baseUrl: this.baseUrl,
			src: this.src,
			timestamp: this.timestamp,
			duration: this.duration,
		};
	}
}
