const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const objUtil = require('./utils/project-list-obj');
const wsStorageUtil = require('./utils/ws-storage');
const dbUtil = require('./utils/vscdb');
let wvPanel = null;

// Command
const C_showWelcomePage = 'project-page.showWelcomePage';
// Setting
const S_showWelcomePageWhenStartup = 'project-page.showWelcomePageWhenStartup';
const S_welcomePageTitle = 'project-page-welcomePageTitle';
const S_showCategoryIcon = 'project-page-showCategoryIcon';
const S_categoryPlugins = 'project-page-categoryPlugins';
// Category Plugins
const getCategoryPlugins = () => {
    return vscode.workspace.getConfiguration().get(S_categoryPlugins);
};
// Message Handler
const messageHandler = {
    import: (context) => {
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
                        refreshRecentProject(context, fullPath);
                    }
                });
                vscode.commands.executeCommand(C_showWelcomePage);
            });
        });
    },
    open: (context) => {
        // 打开文件夹
        vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Open'
        }).then(value => {
            if (!value) return;
            refreshRecentProject(context, value[0].path);
            vscode.commands.executeCommand('vscode.openFolder', value[0]);
        });
    },
    openProject: (context, value) => {
        // 打开项目
        refreshRecentProject(context, value.path, value.category);
        // activateCategory(value.path, value.category); // deprecated
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(value.path));
    },
    deleteProject: (context, value) => {
        // 删除项目
        deleteProject(context, value.path, value.category);
        postProjetctList(context, wvPanel);
    },
    editProject: (context, value) => {
        // 编辑项目类别
        vscode.window.showInputBox({
            placeHolder: '请输入新的项目类别'
        }).then(input => {
            if (!input) return;
            deleteProject(context, value.path, value.category);
            refreshRecentProject(context, value.path, input, false);
            postProjetctList(context, wvPanel);
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
                let dest = path.join(context.extensionPath, 'resources', 'img', 'lang', value.category + '.svg');
                fs.copyFile(logo, dest, err => {
                    if (err) {
                        console.error(err);
                    }
                });
                vscode.commands.executeCommand(C_showWelcomePage);
            }
        })
    },
}

/**
 * @deprecated 激活指定类别的插件
 * @param {String} projectPath 
 * @param {String} category 
 */
function activateCategory(projectPath, category) {
    if (category && getCategoryPlugins()[category]) {
        updateDBToEnablePlugins(projectPath, category);
    }
}

/**
 * @deprecated 更新数据库启用插件，已弃用 https://github.com/microsoft/vscode/issues/151985
 * @param {String} projectPath 
 * @param {String} category 
 */
async function updateDBToEnablePlugins(projectPath, category) {
    let wsDbPath = path.join(wsStorageUtil.getWorkspaceStoragePath(projectPath), 'state.vscdb');
    if (fs.existsSync(wsDbPath)) {
        let globalPlugins = await dbUtil.getGlobalDisabledPlugins();
        let workspacePlugins = await dbUtil.getWorkspaceEnabledPlugins(wsDbPath);
        let globalPluginsMap = {};
        for (const plugin of globalPlugins) {
            globalPluginsMap[plugin.id] = plugin.uuid;
        }
        let workspacePluginsMap = {};
        for (const plugin of workspacePlugins) {
            workspacePluginsMap[plugin.id] = plugin.uuid;
        }
        let needPluginsID = [];

        // find plugins that need to be enabled
        console.log(getCategoryPlugins()[category]);
        for (const pluginID of getCategoryPlugins()[category]) {
            if (!(pluginID in workspacePluginsMap)) {
                needPluginsID.push(pluginID);
            }
        }

        console.log("globalPlugins", globalPlugins)
        console.log("workspacePlugins", workspacePlugins)

        if (needPluginsID.length > 0) {
            // construct new enabled plugins object
            let obj = [...workspacePlugins];
            for (const pluginID of needPluginsID) {
                if (!(pluginID in globalPluginsMap)) continue;
                obj.push({
                    id: pluginID,
                    uuid: globalPluginsMap[pluginID],
                });
            }

            // save to db
            let result = await dbUtil.setWorkspaceEnabledPlugins(wsDbPath, obj);
            console.log(result);
        }
    }
}

/**
 * 删除指定项目，刷新项目列表对象；
 * 自动清理空类别
 * @param {vscode.ExtensionContext} context 
 * @param {String} projectPath 
 * @param {String} category 
 */
function deleteProject(context, projectPath, category) {
    let obj = context.globalState.get('projectList');
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
    context.globalState.update('projectList', obj);
}

/**
 * 更新最近打开的项目，刷新项目列表对象，在点击项目后调用；
 * 自动添加不存在的类别，将刚刚打开的项目和对应列表提升到最前
 * @param {vscode.ExtensionContext} context 
 * @param {String} projectPath 
 */
function refreshRecentProject(context, projectPath, category = null, bringCategoryToHead = true) {
    if (category === null) category = projectCategoryDetect(projectPath);

    let obj = context.globalState.get('projectList');
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

    context.globalState.update('projectList', obj);
}

/**
 * 根据项目路径，自动判断项目类别
 * @param {String} projectPath 
 */
function projectCategoryDetect(projectPath) {
    if (projectPath.indexOf('CLionProjects') !== -1) {
        return 'C++';
    } else if (projectPath.indexOf('GolandProjects') !== -1) {
        return 'Go';
    } else if (projectPath.indexOf('IdeaProjects') !== -1) {
        return 'Java';
    } else if (projectPath.indexOf('PycharmProjects') !== -1) {
        return 'Python';
    } else if (projectPath.indexOf('WebstormProjects') !== -1) {
        return 'Web';
    } else {
        return 'Untagged';
    }
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
 * 
 * @param {vscode.ExtensionContext} context 
 * @param {vscode.WebviewPanel} panel 
 */
function postProjetctList(context, panel) {
    let projectList = context.globalState.get('projectList', objUtil.createNewProjectListObj());
    if (projectList) {
        panel.webview.postMessage({
            command: 'projectListUpdate',
            value: projectList
        });
    }
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

        let conf = vscode.workspace.getConfiguration();

        // Load Project List
        postProjetctList(context, panel);
        // Update Title
        panel.webview.postMessage({
            command: 'titleUpdate',
            value: conf.get(S_welcomePageTitle)
        });
        // Show Category Icon
        if (!conf.get(S_showCategoryIcon)) {
            panel.webview.postMessage({
                command: 'hideCategoryIcon'
            });
        }

        wvPanel = panel;
    });
    context.subscriptions.push(disposable);

    // Startup Action
    if (vscode.workspace.workspaceFolders === undefined &&
        vscode.workspace.getConfiguration().get(S_showWelcomePageWhenStartup)) {
        vscode.commands.executeCommand(C_showWelcomePage);
    }

    // TODO: DEBUG
    // context.globalState.update('projectList', undefined);
    console.log(context.globalState.get('projectList', objUtil.createNewProjectListObj()));
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
