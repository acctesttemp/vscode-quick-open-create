'use strict';
/**
 * NOTE: 
 * This is my first VSCode extension. Happy for any feedback
 * This is my first time using TypeScript. Again, happy for any feedback.
 */
import { commands, window, ExtensionContext, workspace, Uri } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {denodeify} from 'q';

interface QuickPickItem { // Add props to QPI without TS complaining.
    label: string,
    description: string,
    path?: string,
    isFolder?: boolean
}

const readdir = denodeify(fs.readdir);
const fsStat = denodeify(fs.stat);
const cmd = {
    newFile: '$ Create new file'
};

const selectFile = async (startDir: string) => {
    const contents: string[] = await readdir(startDir);
    const items: QuickPickItem[] = await Promise.all(contents.map(async f => {
        const stats = (await fsStat(path.join(startDir, f)));
        const isFolder = stats.isDirectory();
        const description = isFolder ? 'open this' : '';
        const label = f + isFolder ? '/' : '';

        return {
            label,
            description,
            isFolder,
            path: path.join(startDir, f)
        };
    }));

    const cmds = [
        {
            label: cmd.newFile,
            description: `Create a new file in ${startDir}`
        }, {
            label: '../',
            description: `move up a folder`
        }
    ];

    const selection: QuickPickItem = await window.showQuickPick([ ...cmds, ...items ]);

    if (selection === undefined) {
        return;
    }

    if (selection.isFolder) {
        return selectFile(selection.path); 
    }

    // Create new File
    if (selection.label === cmd.newFile) {
        const fileName = await window.showInputBox({
            prompt: 'Enter the name of the new file'
        });

        return fileName ? Uri.file(path.join(startDir, fileName)).with({
            scheme: 'untitled'
        }) : undefined;
    } 

    // Move up one folder
    if (selection.label === '../') {
        return selectFile(path.resolve(startDir, '..'));
    }

    return selection.path;
}

export function activate(context: ExtensionContext) {
    let disposable = commands.registerCommand('smartOpenFile.open', async () => {
        if (!window.activeTextEditor) {
            return;  // no file open
        }

        try {
            const currentDir = path.dirname(window.activeTextEditor.document.fileName);
            const openPath = await selectFile(currentDir);

            if (openPath === undefined) {
                return; // abort!
            }

            const doc = await workspace.openTextDocument(openPath);

            if (!doc) {
                throw new Error(`could not open file ${doc}`);
            }

            window.showTextDocument(doc);
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