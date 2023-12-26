const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const objUtil = require('./utils/project-list-obj');
let wvPanel = null;

// Command
const C_showWelcomePage = 'project-page.showWelcomePage';
// Setting
const S_showWelcomePageWhenStartup = 'project-page.showWelcomePageWhenStartup';
const S_welcomePageTitle = 'project-page-welcomePageTitle';
const S_showCategoryIcon = 'project-page-showCategoryIcon';
const S_categoryMaxHeight = 'project-page-categoryMaxHeight';
const S_autoDetectCategory = 'project-page-autoDetectCategory';
const S_categoryProfile = 'project-page-categoryProfile';
// Message Handler
const messageHandler = {
    import: () => {
        // 批量导入项目
        vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Import'
        }).then(value => {
            if (!value) return;
            // 遍历子文件夹
            let target = value[0].fsPath;
            fs.readdir(target, { withFileTypes: true }, (err, files) => {
                if (err) {
                    console.error('读取目录内容失败:', err);
                    return;
                }
                files.forEach(file => {
                    let fullPath = path.join(target, file.name);
                    if (file.isDirectory()) {
                        refreshRecentProject(fullPath);
                    }
                });
                vscode.commands.executeCommand(C_showWelcomePage);
            });
        });
    },
    open: () => {
        // 打开文件夹
        vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Open'
        }).then(value => {
            if (!value) return;
            refreshRecentProject(value[0].path);
            vscode.commands.executeCommand('vscode.openFolder', value[0]);
        });
    },
    openProject: (context, value) => {
        // 打开项目
        refreshRecentProject(value.path, value.category);
        activateProject(value.path, value.category);
    },
    deleteProject: (context, value) => {
        // 删除项目
        deleteProject(value.path, value.category);
        postProjetctList(wvPanel);
    },
    editProject: (context, value) => {
        // 编辑项目类别
        vscode.window.showInputBox({
            placeHolder: '请输入新的项目类别'
        }).then(input => {
            if (!input) return;
            deleteProject(value.path, value.category);
            refreshRecentProject(value.path, input, false);
            postProjetctList(wvPanel);
        });
    },
    updateLogo: (context, value) => {
        // 更新项目类别 Logo
        vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Select',
            title: 'Select ' + value.category + ' Logo',
            filters: {
                [value.category + ' SVG Logo']: ['svg']
            }
        }).then(input => {
            if (input) {
                let logo = input[0].fsPath;
                let dest = path.join(context.extensionPath, 'resources', 'img', 'lang', encodeURIComponent(value.category) + '.svg');
                fs.copyFile(logo, dest, err => {
                    if (err) {
                        console.error(err);
                    }
                });
                postProjetctList(wvPanel);
            }
        })
    },
    requireUpdate: () => {
        // 页面请求更新
        postProjetctList(wvPanel);

        let conf = vscode.workspace.getConfiguration();
        // Update title
        wvPanel.webview.postMessage({
            command: 'titleUpdate',
            value: conf.get(S_welcomePageTitle)
        });
        // Show category icon
        if (!conf.get(S_showCategoryIcon)) {
            wvPanel.webview.postMessage({
                command: 'hideCategoryIcon'
            });
        }
        // Max category height
        wvPanel.webview.postMessage({
            command: 'categoryMaxHeight',
            value: conf.get(S_categoryMaxHeight)
        });
    }
}

/**
 * TODO: Open project with vscode profile
 * @param {String} path 
 * @param {String} category 
 */
function activateProject(path, category) {
    const obj = getCategoryProfileObj();
    let profileName;
    if (category in obj) profileName = obj[category];
    else profileName = category;

    // TODO: [Unimplemented] https://github.com/microsoft/vscode/issues/156173
    vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(path), { profile: profileName });
}

function getCategoryProfileObj() {
    return vscode.workspace.getConfiguration().get(S_categoryProfile);
}

/**
 * 删除指定项目，刷新项目列表对象；
 * 自动清理空类别
 * @param {String} projectPath 
 * @param {String} category 
 */
function deleteProject(projectPath, category) {
    let obj = getProjectListObj();
    let categoryObj = obj.data[category];
    let perv = categoryObj.items[projectPath].perv;
    let next = categoryObj.items[projectPath].next;
    if (perv) obj.data[category].items[perv].next = next;
    if (next) obj.data[category].items[next].perv = perv;
    if (categoryObj.itemHead === projectPath) {
        categoryObj.itemHead = next;
    }
    delete categoryObj.items[projectPath];
    if (categoryObj.itemHead == null) {
        // 删除空类别
        let cPerv = categoryObj.perv;
        let cNext = categoryObj.next;
        if (cPerv) obj.data[cPerv].next = cNext;
        if (cNext) obj.data[cNext].perv = cPerv;
        if (obj.head === category) {
            obj.head = cNext;
        }
        if (obj.tail === category) {
            obj.tail = cPerv;
        }
        delete obj.data[category];
    }
    setProjectListObj(obj);
}

