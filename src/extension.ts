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
    description?: string,
    path?: string,
    isFolder?: boolean
}

const readdir = denodeify(fs.readdir);
const fsStat = denodeify(fs.stat);
const ignoreExtensions: string[] = ['.png', '.jpg', '.gif']; // todo: use contributes configuration endpoint
const cmd = {
    newFile: '$(plus) Create new file',
    moveUp: '$(file-directory) ../'
};

const onlyAllowed = f => ignoreExtensions.indexOf(`${path.extname(f.path)}`) === -1;

const selectFile = async (startDir: string, origin?: string) => {
    if (!origin) { origin = path.basename(startDir) + path.sep }

    const contents: string[] = await readdir(startDir);
    const items: QuickPickItem[] = await Promise.all(contents.map(async f => {
        const filePath = path.join(startDir, f);
        const stats = (await fsStat(filePath));
        const isFolder = stats.isDirectory();
        const label = isFolder ? `$(file-directory) ${f}/` : `$(file-code) ${f}`;

        return {
            label,
            isFolder,
            path: filePath
        };
    }))

    const cmds: any[] = [
        {
            label: cmd.newFile,
            description: `Create a new file in ${path.normalize(origin)}`
        }, {
            label: cmd.moveUp,
            description: `move up a folder`
        }
    ];

    const selection: any = await window.showQuickPick([
        ...cmds, ...items.filter(onlyAllowed)
    ]);

    if (selection === undefined) {
        return;
    }

    if (selection.isFolder) {
        return selectFile(selection.path, origin + path.basename(selection.path) + path.sep); 
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
    if (selection.label === cmd.moveUp) {
        return selectFile(path.resolve(startDir, '..'), origin + '..' + path.sep);
    }

    return selection.path;
}

export function activate(context: ExtensionContext) {
    let disposable = commands.registerCommand('quickOpenCreate.open', async () => {
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