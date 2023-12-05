import {App, Editor, MarkdownFileInfo, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';

interface MyPluginSettings {
	regexp: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	regexp: '`tt .*`'
}

interface TimeTrackerTemplateInfo {
	id: string;
	time: number;
	text: string;
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		const plugin = this;

		const statusBarItemEl = this.addStatusBarItem();

		const calculateMinutes = function (text: string) {
			const infos = plugin.getTimeTrackerTemplateInfo(text)
			const sum = infos.reduce((accumulator, object) => {
				return accumulator + object.time;
			}, 0)

			return sum
		}

		const setMinutesTuStatusBar = function (text: string) {
			const sum = calculateMinutes(text)

			statusBarItemEl.setText(`Minutes on file: '${sum}'`);
		}

		statusBarItemEl.onClickEvent((ev) => {
			const value = this.app.workspace.activeEditor?.editor?.getValue()
			if (value) {
				const info = this.getTimeTrackerTemplateInfo(value);
				const text = this.getTimeTrackerTemplate(info);

				new SampleModal(this.app, text).open();
			}
		})

		const onFileOpenEvent = () => {
			if (this.app.workspace.activeEditor) {
				const text = this.app.workspace.activeEditor?.editor?.getValue()
				if (text) {
					setMinutesTuStatusBar(text)
				}
			}
		};

		const onEditorChangeEvent = (editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
			if (info instanceof MarkdownView) {
				const text = info.editor.getValue()
				setMinutesTuStatusBar(text)
			}
		}

		this.registerEvent(
			this.app.workspace.on('file-open', onFileOpenEvent)
		);

		this.registerEvent(
			this.app.workspace.on('editor-change', onEditorChangeEvent)
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getTimeTrackerTemplateInfo(inputText: string): Array<TimeTrackerTemplateInfo> {
		const regex = new RegExp(this.settings.regexp, "g");
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll
		const collection = [...inputText.matchAll(regex)].flat();

		return collection.map((v) => {
			const array = v.split(" ")
			const jiraId = array[1]
			const minutes = array[2]

			let textTemp = array.slice(3, array.length).join(" ")
			textTemp = textTemp.substring(0, textTemp.length - 1)
			let text = textTemp

			const timeTrackerTemplateInfo: TimeTrackerTemplateInfo = {
				id: jiraId,
				time: parseInt(minutes),
				text: text,
			}

			return timeTrackerTemplateInfo
		}) ?? []
	}

	getTimeTrackerTemplate(info: Array<TimeTrackerTemplateInfo>): string {
		return info
			.map((value) => {
				return `${value.id}__${value.time}_${value.text}`
			})
			.join("\n")
	}
}

class SampleModal extends Modal {
	private readonly text: string;

	constructor(app: App, text: string) {
		super(app);
		this.text = text;
	}

	onOpen() {
		const {contentEl} = this;

		const div = contentEl.createEl("div")
		div.createEl("pre", {text: this.text})

		div.createEl("button", {text: 'Copy to clipboard',}).onClickEvent(() => {
			this.copyPathToClipboard(this.text)
		})
	}


	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}

	copyPathToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			new Notice("Template copied to clipboard");
		});
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Search regexp')
			.setDesc('Search regexp')
			.addText(text => text
				.setPlaceholder('Regexp')
				.setValue(this.plugin.settings.regexp)
				.onChange(async (value) => {
					this.plugin.settings.regexp = value;
					await this.plugin.saveSettings();
				}));
	}
}
