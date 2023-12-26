const path = require('path');
const sqlite3 = require('sqlite3');
const wsStorageUtil = require('./ws-storage');

function getWorkspaceEnabledPlugins(dbPath) {
    console.log(dbPath)
    // Create a new SQLite database instance
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
            if (err) {
                reject(`Error opening SQLite database: ${err.message}`);
                return;
            }

            db.get('SELECT key, value FROM ItemTable WHERE key = ?', ['extensionsIdentifiers/enabled'], (queryErr, row) => {
                if (queryErr) {
                    reject(`Error executing query: ${queryErr.message}`);
                    return;
                }
                const enabledExtensions = row ? JSON.parse(row.value) : [];
                resolve(enabledExtensions);
                db.close();
            });
        });
    });
}

/**
 * @deprecated https://github.com/microsoft/vscode/issues/151985
 */
function setWorkspaceEnabledPlugins(dbPath, pluginsObj) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
            if (err) {
                reject(`Error opening SQLite database: ${err.message}`);
                return;
            }

            console.log("pluginsObj", pluginsObj);

            db.run('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)', ['extensionsIdentifiers/enabled', JSON.stringify(pluginsObj)], err => {
                if (err) {
                    reject(`Error inserting data into SQLite database: ${err.message}`);
                    return;
                }
                resolve();
                db.close();
            });
        });
    });
}

function getGlobalDisabledPlugins() {
    return new Promise((resolve, reject) => {
        const filePath = path.join(wsStorageUtil.getGlobalStoragePath(), 'state.vscdb');
        const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, err => {
            if (err) {
                reject(`Error opening SQLite database: ${err.message}`);
                return;
            }

            db.get('SELECT key, value FROM ItemTable WHERE key = ?', ['extensionsIdentifiers/disabled'], (queryErr, row) => {
                if (queryErr) {
                    reject(`Error executing query: ${queryErr.message}`);
                    return;
                }
                const disabledExtensions = row ? JSON.parse(row.value) : [];
                resolve(disabledExtensions);
                db.close();
            });
        });
    });
}

module.exports = {
    getWorkspaceEnabledPlugins,
    setWorkspaceEnabledPlugins,
    getGlobalDisabledPlugins
};