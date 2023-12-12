import {
	App,
	Editor,
	FuzzySuggestModal,
	MarkdownFileInfo,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from 'obsidian';

interface MyPluginSettings {
	regexp: string;
	presetTasks: string;
	maxTimeInMinutes: number;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	regexp: '`tt .*`',
	presetTasks: '',
	maxTimeInMinutes: 480
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
			return infos.reduce((accumulator, object) => {
				return accumulator + object.time;
			}, 0)
		}

		const setMinutesTuStatusBar = function (text: string) {
			const sum = calculateMinutes(text)
			let max = plugin.settings.maxTimeInMinutes
			let dif = max - sum

			let resultText: string = ''
			if (sum === max) {
				resultText = `Minutes on file: '${sum}'`
			} else {
				resultText = `Minutes on file: '${sum}'. M: '${max}'. D: '${dif}'`
			}

			statusBarItemEl.setText(resultText);
		}

		statusBarItemEl.onClickEvent((ev) => {
			const value = this.app.workspace.activeEditor?.editor?.getValue()
			if (value) {
				const info = this.getTimeTrackerTemplateInfo(value);
				const text = this.getTimeTrackerTemplate(info);

				new TemplateModal(this.app, text).open();
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

		this.addCommand({
			id: 'open-preset-tasks-modal-command',
			name: 'Open preset tasks for time tracker template',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new PresetTasksModal(this.app, this.getPresetTasks()).open();
			}
		});

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

	getPresetTasks(): Array<PresetTask> {
		const tasks = this.settings.presetTasks.split("\n").map(v => {
			const array = v.split("___")
			if (array.length == 2) {
				const presetTask: PresetTask = {
					id: array[0],
					name: array[1],
				}

				return presetTask
			} else {
				return undefined
			}
		})

		return tasks.filter((item): item is PresetTask => !!item) ?? []
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

			let minutesAsInt = parseInt(minutes)
			if (isNaN(minutesAsInt)) {
				minutesAsInt = 0
			}

			const timeTrackerTemplateInfo: TimeTrackerTemplateInfo = {
				id: jiraId,
				time: minutesAsInt,
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

class TemplateModal extends Modal {
	private readonly text: string;

	constructor(app: App, text: string) {
		super(app);
		this.text = text;
	}

	onOpen() {
		const {contentEl} = this;

		const div = contentEl.createEl("div")
		div.style.height = "100%"

		const textareaDiv = div.createEl("div")
		textareaDiv.style.width = "100%"
		textareaDiv.style.height = "25vh"

		const textarea = textareaDiv.createEl("textarea", {text: this.text})
		textarea.style.width = "100%"
		textarea.style.height = "100%"
		textarea.style.fontFamily = "Courier New"

		const buttonDiv = div.createEl("div")
		buttonDiv.createEl("button", {text: 'Copy to clipboard',}).onClickEvent(() => {
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

interface PresetTask {
	id: string,
	name: string
}

export class PresetTasksModal extends FuzzySuggestModal<PresetTask> {
	private readonly tasks: Array<PresetTask>

	constructor(app: App, tasks: Array<PresetTask>) {
		super(app);
		this.tasks = tasks;
	}

	getItems(): PresetTask[] {
		return this.tasks;
	}

	getItemText(task: PresetTask): string {
		return task.name;
	}

	onChooseItem(task: PresetTask, evt: MouseEvent | KeyboardEvent) {
		const editor = this.app.workspace.activeEditor?.editor;
		new Notice(`Selected ${task.name}`);
		if (editor) {
			editor.replaceSelection(task.id);
		}
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

		new Setting(containerEl)
			.setName('Preset tasks for quick selection')
			.setDesc('Format: Task ID___Title')
			.addTextArea(text => text
				.setValue(this.plugin.settings.presetTasks)
				.onChange(async (value) => {
					this.plugin.settings.presetTasks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maximum time in minutes')
			.setDesc('Used to calculate the time remaining for depositing')
			.addText(text => text
				.setValue(this.plugin.settings.maxTimeInMinutes.toString())
				.onChange(async (value) => {
					this.plugin.settings.maxTimeInMinutes = parseInt(value);
					await this.plugin.saveSettings();
				}));
	}
}
