'use strict';
import {commands, window, ExtensionContext, workspace, Uri} from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {denodeify} from 'q';

const readdir = denodeify(fs.readdir);
const fsStat = denodeify(fs.stat);

const cmd  ={
    newFile: '$ Create new file'
};

const selectFile = async (startDir: string) => {
    const files = await readdir(startDir);
    const cmds = [
        {
            label: cmd.newFile,
            description: `Create a new file in ${startDir}` // TODO: remove path to project root
        }, {
            label: '../',
            description: `move up a folder`
        }
    ];

    let selection = await window.showQuickPick([
        ...cmds, // show commands on top
        ...files.map(f => ({
            label: f
        }))
    ]);

    if (selection === undefined) {
        return;
    }

    let fileName = selection.label;

    //
    // Create new File
    //
    if (fileName === cmd.newFile) {
        fileName = await window.showInputBox({
            prompt: 'Enter the name of the new file'
        });

        return fileName ? Uri.file(path.join(startDir, fileName)).with({
            scheme: 'untitled'
        }) : undefined;
    } 

    //
    // Move up one folder
    //
    if (fileName === '../') {
        return selectFile(path.resolve(startDir, '..'));
    }

    const filePath = path.join(startDir, fileName);
    const stats = (await fsStat(filePath)) as fs.Stats;

    // recurse into directory
    if (stats.isDirectory()) {
        return selectFile(filePath);
    }

    return filePath;
}

export function activate(context: ExtensionContext) {
    if (!window.activeTextEditor) {
        return; // TODO: start at project root
    }

    let disposable = commands.registerCommand('smartOpenFile.open', async () => {
        try {
            const currentDir = path.dirname(window.activeTextEditor.document.fileName);
            const openPath = await selectFile(currentDir);

            if (openPath === undefined) {
                return; // abort!
            }

            const doc = await workspace.openTextDocument(openPath);

            if (!doc) {
                throw new Error('could not open file');
            }

            const editor = window.showTextDocument(doc);
        } catch (err) {
            if (err.message) {
                window.showErrorMessage(err.message);
            }
        }
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}