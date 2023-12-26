const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

function getVSCodePath() {
    switch (process.platform) {
        case "win32":
            return `${process.env.APPDATA}\\Code`;
        case "darwin":
            return `${process.env.HOME}/Library/Application Support/Code`;
        case "linux":
        default:
            return `${process.env.HOME}/.config/Code`;
    }
}

function createIdentity(fsPath) {
    const fileStat = fs.statSync(fsPath);
    let ctime;

    if (process.platform === 'linux') {
        ctime = fileStat.ino; // Linux: birthtime is ctime, so we cannot use it! We use the ino instead!
    } else if (process.platform === 'darwin') {
        ctime = fileStat.birthtimeMs; // macOS: birthtime is fine to use as is
    } else if (process.platform === 'win32') {
        if (typeof fileStat.birthtimeMs === 'number') {
            ctime = Math.floor(fileStat.birthtimeMs); // Windows: fix precision issue in node.js 8.x to get 7.x results (see https://github.com/nodejs/node/issues/19897)
        } else {
            ctime = fileStat.birthtime.getTime();
        }
    }

    // we use the ctime as extra salt to the ID so that we catch the case of a folder getting
    // deleted and recreated. in that case we do not want to carry over previous state
    return createHash('md5').update(fsPath).update(ctime ? String(ctime) : '').digest('hex');
}

function getWorkspaceStoragePath(fsPath) {
    return path.join(getVSCodePath(), 'User', 'workspaceStorage', createIdentity(fsPath));
}

function getGlobalStoragePath() {
    return path.join(getVSCodePath(), 'User', 'globalStorage');
}

module.exports = {
    getWorkspaceStoragePath,
    getGlobalStoragePath
}