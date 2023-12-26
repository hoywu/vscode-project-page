// const vscode = require('vscode');
const welcomePageModule = require('./src/welcome-page');

function activate(context) {
	welcomePageModule.activate(context);
}

function deactivate() {
	welcomePageModule.deactivate();
}

module.exports = {
	activate,
	deactivate
}