/**
 * 更新最近打开的项目，刷新项目列表对象，在点击项目后调用；
 * 自动添加不存在的类别，将刚刚打开的项目和对应列表提升到最前
 * @param {String} projectPath 
 */
function refreshRecentProject(projectPath, category = null, bringCategoryToHead = true) {
    if (category === null) category = projectCategoryDetect(projectPath);

    let obj = getProjectListObj();
    if (!obj) {
        obj = objUtil.createNewProjectListObj();
    }
    if (!obj.data[category]) {
        obj.data[category] = objUtil.createNewCategoryObj();
        objUtil.addCategoryToTail(obj, category);
    }
    if (!(projectPath in obj.data[category].items)) {
        obj.data[category].items[projectPath] = objUtil.createNewItemObj();
    }

    objUtil.bringItemToCategoryHead(obj.data[category], projectPath);
    if (bringCategoryToHead) objUtil.bringCategoryToHead(obj, category);

    setProjectListObj(obj);
}

/**
 * 根据项目路径，自动判断项目类别
 * @param {String} projectPath 
 */
function projectCategoryDetect(projectPath) {
    const detectObj = vscode.workspace.getConfiguration().get(S_autoDetectCategory);
    for (const key in detectObj) {
        for (const str of detectObj[key]) {
            if (projectPath.indexOf(str) !== -1) return key;
        }
    }
    return 'Untagged';
}

/**
 * 获取特定路径的 HTML 文件内容，并替换其中的资源路径为合法的 VS Code URI
 * @param {vscode.ExtensionContext} context
 * @param {vscode.WebviewPanel} panel
 * @param {string} htmlPath relative path to extension root
 * @returns {string} HTML content
 */
function getWebviewContent(context, panel, htmlPath) {
    const resourcePath = path.join(context.extensionPath, htmlPath);
    let html = fs.readFileSync(resourcePath, 'utf-8');
    html = html.replace(/(href|src)=(['"])(.+?)(['"])/g, (match, $1, $2, $3, $4) => {
        if ($3.startsWith('http')) {
            return match;
        }
        if ($3.indexOf('${') !== -1) {
            let realPath = path.resolve(path.dirname(resourcePath), $3);
            let encodedPath = panel.webview.asWebviewUri(vscode.Uri.file(realPath)).toString();
            encodedPath = encodedPath.substring(0, encodedPath.indexOf('/', 8));
            return $1 + '=' + $2 + encodedPath + realPath + $4;
        }
        return $1 + '=' + $2 + panel.webview.asWebviewUri(vscode.Uri.file(path.resolve(path.dirname(resourcePath), $3))) + $4;
    });
    return html;
}

/**
 * Post projectList object to webview
 * @param {vscode.WebviewPanel} panel 
 */
function postProjetctList(panel) {
    let projectList = getProjectListObj();
    if (projectList) {
        panel.webview.postMessage({
            command: 'projectListUpdate',
            value: projectList
        });
    }
}

function getProjectListObj() {
    const filePath = path.join(process.env.HOME, '.vscode-project-page', 'projectList.json');
    if (fs.existsSync(filePath)) {
        const obj = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return obj;
    } else {
        const obj = objUtil.createNewProjectListObj();
        setProjectListObj(obj);
        return obj;
    }
}

function setProjectListObj(obj) {
    const folderPath = path.join(process.env.HOME, '.vscode-project-page');
    const filePath = path.join(folderPath, 'projectList.json');
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(obj));
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // Register command
    let disposable = vscode.commands.registerCommand(C_showWelcomePage, () => {
        if (wvPanel) {
            wvPanel.dispose();
        }

        let panel = vscode.window.createWebviewPanel(
            'welcomePage',
            'Welcome',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        panel.webview.html = getWebviewContent(context, panel, 'resources/view/welcome.html');

        // Welcome Page Message Handler
        panel.webview.onDidReceiveMessage(
            message => {
                if (messageHandler[message.command]) {
                    messageHandler[message.command](context, message.value);
                }
            },
            undefined, context.subscriptions
        );

        wvPanel = panel;
    });
    context.subscriptions.push(disposable);

    // Startup Action
    if (vscode.workspace.workspaceFolders === undefined &&
        vscode.workspace.getConfiguration().get(S_showWelcomePageWhenStartup)) {
        vscode.commands.executeCommand(C_showWelcomePage);
    }
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
